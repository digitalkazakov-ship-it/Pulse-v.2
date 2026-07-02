# Pulse — Brand Intelligence Dashboard

Multi-tenant Brand Intelligence Dashboard — FastAPI backend + React frontend.

**Production:**
- Frontend: https://pulse-v2ro.netlify.app
- Backend API: https://pulse-v2-production.up.railway.app

## Architecture

```
competify-radar-v2/
├── backend/           FastAPI, Python 3.11+
│   ├── main.py        App entry point; runs SQLite migrations on startup
│   ├── database.py    SQLite (pulse.db)
│   ├── models.py      Project, Snapshot
│   ├── schemas.py
│   ├── routers/
│   │   ├── projects.py       CRUD + PATCH (client_brand)
│   │   ├── data.py           Upload + GET data + perception merge
│   │   ├── insights.py       AI strategy insights
│   │   └── conversations.py  AI meeting topics (uses OpenAI)
│   ├── processors/    One processor per data type
│   │   ├── registry.py
│   │   ├── bht.py            BHT — auto-detects monthly format (any category) or quarterly
│   │   ├── sales.py
│   │   ├── ad_spend.py
│   │   ├── creatives.py
│   │   ├── ecom.py
│   │   ├── presence.py
│   │   ├── perception.py
│   │   ├── media_details.py
│   │   ├── neuro.py
│   │   ├── wordstat.py
│   │   └── digital.py
│   ├── llm_client.py  Общий LLM-клиент: OpenRouter (приоритет) или OpenAI
│   └── requirements.txt
└── frontend/          React 18 + Vite + Tailwind + Recharts
    └── src/
        ├── lib/api.ts              API client + TypeScript types
        ├── contexts/ProjectContext.tsx
        └── pages/
            ├── Projects.tsx        Project management (+ client_brand inline edit)
            ├── Upload.tsx          File upload UI
            ├── BrandAwareness.tsx  BHT (monthly/quarterly) + GEO/ИИ-видимость (neuro)
            ├── StrategyInsights.tsx  Стратегические выводы (B1–B5 + кросс-метричные summaries)
            ├── Conversations.tsx     Темы для встречи (LLM, до 5 тем, 4 блока каждая)
            └── ... (остальные страницы дашборда)
```

## Data model

- **Project** — клиент / бренд-трекинг проект; поле `client_brand` используется для генерации тем встречи
- **Snapshot** — один загруженный файл (хранит обработанный JSON в поле `payload`)
  - `GET /data/{type}` возвращает последний snapshot
  - Для `perception` — мержит `sentiment` из всех snapshot по хронологии

## Running locally

### Backend

```bash
# ВАЖНО: запускать из competify-radar-v2/, НЕ из backend/
cd competify-radar-v2
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

`main.py` использует relative imports (`from .database`, `from .routers`) — запуск `uvicorn main:app` из директории `backend/` вызовет `ImportError`. SQLite БД `pulse.db` создаётся в рабочей директории (т.е. в `competify-radar-v2/`).

Требуется `.env` (в `backend/`) для работы `/insights` и `/conversations`. Приоритет — OpenRouter; если ключ отсутствует, используется OpenAI.

```ini
# backend/.env — один из двух вариантов (OpenRouter имеет приоритет)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=deepseek/deepseek-v4-flash   # любая модель OpenRouter

OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini                      # используется, если OpenRouter не задан

# Опционально — для разрешения дополнительных портов (через запятую)
ALLOWED_ORIGINS=http://localhost:8082,https://your-site.netlify.app
```

API: http://localhost:8000 · Swagger UI: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:8081
```

Для подключения к нестандартному бэкенду создай `frontend/.env.local`:
```ini
VITE_API_URL=http://localhost:8000/api
```

## Deployment

### Railway (backend)
1. Подключи GitHub-репозиторий, оставь корневую директорию `/`
2. Добавь Volume, смонтируй в `/data`, задай переменную `DATABASE_URL=sqlite:////data/pulse.db`
3. Задай все переменные из `backend/.env` в Railway → Variables, плюс `ALLOWED_ORIGINS=https://your-site.netlify.app`
4. Деплой запускается автоматически при пуше в `main`

### Netlify (frontend)
- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `dist`
- Переменная окружения: `VITE_API_URL=https://your-railway-domain.up.railway.app/api`

## BHT processor formats

`bht.py` поддерживает два формата:

