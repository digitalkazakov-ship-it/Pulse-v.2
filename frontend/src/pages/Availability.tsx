import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { ChartCard } from '@/components/ChartCard';
import { api } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

type MonthPoint = Record<string, string | number | null>;
type ChartSeries = Record<string, MonthPoint[]>;

interface EcomData {
  generated: string;
  brands: string[];
  brandNames: Record<string, string>;
  months: string[];
  marketplaces: string[];
  charts: {
    sales?:      ChartSeries;
    revenue?:    ChartSeries;
    skuShare?:   ChartSeries;
    skuCount?:   ChartSeries;
    salesShare?: ChartSeries;
  };
}

interface PresencePoint extends Record<string, string | number> {
  retailer: string;
}

interface PresenceData {
  brands: string[];
  brandNames: Record<string, string>;
  retail:   PresencePoint[];
  delivery: PresencePoint[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BRAND_PALETTE = [
  'hsl(0,   84%, 60%)',
  'hsl(142, 76%, 36%)',
  'hsl(38,  92%, 50%)',
  'hsl(217, 91%, 60%)',
  'hsl(199, 89%, 48%)',
  'hsl(168, 76%, 42%)',
];

function brandColor(_b: string, idx: number): string {
  return BRAND_PALETTE[idx % BRAND_PALETTE.length];
}

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 11,
};

const axisTick   = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
const axisTickSm = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };

const MP_LABEL_MAP: Record<string, string> = {
  all: 'Все', ozon: 'Ozon', ozonfresh: 'Ozon Fresh', wb: 'WB', ym: 'ЯМ',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MpTabs({
  value,
  onChange,
  marketplaces,
  showAll = true,
}: {
  value: string;
  onChange: (v: string) => void;
  marketplaces: string[];
  showAll?: boolean;
}) {
  const keys = showAll ? ['all', ...marketplaces] : [...marketplaces];
  return (
    <div className="inline-flex items-center gap-1 bg-secondary border border-border rounded-md p-1">
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            value === k
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {MP_LABEL_MAP[k] ?? k}
        </button>
      ))}
    </div>
  );
}

