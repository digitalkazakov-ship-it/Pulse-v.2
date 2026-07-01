"""
Universal ad_spend processor for Prometheus / Mediascope Flowchart exports.
Auto-detects brands, channels and date range from a single .xlsx (sheet 'Flowchart').

Expected column layout (detected from header row, with index fallbacks):
  col 3  'Тип медиа'             — media channel
  col 6  'Список брендов'        — semicolon-separated brand names
  col 10 'Список категорий 3'    — level-3 categories (used for brand classification)
  col 17 'Неделя'                — datetime (week start date)
  col 21 'Prometheus Est. Cost'  — numeric spend in RUB

Retailer filtering:
  In a category-specific Mediascope file retailers NEVER have standalone retail-only rows
  (every row is in the context of the advertised category). Classification therefore uses
  two passes:
  1. Name-based: if the brand name contains a known Russian retailer/marketplace keyword
     → exclude as retailer (handles МАГНИТ, САМОКАТ, OZON, ВЕРНЫЙ, X5 КЛУБ, etc.)
  2. Category context (for unknown brands): brands with product-category rows but no
     name-match are included as product brands. This correctly includes store-label cheese
     brands like ЛАМБЕР that always co-appear with a retailer.
"""
import re
import datetime
import openpyxl

RU_MONTHS = {
    '01': 'Янв', '02': 'Фев', '03': 'Мар', '04': 'Апр',
    '05': 'Май', '06': 'Июн', '07': 'Июл', '08': 'Авг',
    '09': 'Сен', '10': 'Окт', '11': 'Ноя', '12': 'Дек',
}

# Ordered most-specific first; matched as substring of lowercased channel value
CHANNEL_MAP = [
    ('телевидение', 'tv'),
    ('радио',       'radio'),
    ('наружная',    'outdoor'),
    ('интернет',    'digital'),
    ('пресса',      'press'),
]

# Substrings (lowercased) that identify a brand as a retailer/marketplace/delivery service.
# Matched against the lowercased brand name; any match → brand is excluded from results.
RETAILER_NAME_KW = frozenset([
    'пятерочка', 'магнит', 'перекресток', 'лента', 'дикси',
    'ашан', 'auchan', 'верный', 'окей', "о'кей", 'карусель',
    'самокат', 'сбермаркет', 'vprok',
    'ozon', 'озон', 'wildberries', 'вайлдберриз',
    'metro', 'метро', 'x5 клуб', 'x5клуб',
    'сбер', 'выручай', 'яндекс лавка', 'яндекс.лавка',
    'вкусвилл', 'кировский', 'монетка', 'командор', 'бахетле',
    'сеть магазинов', 'торговая сеть',
])

# Category keywords for col10 (used as secondary signal for unknown brands)
PRODUCT_CAT_KW = ('молочн', 'масложир', 'мясо', 'продукты питания', 'замороз', 'колбас', 'ветчин')
RETAIL_CAT_KW  = ('торговы', 'маркетплейс', 'интернет-торгов', 'услуги в области')

TOP_N_BRANDS = 10


def _brand_key(name: str) -> str:
    return re.sub(r'[^\w]', '', name.strip(), flags=re.UNICODE)


def _month_label(ym: str, multi_year: bool) -> str:
    year, month = ym.split('-')
    label = RU_MONTHS[month]
    if multi_year:
        label += f" '{year[2:]}"
    return label


def _find_col(header: tuple, *keywords: str) -> int | None:
    """Return first column index where ALL keywords appear (case-insensitive) in the cell value."""
    for ci, v in enumerate(header):
        if v is None:
            continue
        low = str(v).lower()
        if all(kw in low for kw in keywords):
            return ci
    return None


def _row_cats(cat_val: str) -> tuple[bool, bool]:
    """Returns (has_product, has_retail) for a col10 category cell value."""
    low = cat_val.lower()
    return (any(kw in low for kw in PRODUCT_CAT_KW),
            any(kw in low for kw in RETAIL_CAT_KW))


def _is_product_brand(brand: str, stats: dict) -> bool:
    """True if brand should be included as a product (non-retailer) brand.

    Pass 1 (name-based): known Russian retailers/marketplaces are excluded by name keyword.
    Pass 2 (category-based): for remaining brands, include those that appear in rows with
    product categories — even store-label brands with zero standalone rows (e.g. ЛАМБЕР).
    """
    if any(kw in brand.lower() for kw in RETAILER_NAME_KW):
        return False
    if stats['product_solo'] > 0:
        return True
    if stats['retail_solo'] > 0:
        return False
    # No solo rows at all: include if the brand appears alongside product categories
    return (stats['product_mixed'] + stats['mixed_both']) > 0


