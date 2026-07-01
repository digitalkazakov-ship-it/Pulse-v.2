"""
Converts Flowchart Excel report to ad_spend.json for the Рекламные расходы chart.

Usage:
    py scripts/process_ad_spend.py

Input:
    FILE — flowchart Excel (sheet "Flowchart")
    Cost column: Prometheus Est. Cost (col 21)
    Date filter: weeks starting from 2025-12-01

Output:
    public/data/ad_spend.json
"""

import openpyxl
import json
import datetime
from collections import defaultdict
from pathlib import Path

FILE   = r'C:\Users\ebone\.claude\New folder\Pulse\Files\flowchart_Mineral water_28.05.2026.xlsx'
OUTPUT = Path(__file__).parent.parent / 'public' / 'data' / 'ad_spend.json'

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

DATE_FROM = datetime.datetime(2025, 12, 1)

RU_MONTHS = {
    '01': 'Янв', '02': 'Фев', '03': 'Мар', '04': 'Апр',
    '05': 'Май', '06': 'Июн', '07': 'Июл', '08': 'Авг',
    '09': 'Сен', '10': 'Окт', '11': 'Ноя', '12': 'Дек',
}


def month_label(ym: str) -> str:
    year, month = ym.split('-')
    label = RU_MONTHS[month]
    if year != '2026':
        label += f" '{year[2:]}"
    return label


def main():
    print("Reading Excel file...")
    wb = openpyxl.load_workbook(FILE, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    # brand -> ym -> channel -> sum of costs (RUB)
    spend: dict = {b: defaultdict(lambda: defaultdict(float)) for b in BRANDS}

    for r in rows[1:]:
        date = r[17]
        if not isinstance(date, datetime.datetime) or date < DATE_FROM:
            continue

        brand_raw = str(r[6]) if r[6] else ''
        brand = next((BRAND_MAP[k] for k in BRAND_MAP if k in brand_raw), None)
        if not brand:
            continue

        channel = MEDIA_MAP.get(str(r[3]) if r[3] else '', None)
        if not channel:
            continue

        cost = r[21] if isinstance(r[21], (int, float)) else 0.0
        ym = date.strftime('%Y-%m')
        spend[brand][ym][channel] += cost

    # Collect all months present in the data, sorted
    all_months = sorted({ym for b in BRANDS for ym in spend[b]})

    def build_series(channel: str | None) -> list:
        """Build chart data array. channel=None means total."""
        series = []
        for ym in all_months:
            point: dict = {'month': month_label(ym)}
            for b in BRANDS:
                if channel is None:
                    val = sum(spend[b][ym].get(c, 0) for c in CHANNELS)
                else:
                    val = spend[b][ym].get(channel, 0)
                point[b] = round(val / 1_000_000, 2)
            series.append(point)
        return series

    output = {
        'generated':  all_months[-1] if all_months else '',
        'brands':     BRANDS,
        'brandNames': BRAND_DISPLAY,
        'channels': {
            'total':   build_series(None),
            'tv':      build_series('tv'),
            'radio':   build_series('radio'),
            'outdoor': build_series('outdoor'),
            'digital': build_series('digital'),
        },
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nWritten: {OUTPUT}")
    print(f"\nMonths: {', '.join(all_months)}")
    print(f"\nTotal spend (млн руб):")
    header = f"  {'Месяц':10s}" + ''.join(f"  {b:12s}" for b in BRANDS)
    print(header)
    for point in output['channels']['total']:
        row_str = f"  {point['month']:10s}" + ''.join(f"  {point[b]:12.2f}" for b in BRANDS)
        print(row_str)


if __name__ == '__main__':
    main()
