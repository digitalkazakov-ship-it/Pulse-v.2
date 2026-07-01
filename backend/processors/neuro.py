"""
GEO / AI-visibility processor.
Accepts a single .xlsx file with brand mentions in AI responses (Google AI Overview, Yandex NeuroSearch).

Expected sheet layout (auto-detected by sheet name keywords):
  Sheet 'Сводка'          — summary: Бренд | Google: упом. | Google: ответов | Google: доля % | Яндекс: упом. | Яндекс: ответов | Яндекс: доля %
  Sheet '*Google*'        — per-query mentions for Google
  Sheet '*Яндекс*'        — per-query mentions for Yandex
  Sheet 'Источники'       — source sites with citation counts

Brands are auto-detected from the Сводка sheet (not hardcoded).
"""
import re
import openpyxl


def _brand_key(name: str) -> str:
    return re.sub(r'[^\w]', '', str(name).strip(), flags=re.UNICODE)


def _find_sheet(wb, *keywords: str):
    """Return first sheet whose title contains ALL keywords (case-insensitive)."""
    for ws in wb.worksheets:
        t = ws.title.lower()
        if all(kw.lower() in t for kw in keywords):
            return ws
    return None


def _data_rows(ws, header_row_idx: int = 2):
    """Return (headers, data_rows) where header is at header_row_idx (0-indexed)."""
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) <= header_row_idx:
        return [], []
    return list(rows[header_row_idx]), rows[header_row_idx + 1:]


def _parse_summary(ws):
    headers, rows = _data_rows(ws, header_row_idx=2)
    brands, brand_names, summary = [], {}, []
    for r in rows:
        brand = r[0]
        if not brand or not isinstance(brand, str):
            continue
        bk = _brand_key(brand)
        brands.append(bk)
        brand_names[bk] = brand
        summary.append({
            'brand':          bk,
            'brandName':      brand,
            'googleMentions': r[1] if isinstance(r[1], (int, float)) else 0,
            'googleTotal':    r[2] if isinstance(r[2], (int, float)) else 0,
            'googleShare':    round(float(r[3]), 1) if isinstance(r[3], (int, float)) else 0.0,
            'yandexMentions': r[4] if isinstance(r[4], (int, float)) else 0,
            'yandexTotal':    r[5] if isinstance(r[5], (int, float)) else 0,
            'yandexShare':    round(float(r[6]), 1) if isinstance(r[6], (int, float)) else 0.0,
        })
    return brands, brand_names, summary


def _parse_queries(ws, brands: list) -> list:
    """Parse per-query sheet → [{query, total, brand1: N, brand2: N, ...}]"""
    headers, rows = _data_rows(ws, header_row_idx=2)
    # headers: [Запрос, Ответов, Brand1, Brand2, ...]
    brand_cols = {}
    for ci, h in enumerate(headers):
        if h and ci >= 2:
            bk = _brand_key(str(h))
            if bk in brands:
                brand_cols[ci] = bk

    result = []
    for r in rows:
        query = r[0]
        if not query or not isinstance(query, str):
            continue
        total = r[1] if isinstance(r[1], (int, float)) else 0
        pt = {'query': query, 'total': int(total)}
        for ci, bk in brand_cols.items():
            v = r[ci] if ci < len(r) else None
            pt[bk] = int(v) if isinstance(v, (int, float)) else 0
        result.append(pt)
    return result


def _parse_sources(ws) -> list:
    headers, rows = _data_rows(ws, header_row_idx=2)
    result = []
    for r in rows:
        site = r[0]
        if not site or not isinstance(site, str):
            continue
        result.append({
            'site':    site,
            'google':  int(r[1]) if isinstance(r[1], (int, float)) else 0,
            'yandex':  int(r[2]) if isinstance(r[2], (int, float)) else 0,
            'total':   int(r[3]) if isinstance(r[3], (int, float)) else 0,
            'brands':  str(r[4]) if r[4] else '',
        })
    return result


def process(file_path: str) -> dict:
    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)

    ws_summary = _find_sheet(wb, 'сводк')
    if ws_summary is None:
        ws_summary = wb.worksheets[0]

    brands, brand_names, summary = _parse_summary(ws_summary)

    ws_google = _find_sheet(wb, 'google') or _find_sheet(wb, 'гугл')
    ws_yandex = _find_sheet(wb, 'яндекс') or _find_sheet(wb, 'yandex')
    ws_sources = _find_sheet(wb, 'источник')

    queries_google = _parse_queries(ws_google, brands) if ws_google else []
    queries_yandex = _parse_queries(ws_yandex, brands) if ws_yandex else []
    sources = _parse_sources(ws_sources) if ws_sources else []

    wb.close()

    return {
        'brands':     brands,
        'brandNames': brand_names,
        'summary':    summary,
        'queries': {
            'google': queries_google,
            'yandex': queries_yandex,
        },
        'sources': sources,
    }
