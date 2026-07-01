import os
import re
import json
from openai import OpenAI
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Project, Snapshot
from ..llm_client import get_llm_client

router = APIRouter()

AGENCY = "RORE"

PRIORITY_GUIDE = """
Выбери до 5 тем строго в таком порядке приоритетов:
1. Про деньги или рыночную долю — открывает разговор о бизнесе, а не о медиа
2. Про медиаэффективность — что работает / не работает в текущей стратегии клиента
3. Контринтуитивный факт о конкуренте — ломает привычную картину мира клиента
4. Про аудиторию или позиционирование — где декларация расходится с данными
5. Операционная и быстро решаемая — идеальный «первый шаг» без долгого согласования

Тема попадает в список только если одновременно:
(1) есть верифицированные данные из предоставленных источников
(2) есть конкретный формат первого шага, который можно согласовать на встрече

Если данных недостаточно для какой-то позиции — пропусти её, не включай пустышку.
""".strip()

PRINCIPLES = """
ПРИНЦИПЫ РАБОТЫ С ДАННЫМИ:
✓ Маркируй каждый факт — указывай источник (bht, ad_spend, sales, creatives, ecom, presence)
✓ Отделяй факты от интерпретаций
✓ Предлагай несколько объяснений, если нет однозначного
✓ Указывай ограничения данных, если они есть
✓ Признавай, если чего-то не знаешь

✗ Не пиши гипотезы как факты
✗ Не выбирай объяснение, удобное агентству
✗ Не придумывай данные, которых нет
✗ Не сравнивай несопоставимые метрики
""".strip()


_TRIM_SERIES_KEYS = {
    "salesIndex", "salesYoY", "marketShare", "price", "distribution",
}
_MAX_SECTION_CHARS = 40_000
_SUMMARIZE_UP_TO   = 2021
_RECENT_MONTHS     = 36


def _year_from_label(month: str) -> int:
    m = re.search(r"'(\d{2})$", str(month))
    return (2000 + int(m.group(1))) if m else 0


def _compact_series(series: list, brands: list) -> dict:
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
        str(yr): {b: round(sum(vs) / len(vs), 2) for b, vs in bv.items() if vs}
        for yr, bv in sorted(by_year.items())
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


def _get_data(project_id: int, data_type: str, db: Session) -> dict | None:
    snap = (
        db.query(Snapshot)
        .filter_by(project_id=project_id, data_type=data_type)
        .order_by(Snapshot.uploaded_at.desc())
        .first()
    )
    return json.loads(snap.payload) if snap else None


def _build_context(project_id: int, db: Session) -> str:
    sections = [
        ("bht",          "BHT (Brand Health Tracking)"),
        ("ad_spend",     "Медиаинвестиции"),
        ("sales",        "Продажи / доли рынка"),
        ("creatives",    "Креативы / медиамониторинг"),
        ("ecom",         "E-commerce"),
        ("presence",     "Представленность"),
        ("wordstat",     "Поисковый спрос (Wordstat)"),
        ("media_details","Медиадетали"),
    ]
    parts = []
    for data_type, label in sections:
        data = _get_data(project_id, data_type, db)
        if data:
            trimmed = _trim_data(data)
            text = json.dumps(trimmed, ensure_ascii=False)
            if len(text) > _MAX_SECTION_CHARS:
                text = text[:_MAX_SECTION_CHARS] + "…[truncated]"
            parts.append(f"=== {label} ===\n{text}")
    return "\n\n".join(parts) if parts else "Данные не загружены."


def _call_openai(context: str, client_brand: str) -> dict:
    client, model = get_llm_client()

    prompt = f"""Ты старший аналитик агентства {AGENCY}.
Клиентский бренд: {client_brand}

Тебе предоставлены полные данные по конкурентной среде категории.
Твоя задача — найти 5 наиболее ценных тем для разговора с клиентом на основе этих данных.

ДАННЫЕ:
{context}

{PRIORITY_GUIDE}

{PRINCIPLES}

СТРУКТУРА КАЖДОЙ ТЕМЫ (обязательная, все 4 элемента):
- fact: конкретные цифры из данных с указанием источника. Никаких «судя по всему». Только измеримые данные.
- meaning: твоя интерпретация — честно и критически. Несколько объяснений, если нет однозначного. Не выбирай то, что выгоднее агентству.
- question: открытый диагностический вопрос для встречи. Не риторический, не обвинительный — цель дать клиенту говорить.
- solution: конкретный инструмент, кейс или формат пилота от {AGENCY} под эту боль. Одно точное предложение, не «мы умеем всё».

Верни ТОЛЬКО валидный JSON без пояснений и markdown-блоков:
{{
  "topics": [
    {{
      "title": "краткое название темы (до 80 символов)",
      "priority": 1,
      "factSource": "перечень источников через запятую",
      "fact": "...",
      "meaning": "...",
      "question": "...",
      "solution": "..."
    }}
  ]
}}"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "Ты аналитик данных. Отвечаешь строго в формате JSON."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    return json.loads(response.choices[0].message.content)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/{project_id}/conversations")
def get_conversations(project_id: int, db: Session = Depends(get_db)):
    _require_project(project_id, db)
    snap = (
        db.query(Snapshot)
        .filter_by(project_id=project_id, data_type="conversations")
        .order_by(Snapshot.uploaded_at.desc())
        .first()
    )
    if not snap:
        return {"available": False}
    data = json.loads(snap.payload)
    data["available"] = True
    data["generatedAt"] = snap.uploaded_at.isoformat() if snap.uploaded_at else None
    return data


@router.post("/{project_id}/conversations/generate")
def generate_conversations(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if not project.client_brand:
        raise HTTPException(400, "Клиентский бренд не задан. Укажите его в настройках проекта.")

    context = _build_context(project_id, db)
    try:
        result = _call_openai(context, project.client_brand)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc

    existing = (
        db.query(Snapshot)
        .filter_by(project_id=project_id, data_type="conversations")
        .first()
    )
    if existing:
        existing.payload = json.dumps(result, ensure_ascii=False)
        db.commit()
        db.refresh(existing)
        snap = existing
    else:
        snap = Snapshot(
            project_id=project_id,
            data_type="conversations",
            payload=json.dumps(result, ensure_ascii=False),
            source_filename=None,
            period=None,
        )
        db.add(snap)
        db.commit()
        db.refresh(snap)

    result["available"] = True
    result["generatedAt"] = snap.uploaded_at.isoformat() if snap.uploaded_at else None
    return result


def _require_project(project_id: int, db: Session):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")
