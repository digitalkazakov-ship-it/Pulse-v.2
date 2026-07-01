import { useState } from 'react';
import { Calendar, ChevronDown, Download, RefreshCw } from 'lucide-react';
import { BRANDS, CATEGORIES, CHANNELS, REGIONS } from '@/data/mockData';

function FilterDropdown({ label, options, value, onChange }: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-secondary text-secondary-foreground text-xs font-medium px-3 py-2 pr-7 rounded-md border border-border cursor-pointer hover:bg-accent transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="all">{label}: Все</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
    </div>
  );
}

export function FilterBar() {
  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('BrandX');
  const [channel, setChannel] = useState('all');
  const [region, setRegion] = useState('all');
  const [period, setPeriod] = useState('2024-12');

  return (
    <div className="filter-bar sticky top-0 z-20">
      <div className="flex items-center gap-2 mr-3">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="bg-secondary text-secondary-foreground text-xs font-medium px-3 py-2 rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <FilterDropdown label="Бренд" options={BRANDS} value={brand} onChange={setBrand} />
      <FilterDropdown label="Категория" options={CATEGORIES} value={category} onChange={setCategory} />
      <FilterDropdown label="Канал" options={CHANNELS} value={channel} onChange={setChannel} />
      <FilterDropdown label="Регион" options={REGIONS} value={region} onChange={setRegion} />

      <div className="ml-auto flex items-center gap-2">
        <button className="flex items-center gap-1.5 bg-secondary text-secondary-foreground text-xs font-medium px-3 py-2 rounded-md border border-border hover:bg-accent transition-colors">
          <RefreshCw className="w-3 h-3" />
          Обновить
        </button>
        <button className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium px-3 py-2 rounded-md hover:opacity-90 transition-opacity">
          <Download className="w-3 h-3" />
          Export
        </button>
      </div>
    </div>
  );
}
