import { useState, useEffect, Fragment } from 'react';
import { api } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import { ChevronRight } from 'lucide-react';
import { ChartCard } from '@/components/ChartCard';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter, LineChart, Line,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChannelCount { image: number; promo: number; product: number; }

interface MonitoringRow {
  brand: string;
  brandName: string;
  tv: ChannelCount;
  radio: ChannelCount;
  outdoor: ChannelCount;
  digital: ChannelCount;
}

interface CreativesData {
  generated: string;
  brands: string[];
  brandNames: Record<string, string>;
  monitoring: MonitoringRow[];
  stories: Record<string, Record<string, string[]>>;
}

interface AdSpendData {
  generated: string;
  brands: string[];
  brandNames: Record<string, string>;
  channels: Record<string, Array<Record<string, string | number>>>;
}

interface SalesIndexData {
  brands: string[];
  salesIndex: Array<Record<string, string | number>>;
}

interface ScatterPoint {
  brand: string;
  brandName: string;
  month: string;
  mediaSpend: number;
  salesVolume: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

type Channel = 'tv' | 'radio' | 'outdoor' | 'digital';
const CHANNEL_LABELS: Record<Channel, string> = {
  tv: 'ТВ', radio: 'Радио', outdoor: 'Наружка', digital: 'Digital OLV',
};
const CHANNELS = Object.keys(CHANNEL_LABELS) as Channel[];

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

const BRAND_COLOR_OVERRIDES: Record<string, string> = {
  'Biberland':   'hsl(0, 0%, 58%)',
  'SupremeСыр': 'hsl(0, 0%, 12%)',
};

function brandColor(idx: number, brandKey?: string): string {
  if (brandKey && BRAND_COLOR_OVERRIDES[brandKey]) return BRAND_COLOR_OVERRIDES[brandKey];
  return idx >= 0 ? BRAND_PALETTE[idx % BRAND_PALETTE.length] : 'hsl(var(--muted-foreground))';
}

type AdChannel = 'total' | 'tv' | 'radio' | 'outdoor' | 'digital';
const AD_CHANNEL_TABS: { value: AdChannel; label: string }[] = [
  { value: 'total',   label: 'Тотал' },
  { value: 'tv',      label: 'ТВ' },
  { value: 'radio',   label: 'Радио' },
  { value: 'outdoor', label: 'Наружная реклама' },
  { value: 'digital', label: 'Digital OLV' },
];

const thCell = 'text-center p-2 text-[10px] text-muted-foreground font-normal border-b border-border';

function topStories(stories: string[], n = 3): { text: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of stories) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([text, count]) => ({ text, count }));
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MediaCreatives() {
  const { projectId } = useProject();
  const [expanded, setExpanded] = useState<{ brand: string; channel: Channel } | null>(null);
  const [adChannel, setAdChannel] = useState<AdChannel>('total');
  const [cData, setCData] = useState<CreativesData | null>(null);
  const [adData, setAdData] = useState<AdSpendData | null>(null);
  const [salesData, setSalesData] = useState<SalesIndexData | null>(null);

  useEffect(() => {
    if (projectId === null) return;
    api.getProjectData(projectId, 'creatives').then(d => setCData(d as CreativesData)).catch(console.error);
    api.getProjectData(projectId, 'ad_spend').then(d => setAdData(d as AdSpendData)).catch(console.error);
    api.getProjectData(projectId, 'sales').then(d => setSalesData(d as SalesIndexData)).catch(console.error);
  }, [projectId]);

  const scatterData: ScatterPoint[] = (() => {
    if (!adData || !salesData) return [];
    const salesMap = new Map(salesData.salesIndex.map((r) => [r.month as string, r]));
    const points: ScatterPoint[] = [];
    for (const row of adData.channels.total) {
      const month = row.month as string;
      const salesRow = salesMap.get(month);
      if (!salesRow) continue;
      for (const brand of adData.brands) {
        points.push({
          brand,
          brandName: adData.brandNames[brand],
          month,
          mediaSpend:  row[brand]     as number,
          salesVolume: salesRow[brand] as number,
        });
      }
    }
    return points;
  })();

  const toggle = (brand: string, channel: Channel) =>
    setExpanded((cur) =>
      cur?.brand === brand && cur.channel === channel ? null : { brand, channel },
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Media & Creatives</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Рекламные расходы, медиа-давление и мониторинг креативов
        </p>
      </div>

      {/* ── Рекламные расходы ─────────────────────────────────────────── */}
      <ChartCard
        title="Рекламные расходы"
        subtitle="Последние 6 месяцев, млн ₽"
        headerExtra={
          <div className="inline-flex items-center gap-1 bg-secondary border border-border rounded-md p-1">
            {AD_CHANNEL_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setAdChannel(t.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  adChannel === t.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      >
        {!adData ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
            Загрузка данных…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={adData.channels[adChannel]}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              {adData.brands.map((b, i) => (
                <Line
                  key={b}
                  type="monotone"
                  dataKey={b}
                  name={adData.brandNames[b]}
                  stroke={brandColor(i, b)}
                  strokeWidth={1.5}
                  dot={{ r: 3 }}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Media Spend vs Sales ──────────────────────────────────────── */}
      <ChartCard title="Media Spend vs Sales" subtitle="Рекламные расходы (млн ₽) vs индекс продаж · дек 2025 – апр 2026">
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              dataKey="mediaSpend"
              name="Рекл. расходы"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              label={{
                value: 'Рекл. расходы (млн ₽)',
                position: 'bottom',
                fontSize: 11,
                fill: 'hsl(var(--muted-foreground))',
              }}
            />
            <YAxis
              type="number"
              dataKey="salesVolume"
              name="Индекс продаж"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              width={52}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 11,
              }}
              formatter={(v: number, name: string) =>
                name === 'Рекл. расходы'
                  ? [`${v.toFixed(2)} млн ₽`, name]
                  : [`${v.toFixed(5)}`, name]
              }
              labelFormatter={(_, payload) => payload?.[0]?.payload?.month ?? ''}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {adData?.brands.map((b, i) => (
              <Scatter
                key={b}
                name={adData.brandNames[b]}
                data={scatterData.filter((d) => d.brand === b)}
                fill={brandColor(i, b)}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Мониторинг креативов ──────────────────────────────────────── */}
      <ChartCard
        title="Мониторинг креативов"
        subtitle={`Имидж / промо / продукт по каналам · ${cData ? cData.generated : '…'}`}
      >
        {!cData ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
            Загрузка данных…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="text-left p-3 text-muted-foreground font-medium border-b border-border align-bottom"
                  >
                    Бренд
                  </th>
                  {CHANNELS.map((c) => (
                    <th
                      key={c}
                      colSpan={3}
                      className="text-center p-2 text-muted-foreground font-medium border-b border-border"
                    >
                      {CHANNEL_LABELS[c]}
                    </th>
                  ))}
                  <th
                    rowSpan={2}
                    className="text-center p-3 text-muted-foreground font-medium border-b border-border align-bottom"
                  >
                    Всего
                  </th>
                </tr>
                <tr>
                  {CHANNELS.map((c) => (
                    <Fragment key={c}>
                      <th className={thCell}>имидж</th>
                      <th className={thCell}>промо</th>
                      <th className={thCell}>продукт</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cData.monitoring.map((row) => {
                  const total = CHANNELS.reduce(
                    (s, c) => s + row[c].image + row[c].promo + row[c].product,
                    0,
                  );
                  return (
                    <tr
                      key={row.brand}
                      className="border-b border-border hover:bg-accent/50 transition-colors"
                    >
                      <td
                        className="p-3 font-medium"
                        style={{ color: brandColor(cData.brands.indexOf(row.brand), row.brand) }}
                      >
                        {row.brandName}
                      </td>
                      {CHANNELS.map((c) => (
                        <Fragment key={c}>
                          <td className="text-center p-2 text-foreground">
                            {row[c].image || '—'}
                          </td>
                          <td className="text-center p-2 text-muted-foreground">
                            {row[c].promo || '—'}
                          </td>
                          <td className="text-center p-2 text-muted-foreground">
                            {row[c].product || '—'}
                          </td>
                        </Fragment>
                      ))}
                      <td className="text-center p-3 font-bold text-foreground">
                        {total || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      {/* ── Сюжеты креативов ─────────────────────────────────────────── */}
      <ChartCard
        title="Сюжеты креативов"
        subtitle="Раскройте бренд и канал, чтобы увидеть описание креативов"
      >
        {!cData ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
            Загрузка данных…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left p-3 text-muted-foreground font-medium border-b border-border">
                    Бренд
                  </th>
                  {CHANNELS.map((c) => (
                    <th
                      key={c}
                      className="text-center p-3 text-muted-foreground font-medium border-b border-border"
                    >
                      {CHANNEL_LABELS[c]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cData.monitoring.map((row) => {
                  const brandStories = cData.stories[row.brand] ?? {};
                  const isOpenRow = expanded?.brand === row.brand;
                  const openChannel = isOpenRow ? expanded!.channel : null;
                  const openStories = openChannel ? (brandStories[openChannel] ?? []) : [];
                  return (
                    <Fragment key={row.brand}>
                      <tr className="border-b border-border">
                        <td
                          className="p-3 font-medium"
                          style={{ color: brandColor(cData.brands.indexOf(row.brand), row.brand) }}
                        >
                          {row.brandName}
                        </td>
                        {CHANNELS.map((c) => {
                          const count = row[c].image + row[c].promo + row[c].product;
                          const isOpen = isOpenRow && openChannel === c;
                          return (
                            <td key={c} className="text-center p-2">
                              <button
                                onClick={() => toggle(row.brand, c)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
                                  isOpen
                                    ? 'bg-accent text-accent-foreground'
                                    : 'hover:bg-accent/50 text-foreground'
                                }`}
                              >
                                <ChevronRight
                                  className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                                />
                                {count || '—'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                      {isOpenRow && openChannel && (
                        <tr className="border-b border-border bg-muted/30">
                          <td colSpan={CHANNELS.length + 1} className="p-4">
                            <div className="text-xs text-muted-foreground mb-2">
                              <span
                                className="font-medium"
                                style={{ color: brandColor(cData.brands.indexOf(row.brand), row.brand) }}
                              >
                                {row.brandName}
                              </span>
                              {' · '}
                              {CHANNEL_LABELS[openChannel]}
                            </div>
                            {openStories.length > 0 ? (
                              <div className="space-y-4">
                                {/* Summary */}
                                <div className="bg-background rounded-md border border-border p-3 space-y-1.5">
                                  <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">
                                    Топ сюжеты
                                  </p>
                                  {topStories(openStories).map(({ text, count }, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                      <span className="shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                                        {i + 1}
                                      </span>
                                      <span className="text-xs text-foreground leading-relaxed flex-1">
                                        {text}
                                      </span>
                                      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                                        ×{count}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {/* Full list */}
                                <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-5">
                                  {openStories.map((s, i) => (
                                    <li key={i} className="leading-relaxed">{s}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground italic">
                                Нет данных по этому каналу.
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
