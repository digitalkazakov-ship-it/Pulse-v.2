import { useState, useEffect } from 'react';
import { ChartCard } from '@/components/ChartCard';
import { api } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SalesData {
  generated: string;
  brands: string[];
  brandNames: Record<string, string>;
  salesIndex:   Array<Record<string, string | number>>;
  salesYoY:     Array<Record<string, string | number>>;
  marketShare:  Array<Record<string, string | number>>;
  price:        Array<Record<string, string | number>>;
  distribution: Array<Record<string, string | number>>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BRAND_PALETTE = [
  'hsl(0,   84%, 60%)',
  'hsl(142, 76%, 36%)',
  'hsl(38,  92%, 50%)',
  'hsl(217, 91%, 60%)',
  'hsl(199, 89%, 48%)',
  'hsl(168, 76%, 42%)',
  'hsl(280, 65%, 60%)',
  'hsl(45,  95%, 50%)',
  'hsl(330, 80%, 60%)',
  'hsl(20,  90%, 55%)',
];

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 11,
};
const axisTick   = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
const axisTickSm = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function yearFromLabel(month: string): number {
  const m = month.match(/'(\d{2})$/);
  return m ? 2000 + parseInt(m[1], 10) : 0;
}

function YearTabs({ years, value, onChange }: {
  years: number[];
  value: number | null;
  onChange: (y: number | null) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 bg-secondary border border-border rounded-md p-1">
      <button
        onClick={() => onChange(null)}
        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
          value === null
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Все
      </button>
      {years.map(y => (
        <button
          key={y}
          onClick={() => onChange(y)}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            value === y
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Sales() {
  const { projectId } = useProject();
  const [data, setData]   = useState<SalesData | null>(null);
  const [year, setYear]   = useState<number | null>(null);

  useEffect(() => {
    if (projectId === null) return;
    api.getProjectData(projectId, 'sales').then(d => setData(d as SalesData)).catch(console.error);
  }, [projectId]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Загрузка данных…
      </div>
    );
  }

  const { brands, brandNames } = data;

  // Brand whose display name looks like a category aggregate — exclude from share/distribution
  const isCatBrand = (b: string) => {
    const name = (brandNames[b] ?? b).toLowerCase();
    return name.includes('полутвердый') || name.includes('категори') || b === 'Category';
  };
  const brandCompetitors = brands.filter(b => !isCatBrand(b));

  const color = (b: string) => BRAND_PALETTE[brands.indexOf(b) % BRAND_PALETTE.length];
  const label = (b: string) => brandNames[b] ?? b;

  // Year switcher
  const allYears = [...new Set(
    data.salesIndex.map(pt => yearFromLabel(pt.month as string)).filter(Boolean)
  )].sort() as number[];

  const byYear = <T extends Record<string, string | number>>(series: T[]) =>
    year === null ? series : series.filter(pt => yearFromLabel(pt.month as string) === year);

  const yearTabs = <YearTabs years={allYears} value={year} onChange={setYear} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sales</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Продажи, доля рынка, цена и офлайн-дистрибуция
        </p>
      </div>

      {/* ── Индекс продаж ─────────────────────────────────────────────── */}
      <ChartCard
        title="Индекс продаж"
        subtitle="Объём продаж (уп.) / средний объём категории 2020"
        headerExtra={yearTabs}
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byYear(data.salesIndex)} barCategoryGap="18%" barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={axisTick} />
            <YAxis tick={axisTick} tickFormatter={(v: number) => v.toFixed(3)} width={50} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number) => [v.toFixed(5), '']}
            />
            <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeOpacity={0.35} strokeWidth={1} />
            {brands.map(b => (
              <Bar key={b} dataKey={b} name={label(b)} fill={color(b)} radius={[2, 2, 0, 0]} />
            ))}
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Динамика продаж YoY ───────────────────────────────────────── */}
      <ChartCard
        title="Динамика продаж"
        subtitle="Год к году, % (объём в штуках)"
        headerExtra={yearTabs}
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byYear(data.salesYoY)} barCategoryGap="18%" barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={axisTick} />
            <YAxis
              tick={axisTick}
              tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
              width={52}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number) => [`${v > 0 ? '+' : ''}${v.toFixed(1)}%`, '']}
            />
            <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeOpacity={0.35} strokeWidth={1} />
            {brands.map(b => (
              <Bar key={b} dataKey={b} name={label(b)} fill={color(b)} radius={[2, 2, 0, 0]} />
            ))}
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── 3 line charts ─────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">

        <ChartCard title="Доля в категории" subtitle="По объёму продаж, %" headerExtra={yearTabs}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={byYear(data.marketShare)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={axisTickSm} />
              <YAxis
                tick={axisTickSm}
                tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                width={42}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [`${v.toFixed(2)}%`, '']}
              />
              {brandCompetitors.map(b => (
                <Line
                  key={b}
                  type="monotone"
                  dataKey={b}
                  name={label(b)}
                  stroke={color(b)}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Цена бренда" subtitle="Средняя цена, ₽" headerExtra={yearTabs}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={byYear(data.price)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={axisTickSm} />
              <YAxis
                tick={axisTickSm}
                tickFormatter={(v: number) => `${v.toFixed(0)}₽`}
                width={42}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [`${v.toFixed(2)} ₽`, '']}
              />
              {brands.map(b => (
                <Line
                  key={b}
                  type="monotone"
                  dataKey={b}
                  name={label(b)}
                  stroke={color(b)}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Офлайн-дистрибуция" subtitle="Нумерическая, %" headerExtra={yearTabs}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={byYear(data.distribution)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={axisTickSm} />
              <YAxis
                tick={axisTickSm}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                width={38}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [`${v.toFixed(2)}%`, '']}
              />
              {brandCompetitors.map(b => (
                <Line
                  key={b}
                  type="monotone"
                  dataKey={b}
                  name={label(b)}
                  stroke={color(b)}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>
    </div>
  );
}
