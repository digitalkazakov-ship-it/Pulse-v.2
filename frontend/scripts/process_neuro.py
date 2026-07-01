"""
Converts neuro-answer Excel reports to neuro.json for the Brand Awareness page.

Usage:
    py scripts/process_neuro.py

Input files (sheet 'Weighted SOV', rows 1–4 = top-4 brands mapped positionally):
    FILE_GOOGLE — output_google [...].xlsx
    FILE_YANDEX — output_yandex [...].xlsx

Columns:
    0: Бренд (ignored — brands are mapped by position)
    1: Взвешенное присутствие  → Share of Impressions (computed as % of top-4 total)
    2: Weighted SOV (%)        → Share of Voice

Brand mapping (row index → brand key):
    row 1 → Narzan
    row 2 → Borjomi
    row 3 → Senezhskaya
    row 4 → Svyatoy

Output:
    public/data/neuro.json
"""

import openpyxl
import json
from pathlib import Path

FILE_GOOGLE = r'C:\Users\ebone\.claude\New folder\Pulse\Files\output_google [AJ4LsV].xlsx'
FILE_YANDEX = r'C:\Users\ebone\.claude\New folder\Pulse\Files\output_yandex [auLWHJ].xlsx'
OUTPUT      = Path(__file__).parent.parent / 'public' / 'data' / 'neuro.json'

BRANDS = ['Narzan', 'Borjomi', 'Senezhskaya', 'Svyatoy']
BRAND_DISPLAY = {
    'Narzan':      'Нарзан',
    'Borjomi':     'Боржоми',
    'Senezhskaya': 'Сенежская',
    'Svyatoy':     'Святой источник',
}


def read_engine(filepath: str) -> list:
    wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    # rows[0] = header, rows[1:5] = top-4 brands
    data_rows = rows[1:5]

    raw_presence = [r[1] for r in data_rows]
    sov_pct      = [r[2] for r in data_rows]

    total_presence = sum(v for v in raw_presence if isinstance(v, (int, float)))

    result = []
    for i, brand in enumerate(BRANDS):
        presence = raw_presence[i] if isinstance(raw_presence[i], (int, float)) else 0
        sov      = sov_pct[i]      if isinstance(sov_pct[i],      (int, float)) else 0
        soi      = round(presence / total_presence * 100, 2) if total_presence else 0
        result.append({
            'brand':      brand,
            'brandName':  BRAND_DISPLAY[brand],
            'impressions': soi,          # Share of Impressions, % of top-4 total
            'voice':       round(sov, 2), # Weighted SOV (%)
        })

    return result


def main():
    print("Reading Excel files...")
    google = read_engine(FILE_GOOGLE)
    yandex = read_engine(FILE_YANDEX)

    output = {'google': google, 'yandex': yandex}

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nWritten: {OUTPUT}")
    for engine, rows in output.items():
        print(f"\n{engine.upper()}:")
        print(f"  {'Бренд':20s}  {'SoI %':>7s}  {'SoV %':>7s}")
        for r in rows:
            print(f"  {r['brandName']:20s}  {r['impressions']:7.2f}  {r['voice']:7.2f}")


if __name__ == '__main__':
    main()
