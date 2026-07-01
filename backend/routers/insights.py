import os
import re
import json
from openai import OpenAI
from fastapi import APIRouter, Depends, HTTPException
from ..llm_client import get_llm_client
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Project, Snapshot

router = APIRouter()

QUESTIONS = {
    "B1.1": "Медиабюджеты категории — используй данные из раздела «Медиаинвестиции: суммарные бюджеты и доли (предрасчёт)». Оформи ответ в виде таблицы: строки — бренды, колонки — периоды (каждый год отдельно + последние 4 квартала). Для каждого периода: сумма в млн руб, доля в категории %, YoY-рост %. Данные за 2026 год помечай как неполный период. Затем в разделе «Интерпретация»: сопоставь долю бренда в медиабюджете с его долей рынка из данных «Продажи» — у кого медиаинвестиции явно не соответствуют доле рынка (переинвестирован или недоинвестирован) и что это означает стратегически?",
    "B1.3": "Структура бюджета по каналам (ТВ, digital, OOH, радио) — используй раздел «Медиаинвестиции: структура каналов (предрасчёт)», который содержит данные по каждому году отдельно (2024, 2025, 2026). Покажи таблицей: строки — бренды, колонки — каналы, данные за 2025 год как основной период (и 2026 если есть изменения). Обязательно выдели бренды с резкими изменениями между 2024→2025→2026 (например, полный уход с ТВ). В «Интерпретации»: кто делает ставку на какой канал, почему — что это говорит об их стратегии и целевой аудитории?",
    "B1.4": "Перераспределение бюджета между каналами — используй ОБА источника: (1) «Медиадетали» → «Канальный микс по периодам (Media Mix)» для периодов янв-июл 2024 vs янв-июл 2025; (2) «Медиаинвестиции: структура каналов (предрасчёт)» → раздел «Сравнение каналов» для самого свежего сопоставимого периода. Оформи таблицей: строки — бренды, колонки — ТВ, digital, OOH, радио — для каждого канала показывай долю % в период 1 → долю % в период 2 и изменение в пп. Обязательно выдели бренды с самым резким сдвигом (например, полный уход с ТВ или наоборот). В «Интерпретации»: что стоит за этими изменениями стратегически?",
    "B2.1": "ТВ-стратегия и спонсорство: для каждого бренда — burst или always-on (кол-во активных недель), есть ли ТВ-спонсорство (и на каких каналах). Объясни логику каждого подхода с учётом специфики канала (Пятница, Домашний, Первый и т.д.) — какую аудиторию он даёт и какую задачу закрывает. Сопоставь ТВ-активность с динамикой TOM из BHT: у кого прослеживается связь между активными флайтами и ростом знания, у кого знание держится на спонсорстве в паузах?",
    "B2.4": "Одинаковый ли ТВ-сплит у разных брендов? Если да — в чём риск для тех, кто не выделяется? Если нет — кто отличается и почему это может быть преимуществом?",
    "B3.1": "TOM (первое упоминание) по брендам — покажи таблицей по последним 4 кварталам из BHT. Затем отдельной таблицей покажи долю рынка (%) из раздела «Продажи: рыночные показатели (предрасчёт)» → поле «Доля рынка (%)» — тоже по кварталам (не YoY-динамику, а саму долю в %). В «Интерпретации»: сопоставь уровень TOM с уровнем доли рынка по каждому бренду — у кого высокий TOM конвертируется в долю рынка, у кого нет и почему (коммуникационная эффективность без конверсии или дистрибуционный/ценовой драйвер)?",
    "B3.2": "Частота потребления по брендам — используй раздел «BHT: сводка метрик» → «Частота потребления». Покажи таблицей два квартала (текущий и предыдущий): строки — бренды, колонки — total % потребителей и разбивка по частоте (ежедневно, несколько раз в неделю и т.д.). Отметь, у кого частота выросла или упала между кварталами. В «Интерпретации»: у кого наиболее лояльная база (высокая частота)? Сопоставь с медиаинвестициями — коррелирует ли высокая частота с большим бюджетом или есть бренды с высокой лояльностью при скромных инвестициях?",
    "B3.3": "Пенетрация по возрастным группам: где профиль клиентского бренда сильнее всего и где слабее конкурентов? (используй поле penetration в BHT). У кого из конкурентов более широкий охват аудитории?",
    "B3.5": "Падает ли знание клиентского бренда в паузах флайтов? Используй раздел «Анализ знания в паузах флайтов (предрасчёт)» — там для каждого бренда указаны кварталы с флайтами и кварталы-паузы, и значения TOM/aided в каждом. Покажи таблицей: Бренд | Квартал | Флайт/Пауза | TOM (%) | Aided (%). Затем: у кого сильнее падение в паузах (delta пп), у кого знание устойчиво и за счёт чего (always-on, спонсорство, другие каналы)?",
    "B4.1": "Текущее позиционирование каждого бренда: в чём суть сообщения? Насколько сообщения конкурентов отличаются от клиентского бренда — есть ли реальная дифференциация или все говорят об одном?",
    "B4.2": "Последние кампании каждого бренда: идея, доминирующий канал, масштаб по числу креативов. Сравни клиентский бренд с лидером по активности — в чём разрыв и что конкурент делает иначе?",
    "B4.3": "Коллаборации, инфлюенсеры, спонсорство: кто из брендов активно использует эти инструменты и с какой целью? Есть ли у клиентского бренда пробел по сравнению с конкурентами?",
    "B4.4": "Что конкуренты делают принципиально иначе в коммуникациях? Сравни тип коммуникации (image/promo/product %) и доминирующий канал клиентского бренда с конкурентами. Где разрыв наиболее значим и что за этим стоит стратегически?",
    "B5.1": "Кто лидирует по онлайн-выручке (среднее за 6 мес., предрасчёт ecom)? Посмотри на динамику по кварталам за последние 4 квартала: у кого выручка растёт, у кого стагнирует или падает? Сопоставь с данными BHT (TOM, потребление): у кого высокий TOM конвертируется в онлайн-выручку, а у кого высокое знание не транслируется в еком-продажи — что это говорит о барьерах?",
    "B5.2": "Доля продаж (salesShare %) каждого бренда по доступным маркетплейсам — среднее и динамика по кварталам (последние 4 квартала). У кого доля растёт, у кого падает? Сопоставь с данными BHT (aided awareness, consumption): коррелирует ли знание бренда с его долей на платформе? Где отставание клиентского бренда от конкурентов критичнее всего и что может быть причиной (ассортимент, промо, цена)?",
    "B5.3": "Сравни позиции брендов по разным маркетплейсам: есть ли бренды, которые явно сильнее на одной платформе? С чем это может быть связано — ассортимент, цена, промо-активность?",
    "B5.4": "Представленность в рознице и доставке: сравни клиентский бренд с конкурентами. У кого шире покрытие и где клиентский бренд проигрывает — это дистрибуционная проблема или следствие чего-то другого?",
}


# ── Data loading ───────────────────────────────────────────────────────────────

def _get_data(project_id: int, data_type: str, db: Session) -> dict | None:
    snap = (
        db.query(Snapshot)
        .filter_by(project_id=project_id, data_type=data_type)
        .order_by(Snapshot.uploaded_at.desc())
        .first()
    )
    return json.loads(snap.payload) if snap else None


_TRIM_SERIES_KEYS = {
    "salesIndex", "salesYoY", "marketShare", "price", "distribution",
}
_MAX_SECTION_CHARS = 10_000
_SUMMARIZE_UP_TO   = 2021   # years ≤ this → annual averages
_RECENT_MONTHS     = 36     # keep this many recent monthly points


