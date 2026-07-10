import { useState, useEffect, useMemo } from 'react';
import { ChartCard } from '@/components/ChartCard';
import { api } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SeasonalityData {
  brands: string[];
  defaultBrands: string[];
  years: number[];
  data: Record<string, Array<Record<string, string | number | null>>>;
}
interface RegionalityData {
  brands: string[];
  mediaTypes: string[];
  years: number[];
  regions: Record<string, string[]>;
  data: Record<string, Record<string, Record<string, Array<{ brand: string; value: number }>>>>;
}
interface TrpData {
  brands: string[];
  periods: string[];
  trp20: Record<string, Record<string, number | null>>;
  trps: Record<string, Record<string, number | null>>;
}
interface TvStrategyData {
  brands: string[];
  placements: string[];
  years: number[];
  data: Record<string, Record<string, Array<Record<string, number | null>>>>;
}
interface ClipDurationData {
  brands: string[];
  durations: number[];
  periods: string[];
  data: Record<string, Array<Record<string, string | number | null>>>;
}
interface MediaDetailsData {
  seasonality: SeasonalityData;
  regionality: RegionalityData;
  trp: TrpData;
  tvStrategy: TvStrategyData;
  clipDuration: ClipDurationData;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BRAND_COLORS: Record<string, string> = {
  'СЕЛО ЗЕЛЕНОЕ':  'hsl(217, 91%, 60%)',
  'БЕЛЕБЕЕВСКИЙ':  'hsl(142, 76%, 36%)',
  'БРЕСТ-ЛИТОВСК': 'hsl(38,  92%, 50%)',
  'СЫРОБОГАТОВ':   'hsl(280, 65%, 60%)',
  'ФЕТАКСА':       'hsl(0,   70%, 55%)',
  'HOCHLAND':      'hsl(180, 60%, 40%)',
  'ALMETTE':       'hsl(320, 60%, 50%)',
  'УМАЛАТ':        'hsl(55,  85%, 42%)',
  'АШАН':          'hsl(200, 70%, 50%)',
  'КАРАТ (СЫР)':   'hsl(15,  80%, 50%)',
  'ЛЕНТА':         'hsl(240, 60%, 55%)',
  'UNAGRANDE':     'hsl(160, 60%, 40%)',
  'PRETTO':        'hsl(340, 70%, 55%)',
  'БОНДЖОРНО':     'hsl(25,  75%, 48%)',
};
const FALLBACK_PALETTE = [
  'hsl(207,70%,53%)', 'hsl(134,55%,40%)', 'hsl(27,85%,52%)',
  'hsl(271,55%,58%)', 'hsl(353,65%,52%)', 'hsl(185,55%,42%)',
  'hsl(45,80%,48%)',  'hsl(315,55%,52%)', 'hsl(100,50%,42%)',
];

const PERIOD_COLORS = [
  'hsl(217,91%,60%)', 'hsl(142,76%,36%)', 'hsl(38,92%,50%)', 'hsl(280,65%,60%)',
];
const DURATION_COLORS: Record<number, string> = {
  5:  'hsl(142,76%,36%)',
  10: 'hsl(38,92%,50%)',
  15: 'hsl(55,85%,42%)',
  20: 'hsl(217,91%,60%)',
  25: 'hsl(280,65%,60%)',
};

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 11,
};
const axisTick   = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
const axisTickSm = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };

// ── Helpers ────────────────────────────────────────────────────────────────────

let _colorIdx = 0;
const _assignedColors: Record<string, string> = {};
function brandColor(b: string): string {
  if (BRAND_COLORS[b]) return BRAND_COLORS[b];
  if (!_assignedColors[b]) {
    _assignedColors[b] = FALLBACK_PALETTE[_colorIdx % FALLBACK_PALETTE.length];
    _colorIdx++;
  }
  return _assignedColors[b];
}

function formatRub(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} М`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)} К`;
  return String(v);
}

