"""
Universal E-com processor.
Auto-detects brands, marketplaces, months and metric sections from a single .xlsx.

Expected sheet structure (repeated per metric section):
  [Section title row]        col 0 = metric description, cols 1+ empty/dash
  [metadata rows]            skipped
  [Month header row]         cols 1+ = Russian month names (Январь, Февраль …)
  [Marketplace header row]   col 0 = marketplace name (OZON / WB / etc.), cols 1+ = dash
  [Brand data rows]          col 0 = brand name, cols 1+ = numeric values
  …repeat for each marketplace…
  [Total row]                col 0 starts with 'Итого'
"""
import re
import openpyxl

MONTH_RU = {
    'январь': 'Янв', 'февраль': 'Фев', 'март': 'Мар', 'апрель': 'Апр',
    'май': 'Май', 'июнь': 'Июн', 'июль': 'Июл', 'август': 'Авг',
    'сентябрь': 'Сен', 'октябрь': 'Окт', 'ноябрь': 'Ноя', 'декабрь': 'Дек',
}

# Ordered most-specific first
METRIC_DETECT = [
    ('skuShare',   ['доля', 'sku']),
    ('skuCount',   ['sku']),
    ('salesShare', ['доля']),
    ('revenue',    ['выручк']),
    ('sales',      ['продаж']),
]

# Ordered: more specific substrings first
MP_PATTERNS = [
    ('ozonfresh', ['ozon fresh', 'ozon_fresh', 'озон фреш']),
    ('ozon',      ['ozon', 'озон']),
    ('wb',        ['wildberries', 'вайлдберриз', 'вб']),
    ('ym',        ['яндекс маркет', 'yandex market', 'я.маркет']),
]

METRIC_MULT = {'revenue': 1 / 1_000_000, 'salesShare': 100, 'skuShare': 100}
METRIC_DEC  = {'revenue': 2, 'sales': 0, 'salesShare': 4, 'skuCount': 0, 'skuShare': 4}
TOTAL_WORDS = {'итого', 'итог', 'total', 'всего'}


def _brand_key(name: str) -> str:
    return re.sub(r'[^\w]', '', name.strip(), flags=re.UNICODE)


def _detect_metric(text: str) -> str | None:
    lower = text.lower()
    for key, keywords in METRIC_DETECT:
        if all(kw in lower for kw in keywords):
            return key
    return None


def _detect_mp(text: str) -> str | None:
    lower = text.strip().lower()
    for key, patterns in MP_PATTERNS:
        if any(p in lower for p in patterns):
            return key
    return None


def process(file_path: str) -> dict:
    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    rows = list(wb.worksheets[0].iter_rows(values_only=True))
    wb.close()

    # Find first row with ≥3 Russian month names
    month_row_i: int | None = None
    for ri, row in enumerate(rows):
        cnt = sum(1 for v in row if isinstance(v, str) and v.strip().lower() in MONTH_RU)
        if cnt >= 3:
            month_row_i = ri
            break

    if month_row_i is None:
        raise ValueError("Month header row not found — expected Russian month names (Январь, Февраль …)")

    # Look for year numbers in the row immediately above the month header
    year_at: dict[int, int] = {}  # col_index → year
    if month_row_i > 0:
        for ci, v in enumerate(rows[month_row_i - 1]):
            if isinstance(v, (int, float)) and 2015 <= int(v) <= 2035:
                year_at[ci] = int(v)

    def _col_year(ci: int) -> int | None:
        """Return the year that applies to column ci (last year boundary ≤ ci)."""
        y = None
        for yb in sorted(year_at):
            if yb <= ci:
                y = year_at[yb]
            else:
                break
        return y

    # Build ordered list of (label, col_index) keeping ALL month columns
    # with year suffix when year info is available.
    month_cols_list: list[tuple[str, int]] = []
    month_order: list[str] = []
    seen_labels: set[str] = set()

    for ci, v in enumerate(rows[month_row_i]):
        if not isinstance(v, str):
            continue
        short = MONTH_RU.get(v.strip().lower())
        if short is None:
            continue
        year = _col_year(ci)
        label = f"{short} '{str(year)[2:]}" if year is not None else short
        if label in seen_labels:
            continue
        month_cols_list.append((label, ci))
        month_order.append(label)
        seen_labels.add(label)

    if not month_cols_list:
        raise ValueError("Month header row not found — expected Russian month names (Январь, Февраль …)")

    # Scan rows and collect raw values
    # raw[metric_key][mp_key][brand_key][month_label] = numeric_value
    raw: dict = {}
    brands_order: list = []
    brand_display: dict = {}

    current_metric: str | None = None
    current_mp: str | None = None

    for row in rows:
        col0 = row[0] if row else None
        if col0 is None or not isinstance(col0, str):
            continue
        s = col0.strip()
        if not s or s == '-':
            continue

        lower = s.lower()

        # Skip total / aggregate rows
        if any(w in lower for w in TOTAL_WORDS):
            continue

        # Check whether this row has numeric values in month columns
        month_vals = {
            lbl: row[ci]
            for lbl, ci in month_cols_list
            if ci < len(row) and isinstance(row[ci], (int, float))
        }

        if not month_vals:
            # Header row — detect marketplace or metric section
            mp = _detect_mp(s)
            if mp is not None:
                current_mp = mp
            else:
                mk = _detect_metric(s)
                if mk is not None:
                    current_metric = mk
                    current_mp = None
            continue

        # Brand data row
        if current_metric is None or current_mp is None:
            continue

        bk = _brand_key(s)
        if bk not in brand_display:
            brands_order.append(bk)
            brand_display[bk] = s

        (raw
         .setdefault(current_metric, {})
         .setdefault(current_mp, {})
         .setdefault(bk, {})
         .update(month_vals))

    # Convert raw data to output series [{month, brand: value, …}]
    def to_series(bk_data: dict, mult: float, dec: int) -> list:
        series = []
        for month in month_order:
            pt: dict = {'month': month}
            for bk in brands_order:
                v = bk_data.get(bk, {}).get(month)
                pt[bk] = round(v * mult, dec) if v is not None else None
            series.append(pt)
        return series

    def all_series(mp_dict: dict, mult: float, dec: int) -> list:
        combined: dict = {}
        for bk_data in mp_dict.values():
            for bk, month_data in bk_data.items():
                for month, v in month_data.items():
                    combined.setdefault(bk, {})[month] = (
                        combined.get(bk, {}).get(month, 0) + v
                    )
        return to_series(combined, mult, dec)

    charts: dict = {}
    all_mp_keys: set = set()

    for metric_key, mp_dict in raw.items():
        mult = METRIC_MULT.get(metric_key, 1)
        dec  = METRIC_DEC.get(metric_key, 2)
        metric_out: dict = {}
        for mp, bk_data in mp_dict.items():
            metric_out[mp] = to_series(bk_data, mult, dec)
            all_mp_keys.add(mp)
        metric_out['all'] = all_series(mp_dict, mult, dec)
        charts[metric_key] = metric_out

    return {
        'generated':   '',
        'brands':      brands_order,
        'brandNames':  brand_display,
        'months':      month_order,
        'marketplaces': sorted(all_mp_keys),
        'charts':      charts,
    }
