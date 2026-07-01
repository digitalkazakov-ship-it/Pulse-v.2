import { useState, useEffect, useMemo } from 'react';
import { ChartCard } from '@/components/ChartCard';
import { api } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, LabelList,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NeuroSummaryRow {
  brand: string;
  brandName: string;
  googleMentions: number;
  googleTotal: number;
  googleShare: number;
  yandexMentions: number;
  yandexTotal: number;
  yandexShare: number;
}

interface NeuroQueryRow {
  query: string;
  total: number;
  [brand: string]: string | number;
}

interface NeuroData {
  brands: string[];
  brandNames: Record<string, string>;
  summary: NeuroSummaryRow[];
  queries: { google: NeuroQueryRow[]; yandex: NeuroQueryRow[] };
  sources: { site: string; google: number; yandex: number; total: number; brands: string }[];
}

// ── Mineral-water BHT types ───────────────────────────────────────────────────

interface AgeEntry {
  age: string;
  population: number;
  Narzan: number; Borjomi: number; Senezhskaya: number; Svyatoy: number;
  [key: string]: string | number;
}

interface FreqEntry {
  brand: string; brandName: string; population: number; total: number;
  totalDelta?: number;
  daily: number; week23: number; week1: number; month23: number; less: number;
}

type MetricPoint  = Record<string, string | number>;
type FunnelEntry  = Record<string, string | number>;

interface BhtData {
  format?: 'quarterly';
  brands: string[];
  brandNames: Record<string, string>;
  quarters: string[];
  currentQuarter: string;
  metricKeys: string[];
  metricLabels: Record<string, string>;
  metrics: Record<string, MetricPoint[]>;
  funnel: Record<string, FunnelEntry[]>;
  ageGroups: string[];
  freqCats: string[];
  freqLabels: Record<string, string>;
  penetrationByAge: Record<string, AgeEntry[]>;
  frequencyByBrand: Record<string, FreqEntry[]>;
}

// ── Cheese BHT types ──────────────────────────────────────────────────────────

interface CheeseMetricPoint {
  month: string;
  monthLabel: string;
  quarter: string;
  [brand: string]: string | number | null;
}

interface CheesePenEntry {
  label: string;
  [brand: string]: string | (number | null)[];
}

interface CheeseBhtData {
  format: 'monthly';
  generated: string;
  brands: string[];
  brandNames: Record<string, string>;
  metricKeys: string[];
  metricLabels: Record<string, string>;
  metrics: Record<string, CheeseMetricPoint[]>;
  penetration: {
    brands: string[];
    years: number[];
    segments: Record<string, CheesePenEntry[]>;
  };
}

type AnyBhtData = BhtData | CheeseBhtData;

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGE_COLORS = [
  'hsl(217,91%,60%)', 'hsl(199,89%,48%)', 'hsl(168,76%,42%)',
  'hsl(38,92%,50%)',  'hsl(0,84%,60%)',   'hsl(280,65%,60%)',
];

const NEURO_COLORS: Record<string, string> = {
  Narzan:      'hsl(217, 91%, 60%)',
  Borjomi:     'hsl(142, 76%, 36%)',
  Senezhskaya: 'hsl(38,  92%, 50%)',
  Svyatoy:     'hsl(280, 65%, 60%)',
};

const CHEESE_COLORS: Record<string, string> = {
  Belebeyevsky: 'hsl(217, 91%, 60%)',
  Brest:        'hsl(142, 76%, 36%)',
  Lamber:       'hsl(38,  92%, 50%)',
  SeloZelenoe:  'hsl(0,   84%, 60%)',
};

const PELMEN_COLORS: Record<string, string> = {
  GoryachayaShutochka: 'hsl(217, 91%, 60%)',
  Ermolino:            'hsl(142, 76%, 36%)',
  Miratorg:            'hsl(38,  92%, 50%)',
  Caesar:              'hsl(280, 65%, 60%)',
};

const ALL_BRAND_COLORS: Record<string, string> = { ...CHEESE_COLORS, ...PELMEN_COLORS };

// Palette for brand lines in BHT charts (separate from STAGE_COLORS used for metric bars)
const BRAND_PALETTE = [
  'hsl(0,   84%, 60%)',   // red
  'hsl(142, 76%, 36%)',   // green
  'hsl(38,  92%, 50%)',   // orange
  'hsl(217, 91%, 60%)',   // blue (синий)
  'hsl(199, 89%, 48%)',   // cyan
  'hsl(168, 76%, 42%)',   // teal
];