**Monthly Brand Pulse** (авто-детектор) — файлы с датами в строке 12 листа 0:
- Автоматически определяет бренды, метрики и пенетрацию для **любой категории** (сыр, пельмени, любые другие)
- Лист воронки (sheet 0): детектирует бренды и метрики автоматически (см. ниже)
- Лист пенетрации: определяется по названию листа (`*пенетрация`)
- Сегменты пенетрации: col 0 содержит заголовок группы (`Пол`, `Возраст`, `Размер...`, `Федеральный округ`); col 1 — метка строки
- Ключи брендов в JSON: Кириллица без пробелов (напр. `'Белебеевский'`)

### Алгоритм детектирования брендов и метрик (лист воронки)

Процессор сканирует строки 13–300 листа 0 в поисках **маркеров начала бренд-блока**:

```
Строка X  │ col 0 = 'Первое упоминание' │ col 1 = 'Название бренда' │ данные …
Строка X+1│ col 0 = 'Спонтанное знание' │ col 1 = (любое)           │ данные …
Строка X+2│ col 0 = 'Подсказанное знание'│ …                         │ данные …
Строка X+3│ col 0 = 'Рассмотрение к покупке' │ …                     │ данные …
Строка X+4│ col 0 = 'Потребление'        │ …                         │ данные …
Строка X+5│ col 0 = 'Наиболее частое потребление' │ …                │ данные …
```

**Логика:**
1. Найдена строка, где `col 0 == 'Первое упоминание'` **и** `col 1` — непустая строка → это начало нового бренда; `col 1` становится display name бренда
2. Следующие 12 строк сканируются на совпадение `col 0` с таблицей меток метрик:

| col 0 в файле | metric key |
|---|---|
| Первое упоминание | `topOfMind` |
| Спонтанное знание | `spontaneous` |
| Подсказанное знание | `aided` |
| Рассмотрение к покупке | `consideration` |
| Потребление | `consumption` |
| Наиболее частое потребление | `mostFrequent` |

3. Ключ бренда в JSON = display name без пробелов и спецсимволов (Кириллица сохраняется), напр. `'Горячая штучка'` → `'Горячаяштучка'`
4. Временной ряд строится по столбцам из строки 12 листа 0 (0-indexed), где хранятся datetime-объекты (одна дата = один месяц)

**Требования к структуре листа воронки:**
- Строка 12 (0-indexed, т.е. 13-я строка Excel): datetime-значения в столбцах данных — по одному на каждый месяц наблюдения
- Каждый бренд-блок начинается со строки, где `col 0 = 'Первое упоминание'` (точное совпадение) и `col 1` = название бренда
- Метки метрик в `col 0` должны точно совпадать со значениями в таблице выше

### Требования к структуре листа пенетрации

Чтобы график Пенетрация отображался корректно, лист с `пенетрация` в названии должен иметь следующую структуру:

```
Строка N-2  │ (пусто) │ (пусто) │ Бренд 1   │ …  │ Бренд 2   │ …  │ …
Строка N-1  │ (пусто) │ (пусто) │ Row %     │ …  │ Row %     │ …  │ …
Строка N    │ (пусто) │ (пусто) │ 2020│2021│…│2025│ 2020│…   │ …  │ ← ГОДЫ (целые числа)
Строка N+1  │ Total   │ (пусто) │  56 │ …  │    │   42 │ …  │    │ ← данные Total
Строка N+2  │ Пол     │ Мужчины │  …  │    │    │   …  │    │    │ ← 1-я строка группы
Строка N+3  │ (пусто) │ Женщины │  …  │    │    │      │    │    │
Строка N+4  │ Возраст │ 18-24   │  …  │    │    │      │    │    │
…           │ (пусто) │ 25-34   │  …  │                            │
…           │ Размер  │ Большая Москва │ … │                       │
…           │ (пусто) │ СПб    │  …  │                             │
…           │ (пусто) │ 0-99k  │ (нет данных — разделитель)        │ ← пустая строка-разделитель
…           │ Федеральный округ │ Центральный │ … │                │
…           │ (пусто) │ Северо-Западный │ …  │                    │
```

**Ключевые правила:**
- Название листа должно содержать слово `пенетрация` (регистр не важен)
- Строка с годами (целые числа 2015–2030) находится **в строках 30–80** листа — процессор ищет первую подходящую строку в этом диапазоне
- Названия брендов — **за 2 строки до строки с годами** (строка N-2), в тех же столбцах, что и данные
- Каждый бренд занимает N столбцов (по числу лет), бренды идут подряд без пропусков
- Col 0 = заголовок группы сегментов (только в первой строке группы): `Пол`, `Возраст`, слово `Размер`, слово `Федерал`
- Col 1 = метка строки (`Мужчины`, `18-24`, `Большая Москва`, и т.д.)
- Строка с нулевыми / отсутствующими данными (напр. `0-99k`) служит **разделителем** между «Размер нас. пункта» и «Федеральный округ» — данные в ней должны быть пустыми

