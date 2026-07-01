import { useState, useEffect } from 'react';
import { ChartCard } from '@/components/ChartCard';
import { api } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunnelEntry {
  brand: string;
  brandName: string;
  population: number;
  topOfMind: number;
  spontaneous: number;
  aided: number;
  consumption: number;
  consideration: number;
}

interface BhtData {
  brands: string[];
  brandNames: Record<string, string>;
  currentQuarter: string;
  metricKeys: string[];
  metricLabels: Record<string, string>;
  funnel: Record<string, FunnelEntry[]>;
}

interface SalesData {
  brands: string[];
  marketShare: Array<Record<string, string | number>>;
}

interface AdSpendData {
  brands: string[];
  brandNames: Record<string, string>;
  channels: { total: Array<Record<string, string | number>> };
}

interface PerceptionData {
  brands: string[];
  brandNames: Record<string, string>;
  sentiment: Array<Record<string, string | number>>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OV_COLORS: Record<string, string> = {
  Narzan:      'hsl(217, 91%, 60%)',
  Borjomi:     'hsl(142, 76%, 36%)',
  Senezhskaya: 'hsl(38,  92%, 50%)',
  Svyatoy:     'hsl(280, 65%, 60%)',
};

const STAGE_COLORS = [
  'hsl(217,91%,60%)',
  'hsl(199,89%,48%)',
  'hsl(168,76%,42%)',
  'hsl(38,92%,50%)',
  'hsl(0,84%,60%)',
];

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 11,
};
const axisTick   = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
const axisTickSm = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };

