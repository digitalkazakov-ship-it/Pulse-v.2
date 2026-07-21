import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Eye, MessageCircle, Globe, ShoppingCart,
  TrendingUp, Megaphone, Film, ChevronLeft, ChevronRight,
  Lightbulb,
} from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { ARCHIVE_ASSETS } from './archive-assets';

function ArchiveSidebar({ collapsed, setCollapsed }: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  const location = useLocation();
  const { projects, availableTypes } = useProject();
  const projectName = projects[0]?.name ?? '';

  const NAV_ITEMS: { path: string; label: string; icon: typeof Eye; dataType?: string }[] = [
    { path: '/awareness',      label: 'Brand Health метрики', icon: Eye },
    { path: '/perception',     label: 'Имиджевые характеристики', icon: MessageCircle, dataType: 'perception' },
    { path: '/digital',        label: 'Метрики сайта',            icon: Globe, dataType: 'digital' },
    { path: '/availability',   label: 'E-com',                icon: ShoppingCart },
    { path: '/sales',          label: 'Продажи',              icon: TrendingUp },
    { path: '/media',          label: 'Креативы',             icon: Megaphone },
    { path: '/media-details',  label: 'Медиа',                icon: Film },
    { path: '/insights',       label: 'Стратег. выводы',      icon: Lightbulb },
  ].filter(item => !item.dataType || availableTypes.has(item.dataType));

  const bgStyle = {
    backgroundImage: `url('${ARCHIVE_ASSETS.sidebarBg}')`,
    backgroundSize: 'cover',
    backgroundPosition: '75% center',
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-full z-30 flex flex-col border-r border-white/10 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}
      style={bgStyle}
    >
      <div
        className="px-3 h-[138px] flex items-center justify-center"
        style={{ backgroundImage: 'linear-gradient(180deg,rgba(255,255,255,0.55) 0%,rgba(255,255,255,0.55) 80%,rgba(255,255,255,0) 100%)' }}
      >
        <img
          src={ARCHIVE_ASSETS.logo}
          alt="Horizons Pulse"
          className={collapsed ? 'h-6 w-auto object-contain' : 'h-10 w-auto object-contain'}
        />
      </div>

      {!collapsed && projectName && (
        <div className="px-3 py-2 border-b border-white/10">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/10">
            <span className="text-xs text-white font-medium truncate">{projectName}</span>
          </div>
        </div>
      )}

      <nav className="flex-1 py-4 space-y-1.5 px-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-white transition-colors ${
                active ? 'bg-black/25 font-medium' : 'bg-black/10 hover:bg-black/20'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-4 pb-3 flex flex-col items-center gap-1.5">
          <img src={ARCHIVE_ASSETS.qr} alt="QR-код" className="w-24 h-24 rounded-md bg-white p-1.5" />
          <p className="text-[9px] text-white/75 text-center leading-tight">
            Оставьте заявку на бесплатное демо
          </p>
        </div>
      )}

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-white/10 text-white/70 hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}

export function ArchiveLayout() {
  const [collapsed, setCollapsed] = useState(false);

  const mainBgStyle = {
    backgroundImage: `linear-gradient(rgba(255,255,255,0.72), rgba(255,255,255,0.72)), url('${ARCHIVE_ASSETS.sidebarBg}')`,
    backgroundSize: 'cover',
    backgroundPosition: '75% center',
  };

  return (
    <div className="flex min-h-screen w-full">
      <ArchiveSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-60'}`}>
        <main className="flex-1 min-w-0 p-6 overflow-auto" style={mainBgStyle}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
