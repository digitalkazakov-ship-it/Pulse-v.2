import { useState, useEffect, useMemo, useRef } from 'react';
import JSZip from 'jszip';
import { CloudUpload, CircleCheck, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { api, type Snapshot } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';

const DATA_TYPES: { value: string; label: string; multi: boolean; hint: string }[] = [
  { value: 'bht',          label: 'BHT (Brand Health Tracking)',  multi: false, hint: 'Один .xlsx файл' },
  { value: 'sales',        label: 'Продажи',                      multi: false, hint: 'Один .xlsx файл' },
  { value: 'ad_spend',     label: 'Медиаинвестиции (Flowchart)',  multi: false, hint: 'Один .xlsx файл' },
  { value: 'creatives',    label: 'Креативы Медиа',               multi: false, hint: 'Один .xlsx файл' },
  { value: 'ecom',         label: 'E-commerce',                   multi: false, hint: 'Один .xlsx файл' },
  { value: 'presence',     label: 'Представленность',             multi: false, hint: 'Один .xlsx файл' },
  { value: 'perception',   label: 'Восприятие (Perception)',      multi: false, hint: 'Один .xlsx файл' },
  { value: 'media_details',label: 'Media Details',                multi: false, hint: 'Один .xlsx файл' },
  { value: 'neuro',        label: 'Нейро-маркетинг',             multi: true,  hint: 'Несколько .xlsx (Google + Yandex)' },
  { value: 'wordstat',     label: 'Wordstat',                     multi: true,  hint: 'Несколько .xlsx — по одному на бренд' },
  { value: 'digital',      label: 'Site Stats (Digital Audit)',   multi: true,  hint: 'Несколько .xlsx (текущий + прошлый год)' },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

async function buildFile(files: File[], multi: boolean): Promise<File> {
  if (!multi || files.length === 1) return files[0];
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f);
  const blob = await zip.generateAsync({ type: 'blob' });
  const name = `${files.length}_файлов.zip`;
  return new File([blob], name, { type: 'application/zip' });
}

export default function Upload() {
  const { projectId, projects } = useProject();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [successes, setSuccesses] = useState<Record<string, boolean>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const currentProject = projects.find(p => p.id === projectId);

  useEffect(() => {
    if (projectId === null) return;
    setSnapshots([]);
    api.getSnapshots(projectId).then(setSnapshots).catch(console.error);
  }, [projectId]);

  const latestByType = useMemo(() => {
    const map: Record<string, Snapshot> = {};
    for (const s of snapshots) {
      if (!map[s.data_type] || s.uploaded_at > map[s.data_type].uploaded_at) {
        map[s.data_type] = s;
      }
    }
    return map;
  }, [snapshots]);

  async function handleFiles(dataType: string, fileList: FileList, multi: boolean) {
    if (projectId === null || fileList.length === 0) return;
    setUploading(prev => ({ ...prev, [dataType]: true }));
    setErrors(prev => { const n = { ...prev }; delete n[dataType]; return n; });
    setSuccesses(prev => { const n = { ...prev }; delete n[dataType]; return n; });
    try {
      const file = await buildFile(Array.from(fileList), multi);
      await api.uploadFile(projectId, dataType, file);
      const updated = await api.getSnapshots(projectId);
      setSnapshots(updated);
      setSuccesses(prev => ({ ...prev, [dataType]: true }));
      setTimeout(() => {
        setSuccesses(prev => { const n = { ...prev }; delete n[dataType]; return n; });
      }, 3000);
    } catch (err) {
      setErrors(prev => ({ ...prev, [dataType]: String(err) }));
    } finally {
      setUploading(prev => { const n = { ...prev }; delete n[dataType]; return n; });
    }
  }

  if (projectId === null) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">Сначала выберите или создайте проект.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Загрузка данных</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Проект: <span className="font-medium text-foreground">{currentProject?.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {DATA_TYPES.map(dt => {
          const snap        = latestByType[dt.value];
          const isUploading = !!uploading[dt.value];
          const error       = errors[dt.value];
          const success     = successes[dt.value];

          return (
            <div
              key={dt.value}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight">{dt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{dt.hint}</p>
                </div>
                {snap ? (
                  <CircleCheck className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                ) : (
                  <div className="w-4 h-4 shrink-0 rounded-full border-2 border-muted-foreground/30 mt-0.5" />
                )}
              </div>

              {/* Current file info */}
              {snap ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate" title={snap.source_filename ?? undefined}>
                    {snap.source_filename ?? 'неизвестный файл'}
                  </span>
                  <span className="shrink-0 text-muted-foreground/60">· {formatDate(snap.uploaded_at)}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic">Данные не загружены</p>
              )}

              {/* Feedback */}
              {error && (
                <p className="text-xs text-red-600 leading-snug break-words">{error}</p>
              )}
              {success && (
                <p className="text-xs text-emerald-600">Загружено успешно</p>
              )}

              {/* Button */}
              <button
                onClick={() => inputRefs.current[dt.value]?.click()}
                disabled={isUploading}
                className="mt-auto flex items-center justify-center gap-1.5 w-full rounded-md border border-border bg-secondary text-foreground text-xs font-medium px-3 py-2 hover:bg-muted transition-colors disabled:opacity-50"
              >
                {isUploading
                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  : <CloudUpload className="w-3.5 h-3.5" />}
                {isUploading ? 'Загрузка…' : snap ? 'Обновить' : 'Загрузить'}
              </button>

              {/* Hidden file input */}
              <input
                ref={el => { inputRefs.current[dt.value] = el; }}
                type="file"
                accept=".xlsx"
                multiple={dt.multi}
                className="hidden"
                onChange={e => {
                  if (e.target.files?.length) handleFiles(dt.value, e.target.files, dt.multi);
                  e.target.value = '';
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
