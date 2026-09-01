import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Workflow,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  PlayCircle,
  StopCircle,
  RefreshCcwDot,
  HardDriveUpload,
  FolderSearch,
  CalendarClock,
  Settings2,
  ChevronDown,
  ChevronUp,
  DatabaseZap,
  Power,
  Info,
  Download,
  CircleDot,
  Layers3,
  Server,
  Activity,
} from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

interface JobProgressFile {
  idx?: number
  fileName?: string
  targetTable?: string | null
  insertedRows?: number
  skippedRows?: number
  skippedReason?: string | null
  atIso?: string
}

interface JobRecord {
  jobId: string
  kind: string
  status: JobStatus
  createdAtIso: string
  startedAtIso?: string
  finishedAtIso?: string
  totalFilesMatched?: number
  totalFilesScanned?: number
  totalRowsInserted?: number
  totalRowsSkipped?: number
  progressFiles?: JobProgressFile[]
  errorMessage?: string
  preImportSnapshotPath?: string
  cancelled?: boolean
  heartbeatAtIso?: string
  resultSummary?: unknown
  optsSnapshot?: unknown
}

const TARGETS: Array<{ value: string; label: string; desc: string }> = [
  { value: 'both', label: 'Completo (Extratos + Relatório + Recursos)', desc: 'Roda todos os órgãos em série (padrão)' },
  { value: 'extratos', label: 'Apenas Extratos', desc: 'Conciliação bancária de margem' },
  { value: 'relatorio', label: 'Apenas Relatório SISBR', desc: 'CSV enviado pela matriz Sicoob' },
  { value: 'recurso_alego', label: 'Recurso ALEGO', desc: 'Assembleia Legislativa de Goiás' },
  { value: 'recurso_adfego', label: 'Recurso ADFEGO', desc: 'Depósitos judiciais FEGO' },
  { value: 'recurso_tce', label: 'Recurso TCE-GO', desc: 'Tribunal de Contas do Estado' },
  { value: 'recurso_tcm', label: 'Recurso TCM-GO', desc: 'Tribunal de Contas dos Municípios' },
  { value: 'recurso_tre', label: 'Recurso TRE-GO', desc: 'Tribunal Regional Eleitoral' },
  { value: 'recurso_trt', label: 'Recurso TRT-18', desc: 'Tribunal Regional do Trabalho' },
  { value: 'recurso_eletra', label: 'Recurso ELETRO-GO', desc: 'Goiás Energia S.A.' },
  { value: 'recurso_mpgo', label: 'Recurso MPGO', desc: 'Ministério Público de Goiás' },
  { value: 'recurso_tjgo', label: 'Recurso TJGO', desc: 'Tribunal de Justiça de Goiás' },
  { value: 'recurso_neoconsig_demais', label: 'Demais Neoconsig', desc: 'Outros órgãos via padrão Neoconsig' },
  { value: 'extratos_todos', label: 'Extrato TODOS', desc: 'TODOS-MÊS-ANO.xlsx / Conta Corrente (CRÉD.TED-STR)' },
]

