import { useState, useEffect } from 'react';
import { ChartCard } from '@/components/ChartCard';
import { api } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SlPoint { brand: string; brandName: string; pos: number; neg: number; }
interface SlParam { key: string; label: string; }
interface SlCategory {
  label: string;
  params: SlParam[];
  chartData: Record<string, SlPoint[]>;
}
interface SentimentPoint extends Record<string, string | number> {
  period: string;
  month: string;
}
interface ImagePoint extends Record<string, string | number> {
  label: string;
}
interface PerceptionData {
  generated: string;
  brands: string[];
  brandNames: Record<string, string>;
  sl: Record<string, SlCategory>;
  sentiment: SentimentPoint[];
  imageChars: ImagePoint[];
  matrix: { absolute: ImagePoint[]; median: ImagePoint[] };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PERCEPTION_COLORS: Record<string, string> = {
  Narzan:      'hsl(217, 91%, 60%)',
  Borjomi:     'hsl(142, 76%, 36%)',
  Senezhskaya: 'hsl(38,  92%, 50%)',
  Svyatoy:     'hsl(280, 65%, 60%)',
};

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 11,
};
const axisTick   = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
const axisTickSm = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };

const SL_ORDER = ['assortment', 'price', 'product'] as const;

// ── Sub-components ────────────────────────────────────────────────────────────

function SlChart({ cat }: { cat: SlCategory }) {
  const [active, setActive] = useState('total');
  const data = cat.chartData[active] ?? [];

  return (
    <ChartCard title={cat.label} subtitle="Позитив / Негатив, кол-во упоминаний">
      <div className="flex gap-1 flex-wrap mb-3">
        {cat.params.map((p) => (
          <button
            key={p.key}
            onClick={() => setActive(p.key)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              active === p.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={255}>
        <BarChart data={data} barCategoryGap="22%" barGap={2} margin={{ bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="brandName" tick={{ ...axisTickSm, textAnchor: 'end' }} angle={-30} height={60} interval={0} />
          <YAxis tick={axisTickSm} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="pos" name="Позитив" fill="hsl(142, 72%, 40%)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="neg" name="Негатив" fill="hsl(0, 84%, 60%)"   radius={[2, 2, 0, 0]} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Perception() {
  const { projectId } = useProject();
  const [data, setData] = useState<PerceptionData | null>(null);
  const [matrixMode, setMatrixMode] = useState<'absolute' | 'median'>('absolute');

  useEffect(() => {
    if (projectId === null) return;
    api.getProjectData(projectId, 'perception').then(d => setData(d as PerceptionData)).catch(console.error);
  }, [projectId]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Загрузка данных…
      </div>
    );
  }

  const { brands, brandNames } = data;
  const color = (b: string) => PERCEPTION_COLORS[b] ?? 'hsl(var(--muted-foreground))';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Perception & Social Listening</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Восприятие бренда, имиджевые характеристики, sentiment
        </p>
      </div>

      {/* ── SL Charts ──────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">
        {SL_ORDER.map((key) => (
          <SlChart key={key} cat={data.sl[key]} />
        ))}
      </div>

      {/* ── Sentiment + Image Chars ────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">

        <ChartCard
          title="Динамика sentiment"
          subtitle="(Позитив − Негатив) / (Позитив + Негатив) × 100"
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.sentiment}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={axisTick} />
              <YAxis tick={axisTick} domain={[-100, 100]} tickFormatter={(v: number) => `${v}`} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [`${v.toFixed(1)}`, '']}
              />
              {brands.map((b) => (
                <Line
                  key={b}
                  type="monotone"
                  dataKey={b}
                  name={brandNames[b]}
                  stroke={color(b)}
                  strokeWidth={1.5}
                  dot={{ r: 4 }}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Имиджевые характеристики"
          subtitle="Кол-во упоминаний (абсолют)"
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.imageChars} layout="vertical" barCategoryGap="18%" barGap={1}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={axisTickSm} />
              <YAxis type="category" dataKey="label" tick={axisTickSm} width={88} />
              <Tooltip contentStyle={tooltipStyle} />
              {brands.map((b) => (
                <Bar key={b} dataKey={b} name={brandNames[b]} fill={color(b)} radius={[0, 2, 2, 0]} />
              ))}
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ── Matrix ─────────────────────────────────────────────────────── */}
      <div className="chart-container animate-fade-in">
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h3 className="section-title">Матрица: Бренд × Имидж</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {matrixMode === 'absolute'
                ? 'Кол-во упоминаний (абсолют)'
                : 'Доля упоминаний в сравнении с медианным значением упоминаний между всеми брендами, %'}
            </p>
          </div>
          <div className="inline-flex items-center gap-1 bg-secondary border border-border rounded-md p-1">
            {(['absolute', 'median'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMatrixMode(m)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  matrixMode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'absolute' ? 'Абсолют' : '% к медиане'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left p-2 text-muted-foreground font-medium min-w-[160px]">
                  Характеристика
                </th>
                {brands.map((b) => (
                  <th
                    key={b}
                    className="text-center p-2 font-semibold min-w-[90px]"
                    style={{ color: color(b) }}
                  >
                    {brandNames[b]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.matrix[matrixMode].map((row) => {
                const vals = brands.map((b) => row[b] as number);
                const max = Math.max(...vals);
                const min = Math.min(...vals);
                return (
                  <tr key={row.label} className="border-t border-border">
                    <td className="p-2 text-muted-foreground">{row.label}</td>
                    {brands.map((b) => {
                      const v = row[b] as number;
                      const isMax = v === max && max !== min;
                      const isMin = v === min && max !== min;
                      return (
                        <td key={b} className="text-center p-2">
                          <span
                            className={`font-medium tabular-nums ${
                              isMax
                                ? 'text-emerald-600'
                                : isMin
                                ? 'text-red-500'
                                : 'text-foreground'
                            }`}
                          >
                            {matrixMode === 'absolute'
                              ? v.toLocaleString('ru')
                              : `${v.toFixed(0)}%`}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
