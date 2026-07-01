"""
Converts Еком данные.xlsx to ecom.json for the Availability & E-Com page.

Usage:
    py scripts/process_ecom.py

Input:
    FILE — sheet "Шаг 10 - ecom"

Brand mapping:
    The Act   → Narzan
    Mixit     → Borjomi
    Librederm → Senezhskaya
    VOIS      → Svyatoy
    Sesderma  → ignored

Months: Февраль–Декабрь (cols 1–11).
Ozon/WB have data in cols 6–11 (Июль–Декабрь).
Яндекс.Маркет has data in cols 1–6 (Февраль–Июль).

Output:
    public/data/ecom.json  — {sales, revenue, skuCount, skuShare, salesShare}
    Each metric has keys: ozon, wb, ym, all.
    Revenue stored in млн ₽ (÷1M).
    skuShare / salesShare stored as % (×100).
"""

import openpyxl
import json
from pathlib import Path

FILE   = r'C:\Users\ebone\.claude\New folder\Pulse\Files\E-com\Еком данные.xlsx'
OUTPUT = Path(__file__).parent.parent / 'public' / 'data' / 'ecom.json'

BRANDS = ['Narzan', 'Borjomi', 'Senezhskaya', 'Svyatoy']
BRAND_DISPLAY = {
    'Narzan':      'Нарзан',
    'Borjomi':     'Боржоми',
    'Senezhskaya': 'Сенежская',
    'Svyatoy':     'Святой источник',
}

GENERATED = '2026-05'

MONTHS    = ['Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
MONTH_COLS = list(range(1, 12))   # cols 1–11

# Columns with real data per marketplace
OZON_COLS = frozenset(range(6, 12))  # Июл–Дек
WB_COLS   = frozenset(range(6, 12))
YM_COLS   = frozenset(range(1, 7))   # Фев–Июл

# Brand row order within each marketplace block:
# Ozon/WB: The Act, Mixit, Librederm, Sesderma(skip), VOIS
# YM:      The Act, Mixit, Sesderma(skip), VOIS  (Librederm absent)
OZON_WB_MAP = ['Narzan', 'Borjomi', 'Senezhskaya', None, 'Svyatoy']
YM_MAP      = ['Narzan', 'Borjomi', None, 'Svyatoy']

# Table definitions: {metric: {mp: {start_row, brand_map, active_cols}, multiplier, decimals}}
TABLE_DEFS = {
    'skuCount': {
        'ozon': (10,  OZON_WB_MAP, OZON_COLS),
        'wb':   (16,  OZON_WB_MAP, WB_COLS),
        'ym':   (22,  YM_MAP,      YM_COLS),
        'mult': 1, 'dec': 0,
    },
    'skuShare': {
        'ozon': (41,  OZON_WB_MAP, OZON_COLS),
        'wb':   (47,  OZON_WB_MAP, WB_COLS),
        'ym':   (53,  YM_MAP,      YM_COLS),
        'mult': 100, 'dec': 6,
    },
    'revenue': {
        'ozon': (72,  OZON_WB_MAP, OZON_COLS),
        'wb':   (78,  OZON_WB_MAP, WB_COLS),
        'ym':   (84,  YM_MAP,      YM_COLS),
        'mult': 1 / 1_000_000, 'dec': 2,
    },
    'sales': {
        'ozon': (106, OZON_WB_MAP, OZON_COLS),
        'wb':   (112, OZON_WB_MAP, WB_COLS),
        'ym':   (118, YM_MAP,      YM_COLS),
        'mult': 1, 'dec': 0,
    },
    'salesShare': {
        'ozon': (137, OZON_WB_MAP, OZON_COLS),
        'wb':   (143, OZON_WB_MAP, WB_COLS),
        'ym':   (149, YM_MAP,      YM_COLS),
        'mult': 100, 'dec': 4,
    },
}


def extract_metric(rows, tdef):
    mult = tdef['mult']
    dec  = tdef['dec']

    # Per-marketplace: brand → {col_index: value}
    mp_raw = {}
    for mp in ('ozon', 'wb', 'ym'):
        start, brand_map, active_cols = tdef[mp]
        bdata = {}
        for offset, brand in enumerate(brand_map):
            if brand is None:
                continue
            row = rows[start + offset]
            for col in MONTH_COLS:
                if col not in active_cols:
                    continue
                v = row[col]
                if isinstance(v, (int, float)):
                    bdata.setdefault(brand, {})[col] = v
        mp_raw[mp] = bdata

    def build_series(mp_list):
        series = []
        for col, month in zip(MONTH_COLS, MONTHS):
            pt = {'month': month}
            for brand in BRANDS:
                vals = [mp_raw[mp].get(brand, {}).get(col) for mp in mp_list]
                vals = [v for v in vals if v is not None]
                if vals:
                    pt[brand] = round(sum(vals) * mult, dec)
                else:
                    pt[brand] = None
            series.append(pt)
        return series

    return {
        'ozon': build_series(['ozon']),
        'wb':   build_series(['wb']),
        'ym':   build_series(['ym']),
        'all':  build_series(['ozon', 'wb', 'ym']),
    }


def main():
    print("Reading Excel file...")
    wb_file = openpyxl.load_workbook(FILE, read_only=True, data_only=True)
    ws = wb_file.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    wb_file.close()
    print(f"  Sheet: '{ws.title}', {len(rows)} rows")

    charts = {key: extract_metric(rows, tdef) for key, tdef in TABLE_DEFS.items()}

    output = {
        'generated':  GENERATED,
        'brands':     BRANDS,
        'brandNames': BRAND_DISPLAY,
        'months':     MONTHS,
        'charts':     charts,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nWritten: {OUTPUT}")

    # Verification: print July (All) for each metric
    print("\nJuly (All) values per metric:")
    for key in TABLE_DEFS:
        series = charts[key]['all']
        jul = next((pt for pt in series if pt['month'] == 'Июл'), None)
        if jul:
            vals = '  '.join(f"{BRAND_DISPLAY[b]}={jul[b]}" for b in BRANDS)
            print(f"  {key:12s}  {vals}")


if __name__ == '__main__':
    main()
