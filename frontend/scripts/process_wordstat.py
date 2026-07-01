"""
Converts Wordstat Excel reports to wordstat.json for the Brand Awareness page.

Usage:
    py scripts/process_wordstat.py

Input files (one per brand, col 0 = Период, col 1 = Число запросов):
    FILE_NARZAN      — wordstat_dynamic нарзан.xlsx
    FILE_BORJOMI     — wordstat_dynamic боржоми.xlsx
    FILE_SENEZHSKAYA — wordstat_dynamic сенежская.xlsx
    FILE_SVYATOY     — wordstat_dynamic свято.xlsx

Period: April 2024 – April 2025 (DATE_FROM / DATE_TO).

Output:
    public/data/wordstat.json  — array of {month, Narzan, Borjomi, Senezhskaya, Svyatoy}
"""

import openpyxl
import json
import datetime
from pathlib import Path

DIR = r'C:\Users\ebone\.claude\New folder\Pulse\Files\Wordstat'

FILE_NARZAN      = DIR + r'\wordstat_dynamic нарзан.xlsx'
FILE_BORJOMI     = DIR + r'\wordstat_dynamic боржоми.xlsx'
FILE_SENEZHSKAYA = DIR + r'\wordstat_dynamic сенежская.xlsx'
FILE_SVYATOY     = DIR + r'\wordstat_dynamic свято.xlsx'

OUTPUT = Path(__file__).parent.parent / 'public' / 'data' / 'wordstat.json'

BRANDS = ['Narzan', 'Borjomi', 'Senezhskaya', 'Svyatoy']
FILES  = [FILE_NARZAN, FILE_BORJOMI, FILE_SENEZHSKAYA, FILE_SVYATOY]

DATE_FROM = datetime.date(2024, 4, 1)
DATE_TO   = datetime.date(2025, 4, 30)

RU_MONTHS = {
    1: 'Янв', 2: 'Фев', 3: 'Мар', 4: 'Апр',
    5: 'Май', 6: 'Июн', 7: 'Июл', 8: 'Авг',
    9: 'Сен', 10: 'Окт', 11: 'Ноя', 12: 'Дек',
}


def month_label(d: datetime.date) -> str:
    label = RU_MONTHS[d.month]
    if d.year != 2025:
        label += f" '{str(d.year)[2:]}"
    return label


def read_brand(filepath: str) -> dict[datetime.date, int]:
    wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    result = {}
    for row in rows[1:]:
        raw_date = row[0]
        raw_val  = row[1]
        if not isinstance(raw_date, (datetime.datetime, datetime.date)):
            continue
        d = raw_date.date() if isinstance(raw_date, datetime.datetime) else raw_date
        if DATE_FROM <= d <= DATE_TO and isinstance(raw_val, (int, float)):
            result[d] = int(raw_val)
    return result


def main():
    print("Reading Wordstat files...")
    brand_data: list[dict[datetime.date, int]] = [read_brand(f) for f in FILES]

    # collect sorted dates present in all files
    all_dates = sorted(set(brand_data[0].keys()))

    rows = []
    for d in all_dates:
        point: dict = {'month': month_label(d)}
        for i, brand in enumerate(BRANDS):
            point[brand] = brand_data[i].get(d, 0)
        rows.append(point)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    print(f"\nWritten: {OUTPUT}")
    print(f"\n{len(rows)} months: {all_dates[0]} — {all_dates[-1]}")
    print(f"\n{'Месяц':10s}  " + "  ".join(f"{b:>12s}" for b in BRANDS))
    for pt in rows:
        print(f"  {pt['month']:10s}  " + "  ".join(f"{pt[b]:>12,}" for b in BRANDS))


if __name__ == '__main__':
    main()