def _year_from_label(month: str) -> int:
    m = re.search(r"'(\d{2})$", str(month))
    return (2000 + int(m.group(1))) if m else 0


_RU_MONTH_NUM = {'янв':1,'фев':2,'мар':3,'апр':4,'май':5,'июн':6,
                 'июл':7,'авг':8,'сен':9,'окт':10,'ноя':11,'дек':12}
_MONTH_NUM_NAME = {v: k for k, v in _RU_MONTH_NUM.items()}


def _month_from_label(label: str) -> int:
    lo = str(label).lower()
    for ru, num in _RU_MONTH_NUM.items():
        if lo.startswith(ru):
            return num
    return 0


def _compact_series(series: list, brands: list) -> dict:
    """Return {historySummary: {year: {brand: avg}}, monthly: [last N months]}."""
    by_year: dict[int, dict[str, list]] = {}
    recent: list = []

    for pt in series:
        yr = _year_from_label(pt.get("month", ""))
        if 0 < yr <= _SUMMARIZE_UP_TO:
            by_year.setdefault(yr, {b: [] for b in brands})
            for b in brands:
                v = pt.get(b)
                if isinstance(v, (int, float)):
                    by_year[yr][b].append(v)
        else:
            recent.append(pt)

    history = {
        str(yr): {b: round(sum(vs) / len(vs), 2) for b, vs in brand_vals.items() if vs}
        for yr, brand_vals in sorted(by_year.items())
    }
    return {"historySummary": history, "monthly": recent[-_RECENT_MONTHS:]}


def _trim_data(data: dict) -> dict:
    brands = data.get("brands", [])
    out = {}
    for k, v in data.items():
        if k in _TRIM_SERIES_KEYS and isinstance(v, list):
            out[k] = _compact_series(v, brands)
        elif k == "channels" and isinstance(v, dict):
            out[k] = {ch: _compact_series(pts, brands) for ch, pts in v.items()}
        elif k == "charts" and isinstance(v, dict):
            out[k] = {
                mp: {ch: _compact_series(pts, brands) for ch, pts in series.items()}
                for mp, series in v.items()
            }
        else:
            out[k] = v
    return out


def _brand_spend_summary(ad_data: dict) -> str:
    """Pre-compute total spend + YoY dynamics + quarterly breakdown per brand."""
    brands = ad_data.get("brands", [])
    brand_names = ad_data.get("brandNames", {})
    total_series = ad_data.get("channels", {}).get("total", [])
    if isinstance(total_series, dict):
        total_series = total_series.get("monthly", [])
    if not brands or not total_series:
        return ""

    by_year: dict[str, dict[str, float]] = {}
    by_quarter: dict[str, dict[str, float]] = {}
    months_per_year: dict[str, set] = {}

    for pt in total_series:
        label = pt.get("month", "")
        yr = _year_from_label(label)
        mo = _month_from_label(label)
        if yr == 0:
            continue
        yr_str = str(yr)
        months_per_year.setdefault(yr_str, set()).add(mo)
        q = (mo - 1) // 3 + 1 if mo else 0
        q_str = f"Q{q} {yr}" if q else None
        by_year.setdefault(yr_str, {})
        for b in brands:
            v = pt.get(b, 0)
            if isinstance(v, (int, float)) and v:
                by_year[yr_str][b] = by_year[yr_str].get(b, 0) + v
                if q_str:
                    by_quarter.setdefault(q_str, {})
                    by_quarter[q_str][b] = by_quarter[q_str].get(b, 0) + v

    lines = ["Суммарные медиаинвестиции по брендам (млн руб) и доля в категории (%):"]
    sorted_years = sorted(by_year.keys())

    for yr_str in sorted_years:
        brand_totals = by_year[yr_str]
        cat_total = sum(brand_totals.values())
        if cat_total == 0:
            continue
        n_months = len(months_per_year.get(yr_str, set()))
        max_mo = max(months_per_year.get(yr_str, {0}))
        if n_months < 12:
            period_label = f"янв–{_MONTH_NUM_NAME.get(max_mo, '?')} {yr_str}"
            partial_note = f" ⚠️ данные только за {n_months} мес."
        else:
            period_label = f"весь {yr_str}"
            partial_note = ""

        ranked = sorted(brand_totals.items(), key=lambda x: x[1], reverse=True)
        lines.append(f"\n  [{period_label}{partial_note}], итого по категории: {cat_total:.1f} млн руб")
        prior_yr = str(int(yr_str) - 1)

        for b, tot in ranked:
            if tot == 0:
                continue
            share = round(tot / cat_total * 100, 1)
            name = brand_names.get(b, b)

            # YoY vs same months in prior year
            yoy_str = ""
            if prior_yr in by_year:
                if n_months < 12:
                    # Sum same months from prior year
                    cur_months = months_per_year.get(yr_str, set())
                    prior_same = sum(
                        pt.get(b, 0) for pt in total_series
                        if _year_from_label(pt.get("month", "")) == int(prior_yr)
                        and _month_from_label(pt.get("month", "")) in cur_months
                        and isinstance(pt.get(b, 0), (int, float))
                    )
                    if prior_same > 0:
                        g = round((tot - prior_same) / prior_same * 100, 1)
                        yoy_str = f"  [{'+' if g>=0 else ''}{g}% vs янв–{_MONTH_NUM_NAME.get(max_mo,'?')} {prior_yr}]"
                else:
                    prior_tot = by_year[prior_yr].get(b, 0)
                    if prior_tot > 0:
                        g = round((tot - prior_tot) / prior_tot * 100, 1)
                        yoy_str = f"  [{'+' if g>=0 else ''}{g}% YoY vs {prior_yr}]"
            lines.append(f"    {name}: {tot:.1f} млн руб ({share}%){yoy_str}")

    # Last 4 quarters
    q_order = sorted(by_quarter.keys(), key=lambda q: (int(q.split()[1]), int(q[1])))
    last_4q = q_order[-4:]
    if last_4q:
        lines.append("\nПоследние 4 квартала (млн руб, все бренды):")
        for q_str in last_4q:
            q_data = by_quarter[q_str]
            cat_q = sum(q_data.values())
            ranked_q = sorted(q_data.items(), key=lambda x: x[1], reverse=True)
            parts = [f"{brand_names.get(b,b)}={v:.1f}" for b, v in ranked_q if v > 0]
            lines.append(f"  {q_str} (итого {cat_q:.1f} млн): {' | '.join(parts)}")

    return "\n".join(lines)