**Quarterly mineral water** — файлы без дат в листе 0 (Narzan / Borjomi / Сенежская / Святой источник):
- Жёстко заданные позиции строк и столбцов в константах `METRIC_ROWS`, `CHRONO`, `AGE_COL_START` и т.д.

## Data types and expected files

| data_type      | Файл          | Описание                                          |
|----------------|---------------|---------------------------------------------------|
| bht            | .xlsx         | Brand Health Tracking                             |
| sales          | .xlsx         | Продажи и доля рынка                              |
| ad_spend       | .xlsx         | Медиаинвестиции (лист Flowchart); колонка расходов — **Prometheus Est. Cost** (col 21) |
| creatives      | .xlsx         | Мониторинг креативов (лист Креативы)              |
| ecom           | .xlsx         | E-commerce (Ozon / WB / Яндекс Маркет)           |
| presence       | .xlsx         | Наличие в рознице и доставке                      |
| perception     | .xlsx         | Восприятие бренда (листы SL и Имидж)              |
| media_details  | .xlsx         | Сезонность, регионы, TRP, TV Strategy, хронометраж |
| neuro          | .xlsx         | GEO / ИИ-видимость (Google AI Overview + Яндекс Нейро) |
| wordstat       | .zip          | ZIP с файлами по каждому бренду                   |
| digital        | .zip          | ZIP с 2 .xlsx (текущий год + прошлый год)         |

## API endpoints

```
GET    /api/projects                              — список проектов
POST   /api/projects                              — создать проект {"name": "...", "client_brand": "..."}
GET    /api/projects/{id}                         — один проект
PATCH  /api/projects/{id}                         — обновить проект (напр. client_brand)
DELETE /api/projects/{id}                         — удалить проект

GET    /api/projects/{id}/data/{type}             — последние данные
POST   /api/projects/{id}/upload/{type}           — загрузить файл
GET    /api/projects/{id}/snapshots               — история загрузок

GET    /api/projects/{id}/insights                — AI стратегические выводы (кэш)
POST   /api/projects/{id}/insights/generate       — сгенерировать выводы (OpenAI, ~30 сек)

GET    /api/projects/{id}/conversations           — AI темы для встречи (кэш)
POST   /api/projects/{id}/conversations/generate  — сгенерировать темы (OpenAI, требует client_brand)

# Публичные read-only ссылки
POST   /api/projects/{id}/share                   — создать share-токен (возвращает share_token)
DELETE /api/projects/{id}/share                   — отозвать токен
GET    /api/public/{token}                        — получить id и name проекта по токену
GET    /api/public/{token}/data/{type}            — данные проекта (без авторизации)
```

Публичный дашборд доступен по маршруту `/share/<token>` — коллеги видят все страницы, но кнопки генерации AI-выводов скрыты.

## Страницы дашборда

| Маршрут           | Страница               | Данные (`data_type`)                                    |
|-------------------|------------------------|---------------------------------------------------------|
| `/`               | Overview               | все типы                                                |
| `/awareness`      | Brand Awareness        | `bht`, `neuro`                                          |
| `/perception`     | Perception & Social    | `perception`                                            |
| `/digital`        | Site stats             | `digital`                                               |
| `/availability`   | Availability & E-com   | `presence`, `ecom`                                      |
| `/sales`          | Sales                  | `sales`                                                 |
| `/media`          | Media & Creatives      | `ad_spend`, `creatives`, `sales`                        |
| `/media-details`  | Media Details          | `media_details`                                         |
| `/insights`       | Стратегические выводы  | `bht`, `ad_spend`, `sales`, `creatives`, `ecom`, `presence`, `media_details` |
| `/conversations`  | Темы для встречи       | то же; ИИ-генерация на основе `client_brand` проекта   |
| `/upload`         | Загрузка данных        | —                                                       |
| `/projects`       | Управление проектами   | —                                                       |

## Ключевые правила обработки данных

### Фильтрация ритейлеров (`ad_spend.py`, `creatives.py`)

Оба процессора используют двухпроходную логику:

- **Pass 1** — классификация брендов: имя → `RETAILER_NAME_KW` (магнит, ozon, wildberries, x5 клуб и др.); неизвестные бренды — по контексту категорий в col 10
- **Pass 2** — строки, содержащие **любой** ритейлерский бренд, исключаются целиком (совместные размещения не учитываются)