// ── Sub-component ─────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number }) {
  const up = delta >= 0;
  return (
    <span className={`text-[10px] ml-1 tabular-nums ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? '▲' : '▼'}{Math.abs(delta).toFixed(1)}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Overview() {
  const { projectId } = useProject();
  const [bhtData,   setBhtData]   = useState<BhtData | null>(null);
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [adData,    setAdData]    = useState<AdSpendData | null>(null);
  const [perData,   setPerData]   = useState<PerceptionData | null>(null);

  useEffect(() => {
    if (projectId === null) return;
    api.getProjectData(projectId, 'bht').then(d => setBhtData(d as BhtData)).catch(console.error);
    api.getProjectData(projectId, 'sales').then(d => setSalesData(d as SalesData)).catch(console.error);
    api.getProjectData(projectId, 'ad_spend').then(d => setAdData(d as AdSpendData)).catch(console.error);
    api.getProjectData(projectId, 'perception').then(d => setPerData(d as PerceptionData)).catch(console.error);
  }, [projectId]);

  if (!bhtData || !salesData || !adData || !perData) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Загрузка данных…
      </div>
    );
  }

  const BRANDS     = bhtData.brands;
  const brandNames = bhtData.brandNames;

  // ── Derived data ──────────────────────────────────────────────────────────

  const currFunnelArr = bhtData.funnel['Q1 2026'] ?? [];
  const prevFunnelArr = bhtData.funnel['Q4 2025'] ?? [];
  const currFunnel    = Object.fromEntries(currFunnelArr.map(e => [e.brand, e]));
  const prevFunnel    = Object.fromEntries(prevFunnelArr.map(e => [e.brand, e]));

  const lastMarket = salesData.marketShare[salesData.marketShare.length - 1] ?? {};
  const prevMarket = salesData.marketShare[salesData.marketShare.length - 2] ?? {};

  const Q1_MONTHS = new Set(['Янв', 'Фев', 'Мар']);
  const adSpendSum: Record<string, number> = Object.fromEntries(
    BRANDS.map(b => [
      b,
      adData.channels.total
        .filter(row => Q1_MONTHS.has(row.month as string))
        .reduce((s, row) => s + ((row[b] as number) || 0), 0),
    ])
  );

  const lastSentiment = perData.sentiment[perData.sentiment.length - 1] ?? {};
  const prevSentiment = perData.sentiment.length > 1
    ? perData.sentiment[perData.sentiment.length - 2]
    : null;

  // column maxima for scorecard highlight
  const maxAided     = Math.max(...BRANDS.map(b => currFunnel[b]?.aided       ?? 0));
  const maxCons      = Math.max(...BRANDS.map(b => currFunnel[b]?.consumption ?? 0));
  const maxMarket    = Math.max(...BRANDS.map(b => (lastMarket[b]   as number) ?? 0));
  const maxSpend     = Math.max(...BRANDS.map(b => adSpendSum[b]));
  const maxSentiment = Math.max(...BRANDS.map(b => (lastSentiment[b] as number) ?? 0));

  // ── Radar (normalize each axis independently to 0–100) ────────────────────

  type RadarRow = { axis: string } & Record<string, number | string>;

  const rawRadar: RadarRow[] = [
    { axis: 'Знание',      ...Object.fromEntries(BRANDS.map(b => [b, currFunnel[b]?.aided       ?? 0])) },
    { axis: 'Потребление', ...Object.fromEntries(BRANDS.map(b => [b, currFunnel[b]?.consumption ?? 0])) },
    { axis: 'Доля рынка',  ...Object.fromEntries(BRANDS.map(b => [b, (lastMarket[b] as number)  ?? 0])) },
    { axis: 'Медиа',       ...Object.fromEntries(BRANDS.map(b => [b, adSpendSum[b]])) },
    { axis: 'Sentiment',   ...Object.fromEntries(BRANDS.map(b => [b, (lastSentiment[b] as number) ?? 0])) },
  ];

  const radarNorm: RadarRow[] = rawRadar.map(row => {
    const vals = BRANDS.map(b => row[b] as number);
    const max  = Math.max(...vals);
    const r: RadarRow = { axis: row.axis as string };
    BRANDS.forEach(b => { r[b] = max > 0 ? Math.round((row[b] as number) / max * 100) : 0; });
    return r;
  });

  // ── Media vs Consumption ──────────────────────────────────────────────────

  const mediaConsData = BRANDS.map(b => ({
    brandName:   brandNames[b],
    brand:       b,
    adSpend:     Math.round(adSpendSum[b] * 10) / 10,
    consumption: Math.round((currFunnel[b]?.consumption ?? 0) * 10) / 10,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Q1 2026 · Минеральная вода · 4 бренда
        </p>
      </div>

      {/* ── Блок 1: KPI Scorecard ─────────────────────────────────────── */}
      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-foreground">KPI Scorecard</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ключевые метрики · дельта к предыдущему периоду · лидер по каждой метрике выделен
          </p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-y border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium min-w-[150px]">
                Бренд
              </th>
              <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">
                Знание (подсказ.)<br />
                <span className="font-normal text-[10px]">% · BHT Q1 2026</span>
              </th>
              <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">
                Потребление<br />
                <span className="font-normal text-[10px]">% · BHT Q1 2026</span>
              </th>
              <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">
                Доля рынка<br />
                <span className="font-normal text-[10px]">% · апр 2026</span>
              </th>
              <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">
                Рекл. расходы<br />
                <span className="font-normal text-[10px]">млн ₽ · Q1 2026</span>
              </th>
              <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">
                Sentiment<br />
                <span className="font-normal text-[10px]">май 2026</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {BRANDS.map(b => {
              const cf   = currFunnel[b];
              const pf   = prevFunnel[b];
              const ms   = (lastMarket[b]    as number) ?? 0;
              const pms  = (prevMarket[b]    as number) ?? 0;
              const sent = (lastSentiment[b] as number) ?? 0;
              const psent = prevSentiment ? (prevSentiment[b] as number) : null;
              return (
                <tr key={b} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3 font-semibold" style={{ color: OV_COLORS[b] }}>
                    {brandNames[b]}
                  </td>
                  <td className={`text-center px-3 py-3 tabular-nums font-medium ${cf?.aided === maxAided ? 'text-emerald-600' : 'text-foreground'}`}>
                    {cf?.aided.toFixed(1)}%
                    {pf && <DeltaBadge delta={cf.aided - pf.aided} />}
                  </td>
                  <td className={`text-center px-3 py-3 tabular-nums font-medium ${cf?.consumption === maxCons ? 'text-emerald-600' : 'text-foreground'}`}>
                    {cf?.consumption.toFixed(1)}%
                    {pf && <DeltaBadge delta={cf.consumption - pf.consumption} />}
                  </td>
                  <td className={`text-center px-3 py-3 tabular-nums font-medium ${ms === maxMarket ? 'text-emerald-600' : 'text-foreground'}`}>
                    {ms.toFixed(2)}%
                    <DeltaBadge delta={ms - pms} />
                  </td>
                  <td className={`text-center px-3 py-3 tabular-nums font-medium ${adSpendSum[b] === maxSpend ? 'text-emerald-600' : 'text-foreground'}`}>
                    {adSpendSum[b].toFixed(1)}
                  </td>
                  <td className={`text-center px-3 py-3 tabular-nums font-medium ${sent === maxSentiment ? 'text-emerald-600' : 'text-foreground'}`}>
                    {sent.toFixed(1)}
                    {psent != null && <DeltaBadge delta={sent - psent} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Блок 2 + 3: Radar + Funnel ─────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">

        <ChartCard
          title="Brand Radar"
          subtitle="Нормировано к лидеру по каждой оси · Q1 2026"
        >
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarNorm} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="axis" tick={axisTickSm} />
              <PolarRadiusAxis
                domain={[0, 100]}
                tickCount={4}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              />
              {BRANDS.map(b => (
                <Radar
                  key={b}
                  name={brandNames[b]}
                  dataKey={b}
                  stroke={OV_COLORS[b]}
                  fill={OV_COLORS[b]}
                  fillOpacity={0.08}
                  strokeWidth={1.5}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Воронка знания"
          subtitle="% от Total популяции · Q1 2026"
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={currFunnelArr} barCategoryGap="22%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="brandName" tick={axisTickSm} />
              <YAxis tick={axisTick} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [`${v.toFixed(1)}%`, '']}
              />
              {bhtData.metricKeys.map((k, i) => (
                <Bar
                  key={k}
                  dataKey={k}
                  name={bhtData.metricLabels[k]}
                  fill={STAGE_COLORS[i]}
                  radius={[2, 2, 0, 0]}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ── Блок 5: Media vs Consumption ────────────────────────────────── */}
      <ChartCard
        title="Медиаинвестиции vs Потребление"
        subtitle="Рекл. расходы (млн ₽ · янв–мар 2026) и Потребление BHT % · Q1 2026"
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={mediaConsData} barCategoryGap="28%" barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="brandName" tick={axisTick} />
            <YAxis
              yAxisId="spend"
              orientation="left"
              tick={axisTick}
              width={48}
              tickFormatter={(v: number) => `${v}M`}
            />
            <YAxis
              yAxisId="cons"
              orientation="right"
              tick={axisTick}
              width={42}
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number, name: string) =>
                name === 'Рекл. расходы'
                  ? [`${v.toFixed(1)} млн ₽`, name]
                  : [`${v.toFixed(1)}%`, name]
              }
            />
            <Bar
              yAxisId="spend"
              dataKey="adSpend"
              name="Рекл. расходы"
              fill="hsl(217, 91%, 60%)"
              radius={[2, 2, 0, 0]}
              opacity={0.85}
            />
            <Bar
              yAxisId="cons"
              dataKey="consumption"
              name="Потребление BHT"
              fill="hsl(142, 76%, 36%)"
              radius={[2, 2, 0, 0]}
              opacity={0.85}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
