"""
Converts creatives Excel monitoring report to creatives.json for the dashboard.

Usage:
    py scripts/process_creatives.py

Input:
    FILE — creatives monitoring Excel (sheet "Креативы", status column = "Активный")

Output:
    public/data/creatives.json
"""

import openpyxl
import json
from collections import defaultdict
from pathlib import Path

FILE   = r'C:\Users\ebone\.claude\New folder\Pulse\Files\creatives_Mineral water_28.05.2026.xlsx'
OUTPUT = Path(__file__).parent.parent / 'public' / 'data' / 'creatives.json'

BRAND_MAP = {
    'НАРЗАН':          'Narzan',
    'BORJOMI':         'Borjomi',
    'СЕНЕЖСКАЯ':       'Senezhskaya',
    'СВЯТОЙ ИСТОЧНИК': 'Svyatoy',
}

BRAND_DISPLAY = {
    'Narzan':      'Нарзан',
    'Borjomi':     'Боржоми',
    'Senezhskaya': 'Сенежская',
    'Svyatoy':     'Святой источник',
}

BRANDS = ['Narzan', 'Borjomi', 'Senezhskaya', 'Svyatoy']

MEDIA_MAP = {
    'Телевидение':                                   'tv',
    'Радио':                                         'radio',
    'Наружная реклама (оперативный мониторинг)':     'outdoor',
    'Интернет видео':                                'digital',
}

CHANNELS = ['tv', 'radio', 'outdoor', 'digital']

COMM_MAP = {
    'Имиджевая':   'image',
    'Промо':       'promo',
    'Продуктовая': 'product',
}

GENERATED = '2026-04'


def main():
    print("Reading Excel file...")
    wb = openpyxl.load_workbook(FILE, read_only=True, data_only=True)
    ws = list(wb.worksheets)[0]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    # brand -> channel -> comm_type -> count
    monitoring: dict = {
        b: {ch: {'image': 0, 'promo': 0, 'product': 0} for ch in CHANNELS}
        for b in BRANDS
    }

    # brand -> channel -> [сюжет texts]
    stories: dict = {b: {ch: [] for ch in CHANNELS} for b in BRANDS}

    for r in rows[1:]:
        if r[3] != 'Активный':
            continue

        brand_raw = str(r[9]) if r[9] else ''
        brand = next((BRAND_MAP[k] for k in BRAND_MAP if k in brand_raw), None)
        if not brand:
            continue

        channel = MEDIA_MAP.get(str(r[4]) if r[4] else '', None)
        if not channel:
            continue

        comm = COMM_MAP.get(str(r[19]) if r[19] else '', None)
        if comm:
            monitoring[brand][channel][comm] += 1

        plot = str(r[16]).strip() if r[16] else ''
        if plot and plot not in ('N/A', 'None', ''):
            stories[brand][channel].append(plot)

    monitoring_list = [
        {'brand': b, 'brandName': BRAND_DISPLAY[b], **monitoring[b]}
        for b in BRANDS
    ]

    output = {
        'generated':  GENERATED,
        'brands':     BRANDS,
        'brandNames': BRAND_DISPLAY,
        'monitoring': monitoring_list,
        'stories':    stories,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nWritten: {OUTPUT}")
    print(f"\nMonitoring summary ({GENERATED}):")
    ch_labels = {'tv': 'ТВ', 'radio': 'Радио', 'outdoor': 'OOH', 'digital': 'Digital'}
    header = f"  {'Бренд':22s}" + ''.join(f"  {ch_labels[c]:>12s}" for c in CHANNELS) + "  Всего"
    print(header)
    for row in monitoring_list:
        total = sum(row[c]['image'] + row[c]['promo'] + row[c]['product'] for c in CHANNELS)
        parts = ''.join(
            f"  i={row[c]['image']} p={row[c]['promo']} r={row[c]['product']:>2d}"
            for c in CHANNELS
        )
        print(f"  {row['brandName']:22s}{parts}  {total}")


if __name__ == '__main__':
    main()
