"""
Universal creatives processor for Prometheus / Mediascope Creatives exports.
Auto-detects top product brands from the file; excludes retailers using the same
name-based + category-context logic as ad_spend.py.

Expected sheet: 'Креативы'
Column layout (auto-detected from header, with index fallbacks):
  col 3  'Статус эфира'          — filter: 'Активный' only
  col 4  'Тип медиа'             — media channel
  col 6  'Дата первого выхода'   — datetime
  col 9  'Список брендов'        — semicolon-separated brand names
  col 13 'Список категорий 3'    — level-3 categories (brand classification)
  col 16 'Сюжет'                 — creative story text
  col 19 'Тип коммуникации'      — Промо / Имиджевая / Продуктовая
"""
import re
import datetime
import openpyxl

# Channel mapping: substring of lowercased col4 value → canonical key
CHANNEL_MAP = [
    ('телевидени', 'tv'),
    ('радио',      'radio'),
    ('наружн',     'outdoor'),
    ('интернет',   'digital'),
    ('пресс',      'press'),
]
CHANNELS = ['tv', 'radio', 'outdoor', 'digital']

# Comm-type mapping: substring of lowercased col19 value → canonical key
COMM_KW = [
    ('имиджев', 'image'),
    ('промо',   'promo'),
    ('продукт', 'product'),
]

# Same retailer exclusion list as ad_spend.py
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

PRODUCT_CAT_KW = ('молочн', 'масложир', 'мясо', 'продукты питания', 'замороз', 'колбас', 'ветчин')
RETAIL_CAT_KW  = ('торговы', 'маркетплейс', 'интернет-торгов', 'услуги в области')

TOP_N_BRANDS = 10


def _brand_key(name: str) -> str:
    return re.sub(r'[^\w]', '', name.strip(), flags=re.UNICODE)


def _find_col(header: tuple, *keywords: str) -> int | None:
    for ci, v in enumerate(header):
        if v is None:
            continue
        low = str(v).lower()
        if all(kw in low for kw in keywords):
            return ci
    return None


def _row_cats(cat_val: str) -> tuple[bool, bool]:
    low = cat_val.lower()
    return (any(kw in low for kw in PRODUCT_CAT_KW),
            any(kw in low for kw in RETAIL_CAT_KW))


def _is_product_brand(brand: str, stats: dict) -> bool:
    if any(kw in brand.lower() for kw in RETAILER_NAME_KW):
        return False
    if stats['product_solo'] > 0:
        return True
    if stats['retail_solo'] > 0:
        return False
    return (stats['product_mixed'] + stats['mixed_both']) > 0


def process(file_path: str) -> dict:
    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    ws = next(
        (s for s in wb.worksheets if 'креатив' in s.title.lower()),
        wb.worksheets[0],
    )
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    header = rows[0] if rows else ()

    col_status  = _find_col(header, 'статус')
    if col_status is None:
        col_status = 3

    col_channel = _find_col(header, 'тип', 'медиа')
    if col_channel is None:
        col_channel = 4

    col_date = _find_col(header, 'дата', 'первого', 'выход')
    if col_date is None:
        col_date = 6

    col_brand = _find_col(header, 'список', 'брендов')
    if col_brand is None:
        col_brand = 9

    col_cat3 = _find_col(header, 'список', 'категор', '3')
    if col_cat3 is None:
        cat_cols = [ci for ci, v in enumerate(header)
                    if v and 'список' in str(v).lower() and 'категор' in str(v).lower()]
        col_cat3 = cat_cols[1] if len(cat_cols) >= 2 else 13

    col_story = _find_col(header, 'сюжет')
    if col_story is None:
        col_story = 16

    col_comm = _find_col(header, 'тип', 'коммуникаци')
    if col_comm is None:
        col_comm = 19

    # Pass 1: classify each brand as product vs retailer
    brand_stats: dict[str, dict] = {}

    for r in rows[1:]:
        status = str(r[col_status]).strip() if col_status < len(r) and r[col_status] else ''
        if status and status != 'Активный':
            continue
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

    # Count active creatives per product brand (for top N)
    # Rows with any retailer co-branding are excluded entirely
    brand_counts: dict[str, int] = {}
    for r in rows[1:]:
        status = str(r[col_status]).strip() if col_status < len(r) and r[col_status] else ''
        if status and status != 'Активный':
            continue
        brand_raw = str(r[col_brand]) if col_brand < len(r) and r[col_brand] else ''
        if not brand_raw or brand_raw.lower() == 'none':
            continue
        brands_in_row = [b.strip() for b in brand_raw.split(';') if b.strip()]
        if any(any(kw in b.lower() for kw in RETAILER_NAME_KW) for b in brands_in_row):
            continue
        for brand in brands_in_row:
            if brand in product_brands:
                brand_counts[brand] = brand_counts.get(brand, 0) + 1

    top_brands = sorted(brand_counts, key=lambda b: brand_counts[b], reverse=True)[:TOP_N_BRANDS]

    brand_keys    = [_brand_key(b) for b in top_brands]
    brand_display = {_brand_key(b): b.title() for b in top_brands}
    brand_key_map = {b: _brand_key(b) for b in top_brands}

    # Initialize output structures
    monitoring: dict[str, dict] = {
        bk: {ch: {'image': 0, 'promo': 0, 'product': 0} for ch in CHANNELS}
        for bk in brand_keys
    }
    stories: dict[str, dict] = {bk: {ch: [] for ch in CHANNELS} for bk in brand_keys}
    dates: list[datetime.datetime] = []

    # Pass 2: accumulate monitoring counts and stories for top product brands
    # Rows with any retailer co-branding are excluded entirely
    for r in rows[1:]:
        status = str(r[col_status]).strip() if col_status < len(r) and r[col_status] else ''
        if status and status != 'Активный':
            continue
        brand_raw = str(r[col_brand]) if col_brand < len(r) and r[col_brand] else ''
        if not brand_raw or brand_raw.lower() == 'none':
            continue

        brands_in_row = [b.strip() for b in brand_raw.split(';') if b.strip()]
        if any(any(kw in b.lower() for kw in RETAILER_NAME_KW) for b in brands_in_row):
            continue

        channel_raw = str(r[col_channel]).lower() if col_channel < len(r) and r[col_channel] else ''
        channel = next((v for k, v in CHANNEL_MAP if k in channel_raw), None)
        if channel not in CHANNELS:
            continue

        comm_raw = str(r[col_comm]).lower() if col_comm < len(r) and r[col_comm] else ''
        comm_key = next((v for k, v in COMM_KW if k in comm_raw), None)

        story = str(r[col_story]).strip() if col_story < len(r) and r[col_story] else ''

        dt = r[col_date] if col_date < len(r) else None
        if isinstance(dt, datetime.datetime):
            dates.append(dt)

        for brand in brands_in_row:
            bk = brand_key_map.get(brand)
            if bk is None:
                continue
            if comm_key:
                monitoring[bk][channel][comm_key] += 1
            if story and story not in ('N/A', 'None'):
                stories[bk][channel].append(story)

    generated = max(dates).strftime('%Y-%m') if dates else ''

    return {
        'generated':  generated,
        'brands':     brand_keys,
        'brandNames': brand_display,
        'monitoring': [
            {'brand': bk, 'brandName': brand_display[bk], **monitoring[bk]}
            for bk in brand_keys
        ],
        'stories': stories,
    }