def _channel_mix_summary(ad_data: dict) -> str:
    """Pre-compute channel share % per brand/year + comparable period YoY delta."""
    brands = ad_data.get("brands", [])
    brand_names = ad_data.get("brandNames", {})
    channels_data = ad_data.get("channels", {})
    if not brands or not channels_data:
        return ""

    non_total_chs = [ch for ch in channels_data if ch != "total"]

    # Accumulate by year and by (year, month)
    by_year: dict[str, dict[str, dict[str, float]]] = {}
    by_ym: dict[tuple, dict[str, dict[str, float]]] = {}

    for ch in non_total_chs:
        pts = channels_data[ch]
        for pt in (pts.get("monthly", pts) if isinstance(pts, dict) else pts):
            yr = _year_from_label(pt.get("month", ""))
            mo = _month_from_label(pt.get("month", ""))
            if yr == 0:
                continue
            yr_str = str(yr)
            by_year.setdefault(yr_str, {}).setdefault(ch, {})
            if mo:
                key = (yr, mo)
                by_ym.setdefault(key, {}).setdefault(ch, {})
            for b in brands:
                v = pt.get(b, 0)
                if isinstance(v, (int, float)) and v:
                    by_year[yr_str][ch][b] = by_year[yr_str][ch].get(b, 0) + v
                    if mo:
                        by_ym[key][ch][b] = by_ym[key][ch].get(b, 0) + v

    # Annual breakdown
    lines = ["Структура бюджета по каналам (% от суммарных инвестиций бренда):"]
    for yr in sorted(by_year):
        brand_total: dict[str, float] = {}
        for ch_vals in by_year[yr].values():
            for b, v in ch_vals.items():
                brand_total[b] = brand_total.get(b, 0) + v
        lines.append(f"  {yr}:")
        for b in brands:
            tot = brand_total.get(b, 0)
            if tot == 0:
                continue
            ch_shares = {ch: round(by_year[yr].get(ch, {}).get(b, 0) / tot * 100, 1)
                         for ch in sorted(by_year[yr])}
            s = ", ".join(f"{ch}={pct}%" for ch, pct in ch_shares.items() if pct > 0)
            lines.append(f"    {brand_names.get(b, b)}: {s} (итого {tot:.1f} млн руб)")

    # Comparable period: latest year months vs same months prior year
    all_ym = sorted(by_ym.keys())
    if all_ym:
        latest_yr = all_ym[-1][0]
        latest_months = sorted(mo for yr, mo in all_ym if yr == latest_yr)
        prior_yr = latest_yr - 1
        prior_months = {mo for yr, mo in all_ym if yr == prior_yr}
        comparable_months = [mo for mo in latest_months if mo in prior_months]

        if comparable_months:
            max_mo = max(comparable_months)
            min_mo = min(comparable_months)
            p_label = f"янв–{_MONTH_NUM_NAME.get(max_mo, '?')}" if min_mo == 1 else f"{_MONTH_NUM_NAME.get(min_mo,'?')}–{_MONTH_NUM_NAME.get(max_mo,'?')}"
            lines.append(f"\nСравнение каналов: {p_label} {prior_yr} vs {p_label} {latest_yr} (→ изменение доли в пп):")

            def _period_totals(yr_int: int) -> dict[str, dict[str, float]]:
                ch_brand: dict[str, dict[str, float]] = {ch: {} for ch in non_total_chs}
                for mo in comparable_months:
                    ym_data = by_ym.get((yr_int, mo), {})
                    for ch in non_total_chs:
                        for b, v in ym_data.get(ch, {}).items():
                            ch_brand[ch][b] = ch_brand[ch].get(b, 0) + v
                return ch_brand

            cur_data = _period_totals(latest_yr)
            prev_data = _period_totals(prior_yr)

            for b in brands:
                cur_tot = sum(cur_data[ch].get(b, 0) for ch in non_total_chs)
                prev_tot = sum(prev_data[ch].get(b, 0) for ch in non_total_chs)
                if cur_tot == 0 and prev_tot == 0:
                    continue
                parts = []
                for ch in sorted(non_total_chs):
                    cp = round(cur_data[ch].get(b, 0) / cur_tot * 100, 1) if cur_tot else 0
                    pp = round(prev_data[ch].get(b, 0) / prev_tot * 100, 1) if prev_tot else 0
                    d = round(cp - pp, 1)
                    if cp > 0 or pp > 0:
                        parts.append(f"{ch}: {pp}%→{cp}% ({'+' if d>=0 else ''}{d}пп)")
                bud_str = ""
                if prev_tot > 0:
                    bg = round((cur_tot - prev_tot) / prev_tot * 100, 1)
                    bud_str = f"  [бюджет {prev_tot:.1f}→{cur_tot:.1f} млн, {'+' if bg>=0 else ''}{bg}%]"
                if parts:
                    lines.append(f"  {brand_names.get(b, b)}: {' | '.join(parts)}{bud_str}")

    return "\n".join(lines)


def _creatives_summary(cr_data: dict) -> str:
    """Pre-compute creative counts, comm-type %, dominant channel per brand."""
    monitoring = cr_data.get("monitoring", [])
    brand_names = cr_data.get("brandNames", {})
    channels = ["tv", "radio", "outdoor", "digital"]
    comm_types = ["image", "promo", "product"]

    rows = []
    for m in monitoring:
        bk = m["brand"]
        name = brand_names.get(bk, bk)
        total_by_ch = {ch: sum(m.get(ch, {}).get(ct, 0) for ct in comm_types) for ch in channels}
        total = sum(total_by_ch.values())
        if total == 0:
            continue
        dominant_ch = max(total_by_ch, key=total_by_ch.get)
        comm_totals = {ct: sum(m.get(ch, {}).get(ct, 0) for ch in channels) for ct in comm_types}
        comm_pct = {ct: round(comm_totals[ct] / total * 100) for ct in comm_types}
        rows.append((total, name, dominant_ch, total_by_ch[dominant_ch], comm_pct))

    rows.sort(reverse=True)
    lines = ["Рейтинг брендов по объёму креативов (всего / тип коммуникации % / доминирующий канал):"]
    for rank, (total, name, dom_ch, dom_cnt, pct) in enumerate(rows, 1):
        comm_str = f"image={pct['image']}%, promo={pct['promo']}%, product={pct['product']}%"
        lines.append(f"  {rank}. {name}: {total} крат. | {comm_str} | домин. канал: {dom_ch} ({dom_cnt})")
    return "\n".join(lines)