### Страница «Стратегические выводы» (`routers/insights.py`)

Данные передаются GPT с предрасчётами — это предотвращает галлюцинации и неверные вычисления:

| Секция контекста | Источник | Что содержит |
|---|---|---|
| Медиаинвестиции: суммарные бюджеты (предрасчёт) | `ad_spend` | Суммы по годам, доля в категории %, YoY delta vs те же месяцы прошлого года |
| Медиаинвестиции: структура каналов (предрасчёт) | `ad_spend` | Доля ТВ/digital/OOH/радио % по брендам, сравнение сопоставимых периодов |
| BHT: сводка метрик (предрасчёт) | `bht` | TOM, aided, потребление, частота — квартальные средние + QoQ delta |
| Продажи: рыночные показатели (предрасчёт) | `sales` | Доля рынка % по кварталам, YoY динамика; **поле `price` для показателей продаж не используется** |
| Креативы: сводка (предрасчёт) | `creatives` | Рейтинг по объёму, comm-type % (image/promo/product), доминирующий канал |
| E-commerce: средние за 6 мес. (предрасчёт) | `ecom` | Средние и квартальная динамика выручки / доли продаж по маркетплейсам |
| Медиадетали: сводка (предрасчёт) | `media_details` | Media Mix по периодам, TRP, ТВ-стратегия, спонсорство, хронометраж |
| Анализ знания в паузах флайтов (предрасчёт) | `bht` × `media_details` | Кросс-референс: недели ТВ-активности → ФЛАЙТ/ПАУЗА кварталы × TOM/aided; delta пп |

**Алгоритм «паузы»:** неделя ТВ → месяц (`min(12, (week-1)//4 + 1)`) → квартал. Квартал с ≥2 активными неделями = ФЛАЙТ, остальные = ПАУЗА. Сопоставление брендов между tvStrategy и BHT — по нормализованному имени (без спецсимволов, uppercase).

**Генерация выводов — 5 блочных LLM-вызовов:** `_call_openai()` разбивает вопросы B1–B5 на 5 отдельных вызовов (`_call_block()`), чтобы не превышать лимит вывода flash-моделей. Параметр `max_tokens` не используется — модель завершает ответ самостоятельно.

### `backend/llm_client.py` — общий LLM-клиент

```python
from backend.llm_client import get_llm_client

client, model = get_llm_client()
# → OpenRouter (если задан OPENROUTER_API_KEY) или OpenAI
```

Используется в `routers/insights.py` и `routers/conversations.py`. Выбор провайдера происходит при каждом вызове — смена ключа в `.env` вступает в силу после перезапуска бэкенда.

### GEO / ИИ-видимость (`neuro.py`)

Один файл `.xlsx` с 4 листами:

| Лист | Ключевое слово в названии | Содержит |
|---|---|---|
| Сводка | `сводк` | Бренд + Google/Яндекс: упоминания, ответов, доля % |
| По запросам Google | `google` | Запрос × упоминания по брендам |
| По запросам Яндекс | `яндекс` | То же для Яндекс Нейро |
| Источники | `источник` | Сайты с числом цитирований |

Бренды определяются автоматически из листа «Сводка» — нет ни одного захардкоженного имени. Формат вывода:

```json
{
  "brands": ["БрестЛитовск", ...],
  "brandNames": {"БрестЛитовск": "Брест-Литовск"},
  "summary": [{"brand": "...", "brandName": "...", "googleMentions": 35, "googleTotal": 266, "googleShare": 13.2, "yandexMentions": 25, "yandexTotal": 211, "yandexShare": 11.8}],
  "queries": {"google": [{"query": "...", "total": 13, "БрестЛитовск": 9}], "yandex": [...]},
  "sources": [{"site": "syrover.ru", "google": 80, "yandex": 0, "total": 80, "brands": "..."}]
}
```

## Важные соглашения по масштабу данных

| Поле | Диапазон | Примечание |
|------|----------|------------|
| `sales.marketShare[]` | уже % (напр. `7.8` = 7,8%) | **не умножать на 100** |
| `ecom.charts.salesShare[]` | 0–1 (доля от всей категории) | в B5.2 не используется |
| B5.2 | % от суммы выборки | выручка бренда / суммарная выручка 4 брендов на площадке |
| `bht.funnel[]` | уже % (напр. `5.46` = 5,46%) | **не умножать на 100** |
