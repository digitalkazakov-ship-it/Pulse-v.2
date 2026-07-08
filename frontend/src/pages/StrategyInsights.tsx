import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, AlertCircle, Sparkles, RefreshCw, Clock9 } from 'lucide-react';

// ── Markdown table parser ──────────────────────────────────────────────────────

function renderInline(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p);
}

function MdTable({ raw }: { raw: string }) {
  const lines = raw.trim().split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length < 2) return <pre className="text-xs">{raw}</pre>;
  const parseRow = (l: string) => l.split('|').slice(1, -1).map(c => c.trim());
  const headers = parseRow(lines[0]);
  const rows = lines.slice(2).map(parseRow);
  return (
    <div className="overflow-x-auto my-2">
      <table className="border-collapse text-xs table-auto">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="border border-border bg-muted/60 px-2 py-1 text-left font-semibold text-muted-foreground whitespace-nowrap">
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 1 ? 'bg-muted/20' : ''}>
              {row.map((cell, j) => (
                <td key={j} className="border border-border px-2 py-1 align-top">{renderInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MdContent({ text }: { text: string }) {
  const blocks: { type: 'table' | 'prose'; content: string }[] = [];
  let proseLines: string[] = [];
  let tableLines: string[] = [];

  for (const line of text.split('\n')) {
    if (line.trim().startsWith('|')) {
      if (proseLines.length) { blocks.push({ type: 'prose', content: proseLines.join('\n') }); proseLines = []; }
      tableLines.push(line);
    } else {
      if (tableLines.length) { blocks.push({ type: 'table', content: tableLines.join('\n') }); tableLines = []; }
      proseLines.push(line);
    }
  }
  if (tableLines.length) blocks.push({ type: 'table', content: tableLines.join('\n') });
  if (proseLines.length) blocks.push({ type: 'prose', content: proseLines.join('\n') });

  return (
    <>
      {blocks.map((b, i) =>
        b.type === 'table'
          ? <MdTable key={i} raw={b.content} />
          : <ReactMarkdown key={i}>{b.content}</ReactMarkdown>
      )}
    </>
  );
}
import { api, type InsightsData } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SectionDef {
  title: string;
  tag: string;
  questions: { id: string; q: string }[];
}

// ── Data ───────────────────────────────────────────────────────────────────────

const SECTIONS: SectionDef[] = [
  {
    title: 'Медиабюджеты: размер, динамика, структура',
    tag: 'B1',
    questions: [
      { id: 'B1.1', q: 'Общий медиабюджет категории. Динамика. Сопоставление брендов по размеру инвестиций.' },
      { id: 'B1.2', q: 'Распределение бюджета по брендам. Где растёт, где сокращается?' },
      { id: 'B1.3', q: 'Структура по каналам: ТВ, digital, OOH, радио. Кто доминирует в каком канале?' },
      { id: 'B1.4', q: 'Есть ли признаки перераспределения бюджета между каналами за период?' },
    ],
  },
  {
    title: 'ТВ-стратегия: флайты, каналы, аудиторный профиль',
    tag: 'B2',
    questions: [
      { id: 'B2.1', q: 'Burst или always-on стратегия у каждого бренда? Сколько активных месяцев в ТВ?' },
      { id: 'B2.2', q: 'Топ-каналы по WRP: соответствует ли сплит задекларированной ЦА?' },
      { id: 'B2.3', q: 'Есть ли ТВ-спонсорство? Какую роль оно играет в стратегии?' },
      { id: 'B2.4', q: 'Одинаковый ли ТВ-сплит у разных брендов? Если да — это проблема для всех.' },
    ],
  },
  {
    title: 'Эффективность медиа: знание, потребление, конверсия',
    tag: 'B3',
    questions: [
      { id: 'B3.1', q: 'TOM (первое упоминание) по брендам. Динамика по кварталам. Кто лидирует и почему.' },
      { id: 'B3.2', q: 'Частота потребления total и по брендам. Связь с медиаинвестициями.' },
      { id: 'B3.3', q: 'Потребительская база: где самый сильный возрастной профиль у каждого бренда?' },
      { id: 'B3.4', q: 'Высокий TOM при низкой доле рынка — коммуникационная ли это проблема или дистрибуционная?' },
      { id: 'B3.5', q: 'Падает ли знание в паузах флайтов? Тренды между кварталами.' },
    ],
  },
  {
    title: 'Коммуникации и креатив',
    tag: 'B4',
    questions: [
      { id: 'B4.1', q: 'Текущее позиционирование каждого бренда. Насколько сообщения дифференцированы?' },
      { id: 'B4.2', q: 'Последние кампании: идея, доминирующий канал, масштаб активности по количеству креативов.' },
      { id: 'B4.3', q: 'Коллаборации, инфлюенсеры, спонсорство — есть ли связная коммуникационная территория?' },
      { id: 'B4.4', q: 'Что конкуренты делают принципиально иначе в коммуникациях? Где разрыв с клиентским брендом?' },
    ],
  },
  {
    title: 'Еком: присутствие, представленность, разрывы',
    tag: 'B5',
    questions: [
      { id: 'B5.1', q: 'Кто лидирует по онлайн-выручке? На каких маркетплейсах разрыв наибольший?' },
      { id: 'B5.2', q: 'Доля каждого бренда на Ozon, WB, ЯМ vs конкуренты. Где отставание наиболее критично?' },
      { id: 'B5.3', q: 'Маркетплейсы (Ozon+WB) vs е-гросери (ЯМ): в каком канале каждый бренд сильнее?' },
      { id: 'B5.4', q: 'Есть ли признаки проблем с дистрибуцией в конкретных розничных сетях?' },
    ],
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, tag, children }: { title: string; tag: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-card hover:bg-accent/30 transition-colors text-left"
      >
        <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{tag}</span>
        <span className="font-semibold text-foreground flex-1">{title}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 py-4 space-y-5 border-t border-border bg-background">
          {children}
        </div>
      )}
    </div>
  );
}

function AnswerBlock({ id, q, answer }: { id: string; q: string; answer: unknown }) {
  const text: string | undefined = typeof answer === 'string' ? answer
    : answer != null && typeof answer === 'object' ? JSON.stringify(answer, null, 0)
    : undefined;
  const isNoData = text?.startsWith('Данных недостаточно');
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
          {id}
        </span>
        <p className="text-xs font-semibold text-muted-foreground leading-snug">{q}</p>
      </div>
      {text ? (
        isNoData ? (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-3 ml-7">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{text}</span>
          </div>
        ) : (
          <div className="ml-7 max-w-full text-sm text-foreground leading-relaxed prose prose-sm prose-neutral dark:prose-invert max-w-none
            prose-p:my-1 prose-ul:my-1 prose-li:my-0.5
            prose-strong:text-foreground prose-headings:text-foreground
            [&_table]:w-auto [&_table]:text-xs [&_table]:border-collapse
            [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:whitespace-nowrap [&_th]:bg-muted/60
            [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top
            [&_table]:block [&_table]:overflow-x-auto">
            <MdContent text={text} />
          </div>
        )
      ) : (
        <div className="ml-7 h-4 bg-muted/30 rounded animate-pulse" />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function StrategyInsights() {
  const { projectId, isReadonly } = useProject();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genSeconds, setGenSeconds] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (projectId === null) return;
    setInsights(null);
    setReady(false);
    setError(null);
    api.getInsights(projectId)
      .then(d => { if (d.available) setInsights(d); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [projectId]);

  async function handleGenerate() {
    if (projectId === null) return;
    setGenerating(true);
    setGenSeconds(0);
    setError(null);
    timerRef.current = setInterval(() => setGenSeconds(s => s + 1), 1000);
    try {
      const d = await api.generateInsights(projectId);
      setInsights(d);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  if (projectId === null) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Сначала выберите или создайте проект.
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Загрузка…
      </div>
    );
  }

  const hasInsights = insights?.available === true;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Стратегические выводы</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ответы на ключевые вопросы по медиастратегии и коммуникациям на основе загруженных данных
          </p>
          {hasInsights && insights!.generatedAt && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Clock9 className="w-3 h-3" />
              Сгенерировано:{' '}
              {new Date(insights!.generatedAt as string).toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </div>

        {!isReadonly && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {generating
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Sparkles className="w-4 h-4" />}
            {generating
              ? `Генерация… ${genSeconds}с`
              : hasInsights ? 'Обновить выводы' : 'Сгенерировать выводы'}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!hasInsights && !generating && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-4">
          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Нажмите «Сгенерировать выводы» — система проанализирует все загруженные данные
            и сформулирует ответы на каждый вопрос. Займёт ~15–30 секунд.
          </span>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {SECTIONS.map(section => (
          <Section key={section.tag} title={section.title} tag={section.tag}>
            {section.questions.map(({ id, q }) => (
              <AnswerBlock
                key={id}
                id={id}
                q={q}
                answer={generating ? undefined : insights?.[id]}
              />
            ))}
          </Section>
        ))}
      </div>
    </div>
  );
}