const STATUS_STYLES: Record<JobStatus, { label: string; bg: string; color: string; border: string; dot: string; icon: React.ReactNode }> = {
  queued: { label: 'Na fila', bg: 'bg-slate-100', color: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-500', icon: <Clock width={14} height={14} /> },
  running: { label: 'Executando', bg: 'bg-teal-50', color: 'text-teal-800', border: 'border-teal-200', dot: 'bg-teal-600', icon: <PlayCircle width={14} height={14} className="animate-pulse" /> },
  succeeded: { label: 'Concluído', bg: 'bg-emerald-50', color: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-600', icon: <CheckCircle2 width={14} height={14} /> },
  failed: { label: 'Falhou', bg: 'bg-red-50', color: 'text-red-800', border: 'border-red-200', dot: 'bg-red-600', icon: <XCircle width={14} height={14} /> },
  cancelled: { label: 'Cancelado', bg: 'bg-amber-50', color: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-600', icon: <StopCircle width={14} height={14} /> },
}

const KIND_LABELS: Record<string, string> = {
  runImportConsignado: 'Importação Principal (Lote Automático)',
  importByLearningProfileFromFolderUrl: 'Importação Pasta Específica (Perfil)',
  importByLearningProfileFromShareUrl: 'Importação por Arquivo (Share URL)',
}

function fmtIso(iso?: string): string {
  if (!iso) return '–'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
  } catch {
    return iso
  }
}

function fmtDuracao(aIso?: string, bIso?: string): string {
  if (!aIso || !bIso) return '–'
  const ms = new Date(bIso).getTime() - new Date(aIso).getTime()
  if (!isFinite(ms) || ms < 0) return '–'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

interface DriveHealthRes {
  overallOk: boolean
  checked: Record<string, { label: string; url?: string | null; result: { ok: boolean; reason?: string; driveId?: string; rootFolderId?: string; filesSample?: unknown[]; canWrite?: boolean } }>
}

export default function AutomacaoPage() {
  const aborterRef = useRef<{ [k: string]: AbortController }>({})
  const esRef = useRef<EventSource | null>(null)

  const [folderUrl, setFolderUrl] = useState('')
  const [target, setTarget] = useState<string>('both')
  const [targetOpen, setTargetOpen] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState<string | null>(null)
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobDetailOpen, setJobDetailOpen] = useState<string | null>(null)
  const [driveHealth, setDriveHealth] = useState<DriveHealthRes | null>(null)
  const [driveHealthLoading, setDriveHealthLoading] = useState(true)
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState(false)

  const activeJob: JobRecord | null = useMemo(
    () => (activeJobId ? jobs.find((j) => j.jobId === activeJobId) ?? null : null),
    [jobs, activeJobId],
  )

  const progressoPct: number = useMemo(() => {
    if (!activeJob) return 0
    const scanned = activeJob.totalFilesScanned || 0
    const matched = activeJob.totalFilesMatched || 0
    const files = activeJob.progressFiles?.length || 0
    const den = Math.max(1, matched || scanned || 1)
    const base = Math.min(100, (files / den) * 80)
    const statusBump = activeJob.status === 'succeeded' || activeJob.status === 'failed' || activeJob.status === 'cancelled' ? 20 : activeJob.status === 'running' ? 5 : 0
    return Math.min(100, Math.max(0, base + statusBump))
  }, [activeJob])

  const kindLabel = (k: string): string => KIND_LABELS[k] ?? k

  async function runFetch<T>(path: string, opts?: RequestInit): Promise<T> {
    const key = `${Date.now()}-${Math.random()}`
    const ctrl = new AbortController()
    aborterRef.current[key] = ctrl
    try {
      const res = await fetch(path, {
        credentials: 'same-origin',
        signal: ctrl.signal,
        ...(opts || {}),
        headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
      })
      const text = await res.text()
      let data: unknown = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = text
      }
      if (!res.ok) {
        const msg = typeof data === 'object' && data && 'message' in (data as any) ? String((data as any).message) : `HTTP ${res.status}`
        throw new Error(msg)
      }
      return data as T
    } finally {
      delete aborterRef.current[key]
    }
  }

  async function loadJobs(forceToast?: boolean) {
    try {
      setListLoading(true)
      const list = await runFetch<{ jobs: JobRecord[]; totalInMemory: number }>('/api/consignado/jobs?limit=80')
      setJobs(list.jobs.sort((a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime()))
      setLastRefreshAt(new Date().toISOString())
      if (forceToast && list.jobs.length > 0) toast.success(`Histórico carregado (${list.jobs.length} jobs).`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar jobs.')
    } finally {
      setListLoading(false)
    }
  }

  async function loadDriveHealth() {
    try {
      setDriveHealthLoading(true)
      const data = await runFetch<DriveHealthRes>('/api/consignado/automation/health/drive?which=all')
      setDriveHealth(data)
    } catch (e) {
      setDriveHealth(null)
      toast.warning(`Health Drive: ${e instanceof Error ? e.message : 'Falha'}`)
    } finally {
      setDriveHealthLoading(false)
    }
  }

  function openSse(jobId: string) {
    try {
      if (esRef.current) {
        try { esRef.current.close() } catch { /* ignore */ }
        esRef.current = null
      }
      const es = new EventSource(`/api/consignado/jobs/stream/${encodeURIComponent(jobId)}`)
      esRef.current = es
      es.addEventListener('hello', (ev) => {
        try {
          const p = JSON.parse(ev.data) as { initial?: JobRecord }
          if (p.initial) setJobs((prev) => { const next = prev.filter((j) => j.jobId !== p.initial!.jobId); return [p.initial!, ...next].sort((a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime()) })
        } catch { /* ignore */ }
      })
      es.addEventListener('progress', (ev) => {
        try {
          const p = JSON.parse(ev.data) as Partial<JobRecord>
          setJobs((prev) => prev.map((j) => (j.jobId === jobId ? { ...j, ...p, progressFiles: p.progressFiles || j.progressFiles, heartbeatAtIso: new Date().toISOString() } : j)))
        } catch { /* ignore */ }
      })
      es.addEventListener('final', (ev) => {
        try {
          const p = JSON.parse(ev.data) as { summary?: JobRecord; status?: JobStatus }
          if (p.summary) {
            setJobs((prev) => { const next = prev.filter((j) => j.jobId !== p.summary!.jobId); return [p.summary!, ...next].sort((a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime()) })
          }
          toast.success(p.status === 'succeeded' ? 'Importação concluída com sucesso!' : p.status === 'cancelled' ? 'Importação cancelada.' : p.status === 'failed' ? 'Importação falhou — ver detalhe.' : 'Job finalizado.')
          try { es.close() } catch { /* ignore */ }
          esRef.current = null
        } catch { /* ignore */ }
      })
      es.addEventListener('heartbeat', () => {
        setJobs((prev) => prev.map((j) => (j.jobId === jobId ? { ...j, heartbeatAtIso: new Date().toISOString() } : j)))
      })
      es.onerror = () => {
        try { es.close() } catch { /* ignore */ }
        esRef.current = null
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao abrir stream SSE.')
    }
  }

  useEffect(() => {
    void loadJobs()
    void loadDriveHealth()
    const t1 = setInterval(() => { void loadJobs() }, 15000)
    const t2 = setInterval(() => { void loadDriveHealth() }, 60000)
    return () => {
      clearInterval(t1)
      clearInterval(t2)
      Object.values(aborterRef.current).forEach((c) => { try { c.abort() } catch { /* ignore */ } })
      try { esRef.current?.close() } catch { /* ignore */ }
      esRef.current = null
    }
  }, [])

  useEffect(() => {
    const anyRunning = jobs.find((j) => j.status === 'running' || j.status === 'queued')
    if (anyRunning && (!activeJobId || (anyRunning.jobId !== activeJobId && (anyRunning.status === 'running' || !jobs.find((j) => j.status === 'running'))))) {
      setActiveJobId(anyRunning.jobId)
      openSse(anyRunning.jobId)
    }
    if (activeJobId && activeJob && (activeJob.status === 'succeeded' || activeJob.status === 'failed' || activeJob.status === 'cancelled')) {
      setTimeout(() => { if (esRef.current) { try { esRef.current.close() } catch { /* ignore */ } esRef.current = null } }, 3000)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const url = folderUrl.trim()
    if (target !== 'both' && target !== 'extratos' && target !== 'relatorio') {
      if (!url) { toast.warning('Informe a URL da pasta/arquivo do SharePoint para este órgão.'); return }
    }
    try {
      setImportLoading(true)
      const body: Record<string, unknown> = { mode: 'append', target }
      if (url) {
        if (target === 'both' || target === 'extratos' || target === 'relatorio') body.folderUrl = url
        else body.learningUrl = url
      }
      const res = await runFetch<{
        accepted?: boolean; async?: boolean; jobId?: string; status?: JobStatus; createdAtIso?: string; kind?: string; streamUrl?: string; statusUrl?: string; cancelUrl?: string;
        importedFiles?: unknown[]; error?: string
      }>('/api/consignado/import', { method: 'POST', body: JSON.stringify(body) })
      if (res.accepted && res.jobId) {
        toast.success(`Job ${res.jobId.slice(-8)} criado e colocado na fila.`, { description: `Kind: ${kindLabel(res.kind ?? '')}` })
        setActiveJobId(res.jobId)
        await loadJobs()
        openSse(res.jobId)
      } else {
        toast.success('Importação concluída imediatamente (modo sync).')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao submeter importação.')
    } finally {
      setImportLoading(false)
    }
  }

  async function handleCancel(jobId: string) {
    try {
      setCancelLoading(jobId)
      const r = await runFetch<{ ok: boolean; reason?: string }>(`/api/consignado/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST', body: '{}' })
      if (r.ok) { toast.message('Solicitação de cancelamento enviada.', { description: 'Aguarde o ponto seguro de cancelamento (entre arquivos).' }) }
      else toast.warning(r.reason || 'Não foi possível cancelar.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao cancelar.')
    } finally {
      setCancelLoading(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif", color: '#003641' }}>
      <Toaster position="top-right" richColors closeButton theme="light" />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 20px 60px' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #00AE9D, #008C7D)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 10px 24px rgba(0,174,157,0.25)' }}>
              <Workflow width={30} height={30} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#00AE9D', letterSpacing: 1.2, textTransform: 'uppercase' }}>Automação de Importações</div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#003641' }}>Painel Central de Importação Assíncrona</h1>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Fila FIFO concorrência=1 • Retry exponencial Graph • Status em tempo real via SSE • Zero bloqueio de UI.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { void loadDriveHealth(); void loadJobs(true) }} style={btnSecondary()} title="Atualizar dados">
              <RefreshCcwDot width={16} height={16} /> Atualizar tudo
            </button>
            <a href="/credito" style={{ ...btnSecondary(), textDecoration: 'none' }}>
              <Layers3 width={16} height={16} /> Crédito Consignado
            </a>
            <a href="/" style={{ ...btnSecondary(), textDecoration: 'none' }}>
              <Server width={16} height={16} /> Portal
            </a>
          </div>
        </header>

        {/* DRIVE HEALTH */}
        <section style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <FolderSearch width={18} height={18} color="#00AE9D" />
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Saúde das Pastas do SharePoint Graph</h2>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {driveHealthLoading ? 'Verificando agora...' : lastRefreshAt ? `Última: ${fmtIso(lastRefreshAt)}` : ''}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {driveHealth ? Object.entries(driveHealth.checked).map(([k, v]) => {
              const ok = v.result.ok
              return (
                <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                  style={{
                    padding: 16, borderRadius: 14, border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
                    background: ok ? 'linear-gradient(180deg, #ecfdf5, #ffffff)' : 'linear-gradient(180deg, #fef2f2, #ffffff)',
                    boxShadow: '0 6px 20px -8px rgba(0,0,0,0.1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 750, color: '#003641' }}>{v.label}</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: ok ? '#16a34a' : '#dc2626', color: '#fff' }}>
                      {ok ? <CheckCircle2 width={12} height={12} /> : <AlertTriangle width={12} height={12} />}
                      {ok ? 'OK' : 'FALHA'}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={v.url || ''}>
                    {v.url || 'URL não configurada'}
                  </div>
                  {!ok ? <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 8, fontWeight: 600 }}>{v.result.reason || 'Falha desconhecida'}</div> : null}
                </motion.div>
              )
            }) : driveHealthLoading ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: 16, borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff88', minHeight: 84 }}>
                <div style={{ width: '50%', height: 12, background: '#e2e8f0', borderRadius: 6, marginBottom: 8 }} />
                <div style={{ width: '100%', height: 10, background: '#e2e8f0', borderRadius: 6 }} />
              </div>
            )) : (
              <div style={{ gridColumn: '1 / -1', padding: 14, borderRadius: 14, border: '1px solid #fed7aa', background: '#fff7ed', color: '#9a3412', fontSize: 13, fontWeight: 600 }}>
                <AlertTriangle width={14} height={14} style={{ marginRight: 8, display: 'inline-block', verticalAlign: '-2px' }} />
                Health check indisponível agora. Verifique conexão com a internet e configuração Azure AD.
              </div>
            )}
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)', gap: 20 }}>
          {/* COLUNA ESQUERDA: FORM + JOB ATIVO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* FORM */}
            <motion.section initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
              style={{
                padding: 22, borderRadius: 18, border: '1px solid #e2e8f0',
                background: 'linear-gradient(180deg, #ffffff, #fbfdff)',
                boxShadow: '0 12px 40px -20px rgba(0,0,0,0.15)',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <HardDriveUpload width={18} height={18} color="#00AE9D" />
                <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Nova Importação</h2>
              </div>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                    URL da Pasta ou Arquivo no SharePoint
                    <span style={{ color: '#64748b', fontWeight: 500, marginLeft: 6 }}>(deixe vazio para usar URLs configuradas automaticamente)</span>
                  </label>
                  <input
                    type="text"
                    value={folderUrl}
                    onChange={(e) => setFolderUrl(e.target.value)}
                    placeholder="https://sicoobjuriscredcelgbr.sharepoint.com/.../Recuperação%20de%20Crédito"
                    style={inputStyle()}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Escolher Lote / Órgão alvo</label>
                  <div style={{ position: 'relative' }}>
                    <button type="button" onClick={() => setTargetOpen((v) => !v)} style={inputStyle({ asBtn: true, justifyContent: 'space-between' })}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <DatabaseZap width={16} height={16} color="#00AE9D" />
                        <span style={{ fontWeight: 700, color: '#003641' }}>{TARGETS.find((t) => t.value === target)?.label || target}</span>
                      </span>
                      {targetOpen ? <ChevronUp width={18} height={18} /> : <ChevronDown width={18} height={18} />}
                    </button>
                    <AnimatePresence>
                      {targetOpen ? (
                        <motion.div initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -8, height: 0 }}
                          style={{
                            position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)', zIndex: 20,
                            background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 16px 40px -12px rgba(0,0,0,0.2)',
                            overflow: 'hidden',
                          }}
                        >
                          {TARGETS.map((t) => (
                            <button key={t.value} type="button"
                              onClick={() => { setTarget(t.value); setTargetOpen(false) }}
                              style={{
                                width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: target === t.value ? 'rgba(0,174,157,0.08)' : 'transparent',
                                cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                              }}
                            >
                              <div style={{ fontSize: 13, fontWeight: 750, color: target === t.value ? '#008C7D' : '#0f172a' }}>{t.label}</div>
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{t.desc}</div>
                            </button>
                          ))}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
                <button type="submit" disabled={importLoading}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    padding: '13px 16px', borderRadius: 14, border: 'none',
                    background: importLoading ? 'linear-gradient(180deg, #006b62, #00554d)' : 'linear-gradient(180deg, #00AE9D, #008C7D)',
                    color: '#fff', fontWeight: 800, fontSize: 14,
                    cursor: importLoading ? 'wait' : 'pointer',
                    boxShadow: '0 12px 24px rgba(0,174,157,0.3)',
                  }}>
                  {importLoading ? (
                    <RefreshCcwDot width={18} height={18} className="animate-spin" />
                  ) : (
                    <PlayCircle width={18} height={18} />
                  )}
                  {importLoading ? 'Submetendo job...' : 'Iniciar Importação (Assíncrona)'}
                </button>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 11, color: '#64748b' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Info width={12} height={12} /> Modo padrão: HTTP 202 Accepted (não trava).</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Activity width={12} height={12} /> Atualiza progresso em tempo real via SSE.</span>
                </div>
              </form>
            </motion.section>

            {/* JOB ATIVO / PROGRESSO */}
            <motion.section initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
              style={{
                padding: 22, borderRadius: 18, border: '1px solid #e2e8f0',
                background: 'linear-gradient(180deg, #ffffff, #fbfdff)',
                boxShadow: '0 12px 40px -20px rgba(0,0,0,0.15)', minHeight: 200,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CircleDot width={18} height={18} color="#00AE9D" className={activeJob?.status === 'running' ? 'animate-pulse' : ''} />
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Job em Destaque</h2>
                </div>
                {activeJob ? (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${STATUS_STYLES[activeJob.status].bg} ${STATUS_STYLES[activeJob.status].color} ${STATUS_STYLES[activeJob.status].border}`}>
                    <span className={`inline-block w-2 h-2 rounded-full ${STATUS_STYLES[activeJob.status].dot}`} />
                    {STATUS_STYLES[activeJob.status].icon}
                    {STATUS_STYLES[activeJob.status].label}
                  </span>
                ) : null}
              </div>

              {activeJob ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#334155', flexWrap: 'wrap', gap: 8 }}>
                    <div><b>ID:</b> <code style={{ padding: '1px 6px', borderRadius: 6, background: '#f1f5f9', fontSize: 11 }}>{activeJob.jobId}</code></div>
                    <div><b>Tipo:</b> {kindLabel(activeJob.kind)}</div>
                    <div><b>Criado:</b> {fmtIso(activeJob.createdAtIso)}</div>
                    <div><b>Duração:</b> {fmtDuracao(activeJob.startedAtIso, activeJob.finishedAtIso) || fmtDuracao(activeJob.startedAtIso || activeJob.createdAtIso, activeJob.heartbeatAtIso) || 'Em andamento...'}</div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 6, fontWeight: 600 }}>
                      <span>Progresso</span>
                      <span>{Math.round(progressoPct)}% · {activeJob.progressFiles?.length || 0} arq. · {activeJob.totalRowsInserted?.toLocaleString('pt-BR') || 0} linhas inseridas · {activeJob.totalRowsSkipped?.toLocaleString('pt-BR') || 0} puladas</span>
                    </div>
                    <div style={{ width: '100%', height: 12, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressoPct}%` }}
                        transition={{ ease: 'easeOut', duration: 0.4 }}
                        style={{
                          height: '100%', borderRadius: 999,
                          background: activeJob.status === 'failed'
                            ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                            : activeJob.status === 'cancelled'
                            ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                            : activeJob.status === 'succeeded'
                            ? 'linear-gradient(90deg, #10b981, #059669)'
                            : 'linear-gradient(90deg, #00AE9D, #0891b2)',
                          boxShadow: '0 0 12px rgba(0,174,157,0.35)',
                        }}
                      />
                    </div>
                  </div>

                  {activeJob.progressFiles && activeJob.progressFiles.length > 0 ? (
                    <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                          <tr>
                            <th style={thStyle()}>#</th>
                            <th style={thStyle()}>Arquivo</th>
                            <th style={thStyle()}>Tabela</th>
                            <th style={thStyle({ textAlign: 'right' })}>Linhas In</th>
                            <th style={thStyle({ textAlign: 'right' })}>Skip</th>
                            <th style={thStyle()}>Horário</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...activeJob.progressFiles].reverse().slice(0, 50).map((f) => (
                            <tr key={`${f.idx ?? f.fileName}-${f.atIso}`} style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={tdStyle()}>{f.idx ?? '–'}</td>
                              <td style={tdStyle({ maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })} title={f.fileName || ''}>{f.fileName || '–'}</td>
                              <td style={tdStyle()}>{f.targetTable || '–'}</td>
                              <td style={tdStyle({ textAlign: 'right', color: '#16a34a', fontWeight: 700 })}>{(f.insertedRows || 0).toLocaleString('pt-BR')}</td>
                              <td style={tdStyle({ textAlign: 'right', color: (f.skippedRows || 0) > 0 ? '#b45309' : '#64748b', fontWeight: 700 })} title={f.skippedReason || ''}>
                                {(f.skippedRows || 0).toLocaleString('pt-BR')}
                                {(f.skippedReason && (f.skippedRows || 0) > 0) ? <span style={{ marginLeft: 4, fontSize: 10 }}>⚠️</span> : null}
                              </td>
                              <td style={tdStyle()}>{fmtIso(f.atIso)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: 18, borderRadius: 12, border: '1px dashed #cbd5e1', textAlign: 'center', fontSize: 12, color: '#64748b' }}>
                      Aguardando o processamento do primeiro arquivo...
                    </div>
                  )}

                  {activeJob.errorMessage ? (
                    <div style={{ padding: 12, borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontSize: 12, fontWeight: 600 }}>
                      <XCircle width={14} height={14} style={{ marginRight: 8, display: 'inline-block', verticalAlign: '-2px' }} />
                      Erro: {activeJob.errorMessage}
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {(activeJob.status === 'running' || activeJob.status === 'queued') ? (
                      <button onClick={() => void handleCancel(activeJob.jobId)} disabled={cancelLoading === activeJob.jobId}
                        style={btnDanger()}>
                        <StopCircle width={16} height={16} />
                        {cancelLoading === activeJob.jobId ? 'Solicitando...' : 'Solicitar cancelamento'}
                      </button>
                    ) : null}
                    {activeJob.preImportSnapshotPath ? (
                      <button type="button" style={btnSecondary()} title="Snapshot SQLite tirado antes da importação (rollback)">
                        <Download width={16} height={16} /> Snapshot pré-import: {activeJob.preImportSnapshotPath.split('\\').pop()?.split('/').pop()}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div style={{ padding: 28, borderRadius: 12, border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                  <Power width={26} height={26} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                  Nenhum job ativo no momento. Submeta uma nova importação no formulário acima.
                </div>
              )}
            </motion.section>
          </div>

          {/* COLUNA DIREITA: HISTÓRICO RECENTES + DETALHE */}
          <motion.section initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.15 }}
            style={{
              padding: 22, borderRadius: 18, border: '1px solid #e2e8f0',
              background: 'linear-gradient(180deg, #ffffff, #fbfdff)',
              boxShadow: '0 12px 40px -20px rgba(0,0,0,0.15)', minHeight: 400,
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarClock width={18} height={18} color="#00AE9D" />
                <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Histórico Recente</h2>
              </div>
              <span style={{ fontSize: 12, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {listLoading ? <RefreshCcwDot width={14} height={14} className="animate-spin" /> : null}
                {jobs.length} jobs · auto-refresh 15s
              </span>
            </div>

            <div style={{ maxHeight: 720, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                  <tr>
                    <th style={thStyle()}>Status</th>
                    <th style={thStyle()}>Tipo</th>
                    <th style={thStyle({ textAlign: 'right' })}>Arq</th>
                    <th style={thStyle({ textAlign: 'right' })}>Linhas +</th>
                    <th style={thStyle({ textAlign: 'right' })}>Skip</th>
                    <th style={thStyle()}>Criado</th>
                    <th style={thStyle()}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 28, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                        <Settings2 width={24} height={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                        Nenhum job encontrado ainda.
                      </td>
                    </tr>
                  ) : jobs.map((j) => (
                    <tr key={j.jobId} style={{ borderTop: '1px solid #f1f5f9', background: activeJobId === j.jobId ? 'rgba(0,174,157,0.04)' : 'transparent' }}>
                      <td style={tdStyle()}>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${STATUS_STYLES[j.status].bg} ${STATUS_STYLES[j.status].color} ${STATUS_STYLES[j.status].border}`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_STYLES[j.status].dot}`} />
                          {STATUS_STYLES[j.status].icon}
                          {STATUS_STYLES[j.status].label}
                        </span>
                      </td>
                      <td style={tdStyle({ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })} title={kindLabel(j.kind)}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{kindLabel(j.kind).replace(/^Importação/, 'Imp.').replace(/^\(Lote.+\)\s*/, '')}</div>
                        <div style={{ fontSize: 10.5, color: '#64748b' }}>ID {j.jobId.slice(-10)}</div>
                      </td>
                      <td style={tdStyle({ textAlign: 'right', fontWeight: 700, color: '#334155' })}>{j.progressFiles?.length || 0}</td>
                      <td style={tdStyle({ textAlign: 'right', fontWeight: 750, color: '#16a34a' })}>{(j.totalRowsInserted || 0).toLocaleString('pt-BR')}</td>
                      <td style={tdStyle({ textAlign: 'right', fontWeight: 700, color: (j.totalRowsSkipped || 0) > 0 ? '#b45309' : '#64748b' })}>{(j.totalRowsSkipped || 0).toLocaleString('pt-BR')}</td>
                      <td style={tdStyle()}>
                        <div>{fmtIso(j.createdAtIso)}</div>
                        <div style={{ fontSize: 10.5, color: '#64748b' }}>{j.finishedAtIso ? `durou ${fmtDuracao(j.startedAtIso || j.createdAtIso, j.finishedAtIso)}` : j.heartbeatAtIso ? `♡ ${fmtIso(j.heartbeatAtIso).split(' ')[1]}` : '—'}</div>
                      </td>
                      <td style={tdStyle()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {(j.status === 'running' || j.status === 'queued') ? (
                            <button onClick={() => void handleCancel(j.jobId)} disabled={cancelLoading === j.jobId}
                              title="Cancelar job"
                              style={{ width: 30, height: 30, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', cursor: cancelLoading === j.jobId ? 'wait' : 'pointer' }}>
                              <StopCircle width={14} height={14} />
                            </button>
                          ) : null}
                          {activeJobId !== j.jobId ? (
                            <button onClick={() => { setActiveJobId(j.jobId); if (j.status === 'running' || j.status === 'queued') openSse(j.jobId) }} title="Focar neste job"
                              style={{ width: 30, height: 30, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: '1px solid #ccfbf1', background: '#f0fdfa', color: '#0f766e', cursor: 'pointer' }}>
                              <CircleDot width={14} height={14} />
                            </button>
                          ) : null}
                          <button onClick={() => setJobDetailOpen(jobDetailOpen === j.jobId ? null : j.jobId)} title="Expandir detalhes completos"
                            style={{ width: 30, height: 30, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', cursor: 'pointer' }}>
                            {jobDetailOpen === j.jobId ? <ChevronUp width={14} height={14} /> : <ChevronDown width={14} height={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* DETALHE EXPANDIDO */}
            <AnimatePresence>
              {jobDetailOpen ? (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  style={{
                    marginTop: 12, padding: 16, borderRadius: 14, border: '1px solid #e2e8f0', background: '#f8fafc', overflow: 'auto',
                  }}>
                  <div style={{ fontSize: 12, fontWeight: 750, color: '#0f172a', marginBottom: 8 }}>Detalhe completo do job</div>
                  <pre style={{ margin: 0, fontSize: 11, fontFamily: 'Consolas, ui-monospace, monospace', color: '#334155', overflow: 'auto', maxHeight: 400 }}>
                    {JSON.stringify(jobs.find((j) => j.jobId === jobDetailOpen) || null, null, 2)}
                  </pre>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.section>
        </div>

        {/* RODAPÉ INFORMATIVO */}
        <div style={{ marginTop: 24, padding: 18, borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', fontSize: 12, color: '#475569', display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', minWidth: 240 }}>
            <CheckCircle2 width={16} height={16} color="#16a34a" />
            <b>Backward compat total:</b> POST antigo /import com <code>sync:true</code> e <code>/import/sync</code> continuam bloqueantes 100% igual antes.
          </div>
          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', minWidth: 240 }}>
            <CheckCircle2 width={16} height={16} color="#16a34a" />
            <b>Concorrência 1 (FIFO):</b> Evita corromper SQLite. Novos jobs entram na fila.
          </div>
          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', minWidth: 240 }}>
            <CheckCircle2 width={16} height={16} color="#16a34a" />
            <b>Cancelamento cooperativo:</b> Só efetiva ENTRE arquivos — nunca no meio de INSERT/transação.
          </div>
        </div>
      </div>
    </div>
  )
}

// HELPERS STYLE
function inputStyle({ asBtn = false, justifyContent = 'flex-start' }: { asBtn?: boolean; justifyContent?: 'flex-start' | 'space-between' } = {}): React.CSSProperties {
  return {
    width: '100%',
    display: asBtn ? 'inline-flex' : 'block',
    alignItems: 'center',
    justifyContent,
    gap: 8,
    padding: '11px 13px',
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    background: '#fff',
    fontSize: 13,
    color: '#0f172a',
    fontWeight: 500,
    outline: 'none',
    boxSizing: 'border-box' as const,
    cursor: asBtn ? 'pointer' : 'text',
    ...(asBtn ? { textAlign: 'left' } : {}),
  }
}

function btnSecondary(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '9px 13px', borderRadius: 12, border: '1px solid #cbd5e1',
    background: '#fff', color: '#0f172a', fontWeight: 700, fontSize: 12.5,
    cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
  }
}

function btnDanger(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '9px 13px', borderRadius: 12, border: '1px solid #fecaca',
    background: 'linear-gradient(180deg, #fee2e2, #fecaca)', color: '#991b1b', fontWeight: 800, fontSize: 12.5,
    cursor: 'pointer', boxShadow: '0 6px 14px rgba(220,38,38,0.18)',
  }
}

function thStyle({ textAlign = 'left', color, fontWeight }: { textAlign?: 'left' | 'right'; color?: string; fontWeight?: number | string } = {}): React.CSSProperties {
  return {
    padding: '8px 10px', fontSize: 11, fontWeight: fontWeight ?? 800, color: color ?? '#475569', textTransform: 'uppercase' as const, letterSpacing: 0.4, textAlign,
    background: '#f8fafc',
  }
}

function tdStyle({ textAlign = 'left', maxWidth, whiteSpace, overflow, textOverflow, color, fontWeight }: { textAlign?: 'left' | 'right'; maxWidth?: number; whiteSpace?: string; overflow?: string; textOverflow?: string; color?: string; fontWeight?: number | string } = {}): React.CSSProperties {
  return { padding: '8px 10px', fontSize: 12, color: color ?? '#0f172a', verticalAlign: 'top' as const, textAlign, ...(fontWeight ? { fontWeight: fontWeight as any } : {}), ...(maxWidth ? { maxWidth, whiteSpace: whiteSpace as any, overflow: overflow as any, textOverflow: textOverflow as any } : {}) }
}