def process(file_path: str) -> dict:
    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    ws = next(
        (s for s in wb.worksheets if 'flowchart' in s.title.lower()),
        wb.worksheets[0],
    )
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    header = rows[0] if rows else ()

    # Detect columns from header; fall back to known positions
    col_channel = _find_col(header, 'тип', 'медиа')
    if col_channel is None:
        col_channel = 3

    col_brand = _find_col(header, 'список', 'брендов')
    if col_brand is None:
        col_brand = 6

    # Detect col10 (Список категорий 3): prefer explicit '3' match, fall back to 2nd cat column
    col_cat3 = _find_col(header, 'список', 'категор', '3')
    if col_cat3 is None:
        cat_cols = [ci for ci, v in enumerate(header)
                    if v and 'список' in str(v).lower() and 'категор' in str(v).lower()]
        col_cat3 = cat_cols[1] if len(cat_cols) >= 2 else 10

    col_cost = _find_col(header, 'prometheus', 'cost')
    if col_cost is None:
        col_cost = 21

    # Find date column: first column containing a datetime value in the first data row
    col_date = 17
    if len(rows) > 1:
        for ci, v in enumerate(rows[1]):
            if isinstance(v, datetime.datetime):
                col_date = ci
                break

    # Pass 1: classify each brand as product vs retailer
    brand_stats: dict[str, dict] = {}

    for r in rows[1:]:
        brand_raw = str(r[col_brand]) if col_brand < len(r) and r[col_brand] else ''
        if not brand_raw or brand_raw.lower() == 'none':
            continue
        cat3_val = str(r[col_cat3]) if col_cat3 < len(r) and r[col_cat3] else ''
        has_product, has_retail = _row_cats(cat3_val)
        brands_in_row = [b.strip() for b in brand_raw.split(';') if b.strip()]
        is_solo = len(brands_in_row) == 1

        for brand in brands_in_row:
            if brand not in brand_stats:
                brand_stats[brand] = {
                    'product_solo': 0, 'retail_solo': 0,
                    'product_mixed': 0, 'retail_mixed': 0, 'mixed_both': 0,
                }
            s = brand_stats[brand]
            if is_solo:
                if has_product and not has_retail:
                    s['product_solo'] += 1
                elif has_retail and not has_product:
                    s['retail_solo'] += 1
            else:
                if has_product and has_retail:
                    s['mixed_both'] += 1
                elif has_product:
                    s['product_mixed'] += 1
                elif has_retail:
                    s['retail_mixed'] += 1

    product_brands = {b for b, s in brand_stats.items() if _is_product_brand(b, s)}

    # Pass 2: accumulate spend for product brands only
    # Rows that contain any retailer brand are excluded entirely (no retailer co-branded placements)
    spend: dict[str, dict[str, dict[str, float]]] = {}

    for r in rows[1:]:
        date = r[col_date] if col_date < len(r) else None
        if not isinstance(date, datetime.datetime):
            continue

        brand_raw = str(r[col_brand]) if col_brand < len(r) and r[col_brand] else ''
        if not brand_raw or brand_raw.lower() == 'none':
            continue

        brands_in_row = [b.strip() for b in brand_raw.split(';') if b.strip()]
        if any(any(kw in b.lower() for kw in RETAILER_NAME_KW) for b in brands_in_row):
            continue

        channel_raw = str(r[col_channel]).lower() if col_channel < len(r) and r[col_channel] else ''
        channel = next((v for k, v in CHANNEL_MAP if k in channel_raw), 'other')

        cost = float(r[col_cost]) if col_cost < len(r) and isinstance(r[col_cost], (int, float)) else 0.0
        ym = date.strftime('%Y-%m')

        for brand in brands_in_row:
            if brand not in product_brands:
                continue
            spend.setdefault(brand, {}).setdefault(ym, {})
            spend[brand][ym][channel] = spend[brand][ym].get(channel, 0.0) + cost

    # Select top N brands by total spend
    brand_totals = {
        b: sum(c for m in months.values() for c in m.values())
        for b, months in spend.items()
    }
    top_brands = sorted(brand_totals, key=lambda b: brand_totals[b], reverse=True)[:TOP_N_BRANDS]

    all_months = sorted({ym for b in top_brands for ym in spend.get(b, {})})
    multi_year = len({ym[:4] for ym in all_months}) > 1

    all_channels = sorted({
        ch for b in top_brands
        for m in spend.get(b, {}).values()
        for ch in m
        if ch != 'other'
    })

    brand_keys    = [_brand_key(b) for b in top_brands]
    brand_display = {_brand_key(b): b.title() for b in top_brands}

    def build_series(channel: str | None) -> list:
        series = []
        for ym in all_months:
            pt: dict = {'month': _month_label(ym, multi_year)}
            for b, bk in zip(top_brands, brand_keys):
                bm = spend.get(b, {}).get(ym, {})
                if channel is None:
                    val = sum(v for k, v in bm.items() if k != 'other')
                else:
                    val = bm.get(channel, 0.0)
                pt[bk] = round(val / 1_000_000, 2)
            series.append(pt)
        return series

    channels_out: dict = {'total': build_series(None)}
    for ch in all_channels:
        channels_out[ch] = build_series(ch)

    return {
        'generated':  all_months[-1] if all_months else '',
        'brands':     brand_keys,
        'brandNames': brand_display,
        'channels':   channels_out,
    }
