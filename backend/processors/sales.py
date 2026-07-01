"""
Universal sales processor for Nielsen-style monthly dynamics exports.
Auto-detects brands and column layout from the two header rows.

File structure (0-indexed rows):
  Row 0: Section labels repeated N times per section
          (Средняя цена / Индекс продаж / Доля бренда / Динамика / Дистрибуция)
  Row 1: col0=Дата, col1..N=brand names (same N names repeat for every section)
  Row 2+: Data rows — col0 date string ('DD.MM.YYYY'), col1+ numeric values
"""
import re
import openpyxl
import datetime

RU_MONTHS = {
    1: 'Янв', 2: 'Фев', 3: 'Мар', 4: 'Апр', 5: 'Май', 6: 'Июн',
    7: 'Июл', 8: 'Авг', 9: 'Сен', 10: 'Окт', 11: 'Ноя', 12: 'Дек',
}

# Keywords (lowercase) that identify each section in row 0
SECTION_MAP = [
    ('цен',     'price'),
    ('индекс',  'salesIndex'),
    ('доля',    'marketShare'),
    ('динамик', 'salesYoY'),
    ('дистриб', 'distribution'),
]

DECIMALS = {
    'price': 2, 'salesIndex': 5, 'marketShare': 3,
    'salesYoY': 2, 'distribution': 2,
}


def _brand_key(name: str) -> str:
    """Uppercase then strip non-word chars so keys match ad_spend brand keys."""
    return re.sub(r'[^\w]', '', name.strip().upper(), flags=re.UNICODE)


def _parse_date(v) -> datetime.date | None:
    if isinstance(v, datetime.datetime):
        return v.date()
    if isinstance(v, str):
        for fmt in ('%d.%m.%Y', '%Y-%m-%d', '%m/%d/%Y'):
            try:
                return datetime.datetime.strptime(v.strip(), fmt).date()
            except ValueError:
                pass
    return None


def _month_label(d: datetime.date) -> str:
    return f"{RU_MONTHS[d.month]} '{str(d.year)[2:]}"


def process(file_path: str) -> dict:
    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    header0 = rows[0]  # section labels
    header1 = rows[1]  # brand names

    # ── Detect number of brands per section ─────────────────────────────────
    # Brand names start at col 1 and repeat once per section.
    # Count columns until the first brand name repeats.
    first_brand = str(header1[1]) if len(header1) > 1 and header1[1] else ''
    n = 1
    while n < len(header1) - 1:
        cell = header1[1 + n]
        if cell is not None and str(cell) == first_brand:
            break
        n += 1

    brands_raw = [str(header1[1 + i]) for i in range(n) if header1[1 + i] is not None]
    brand_keys    = [_brand_key(b) for b in brands_raw]
    brand_display = {k: b for k, b in zip(brand_keys, brands_raw)}

    # ── Detect sections from row 0 ───────────────────────────────────────────
    sections: dict[str, list[int]] = {}
    col_start = 1
    for _ in SECTION_MAP:
        if col_start >= len(header0):
            break
        label = str(header0[col_start]).lower() if header0[col_start] else ''
        key = next((v for kw, v in SECTION_MAP if kw in label), None)
        if key:
            sections[key] = list(range(col_start, col_start + n))
        col_start += n

    # ── Parse data rows ──────────────────────────────────────────────────────
    data_rows: list[tuple[datetime.date, tuple]] = []
    for r in rows[2:]:
        d = _parse_date(r[0])
        if d is not None:
            data_rows.append((d, r))
    data_rows.sort(key=lambda x: x[0])

    def build_series(col_indices: list[int], decimals: int = 4) -> list[dict]:
        series = []
        for d, row in data_rows:
            pt: dict = {'month': _month_label(d)}
            for bk, ci in zip(brand_keys, col_indices):
                val = row[ci] if ci < len(row) else None
                pt[bk] = round(float(val), decimals) if isinstance(val, (int, float)) else 0.0
            series.append(pt)
        return series

    result: dict = {
        'generated':  str(data_rows[-1][0])[:7] if data_rows else '',
        'brands':     brand_keys,
        'brandNames': brand_display,
    }
    for key, cols in sections.items():
        result[key] = build_series(cols, DECIMALS.get(key, 4))

    return result