function Tabs({
  options, value, onChange,
}: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            value === opt
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── TV Gantt chart ─────────────────────────────────────────────────────────────

const PLACEMENT_SHORT: Record<string, string> = {
  'Ролик': 'Ролик',
  'Спонсорская заставка': 'Спонс.',
  'Анонс: спонсорская заставка': 'Анонс',
};

function TvGantt({ yearData, brands, placements }: {
  yearData: Record<string, Array<Record<string, number | null>>>;
  brands: string[];
  placements: string[];
}) {
  const activeBrands = brands.filter(b =>
    placements.some(p => (yearData[p] ?? []).some(pt => ((pt[b] as number) ?? 0) > 0))
  );
  if (!activeBrands.length) return <div className="text-muted-foreground text-sm py-8 text-center">Нет данных</div>;

  const maxVal = Math.max(
    1,
    ...placements.flatMap(p =>
      (yearData[p] ?? []).flatMap(pt => activeBrands.map(b => (pt[b] as number) ?? 0))
    )
  );
  const maxWeek = Math.max(
    1,
    ...placements.flatMap(p => (yearData[p] ?? []).map(pt => (pt.week as number) ?? 0))
  );

  const ROW_H = 21;
  const CELL_W = 32;
  const GROUP_GAP = 5;
  const BRAND_LABEL_W = 110;
  const PLACE_LABEL_W = 52;
  const LABEL_W = BRAND_LABEL_W + PLACE_LABEL_W;
  const CHART_W = maxWeek * CELL_W;
  const AXIS_H = 20;
  const weekW = CELL_W;
  const n = placements.length;
  const brandH = n * ROW_H + GROUP_GAP;
  const svgH = activeBrands.length * brandH - GROUP_GAP + AXIS_H;
  const weekTicks = Array.from({ length: maxWeek }, (_, i) => i + 1).filter(w => w === 1 || w % 4 === 1);

  return (
    <div className="overflow-x-auto">
      <svg width={LABEL_W + CHART_W} height={svgH} style={{ display: 'block' }}>
        {/* Alternating brand backgrounds */}
        {activeBrands.map((brand, bi) =>
          bi % 2 === 1 ? (
            <rect
              key={`bg_${brand}`}
              x={0} y={bi * brandH}
              width={LABEL_W + CHART_W} height={n * ROW_H}
              fill="hsl(var(--muted))" opacity={0.25}
            />
          ) : null
        )}

        {/* Week grid + axis labels */}
        {weekTicks.map(w => {
          const x = LABEL_W + (w - 1) * weekW;
          return (
            <g key={`t${w}`}>
              <line x1={x} y1={0} x2={x} y2={svgH - AXIS_H} stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="2 3" />
              <text x={x + 1} y={svgH - AXIS_H + 13} fontSize={9} fill="hsl(var(--muted-foreground))">{`W${w}`}</text>
            </g>
          );
        })}

        {/* Brand groups */}
        {activeBrands.map((brand, bi) => {
          const color = brandColor(brand);
          const brandY = bi * brandH;
          return (
            <g key={brand}>
              {/* Brand label centred over all placement rows */}
              <text
                x={BRAND_LABEL_W - 4}
                y={brandY + (n * ROW_H) / 2 + 4}
                textAnchor="end" fontSize={10} fontWeight="500"
                fill="hsl(var(--foreground))"
              >
                {brand.length > 14 ? brand.slice(0, 13) + '…' : brand}
              </text>

              {/* Placement sub-rows */}
              {placements.map((placement, pi) => {
                const rowData = yearData[placement] ?? [];
                const rowY = brandY + pi * ROW_H;
                return (
                  <g key={placement}>
                    <text
                      x={LABEL_W - 4} y={rowY + ROW_H / 2 + 4}
                      textAnchor="end" fontSize={8}
                      fill="hsl(var(--muted-foreground))"
                    >
                      {PLACEMENT_SHORT[placement] ?? placement}
                    </text>
                    {rowData.map(pt => {
                      const val = (pt[brand] as number) ?? null;
                      if (!val || val <= 0) return null;
                      const w = pt.week as number;
                      const opacity = 0.35 + 0.65 * (val / maxVal);
                      const cx = LABEL_W + (w - 1) * weekW + weekW / 2;
                      const cy = rowY + ROW_H / 2;
                      return (
                        <g key={w}>
                          <rect
                            x={LABEL_W + (w - 1) * weekW + 0.5}
                            y={rowY + 1}
                            width={Math.max(weekW - 1, 1)}
                            height={ROW_H - 2}
                            fill={color} opacity={opacity} rx={1}
                          >
                            <title>{`${brand} · ${PLACEMENT_SHORT[placement] ?? placement} · W${w}: ${val.toFixed(1)}`}</title>
                          </rect>
                          <text
                            x={cx} y={cy + 3.5}
                            textAnchor="middle" fontSize={9} fontWeight="600"
                            fill="white" style={{ pointerEvents: 'none', userSelect: 'none' }}
                          >
                            {val.toFixed(1)}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MediaDetails() {
  const { projectId } = useProject();
  const [data, setData] = useState<MediaDetailsData | null>(null);
  const [noData, setNoData] = useState(false);

  const [seasonYear, setSeasonYear]     = useState('');
  const [seasonBrands, setSeasonBrands] = useState<string[]>([]);
  const [regionYear, setRegionYear]     = useState('');
  const [regionMedia, setRegionMedia]   = useState('');
  const [regionName, setRegionName]     = useState('Все');
  const [trpMetric, setTrpMetric]       = useState<'trp20' | 'trps'>('trp20');
  const [tvYear, setTvYear]             = useState('');
  const [clipPeriod, setClipPeriod]     = useState('');

  useEffect(() => {
    if (projectId === null) return;
    api.getProjectData(projectId, 'media_details')
      .then(d => {
        const md = d as MediaDetailsData;
        setData(md);
        const lastYear = String(md.seasonality.years[md.seasonality.years.length - 1]);
        setSeasonYear(lastYear);
        setSeasonBrands([...md.seasonality.defaultBrands]);
        setRegionYear(lastYear);
        setRegionMedia(md.regionality.mediaTypes[0] ?? '');
        setTvYear(lastYear);
        setClipPeriod(md.clipDuration.periods[md.clipDuration.periods.length - 1] ?? '');
      })
      .catch(() => setNoData(true));
  }, [projectId]);

  const handleMediaChange = (media: string) => {
    setRegionMedia(media);
    setRegionName('Все');
  };

  const toggleSeasonBrand = (b: string) => {
    setSeasonBrands(prev =>
      prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b],
    );
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  const seasonData = useMemo(() => {
    if (!data || !seasonYear) return [];
    return (data.seasonality.data[seasonYear] ?? []).map(row => {
      const out: Record<string, unknown> = { month: row.month };
      for (const b of data.seasonality.brands) {
        out[b] = (row[b] as number | null) ?? 0;
      }
      return out;
    });
  }, [data, seasonYear]);

  const regionData = useMemo(() => {
    if (!data || !regionYear || !regionMedia || !regionName) return [];
    return (data.regionality.data[regionYear]?.[regionMedia]?.[regionName] ?? [])
      .filter((d: { brand: string; value: number }) => d.value > 0)
      .sort((a: { brand: string; value: number }, b: { brand: string; value: number }) => b.value - a.value);
  }, [data, regionYear, regionMedia, regionName]);

  const trpChartData = useMemo(() => {
    if (!data) return [];
    const metric = data.trp[trpMetric];
    const { brands, periods } = data.trp;
    return brands
      .filter(b => periods.some(p => (metric[b]?.[p] ?? 0) > 0))
      .map(b => {
        const pt: Record<string, string | number | null> = { brand: b };
        periods.forEach(p => { pt[p] = metric[b]?.[p] ?? null; });
        return pt;
      });
  }, [data, trpMetric]);

  const tvYearData = useMemo(() => {
    if (!data || !tvYear) return {};
    return data.tvStrategy.data[tvYear] ?? {};
  }, [data, tvYear]);

  const clipData = useMemo(() => {
    if (!data || !clipPeriod) return [];
    return (data.clipDuration.data[clipPeriod] ?? []).filter(pt =>
      (data.clipDuration.durations as number[]).some(d => ((pt[String(d)] as number) ?? 0) > 0),
    );
  }, [data, clipPeriod]);

  if (noData) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Данные не загружены. Загрузите файл «Media Details» через страницу загрузки.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Загрузка данных…
      </div>
    );
  }

  const { seasonality, regionality, trp, tvStrategy, clipDuration } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Media Details</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Сезонность, регионы, ТВ-рейтинги и структура медиаразмещения
        </p>
      </div>

      {/* ── Сезонность ──────────────────────────────────────────────────── */}
      <ChartCard
        title="Сезонность"
        subtitle="Общий рекламный бюджет по месяцам, ₽"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground shrink-0">Год:</span>
            <Tabs
              options={seasonality.years.map(String)}
              value={seasonYear}
              onChange={setSeasonYear}
            />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block mb-1.5">Бренды:</span>
            <div className="flex flex-wrap gap-1.5">
              {seasonality.brands.map(b => (
                <button
                  key={b}
                  onClick={() => toggleSeasonBrand(b)}
                  className="px-2 py-0.5 rounded text-xs font-medium border transition-colors"
                  style={seasonBrands.includes(b)
                    ? { backgroundColor: brandColor(b), color: '#fff', borderColor: 'transparent' }
                    : { backgroundColor: 'transparent', borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }
                  }
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={seasonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={axisTick} />
              <YAxis tick={axisTick} tickFormatter={formatRub} width={56} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [`${formatRub(v)} ₽`, '']}
              />
              {seasonBrands.map(b => (
                <Line
                  key={b}
                  type="monotone"
                  dataKey={b}
                  name={b}
                  stroke={brandColor(b)}
                  strokeWidth={1.5}
                  dot={{ r: 3 }}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* ── Региональность ──────────────────────────────────────────────── */}
      <ChartCard
        title="Региональность"
        subtitle="Рекламный бюджет по брендам, ₽"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Год:</span>
              <Tabs
                options={regionality.years.map(String)}
                value={regionYear}
                onChange={setRegionYear}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Медиа:</span>
              <Tabs
                options={regionality.mediaTypes}
                value={regionMedia}
                onChange={handleMediaChange}
              />
            </div>
          </div>
          {/* Region selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Регион:</span>
            <select
              value={regionName}
              onChange={e => setRegionName(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-card text-foreground"
            >
              {(regionality.regions[regionMedia] ?? ['Все']).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(240, regionData.length * 26)}>
            <BarChart data={regionData} layout="vertical" barCategoryGap="18%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                tick={axisTickSm}
                tickFormatter={formatRub}
              />
              <YAxis
                type="category"
                dataKey="brand"
                tick={axisTickSm}
                width={140}
                interval={0}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [`${formatRub(v)} ₽`, '']}
              />
              <Bar dataKey="value" name="Бюджет, ₽" radius={[0, 3, 3, 0]}>
                {regionData.map((entry: { brand: string; value: number }) => (
                  <Cell key={entry.brand} fill={brandColor(entry.brand)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* ── TRP ─────────────────────────────────────────────────────────── */}
      <ChartCard
        title="ТВ-рейтинги"
        subtitle="Национальное ТВ, Ж 25–55"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Метрика:</span>
            <Tabs
              options={['trp20', 'trps']}
              value={trpMetric}
              onChange={v => setTrpMetric(v as 'trp20' | 'trps')}
            />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trpChartData} barCategoryGap="22%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="brand"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', textAnchor: 'end' }}
                angle={-30}
                height={60}
                interval={0}
              />
              <YAxis tick={axisTick} tickFormatter={v => v.toFixed(0)} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [v.toFixed(1), '']}
              />
              {trp.periods.map((p, i) => (
                <Bar
                  key={p}
                  dataKey={p}
                  name={p}
                  fill={PERIOD_COLORS[i % PERIOD_COLORS.length]}
                  radius={[2, 2, 0, 0]}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* ── TV Strategy ─────────────────────────────────────────────────── */}
      <ChartCard
        title="TV Strategy"
        subtitle="Недельные рейтинги по бренду и типу размещения"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Год:</span>
            <Tabs
              options={tvStrategy.years.map(String)}
              value={tvYear}
              onChange={setTvYear}
            />
          </div>
          <TvGantt yearData={tvYearData} brands={tvStrategy.brands} placements={tvStrategy.placements} />
          <div className="flex flex-wrap gap-2 mt-1">
            {tvStrategy.brands
              .filter(b => tvStrategy.placements.some(p => (tvYearData[p] ?? []).some((pt: Record<string, number | null>) => (pt[b] ?? 0) > 0)))
              .map(b => (
                <span key={b} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ backgroundColor: brandColor(b) }}
                  />
                  {b}
                </span>
              ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Интенсивность цвета пропорциональна рейтингу (TRP)
          </p>
        </div>
      </ChartCard>

      {/* ── Хронометраж ─────────────────────────────────────────────────── */}
      <ChartCard
        title="Хронометраж роликов"
        subtitle="Доля выходов по длительности ролика, %"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Период:</span>
            <Tabs
              options={clipDuration.periods}
              value={clipPeriod}
              onChange={setClipPeriod}
            />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={clipData} barCategoryGap="20%" layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                tick={axisTickSm}
                tickFormatter={v => `${v}%`}
                domain={[0, 100]}
              />
              <YAxis
                type="category"
                dataKey="brand"
                tick={axisTickSm}
                width={120}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [`${v.toFixed(1)}%`, '']}
              />
              {clipDuration.durations.map(d => (
                <Bar
                  key={d}
                  dataKey={String(d)}
                  name={`${d} сек`}
                  stackId="a"
                  fill={DURATION_COLORS[d] ?? 'hsl(0,0%,50%)'}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
