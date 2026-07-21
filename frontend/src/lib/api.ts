const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api';

// Offline single-file archive build: page components call api.getProjectData/getInsights
// exactly as normal, but data comes from a bundled JS object instead of a network request.
// ArchiveApp calls setArchiveSource() once at startup; everywhere else is unaware of the difference.
let archiveSource: { data: Record<string, unknown>; insights: Record<string, unknown> } | null = null;

export function setArchiveSource(source: { data: Record<string, unknown>; insights: Record<string, unknown> }) {
  archiveSource = source;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface Project {
  id: number;
  name: string;
  client_brand: string | null;
  share_token: string | null;
  created_at: string;
}

export interface PublicProject {
  id: number;
  name: string;
}

export interface UploadResult {
  status: string;
  snapshot_id: number;
  data_type: string;
  period: string | null;
}

export interface Snapshot {
  id: number;
  project_id: number;
  data_type: string;
  period: string | null;
  uploaded_at: string;
  source_filename: string | null;
}

export interface InsightsData {
  available: boolean;
  generatedAt?: string;
  [key: string]: string | boolean | undefined;
}

export interface TopicData {
  title: string;
  priority: number;
  factSource: string;
  fact: string;
  meaning: string;
  question: string;
  solution: string;
}

export interface ConversationsData {
  available: boolean;
  generatedAt?: string;
  topics?: TopicData[];
}

export const api = {
  getProjects: (): Promise<Project[]> =>
    request('/projects'),

  createProject: (name: string, client_brand?: string | null): Promise<Project> =>
    request('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, client_brand: client_brand ?? null }),
    }),

  updateProject: (id: number, data: { name?: string; client_brand?: string | null }): Promise<Project> =>
    request(`/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  deleteProject: (id: number): Promise<void> =>
    request(`/projects/${id}`, { method: 'DELETE' }),

  getProjectData: (projectId: number, dataType: string): Promise<unknown> => {
    if (archiveSource) {
      const d = archiveSource.data[dataType];
      return d !== undefined ? Promise.resolve(d) : Promise.reject(new Error(`No archived data for ${dataType}`));
    }
    return request(`/projects/${projectId}/data/${dataType}`);
  },

  getSnapshots: (projectId: number): Promise<Snapshot[]> =>
    request(`/projects/${projectId}/snapshots`),

  uploadFile: (projectId: number, dataType: string, file: File): Promise<UploadResult> => {
    const form = new FormData();
    form.append('file', file);
    return request(`/projects/${projectId}/upload/${dataType}`, {
      method: 'POST',
      body: form,
    });
  },

  getInsights: (projectId: number): Promise<InsightsData> =>
    archiveSource
      ? Promise.resolve(archiveSource.insights as InsightsData)
      : request(`/projects/${projectId}/insights`),

  generateInsights: (projectId: number): Promise<InsightsData> =>
    request(`/projects/${projectId}/insights/generate`, { method: 'POST' }),

  getConversations: (projectId: number): Promise<ConversationsData> =>
    request(`/projects/${projectId}/conversations`),

  generateConversations: (projectId: number): Promise<ConversationsData> =>
    request(`/projects/${projectId}/conversations/generate`, { method: 'POST' }),

  createShareToken: (projectId: number): Promise<{ share_token: string }> =>
    request(`/projects/${projectId}/share`, { method: 'POST' }),

  revokeShareToken: (projectId: number): Promise<{ status: string }> =>
    request(`/projects/${projectId}/share`, { method: 'DELETE' }),

  getPublicProject: (token: string): Promise<PublicProject> =>
    request(`/public/${token}`),
};