function brandColor(b: string, idx: number = 0): string {
  return ALL_BRAND_COLORS[b] ?? BRAND_PALETTE[idx % BRAND_PALETTE.length];
}

const FREQ_COLORS: Record<string, string> = {
  daily:   'hsl(142, 76%, 36%)',
  week23:  'hsl(199, 89%, 42%)',
  week1:   'hsl(263, 68%, 55%)',
  month23: 'hsl(38,  92%, 50%)',
  less:    'hsl(0,   84%, 60%)',
};

const SEGMENT_LABELS: Record<string, string> = {
  total:           'Total',
  gender:          'Пол',
  age:             'Возраст',
  citySize:        'Размер нас. пункта',
  federalDistrict: 'Федеральный округ',
};

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 11,
};
const axisTick = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

const BHT_QUARTERS = ['Q1 2026', 'Q4 2025', 'Q3 2025', 'Q2 2025'] as const;
type BhtQuarter = typeof BHT_QUARTERS[number];

// ── Sub-components ────────────────────────────────────────────────────────────

function QuarterTabs({ value, onChange }: { value: BhtQuarter; onChange: (v: BhtQuarter) => void }) {
  return (
    <div className="inline-flex items-center gap-1 bg-secondary border border-border rounded-md p-1">
      {BHT_QUARTERS.map((q) => (
        <button
          key={q}
          onClick={() => onChange(q)}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            value === q
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {q}
        </button>
      ))}
    </div>
  );
}

function PeriodToggle({
  value,
  onChange,
}: {
  value: 'monthly' | 'quarterly';
  onChange: (v: 'monthly' | 'quarterly') => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 bg-secondary border border-border rounded-md p-1">
      {(['monthly', 'quarterly'] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            value === mode
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {mode === 'monthly' ? 'Месяц' : 'Квартал'}
        </button>
      ))}
    </div>
  );
}

