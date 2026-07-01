"""
Wordstat processor — single .xlsx with one sheet per brand.
Sheet name = brand display name. Columns: A = date, B = search volume.
"""
import re
import datetime
import openpyxl

RU_MONTHS = {1:'Янв',2:'Фев',3:'Мар',4:'Апр',5:'Май',6:'Июн',
             7:'Июл',8:'Авг',9:'Сен',10:'Окт',11:'Ноя',12:'Дек'}


def _month_label(d: datetime.date) -> str:
    label = RU_MONTHS[d.month]
    if d.year != datetime.date.today().year:
        label += f" '{str(d.year)[2:]}"
    return label


def _brand_key(name: str) -> str:
    return re.sub(r'[^\w]', '', name, flags=re.UNICODE)


def _read_sheet(ws) -> dict:
    result = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        raw_date, raw_val = row[0], row[1]
        if not isinstance(raw_date, (datetime.datetime, datetime.date)):
            continue
        d = raw_date.date() if isinstance(raw_date, datetime.datetime) else raw_date
        if isinstance(raw_val, (int, float)):
            result[d] = int(raw_val)
    return result


def process(file_path: str) -> dict:
    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)

    brands: list = []
    brand_display: dict = {}
    brand_data: dict = {}

    for ws in wb.worksheets:
        name = ws.title.strip()
        bk = _brand_key(name)
        if bk and bk not in brand_data:
            brands.append(bk)
            brand_display[bk] = name
            brand_data[bk] = _read_sheet(ws)

    wb.close()

    all_dates = sorted(set().union(*[d.keys() for d in brand_data.values()]))

    series = []
    for d in all_dates:
        point: dict = {'month': _month_label(d)}
        for bk in brands:
            point[bk] = brand_data[bk].get(d, 0)
        series.append(point)

    return {'brands': brands, 'brandNames': brand_display, 'series': series}
