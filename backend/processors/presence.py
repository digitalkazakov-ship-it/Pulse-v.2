import openpyxl

BRANDS = ['Narzan', 'Borjomi', 'Senezhskaya', 'Svyatoy']
BRAND_DISPLAY = {
    'Narzan': 'Нарзан', 'Borjomi': 'Боржоми',
    'Senezhskaya': 'Сенежская', 'Svyatoy': 'Святой источник',
}
BRAND_COLS = {'Narzan': 3, 'Borjomi': 8, 'Senezhskaya': 6, 'Svyatoy': 5}
RETAILERS  = [('Перекресток',18),('Пятерочка',21),('Лента',24),('Красное и белое',27),('Дикси',30),('Магнит',33)]
DELIVERY   = [('Самокат',39),('Купер',None),('Лавка',43),('Озон фреш',46)]


def _read_point(rows, row_idx, name):
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


def process(file_path: str) -> dict:
    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    rows = list(wb.worksheets[0].iter_rows(values_only=True))
    wb.close()

    return {
        'brands':     BRANDS,
        'brandNames': BRAND_DISPLAY,
        'retail':     [_read_point(rows, r, name) for name, r in RETAILERS],
        'delivery':   [_read_point(rows, r, name) for name, r in DELIVERY],
    }
