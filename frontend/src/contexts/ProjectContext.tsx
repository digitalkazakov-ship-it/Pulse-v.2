import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Project } from '@/lib/api';

interface ProjectContextValue {
  projectId: number | null;
  setProjectId: (id: number | null) => void;
  projects: Project[];
  loading: boolean;
  refresh: () => void;
  isReadonly: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

const STORAGE_KEY = 'pulse_project_id';

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, _setProjectId] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : null;
  });

  function setProjectId(id: number | null) {
    _setProjectId(id);
    if (id === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  }

  async function refresh() {
    setLoading(true);
    try {
      const list = await api.getProjects();
      setProjects(list);
      if (projectId !== null && !list.find(p => p.id === projectId)) {
        setProjectId(list[0]?.id ?? null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <ProjectContext.Provider value={{ projectId, setProjectId, projects, loading, refresh, isReadonly: false }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function ShareProjectProvider({ token, children }: { token: string; children: ReactNode }) {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPublicProject(token)
      .then(({ id, name }) => {
        setProjectId(id);
        setProjects([{ id, name, client_brand: null, share_token: token, created_at: '' }]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <ProjectContext.Provider value={{
      projectId,
      setProjectId: () => {},
      projects,
      loading,
      refresh: () => {},
      isReadonly: true,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider');
  return ctx;
}