function NeuroShareBars({ summary, engine }: {
  summary: NeuroSummaryRow[];
  engine: 'google' | 'yandex';
}) {
  const shareKey = engine === 'google' ? 'googleShare' : 'yandexShare';
  const mentKey  = engine === 'google' ? 'googleMentions' : 'yandexMentions';
  const totKey   = engine === 'google' ? 'googleTotal' : 'yandexTotal';
  const sorted = [...summary].sort((a, b) => b[shareKey] - a[shareKey]);
  const max = Math.max(...sorted.map((d) => d[shareKey]), 1);
  return (
    <div className="space-y-2">
      {sorted.map((row, i) => (
        <div key={row.brand} className="flex items-center gap-3">
          <span className="text-xs font-medium w-28 shrink-0 truncate"
            style={{ color: NEURO_COLORS[row.brand] ?? STAGE_COLORS[i % STAGE_COLORS.length] }}>
            {row.brandName}
          </span>
          <div className="flex-1 bg-muted/40 rounded-sm h-6 relative overflow-hidden">
            <div className="h-full rounded-sm transition-all duration-500"
              style={{
                width: `${(row[shareKey] / max) * 100}%`,
                background: NEURO_COLORS[row.brand] ?? STAGE_COLORS[i % STAGE_COLORS.length],
              }} />
          </div>
          <span className="text-xs font-mono tabular-nums text-foreground w-28 text-right shrink-0">
            {row[shareKey].toFixed(1)}% ({row[mentKey]}/{row[totKey]})
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Cheese helpers ────────────────────────────────────────────────────────────

function aggregateToQuarterly(
  series: CheeseMetricPoint[],
  brands: string[],
): Array<Record<string, string | number | null>> {
  const buckets = new Map<string, CheeseMetricPoint[]>();
  for (const pt of series) {
    const arr = buckets.get(pt.quarter) ?? [];
    arr.push(pt);
    buckets.set(pt.quarter, arr);
  }
  const quarters = [...new Set(series.map((p) => p.quarter))];
  return quarters.map((q) => {
    const pts = buckets.get(q) ?? [];
    const entry: Record<string, string | number | null> = { quarter: q };
    for (const brand of brands) {
      const vals = pts
        .map((p) => p[brand])
        .filter((v): v is number => typeof v === 'number');
      entry[brand] = vals.length > 0
        ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
        : null;
    }
    return entry;
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BrandAwareness() {
  const { projectId } = useProject();

  // Neuro / Wordstat state
  const [neuroEngine, setNeuroEngine] = useState<'google' | 'yandex'>('google');
  const [neuroApiData, setNeuroApiData] = useState<NeuroData | null>(null);
  const [wordstatData, setWordstatData] = useState<{
    brands: string[];
    brandNames: Record<string, string>;
    series: Array<Record<string, string | number>>;
  } | null>(null);

  // BHT state (union of mineral-water and cheese formats)
  const [bhtData, setBhtData] = useState<AnyBhtData | null>(null);

  // Mineral-water BHT state
  const [ageQ, setAgeQ] = useState<BhtQuarter>('Q1 2026');
  const [freqQ, setFreqQ] = useState<BhtQuarter>('Q1 2026');
  const [funnelQ, setFunnelQ] = useState<BhtQuarter>('Q1 2026');

  // Cheese BHT state
  const [periodMode, setPeriodMode] = useState<'monthly' | 'quarterly'>('monthly');
  const [funnelPeriodMode, setFunnelPeriodMode] = useState<'monthly' | 'quarterly'>('monthly');
  const [funnelPeriod, setFunnelPeriod] = useState<string>('');
  const [penYear, setPenYear] = useState<number>(2025);
  const [penSegment, setPenSegment] = useState<string>('total');

  useEffect(() => {
    if (projectId === null) return;
    api.getProjectData(projectId, 'neuro').then((d) => setNeuroApiData(d as NeuroData)).catch(console.error);
    api.getProjectData(projectId, 'wordstat').then((d) => setWordstatData(d as typeof wordstatData)).catch(console.error);
    api.getProjectData(projectId, 'bht').then((d) => {
      const data = d as AnyBhtData;
      setBhtData(data);
      if (data.format === 'monthly') {
        const cd = data as CheeseBhtData;
        const series = cd.metrics[cd.metricKeys[0]] ?? [];
        setFunnelPeriod(series[series.length - 1]?.month ?? '');
        const years = cd.penetration.years;
        setPenYear(years[years.length - 1] ?? 2025);
      }
    }).catch(console.error);
  }, [projectId]);

  const isCheese = bhtData?.format === 'monthly';
  const cheeseData = isCheese ? (bhtData as CheeseBhtData) : null;
  const mineralData = !isCheese ? (bhtData as BhtData | null) : null;

  const kFmt = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`;

  // ── Mineral-water helpers ──────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeDeltaLabel = (brand: string, data: AgeEntry[]) => (props: any) => {
    const { x = 0, y = 0, width = 0, value, index = 0 } = props;
    if (!value) return null;
    const delta = (data[index] as Record<string, number>)[`${brand}Delta`];
    if (delta == null) return null;
    const up = delta >= 0;
    return (
      <text x={x + width / 2} y={y - 3} textAnchor="middle" fontSize={8}
        fill={up ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'}>
        {up ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}
      </text>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeFreqDeltaLabel = (data: FreqEntry[]) => (props: any) => {
    const { x = 0, y = 0, width = 0, index = 0 } = props;
    const entry = data[index];
    const delta = entry?.totalDelta;
    if (delta == null) return null;
    const up = delta >= 0;
    return (
      <text x={x + width / 2} y={y - 3} textAnchor="middle" fontSize={9}
        fill={up ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'}>
        {up ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}
      </text>
    );
  };

  // ── Cheese helpers ─────────────────────────────────────────────────────────

  const funnelPeriods = useMemo(() => {
    if (!cheeseData) return [];
    const series = cheeseData.metrics[cheeseData.metricKeys[0]] ?? [];
    if (funnelPeriodMode === 'monthly') {
      return [...series].reverse().map((p) => ({ value: p.month, label: p.monthLabel }));
    }
    const seen = new Set<string>();
    const result: { value: string; label: string }[] = [];
    for (const p of [...series].reverse()) {
      if (!seen.has(p.quarter)) {
        seen.add(p.quarter);
        result.push({ value: p.quarter, label: p.quarter });
      }
    }
    return result;
  }, [cheeseData, funnelPeriodMode]);

  const handleFunnelModeChange = (mode: 'monthly' | 'quarterly') => {
    setFunnelPeriodMode(mode);
    if (!cheeseData) return;
    const series = cheeseData.metrics[cheeseData.metricKeys[0]] ?? [];
    if (mode === 'monthly') {
      setFunnelPeriod(series[series.length - 1]?.month ?? '');
    } else {
      const qtrs = [...new Set(series.map((p) => p.quarter))];
      setFunnelPeriod(qtrs[qtrs.length - 1] ?? '');
    }
  };

  const cheeseFunnelData = useMemo(() => {
    if (!cheeseData || !funnelPeriod) return [];
    return cheeseData.brands.map((brand) => {
      const entry: Record<string, string | number> = {
        brand,
        brandName: cheeseData.brandNames[brand],
      };
      for (const key of cheeseData.metricKeys) {
        const series = cheeseData.metrics[key];
        if (funnelPeriodMode === 'monthly') {
          const pt = series.find((p) => p.month === funnelPeriod);
          entry[key] = (pt?.[brand] as number) ?? 0;
        } else {
          const pts = series.filter((p) => p.quarter === funnelPeriod);
          const vals = pts
            .map((p) => p[brand])
            .filter((v): v is number => typeof v === 'number');
          entry[key] = vals.length > 0
            ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
            : 0;
        }
      }
      return entry;
    });
  }, [cheeseData, funnelPeriod, funnelPeriodMode]);

  const cheesePenData = useMemo(() => {
    if (!cheeseData) return [];
    const yearIdx = cheeseData.penetration.years.indexOf(penYear);
    const segRows = cheeseData.penetration.segments[penSegment] ?? [];
    return segRows.map((entry) => {
      const row: Record<string, string | number | null> = { label: entry.label as string };
      for (const brand of cheeseData.brands) {
        const vals = entry[brand] as (number | null)[];
        row[brand] = yearIdx >= 0 && vals ? vals[yearIdx] : null;
      }
      return row;
    });
  }, [cheeseData, penYear, penSegment]);

  const brands       = mineralData?.brands       ?? [];
  const brandNames   = mineralData?.brandNames   ?? {};
  const metricKeys   = mineralData?.metricKeys   ?? [];
  const metricLabels = mineralData?.metricLabels ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Brand Awareness</h1>
        <p className="text-sm text-muted-foreground mt-1">BHT, Wordstat, пенетрация и частота потребления</p>
      </div>

      {/* ══ CHEESE FORMAT ════════════════════════════════════════════════════════ */}
      {isCheese && cheeseData && (
        <>
          {/* Period toggle for all 6 line charts */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Период графиков:</span>
            <PeriodToggle value={periodMode} onChange={setPeriodMode} />
          </div>

          {/* 6 line charts in 3×2 grid */}
          <div className="grid lg:grid-cols-3 gap-4">
            {cheeseData.metricKeys.map((key) => {
              const raw = cheeseData.metrics[key] ?? [];
              const data = periodMode === 'monthly'
                ? raw
                : aggregateToQuarterly(raw, cheeseData.brands);
              const xKey = periodMode === 'monthly' ? 'monthLabel' : 'quarter';
              return (
                <ChartCard key={key} title={cheeseData.metricLabels[key]} subtitle="%">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey={xKey}
                        tick={{ ...axisTick, angle: -30, textAnchor: 'end' } as object}
                        interval={periodMode === 'monthly' ? 4 : 0}
                        height={45}
                      />
                      <YAxis tick={axisTick} unit="%" width={40} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: number, name: string) => [`${v}%`, name]}
                      />
                      {cheeseData.brands.map((b, i) => (
                        <Line
                          key={b}
                          type="monotone"
                          dataKey={b}
                          name={cheeseData.brandNames[b]}
                          stroke={brandColor(b, i)}
                          strokeWidth={1.5}
                          dot={false}
                          connectNulls={false}
                        />
                      ))}
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              );
            })}
          </div>

          {/* Cheese funnel */}
          <ChartCard
            title="Воронка конверсии знания"
            subtitle={`% · ${funnelPeriods.find((p) => p.value === funnelPeriod)?.label ?? funnelPeriod}`}
            headerExtra={
              <div className="flex items-center gap-2">
                <PeriodToggle value={funnelPeriodMode} onChange={handleFunnelModeChange} />
                <select
                  value={funnelPeriod}
                  onChange={(e) => setFunnelPeriod(e.target.value)}
                  className="text-xs bg-secondary border border-border rounded px-2 py-1.5 text-foreground"
                >
                  {funnelPeriods.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={cheeseFunnelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="brandName" tick={axisTick} />
                <YAxis tick={axisTick} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
                />
                {cheeseData.metricKeys.map((k, i) => (
                  <Bar key={k} dataKey={k} name={cheeseData.metricLabels[k]} fill={STAGE_COLORS[i]} radius={[3, 3, 0, 0]} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Penetration */}
          <ChartCard
            title="Пенетрация"
            subtitle={`Потребление, % · ${penYear}`}
            headerExtra={
              <div className="flex items-center gap-2 flex-wrap">
                {/* Segment switcher */}
                <div className="inline-flex items-center gap-1 bg-secondary border border-border rounded-md p-1">
                  {Object.entries(SEGMENT_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setPenSegment(key)}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        penSegment === key
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* Year picker */}
                <div className="inline-flex items-center gap-1 bg-secondary border border-border rounded-md p-1">
                  {cheeseData.penetration.years.map((y) => (
                    <button
                      key={y}
                      onClick={() => setPenYear(y)}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        penYear === y
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={cheesePenData} barCategoryGap="20%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ ...axisTick, angle: -20, textAnchor: 'end' } as object}
                  interval={0}
                  height={50}
                />
                <YAxis tick={axisTick} unit="%" domain={[0, 100]} width={40} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, name: string) => [`${v?.toFixed(1) ?? '—'}%`, name]}
                />
                {cheeseData.brands.map((b, i) => (
                  <Bar key={b} dataKey={b} name={cheeseData.brandNames[b]} fill={brandColor(b, i)} radius={[2, 2, 0, 0]} />
                ))}
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}

      {/* ══ MINERAL-WATER FORMAT ═════════════════════════════════════════════════ */}
      {!isCheese && (
        <>
          {/* 5 BHT line charts */}
          <div className="grid lg:grid-cols-3 gap-4">
            {([
              { key: 'topOfMind',   title: 'Первое упоминание',  subtitle: 'Тыс. чел · BHT' },
              { key: 'spontaneous', title: 'Спонтанное знание',   subtitle: 'Тыс. чел · BHT' },
              { key: 'aided',       title: 'Подсказанное знание', subtitle: 'Тыс. чел · BHT' },
            ] as const).map(({ key, title, subtitle }) => (
              <ChartCard key={key} title={title} subtitle={subtitle}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={mineralData?.metrics[key] ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="quarter" tick={axisTick} />
                    <YAxis tick={axisTick} tickFormatter={kFmt} width={44} />
                    <Tooltip contentStyle={tooltipStyle}
                      formatter={(v: number, name: string) => [`${v.toLocaleString('ru')} тыс.`, name]} />
                    {brands.map((b) => (
                      <Line key={b} type="monotone" dataKey={b} name={brandNames[b]}
                        stroke={NEURO_COLORS[b]} strokeWidth={1.5} dot={{ r: 4 }} connectNulls={false} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {([
              { key: 'consideration', title: 'Рассмотрение к покупке', subtitle: 'Тыс. чел · BHT' },
              { key: 'consumption',   title: 'Потребление',             subtitle: 'Тыс. чел · BHT' },
            ] as const).map(({ key, title, subtitle }) => (
              <ChartCard key={key} title={title} subtitle={subtitle}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={mineralData?.metrics[key] ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="quarter" tick={axisTick} />
                    <YAxis tick={axisTick} tickFormatter={kFmt} width={44} />
                    <Tooltip contentStyle={tooltipStyle}
                      formatter={(v: number, name: string) => [`${v.toLocaleString('ru')} тыс.`, name]} />
                    {brands.map((b) => (
                      <Line key={b} type="monotone" dataKey={b} name={brandNames[b]}
                        stroke={NEURO_COLORS[b]} strokeWidth={1.5} dot={{ r: 4 }} connectNulls={false} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            ))}
          </div>

          {/* Воронка конверсии знания */}
          <ChartCard
            title="Воронка конверсии знания"
            subtitle={`% от Total популяции · ${funnelQ}`}
            headerExtra={<QuarterTabs value={funnelQ} onChange={setFunnelQ} />}
          >
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={mineralData?.funnel[funnelQ] ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="brandName" tick={axisTick} />
                <YAxis tick={axisTick} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`, '']} />
                {metricKeys.map((k, i) => (
                  <Bar key={k} dataKey={k} name={metricLabels[k] ?? k} fill={STAGE_COLORS[i]} radius={[3, 3, 0, 0]} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Пенетрация по возрастам */}
          {mineralData && (
            <ChartCard
              title="Пенетрация по возрастам"
              subtitle={`Потребление, тыс. чел · ${ageQ}`}
              headerExtra={<QuarterTabs value={ageQ} onChange={setAgeQ} />}
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={mineralData.penetrationByAge[ageQ] ?? []}
                  barCategoryGap="18%"
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="age" tick={axisTick} />
                  <YAxis tick={axisTick} tickFormatter={kFmt} width={44} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, name: string) => [`${v.toLocaleString('ru')} тыс.`, name]}
                  />
                  <Bar dataKey="population" name="Популяция" fill="hsl(0, 0%, 83%)" radius={[2, 2, 0, 0]} />
                  {mineralData.brands.map((b) => (
                    <Bar key={b} dataKey={b} name={mineralData.brandNames[b]} fill={NEURO_COLORS[b]} radius={[2, 2, 0, 0]}>
                      {ageQ === mineralData.currentQuarter && (
                        <LabelList content={makeDeltaLabel(b, mineralData.penetrationByAge[ageQ] ?? [])} />
                      )}
                    </Bar>
                  ))}
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Частота потребления */}
          {mineralData && (
            <ChartCard
              title="Частота потребления"
              subtitle={`Потребление по частоте, тыс. чел · ${freqQ}`}
              headerExtra={<QuarterTabs value={freqQ} onChange={setFreqQ} />}
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={mineralData.frequencyByBrand[freqQ] ?? []}
                  barCategoryGap="22%"
                  barGap={3}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="brandName" tick={axisTick} />
                  <YAxis tick={axisTick} tickFormatter={kFmt} width={44} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, name: string) => [`${v.toLocaleString('ru')} тыс.`, name]}
                  />
                  <Bar dataKey="population" name="Популяция" fill="hsl(0, 0%, 83%)" radius={[2, 2, 0, 0]} />
                  {mineralData.freqCats.map((cat, i) => {
                    const isLast = i === mineralData.freqCats.length - 1;
                    const freqData = mineralData.frequencyByBrand[freqQ] ?? [];
                    return (
                      <Bar
                        key={cat}
                        dataKey={cat}
                        name={mineralData.freqLabels[cat]}
                        stackId="freq"
                        fill={FREQ_COLORS[cat]}
                        radius={isLast ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                      >
                        {freqQ === mineralData.currentQuarter && isLast && (
                          <LabelList content={makeFreqDeltaLabel(freqData)} />
                        )}
                      </Bar>
                    );
                  })}
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}

      {/* ══ WORDSTAT + NEURO (always shown) ══════════════════════════════════════ */}

      <ChartCard title="Яндекс Wordstat" subtitle="Брендовые запросы">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={wordstatData?.series ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => v.toLocaleString('ru')} width={60} />
            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => v.toLocaleString('ru')} />
            {(wordstatData?.brands ?? []).map((b, i) => (
              <Line key={b} type="monotone" dataKey={b}
                name={wordstatData?.brandNames[b] ?? b}
                stroke={NEURO_COLORS[b] ?? STAGE_COLORS[i % STAGE_COLORS.length]}
                strokeWidth={1.5} dot={false} />
            ))}
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="chart-container animate-fade-in">
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h3 className="section-title">Видимость брендов в нейроответах</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Доля упоминаний бренда в ответах ИИ (упом. / всего ответов)</p>
          </div>
          <div className="inline-flex items-center gap-1 bg-secondary border border-border rounded-md p-1">
            {(['google', 'yandex'] as const).map((eng) => (
              <button key={eng} onClick={() => setNeuroEngine(eng)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  neuroEngine === eng ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {eng === 'google' ? 'Google AI' : 'Яндекс Нейро'}
              </button>
            ))}
          </div>
        </div>
        {neuroApiData?.summary?.length ? (
          <>
            <NeuroShareBars summary={neuroApiData.summary} engine={neuroEngine} />
            {neuroApiData.queries[neuroEngine]?.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold mb-3">По запросам</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">Запрос</th>
                        {neuroApiData.brands.map((b) => (
                          <th key={b} className="text-center py-1.5 px-2 font-medium text-muted-foreground">
                            {neuroApiData.brandNames[b]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {neuroApiData.queries[neuroEngine].map((row) => (
                        <tr key={row.query} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-1.5 pr-4 text-foreground">{row.query}</td>
                          {neuroApiData.brands.map((b) => {
                            const v = row[b] as number ?? 0;
                            return (
                              <td key={b} className="text-center py-1.5 px-2">
                                {v > 0 ? (
                                  <span className="font-semibold text-foreground">
                                    {v}<span className="text-muted-foreground font-normal">/{row.total}</span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Данные не загружены</p>
        )}
      </div>
    </div>
  );
}
