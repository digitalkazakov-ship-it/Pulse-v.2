import { useState, useEffect } from 'react';
import { ChartCard } from '@/components/ChartCard';
import { KpiCard } from '@/components/KpiCard';
import { api } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, AreaChart, Area,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetricRow {
  key: string;
  metric: string;
  mom: number;
  yoy: number;
  trend: Array<Record<string, string | number>>;
  [brand: string]: unknown;
}

interface TrafficSource {
  source: string;
  organic: number;
  paid: number;
  total: number;
}

interface DigitalData {
  generated: string;
  brands: string[];
  brandNames: Record<string, string>;
  metrics: MetricRow[];
  visitsTrend: Array<Record<string, string | number>>;
  trafficSourcesDesktop: Record<string, TrafficSource[]>;
  trafficSourcesMobile: Record<string, TrafficSource[]>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TRAFFIC_ORDER = ['Search', 'Direct', 'Display Ads', 'Referral', 'Social', 'Mail'];
const sortTraffic = (rows: TrafficSource[]) =>
  [...rows].sort(
    (a, b) =>
      (TRAFFIC_ORDER.indexOf(a.source) + 1 || TRAFFIC_ORDER.length + 1) -
      (TRAFFIC_ORDER.indexOf(b.source) + 1 || TRAFFIC_ORDER.length + 1),
  );

const axisTick = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };
const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 11,
};

type TrafficDevice = 'desktop' | 'mobile';

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniTabs<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 bg-secondary border border-border rounded-md p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            value === o.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const DIGITAL_COLORS: Record<string, string> = {
  BrandX: 'hsl(217, 91%, 60%)',
  CompA:  'hsl(142, 76%, 36%)',
  CompB:  'hsl(38,  92%, 50%)',
  CompC:  'hsl(280, 65%, 60%)',
};

export default function DigitalAudit() {
  const { projectId } = useProject();
  const [data, setData] = useState<DigitalData | null>(null);
  const [trafficDevice, setTrafficDevice] = useState<TrafficDevice>('desktop');
  const [trafficBrand, setTrafficBrand] = useState<string>('BrandX');

  useEffect(() => {
    if (projectId === null) return;
    api.getProjectData(projectId, 'digital').then(d => setData(d as DigitalData)).catch(console.error);
  }, [projectId]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Загрузка данных…
      </div>
    );
  }

  const { brands, brandNames, metrics, visitsTrend } = data;
  const trafficByDevice =
    trafficDevice === 'desktop' ? data.trafficSourcesDesktop : data.trafficSourcesMobile;
  const trafficData = sortTraffic(trafficByDevice[trafficBrand] ?? []);

  const brandColor = (b: string) => DIGITAL_COLORS[b] ?? 'hsl(var(--muted-foreground))';
  const brandLabel = (b: string) => brandNames[b] ?? b;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Site stats</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Веб-аналитика, источники трафика, сравнение с конкурентами ·{' '}
          <span className="font-medium">{data.generated}</span>
        </p>
      </div>

      {/* KPI cards with 6-month sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {metrics.map((m) => (
          <div key={m.key} className="chart-container animate-fade-in">
            <KpiCard
              label={m.metric}
              value={m['BrandX'] as number}
              mom={m.mom}
              yoy={m.yoy}
            />
            <div className="mt-3 -mx-2">
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={m.trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`sg-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={brandColor('BrandX')} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={brandColor('BrandX')} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [v, brandLabel('BrandX')]}
                  />
                  <Area
                    type="monotone"
                    dataKey="BrandX"
                    stroke={brandColor('BrandX')}
                    strokeWidth={1.5}
                    fill={`url(#sg-${m.key})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              Последние 6 мес · {brandLabel('BrandX')}
            </p>
          </div>
        ))}
      </div>

      {/* Visits trend — 12 months */}
      <ChartCard title="Monthly Visits" subtitle="Динамика посещений, тыс.">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={visitsTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip contentStyle={tooltipStyle} />
            {brands.map((b) => (
              <Line
                key={b}
                type="monotone"
                dataKey={b}
                name={brandLabel(b)}
                stroke={brandColor(b)}
                strokeWidth={b === 'BrandX' ? 2.5 : 1.5}
                dot={false}
              />
            ))}
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Traffic sources with Brand + Desktop/Mobile tabs */}
      <ChartCard
        title="Источники трафика"
        subtitle={`${brandLabel(trafficBrand)} · визиты · organic vs paid`}
        headerExtra={
          <div className="flex items-center gap-2 flex-wrap">
            <MiniTabs
              options={brands.map((b) => ({ value: b, label: brandLabel(b) }))}
              value={trafficBrand}
              onChange={(v) => setTrafficBrand(v)}
            />
            <MiniTabs
              options={[
                { value: 'desktop', label: 'Desktop' },
                { value: 'mobile',  label: 'Mobile'  },
              ]}
              value={trafficDevice}
              onChange={(v) => setTrafficDevice(v)}
            />
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={trafficData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="source" tick={axisTick} />
            <YAxis tick={axisTick} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="organic" stackId="a" fill="hsl(142,76%,36%)" name="Organic" radius={[0,0,0,0]} />
            <Bar dataKey="paid"    stackId="a" fill="hsl(217,91%,60%)" name="Paid"    radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Comparison table */}
      <ChartCard title="Сравнительная таблица" subtitle="Все метрики по брендам">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left p-3 text-muted-foreground font-medium border-b border-border">
                  Метрика
                </th>
                {brands.map((b) => (
                  <th
                    key={b}
                    className="text-center p-3 font-medium border-b border-border"
                    style={{ color: brandColor(b) }}
                  >
                    {brandLabel(b)}
                  </th>
                ))}
                <th className="text-center p-3 text-muted-foreground font-medium border-b border-border">MoM</th>
                <th className="text-center p-3 text-muted-foreground font-medium border-b border-border">YoY</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const values = brands.map((b) => m[b] as number);
                const maxVal = Math.max(...values);
                const minVal = Math.min(...values);
                const isBounce = m.metric.includes('Bounce');
                return (
                  <tr key={m.metric} className="border-b border-border hover:bg-accent/50 transition-colors">
                    <td className="p-3 text-muted-foreground font-medium">{m.metric}</td>
                    {brands.map((b) => {
                      const val = m[b] as number;
                      const best = isBounce ? val === minVal : val === maxVal;
                      return (
                        <td
                          key={b}
                          className={`text-center p-3 ${best ? 'font-bold text-success' : 'text-foreground'}`}
                        >
                          {val}
                        </td>
                      );
                    })}
                    <td className="text-center p-3">
                      <span className={`flex items-center justify-center gap-1 ${m.mom >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {m.mom >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {m.mom > 0 ? '+' : ''}{m.mom}%
                      </span>
                    </td>
                    <td className="text-center p-3">
                      <span className={`flex items-center justify-center gap-1 ${m.yoy >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {m.yoy >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {m.yoy > 0 ? '+' : ''}{m.yoy}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
