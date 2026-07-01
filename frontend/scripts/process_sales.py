"""
Converts Sales Excel to sales.json for the Sales page.

Usage:
    py scripts/process_sales.py

Input:
    FILE — 'Питьевая вода' Excel, sheet 'Показатели'
    Columns (0-based):
      0:    Дата
      1-4:  Средняя цена, ₽         (Нарзан, Borjomi, Сенежская, Святой Источник)
      5-8:  Индекс продаж (уп.), k
      9-12: Доля бренда в категории (уп.), %
     13-16: Динамика продаж (шт.) год к году, %
     17-20: Дистрибуция, %

Output:
    public/data/sales.json  — 13 months: Apr 2025 – Apr 2026
"""

import openpyxl
import json
import datetime
from pathlib import Path

FILE   = r'C:\Users\ebone\.claude\New folder\Pulse\Files\Питьевая вода 01.01.2021-30.04.2026.xlsx'
OUTPUT = Path(__file__).parent.parent / 'public' / 'data' / 'sales.json'

BRAND_DISPLAY = {
    'Narzan':      'Нарзан',
    'Borjomi':     'Боржоми',
    'Senezhskaya': 'Сенежская',
    'Svyatoy':     'Святой источник',
}
BRANDS = ['Narzan', 'Borjomi', 'Senezhskaya', 'Svyatoy']

PRICE_COLS = [1, 2, 3, 4]
INDEX_COLS = [5, 6, 7, 8]
SHARE_COLS = [9, 10, 11, 12]
YOY_COLS   = [13, 14, 15, 16]
DISTR_COLS = [17, 18, 19, 20]

RU_MONTHS = {
    1: 'Янв', 2: 'Фев', 3: 'Мар', 4: 'Апр',
    5: 'Май', 6: 'Июн', 7: 'Июл', 8: 'Авг',
    9: 'Сен', 10: 'Окт', 11: 'Ноя', 12: 'Дек',
}

DATE_FROM = datetime.date(2025, 4, 1)
DATE_TO   = datetime.date(2026, 4, 30)
GENERATED = '2026-04'


def parse_date(v) -> datetime.date | None:
    if isinstance(v, datetime.datetime):
        return v.date()
    if isinstance(v, str):
        for fmt in ('%d.%m.%Y', '%Y-%m-%d'):
            try:
                return datetime.datetime.strptime(v.strip(), fmt).date()
            except ValueError:
                pass
    return None


def month_label(d: datetime.date) -> str:
    label = RU_MONTHS[d.month]
    if d.year != 2026:
        label += f" '{str(d.year)[2:]}"
    return label


def build_series(data_rows: list, col_indices: list, decimals: int = 4) -> list:
    result = []
    for d, row in data_rows:
        point: dict = {'month': month_label(d)}
        for i, brand in enumerate(BRANDS):
            val = row[col_indices[i]]
            point[brand] = round(float(val), decimals) if isinstance(val, (int, float)) else 0.0
        result.append(point)
    return result


def main():
    print("Reading Excel file...")
    wb = openpyxl.load_workbook(FILE, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    # rows[0] = metric headers, rows[1] = brand sub-headers, rows[2:] = data
    data_rows = []
    for r in rows[2:]:
        d = parse_date(r[0])
        if d is None:
            continue
        if DATE_FROM <= d <= DATE_TO:
            data_rows.append((d, r))
    data_rows.sort(key=lambda x: x[0])

    output = {
        'generated':   GENERATED,
        'brands':      BRANDS,
        'brandNames':  BRAND_DISPLAY,
        'salesIndex':  build_series(data_rows, INDEX_COLS, decimals=5),
        'salesYoY':    build_series(data_rows, YOY_COLS,   decimals=2),
        'marketShare': build_series(data_rows, SHARE_COLS, decimals=3),
        'price':       build_series(data_rows, PRICE_COLS, decimals=2),
        'distribution': build_series(data_rows, DISTR_COLS, decimals=2),
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nWritten: {OUTPUT}")
    print(f"\n{len(data_rows)} months: {data_rows[0][0]} — {data_rows[-1][0]}")

    print("\nSales Index (Индекс продаж):")
    for pt in output['salesIndex']:
        vals = '  '.join(f"{b}={pt[b]:.5f}" for b in BRANDS)
        print(f"  {pt['month']:10s}  {vals}")

    print("\nMarket Share % (Доля):")
    for pt in output['marketShare']:
        vals = '  '.join(f"{b}={pt[b]:.2f}" for b in BRANDS)
        print(f"  {pt['month']:10s}  {vals}")


if __name__ == '__main__':
    main()
