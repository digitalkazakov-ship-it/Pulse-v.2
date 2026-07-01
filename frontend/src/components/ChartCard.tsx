import { Info } from 'lucide-react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  headerExtra?: React.ReactNode;
}

export function ChartCard({ title, subtitle, children, className = '', headerExtra }: ChartCardProps) {
  return (
    <div className={`chart-container animate-fade-in ${className}`}>
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="section-title">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {headerExtra}
          <button className="text-muted-foreground hover:text-foreground transition-colors" title="Подробнее">
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
