import { useState, useEffect, useMemo } from 'react';
import { ChartCard } from '@/components/ChartCard';
import { api } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import {
  LineChart, Line, BarChart, Bar, LabelList,
  ScatterChart, Scatter,
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
  monthlyTotal: Record<string, Array<Record<string, string | number>>>;
  monthlyByMedia: Record<string, Record<string, Array<Record<string, string | number>>>>;
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

interface EcomRevenueData {
  brands: string[];
  brandNames: Record<string, string>;
  charts: { revenue: Record<string, Array<Record<string, string | number | null>>> };
}

interface EcomScatterPoint {
  brand: string;
  brandName: string;
  month: string;
  mediaSpend: number;
  ecomRevenue: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Core palette — assigned first, one clearly distinct hue per client.
const CORE_PALETTE = [
  'hsl(355,70%,52%)', // красный
  'hsl(145,60%,38%)', // зелёный
  'hsl(27,88%,52%)',  // оранжевый
  'hsl(42,90%,50%)',  // жёлтый
  'hsl(217,80%,56%)', // синий
  'hsl(271,55%,58%)', // фиолетовый
  'hsl(340,70%,60%)', // розовый
  'hsl(195,75%,48%)', // голубой
  'hsl(210,8%,55%)',  // серый
];

// Extended palette — only reached once there are more clients than CORE_PALETTE covers.
const EXTENDED_PALETTE = [
  'hsl(95,85%,42%)',  // кислотно-зелёный
  'hsl(65,100%,50%)', // кислотно-жёлтый
  'hsl(0,0%,30%)',    // тёмно-серый
  'hsl(305,75%,55%)', // фуксия
  'hsl(174,65%,42%)', // бирюзовый
];

const FALLBACK_PALETTE = [...CORE_PALETTE, ...EXTENDED_PALETTE];

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
  if (!_assignedColors[b]) {
    _assignedColors[b] = FALLBACK_PALETTE[_colorIdx % FALLBACK_PALETTE.length];
    _colorIdx++;
  }
  return _assignedColors[b];
}

const OTHERS_KEY = 'Остальные';

// Separate color cache for non-brand stack segments (channels, regions) so it
// doesn't share/consume slots from the brand color cache above.
let _chColorIdx = 0;
const _assignedChColors: Record<string, string> = {};
function channelColor(k: string): string {
  if (!_assignedChColors[k]) {
    _assignedChColors[k] = FALLBACK_PALETTE[_chColorIdx % FALLBACK_PALETTE.length];
    _chColorIdx++;
  }
  return _assignedChColors[k];
}

// Given the set of keys shown together in one chart (its stack + legend), returns each
// key's usual color, but reassigns any collision (two keys landing on the same palette
// entry once more brands have appeared on the page than the palette has slots) to another
// entry unused within this same set — so no two segments visible together share a color.
function distinctColorsFor(keys: string[], colorFn: (k: string) => string): Record<string, string> {
  const result: Record<string, string> = {};
  const used = new Set<string>();
  const unresolved: string[] = [];
  for (const k of keys) {
    const c = colorFn(k);
    if (!used.has(c)) {
      result[k] = c;
      used.add(c);
    } else {
      unresolved.push(k);
    }
  }
  // Golden-angle hue steps stay well spread out even past the curated palette's size,
  // so a chart with more brands than FALLBACK_PALETTE covers still gets no exact repeats.
  const GOLDEN_ANGLE = 137.508;
  let extra = 0;
  for (const k of unresolved) {
    let color = FALLBACK_PALETTE.find(c => !used.has(c));
    while (!color) {
      const candidate = `hsl(${Math.round((GOLDEN_ANGLE * (FALLBACK_PALETTE.length + extra)) % 360)},70%,45%)`;
      extra++;
      if (!used.has(candidate)) color = candidate;
    }
    result[k] = color;
    used.add(color);
  }
  return result;
}

function sortClientNames(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const na = Number(/(\d+)$/.exec(a)?.[1]);
    const nb = Number(/(\d+)$/.exec(b)?.[1]);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

function buildTop10Stack(entries: { key: string; value: number }[]): { rows: Record<string, string | number>[]; keys: string[] } {
  const top10 = entries.slice(0, 10);
  const restSum = entries.slice(10).reduce((s, e) => s + e.value, 0);
  const row: Record<string, string | number> = { name: 'total' };
  const keys: string[] = [];
  top10.forEach(e => { row[e.key] = e.value; keys.push(e.key); });
  if (restSum > 0) { row[OTHERS_KEY] = restSum; keys.push(OTHERS_KEY); }
  return { rows: [row], keys };
}

function parsePeriod(p: string): { label: string; year: number; isPartial: boolean; monthRange: string | null } {
  const fullMatch = /^(\d{4})$/.exec(p);
  if (fullMatch) return { label: p, year: Number(fullMatch[1]), isPartial: false, monthRange: null };
  const partialMatch = /^(.+?)\s+(\d{4})$/.exec(p);
  if (partialMatch) return { label: p, year: Number(partialMatch[2]), isPartial: true, monthRange: partialMatch[1] };
  return { label: p, year: 0, isPartial: false, monthRange: null };
}

function periodDisplayLabel(p: { year: number; isPartial: boolean; monthRange: string | null }): string {
  if (!p.isPartial || !p.monthRange) return String(p.year);
  const range = p.monthRange.charAt(0).toUpperCase() + p.monthRange.slice(1);
  return `${range} ${p.year}`;
}

function formatRub(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} М`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)} К`;
  return String(v);
}

// Precise "X млн Y тыс" breakdown for tooltips, given a value already expressed in млн ₽
// (e.g. 11.478 → "11 млн 478 тыс"; 0.247967 → "248 тыс").
function formatPreciseRub(millions: number): string {
  const roundedThousands = Math.round(millions * 1000);
  const wholeMillions = Math.floor(roundedThousands / 1000);
  const thousands = roundedThousands - wholeMillions * 1000;
  if (wholeMillions > 0) {
    return thousands > 0 ? `${wholeMillions} млн ${thousands} тыс` : `${wholeMillions} млн`;
  }
  return `${thousands} тыс`;
}

function yearFromLabel(month: string): number {
  const m = month.match(/'(\d{2})$/);
  return m ? 2000 + parseInt(m[1], 10) : 0;
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
  'Анонс: спонсорская заставка': 'Интеграция в анонс',
};

const PLACEMENT_TOGGLE_LABEL: Record<string, string> = {
  'Ролик': 'Ролик',
  'Спонсорская заставка': 'Спонсорство',
  'Анонс: спонсорская заставка': 'Анонсы',
};

function formatTvVal(v: number): string {
  return v < 1 ? v.toFixed(1) : Math.round(v).toString();
}

function TvGantt({ yearData, brands, placements, colors }: {
  yearData: Record<string, Array<Record<string, number | null>>>;
  brands: string[];
  placements: string[];
  colors: Record<string, string>;
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

  const ROW_H = 23;
  const GROUP_GAP = 5;
  const BRAND_LABEL_W = 110;
  const PLACE_LABEL_W = 100;
  const LABEL_W = BRAND_LABEL_W + PLACE_LABEL_W;
  const WEEK_W = 33;
  const AXIS_H = 20;
  const weekW = WEEK_W;
  const chartW = maxWeek * weekW;
  const n = placements.length;
  const brandH = n * ROW_H + GROUP_GAP;
  const svgH = activeBrands.length * brandH - GROUP_GAP + AXIS_H;
  const weekTicks = Array.from({ length: maxWeek }, (_, i) => i + 1).filter(w => w === 1 || w % 4 === 1);

  return (
    <div className="overflow-x-auto">
      <svg width={LABEL_W + chartW} height={svgH} style={{ display: 'block' }}>
        {/* Alternating brand backgrounds: white / light grey */}
        {activeBrands.map((brand, bi) =>
          bi % 2 === 1 ? (
            <rect
              key={`bg_${brand}`}
              x={0} y={bi * brandH}
              width={LABEL_W + chartW} height={n * ROW_H}
              fill="hsl(var(--muted))"
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
          const color = colors[brand] ?? brandColor(brand);
          const brandY = bi * brandH;
          return (
            <g key={brand}>
              {/* Brand label centred over all placement rows */}
              <text
                x={BRAND_LABEL_W - 4}
                y={brandY + (n * ROW_H) / 2 + 4}
                textAnchor="end" fontSize={11} fontWeight="500"
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
                      textAnchor="end" fontSize={9}
                      fill="hsl(var(--muted-foreground))"
                    >
                      {PLACEMENT_SHORT[placement] ?? placement}
                    </text>
                    {rowData.map(pt => {
                      const val = (pt[brand] as number) ?? null;
                      if (!val || val <= 0) return null;
                      const w = pt.week as number;
                      const opacity = 0.35 + 0.65 * (val / maxVal);
                      const cellW = Math.max(weekW - 1, 1);
                      const cellH = ROW_H - 2;
                      return (
                        <g key={w}>
                          <rect
                            x={LABEL_W + (w - 1) * weekW + 0.5}
                            y={rowY + 1}
                            width={cellW}
                            height={cellH}
                            fill={color} opacity={opacity} rx={2}
                          >
                            <title>{`${brand} · ${PLACEMENT_SHORT[placement] ?? placement} · W${w}: ${formatTvVal(val)}`}</title>
                          </rect>
                          <text
                            x={LABEL_W + (w - 1) * weekW + 0.5 + cellW / 2}
                            y={rowY + 1 + cellH / 2}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={9}
                            fontWeight="600"
                            fill="#fff"
                            pointerEvents="none"
                          >
                            {formatTvVal(val)}
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

// ── Reusable single-stack horizontal bar (top-10 + «Остальные») ────────────────

function SingleStackBar({ rows, keys, colorFor, valueFormatter, onSegmentClick, height = 140 }: {
  rows: Record<string, string | number>[];
  keys: string[];
  colorFor: (key: string) => string;
  valueFormatter: (v: number) => string;
  onSegmentClick?: (key: string) => void;
  height?: number;
}) {
  const distinctColors = distinctColorsFor(keys.filter(k => k !== OTHERS_KEY), colorFor);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" barCategoryGap="0%">
        <XAxis type="number" hide domain={[0, 'dataMax']} />
        <YAxis type="category" dataKey="name" hide />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number, name: string) => [valueFormatter(v), name]}
        />
        {keys.map(key => (
          <Bar
            key={key}
            dataKey={key}
            name={key}
            stackId="stack"
            fill={key === OTHERS_KEY ? 'hsl(var(--muted-foreground))' : distinctColors[key]}
            onClick={onSegmentClick && key !== OTHERS_KEY ? () => onSegmentClick(key) : undefined}
            cursor={onSegmentClick && key !== OTHERS_KEY ? 'pointer' : undefined}
          >
            <LabelList
              dataKey={key}
              position="center"
              content={(props) => {
                const { x, y, width, height: h, value } = props as { x: number; y: number; width: number; height: number; value: number };
                if (width < 34) return null;
                return (
                  <text
                    x={x + width / 2}
                    y={y + h / 2}
                    fill="#fff"
                    fontSize={10}
                    textAnchor="middle"
                    dominantBaseline="central"
                    pointerEvents="none"
                  >
                    {valueFormatter(value)}
                  </text>
                );
              }}
            />
          </Bar>
        ))}
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MediaDetails() {
  const { projectId, isReadonly } = useProject();
  const [data, setData] = useState<MediaDetailsData | null>(null);
  const [noData, setNoData] = useState(false);
  const [adData, setAdData] = useState<AdSpendData | null>(null);
  const [salesData, setSalesData] = useState<SalesIndexData | null>(null);
  const [ecomData, setEcomData] = useState<EcomRevenueData | null>(null);
  const [adChannel, setAdChannel] = useState('Тотал');
  const [adYear, setAdYear] = useState('Все');

  const [seasonYear, setSeasonYear]     = useState('');
  const [seasonBrands, setSeasonBrands] = useState<string[]>([]);
  const [regionYear, setRegionYear]     = useState('');
  const [regionMedia, setRegionMedia]   = useState('');
  const [regionName, setRegionName]     = useState('Все');
  const [shareYear, setShareYear]               = useState('');
  const [shareClient, setShareClient]           = useState('');
  const [shareDrillChannel, setShareDrillChannel] = useState<string | null>(null);
  const [trpMetric, setTrpMetric]       = useState<'trp20' | 'trps'>('trp20');
  const [tvYear, setTvYear]             = useState('');
  const [tvPlacements, setTvPlacements] = useState<string[]>([]);
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
        setShareYear(lastYear);
        setShareClient(sortClientNames(md.regionality.brands)[0] ?? '');
        setAdYear(lastYear);
        setTvYear(lastYear);
        setTvPlacements([...md.tvStrategy.placements]);
        setClipPeriod(md.clipDuration.periods[md.clipDuration.periods.length - 1] ?? '');
      })
      .catch(() => setNoData(true));
    api.getProjectData(projectId, 'ad_spend').then(d => setAdData(d as AdSpendData)).catch(console.error);
    api.getProjectData(projectId, 'sales').then(d => setSalesData(d as SalesIndexData)).catch(console.error);
    api.getProjectData(projectId, 'ecom').then(d => setEcomData(d as EcomRevenueData)).catch(console.error);
  }, [projectId]);

  const adYears = useMemo(
    () => (data ? data.regionality.years.map(String) : []),
    [data],
  );

  const adMonthlyStack = useMemo(() => {
    if (!data || !adYear) return { rows: [] as Record<string, string | number>[], keys: [] as string[] };
    const source = adChannel === 'Тотал'
      ? data.regionality.monthlyTotal
      : data.regionality.monthlyByMedia[adChannel];
    if (!source) return { rows: [], keys: [] };

    const years = adYear === 'Все' ? data.regionality.years.map(String) : [adYear];
    const allKeys = new Set<string>();
    const rows: Record<string, string | number>[] = [];
    years.forEach(yr => {
      (source[yr] ?? []).forEach(monthRow => {
        // Regionality values are raw rubles; convert to млн ₽ to match the rest of the page.
        const entries = data.regionality.brands
          .map(b => ({ key: b, value: ((monthRow[b] as number) || 0) / 1_000_000 }))
          .filter(e => e.value > 0)
          .sort((a, b) => b.value - a.value);
        const top10 = entries.slice(0, 10);
        const restSum = entries.slice(10).reduce((s, e) => s + e.value, 0);
        const row: Record<string, string | number> = {
          period: years.length > 1 ? `${monthRow.month} '${yr.slice(2)}` : (monthRow.month as string),
        };
        top10.forEach(e => { row[e.key] = e.value; allKeys.add(e.key); });
        if (restSum > 0) { row[OTHERS_KEY] = restSum; allKeys.add(OTHERS_KEY); }
        rows.push(row);
      });
    });

    return { rows, keys: [...allKeys] };
  }, [data, adChannel, adYear]);

  const adMonthlyColors = useMemo(
    () => distinctColorsFor(adMonthlyStack.keys.filter(k => k !== OTHERS_KEY), brandColor),
    [adMonthlyStack.keys],
  );

  const adYearsStack = useMemo(() => {
    if (!data) return { rows: [] as Record<string, string | number>[], keys: [] as string[] };
    const monthlyTotal = data.regionality.monthlyTotal;
    const years = Object.keys(monthlyTotal).map(Number).sort((a, b) => a - b);
    if (!years.length) return { rows: [], keys: [] };

    const maxYear = years[years.length - 1];
    const maxYearRows = monthlyTotal[String(maxYear)];
    const isPartial = maxYearRows.length > 0 && maxYearRows.length < 12;

    type Col = { label: string; rows: Array<Record<string, string | number>> };
    let columns: Col[];
    if (isPartial) {
      const monthAbbrs = maxYearRows.map(r => r.month as string);
      const prevYearRows = (monthlyTotal[String(maxYear - 1)] ?? [])
        .filter(r => monthAbbrs.includes(r.month as string));
      const rangeLabel = monthAbbrs.length > 1
        ? `${monthAbbrs[0]}-${monthAbbrs[monthAbbrs.length - 1]}`
        : monthAbbrs[0];
      const fullYearCols: Col[] = years
        .filter(y => y < maxYear)
        .map(y => ({ label: String(y), rows: monthlyTotal[String(y)] }));
      columns = [
        ...fullYearCols,
        { label: `${rangeLabel} ${maxYear - 1}`, rows: prevYearRows },
        { label: `${rangeLabel} ${maxYear}`, rows: maxYearRows },
      ];
    } else {
      columns = years.map(y => ({ label: String(y), rows: monthlyTotal[String(y)] }));
    }

    const allKeys = new Set<string>();
    const rows = columns.map(col => {
      // Regionality values are raw rubles; convert to млн ₽ to match the rest of the page.
      const entries = data.regionality.brands
        .map(b => ({ key: b, value: col.rows.reduce((s, r) => s + ((r[b] as number) || 0), 0) / 1_000_000 }))
        .filter(e => e.value > 0)
        .sort((a, b) => b.value - a.value);
      const top10 = entries.slice(0, 10);
      const restSum = entries.slice(10).reduce((s, e) => s + e.value, 0);
      const row: Record<string, string | number> = { period: col.label };
      top10.forEach(e => { row[e.key] = e.value; allKeys.add(e.key); });
      if (restSum > 0) { row[OTHERS_KEY] = restSum; allKeys.add(OTHERS_KEY); }
      return row;
    });

    return { rows, keys: [...allKeys] };
  }, [data]);

  const adYearsColors = useMemo(
    () => distinctColorsFor(adYearsStack.keys.filter(k => k !== OTHERS_KEY), brandColor),
    [adYearsStack.keys],
  );

  const scatterData: ScatterPoint[] = useMemo(() => {
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
  }, [adData, salesData]);

  const scatterMonthRange = scatterData.length
    ? `${scatterData[0].month} – ${scatterData[scatterData.length - 1].month}`
    : '';

  const ecomScatterData: EcomScatterPoint[] = useMemo(() => {
    if (!adData || !ecomData) return [];
    const revenueSeries = ecomData.charts.revenue['all'] ?? [];
    const revenueMap = new Map(revenueSeries.map((r) => [r.month as string, r]));
    const points: EcomScatterPoint[] = [];
    for (const row of adData.channels.total) {
      const month = row.month as string;
      const revenueRow = revenueMap.get(month);
      if (!revenueRow) continue;
      for (const brand of adData.brands) {
        const ecomRevenue = revenueRow[brand];
        if (ecomRevenue == null) continue;
        points.push({
          brand,
          brandName: adData.brandNames[brand],
          month,
          mediaSpend: row[brand] as number,
          ecomRevenue: ecomRevenue as number,
        });
      }
    }
    return points;
  }, [adData, ecomData]);

  const ecomScatterMonthRange = ecomScatterData.length
    ? `${ecomScatterData[0].month} – ${ecomScatterData[ecomScatterData.length - 1].month}`
    : '';

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
    return data.seasonality.data[seasonYear] ?? [];
  }, [data, seasonYear]);

  const seasonColors = useMemo(() => distinctColorsFor(seasonBrands, brandColor), [seasonBrands]);

  const regionData = useMemo(() => {
    if (!data || !regionYear || !regionMedia || !regionName) return [];
    return (data.regionality.data[regionYear]?.[regionMedia]?.[regionName] ?? [])
      .filter((d: { brand: string; value: number }) => d.value > 0)
      .sort((a: { brand: string; value: number }, b: { brand: string; value: number }) => b.value - a.value);
  }, [data, regionYear, regionMedia, regionName]);

  const regionStack = useMemo(
    () => buildTop10Stack(regionData.map(d => ({ key: d.brand, value: d.value }))),
    [regionData],
  );

  const shareClientOptions = useMemo(
    () => (data ? sortClientNames(data.regionality.brands) : []),
    [data],
  );

  const shareChannelStack = useMemo(() => {
    if (!data || !shareYear || !shareClient) return { rows: [], keys: [] };
    const entries = data.regionality.mediaTypes
      .map(media => ({
        key: media,
        value: data.regionality.data[shareYear]?.[media]?.['Все']?.find(e => e.brand === shareClient)?.value ?? 0,
      }))
      .filter(e => e.value > 0)
      .sort((a, b) => b.value - a.value);
    return buildTop10Stack(entries);
  }, [data, shareYear, shareClient]);

  const shareRegionStack = useMemo(() => {
    if (!data || !shareYear || !shareClient || !shareDrillChannel) return { rows: [], keys: [] };
    const regions = (data.regionality.regions[shareDrillChannel] ?? []).filter(r => r !== 'Все');
    const entries = regions
      .map(region => ({
        key: region,
        value: data.regionality.data[shareYear]?.[shareDrillChannel]?.[region]?.find(e => e.brand === shareClient)?.value ?? 0,
      }))
      .filter(e => e.value > 0)
      .sort((a, b) => b.value - a.value);
    return buildTop10Stack(entries);
  }, [data, shareYear, shareClient, shareDrillChannel]);

  const regionTotal = useMemo(() => regionData.reduce((s, d) => s + d.value, 0), [regionData]);

  const trpStack = useMemo(() => {
    if (!data) return { rows: [] as Record<string, string | number>[], keys: [] as string[] };
    const metric = data.trp[trpMetric];
    const { brands, periods } = data.trp;

    const parsed = periods.map(parsePeriod);
    const maxYear = Math.max(...parsed.map(p => p.year));
    const latestFull = parsed.some(p => p.year === maxYear && !p.isPartial);

    let displayPeriods: typeof parsed;
    if (latestFull) {
      displayPeriods = parsed.filter(p => !p.isPartial);
    } else {
      const currentPartial = parsed.find(p => p.year === maxYear && p.isPartial);
      const prevPartial = currentPartial
        ? parsed.find(p => p.isPartial && p.monthRange === currentPartial.monthRange && p.year === maxYear - 1)
        : undefined;
      const fullYears = parsed.filter(p => !p.isPartial && p.year < maxYear);
      displayPeriods = [...fullYears, ...(prevPartial ? [prevPartial] : []), ...(currentPartial ? [currentPartial] : [])];
    }
    displayPeriods.sort((a, b) => a.year - b.year || Number(a.isPartial) - Number(b.isPartial));

    const allKeys = new Set<string>();
    const rows = displayPeriods.map(p => {
      const entries = brands
        .map(b => ({ brand: b, value: metric[b]?.[p.label] ?? 0 }))
        .filter(e => e.value > 0)
        .sort((a, b) => b.value - a.value);
      const top10 = entries.slice(0, 10);
      const restSum = entries.slice(10).reduce((s, e) => s + e.value, 0);
      const row: Record<string, string | number> = { period: periodDisplayLabel(p) };
      top10.forEach(e => { row[e.brand] = e.value; allKeys.add(e.brand); });
      if (restSum > 0) { row[OTHERS_KEY] = restSum; allKeys.add(OTHERS_KEY); }
      return row;
    });

    return { rows, keys: [...allKeys] };
  }, [data, trpMetric]);

  const trpColors = useMemo(
    () => distinctColorsFor(trpStack.keys.filter(k => k !== OTHERS_KEY), brandColor),
    [trpStack.keys],
  );

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

  const { seasonality, regionality, tvStrategy, clipDuration } = data;
  const tvGanttColors = distinctColorsFor(tvStrategy.brands, brandColor);
  const scatterColors = distinctColorsFor(adData?.brands ?? [], brandColor);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Медиа</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Источники: Mediascope
        </p>
      </div>

      {/* ── Рекламные расходы (по годам) ──────────────────────────────── */}
      <ChartCard
        title="Рекламные расходы"
        subtitle="млн ₽ · Regionality, все медиа · топ-10 брендов + «Остальные»"
      >
        {!data ? (
          <div className="flex items-center justify-center h-[340px] text-muted-foreground text-sm">
            Загрузка данных…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={adYearsStack.rows} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="period" tick={axisTick} />
              <YAxis tick={axisTick} tickFormatter={formatRub} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => [formatPreciseRub(v), name]}
              />
              {adYearsStack.keys.map(key => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={key}
                  stackId="adYears"
                  fill={key === OTHERS_KEY ? 'hsl(var(--muted-foreground))' : adYearsColors[key]}
                >
                  <LabelList
                    dataKey={key}
                    position="center"
                    content={(props) => {
                      const { x, y, width, height, value } = props as { x: number; y: number; width: number; height: number; value: number };
                      if (height < 14) return null;
                      return (
                        <text
                          x={x + width / 2}
                          y={y + height / 2}
                          fill="#fff"
                          fontSize={10}
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {Math.round(value)}
                        </text>
                      );
                    }}
                  />
                </Bar>
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Рекламные расходы по каналам ──────────────────────────────── */}
      <ChartCard
        title="Рекламные расходы по каналам"
        subtitle="млн ₽ · Regionality · топ-10 брендов + «Остальные»"
        headerExtra={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1 bg-secondary border border-border rounded-md p-1 flex-wrap">
              {['Тотал', ...(data?.regionality.mediaTypes ?? [])].map((m) => (
                <button
                  key={m}
                  onClick={() => setAdChannel(m)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    adChannel === m
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {adYears.length > 1 && (
              <Tabs options={['Все', ...adYears]} value={adYear} onChange={setAdYear} />
            )}
          </div>
        }
      >
        {!data ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
            Загрузка данных…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={adMonthlyStack.rows} barCategoryGap="10%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="period" tick={axisTickSm} interval={0} angle={adYear === 'Все' ? -45 : 0} textAnchor={adYear === 'Все' ? 'end' : 'middle'} height={adYear === 'Все' ? 50 : 30} />
              <YAxis tick={axisTick} tickFormatter={formatRub} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => [formatPreciseRub(v), name]}
              />
              {adMonthlyStack.keys.map(key => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={key}
                  stackId="adMonthly"
                  fill={key === OTHERS_KEY ? 'hsl(var(--muted-foreground))' : adMonthlyColors[key]}
                >
                  <LabelList
                    dataKey={key}
                    position="center"
                    content={(props) => {
                      const { x, y, width, height, value } = props as { x: number; y: number; width: number; height: number; value: number };
                      if (height < 12) return null;
                      return (
                        <text
                          x={x + width / 2}
                          y={y + height / 2}
                          fill="#fff"
                          fontSize={9}
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {Math.round(value)}
                        </text>
                      );
                    }}
                  />
                </Bar>
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Сезонность (скрыт) ────────────────────────────────────────────── */}
      {false && (
      <ChartCard
        title="Сезонность"
        subtitle="Общий рекламный бюджет по годам"
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
                    ? { backgroundColor: seasonColors[b], color: '#fff', borderColor: 'transparent' }
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
                  stroke={seasonColors[b]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={true}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      )}

      {/* ── Региональность ──────────────────────────────────────────────── */}
      <ChartCard
        title="Доля в медиа (Share of spend)"
        subtitle={`Рекламный бюджет по брендам, ₽ · Итого: ${formatRub(regionTotal)} ₽`}
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
          <SingleStackBar
            rows={regionStack.rows}
            keys={regionStack.keys}
            colorFor={brandColor}
            valueFormatter={v => `${formatRub(v)} ₽`}
          />
        </div>
      </ChartCard>

      {/* ── Доля в медиа: по клиенту ──────────────────────────────────────── */}
      <ChartCard
        title="Доля в медиа по клиенту"
        subtitle={
          shareDrillChannel
            ? `${shareClient} · разбивка по регионам в канале «${shareDrillChannel}», ₽`
            : `${shareClient} · распределение бюджета по каналам, ₽`
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Год:</span>
              <Tabs
                options={regionality.years.map(String)}
                value={shareYear}
                onChange={v => { setShareYear(v); setShareDrillChannel(null); }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Клиент:</span>
              <select
                value={shareClient}
                onChange={e => { setShareClient(e.target.value); setShareDrillChannel(null); }}
                className="text-xs border border-border rounded px-2 py-1 bg-card text-foreground"
              >
                {shareClientOptions.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            {shareDrillChannel && (
              <button
                onClick={() => setShareDrillChannel(null)}
                className="text-xs px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Назад к каналам
              </button>
            )}
          </div>
          {shareDrillChannel ? (
            <SingleStackBar
              rows={shareRegionStack.rows}
              keys={shareRegionStack.keys}
              colorFor={channelColor}
              valueFormatter={v => `${formatRub(v)} ₽`}
            />
          ) : (
            <SingleStackBar
              rows={shareChannelStack.rows}
              keys={shareChannelStack.keys}
              colorFor={channelColor}
              valueFormatter={v => `${formatRub(v)} ₽`}
              onSegmentClick={setShareDrillChannel}
            />
          )}
          {!shareDrillChannel && (
            <p className="text-xs text-muted-foreground">Кликните на канал, чтобы увидеть разбивку по регионам</p>
          )}
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
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={trpStack.rows} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="period"
                tick={axisTick}
              />
              <YAxis tick={axisTick} tickFormatter={v => v.toFixed(0)} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => [v.toFixed(1), name]}
              />
              {trpStack.keys.map(key => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={key}
                  stackId="trp"
                  fill={key === OTHERS_KEY ? 'hsl(var(--muted-foreground))' : trpColors[key]}
                >
                  <LabelList
                    dataKey={key}
                    position="center"
                    content={(props) => {
                      const { x, y, width, height, value } = props as { x: number; y: number; width: number; height: number; value: number };
                      if (height < 14) return null;
                      return (
                        <text
                          x={x + width / 2}
                          y={y + height / 2}
                          fill="#fff"
                          fontSize={10}
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {value.toFixed(0)}
                        </text>
                      );
                    }}
                  />
                </Bar>
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Показать:</span>
            <div className="flex flex-wrap gap-1.5">
              {tvStrategy.placements.map(p => {
                const active = tvPlacements.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => setTvPlacements(cur =>
                      active ? cur.filter(x => x !== p) : [...cur, p]
                    )}
                    className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground border-transparent'
                        : 'bg-transparent text-muted-foreground border-border'
                    }`}
                  >
                    {PLACEMENT_TOGGLE_LABEL[p] ?? p}
                  </button>
                );
              })}
            </div>
          </div>
          <TvGantt
            yearData={tvYearData}
            brands={tvStrategy.brands}
            colors={tvGanttColors}
            placements={tvStrategy.placements.filter(p => tvPlacements.includes(p))}
          />
          <div className="flex flex-wrap gap-2 mt-1">
            {tvStrategy.brands
              .filter(b => tvStrategy.placements.filter(p => tvPlacements.includes(p)).some(p => (tvYearData[p] ?? []).some((pt: Record<string, number | null>) => (pt[b] ?? 0) > 0)))
              .map(b => (
                <span key={b} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ backgroundColor: tvGanttColors[b] }}
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

      {!isReadonly && (
        <>
          {/* ── Media Spend vs Sales ──────────────────────────────────────── */}
          <ChartCard
            title="Media Spend vs Sales"
            subtitle={`Рекламные расходы (млн ₽) vs индекс продаж${scatterMonthRange ? ` · ${scatterMonthRange}` : ''}`}
          >
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  dataKey="mediaSpend"
                  name="Рекл. расходы"
                  tick={axisTick}
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
                  tick={axisTick}
                  width={52}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, name: string) =>
                    name === 'Рекл. расходы'
                      ? [`${v.toFixed(2)} млн ₽`, name]
                      : [`${v.toFixed(5)}`, name]
                  }
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.month ?? ''}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {adData?.brands.map((b) => (
                  <Scatter
                    key={b}
                    name={adData.brandNames[b]}
                    data={scatterData.filter((d) => d.brand === b)}
                    fill={scatterColors[b]}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* ── Media Spend vs E-com Revenue ─────────────────────────────────── */}
          <ChartCard
            title="Media Spend vs E-com Revenue"
            subtitle={`Рекламные расходы (млн ₽) vs выручка в e-com (млн ₽)${ecomScatterMonthRange ? ` · ${ecomScatterMonthRange}` : ''}`}
          >
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  dataKey="mediaSpend"
                  name="Рекл. расходы"
                  tick={axisTick}
                  label={{
                    value: 'Рекл. расходы (млн ₽)',
                    position: 'bottom',
                    fontSize: 11,
                    fill: 'hsl(var(--muted-foreground))',
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="ecomRevenue"
                  name="Выручка e-com"
                  tick={axisTick}
                  width={52}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, name: string) =>
                    name === 'Рекл. расходы'
                      ? [`${v.toFixed(2)} млн ₽`, name]
                      : [`${v.toFixed(2)} млн ₽`, name]
                  }
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.month ?? ''}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {adData?.brands.map((b) => (
                  <Scatter
                    key={b}
                    name={adData.brandNames[b]}
                    data={ecomScatterData.filter((d) => d.brand === b)}
                    fill={scatterColors[b]}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </div>
  );
}