def _sales_summary(sales_data: dict) -> str:
    """Pre-compute market share and YoY dynamics per brand, aggregated by quarter."""
    brands = sales_data.get("brands", [])
    brand_names = sales_data.get("brandNames", {})
    if not brands:
        return ""

    # Skip category-total row (marketShare ≈ 100%)
    ms_series = sales_data.get("marketShare", [])
    skip_brands: set[str] = set()
    if ms_series:
        last_pt = ms_series[-1]
        for b in brands:
            v = last_pt.get(b, 0)
            if isinstance(v, (int, float)) and v > 90:
                skip_brands.add(b)
    real_brands = [b for b in brands if b not in skip_brands]
    if not real_brands:
        return ""

    def _ql(label: str) -> str | None:
        yr = _year_from_label(label)
        mo = _month_from_label(label)
        if yr == 0 or mo == 0:
            return None
        return f"Q{(mo - 1) // 3 + 1} {yr}"

    def _to_quarters(series: list) -> tuple[list[str], dict[str, dict[str, float]]]:
        q_data: dict[str, dict[str, list]] = {}
        q_order: list[str] = []
        for pt in series:
            ql = _ql(pt.get("month", ""))
            if not ql:
                continue
            if ql not in q_data:
                q_data[ql] = {b: [] for b in real_brands}
                q_order.append(ql)
            for b in real_brands:
                v = pt.get(b)
                if isinstance(v, (int, float)):
                    q_data[ql][b].append(v)
        avgs = {ql: {b: round(sum(vals) / len(vals), 2)
                     for b in real_brands if (vals := q_data[ql].get(b, []))}
                for ql in q_order}
        return q_order, avgs

    def _ranked(vals: dict) -> str:
        return "  >  ".join(f"{brand_names.get(b, b)}={v}%" for b, v in
                            sorted(vals.items(), key=lambda x: x[1], reverse=True))

    lines = ["Рыночные показатели по брендам (квартальные средние):"]

    # Market share — last 4 quarters + QoQ delta
    q_order, ms_avgs = _to_quarters(ms_series)
    last_4q = q_order[-4:]
    if last_4q:
        lines.append("\nДоля рынка (%):")
        for ql in last_4q:
            vals = ms_avgs.get(ql, {})
            if vals:
                lines.append(f"  {ql}: {_ranked(vals)}")
        if len(last_4q) >= 2:
            q_cur, q_prev = last_4q[-1], last_4q[-2]
            cur, prev = ms_avgs.get(q_cur, {}), ms_avgs.get(q_prev, {})
            deltas = []
            for b in real_brands:
                if b in cur and b in prev:
                    d = round(cur[b] - prev[b], 2)
                    deltas.append(f"{brand_names.get(b, b)} {'+' if d >= 0 else ''}{d}пп")
            if deltas:
                lines.append(f"  Изменение {q_prev}→{q_cur}: {', '.join(deltas)}")

    # Sales YoY — last 4 quarters
    yoy_series = sales_data.get("salesYoY", [])
    if yoy_series:
        q_order_y, yoy_avgs = _to_quarters(yoy_series)
        last_4q_y = q_order_y[-4:]
        if last_4q_y:
            lines.append("\nДинамика продаж YoY (%):")
            for ql in last_4q_y:
                vals = yoy_avgs.get(ql, {})
                if not vals:
                    continue
                parts = [f"{brand_names.get(b, b)} {'+' if v >= 0 else ''}{v}%"
                         for b, v in sorted(vals.items(), key=lambda x: x[1], reverse=True)]
                lines.append(f"  {ql}: {' | '.join(parts)}")

    # Distribution — latest quarter only
    dist_series = sales_data.get("distribution", [])
    if dist_series:
        q_order_d, dist_avgs = _to_quarters(dist_series)
        if q_order_d:
            ql_latest = q_order_d[-1]
            vals = dist_avgs.get(ql_latest, {})
            if vals:
                lines.append(f"\nДистрибуция ({ql_latest}): {_ranked(vals)}")

    return "\n".join(lines) if len(lines) > 1 else ""


def _ecom_summary(ec_data: dict, months_back: int = 6) -> str:
    """Pre-compute 6-month averages + quarterly dynamics per marketplace for key ecom metrics."""
    brands = ec_data.get("brands", [])
    brand_names = ec_data.get("brandNames", {})
    marketplaces = ec_data.get("marketplaces", [])
    charts = ec_data.get("charts", {})
    if not brands or not marketplaces or not charts:
        return ""

    def _quarter_label(label: str) -> str | None:
        yr = _year_from_label(label)
        mo = _month_from_label(label)
        if yr == 0 or mo == 0:
            return None
        q = (mo - 1) // 3 + 1
        return f"Q{q} {yr}"

    metrics = {"revenue": "выручка", "salesShare": "доля продаж %", "skuShare": "доля SKU %"}
    lines = [f"Среднее за последние {months_back} месяцев по маркетплейсам:"]

    for mp in marketplaces:
        lines.append(f"\n  [{mp.upper()}]")
        for metric_key, metric_label in metrics.items():
            series = charts.get(metric_key, {}).get(mp, [])
            if not series:
                continue
            recent = series[-months_back:]
            avgs: dict[str, float] = {}
            for b in brands:
                vals = [pt[b] for pt in recent if isinstance(pt.get(b), (int, float))]
                if vals:
                    avgs[b] = round(sum(vals) / len(vals), 2)
            if not avgs:
                continue
            ranked = sorted(avgs.items(), key=lambda x: x[1], reverse=True)
            parts = [f"{brand_names.get(b, b)}={v}" for b, v in ranked]
            lines.append(f"    {metric_label}: {' > '.join(parts)}")

        # Quarterly dynamics: last 4 quarters for revenue and salesShare
        lines.append(f"  Квартальная динамика [{mp.upper()}]:")
        for metric_key, metric_label in [("revenue", "выручка"), ("salesShare", "доля продаж %")]:
            series = charts.get(metric_key, {}).get(mp, [])
            if not series:
                continue
            # Group by quarter
            q_data: dict[str, dict[str, list]] = {}
            q_order: list[str] = []
            for pt in series:
                ql = _quarter_label(pt.get("month", ""))
                if not ql:
                    continue
                if ql not in q_data:
                    q_data[ql] = {b: [] for b in brands}
                    q_order.append(ql)
                for b in brands:
                    v = pt.get(b)
                    if isinstance(v, (int, float)):
                        q_data[ql][b].append(v)
            last_4q = q_order[-4:]
            if not last_4q:
                continue
            lines.append(f"    {metric_label}:")
            for ql in last_4q:
                avgs_q = {b: round(sum(q_data[ql][b]) / len(q_data[ql][b]), 2)
                          for b in brands if q_data[ql].get(b)}
                if not avgs_q:
                    continue
                ranked_q = sorted(avgs_q.items(), key=lambda x: x[1], reverse=True)
                parts_q = [f"{brand_names.get(b, b)}={v}" for b, v in ranked_q]
                lines.append(f"      {ql}: {' > '.join(parts_q)}")
            # QoQ delta for latest quarter
            if len(last_4q) >= 2:
                ql_cur, ql_prev = last_4q[-1], last_4q[-2]
                cur_q = {b: round(sum(q_data[ql_cur][b]) / len(q_data[ql_cur][b]), 2)
                         for b in brands if q_data[ql_cur].get(b)}
                prev_q = {b: round(sum(q_data[ql_prev][b]) / len(q_data[ql_prev][b]), 2)
                          for b in brands if q_data[ql_prev].get(b)}
                deltas = []
                for b in brands:
                    if b in cur_q and b in prev_q and prev_q[b] != 0:
                        d = round(cur_q[b] - prev_q[b], 2)
                        sign = "+" if d >= 0 else ""
                        deltas.append(f"{brand_names.get(b, b)} {sign}{d}")
                if deltas:
                    lines.append(f"      Динамика {ql_prev}→{ql_cur}: {', '.join(deltas)}")

    return "\n".join(lines)