function EcomLineChart({
  data,
  brands,
  brandNames,
  tickFmt,
  yWidth = 60,
}: {
  data: MonthPoint[];
  brands: string[];
  brandNames: Record<string, string>;
  tickFmt?: (v: number) => string;
  yWidth?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={axisTick} />
        <YAxis tick={axisTick} tickFormatter={tickFmt} width={yWidth} />
        <Tooltip contentStyle={tooltipStyle} />
        {brands.map((b, i) => (
          <Line
            key={b}
            type="monotone"
            dataKey={b}
            name={brandNames[b]}
            stroke={brandColor(b, i)}
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 10 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PresenceBarChart({
  data,
  brands,
  brandNames,
}: {
  data: PresencePoint[];
  brands: string[];
  brandNames: Record<string, string>;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} barCategoryGap="20%" barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="retailer" tick={axisTickSm} />
        <YAxis
          tick={axisTick}
          tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          width={42}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [`${v.toFixed(2)}%`, '']}
        />
        {brands.map((b, i) => (
          <Bar key={b} dataKey={b} name={brandNames[b]} fill={brandColor(b, i)} radius={[2, 2, 0, 0]} />
        ))}
        <Legend wrapperStyle={{ fontSize: 10 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function NoData({ needs }: { needs: string[] }) {
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>Данные не загружены. Загрузите: <span className="italic">{needs.join(', ')}</span></span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Availability() {
  const { projectId } = useProject();
  const [ecom, setEcom] = useState<EcomData | null>(null);
  const [pres, setPres] = useState<PresenceData | null>(null);
  const [ready, setReady] = useState(false);

  const [salesMp,      setSalesMp]      = useState('all');
  const [revenueMp,    setRevenueMp]    = useState('all');
  const [skuShareMp,   setSkuShareMp]   = useState('all');
  const [skuCountMp,   setSkuCountMp]   = useState('all');
  const [salesShareMp, setSalesShareMp] = useState('');

  useEffect(() => {
    if (ecom && ecom.marketplaces.length > 0) {
      setSalesShareMp(mp => mp || ecom.marketplaces[0]);
    }
  }, [ecom]);

  useEffect(() => {
    if (projectId === null) return;
    setReady(false);
    Promise.allSettled([
      api.getProjectData(projectId, 'ecom').then(d => setEcom(d as EcomData)),
      api.getProjectData(projectId, 'presence').then(d => setPres(d as PresenceData)),
    ]).then(() => setReady(true));
  }, [projectId]);

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
        Загрузка данных…
      </div>
    );
  }

  const salesFmt    = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000   ? `${(v / 1_000).toFixed(0)}K`
    : `${v}`;
  const revenueFmt  = (v: number) => `${v.toFixed(0)}M`;
  const skuShareFmt = (v: number) => `${v.toFixed(4)}%`;
  const salesShFmt  = (v: number) => `${v.toFixed(2)}%`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Availability & E-com</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Представленность в e-com, маркетплейсы, SKU, выручка
        </p>
      </div>

      {/* ── E-commerce секция ───────────────────────────────────────── */}
      {!ecom ? (
        <NoData needs={['E-commerce (ecom)']} />
      ) : (
        <>
          {/* ── Продажи + Выручка ──────────────────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-4">
            {ecom.charts.sales && (
              <ChartCard
                title="Продажи в штуках"
                subtitle={`Кол-во продаж · ${MP_LABEL_MAP[salesMp] ?? salesMp}`}
                headerExtra={<MpTabs value={salesMp} onChange={setSalesMp} marketplaces={ecom.marketplaces} />}
              >
                <EcomLineChart
                  data={ecom.charts.sales[salesMp] ?? []}
                  brands={ecom.brands}
                  brandNames={ecom.brandNames}
                  tickFmt={salesFmt}
                />
              </ChartCard>
            )}

            {ecom.charts.revenue && (
              <ChartCard
                title="Выручка по брендам"
                subtitle={`млн ₽ · ${MP_LABEL_MAP[revenueMp] ?? revenueMp}`}
                headerExtra={<MpTabs value={revenueMp} onChange={setRevenueMp} marketplaces={ecom.marketplaces} />}
              >
                <EcomLineChart
                  data={ecom.charts.revenue[revenueMp] ?? []}
                  brands={ecom.brands}
                  brandNames={ecom.brandNames}
                  tickFmt={revenueFmt}
                />
              </ChartCard>
            )}
          </div>

          {/* ── Доля SKU + Количество SKU ───────────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-4">
            {ecom.charts.skuShare && (
              <ChartCard
                title="Доля на маркетплейсе"
                subtitle={`% от ассортимента категории · ${MP_LABEL_MAP[skuShareMp] ?? skuShareMp}`}
                headerExtra={<MpTabs value={skuShareMp} onChange={setSkuShareMp} marketplaces={ecom.marketplaces} />}
              >
                <EcomLineChart
                  data={ecom.charts.skuShare[skuShareMp] ?? []}
                  brands={ecom.brands}
                  brandNames={ecom.brandNames}
                  tickFmt={skuShareFmt}
                  yWidth={70}
                />
              </ChartCard>
            )}

            {ecom.charts.skuCount && (
              <ChartCard
                title="Количество SKU"
                subtitle={`Динамика · ${MP_LABEL_MAP[skuCountMp] ?? skuCountMp}`}
                headerExtra={<MpTabs value={skuCountMp} onChange={setSkuCountMp} marketplaces={ecom.marketplaces} />}
              >
                <EcomLineChart
                  data={ecom.charts.skuCount[skuCountMp] ?? []}
                  brands={ecom.brands}
                  brandNames={ecom.brandNames}
                />
              </ChartCard>
            )}
          </div>

          {/* ── Доля продаж ─────────────────────────────────────────────── */}
          {ecom.charts.salesShare && (
            <ChartCard
              title="Доля продаж по брендам"
              subtitle={`% от продаж категории · ${MP_LABEL_MAP[salesShareMp] ?? salesShareMp}`}
              headerExtra={<MpTabs value={salesShareMp} onChange={setSalesShareMp} marketplaces={ecom.marketplaces} showAll={false} />}
            >
              <EcomLineChart
                data={ecom.charts.salesShare[salesShareMp] ?? []}
                brands={ecom.brands}
                brandNames={ecom.brandNames}
                tickFmt={salesShFmt}
              />
            </ChartCard>
          )}
        </>
      )}

      {/* ── Представленность секция ─────────────────────────────────── */}
      {!pres ? (
        <NoData needs={['Представленность (presence)']} />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard
            title="Представленность в ритейлерах в е-коме"
            subtitle="Доля SKU в ассортименте ритейлера, %"
          >
            <PresenceBarChart
              data={pres.retail}
              brands={pres.brands}
              brandNames={pres.brandNames}
            />
          </ChartCard>

          <ChartCard
            title="Представленность у сервисов доставки"
            subtitle="Доля SKU в ассортименте сервиса, %"
          >
            <PresenceBarChart
              data={pres.delivery}
              brands={pres.brands}
              brandNames={pres.brandNames}
            />
          </ChartCard>
        </div>
      )}
    </div>
  );
}
