import { useState } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import {
  LayoutDashboard, Eye, MessageCircle, Globe, ShoppingCart,
  TrendingUp, Megaphone, Film, BarChart3, ChevronLeft, ChevronRight,
  Lightbulb, MessageSquare,
} from 'lucide-react';
import { ShareProjectProvider, useProject } from '@/contexts/ProjectContext';

function ShareSidebar({ token, collapsed, setCollapsed }: {
  token: string;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  const location = useLocation();
  const { projects } = useProject();
  const projectName = projects[0]?.name ?? '';

  const base = `/share/${token}`;
  const NAV_ITEMS = [
    { path: base,                    label: 'Overview',             icon: LayoutDashboard },
    { path: `${base}/awareness`,     label: 'Brand Awareness',      icon: Eye },
    { path: `${base}/perception`,    label: 'Perception & Social',  icon: MessageCircle },
    { path: `${base}/digital`,       label: 'Site stats',           icon: Globe },
    { path: `${base}/availability`,  label: 'Availability & E-com', icon: ShoppingCart },
    { path: `${base}/sales`,         label: 'Sales',                icon: TrendingUp },
    { path: `${base}/media`,         label: 'Креативы',             icon: Megaphone },
    { path: `${base}/media-details`, label: 'Медиа',                icon: Film },
    { path: `${base}/insights`,      label: 'Стратег. выводы',      icon: Lightbulb },
    { path: `${base}/conversations`, label: 'Темы для встречи',     icon: MessageSquare },
  ];

  return (
    <aside className={`fixed top-0 left-0 h-full z-30 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
      <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <BarChart3 className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="text-sidebar-accent-foreground font-semibold text-sm tracking-tight truncate">
            Brand Tracker
          </span>
        )}
      </div>

      {!collapsed && projectName && (
        <div className="px-3 py-2 border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md">
            <span className="text-xs text-sidebar-accent-foreground font-medium truncate">{projectName}</span>
          </div>
        </div>
      )}

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-sidebar-border text-sidebar-muted hover:text-sidebar-accent-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}

function ShareLayoutInner() {
  const [collapsed, setCollapsed] = useState(false);
  const { token } = useParams<{ token: string }>();

  return (
    <div className="flex min-h-screen w-full">
      <ShareSidebar token={token!} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-60'}`}>
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function ShareLayout() {
  const { token } = useParams<{ token: string }>();
  return (
    <ShareProjectProvider token={token!}>
      <ShareLayoutInner />
    </ShareProjectProvider>
  );
}
