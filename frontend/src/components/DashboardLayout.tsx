import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Eye,
  MessageCircle,
  Globe,
  ShoppingCart,
  TrendingUp,
  Megaphone,
  Film,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  CloudUpload,
  Lightbulb,
  MessageSquare,
} from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';

const NAV_ITEMS = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/awareness', label: 'Brand Awareness', icon: Eye },
  { path: '/perception', label: 'Perception & Social', icon: MessageCircle },
  { path: '/digital', label: 'Site stats', icon: Globe },
  { path: '/availability', label: 'Availability & E-com', icon: ShoppingCart },
  { path: '/sales', label: 'Sales', icon: TrendingUp },
  { path: '/media', label: 'Media & Creatives', icon: Megaphone },
  { path: '/media-details', label: 'Media Details', icon: Film },
  { path: '/insights', label: 'Стратег. выводы', icon: Lightbulb },
  { path: '/conversations', label: 'Темы для встречи', icon: MessageSquare },
];

const BOTTOM_ITEMS = [
  { path: '/upload', label: 'Загрузка данных', icon: CloudUpload },
  { path: '/projects', label: 'Проекты', icon: FolderOpen },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { projectId, projects } = useProject();

  const currentProject = projects.find(p => p.id === projectId);

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-30 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Logo */}
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

        {/* Project indicator */}
        {!collapsed && (
          <div className="px-3 py-2 border-b border-sidebar-border">
            <Link
              to="/projects"
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5 text-sidebar-muted shrink-0" />
              <span className={`text-xs truncate ${currentProject ? 'text-sidebar-accent-foreground font-medium' : 'text-sidebar-muted'}`}>
                {currentProject ? currentProject.name : 'Выбрать проект'}
              </span>
            </Link>
          </div>
        )}

        {/* Main nav */}
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

        {/* Bottom nav */}
        <div className="py-2 px-2 border-t border-sidebar-border space-y-1">
          {BOTTOM_ITEMS.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
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
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 border-t border-sidebar-border text-sidebar-muted hover:text-sidebar-accent-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main content */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          collapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
