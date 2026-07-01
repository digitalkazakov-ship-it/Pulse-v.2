"""
Converts Представленность.xlsx to presence.json for the Availability page.

Usage:
    py scripts/process_presence.py

Input:
    FILE — sheet "Шаг 8 - Продукт и ритейл"

Brands (col 0-based): Нарзан=3, Святой Источник=5, Сенежская=6, Боржоми=8
Skip: Рычал-Су(4), Аква Минерале(7)

Tables:
    Traditional retailers — % rows (0-based): Перекресток=18, Пятерочка=21, Лента=24,
                            Красное и белое=27, Дикси=30, Магнит=33
    Delivery services    — % rows: Самокат=39, Купер=None(empty), Лавка=43, Озон фреш=46

Values are stored as decimals (0.0234 = 2.34%). Output multiplied by 100 → %.

Output:
    public/data/presence.json
"""

import openpyxl
import json
from pathlib import Path

FILE   = r'C:\Users\ebone\.claude\New folder\Pulse\Files\E-com\Представленность.xlsx'
OUTPUT = Path(__file__).parent.parent / 'public' / 'data' / 'presence.json'

BRANDS = ['Narzan', 'Borjomi', 'Senezhskaya', 'Svyatoy']
BRAND_DISPLAY = {
    'Narzan':      'Нарзан',
    'Borjomi':     'Боржоми',
    'Senezhskaya': 'Сенежская',
    'Svyatoy':     'Святой источник',
}

BRAND_COLS = {'Narzan': 3, 'Borjomi': 8, 'Senezhskaya': 6, 'Svyatoy': 5}

RETAILERS = [
    ('Перекресток',     18),
    ('Пятерочка',       21),
    ('Лента',           24),
    ('Красное и белое', 27),
    ('Дикси',           30),
    ('Магнит',          33),
]

DELIVERY = [
    ('Самокат',    39),
    ('Купер',      None),
    ('Лавка',      43),
    ('Озон фреш',  46),
]


def read_point(rows, row_idx, name):
    pt = {'retailer': name}
    if row_idx is None or row_idx >= len(rows):
        for b in BRANDS:
            pt[b] = 0.0
        return pt
    row = rows[row_idx]
    for brand, col in BRAND_COLS.items():
        v = row[col]
        pt[brand] = round(float(v) * 100, 2) if isinstance(v, (int, float)) else 0.0
    return pt


def main():
    print("Reading Excel file...")
    wb = openpyxl.load_workbook(FILE, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    print(f"  Sheet: '{ws.title}', {len(rows)} rows")

    retail   = [read_point(rows, r, name) for name, r in RETAILERS]
    delivery = [read_point(rows, r, name) for name, r in DELIVERY]

    output = {
        'brands':     BRANDS,
        'brandNames': BRAND_DISPLAY,
        'retail':     retail,
        'delivery':   delivery,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nWritten: {OUTPUT}")

    print("\nТрадиционные ритейлеры:")
    for pt in retail:
        vals = '  '.join(f"{BRAND_DISPLAY[b]}={pt[b]:.2f}%" for b in BRANDS)
        print(f"  {pt['retailer']:20s}  {vals}")

    print("\nСервисы доставки:")
    for pt in delivery:
        vals = '  '.join(f"{BRAND_DISPLAY[b]}={pt[b]:.2f}%" for b in BRANDS)
        print(f"  {pt['retailer']:20s}  {vals}")


if __name__ == '__main__':
    main()
