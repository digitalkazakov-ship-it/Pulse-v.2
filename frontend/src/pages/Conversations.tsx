import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, RefreshCw, Sparkles, ArrowRight } from 'lucide-react';
import { api, type ConversationsData, type TopicData } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';

function TopicCard({ topic, n }: { topic: TopicData; n: number }) {
  const rows: Array<{ num: string; label: string; content: string; sub?: string; italic?: boolean; accent?: boolean }> = [
    { num: '1', label: 'Факт-основание',    content: topic.fact,     sub: `Источник: ${topic.factSource}` },
    { num: '2', label: 'Что это означает',  content: topic.meaning },
    { num: '3', label: 'Вопрос для встречи', content: `«${topic.question}»`, italic: true },
    { num: '4', label: 'Заход на решение',  content: topic.solution, accent: true },
  ];
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-card px-4 py-3 border-b border-border flex items-center gap-3">
        <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0">
          Тема {n}
        </span>
        <span className="text-sm font-semibold text-foreground">{topic.title}</span>
      </div>
      <div className="divide-y divide-border/50">
        {rows.map(row => (
          <div key={row.num} className={`px-4 py-3 flex gap-3 ${row.accent ? 'bg-emerald-500/5' : ''}`}>
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-primary">{row.num}</span>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {row.label}
              </p>
              <p className={`text-sm text-foreground leading-snug ${row.italic ? 'italic' : ''}`}>
                {row.content}
              </p>
              {row.sub && <p className="text-[10px] text-muted-foreground italic">{row.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Conversations() {
  const { projectId, projects, isReadonly } = useProject();
  const [conversations, setConversations] = useState<ConversationsData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const currentProject = projects.find(p => p.id === projectId);
  const clientBrand = currentProject?.client_brand ?? null;

  useEffect(() => {
    if (projectId === null) return;
    setReady(false);
    setConversations(null);
    setError('');
    api.getConversations(projectId)
      .then(d => setConversations(d))
      .catch(err => setError(String(err)))
      .finally(() => setReady(true));
  }, [projectId]);

  async function handleGenerate() {
    if (!projectId) return;
    setGenerating(true);
    setError('');
    try {
      const d = await api.generateConversations(projectId);
      setConversations(d);
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
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

  const topics = conversations?.topics ?? [];
  const hasTopics = !!(conversations?.available && topics.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Темы для встречи</h1>
          <p className="text-sm text-muted-foreground mt-1">
            До 5 приоритетных тем для разговора с клиентом, сформированных ИИ на основе всех загруженных данных.
            {clientBrand && <> Клиентский бренд: <strong className="text-foreground">{clientBrand}</strong>.</>}
          </p>
          {conversations?.generatedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Сгенерировано: {new Date(conversations.generatedAt).toLocaleString('ru-RU')}
            </p>
          )}
        </div>
        {!isReadonly && (
          <button
            onClick={handleGenerate}
            disabled={generating || !clientBrand}
            title={!clientBrand ? 'Укажите клиентский бренд в настройках проекта' : undefined}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
          >
            {generating
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Sparkles className="w-4 h-4" />
            }
            {generating ? 'Генерирую…' : hasTopics ? 'Обновить темы' : 'Сгенерировать темы'}
          </button>
        )}
      </div>

      {/* No client brand warning */}
      {!clientBrand && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Клиентский бренд не задан</p>
            <p className="text-xs text-muted-foreground">
              Для генерации тем необходимо указать клиентский бренд в настройках проекта.
            </p>
            <Link
              to="/projects"
              className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:opacity-80 transition-opacity"
            >
              Перейти к настройкам проекта <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Topics */}
      {hasTopics ? (
        <div className="space-y-5">
          {topics.map((t, i) => <TopicCard key={i} topic={t} n={i + 1} />)}
        </div>
      ) : !generating && clientBrand && !error && (
        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-4">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Темы ещё не сгенерированы. Нажмите «Сгенерировать темы», чтобы ИИ проанализировал
            все загруженные данные и подготовил аргументы для встречи с клиентом.
          </span>
        </div>
      )}
    </div>
  );
}