def _bht_summary(bht_data: dict) -> str:
    """Pre-compute BHT metrics (TOM, aided, consumption, penetration by age) so GPT doesn't calculate."""
    brands = bht_data.get("brands", [])
    brand_names = bht_data.get("brandNames", {})
    if not brands:
        return ""

    lines = ["Метрики бренд-здоровья по брендам:"]
    fmt = bht_data.get("format", "quarterly")

    def _ranked(vals: dict) -> str:
        ranked = sorted(vals.items(), key=lambda x: x[1], reverse=True)
        return "  |  ".join(f"{brand_names.get(b, b)} {v}%" for b, v in ranked)

    if fmt == "monthly":
        metrics = bht_data.get("metrics", {})
        metric_labels = bht_data.get("metricLabels", {})

        for mk in ["topOfMind", "aided", "consumption", "consideration", "mostFrequent"]:
            series = metrics.get(mk, [])
            if not series:
                continue
            # Aggregate monthly points into quarters
            q_vals: dict[str, dict[str, list]] = {}
            q_order: list[str] = []
            for pt in series:
                q = pt.get("quarter", "")
                if not q:
                    continue
                if q not in q_vals:
                    q_vals[q] = {b: [] for b in brands}
                    q_order.append(q)
                for b in brands:
                    v = pt.get(b)
                    if isinstance(v, (int, float)):
                        q_vals[q][b].append(v)
            last_4q = q_order[-4:]
            if not last_4q:
                continue
            label = metric_labels.get(mk, mk)
            lines.append(f"\n{label}:")
            for q in last_4q:
                avgs = {b: round(sum(q_vals[q][b]) / len(q_vals[q][b]), 1)
                        for b in brands if q_vals[q][b]}
                if avgs:
                    lines.append(f"  {q}: {_ranked(avgs)}")
            # QoQ dynamics
            if len(last_4q) >= 2:
                q_cur, q_prev = last_4q[-1], last_4q[-2]
                cur = {b: round(sum(q_vals[q_cur][b]) / len(q_vals[q_cur][b]), 1)
                       for b in brands if q_vals[q_cur][b]}
                prev = {b: round(sum(q_vals[q_prev][b]) / len(q_vals[q_prev][b]), 1)
                        for b in brands if q_vals[q_prev][b]}
                deltas = []
                for b in brands:
                    if b in cur and b in prev:
                        d = round(cur[b] - prev[b], 1)
                        sign = "+" if d >= 0 else ""
                        deltas.append(f"{brand_names.get(b, b)} {sign}{d}пп")
                if deltas:
                    lines.append(f"  Динамика {q_prev}→{q_cur}: {', '.join(deltas)}")

        # Penetration by age (latest available year)
        pen = bht_data.get("penetration", {})
        pen_years = pen.get("years", [])
        age_segs = pen.get("segments", {}).get("age", [])
        if age_segs and pen_years:
            latest_idx = len(pen_years) - 1
            latest_year = pen_years[latest_idx]
            lines.append(f"\nПенетрация по возрасту ({latest_year}):")
            for seg in age_segs:
                label = seg.get("label", "")
                vals = {}
                for b in brands:
                    bvals = seg.get(b, [])
                    if isinstance(bvals, list) and len(bvals) > latest_idx:
                        v = bvals[latest_idx]
                        if isinstance(v, (int, float)):
                            vals[b] = round(v, 1)
                if vals:
                    lines.append(f"  {label}: {_ranked(vals)}")

    else:
        # Quarterly format
        funnel = bht_data.get("funnel", {})
        quarters = bht_data.get("quarters", [])
        metric_keys = bht_data.get("metricKeys", [])
        metric_labels = bht_data.get("metricLabels", {})

        for mk in ["topOfMind", "aided", "consumption", "consideration"]:
            if mk not in metric_keys:
                continue
            label = metric_labels.get(mk, mk)
            lines.append(f"\n{label} (%):")
            for q in quarters:
                vals = {e["brand"]: e[mk] for e in funnel.get(q, [])
                        if isinstance(e.get(mk), (int, float))}
                if vals:
                    lines.append(f"  {q}: {_ranked(vals)}")
            if len(quarters) >= 2:
                q_cur, q_prev = quarters[0], quarters[1]
                cur = {e["brand"]: e[mk] for e in funnel.get(q_cur, []) if isinstance(e.get(mk), (int, float))}
                prev = {e["brand"]: e[mk] for e in funnel.get(q_prev, []) if isinstance(e.get(mk), (int, float))}
                deltas = []
                for b in brands:
                    if b in cur and b in prev:
                        d = round(cur[b] - prev[b], 1)
                        sign = "+" if d >= 0 else ""
                        deltas.append(f"{brand_names.get(b, b)} {sign}{d}пп")
                if deltas:
                    lines.append(f"  Динамика {q_prev}→{q_cur}: {', '.join(deltas)}")

        current_q = bht_data.get("currentQuarter", quarters[0] if quarters else "")
        pen_by_age = bht_data.get("penetrationByAge", {})
        age_data = pen_by_age.get(current_q, [])
        if age_data:
            lines.append(f"\nПенетрация по возрасту ({current_q}):")
            for entry in age_data:
                vals = {b: entry[b] for b in brands if isinstance(entry.get(b), (int, float))}
                if vals:
                    lines.append(f"  {entry.get('age', '')}: {_ranked(vals)}")

        freq_by_brand = bht_data.get("frequencyByBrand", {})
        freq_labels = bht_data.get("freqLabels", {})
        freq_cats = bht_data.get("freqCats", [])
        prev_q = quarters[1] if len(quarters) >= 2 else None
        for fq in ([prev_q, current_q] if prev_q else [current_q]):
            freq_data = freq_by_brand.get(fq, [])
            if not freq_data:
                continue
            lines.append(f"\nЧастота потребления ({fq}):")
            for entry in freq_data:
                bk = entry.get("brand", "")
                name = brand_names.get(bk, bk)
                total = entry.get("total", 0)
                cat_parts = [f"{freq_labels.get(c, c)}={entry.get(c, 0)}%" for c in freq_cats if entry.get(c)]
                lines.append(f"  {name}: всего {total}%  |  {', '.join(cat_parts)}")

    return "\n".join(lines) if len(lines) > 1 else ""


