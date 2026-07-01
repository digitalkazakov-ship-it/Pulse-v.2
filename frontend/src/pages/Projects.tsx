import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CirclePlus, Trash2, FolderOpen, Pencil, Check, X, Link2Off, Copy } from 'lucide-react';
import { api, type Project } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';

function ProjectCard({ p, isActive, onSelect, onDelete, onRefresh }: {
  p: Project;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [editBrand, setEditBrand] = useState(false);
  const [brand, setBrand] = useState(p.client_brand ?? '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);

  function shareUrl(token: string) {
    return `${window.location.origin}/share/${token}`;
  }

  async function copyToClipboard(token: string) {
    await navigator.clipboard.writeText(shareUrl(token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    setSharingBusy(true);
    try {
      const { share_token } = p.share_token
        ? { share_token: p.share_token }
        : await api.createShareToken(p.id);
      onRefresh();
      await copyToClipboard(share_token);
    } catch (err) {
      alert(String(err));
    } finally {
      setSharingBusy(false);
    }
  }

  async function handleRevoke() {
    if (!confirm('Отозвать ссылку? Коллеги потеряют доступ.')) return;
    try {
      await api.revokeShareToken(p.id);
      onRefresh();
    } catch (err) {
      alert(String(err));
    }
  }

  useEffect(() => {
    setBrand(p.client_brand ?? '');
  }, [p.client_brand]);

  async function saveBrand() {
    setSaving(true);
    try {
      await api.updateProject(p.id, { client_brand: brand.trim() || null });
      onRefresh();
      setEditBrand(false);
    } catch (err) {
      alert(String(err));
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setBrand(p.client_brand ?? '');
    setEditBrand(false);
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
      isActive ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'
    }`}>
      <FolderOpen className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
        {editBrand ? (
          <div className="flex items-center gap-1 mt-1">
            <input
              autoFocus
              value={brand}
              onChange={e => setBrand(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveBrand(); if (e.key === 'Escape') cancelEdit(); }}
              placeholder="Клиентский бренд…"
              className="text-xs bg-secondary text-foreground px-2 py-0.5 rounded border border-border focus:outline-none focus:ring-1 focus:ring-ring w-44"
            />
            <button onClick={saveBrand} disabled={saving} className="text-primary hover:opacity-80 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-muted-foreground">
              {p.client_brand
                ? <>Бренд: <span className="font-medium text-foreground">{p.client_brand}</span></>
                : <span className="italic">бренд не задан</span>
              }
            </span>
            <button onClick={() => setEditBrand(true)} className="text-muted-foreground hover:text-foreground transition-colors" title="Задать клиентский бренд">
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(p.created_at).toLocaleDateString('ru-RU')}
          {isActive && <span className="ml-2 text-primary font-medium">• активный</span>}
        </p>
      </div>
      <button
        onClick={onSelect}
        disabled={isActive}
        className="text-xs text-primary font-medium px-3 py-1.5 rounded-md border border-primary hover:bg-primary/10 disabled:opacity-40 transition-colors"
      >
        Открыть
      </button>
      <button
        onClick={handleShare}
        disabled={sharingBusy}
        title={p.share_token ? 'Скопировать ссылку' : 'Создать ссылку для просмотра'}
        className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
      >
        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      </button>
      {p.share_token && (
        <button onClick={handleRevoke} title="Отозвать ссылку" className="text-muted-foreground hover:text-red-500 transition-colors">
          <Link2Off className="w-4 h-4" />
        </button>
      )}
      <button onClick={onDelete} className="text-muted-foreground hover:text-red-500 transition-colors" title="Удалить">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function Projects() {
  const { projects, projectId, setProjectId, refresh } = useProject();
  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError('');
    try {
      const p = await api.createProject(name, newBrand.trim() || null);
      refresh();
      setProjectId(p.id);
      setNewName('');
      setNewBrand('');
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Удалить проект и все его данные?')) return;
    try {
      await api.deleteProject(id);
      if (projectId === id) setProjectId(null);
      refresh();
    } catch (err) {
      alert(String(err));
    }
  }

  function handleSelect(id: number) {
    setProjectId(id);
    navigate('/');
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Проекты</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Создайте проект для каждого клиента и загружайте данные независимо.
        </p>
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          placeholder="Название проекта…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 bg-secondary text-foreground text-sm px-3 py-2 rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          type="text"
          placeholder="Клиентский бренд…"
          value={newBrand}
          onChange={(e) => setNewBrand(e.target.value)}
          className="w-44 bg-secondary text-foreground text-sm px-3 py-2 rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <CirclePlus className="w-4 h-4" />
          Создать
        </button>
      </form>
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* List */}
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет проектов. Создайте первый.</p>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              p={p}
              isActive={p.id === projectId}
              onSelect={() => handleSelect(p.id)}
              onDelete={() => handleDelete(p.id)}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
