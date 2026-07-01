import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: number;
  unit?: string;
  mom?: number;
  yoy?: number;
  rank?: number;
}

export function KpiCard({ label, value, unit = '', mom, yoy, rank }: KpiCardProps) {
  const formatChange = (val: number | undefined) => {
    if (val === undefined) return null;
    const isPositive = val > 0;
    const isNeutral = val === 0;
    return (
      <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-success' : isNeutral ? 'text-muted-foreground' : 'text-destructive'}`}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : isNeutral ? <Minus className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isPositive ? '+' : ''}{val}{unit === '%' ? ' п.п.' : ''}
      </span>
    );
  };

  return (
    <div className="kpi-card animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        {rank && (
          <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
            #{rank}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-foreground mb-3">
        {value}{unit}
      </div>
      <div className="flex items-center gap-4">
        {mom !== undefined && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">MoM:</span>
            {formatChange(mom)}
          </div>
        )}
        {yoy !== undefined && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">YoY:</span>
            {formatChange(yoy)}
          </div>
        )}
      </div>
    </div>
  );
}