def _media_details_summary(md_data: dict) -> str:
    """Pre-compute TV strategy, TRP ranking, burst/always-on, placement split, clip duration."""
    lines = []

    # 0. Media Mix: channel comparison across periods (Jan-Jul YoY)
    mm = md_data.get("mediaMix", {})
    mm_brands = mm.get("brands", [])
    mm_periods = mm.get("periods", [])
    mm_data = mm.get("data", {})
    if mm_brands and len(mm_periods) >= 2:
        # Show all period pairs as comparisons
        lines.append("Канальный микс по периодам (млн руб, Media Mix):")
        for b in mm_brands:
            b_data = mm_data.get(b, {})
            if not b_data:
                continue
            lines.append(f"  {b}:")
            for p in mm_periods:
                p_data = b_data.get(p, {})
                if not p_data:
                    continue
                total = sum(p_data.values())
                parts = [f"{ch}={v:.1f}млн ({round(v/total*100)}%)"
                         for ch, v in sorted(p_data.items(), key=lambda x: x[1], reverse=True)]
                lines.append(f"    {p}: итого {total:.1f} млн  |  {' | '.join(parts)}")
        lines.append("")

    # 1. TRP totals and ranking
    trp_data = md_data.get("trp", {})
    brands_trp = trp_data.get("brands", [])
    periods = trp_data.get("periods", [])
    trp20 = trp_data.get("trp20", {})
    trps_spec = trp_data.get("trps", {})
    if brands_trp and periods:
        lines.append("TRP по брендам:")
        for label, source in [("TRP 20+ (общая аудитория)", trp20), ("TRP специфическая аудитория", trps_spec)]:
            if not source:
                continue
            lines.append(f"  {label}:")
            for period in periods:
                vals = {b: source[b][period] for b in brands_trp
                        if isinstance(source.get(b, {}).get(period), (int, float))}
                if vals:
                    ranked = sorted(vals.items(), key=lambda x: x[1], reverse=True)
                    lines.append(f"    {period}: " + "  >  ".join(f"{b}={v}" for b, v in ranked))

    # 2. TV Strategy: active weeks → burst/always-on + placement split
    tv = md_data.get("tvStrategy", {})
    brands_tv = tv.get("brands", [])
    years_tv = [str(y) for y in tv.get("years", [])]
    tv_chart = tv.get("data", {})
    if brands_tv and years_tv:
        lines.append("\nТВ-стратегия (активность и плейсмент-сплит):")
        for yr in years_tv[-2:]:
            yr_data = tv_chart.get(yr, {})
            if not yr_data:
                continue
            active_weeks: dict[str, set] = {b: set() for b in brands_tv}
            pl_spend: dict[str, dict[str, float]] = {b: {} for b in brands_tv}
            for placement, series in yr_data.items():
                for pt in series:
                    week = pt.get("week")
                    for b in brands_tv:
                        v = pt.get(b)
                        if isinstance(v, (int, float)) and v > 0:
                            active_weeks[b].add(week)
                            pl_spend[b][placement] = pl_spend[b].get(placement, 0) + v
            lines.append(f"  {yr}:")
            for b in brands_tv:
                n = len(active_weeks[b])
                if n == 0:
                    continue
                strategy = "always-on" if n >= 30 else ("burst" if n <= 15 else "смешанная")
                total = sum(pl_spend[b].values())
                if total > 0:
                    pl_parts = [f"{pl}={round(v/total*100)}%"
                                for pl, v in sorted(pl_spend[b].items(), key=lambda x: x[1], reverse=True) if v > 0]
                    lines.append(f"    {b}: {n} акт. недель → {strategy}  |  {', '.join(pl_parts)}")
                else:
                    lines.append(f"    {b}: {n} акт. недель → {strategy}")

    # 3. TV Sponsorship vs Direct TV analysis
    sp = md_data.get("tvSponsorship", {})
    aww = md_data.get("awwDirect", {})
    sp_trp = sp.get("trp", {})
    sp_brands = sp.get("brands", [])
    aww_data = aww.get("data", {})
    aww_periods = aww.get("periods", [])

    if sp_trp:
        lines.append("\nТВ-спонсорство vs прямое ТВ-размещение:")
        lines.append("  Бренды с активным спонсорством (TRP спонсорства по годам):")
        for b, ydata in sp_trp.items():
            if b in sp_brands:
                lines.append(f"    {b}: " + "  ".join(f"{yr}={trp}" for yr, trp in sorted(ydata.items())))

        # Cross-reference: for the latest period compare direct weeks vs sponsorship presence
        latest_aww_period = aww_periods[-1] if aww_periods else None
        if latest_aww_period:
            lines.append(f"\n  Прямое ТВ (недели активности) vs спонсорство ({latest_aww_period}):")
            aww_weeks = aww_data.get(latest_aww_period, {}).get("weeks", {})
            aww_trp = aww_data.get(latest_aww_period, {}).get("trp", {})

            # Find latest year for sponsorship
            latest_sp_year = max(sp.get("years", [2025])) if sp.get("years") else 2025

            all_tv_brands = set(sp_brands) | set(aww_weeks.keys())
            for b in sorted(all_tv_brands):
                direct_weeks = aww_weeks.get(b, 0)
                direct_trp = aww_trp.get(b, 0.0)
                sp_trp_latest = sp_trp.get(b, {}).get(latest_sp_year, 0.0)

                if direct_trp == 0 and sp_trp_latest == 0:
                    continue  # not in TV at all

                if direct_trp > 0 and sp_trp_latest > 0:
                    total = direct_trp + sp_trp_latest
                    sp_pct = round(sp_trp_latest / total * 100)
                    role = "спонсорство заполняет паузы между флайтами" if direct_weeks >= 8 else "спонсорство = основной ТВ-инструмент"
                    lines.append(f"    {b}: прямое ТВ {direct_trp} TRP ({direct_weeks} нед.) + спонсорство {sp_trp_latest} TRP ({sp_pct}% от ТВ-бюджета) → {role}")
                elif sp_trp_latest > 0 and direct_trp == 0:
                    lines.append(f"    {b}: прямого ТВ нет — ТОЛЬКО спонсорство ({sp_trp_latest} TRP)")
                elif direct_trp > 0:
                    lines.append(f"    {b}: только прямое ТВ ({direct_trp} TRP, {direct_weeks} нед.) — спонсорства нет")

    # 4. Clip duration distribution (latest period)
    clip = md_data.get("clipDuration", {})
    brands_clip = clip.get("brands", [])
    periods_clip = clip.get("periods", [])
    durations = clip.get("durations", [])
    cd_data = clip.get("data", {})
    if brands_clip and periods_clip:
        latest = periods_clip[-1]
        entries = cd_data.get(latest, [])
        if entries:
            lines.append(f"\nХронометраж роликов ({latest}, % выходов):")
            for entry in entries:
                b = entry.get("brand", "")
                parts = [f"{d}с={entry.get(str(d), 0)}%" for d in durations if entry.get(str(d))]
                if parts:
                    lines.append(f"  {b}: {', '.join(parts)}")

    return "\n".join(lines) if lines else ""


def _flight_pause_analysis(bht_data: dict, md_data: dict) -> str:
    """Cross-reference TV flight calendar (weekly) with BHT metrics (quarterly) to identify pause periods."""
    brands_bht = bht_data.get("brands", [])
    brand_names = bht_data.get("brandNames", {})
    fmt = bht_data.get("format", "quarterly")
    if not brands_bht:
        return ""

    def _norm(s: str) -> str:
        return re.sub(r'[^\w]', '', str(s).upper(), flags=re.UNICODE)

    def _week_to_month(w: int) -> int:
        return min(12, (w - 1) // 4 + 1)

    def _q_key(q: str) -> tuple:
        m = re.match(r'Q(\d) (\d{4})', str(q))
        return (int(m.group(2)), int(m.group(1))) if m else (9999, 0)

    def _q_months(q: str) -> list[int]:
        m = re.match(r'Q(\d) (\d{4})', str(q))
        if not m:
            return []
        start = (int(m.group(1)) - 1) * 3 + 1
        return [start, start + 1, start + 2]

    def _q_year(q: str) -> int:
        m = re.match(r'Q\d (\d{4})', str(q))
        return int(m.group(1)) if m else 0

    # Build TV active-weeks map: (bht_brand, year, month) → week count
    tv = md_data.get("tvStrategy", {})
    tv_brands = tv.get("brands", [])
    tv_chart = tv.get("data", {})
    bht_norm = {_norm(b): b for b in brands_bht}
    tv_to_bht: dict[str, str] = {tb: bht_norm[_norm(tb)] for tb in tv_brands if _norm(tb) in bht_norm}

    active_weeks: dict[tuple, int] = {}
    for yr_str, yr_data in tv_chart.items():
        try:
            yr = int(yr_str)
        except ValueError:
            continue
        for series in yr_data.values():
            for pt in series:
                w = pt.get("week")
                if w is None:
                    continue
                mo = _week_to_month(int(w))
                for tb, bht_b in tv_to_bht.items():
                    v = pt.get(tb)
                    if isinstance(v, (int, float)) and v > 0:
                        active_weeks[(bht_b, yr, mo)] = active_weeks.get((bht_b, yr, mo), 0) + 1

    if not active_weeks and not tv_to_bht:
        return ""

    # Build BHT metrics by quarter: {quarter: {brand: {metric: value}}}
    bht_q: dict[str, dict[str, dict[str, float]]] = {}

    if fmt == "monthly":
        metrics_data = bht_data.get("metrics", {})
        tmp: dict[str, dict[str, dict[str, list]]] = {}
        for mk in ["topOfMind", "aided"]:
            for pt in metrics_data.get(mk, []):
                q = pt.get("quarter", "")
                if not q:
                    continue
                for b in brands_bht:
                    v = pt.get(b)
                    if isinstance(v, (int, float)):
                        tmp.setdefault(q, {}).setdefault(b, {}).setdefault(mk, []).append(v)
        for q, bd in tmp.items():
            bht_q[q] = {}
            for b, mkd in bd.items():
                bht_q[q][b] = {mk: round(sum(vs) / len(vs), 1) for mk, vs in mkd.items()}
    else:
        funnel = bht_data.get("funnel", {})
        for q, entries in funnel.items():
            bht_q[q] = {}
            for entry in entries:
                b = entry.get("brand", "")
                if b not in brands_bht:
                    continue
                bht_q[q][b] = {mk: entry[mk] for mk in ["topOfMind", "aided"]
                                if isinstance(entry.get(mk), (int, float))}

    if not bht_q:
        return ""

    quarters_sorted = sorted(bht_q.keys(), key=_q_key)
    last_8q = quarters_sorted[-8:]

    lines = ["Анализ знания в паузах флайтов (кросс-референс BHT × ТВ-стратегия):"]

    for b in brands_bht:
        b_name = brand_names.get(b, b)
        flight_rows: list[tuple] = []
        pause_rows: list[tuple] = []

        for q in last_8q:
            yr = _q_year(q)
            wks = sum(active_weeks.get((b, yr, mo), 0) for mo in _q_months(q))
            metrics_q = bht_q.get(q, {}).get(b, {})
            if not metrics_q:
                continue
            tom = metrics_q.get("topOfMind")
            aided = metrics_q.get("aided")
            if wks >= 2:
                flight_rows.append((q, tom, aided, wks))
            else:
                pause_rows.append((q, tom, aided))

        if not flight_rows and not pause_rows:
            continue

        lines.append(f"\n  {b_name}:")

        if not pause_rows:
            lines.append(f"    Always-on: паузы не идентифицированы")
            for q, tom, aided, wks in flight_rows:
                parts = [f"TOM={tom}%" if tom is not None else "",
                         f"aided={aided}%" if aided is not None else ""]
                lines.append(f"    {q} [ФЛАЙТ {wks}нед]: {', '.join(p for p in parts if p)}")
        else:
            all_rows = [(q, "ФЛАЙТ", tom, aided, wks) for q, tom, aided, wks in flight_rows] + \
                       [(q, "ПАУЗА", tom, aided, 0) for q, tom, aided in pause_rows]
            all_rows.sort(key=lambda r: _q_key(r[0]))
            for q, tag, tom, aided, wks in all_rows:
                wks_str = f" {wks}нед" if tag == "ФЛАЙТ" else ""
                parts = [f"TOM={tom}%" if tom is not None else "",
                         f"aided={aided}%" if aided is not None else ""]
                lines.append(f"    {q} [{tag}{wks_str}]: {', '.join(p for p in parts if p)}")

            f_tom = [r[2] for r in flight_rows if r[2] is not None]
            p_tom = [r[1] for r in pause_rows if r[1] is not None]
            f_aided = [r[3] for r in flight_rows if r[3] is not None]
            p_aided = [r[2] for r in pause_rows if r[2] is not None]

            if f_tom and p_tom:
                avg_f = round(sum(f_tom) / len(f_tom), 1)
                avg_p = round(sum(p_tom) / len(p_tom), 1)
                d = round(avg_p - avg_f, 1)
                lines.append(f"    → TOM: флайт ср.{avg_f}% / пауза ср.{avg_p}% (δ {'+' if d>=0 else ''}{d}пп)")
            if f_aided and p_aided:
                avg_f = round(sum(f_aided) / len(f_aided), 1)
                avg_p = round(sum(p_aided) / len(p_aided), 1)
                d = round(avg_p - avg_f, 1)
                lines.append(f"    → Aided: флайт ср.{avg_f}% / пауза ср.{avg_p}% (δ {'+' if d>=0 else ''}{d}пп)")

    return "\n".join(lines) if len(lines) > 1 else ""


def _build_context(project_id: int, db: Session) -> str:
    sections = [
        ("bht",          "BHT (Brand Health Tracking)"),
        ("ad_spend",     "Медиаинвестиции"),
        ("sales",        "Продажи / доли рынка"),
        ("creatives",    "Креативы / медиамониторинг"),
        ("ecom",         "E-commerce"),
        ("presence",     "Представленность"),
        ("wordstat",     "Поисковый спрос (Wordstat)"),
        ("media_details","Медиадетали (TRP, ТВ-стратегия, хронометраж, сезонность, регионы)"),
    ]
    parts = []
    data_cache: dict[str, dict] = {}
    for data_type, label in sections:
        data = _get_data(project_id, data_type, db)
        if data:
            data_cache[data_type] = data
            if data_type == "bht":
                bht_s = _bht_summary(data)
                if bht_s:
                    parts.append(f"=== BHT: сводка метрик (предрасчёт) ===\n{bht_s}")
            if data_type == "ad_spend":
                spend = _brand_spend_summary(data)
                if spend:
                    parts.append(f"=== Медиаинвестиции: суммарные бюджеты и доли (предрасчёт) ===\n{spend}")
                mix = _channel_mix_summary(data)
                if mix:
                    parts.append(f"=== Медиаинвестиции: структура каналов (предрасчёт) ===\n{mix}")
            if data_type == "sales":
                sales_s = _sales_summary(data)
                if sales_s:
                    parts.append(f"=== Продажи: рыночные показатели (предрасчёт) ===\n{sales_s}")
            if data_type == "creatives":
                cr_summary = _creatives_summary(data)
                if cr_summary:
                    parts.append(f"=== Креативы: сводка по брендам (предрасчёт) ===\n{cr_summary}")
            if data_type == "ecom":
                ec_summary = _ecom_summary(data)
                if ec_summary:
                    parts.append(f"=== E-commerce: средние за 6 мес. (предрасчёт) ===\n{ec_summary}")
            if data_type == "media_details":
                md_summary = _media_details_summary(data)
                if md_summary:
                    parts.append(f"=== Медиадетали: сводка (предрасчёт) ===\n{md_summary}")
            trimmed = _trim_data(data)
            text = json.dumps(trimmed, ensure_ascii=False)
            if len(text) > _MAX_SECTION_CHARS:
                text = text[:_MAX_SECTION_CHARS] + "…[truncated]"
            parts.append(f"=== {label} ===\n{text}")

    # Cross-reference: flight calendar × BHT awareness
    if "bht" in data_cache and "media_details" in data_cache:
        pause_s = _flight_pause_analysis(data_cache["bht"], data_cache["media_details"])
        if pause_s:
            parts.append(f"=== Анализ знания в паузах флайтов (предрасчёт) ===\n{pause_s}")

    return "\n\n".join(parts) if parts else "Данные не загружены."


# ── LLM call ───────────────────────────────────────────────────────────────────

def _to_prose(val) -> str:
    """Recursively flatten a nested dict/list GPT answer into readable text."""
    if isinstance(val, str):
        return val
    if isinstance(val, (int, float)):
        return str(round(val, 1)) if isinstance(val, float) else str(val)
    if isinstance(val, list):
        return "; ".join(_to_prose(v) for v in val if v not in (None, "", []))
    if isinstance(val, dict):
        parts = []
        for k, v in val.items():
            key = k.replace("_", " ")
            inner = _to_prose(v)
            parts.append(f"{key}: {inner}" if inner else key)
        return ". ".join(parts)
    return str(val)


SOURCE_MAP = """КАРТА ИСТОЧНИКОВ:
— B1.1 (медиабюджеты): «Медиаинвестиции: суммарные бюджеты и доли (предрасчёт)» + «Продажи» для кросс-референса долей
— B1.3 (структура каналов): «Медиаинвестиции: структура каналов (предрасчёт)»
— B1.4 (перераспределение каналов): «Медиадетали» → «Канальный микс по периодам (Media Mix)» — периоды янв-июл 2024 и янв-июл 2025
— B2 (ТВ-стратегия): «Медиадетали» — tvStrategy, trp, clipDuration, seasonality, regionality
— B3 (эффективность медиа): «BHT» — metrics (topOfMind, aided, consumption) + penetration + «Продажи: рыночные показатели (предрасчёт)» — доля рынка %, YoY динамика (НЕ используй поле price из Продаж для показателей продаж)
— B3.5 (знание в паузах): «Анализ знания в паузах флайтов (предрасчёт)» — ТОЛЬКО этот раздел. Там уже указаны кварталы ФЛАЙТ/ПАУЗА с TOM и aided. НЕ выдумывай значения из других источников.
— B4 (коммуникации): «Креативы: сводка (предрасчёт)» — рейтинг, comm-type %, доминирующий канал
— B5 (е-ком): «E-commerce: средние за 6 мес. + квартальная динамика (предрасчёт)» + «BHT» для кросс-референса B5.1/B5.2 + «Представленность» для B5.4"""


def _call_block(client, model: str, block_questions: dict, context: str,
                client_line: str, current_period: str, current_year: int, prev_year: int) -> dict:
    """Call LLM for a single block of questions and return {qid: prose} dict."""
    n = len(block_questions)
    questions_block = "\n".join(f"{qid}: {q}" for qid, q in block_questions.items())
    keys_str = ", ".join(block_questions.keys())

    prompt = f"""Ты аналитик бренд-интеллиджент системы. Ответь строго на ВСЕ {n} вопросов ниже.
{client_line}
═══ ЗАДАНИЕ: ОТВЕТИТЬ НА ВСЕ {n} ВОПРОСОВ ═══

{questions_block}

═══ ФОРМАТ ОТВЕТА ═══
JSON-объект ровно с {n} ключами ({keys_str}). Каждое значение — строка в markdown-формате со структурой:

**Факты:**
• [Бренд 1]: [показатель] — [конкретное значение с единицами]
• [Бренд 2]: ...
• (перечисли ВСЕ бренды из категории, не только 1–2)
(если уместно — используй markdown-таблицу: | Бренд | Показатель | Значение |)

**Интерпретация:**
[3–5 предложений: что это означает стратегически, у кого сильнее позиция и почему, какие разрывы существенны для клиентского бренда]

Обязательно:
— ВСЕ бренды категории упомянуты в разделе «Факты» с конкретными цифрами
— Раздел «Интерпретация» объясняет логику и стратегические выводы
— В заголовках таблиц ВСЕГДА указывай конкретный период: не просто «Доля (%)», а «Доля (%) 2025» или «Изменение янв-июн 2025 → янв-июн 2026». Без периода заголовок не принимается.
— Используй ТОЛЬКО цифры и факты из раздела ДАННЫЕ ниже. ЗАПРЕЩЕНО придумывать значения, названия каналов, бренды или любые данные, которых нет в предоставленных данных.
— Если нужных данных нет — пиши "Данных недостаточно: [что именно отсутствует и из какого источника это можно взять]"

═══ ДАННЫЕ ═══
{client_line}
{SOURCE_MAP}

ПРИНЦИПЫ:
— ТЕКУЩИЙ ПЕРИОД: {current_period}. Данные за {current_year} и конец {prev_year} — ОСНОВНОЙ фокус анализа.
— Данные за {prev_year} — контекст для понимания динамики и трендов.
— Данные за более ранние годы (historySummary) — только если объясняют текущую ситуацию.
— СРАВНЕНИЕ С КОНКУРЕНТАМИ ОБЯЗАТЕЛЬНО в каждом ответе: называй конкретные бренды-конкуренты с их показателями. Цель — понять, что они делают иначе и зачем (какую логику или стратегию это отражает), а не просто зафиксировать факт.
— Цифры обязательны: называй конкретные месяцы, бренды, значения.

{context}

═══ НАПОМИНАНИЕ: верни JSON ровно с {n} ключами ({keys_str}). Каждый ответ: раздел «Факты» со ВСЕМИ брендами + раздел «Интерпретация». Markdown разрешён. ═══"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": f"Ты аналитик данных. Ответь ровно на {n} вопросов ({keys_str}). Каждый ответ в markdown: раздел Факты (все бренды с цифрами, можно таблицей) + раздел Интерпретация (стратегические выводы). Значения в JSON — строки с markdown-текстом. СТРОГОЕ ПРАВИЛО: используй ТОЛЬКО данные из переданного контекста. Не придумывай цифры, каналы, бренды или факты, которых нет в данных. Если данных недостаточно — прямо напиши об этом."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    result = json.loads(response.choices[0].message.content)
    return {k: _to_prose(v) for k, v in result.items()}


def _call_openai(context: str, client_brand: str = "") -> dict:
    client, model = get_llm_client()

    from datetime import date
    today = date.today()
    current_year = today.year
    prev_year = today.year - 1
    month_ru = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"][today.month - 1]
    current_period = f"{month_ru} {current_year}"
    client_line = f"КЛИЕНТСКИЙ БРЕНД: {client_brand}\n" if client_brand else ""

    # Split into 5 blocks to stay within output token limits of flash models
    prefixes = ["B1", "B2", "B3", "B4", "B5"]
    all_answers: dict = {}
    for prefix in prefixes:
        block = {k: v for k, v in QUESTIONS.items() if k.startswith(prefix)}
        if not block:
            continue
        block_result = _call_block(
            client, model, block, context,
            client_line, current_period, current_year, prev_year,
        )
        all_answers.update(block_result)
    return all_answers


# ── Endpoints ──────────────────────────────────────────────────────────────────

def _clean_answers(answers: dict) -> dict:
    """Convert any JSON-string or nested-object values left over from old snapshots."""
    cleaned = {}
    for k, v in answers.items():
        if isinstance(v, str) and len(v) > 1 and v[0] in ('{', '['):
            try:
                parsed = json.loads(v)
                cleaned[k] = _to_prose(parsed)
            except (json.JSONDecodeError, ValueError):
                cleaned[k] = v
        else:
            cleaned[k] = _to_prose(v)
    return cleaned


@router.get("/{project_id}/insights")
def get_insights(project_id: int, db: Session = Depends(get_db)):
    _require_project(project_id, db)
    snap = (
        db.query(Snapshot)
        .filter_by(project_id=project_id, data_type="insights")
        .order_by(Snapshot.uploaded_at.desc())
        .first()
    )
    if not snap:
        return {"available": False}
    answers = _clean_answers(json.loads(snap.payload))
    answers["available"] = True
    answers["generatedAt"] = snap.uploaded_at.isoformat() if snap.uploaded_at else None
    return answers


@router.post("/{project_id}/insights/generate")
def generate_insights(project_id: int, db: Session = Depends(get_db)):
    project = _require_project(project_id, db)
    context = _build_context(project_id, db)
    try:
        answers = _call_openai(context, client_brand=project.client_brand or "")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc

    existing = (
        db.query(Snapshot)
        .filter_by(project_id=project_id, data_type="insights")
        .first()
    )
    if existing:
        from datetime import datetime
        existing.payload = json.dumps(answers, ensure_ascii=False)
        existing.uploaded_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        snap = existing
    else:
        snap = Snapshot(
            project_id=project_id,
            data_type="insights",
            payload=json.dumps(answers, ensure_ascii=False),
            source_filename=None,
            period=None,
        )
        db.add(snap)
        db.commit()
        db.refresh(snap)

    answers["available"] = True
    answers["generatedAt"] = snap.uploaded_at.isoformat() if snap.uploaded_at else None
    return answers


def _require_project(project_id: int, db: Session) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project
