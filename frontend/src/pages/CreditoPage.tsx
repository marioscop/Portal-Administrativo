import {
  Fragment,
  type ReactElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import html2canvas from 'html2canvas'
import * as Dialog from '@radix-ui/react-dialog'
import { Toaster, toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BadgeDollarSign,
  ChevronDown,
  FileText,
  Home,
  Info,
  LayoutDashboard,
  Lock,
  LogOut,
  Megaphone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
  Clock,
  Trash2,
  Unlock,
  Printer,
  FileSpreadsheet,
} from 'lucide-react'

import ReactECharts from 'echarts-for-react'

type ViewId =
  | 'home'
  | 'dashboard'
  | 'conciliacao-extratos'
  | 'conciliacao-relatorio'
  | 'relatorios-valores'
  | 'relatorios-auditoria'
  | 'configuracoes-automacao'
  | 'configuracoes-acessos'

function parseViewFromHash(hash: string): ViewId | null {
  if (hash === 'home' || hash === 'dashboard') return hash
  if (
    hash === 'conciliacao-extratos' ||
    hash === 'conciliacao-relatorio' ||
    hash === 'relatorios-valores' ||
    hash === 'relatorios-auditoria' ||
    hash === 'configuracoes-automacao' ||
    hash === 'configuracoes-acessos'
  ) {
    return hash
  }
  return null
}

const STORAGE_KEY = 'credito-automacao-config-v1'

function useHashView(defaultView: ViewId) {
  const [view, setView] = useState<ViewId>(() => {
    const parsed = parseViewFromHash(window.location.hash.replace('#', ''))
    return parsed ?? defaultView
  })

  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseViewFromHash(window.location.hash.replace('#', ''))
      setView(parsed ?? defaultView)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [defaultView])

  const setHash = (next: ViewId) => {
    window.location.hash = `#${next}`
  }

  return { view, setHash }
}

export default function CreditoPage() {
  const orgaoSort = useMemo(() => {
    const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
    return (a: string, b: string) => collator.compare(a.trim(), b.trim())
  }, [])
  const initialView = useMemo(() => {
    return parseViewFromHash(window.location.hash.replace('#', '')) ?? 'home'
  }, [])
  const storedConfig = useMemo(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw) as {
        sharePointFolderPath?: string
        importDays?: Record<
          'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom',
          boolean
        >
        importTime?: string
        notificationEmail?: string
        notificationEmailContabilidade?: string
        modalidades?: string[]
      }
    } catch {
      return null
    }
  }, [])
  const [collapsed, setCollapsed] = useState(true)
  const [reportsOpen, setReportsOpen] = useState(() =>
    initialView.startsWith('relatorios-'),
  )
  const [settingsOpen, setSettingsOpen] = useState(() =>
    initialView.startsWith('configuracoes-'),
  )
  const { view, setHash } = useHashView('home')
  const [userRole, setUserRole] = useState<'admin' | 'usuario'>(() => {
    const raw = sessionStorage.getItem('consignado_user_role') || ''
    return raw.trim().toLowerCase() === 'admin' ? 'admin' : 'usuario'
  })
  const [search, setSearch] = useState('')
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const commandInputRef = useRef<HTMLInputElement | null>(null)
  const [sharePointFolderPath, setSharePointFolderPath] = useState(
    storedConfig?.sharePointFolderPath ?? '',
  )
  const [sharePointFolderPathLoading, setSharePointFolderPathLoading] =
    useState(false)
  const [sharePointFolderPathSaving, setSharePointFolderPathSaving] =
    useState(false)
  const [sharePointFolderPathError, setSharePointFolderPathError] = useState<
    string | null
  >(null)
  const [sharePointFolderPathSavedMsg, setSharePointFolderPathSavedMsg] =
    useState<string | null>(null)
  const didAutoMigrateSharePointFolderPathRef = useRef(false)
  const [importDays, setImportDays] = useState<
    Record<'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom', boolean>
  >(
    storedConfig?.importDays ?? {
      seg: true,
      ter: true,
      qua: true,
      qui: true,
      sex: true,
      sab: false,
      dom: false,
    },
  )
  const [importTime, setImportTime] = useState(storedConfig?.importTime ?? '08:00')
  const [notificationEmail, setNotificationEmail] = useState(
    storedConfig?.notificationEmail ?? '',
  )
  const [notificationEmailContabilidade, setNotificationEmailContabilidade] =
    useState(storedConfig?.notificationEmailContabilidade ?? '')
  const [teamsDelegatedConnected, setTeamsDelegatedConnected] = useState(false)
  const [teamsDelegatedDeviceCode, setTeamsDelegatedDeviceCode] = useState<null | {
    userCode: string
    verificationUri: string
    message: string
    expiresAt: string
  }>(null)
  const [teamsDelegatedLoading, setTeamsDelegatedLoading] = useState(false)
  const [accessFixedEmail, setAccessFixedEmail] = useState(
    'mario.junior@sicoobjuriscred.com.br',
  )
  const [accessEmails, setAccessEmails] = useState<string[]>([
    'mario.junior@sicoobjuriscred.com.br',
  ])
  const [accessRoleDraft, setAccessRoleDraft] = useState<'admin' | 'usuario'>(
    'usuario',
  )
  const [accessRoleByEmail, setAccessRoleByEmail] = useState<
    Record<string, 'admin' | 'usuario'>
  >({
    'mario.junior@sicoobjuriscred.com.br': 'admin',
  })
  const [accessEmailDraft, setAccessEmailDraft] = useState('')
  const [accessEmailsLoading, setAccessEmailsLoading] = useState(false)
  const [accessEmailsSaving, setAccessEmailsSaving] = useState(false)
  const [accessEmailsError, setAccessEmailsError] = useState<string | null>(null)
  const [modalidades, setModalidades] = useState<string[]>(
    storedConfig?.modalidades ?? ['CCCP', 'RCCP', 'PCCN', 'RCCC'],
  )
  const [modalidadesSaving, setModalidadesSaving] = useState(false)
  const [modalidadesError, setModalidadesError] = useState<string | null>(null)
  const [modalidadesSavedMsg, setModalidadesSavedMsg] = useState<string | null>(null)
  const [orgaoValues, setOrgaoValues] = useState<{
    extratos: string[]
    relatorio: string[]
  }>({ extratos: [], relatorio: [] })
  const [orgaoValuesLoading, setOrgaoValuesLoading] = useState(false)
  const [orgaoValuesError, setOrgaoValuesError] = useState<string | null>(null)
  const [orgaoDePara, setOrgaoDePara] = useState<
    Array<{ extratos: string; relatorio: string }>
  >([])
  const [orgaoDeParaLoading, setOrgaoDeParaLoading] = useState(false)
  const [orgaoDeParaError, setOrgaoDeParaError] = useState<string | null>(null)
  const [orgaoDeParaSavedMsg, setOrgaoDeParaSavedMsg] = useState<string | null>(null)
  const [orgaoDeParaDraft, setOrgaoDeParaDraft] = useState<{
    extratos: string
    relatorio: string
  }>({ extratos: '', relatorio: '' })
  const [extratosHistorico1Options, setExtratosHistorico1Options] = useState<string[]>([])
  const [extratosHistorico1OptionsLoading, setExtratosHistorico1OptionsLoading] = useState(false)
  const [extratosConsolidacaoRecurso, setExtratosConsolidacaoRecurso] = useState<
    Array<{ orgao: string; historico1: string; createdAt: string }>
  >([])
  const [extratosConsolidacaoRecursoDraft, setExtratosConsolidacaoRecursoDraft] = useState<{
    orgao: string
    historico1: string
  }>({ orgao: '', historico1: '' })
  const [extratosConsolidacaoRecursoLoading, setExtratosConsolidacaoRecursoLoading] = useState(false)
  const [extratosConsolidacaoRecursoError, setExtratosConsolidacaoRecursoError] = useState<string | null>(null)
  const [extratosConsolidacaoRecursoSavedMsg, setExtratosConsolidacaoRecursoSavedMsg] = useState<string | null>(
    null,
  )
  const [modalidadeDraft, setModalidadeDraft] = useState('')
  const timeSelectRef = useRef<HTMLSelectElement | null>(null)
  const [importingNow, setImportingNow] = useState(false)
  const [manualImportTarget, setManualImportTarget] = useState<
    'relatorio' | 'extratos' | 'recurso_alego' | 'recurso_mpgo'
  >('relatorio')
  const [recursoAlegoUrl, setRecursoAlegoUrl] = useState('')
  const [recursoMpgoUrl, setRecursoMpgoUrl] = useState('')
  const [importNowMessage, setImportNowMessage] = useState<null | {
    kind: 'success' | 'error'
    text: string
  }>(null)
  const settingsLocked = userRole !== 'admin'
  const [conciliacaoMonth, setConciliacaoMonth] = useState(() => {
    const now = new Date()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    return `${now.getFullYear()}-${mm}`
  })
  const [conciliacaoOrgao, setConciliacaoOrgao] = useState('')
  const [conciliacaoMonthOptions, setConciliacaoMonthOptions] = useState<
    Array<{ value: string; label: string }>
  >([])
  const [conciliacaoMonthsLoading, setConciliacaoMonthsLoading] = useState(false)
  const [conciliacaoOnlyDiff, setConciliacaoOnlyDiff] = useState(false)
  const [relatorioVencimentoFilter, setRelatorioVencimentoFilter] = useState('')
  const [conciliacaoLoading, setConciliacaoLoading] = useState(false)
  const [conciliacaoError, setConciliacaoError] = useState<string | null>(null)
  const [conciliacaoExpandedKeys, setConciliacaoExpandedKeys] = useState<string[]>(
    [],
  )
  const [conciliacaoGroupedOpenKeys, setConciliacaoGroupedOpenKeys] = useState<string[]>([])
  const [conciliacaoSelectedPairId, setConciliacaoSelectedPairId] = useState<string | null>(null)
  const [conciliacaoSelectedPersonKey, setConciliacaoSelectedPersonKey] = useState<string | null>(
    null,
  )
  const conciliacaoLinkHostRef = useRef<HTMLDivElement | null>(null)
  const conciliacaoEvidenceRef = useRef<HTMLDivElement | null>(null)
  const [isCapturingEvidence, setIsCapturingEvidence] = useState(false)
  const conciliacaoExtratoRowRefs = useRef<Array<HTMLTableRowElement | null>>([])
  const conciliacaoRelatorioRowRefs = useRef<Array<HTMLTableRowElement | null>>([])
  const [conciliacaoLinkOverlay, setConciliacaoLinkOverlay] = useState<null | {
    width: number
    height: number
    paths: string[]
  }>(null)
  const [conciliacaoData, setConciliacaoData] = useState<null | {
    month: string
    orgao: string
    recursoTable: string
    lastUpdatedAt?: string | null
    closed: {
      isClosed: boolean
      closedAt: string | null
      closedBy: string | null
      reopenedAt: string | null
      reopenedBy: string | null
      contabilidadeEmail: string | null
      sentToContabilidadeAt: string | null
      sentToContabilidadeBy: string | null
    }
    totals: {
      extratos: { cents: number; text: string }
      recurso: { cents: number; text: string }
      relatorio: { cents: number; text: string }
      tarifaLinha: { cents: number; text: string }
      tarifaTed: { cents: number; text: string }
      diff: { cents: number; text: string }
    }
    tarifaApplied: boolean
    tarifaTedApplied: boolean
    recurso: Array<{
      cpf: string
      nome: string
      value: string
      vencimento: string | null
      status: 'conciliado' | 'pendencia'
      pairId: string | null
    }>
    relatorio: Array<{
      cpf: string
      nome: string
      value: string
      competencia: string | null
      vencimento: string | null
      modalidade: string | null
      empresa: string | null
      status: 'conciliado' | 'pendencia'
      pairId: string | null
      ocorrencia: null | {
        id: number
        createdAt: string
        action: string
        justification: string
        status?: string | null
        gerenteEmail?: string | null
      }
      repactuacoes?: Array<{
        id: number
        createdAt: string
        status: string
        gerenteEmail: string | null
        justification: string
      }>
    }>
    message?: string
  }>(null)
  const [cloneSisbrModal, setCloneSisbrModal] = useState<null | {
    cpf: string
    nome: string
    value: string
    vencimento: string | null
  }>(null)
  const [cloneSisbrLoading, setCloneSisbrLoading] = useState(false)
  const [cloneSisbrError, setCloneSisbrError] = useState<string | null>(null)
  const [cloneSisbrAction, setCloneSisbrAction] = useState<CloneSisbrAction>('clonar_para_relatorio_sisbr')
  const [cloneSisbrJustification, setCloneSisbrJustification] = useState('')
  const [cloneSisbrDevolucaoDate, setCloneSisbrDevolucaoDate] = useState('')
  const [cloneSisbrContext, setCloneSisbrContext] = useState<null | {
    targetEmpresa: string
    sourceEmpresas: string[]
    totalMatches: number
    willUpdateCount: number
  }>(null)
  const [tarifaModalOpen, setTarifaModalOpen] = useState(false)
  const [tarifaTypeDraft, setTarifaTypeDraft] = useState<'linha' | 'ted'>('linha')
  const [tarifaDraft, setTarifaDraft] = useState('')
  const [tarifaSaving, setTarifaSaving] = useState(false)
  const [tarifaError, setTarifaError] = useState<string | null>(null)
  const [conciliacaoClosing, setConciliacaoClosing] = useState(false)
  const [conciliacaoReopening, setConciliacaoReopening] = useState(false)
  const [conciliacaoResending, setConciliacaoResending] = useState(false)
  const [conciliacaoCloseModalOpen, setConciliacaoCloseModalOpen] = useState(false)
  const [conciliacaoCloseStep, setConciliacaoCloseStep] = useState<1 | 2 | 3>(1)
  const [conciliacaoCloseError, setConciliacaoCloseError] = useState<string | null>(null)
  const [conciliacaoCloseMode, setConciliacaoCloseMode] = useState<'total' | 'parcial'>('total')
  const [conciliacaoCloseVencimento, setConciliacaoCloseVencimento] = useState('')
  const [conciliacaoReopenModalOpen, setConciliacaoReopenModalOpen] = useState(false)
  const [conciliacaoReopenMode, setConciliacaoReopenMode] = useState<'total' | 'parcial'>('total')
  const [conciliacaoReopenVencimento, setConciliacaoReopenVencimento] = useState('')
  const [conciliacaoReopenPassword, setConciliacaoReopenPassword] = useState('')
  const [conciliacaoReopenError, setConciliacaoReopenError] = useState<string | null>(null)
  const [conciliacaoClosedBalloonVisible, setConciliacaoClosedBalloonVisible] = useState(false)
  const conciliacaoLockBalloonAnchorRef = useRef<HTMLDivElement | null>(null)
  const [conciliacaoLockBalloonPos, setConciliacaoLockBalloonPos] = useState<null | { left: number; top: number }>(
    null,
  )
  const [ocorrenciaModal, setOcorrenciaModal] = useState<null | {
    nome: string
    cpf: string
    value: string
    vencimento: string | null
    empresa: string | null
    status: 'conciliado' | 'pendencia'
    ocorrencia: null | {
      id: number
      createdAt: string
      action: string
      justification: string
      status?: string | null
      gerenteEmail?: string | null
    }
    ocorrencias: Array<{
      id: number
      createdAt: string
      action: string
      justification: string
      status?: string | null
      gerenteEmail?: string | null
    }>
    repactuacoes: Array<{
      id: number
      createdAt: string
      status: string
      gerenteEmail: string | null
      justification: string
    }>
    readOnly?: boolean
  }>(null)
  const [ocorrenciaModalShowNew, setOcorrenciaModalShowNew] = useState(false)
  const [ocorrenciaModalGroupsOpen, setOcorrenciaModalGroupsOpen] = useState<Record<string, boolean>>({})
  const defaultNaoPossuiRecursoMessage =
    'Prezado(a),\n\n' +
    'Informamos que o servidor em questão não possui recursos disponíveis para atendimento da demanda no momento.\n\n' +
    'Dessa forma, solicitamos que a situação seja regularizada junto ao setor Financeiro no prazo máximo de 5 (cinco) dias úteis, contados a partir do recebimento desta comunicação.\n\n' +
    'Ressaltamos que, caso não haja uma resolução dentro do prazo estabelecido, o assunto será encaminhado à Diretoria para conhecimento e deliberação das medidas cabíveis.\n\n' +
    'Permanecemos à disposição para esclarecimentos.\n\n' +
    'Atenciosamente,\n' +
    'Equipe Financeira'
  const [relatorioOcorrenciaAction, setRelatorioOcorrenciaAction] = useState(
    'alterar_orgao_relatorio_sisbr',
  )
  const [relatorioOcorrenciaToOrgao, setRelatorioOcorrenciaToOrgao] = useState('')
  const [relatorioOcorrenciaJustification, setRelatorioOcorrenciaJustification] = useState('')
  const [relatorioOcorrenciaUndoJustification, setRelatorioOcorrenciaUndoJustification] = useState('')
  const [relatorioLiquidacaoForaVencimentoDate, setRelatorioLiquidacaoForaVencimentoDate] =
    useState('')
  const [relatorioRecursoJudicialNovoValor, setRelatorioRecursoJudicialNovoValor] = useState('')
  const [relatorioRecursoJudicialAutoJustification, setRelatorioRecursoJudicialAutoJustification] =
    useState(false)
  const [relatorioRepactuacaoStatus, setRelatorioRepactuacaoStatus] = useState<'pendente_gerente' | 'concluido'>(
    'pendente_gerente',
  )
  const [relatorioRepactuacaoGerenteEmail, setRelatorioRepactuacaoGerenteEmail] = useState('')
  const [relatorioNaoPossuiRecursoGerenteEmail, setRelatorioNaoPossuiRecursoGerenteEmail] =
    useState('')
  const [relatorioOcorrenciaSaving, setRelatorioOcorrenciaSaving] = useState(false)
  const [relatorioOcorrenciaError, setRelatorioOcorrenciaError] = useState<string | null>(null)
  const [conciliacaoExportingXlsx, setConciliacaoExportingXlsx] = useState(false)
  const [conciliacaoExportingPdf, setConciliacaoExportingPdf] = useState(false)
  const [auditoriaMonth, setAuditoriaMonth] = useState('')
  const [auditoriaOrgao, setAuditoriaOrgao] = useState('')
  const [auditoriaGroup, setAuditoriaGroup] = useState('')
  const [auditoriaLimit] = useState(100)
  const [auditoriaOffset, setAuditoriaOffset] = useState(0)
  const [auditoriaLoading, setAuditoriaLoading] = useState(false)
  const [auditoriaError, setAuditoriaError] = useState<string | null>(null)
  const [auditoriaData, setAuditoriaData] = useState<null | {
    items: Array<{
      id: string
      occurredAt: string
      group: 'ocorrencias' | 'tarifas' | 'fechamentos' | 'contabilidade'
      action: string
      month: string | null
      orgao: string | null
      user: string | null
      detail: string | null
      cpf: string | null
      nome: string | null
      value: string | null
    }>
    total: number
    limit: number
    offset: number
  }>(null)
  const canExportConciliacaoXlsx =
    Boolean(conciliacaoData) &&
    'recurso' in (conciliacaoData as any) &&
    Array.isArray((conciliacaoData as any).recurso) &&
    'relatorio' in (conciliacaoData as any) &&
    Array.isArray((conciliacaoData as any).relatorio)

  type ConciliacaoResponse =
    | (NonNullable<typeof conciliacaoData> & { message?: string })
    | { message: string }

  type ConciliacaoMonthsResponse =
    | { months: string[]; dbFilePath?: string }
    | { message: string }

  const conciliacaoFetchRef = useRef(0)
  const dashboardAutoPickRef = useRef<string | null>(null)
  const homeAutoPickRef = useRef<string | null>(null)
  const [conciliacaoLoadedAtIso, setConciliacaoLoadedAtIso] = useState<string | null>(null)
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null)
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null)

  const isMain = view === 'home' || view === 'dashboard'
  const closedVencimentos = Array.isArray((conciliacaoData as any)?.closed?.closedVencimentos)
    ? ((conciliacaoData as any).closed.closedVencimentos as string[])
    : []
  const conciliacaoTotalIsClosed = Boolean(conciliacaoData?.closed?.isClosed)
  const isVencimentoLocked = (v: unknown) =>
    conciliacaoTotalIsClosed || closedVencimentos.includes(normalizeVencimentoLabel(v))
  const vencimentoSelecionado = relatorioVencimentoFilter.trim()
  const conciliacaoIsClosed =
    conciliacaoTotalIsClosed ||
    (Boolean(vencimentoSelecionado) && closedVencimentos.includes(vencimentoSelecionado))
  const ocorrenciaReadOnly = conciliacaoIsClosed || Boolean(ocorrenciaModal?.readOnly)
  const ocorrenciaModalOcorrencias = useMemo(() => {
    if (!ocorrenciaModal) return []
    const list = Array.isArray((ocorrenciaModal as any).ocorrencias)
      ? ((ocorrenciaModal as any).ocorrencias as any[])
      : []
    if (list.length > 0) return list
    return ocorrenciaModal.ocorrencia ? [ocorrenciaModal.ocorrencia] : []
  }, [ocorrenciaModal])
  const ocorrenciaModalOcorrenciasByTipo = useMemo(() => {
    const buckets = new Map<string, any[]>()
    for (const o of ocorrenciaModalOcorrencias) {
      const action = String((o as any)?.action ?? '').trim()
      const label = formatOcorrenciaActionLabel(action)
      const key = label || action || 'Ocorrência'
      const list = buckets.get(key) ?? []
      list.push(o)
      buckets.set(key, list)
    }
    const out = Array.from(buckets.entries())
      .map(([label, items]) => ({ label, items }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
    return out
  }, [formatOcorrenciaActionLabel, ocorrenciaModalOcorrencias])

  useEffect(() => {
    if (!ocorrenciaModal) {
      setOcorrenciaModalShowNew(false)
      setOcorrenciaModalGroupsOpen({})
      return
    }
    setOcorrenciaModalShowNew(false)
    setOcorrenciaModalGroupsOpen({})
  }, [ocorrenciaModal])
  const headerUserLabel = String(userDisplayName || 'SICOOB JURISCRED').trim()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = String(e.key || '').toLowerCase()
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault()
        setCommandOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!commandOpen) {
      setCommandQuery('')
      return
    }
    window.setTimeout(() => {
      commandInputRef.current?.focus()
    }, 0)
  }, [commandOpen])

  useEffect(() => {
    if (!conciliacaoIsClosed) {
      setConciliacaoClosedBalloonVisible(false)
      setConciliacaoLockBalloonPos(null)
      return
    }
    let alive = true
    const show = () => {
      if (!alive) return
      const el = conciliacaoLockBalloonAnchorRef.current
      if (el) {
        const r = el.getBoundingClientRect()
        setConciliacaoLockBalloonPos({
          left: r.left + r.width / 2,
          top: r.top,
        })
      }
      setConciliacaoClosedBalloonVisible(true)
      window.setTimeout(() => {
        if (!alive) return
        setConciliacaoClosedBalloonVisible(false)
      }, 1400)
    }
    show()
    const intervalId = window.setInterval(show, 5000)
    return () => {
      alive = false
      window.clearInterval(intervalId)
    }
  }, [conciliacaoIsClosed])

  useEffect(() => {
    if (view !== 'relatorios-auditoria') return
    setAuditoriaOffset(0)
  }, [auditoriaGroup, auditoriaMonth, auditoriaOrgao, view])

  useEffect(() => {
    if (view !== 'relatorios-auditoria') return
    let cancelled = false
    Promise.resolve().then(() => {
      setAuditoriaLoading(true)
      setAuditoriaError(null)
    })

    const params = new URLSearchParams()
    if (auditoriaMonth.trim()) params.set('month', auditoriaMonth.trim())
    if (auditoriaOrgao.trim()) params.set('orgao', auditoriaOrgao.trim())
    if (auditoriaGroup.trim()) params.set('group', auditoriaGroup.trim())
    params.set('limit', String(auditoriaLimit))
    params.set('offset', String(auditoriaOffset))

    fetch(`/api/consignado/auditoria?${params.toString()}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as any
        if (!res.ok) {
          throw new Error(data?.message || `Falha ao carregar auditoria (HTTP ${res.status}).`)
        }
        if (cancelled) return
        const items = Array.isArray(data?.items) ? data.items : []
        setAuditoriaData({
          items,
          total: Number.isFinite(Number(data?.total)) ? Number(data.total) : items.length,
          limit: Number.isFinite(Number(data?.limit)) ? Number(data.limit) : auditoriaLimit,
          offset: Number.isFinite(Number(data?.offset)) ? Number(data.offset) : auditoriaOffset,
        })
      })
      .catch((e) => {
        if (cancelled) return
        setAuditoriaError(e instanceof Error ? e.message : 'Falha ao carregar auditoria.')
        setAuditoriaData(null)
      })
      .finally(() => {
        if (cancelled) return
        setAuditoriaLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [auditoriaGroup, auditoriaLimit, auditoriaMonth, auditoriaOffset, auditoriaOrgao, view])

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    const toTitleCase = (s: string) =>
      s
        .trim()
        .split(/\s+/g)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')

    const deriveNameFromEmail = (email: string) => {
      const raw = email.trim()
      const at = raw.indexOf('@')
      const left = at > 0 ? raw.slice(0, at) : raw
      const parts = left
        .replace(/[_-]+/g, '.')
        .split('.')
        .map((p) => p.trim())
        .filter(Boolean)
      if (parts.length === 0) return ''
      return toTitleCase(parts.join(' '))
    }

    const formatDisplay = (name: string) => {
      const base = String(name || '').trim()
      if (!base) return 'SICOOB JURISCRED'
      const hasSuffix = base.includes('|') || base.toUpperCase().includes('SICOOB JURISCRED')
      return hasSuffix ? base : `${base} | SICOOB JURISCRED`
    }

    const tryLoad = async () => {
      const msalInstance = (window as any).__msalInstance as
        | {
            getActiveAccount: () => { name?: string; username?: string } | null
            getAllAccounts: () => Array<{ name?: string; username?: string }>
            setActiveAccount: (acc: any) => void
            acquireTokenSilent: (req: any) => Promise<{ accessToken: string }>
          }
        | undefined

      if (!msalInstance) return false
      const accounts = msalInstance.getAllAccounts()
      if (!msalInstance.getActiveAccount() && accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0])
      }
      const active = msalInstance.getActiveAccount()
      const activeName = String(active?.name ?? '').trim()
      const activeUsername = String(active?.username ?? '').trim()
      const fallbackName =
        activeName ||
        (activeUsername.includes('@') ? deriveNameFromEmail(activeUsername) : activeUsername) ||
        (accessFixedEmail.includes('@') ? deriveNameFromEmail(accessFixedEmail) : accessFixedEmail)
      setUserDisplayName(formatDisplay(fallbackName))

      try {
        const t = await msalInstance.acquireTokenSilent({
          scopes: ['User.Read'],
          account: active,
        })
        try {
          const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName', {
            headers: { Authorization: `Bearer ${t.accessToken}` },
          })
          const meJson = (await meRes.json().catch(() => null)) as null | { displayName?: string }
          const dn = String(meJson?.displayName ?? '').trim()
          if (dn) setUserDisplayName(formatDisplay(dn))
        } catch {
          void 0
        }
        const res = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
          headers: { Authorization: `Bearer ${t.accessToken}` },
        })
        if (!res.ok) return true
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        if (cancelled) {
          URL.revokeObjectURL(url)
          return true
        }
        objectUrl = url
        setUserPhotoUrl(url)
      } catch {
        return true
      }
      return true
    }

    let tries = 0
    const tick = () => {
      if (cancelled) return
      void tryLoad().then((ok) => {
        if (cancelled) return
        if (ok) return
        tries += 1
        if (tries >= 20) return
        window.setTimeout(tick, 250)
      })
    }
    tick()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sharePointFolderPath,
          importDays,
          importTime,
          notificationEmail,
          notificationEmailContabilidade,
          modalidades,
        }),
      )
    } catch {
      return
    }
  }, [
    importDays,
    importTime,
    modalidades,
    notificationEmail,
    notificationEmailContabilidade,
    sharePointFolderPath,
  ])

  useEffect(() => {
    const raw = sessionStorage.getItem('consignado_user_role') || ''
    setUserRole(raw.trim().toLowerCase() === 'admin' ? 'admin' : 'usuario')
  }, [view])

  useEffect(() => {
    if (view !== 'configuracoes-acessos') return
    let cancelled = false

    Promise.resolve().then(() => {
      setAccessEmailsLoading(true)
      setAccessEmailsError(null)
    })

    fetch('/api/consignado/access/emails')
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | {
              entries?: Array<{ email?: string; role?: 'admin' | 'usuario' }>
              emails?: string[]
              fixedEmail?: string
              message?: string
            }
          | null
        if (!res.ok) {
          const msg =
            data?.message ||
            `Falha ao carregar acessos (HTTP ${res.status}).`
          throw new Error(msg)
        }
        return data
      })
      .then((data) => {
        if (cancelled) return
        const fixed = (data?.fixedEmail || 'mario.junior@sicoobjuriscred.com.br')
          .trim()
          .toLowerCase()
        const entriesRaw = Array.isArray(data?.entries) ? data?.entries : null
        const entries: Array<{ email: string; role: 'admin' | 'usuario' }> =
          entriesRaw
            ? entriesRaw
                .map(
                  (e): { email: string; role: 'admin' | 'usuario' } => ({
                    email: String(e.email ?? '').trim().toLowerCase(),
                    role: e.role === 'admin' ? 'admin' : 'usuario',
                  }),
                )
                .filter((e) => Boolean(e.email))
                .filter(
                  (e, i, arr) => arr.findIndex((x) => x.email === e.email) === i,
                )
            : (Array.isArray(data?.emails) ? data?.emails : [])
                .map(
                  (email): { email: string; role: 'admin' | 'usuario' } => ({
                    email: String(email).trim().toLowerCase(),
                    role:
                      String(email).trim().toLowerCase() === fixed
                        ? 'admin'
                        : 'usuario',
                  }),
                )
                .filter((e) => Boolean(e.email))
                .filter(
                  (e, i, arr) => arr.findIndex((x) => x.email === e.email) === i,
                )

        const fixedEntry = { email: fixed, role: 'admin' as const }
        const withFixed = entries.some((e) => e.email === fixed)
          ? entries.map((e) => (e.email === fixed ? fixedEntry : e))
          : [fixedEntry, ...entries]

        const roleMap = withFixed.reduce(
          (acc, e) => {
            acc[e.email] = e.role
            return acc
          },
          {} as Record<string, 'admin' | 'usuario'>,
        )

        setAccessFixedEmail(fixed)
        setAccessEmails(withFixed.map((e) => e.email))
        setAccessRoleByEmail(roleMap)
      })
      .catch((e) => {
        if (cancelled) return
        setAccessEmailsError(e instanceof Error ? e.message : 'Falha ao carregar acessos.')
      })
      .finally(() => {
        if (cancelled) return
        setAccessEmailsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [view])

  const saveModalidadesToServer = async (next: string[]) => {
    setModalidadesSavedMsg(null)
    setModalidadesError(null)
    setModalidadesSaving(true)
    try {
      const res = await fetch('/api/consignado/modalidades', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ modalidades: next }),
      })
      const data = (await res.json().catch(() => null)) as null | { message?: string }
      if (!res.ok) {
        throw new Error(data?.message || `Falha ao salvar modalidades (HTTP ${res.status}).`)
      }
      setModalidadesSavedMsg('Modalidades salvas.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao salvar modalidades.'
      setModalidadesError(msg)
    } finally {
      setModalidadesSaving(false)
    }
  }

  useEffect(() => {
    if (view !== 'configuracoes-automacao') return
    let cancelled = false
    Promise.resolve().then(() => {
      setModalidadesError(null)
    })

    fetch('/api/consignado/modalidades')
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | null
          | { modalidades?: string[]; message?: string }
        if (!res.ok) {
          throw new Error(data?.message || `Falha ao carregar modalidades (HTTP ${res.status}).`)
        }
        if (cancelled) return
        const list = Array.isArray(data?.modalidades) ? data!.modalidades! : []
        if (list.length > 0) setModalidades(list)
      })
      .catch((e) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Falha ao carregar modalidades.'
        setModalidadesError(msg)
      })

    return () => {
      cancelled = true
    }
  }, [view])

  const saveAutomationConfigToServer = async (next: {
    sharePointFolderUrl: string | null
    recursoAlegoUrl: string | null
    recursoMpgoUrl: string | null
    notificationEmail: string | null
    notificationEmailContabilidade: string | null
  }) => {
    setSharePointFolderPathSavedMsg(null)
    setSharePointFolderPathError(null)
    setSharePointFolderPathSaving(true)
    try {
      const payload = {
        sharePointFolderUrl:
          next.sharePointFolderUrl && next.sharePointFolderUrl.trim()
            ? next.sharePointFolderUrl.trim()
            : null,
        recursoAlegoUrl:
          next.recursoAlegoUrl && next.recursoAlegoUrl.trim()
            ? next.recursoAlegoUrl.trim()
            : null,
        recursoMpgoUrl:
          next.recursoMpgoUrl && next.recursoMpgoUrl.trim()
            ? next.recursoMpgoUrl.trim()
            : null,
        notificationEmail:
          next.notificationEmail && next.notificationEmail.trim()
            ? next.notificationEmail.trim()
            : null,
        notificationEmailContabilidade:
          next.notificationEmailContabilidade && next.notificationEmailContabilidade.trim()
            ? next.notificationEmailContabilidade.trim()
            : null,
      }
      const res = await fetch('/api/consignado/automation/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => null)) as null | { message?: string }
      if (!res.ok) {
        throw new Error(data?.message || `Falha ao salvar pasta (HTTP ${res.status}).`)
      }
      setSharePointFolderPathSavedMsg('Configuração salva.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao salvar pasta.'
      setSharePointFolderPathError(msg)
    } finally {
      setSharePointFolderPathSaving(false)
    }
  }

  useEffect(() => {
    if (view !== 'configuracoes-automacao') return
    let cancelled = false
    Promise.resolve().then(() => {
      setSharePointFolderPathLoading(true)
      setSharePointFolderPathError(null)
      setSharePointFolderPathSavedMsg(null)
    })

    fetch('/api/consignado/automation/config')
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | null
          | {
              sharePointFolderUrl?: string | null
              recursoAlegoUrl?: string | null
              recursoMpgoUrl?: string | null
              notificationEmail?: string | null
              notificationEmailContabilidade?: string | null
              teamsDelegatedConnected?: boolean
              message?: string
            }
        if (!res.ok) {
          throw new Error(data?.message || `Falha ao carregar configuração (HTTP ${res.status}).`)
        }
        if (cancelled) return
        const remote = typeof data?.sharePointFolderUrl === 'string' ? data!.sharePointFolderUrl!.trim() : ''
        const remoteAlego = typeof data?.recursoAlegoUrl === 'string' ? data!.recursoAlegoUrl!.trim() : ''
        const remoteMpgo = typeof data?.recursoMpgoUrl === 'string' ? data!.recursoMpgoUrl!.trim() : ''
        const remoteNotificationEmail =
          typeof data?.notificationEmail === 'string' ? data!.notificationEmail!.trim() : ''
        const remoteNotificationEmailContabilidade =
          typeof data?.notificationEmailContabilidade === 'string'
            ? data!.notificationEmailContabilidade!.trim()
            : ''
        const remoteTeamsDelegatedConnected = data?.teamsDelegatedConnected === true
        if (remote) setSharePointFolderPath(remote)
        if (remoteAlego) setRecursoAlegoUrl(remoteAlego)
        if (remoteMpgo) setRecursoMpgoUrl(remoteMpgo)
        if (remoteNotificationEmail) setNotificationEmail(remoteNotificationEmail)
        if (remoteNotificationEmailContabilidade)
          setNotificationEmailContabilidade(remoteNotificationEmailContabilidade)
        setTeamsDelegatedConnected(remoteTeamsDelegatedConnected)

        const shouldMigrateSharePoint = !remote
        if (didAutoMigrateSharePointFolderPathRef.current) return
        didAutoMigrateSharePointFolderPathRef.current = true
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY)
          const parsed = raw
            ? (JSON.parse(raw) as {
                sharePointFolderPath?: string
                notificationEmail?: string
                notificationEmailContabilidade?: string
              })
            : null
          const local = typeof parsed?.sharePointFolderPath === 'string' ? parsed.sharePointFolderPath.trim() : ''
          const localNotificationEmail =
            typeof parsed?.notificationEmail === 'string' ? parsed.notificationEmail.trim() : ''
          const localNotificationEmailContabilidade =
            typeof parsed?.notificationEmailContabilidade === 'string'
              ? parsed.notificationEmailContabilidade.trim()
              : ''

          if (
            !shouldMigrateSharePoint &&
            (remoteNotificationEmail || remoteNotificationEmailContabilidade)
          ) {
            return
          }
          if (!local && !localNotificationEmail && !localNotificationEmailContabilidade) return
          await saveAutomationConfigToServer({
            sharePointFolderUrl: shouldMigrateSharePoint ? local : remote || null,
            recursoAlegoUrl: remoteAlego || null,
            recursoMpgoUrl: remoteMpgo || null,
            notificationEmail: remoteNotificationEmail || localNotificationEmail || null,
            notificationEmailContabilidade:
              remoteNotificationEmailContabilidade || localNotificationEmailContabilidade || null,
          })
        } catch {
          return
        }
      })
      .catch((e) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Falha ao carregar configuração.'
        setSharePointFolderPathError(msg)
      })
      .finally(() => {
        if (cancelled) return
        setSharePointFolderPathLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [view])

  const saveNotificationsConfigToServer = async () => {
    if (settingsLocked) return
    try {
      await fetch('/api/consignado/automation/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sharePointFolderUrl: sharePointFolderPath.trim() || null,
          recursoAlegoUrl: recursoAlegoUrl.trim() || null,
          recursoMpgoUrl: recursoMpgoUrl.trim() || null,
          notificationEmail: notificationEmail.trim() || null,
          notificationEmailContabilidade: notificationEmailContabilidade.trim() || null,
        }),
      })
    } catch {
      return
    }
  }

  const refreshTeamsDelegatedConnectedFromServer = async () => {
    try {
      const res = await fetch('/api/consignado/automation/config')
      const data = (await res.json().catch(() => null)) as null | {
        teamsDelegatedConnected?: boolean
      }
      if (!res.ok) return
      setTeamsDelegatedConnected(data?.teamsDelegatedConnected === true)
    } catch {
      return
    }
  }

  const startTeamsDelegatedLogin = async () => {
    if (settingsLocked) return
    setTeamsDelegatedLoading(true)
    try {
      const res = await fetch('/api/consignado/teams/delegated/start', { method: 'POST' })
      const data = (await res.json().catch(() => null)) as
        | null
        | {
            userCode?: unknown
            verificationUri?: unknown
            message?: unknown
            expiresAt?: unknown
          }
      if (!res.ok) {
        const msg =
          (typeof (data as any)?.message === 'string' && String((data as any).message).trim()) ||
          `Falha ao iniciar login do Teams (HTTP ${res.status}).`
        throw new Error(msg)
      }
      const userCode = typeof data?.userCode === 'string' ? data.userCode.trim() : ''
      const verificationUri =
        typeof data?.verificationUri === 'string' ? data.verificationUri.trim() : ''
      const message = typeof data?.message === 'string' ? data.message.trim() : ''
      const expiresAt = typeof data?.expiresAt === 'string' ? data.expiresAt.trim() : ''
      if (!userCode || !verificationUri || !expiresAt) {
        throw new Error('Resposta inválida ao iniciar login do Teams.')
      }
      setTeamsDelegatedConnected(false)
      setTeamsDelegatedDeviceCode({ userCode, verificationUri, message, expiresAt })
      toast.success('Login do Teams iniciado.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao iniciar login do Teams.'
      toast.error(msg)
    } finally {
      setTeamsDelegatedLoading(false)
      void refreshTeamsDelegatedConnectedFromServer()
    }
  }

  const finishTeamsDelegatedLogin = async () => {
    if (settingsLocked) return
    setTeamsDelegatedLoading(true)
    const toastId = toast.loading('Aguardando autorização do Teams...')
    try {
      for (let i = 0; i < 40; i += 1) {
        const res = await fetch('/api/consignado/teams/delegated/finish', { method: 'POST' })
        const data = (await res.json().catch(() => null)) as null | { status?: string; message?: string }
        if (!res.ok) {
          throw new Error(data?.message || `Falha ao concluir login do Teams (HTTP ${res.status}).`)
        }
        const status = String(data?.status ?? '').trim()
        if (status === 'pending') {
          await new Promise((r) => window.setTimeout(r, 1500))
          continue
        }
        if (status === 'connected') {
          setTeamsDelegatedConnected(true)
          setTeamsDelegatedDeviceCode(null)
          toast.success('Teams conectado.', { id: toastId })
          return
        }
        if (status === 'expired') {
          setTeamsDelegatedConnected(false)
          setTeamsDelegatedDeviceCode(null)
          toast.error('Código expirado. Inicie o login novamente.', { id: toastId })
          return
        }
        toast.error('Resposta inválida ao concluir login do Teams.', { id: toastId })
        return
      }
      toast.error('Não foi possível concluir o login do Teams.', { id: toastId })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao concluir login do Teams.'
      toast.error(msg, { id: toastId })
    } finally {
      setTeamsDelegatedLoading(false)
      void refreshTeamsDelegatedConnectedFromServer()
    }
  }

  const disconnectTeamsDelegatedLogin = async () => {
    if (settingsLocked) return
    setTeamsDelegatedLoading(true)
    try {
      const res = await fetch('/api/consignado/teams/delegated/disconnect', { method: 'POST' })
      const data = (await res.json().catch(() => null)) as null | { status?: string; message?: string }
      if (!res.ok) {
        throw new Error(data?.message || `Falha ao desconectar Teams (HTTP ${res.status}).`)
      }
      setTeamsDelegatedConnected(false)
      setTeamsDelegatedDeviceCode(null)
      toast.success('Teams desconectado.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao desconectar Teams.'
      toast.error(msg)
    } finally {
      setTeamsDelegatedLoading(false)
      void refreshTeamsDelegatedConnectedFromServer()
    }
  }

  useEffect(() => {
    if (view !== 'configuracoes-automacao' && view !== 'conciliacao-extratos') return
    let cancelled = false
    Promise.resolve().then(() => {
      setOrgaoValuesLoading(true)
      setOrgaoValuesError(null)
    })
    fetch('/api/consignado/orgao-columns')
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | null
          | {
              values?: {
                extratos?: Array<{ value?: string; count?: number }>
                relatorio?: Array<{ value?: string; count?: number }>
              }
              message?: string
            }
        if (!res.ok) {
          throw new Error(data?.message || `Falha ao carregar órgãos (HTTP ${res.status}).`)
        }
        if (cancelled) return
        const extratos = Array.isArray(data?.values?.extratos)
          ? data!.values!.extratos!
              .map((v) => (typeof v.value === 'string' ? v.value : ''))
              .filter(Boolean)
          : []
        const relatorio = Array.isArray(data?.values?.relatorio)
          ? data!.values!.relatorio!
              .map((v) => (typeof v.value === 'string' ? v.value : ''))
              .filter(Boolean)
          : []
        setOrgaoValues({ extratos, relatorio })
      })
      .catch((e) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Falha ao carregar órgãos.'
        setOrgaoValuesError(msg)
        setOrgaoValues({ extratos: [], relatorio: [] })
      })
      .finally(() => {
        if (cancelled) return
        setOrgaoValuesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [view])

  useEffect(() => {
    if (view !== 'configuracoes-automacao') return
    let cancelled = false
    Promise.resolve().then(() => {
      setExtratosConsolidacaoRecursoLoading(true)
      setExtratosConsolidacaoRecursoError(null)
    })
    fetch('/api/consignado/extratos-consolidacao-recurso')
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | null
          | {
              items?: Array<{ orgao?: string; historico1?: string; createdAt?: string }>
              message?: string
            }
        if (!res.ok) {
          throw new Error(
            data?.message ||
              `Falha ao carregar consolidação de recurso (HTTP ${res.status}).`,
          )
        }
        if (cancelled) return
        const items = Array.isArray(data?.items)
          ? data!.items!
              .map((i) => ({
                orgao: typeof i.orgao === 'string' ? i.orgao : '',
                historico1: typeof i.historico1 === 'string' ? i.historico1 : '',
                createdAt: typeof i.createdAt === 'string' ? i.createdAt : '',
              }))
              .filter((i) => Boolean(i.orgao) && Boolean(i.historico1))
          : []
        setExtratosConsolidacaoRecurso(items)
      })
      .catch((e) => {
        if (cancelled) return
        const msg =
          e instanceof Error ? e.message : 'Falha ao carregar consolidação de recurso.'
        setExtratosConsolidacaoRecursoError(msg)
        setExtratosConsolidacaoRecurso([])
      })
      .finally(() => {
        if (cancelled) return
        setExtratosConsolidacaoRecursoLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [view])

  useEffect(() => {
    if (view !== 'configuracoes-automacao') return
    let cancelled = false
    Promise.resolve().then(() => {
      setExtratosHistorico1OptionsLoading(true)
    })
    fetch('/api/consignado/extratos/historico1-values')
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | null
          | { values?: Array<{ value?: string; count?: number }>; message?: string }
        if (!res.ok) {
          throw new Error(
            data?.message ||
              `Falha ao carregar HISTÓRICO_1 dos extratos (HTTP ${res.status}).`,
          )
        }
        if (cancelled) return
        const values = Array.isArray(data?.values)
          ? data!.values!
              .map((v) => (typeof v.value === 'string' ? v.value : ''))
              .filter(Boolean)
          : []
        setExtratosHistorico1Options(values)
      })
      .catch(() => {
        if (cancelled) return
        setExtratosHistorico1Options([])
      })
      .finally(() => {
        if (cancelled) return
        setExtratosHistorico1OptionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [view])

  useEffect(() => {
    if (
      view !== 'configuracoes-automacao' &&
      view !== 'conciliacao-extratos' &&
      view !== 'home' &&
      view !== 'dashboard' &&
      view !== 'relatorios-valores' &&
      view !== 'relatorios-auditoria'
    )
      return
    let cancelled = false
    Promise.resolve().then(() => {
      setOrgaoDeParaLoading(true)
      setOrgaoDeParaError(null)
    })
    fetch('/api/consignado/orgao-depara')
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | null
          | { items?: Array<{ extratos?: string; relatorio?: string }>; message?: string }
        if (!res.ok) {
          throw new Error(data?.message || `Falha ao carregar de/para (HTTP ${res.status}).`)
        }
        if (cancelled) return
        const items = Array.isArray(data?.items)
          ? data!.items!
              .map((i) => ({
                extratos: typeof i.extratos === 'string' ? i.extratos : '',
                relatorio: typeof i.relatorio === 'string' ? i.relatorio : '',
              }))
              .filter((i) => Boolean(i.extratos) && Boolean(i.relatorio))
          : []
        setOrgaoDePara(items)
      })
      .catch((e) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Falha ao carregar de/para.'
        setOrgaoDeParaError(msg)
        setOrgaoDePara([])
      })
      .finally(() => {
        if (cancelled) return
        setOrgaoDeParaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [view])

  const title = useMemo(() => {
    if (view === 'dashboard') return 'Dashboard'
    if (view === 'conciliacao-extratos') return 'Conciliação • Extratos'
    if (view === 'conciliacao-relatorio') return 'Conciliação • Relatório'
    if (view === 'relatorios-valores') return 'Conciliação'
    if (view === 'relatorios-auditoria') return 'Auditoria Sistêmica'
    if (view === 'configuracoes-automacao') return 'Automação'
    if (view === 'configuracoes-acessos') return 'Acessos'
    return 'Home'
  }, [view])

  const subtitle = useMemo(() => {
    if (view === 'dashboard') return 'KPIs, alertas e performance do portfólio'
    if (view === 'conciliacao-extratos')
      return 'Importação e conciliação a partir dos extratos'
    if (view === 'conciliacao-relatorio')
      return 'Importação e conciliação a partir do relatório'
    if (view === 'relatorios-valores')
      return 'Relatórios e extratos para conciliação de consignados'
    if (view === 'relatorios-auditoria') return 'Trilha e consistência de importações'
    if (view === 'configuracoes-automacao')
      return 'SharePoint, agendamento e notificações'
    if (view === 'configuracoes-acessos')
      return 'Perfis e permissões do módulo (IAM)'
    return 'Recuperação de Crédito • Portal Administrativo'
  }, [view])

  const conciliacaoMonthLabel = useMemo(() => {
    const found = conciliacaoMonthOptions.find((o) => o.value === conciliacaoMonth)
    return found?.label ?? conciliacaoMonth
  }, [conciliacaoMonth, conciliacaoMonthOptions])

  const conciliacaoAutoPairId = useMemo(() => {
    const found = conciliacaoData?.recurso?.find((x) => x.status === 'conciliado' && Boolean(x.pairId))
      ?.pairId
    return found ?? null
  }, [conciliacaoData])

  const conciliacaoActivePairId = conciliacaoSelectedPairId ?? conciliacaoAutoPairId

  const conciliacaoOrgaoOptions = useMemo(() => {
    const unique = orgaoDePara
      .map((i) => i.extratos.trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => a.localeCompare(b))
    return unique
  }, [orgaoDePara])

  function normalizeVencimentoLabel(v: unknown) {
    return String(v ?? '').trim() || '-'
  }
  function formatOcorrenciaActionLabel(v: unknown) {
    const t = String(v ?? '').trim()
    if (!t) return '-'
    if (t === 'alterar_orgao_relatorio_sisbr' || t.startsWith('alterar_orgao_relatorio')) return 'Alterar Órgão'
    if (t === 'repactuacao_relatorio_sisbr' || t.startsWith('repactuacao')) return 'Repactuação'
    if (t === 'liquidacao_ccs_relatorio_sisbr' || t.startsWith('liquidacao_ccs')) return 'Liquidação CCS'
    if (t === 'nao_possui_recurso_relatorio_sisbr' || t.startsWith('nao_possui_recurso')) return 'Não possui Recurso'
    if (
      t === 'recurso_judicial_valor_a_menor_relatorio_sisbr' ||
      t.startsWith('recurso_judicial_valor_a_menor')
    )
      return 'Recurso Judicial - Valor a Menor'
    if (t === 'quitado_recurso' || t.startsWith('quitado_recurso')) return 'Quitado'
    return t
  }
  type CloneSisbrAction = 'clonar_para_relatorio_sisbr' | 'quitado_recurso'
  type RepactuacaoStatus = 'pendente_gerente' | 'concluido'
  const repactuacaoStatusLabel = (s: RepactuacaoStatus) =>
    s === 'pendente_gerente' ? 'Pendente Gerente' : 'Concluido'
  const repactuacaoStatusStyle = (s: RepactuacaoStatus) =>
    s === 'concluido'
      ? { bg: 'rgba(0,174,157,0.20)', border: '1px solid rgba(0,174,157,0.55)' }
      : { bg: 'rgba(245,197,66,0.18)', border: '1px solid rgba(245,197,66,0.55)' }

  const RepactuacaoStatusSelect = (props: {
    value: RepactuacaoStatus
    onChange: (next: RepactuacaoStatus) => void
    disabled?: boolean
  }) => {
    const { value, onChange, disabled } = props
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
      if (!open) return
      const onDown = (e: MouseEvent) => {
        const el = ref.current
        if (!el) return
        if (e.target instanceof Node && !el.contains(e.target)) setOpen(false)
      }
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setOpen(false)
      }
      window.addEventListener('mousedown', onDown)
      window.addEventListener('keydown', onKey)
      return () => {
        window.removeEventListener('mousedown', onDown)
        window.removeEventListener('keydown', onKey)
      }
    }, [open])

    const base = repactuacaoStatusStyle(value)
    const options: RepactuacaoStatus[] = ['pendente_gerente', 'concluido']

    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          type="button"
          className="control"
          onClick={() => {
            if (disabled) return
            setOpen((v) => !v)
          }}
          disabled={Boolean(disabled)}
          style={{
            width: '100%',
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 12,
            background: base.bg,
            border: base.border,
            color: 'rgba(255,255,255,0.92)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.55 : 1,
          }}
        >
          <span style={{ fontWeight: 850 }}>{repactuacaoStatusLabel(value)}</span>
          <ChevronDown size={18} />
        </button>
        {open ? (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              zIndex: 80,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'rgb(12, 22, 40)',
              boxShadow: '0 20px 70px rgba(0,0,0,0.55)',
              overflow: 'hidden',
            }}
          >
            {options.map((opt) => {
              const st = repactuacaoStatusStyle(opt)
              const active = opt === value
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    background: active ? st.bg : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.10)',
                    color: 'rgba(255,255,255,0.92)',
                    cursor: 'pointer',
                    fontWeight: active ? 900 : 800,
                  }}
                >
                  {repactuacaoStatusLabel(opt)}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    )
  }

  const cloneSisbrActionLabel = (a: CloneSisbrAction) =>
    a === 'quitado_recurso' ? 'Quitado' : 'Clonar para Relatorio Sisbr'
  const cloneSisbrActionStyle = (a: CloneSisbrAction) =>
    a === 'quitado_recurso'
      ? { bg: 'rgba(245,197,66,0.18)', border: '1px solid rgba(245,197,66,0.55)' }
      : { bg: 'rgba(0,174,157,0.14)', border: '1px solid rgba(0,174,157,0.45)' }

  const CloneSisbrActionSelect = (props: {
    value: CloneSisbrAction
    onChange: (next: CloneSisbrAction) => void
    disabled?: boolean
  }) => {
    const { value, onChange, disabled } = props
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
      if (!open) return
      const onDown = (e: MouseEvent) => {
        const el = ref.current
        if (!el) return
        if (e.target instanceof Node && !el.contains(e.target)) setOpen(false)
      }
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setOpen(false)
      }
      window.addEventListener('mousedown', onDown)
      window.addEventListener('keydown', onKey)
      return () => {
        window.removeEventListener('mousedown', onDown)
        window.removeEventListener('keydown', onKey)
      }
    }, [open])

    const base = cloneSisbrActionStyle(value)
    const options: CloneSisbrAction[] = ['clonar_para_relatorio_sisbr', 'quitado_recurso']

    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          type="button"
          className="control"
          onClick={() => {
            if (disabled) return
            setOpen((v) => !v)
          }}
          disabled={Boolean(disabled)}
          style={{
            width: '100%',
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 12,
            background: base.bg,
            border: base.border,
            color: 'rgba(255,255,255,0.92)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.55 : 1,
          }}
        >
          <span style={{ fontWeight: 850 }}>{cloneSisbrActionLabel(value)}</span>
          <ChevronDown size={18} />
        </button>
        {open ? (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              zIndex: 80,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'rgb(12, 22, 40)',
              boxShadow: '0 20px 70px rgba(0,0,0,0.55)',
              overflow: 'hidden',
            }}
          >
            {options.map((opt) => {
              const st = cloneSisbrActionStyle(opt)
              const active = opt === value
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    background: active ? st.bg : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.10)',
                    color: active ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.90)',
                    cursor: 'pointer',
                    fontWeight: active ? 900 : 800,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 99,
                        background:
                          opt === 'quitado_recurso'
                            ? 'rgba(245,197,66,0.95)'
                            : 'rgba(0,174,157,0.95)',
                      }}
                    />
                    {cloneSisbrActionLabel(opt)}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    )
  }
  const vencimentoSortKey = (raw: string) => {
    const t = String(raw ?? '').trim()
    if (!t) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (m) return `${m[3]}-${m[2]}-${m[1]}`
    return t
  }

  const relatorioVencimentoOptions = useMemo(() => {
    if (view !== 'conciliacao-extratos') return []
    if (!conciliacaoData) return []
    const base = conciliacaoOnlyDiff
      ? conciliacaoData.relatorio.filter((x) => x.status === 'pendencia')
      : conciliacaoData.relatorio
    const unique = Array.from(new Set(base.map((r) => normalizeVencimentoLabel((r as any).vencimento))))
    unique.sort((a, b) => (vencimentoSortKey(a) || a).localeCompare(vencimentoSortKey(b) || b, 'pt-BR'))
    return unique
  }, [conciliacaoData, conciliacaoOnlyDiff, view])

  const conciliacaoCloseVencimentoOptions = useMemo(() => {
    return relatorioVencimentoOptions.filter((v) => !closedVencimentos.includes(v))
  }, [closedVencimentos, relatorioVencimentoOptions])

  const conciliacaoReopenVencimentoOptions = useMemo(() => {
    const unique = Array.from(new Set(closedVencimentos.map((v) => normalizeVencimentoLabel(v))))
    unique.sort((a, b) => (vencimentoSortKey(a) || a).localeCompare(vencimentoSortKey(b) || b, 'pt-BR'))
    return unique
  }, [closedVencimentos])

  useEffect(() => {
    if (!conciliacaoReopenModalOpen) return
    if (conciliacaoReopening) return
    if (conciliacaoReopenMode !== 'parcial') return
    const wanted = conciliacaoReopenVencimento.trim()
    if (wanted && conciliacaoReopenVencimentoOptions.includes(wanted)) return
    const first = conciliacaoReopenVencimentoOptions[0] ?? ''
    if (first && first !== wanted) setConciliacaoReopenVencimento(first)
  }, [
    conciliacaoReopenModalOpen,
    conciliacaoReopenMode,
    conciliacaoReopenVencimento,
    conciliacaoReopenVencimentoOptions,
    conciliacaoReopening,
  ])

  useEffect(() => {
    if (view !== 'dashboard') return
    if (conciliacaoOrgao.trim()) return
    if (conciliacaoMonthOptions.length === 0) return
    if (conciliacaoOrgaoOptions.length === 0) return

    const monthWanted =
      conciliacaoMonthOptions.find((o) => o.value === conciliacaoMonth)?.value ??
      conciliacaoMonthOptions[0].value

    if (monthWanted !== conciliacaoMonth) {
      setConciliacaoMonth(monthWanted)
      return
    }

    if (dashboardAutoPickRef.current === monthWanted) return
    dashboardAutoPickRef.current = monthWanted

    let cancelled = false
    ;(async () => {
      for (const orgao of conciliacaoOrgaoOptions) {
        if (cancelled) return
        try {
          const url = `/api/consignado/conciliacao/recurso-vs-relatorio?month=${encodeURIComponent(monthWanted)}&orgao=${encodeURIComponent(orgao)}`
          const res = await fetch(url)
          if (!res.ok) continue
          const data = (await res.json().catch(() => null)) as any
          const recurso = Array.isArray(data?.recurso) ? data.recurso : []
          const relatorio = Array.isArray(data?.relatorio) ? data.relatorio : []
          const hasPendencia =
            recurso.some((x: any) => x?.status === 'pendencia') ||
            relatorio.some((x: any) => x?.status === 'pendencia')
          if (hasPendencia) {
            if (!cancelled) setConciliacaoOrgao(orgao)
            return
          }
        } catch {
          continue
        }
      }
      if (!cancelled) setConciliacaoOrgao(conciliacaoOrgaoOptions[0] ?? '')
    })()

    return () => {
      cancelled = true
    }
  }, [conciliacaoMonth, conciliacaoMonthOptions, conciliacaoOrgao, conciliacaoOrgaoOptions, view])

  useEffect(() => {
    if (view !== 'home') return
    if (conciliacaoMonthOptions.length === 0) return
    if (conciliacaoOrgaoOptions.length === 0) return

    const monthWanted =
      conciliacaoMonthOptions.find((o) => o.value === conciliacaoMonth)?.value ??
      conciliacaoMonthOptions[0].value

    if (monthWanted !== conciliacaoMonth) {
      setConciliacaoMonth(monthWanted)
      return
    }

    const selected = conciliacaoOrgao.trim()
    const shouldPick =
      !selected || !conciliacaoOrgaoOptions.some((o) => o.trim() === selected)
    if (!shouldPick) return

    const runKey = `${monthWanted}|${selected}`
    if (homeAutoPickRef.current === runKey) return
    homeAutoPickRef.current = runKey

    let cancelled = false
    ;(async () => {
      for (const orgao of conciliacaoOrgaoOptions) {
        if (cancelled) return
        try {
          const url = `/api/consignado/conciliacao/recurso-vs-relatorio?month=${encodeURIComponent(monthWanted)}&orgao=${encodeURIComponent(orgao)}`
          const res = await fetch(url)
          if (!res.ok) continue
          const data = (await res.json().catch(() => null)) as any
          const isClosed = Boolean(data?.closed?.isClosed)
          if (!isClosed) {
            if (!cancelled) setConciliacaoOrgao(orgao)
            return
          }
        } catch {
          continue
        }
      }
      if (!cancelled) setConciliacaoOrgao(conciliacaoOrgaoOptions[0] ?? '')
    })()

    return () => {
      cancelled = true
    }
  }, [conciliacaoMonth, conciliacaoMonthOptions, conciliacaoOrgao, conciliacaoOrgaoOptions, view])

  const relatorioOcorrenciaOrgaoOptions = useMemo(() => {
    const base =
      Array.isArray(orgaoValues.extratos) && orgaoValues.extratos.length > 0
        ? orgaoValues.extratos
        : conciliacaoOrgaoOptions
    return base.map((s) => s.trim()).filter(Boolean)
  }, [conciliacaoOrgaoOptions, orgaoValues.extratos])

  const withCurrency = (value: string) => {
    const v = value.trim()
    return v.startsWith('R$') ? v : `R$ ${v}`
  }

  const centsToPtBr = (cents: number) => {
    const safe = Number.isFinite(cents) ? cents : 0
    const value = safe / 100
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const formatIsoToPtBrDateTime = (iso: string | null) => {
    const raw = String(iso ?? '').trim()
    if (!raw) return '—'
    const d = new Date(raw)
    if (!Number.isFinite(d.getTime())) return raw
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = String(d.getFullYear())
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`
  }

  const ptBrMoneyToCents = (value: string) => {
    const cleaned = String(value ?? '')
      .trim()
      .replace(/[^\d,.-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
    const n = Number(cleaned)
    if (!Number.isFinite(n)) return 0
    return Math.round(n * 100)
  }

  useEffect(() => {
    if (relatorioOcorrenciaAction !== 'nao_possui_recurso_relatorio_sisbr') return
    setRelatorioOcorrenciaJustification((prev) =>
      prev.trim() ? prev : defaultNaoPossuiRecursoMessage,
    )
  }, [defaultNaoPossuiRecursoMessage, relatorioOcorrenciaAction])

  useEffect(() => {
    if (relatorioOcorrenciaAction !== 'recurso_judicial_valor_a_menor_relatorio_sisbr') return
    if (!ocorrenciaModal) return
    const oldCents = ptBrMoneyToCents(ocorrenciaModal.value)
    const newCents = ptBrMoneyToCents(relatorioRecursoJudicialNovoValor || ocorrenciaModal.value)
    const diffCents = Math.max(0, oldCents - newCents)
    const template =
      'Servidora com recurso judicial contra a cooperativa.\n\n' +
      `Valor Contrato Original: R$ ${centsToPtBr(oldCents)}\n` +
      `Valor Judicial (Valor editado): R$ ${centsToPtBr(newCents)}\n` +
      `Diferença: R$ ${centsToPtBr(diffCents)}`
    setRelatorioOcorrenciaJustification((prev) =>
      relatorioRecursoJudicialAutoJustification || !prev.trim() ? template : prev,
    )
  }, [
    centsToPtBr,
    ocorrenciaModal,
    ptBrMoneyToCents,
    relatorioOcorrenciaAction,
    relatorioRecursoJudicialAutoJustification,
    relatorioRecursoJudicialNovoValor,
  ])

  const normalizeLinkKey = (cpf: string, nome: string) => {
    const cpfDigits = String(cpf ?? '').replace(/\D/g, '')
    const nomeRaw = String(nome ?? '')
      .trim()
      .replace(/\s+/g, ' ')
    const nomeNoAccent = nomeRaw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
    return `${cpfDigits}||${nomeNoAccent}`
  }

  const normalizeSearchText = (input: string) =>
    String(input ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()

  const normalizeSearchDigits = (input: string) => String(input ?? '').replace(/\D/g, '')

  const normalizeSortNome = (nome: string) =>
    String(nome ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()

  const persistAccess = (
    nextEmails: string[],
    nextRoles: Record<string, 'admin' | 'usuario'>,
  ) => {
    const fixed = accessFixedEmail.trim().toLowerCase()
    const normalizedEmails = nextEmails
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .filter((e, i, arr) => arr.indexOf(e) === i)

    const withFixed = normalizedEmails.includes(fixed)
      ? normalizedEmails.map((e) => (e === fixed ? fixed : e))
      : [fixed, ...normalizedEmails]

    const entries: Array<{ email: string; role: 'admin' | 'usuario' }> =
      withFixed.map(
        (email): { email: string; role: 'admin' | 'usuario' } => ({
          email,
          role: email === fixed ? 'admin' : (nextRoles[email] ?? 'usuario'),
        }),
      )

    Promise.resolve().then(() => {
      setAccessEmailsSaving(true)
      setAccessEmailsError(null)
    })

    fetch('/api/consignado/access/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entries }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | {
              entries?: Array<{ email?: string; role?: 'admin' | 'usuario' }>
              fixedEmail?: string
              message?: string
            }
          | null
        if (!res.ok) {
          const msg =
            data?.message || `Falha ao salvar acessos (HTTP ${res.status}).`
          throw new Error(msg)
        }
        const fixedRes = (data?.fixedEmail || fixed).trim().toLowerCase()
        const entriesRaw = Array.isArray(data?.entries) ? data?.entries : entries
        const finalEntries: Array<{ email: string; role: 'admin' | 'usuario' }> =
          entriesRaw
            .map(
              (e): { email: string; role: 'admin' | 'usuario' } => ({
                email: String(e.email ?? '').trim().toLowerCase(),
                role: e.role === 'admin' ? 'admin' : 'usuario',
              }),
            )
            .filter((e) => Boolean(e.email))
            .filter(
              (e, i, arr) => arr.findIndex((x) => x.email === e.email) === i,
            )
            .map((e) =>
              e.email === fixedRes ? { email: fixedRes, role: 'admin' } : e,
            )

        const roleMap = finalEntries.reduce(
          (acc, e) => {
            acc[e.email] = e.role
            return acc
          },
          {} as Record<string, 'admin' | 'usuario'>,
        )

        setAccessFixedEmail(fixedRes)
        setAccessEmails(finalEntries.map((e) => e.email))
        setAccessRoleByEmail(roleMap)
      })
      .catch((e) => {
        setAccessEmailsError(
          e instanceof Error ? e.message : 'Falha ao salvar acessos.',
        )
      })
      .finally(() => {
        setAccessEmailsSaving(false)
      })
  }

  useEffect(() => {
    if (
      view !== 'conciliacao-extratos' &&
      view !== 'home' &&
      view !== 'dashboard' &&
      view !== 'relatorios-valores' &&
      view !== 'relatorios-auditoria'
    )
      return
    let cancelled = false
    Promise.resolve().then(() => setConciliacaoMonthsLoading(true))
    fetch('/api/consignado/conciliacao/meses')
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as ConciliacaoMonthsResponse | null
        if (!res.ok) {
          throw new Error(data && 'message' in data ? data.message : `Falha ao listar meses (HTTP ${res.status}).`)
        }
        const months = data && 'months' in data ? data.months : []
        const options = months.map((value) => {
          const parts = value.split('-')
          const label =
            parts.length === 2 ? `${parts[1]}/${parts[0]}` : value
          return { value, label }
        })
        if (cancelled) return
        setConciliacaoMonthOptions(options)
        setConciliacaoMonth((prev) =>
          options.length > 0 && !options.some((o) => o.value === prev)
            ? options[0].value
            : prev,
        )
      })
      .catch((e) => {
        if (cancelled) return
        const message = e instanceof Error ? e.message : 'Falha ao listar meses.'
        setConciliacaoError(message)
        setConciliacaoMonthOptions([])
      })
      .finally(() => {
        if (cancelled) return
        setConciliacaoMonthsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [view])

  useEffect(() => {
    if (
      view !== 'conciliacao-extratos' &&
      view !== 'home' &&
      view !== 'dashboard' &&
      view !== 'relatorios-valores'
    )
      return
    if (!conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)) return
    if (!conciliacaoOrgao.trim()) {
      setConciliacaoData(null)
      setConciliacaoExpandedKeys([])
      setConciliacaoSelectedPairId(null)
      setConciliacaoSelectedPersonKey(null)
      setConciliacaoLoadedAtIso(null)
      return
    }

    const requestId = conciliacaoFetchRef.current + 1
    conciliacaoFetchRef.current = requestId

    Promise.resolve().then(() => {
      setConciliacaoLoading(true)
      setConciliacaoError(null)
    })

    const orgaoQuery = `&orgao=${encodeURIComponent(conciliacaoOrgao.trim())}`
    ;(async () => {
      const url = `/api/consignado/conciliacao/recurso-vs-relatorio?month=${encodeURIComponent(conciliacaoMonth)}${orgaoQuery}`
      const retryStatuses = new Set([502, 503, 504])
      const retryDelaysMs = [600, 1600, 3200]
      let lastError: unknown = null

      for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
        try {
          const res = await fetch(url)
          const data = (await res.json().catch(() => null)) as ConciliacaoResponse | null
          if (!res.ok) {
            if (retryStatuses.has(res.status) && attempt < retryDelaysMs.length) {
              lastError = new Error(`Falha ao conciliar (HTTP ${res.status}).`)
              await new Promise((r) => setTimeout(r, retryDelaysMs[attempt]))
              continue
            }
            throw new Error(
              data && 'message' in data ? data.message : `Falha ao conciliar (HTTP ${res.status}).`,
            )
          }
          if (conciliacaoFetchRef.current !== requestId) return
          setConciliacaoData(data as NonNullable<typeof conciliacaoData>)
          setConciliacaoLoadedAtIso((data as any)?.lastUpdatedAt ?? null)
          setConciliacaoExpandedKeys([])
          setConciliacaoSelectedPairId(null)
          setConciliacaoSelectedPersonKey(null)
          return
        } catch (e) {
          lastError = e
          const isNetwork = e instanceof TypeError
          if (isNetwork && attempt < retryDelaysMs.length) {
            await new Promise((r) => setTimeout(r, retryDelaysMs[attempt]))
            continue
          }
          break
        }
      }

      if (conciliacaoFetchRef.current !== requestId) return
      const message =
        lastError instanceof Error
          ? lastError.message
          : 'Falha ao conciliar.'
      setConciliacaoError(message)
      setConciliacaoData(null)
      setConciliacaoSelectedPairId(null)
      setConciliacaoSelectedPersonKey(null)
      setConciliacaoLoadedAtIso(null)
    })()
      .finally(() => {
        if (conciliacaoFetchRef.current !== requestId) return
        setConciliacaoLoading(false)
      })
  }, [conciliacaoMonth, conciliacaoMonthOptions, conciliacaoOrgao, view])

  const reloadConciliacaoKeepExpanded = async () => {
    if (view !== 'conciliacao-extratos') return
    if (!conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)) return
    if (!conciliacaoOrgao.trim()) return

    const requestId = conciliacaoFetchRef.current + 1
    conciliacaoFetchRef.current = requestId

    setConciliacaoLoading(true)
    setConciliacaoError(null)

    const orgaoQuery = `&orgao=${encodeURIComponent(conciliacaoOrgao.trim())}`
    try {
      const url = `/api/consignado/conciliacao/recurso-vs-relatorio?month=${encodeURIComponent(conciliacaoMonth)}${orgaoQuery}`
      const retryStatuses = new Set([502, 503, 504])
      const retryDelaysMs = [600, 1600, 3200]
      let lastError: unknown = null
      let data: ConciliacaoResponse | null = null
      let okRes: Response | null = null

      for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
        try {
          const res = await fetch(url)
          okRes = res
          data = (await res.json().catch(() => null)) as ConciliacaoResponse | null
          if (!res.ok) {
            if (retryStatuses.has(res.status) && attempt < retryDelaysMs.length) {
              lastError = new Error(`Falha ao conciliar (HTTP ${res.status}).`)
              await new Promise((r) => setTimeout(r, retryDelaysMs[attempt]))
              continue
            }
            throw new Error(
              data && 'message' in data ? data.message : `Falha ao conciliar (HTTP ${res.status}).`,
            )
          }
          break
        } catch (e) {
          lastError = e
          const isNetwork = e instanceof TypeError
          if (isNetwork && attempt < retryDelaysMs.length) {
            await new Promise((r) => setTimeout(r, retryDelaysMs[attempt]))
            continue
          }
          break
        }
      }

      if (!okRes || !okRes.ok) {
        throw (lastError instanceof Error ? lastError : new Error('Falha ao conciliar.'))
      }
      if (conciliacaoFetchRef.current !== requestId) return
      setConciliacaoData(data as NonNullable<typeof conciliacaoData>)
      setConciliacaoLoadedAtIso((data as any)?.lastUpdatedAt ?? null)
      setConciliacaoSelectedPairId(null)
      setConciliacaoSelectedPersonKey(null)
    } finally {
      if (conciliacaoFetchRef.current !== requestId) return
      setConciliacaoLoading(false)
    }
  }

  const captureConciliacaoEvidencePngBase64 = async () => {
    const el = conciliacaoEvidenceRef.current
    if (!el) throw new Error('Não foi possível gerar a evidência.')

    setIsCapturingEvidence(true)
    setConciliacaoExpandedKeys((prev) => (prev.includes('__MONTH__') ? prev : [...prev, '__MONTH__']))

    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    await new Promise<void>((r) => setTimeout(r, 250))

    const withCaptureTweaks = (root: HTMLElement) => {
      const prevStyleAttr = new Map<HTMLElement, string | null>()
      const remember = (node: HTMLElement) => {
        if (prevStyleAttr.has(node)) return
        prevStyleAttr.set(node, node.getAttribute('style'))
      }
      const set = (node: HTMLElement, patch: Partial<CSSStyleDeclaration>) => {
        remember(node)
        Object.assign(node.style, patch)
      }

      set(root, { overflow: 'visible', maxHeight: 'none', height: 'auto' })
      remember(root)
      ;(root.style as any).zoom = '0.60'
      const main = root.closest('.main') as HTMLElement | null
      if (main) set(main, { overflow: 'visible' })

      for (const node of Array.from(
        root.querySelectorAll<HTMLElement>(
          'td[title],[style*="text-overflow: ellipsis"],[style*="overflow: hidden"]',
        ),
      )) {
        if (node.closest('tr[data-side="recurso"], tr[data-side="relatorio"]')) continue
        set(node, {
          overflow: 'visible',
          textOverflow: 'clip',
          maxWidth: 'none',
        })
      }

      for (const node of Array.from(root.querySelectorAll<HTMLElement>('[data-evidence-title]'))) {
        set(node, {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
        })
      }

      const cleanup = () => {
        for (const [node, prev] of prevStyleAttr.entries()) {
          if (prev === null) node.removeAttribute('style')
          else node.setAttribute('style', prev)
        }
      }
      return cleanup
    }

    const cleanup = withCaptureTweaks(el)
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: '#0b1220',
        scale: 2,
        useCORS: true,
      })
      const dataUrl = canvas.toDataURL('image/png')
      const base64 = String(dataUrl.split(',')[1] ?? '').trim()
      if (!base64) throw new Error('Não foi possível gerar a evidência.')
      return base64
    } finally {
      cleanup()
      setIsCapturingEvidence(false)
    }
  }

  const exportConciliacaoXlsx = async () => {
    if (!canExportConciliacaoXlsx) {
      setConciliacaoError('Nenhuma conciliação carregada para exportar.')
      return
    }
    if (!conciliacaoOrgao.trim()) {
      setConciliacaoError('Selecione um órgão para exportar.')
      return
    }
    if (!conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)) {
      setConciliacaoError('Selecione uma competência válida para exportar.')
      return
    }

    setConciliacaoExportingXlsx(true)
    setConciliacaoError(null)
    const toastId = toast.loading('Exportando XLSX...')
    try {
      const query = new URLSearchParams({
        month: conciliacaoMonth,
        orgao: conciliacaoOrgao.trim(),
        onlyDiff: conciliacaoOnlyDiff ? '1' : '0',
      })
      const res = await fetch(`/api/consignado/conciliacao/recurso-vs-relatorio/export.xlsx?${query}`)
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as null | { message?: string }
        throw new Error(json?.message || `Falha ao exportar XLSX (HTTP ${res.status}).`)
      }
      const blob = await res.blob()
      const dispo = String(res.headers.get('content-disposition') ?? '')
      const fileName =
        dispo.match(/filename="([^"]+)"/i)?.[1] ||
        `Conciliação_Extratos_${conciliacaoMonth}_${conciliacaoOrgao.trim()}.xlsx`
      const navAny = navigator as any
      if (typeof navAny?.msSaveOrOpenBlob === 'function') {
        navAny.msSaveOrOpenBlob(blob, fileName)
        toast.success('XLSX pronto para download.', { id: toastId })
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('XLSX pronto para download.', { id: toastId })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao exportar XLSX.'
      setConciliacaoError(msg)
      toast.error(msg, { id: toastId })
    } finally {
      setConciliacaoExportingXlsx(false)
    }
  }

  const exportConciliacaoPdf = async () => {
    if (!canExportConciliacaoXlsx) {
      setConciliacaoError('Nenhuma conciliação carregada para exportar.')
      return
    }
    if (!conciliacaoOrgao.trim()) {
      setConciliacaoError('Selecione um órgão para exportar.')
      return
    }
    if (!conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)) {
      setConciliacaoError('Selecione uma competência válida para exportar.')
      return
    }

    setConciliacaoExportingPdf(true)
    setConciliacaoError(null)
    const toastId = toast.loading('Exportando PDF...')
    try {
      const query = new URLSearchParams({
        month: conciliacaoMonth,
        orgao: conciliacaoOrgao.trim(),
      })
      const res = await fetch(`/api/consignado/conciliacao/recurso-vs-relatorio/export.pdf?${query}`)
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as null | { message?: string }
        throw new Error(json?.message || `Falha ao exportar PDF (HTTP ${res.status}).`)
      }
      const blob = await res.blob()
      const dispo = String(res.headers.get('content-disposition') ?? '')
      const fileName =
        dispo.match(/filename="([^"]+)"/i)?.[1] ||
        `CONSIGNADOS_CONFERENCIA_${conciliacaoOrgao.trim()}_${conciliacaoMonth}.pdf`
      const navAny = navigator as any
      if (typeof navAny?.msSaveOrOpenBlob === 'function') {
        navAny.msSaveOrOpenBlob(blob, fileName)
        toast.success('PDF pronto para download.', { id: toastId })
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('PDF pronto para download.', { id: toastId })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao exportar PDF.'
      setConciliacaoError(msg)
      toast.error(msg, { id: toastId })
    } finally {
      setConciliacaoExportingPdf(false)
    }
  }

  const commandActions = useMemo(() => {
    const items: Array<{
      id: string
      label: string
      hint?: string
      shortcut?: string
      enabled?: boolean
      run: () => void | Promise<void>
    }> = [
      {
        id: 'go-home',
        label: 'Home',
        shortcut: 'H',
        run: () => setHash('home'),
      },
      {
        id: 'go-dashboard',
        label: 'Dashboard',
        shortcut: 'D',
        run: () => setHash('dashboard'),
      },
      {
        id: 'open-conciliacao',
        label: 'Abrir conciliação',
        hint: 'Conciliação • Extratos',
        shortcut: 'Enter',
        run: () => setHash('conciliacao-extratos'),
      },
      {
        id: 'export-xlsx',
        label: 'Exportar XLSX',
        hint: 'Recurso x Relatório Sisbr',
        shortcut: 'X',
        enabled:
          Boolean(canExportConciliacaoXlsx) &&
          Boolean(conciliacaoOrgao.trim()) &&
          conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth),
        run: () => void exportConciliacaoXlsx(),
      },
      {
        id: 'settings-automacao',
        label: 'Configurações • Automação',
        shortcut: 'A',
        run: () => {
          setSettingsOpen(true)
          setReportsOpen(false)
          setHash('configuracoes-automacao')
        },
      },
      {
        id: 'settings-acessos',
        label: 'Configurações • Acessos',
        shortcut: 'I',
        enabled: userRole === 'admin',
        run: () => {
          setSettingsOpen(true)
          setReportsOpen(false)
          setHash('configuracoes-acessos')
        },
      },
    ]
    return items
  }, [
    canExportConciliacaoXlsx,
    conciliacaoMonth,
    conciliacaoMonthOptions,
    conciliacaoOrgao,
    exportConciliacaoXlsx,
    setHash,
    setReportsOpen,
    setSettingsOpen,
    userRole,
  ])

  const commandFilteredActions = useMemo(() => {
    const q = commandQuery.trim().toLowerCase()
    if (!q) return commandActions
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
    const nq = norm(q)
    return commandActions.filter((a) => {
      const hay = norm([a.label, a.hint].filter(Boolean).join(' '))
      return hay.includes(nq)
    })
  }, [commandActions, commandQuery])

  useEffect(() => {
    if (!cloneSisbrModal) {
      setCloneSisbrDevolucaoDate('')
      return
    }
    if (cloneSisbrAction !== 'quitado_recurso') {
      setCloneSisbrDevolucaoDate('')
    }
  }, [cloneSisbrAction, cloneSisbrModal])

  useEffect(() => {
    if (!cloneSisbrModal) {
      setCloneSisbrContext(null)
      return
    }
    if (cloneSisbrAction !== 'clonar_para_relatorio_sisbr') {
      setCloneSisbrContext(null)
      return
    }
    if (!conciliacaoOrgao.trim()) {
      setCloneSisbrContext(null)
      return
    }
    let cancelled = false
    fetch('/api/consignado/conciliacao/recurso-vs-relatorio/ocorrencia-context', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        month: conciliacaoMonth,
        orgao: conciliacaoOrgao.trim(),
        cpf: cloneSisbrModal.cpf,
        value: cloneSisbrModal.value,
      }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | null
          | {
              targetEmpresa?: string
              sourceEmpresas?: string[]
              totalMatches?: number
              willUpdateCount?: number
              message?: string
            }
        if (!res.ok) {
          throw new Error(data?.message || `Falha ao carregar ocorrência (HTTP ${res.status}).`)
        }
        if (cancelled) return
        const targetEmpresa = typeof data?.targetEmpresa === 'string' ? data.targetEmpresa : ''
        const sourceEmpresas = Array.isArray(data?.sourceEmpresas)
          ? data!.sourceEmpresas!.map((s) => String(s ?? '').trim()).filter(Boolean)
          : []
        setCloneSisbrContext({
          targetEmpresa,
          sourceEmpresas,
          totalMatches: Number(data?.totalMatches ?? 0) || 0,
          willUpdateCount: Number(data?.willUpdateCount ?? 0) || 0,
        })
      })
      .catch(() => {
        if (cancelled) return
        setCloneSisbrContext(null)
      })
    return () => {
      cancelled = true
    }
  }, [cloneSisbrAction, cloneSisbrModal, conciliacaoMonth, conciliacaoOrgao])

  useLayoutEffect(() => {
    const detail = conciliacaoData
    const expanded = conciliacaoExpandedKeys.includes('__MONTH__')
    const host = conciliacaoLinkHostRef.current

    const enabled =
      view === 'conciliacao-extratos' &&
      expanded &&
      Boolean(detail) &&
      (Boolean(conciliacaoActivePairId) || Boolean(conciliacaoSelectedPersonKey)) &&
      Boolean(host)

    if (!enabled) {
      setConciliacaoLinkOverlay((prev) => (prev === null ? prev : null))
      return
    }

    let raf = 0
    let raf2 = 0
    let settleRaf = 0
    const compute = (): boolean => {
      const d = conciliacaoData
      const pairId = conciliacaoActivePairId
      const selectedPersonKey = conciliacaoSelectedPersonKey
      const hostEl = conciliacaoLinkHostRef.current
      if (!d || !hostEl) {
        setConciliacaoLinkOverlay((prev) => (prev === null ? prev : null))
        return false
      }

      const isUsableRow = (el: HTMLTableRowElement | null) => {
        if (!el) return false
        if (!el.isConnected) return false
        if (!hostEl.contains(el)) return false
        return true
      }

      const hostRect = hostEl.getBoundingClientRect()
      const width = Math.max(0, hostRect.width, hostEl.scrollWidth)
      const height = Math.max(0, hostRect.height, hostEl.scrollHeight)
      if (!width || !height) {
        setConciliacaoLinkOverlay((prev) => (prev === null ? prev : null))
        return false
      }

      let personKey: string | null = null
      if (selectedPersonKey) personKey = selectedPersonKey
      if (!personKey && pairId) {
        const focusFromRecurso = d.recurso.find((x) => x.pairId === pairId) ?? null
        const focusFromRelatorio = d.relatorio.find((x) => x.pairId === pairId) ?? null
        const focus = focusFromRecurso ?? focusFromRelatorio
        if (focus) personKey = normalizeLinkKey(focus.cpf, focus.nome)
      }
      if (!personKey) {
        setConciliacaoLinkOverlay((prev) => (prev === null ? prev : null))
        return false
      }
      const allRecursoRows = Array.from(
        hostEl.querySelectorAll('tr[data-side="recurso"]'),
      ) as HTMLTableRowElement[]
      const allRelatorioRows = Array.from(
        hostEl.querySelectorAll('tr[data-side="relatorio"]'),
      ) as HTMLTableRowElement[]

      const pidSel = !selectedPersonKey ? (pairId ? pairId : null) : null

      const recursoRowByPid = pidSel
        ? allRecursoRows.find((el) => el.getAttribute('data-pair-id') === pidSel) ?? null
        : null
      const relatorioRowByPid = pidSel
        ? allRelatorioRows.find((el) => el.getAttribute('data-pair-id') === pidSel) ?? null
        : null

      const recursoRowsByPerson = allRecursoRows
        .filter((el) => el.getAttribute('data-person-key') === personKey)
        .filter((el) => el.getAttribute('data-status') === 'conciliado')
        .filter((el) => isUsableRow(el))
      const relatorioRowsByPerson = allRelatorioRows
        .filter((el) => el.getAttribute('data-person-key') === personKey)
        .filter((el) => el.getAttribute('data-status') === 'conciliado')
        .filter((el) => isUsableRow(el))

      const recursoGroupRow =
        allRecursoRows.find((el) => el.getAttribute('data-group-key') === personKey) ??
        null
      const relatorioGroupRow =
        allRelatorioRows.find((el) => el.getAttribute('data-group-key') === personKey) ??
        null

      const limit = 30
      const take = <T,>(arr: T[]) => (arr.length > limit ? arr.slice(0, limit) : arr)

      let starts: HTMLTableRowElement[] = []
      let ends: HTMLTableRowElement[] = []

      const hasRecursoPid = isUsableRow(recursoRowByPid)
      const hasRelatorioPid = isUsableRow(relatorioRowByPid)
      const hasRecursoGroup = isUsableRow(recursoGroupRow)
      const hasRelatorioGroup = isUsableRow(relatorioGroupRow)

      if (hasRecursoPid && hasRelatorioPid) {
        starts = [recursoRowByPid!]
        ends = [relatorioRowByPid!]
      } else if (hasRecursoGroup && relatorioRowsByPerson.length > 0) {
        starts = [recursoGroupRow!]
        ends = take(relatorioRowsByPerson)
      } else if (hasRelatorioGroup && recursoRowsByPerson.length > 0) {
        starts = take(recursoRowsByPerson)
        ends = [relatorioGroupRow!]
      } else if (hasRecursoPid && hasRelatorioGroup) {
        starts = [recursoRowByPid!]
        ends = [relatorioGroupRow!]
      } else if (hasRecursoGroup && hasRelatorioPid) {
        starts = [recursoGroupRow!]
        ends = [relatorioRowByPid!]
      } else if (hasRecursoGroup && hasRelatorioGroup) {
        starts = [recursoGroupRow!]
        ends = [relatorioGroupRow!]
      } else {
        setConciliacaoLinkOverlay((prev) => (prev === null ? prev : null))
        return false
      }

      const paths: string[] = []
      for (const startEl of starts) {
        if (!isUsableRow(startEl)) continue
        const sRect = startEl.getBoundingClientRect()
        const startX = sRect.right - hostRect.left
        const startY = sRect.top + sRect.height / 2 - hostRect.top

        for (const targetEl of ends) {
          if (!isUsableRow(targetEl)) continue
          const tRect = targetEl.getBoundingClientRect()
          const endX = tRect.left - hostRect.left
          const endY = tRect.top + tRect.height / 2 - hostRect.top
          const spanX = Math.max(0, endX - startX)
          const dy = endY - startY
          const curve = Math.max(120, Math.min(360, spanX * 0.55))
          const arch = Math.max(28, Math.min(140, spanX * 0.14))
          const bend = arch * (dy >= 0 ? 1 : -1)
          const c1x = startX + curve
          const c1y = startY - bend
          const c2x = endX - curve
          const c2y = endY + bend
          paths.push(
            `M ${startX} ${startY} C ${c1x} ${c1y} ${c2x} ${c2y} ${endX} ${endY}`,
          )
          if (paths.length >= limit) break
        }
        if (paths.length >= limit) break
      }

      if (paths.length === 0) {
        setConciliacaoLinkOverlay((prev) => (prev === null ? prev : null))
        return false
      }

      setConciliacaoLinkOverlay((prev) => {
        if (
          prev &&
          prev.width === width &&
          prev.height === height &&
          prev.paths.join('|') === paths.join('|')
        ) {
          return prev
        }
        return { width, height, paths }
      })
      return true
    }

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf)
      if (raf2) cancelAnimationFrame(raf2)
      raf = requestAnimationFrame(() => {
        raf = 0
        raf2 = requestAnimationFrame(() => {
          raf2 = 0
          compute()
        })
      })
    }

    schedule()
    const settleStart = performance.now()
    const settle = () => {
      compute()
      if (performance.now() - settleStart > 2000) return
      settleRaf = requestAnimationFrame(settle)
    }
    settleRaf = requestAnimationFrame(settle)

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            schedule()
          })
        : null
    if (ro && host) {
      ro.observe(host)
      const tables = Array.from(host.querySelectorAll('table'))
      for (const t of tables) ro.observe(t)
      const tbodies = Array.from(host.querySelectorAll('tbody'))
      for (const tb of tbodies) ro.observe(tb)
    }
    const mo =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            schedule()
          })
        : null
    if (mo && host) mo.observe(host, { childList: true, subtree: true })
    const fonts = (document as any).fonts
    if (fonts && typeof fonts.ready?.then === 'function') {
      fonts.ready.then(() => schedule()).catch(() => {})
    }
    window.addEventListener('load', schedule)
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      if (raf2) cancelAnimationFrame(raf2)
      if (settleRaf) cancelAnimationFrame(settleRaf)
      ro?.disconnect()
      mo?.disconnect()
      window.removeEventListener('load', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      window.visualViewport?.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('scroll', schedule)
    }
  }, [
    view,
    conciliacaoExpandedKeys,
    conciliacaoData,
    conciliacaoActivePairId,
    conciliacaoSelectedPersonKey,
    conciliacaoOnlyDiff,
  ])

  useEffect(() => {
    if (view !== 'conciliacao-extratos') return
    setRelatorioVencimentoFilter('')
  }, [view, conciliacaoMonth, conciliacaoOrgao])

  return (
    <div className="credito-root">
      <Toaster theme="dark" richColors position="top-right" />
      <Dialog.Root open={commandOpen} onOpenChange={setCommandOpen}>
        <AnimatePresence>
          {commandOpen ? (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  className="cmd-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount onOpenAutoFocus={(e) => e.preventDefault()}>
                <motion.div
                  className="cmd-content"
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 14, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                >
                  <div className="cmd-head">
                    <div className="cmd-title">Comandos</div>
                    <button type="button" className="cmd-close" onClick={() => setCommandOpen(false)}>
                      ×
                    </button>
                  </div>

                  <div className="cmd-search">
                    <Search size={18} />
                    <input
                      ref={commandInputRef}
                      className="cmd-input"
                      value={commandQuery}
                      onChange={(e) => setCommandQuery(e.target.value)}
                      placeholder="Buscar ações... (Ctrl+K)"
                    />
                    <span className="cmd-kbd">Esc</span>
                  </div>

                  <div className="cmd-list" role="listbox">
                    {commandFilteredActions.length === 0 ? (
                      <div className="cmd-empty">Nenhuma ação encontrada.</div>
                    ) : (
                      commandFilteredActions.map((a) => {
                        const enabled = a.enabled !== false
                        return (
                          <button
                            key={a.id}
                            type="button"
                            className={enabled ? 'cmd-item' : 'cmd-item cmd-item-disabled'}
                            disabled={!enabled}
                            onClick={async () => {
                              setCommandOpen(false)
                              await Promise.resolve(a.run())
                            }}
                          >
                            <span className="cmd-item-main">
                              <span className="cmd-item-label">{a.label}</span>
                              {a.hint ? <span className="cmd-item-hint">{a.hint}</span> : null}
                            </span>
                            {a.shortcut ? <span className="cmd-kbd">{a.shortcut}</span> : null}
                          </button>
                        )
                      })
                    )}
                  </div>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          ) : null}
        </AnimatePresence>
      </Dialog.Root>
      <style>{`
        .credito-root {
          --primary: #00AE9D;
          --secondary: #003641;
          --bg: #0b1220;
          --bg-soft: #0f1b31;
          --card: rgba(255,255,255,0.06);
          --card-2: rgba(255,255,255,0.08);
          --border: rgba(255,255,255,0.14);
          --text: rgba(255,255,255,0.92);
          --muted: rgba(255,255,255,0.65);
          --shadow: 0 14px 50px rgba(0,0,0,0.35);
          min-height: 100vh;
          background:
            radial-gradient(1200px 700px at 10% 10%, rgba(0,174,157,0.22) 0%, transparent 60%),
            radial-gradient(900px 600px at 95% 15%, rgba(0,54,65,0.28) 0%, transparent 55%),
            radial-gradient(700px 500px at 70% 90%, rgba(0,174,157,0.18) 0%, transparent 55%),
            linear-gradient(180deg, var(--bg) 0%, var(--bg-soft) 100%);
          color: var(--text);
          font-family: system-ui, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
        }

        .credito-layout {
          display: grid;
          grid-template-columns: ${collapsed ? '84px' : '320px'} 1fr;
          min-height: 100vh;
          transition: grid-template-columns 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .sidebar {
          position: relative;
          display: flex;
          flex-direction: column;
          border-right: 1px solid rgba(255,255,255,0.08);
          background: linear-gradient(180deg, rgba(0,54,65,0.65) 0%, rgba(11,18,32,0.68) 100%);
          backdrop-filter: blur(18px);
          overflow-y: ${collapsed ? 'hidden' : 'auto'};
          overflow-x: hidden;
        }

        .sidebar::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(300px 260px at 25% 20%, rgba(0,174,157,0.18) 0%, transparent 65%),
            radial-gradient(260px 240px at 80% 30%, rgba(255,255,255,0.06) 0%, transparent 60%);
          pointer-events: none;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes diffPulse {
          0% { transform: scale(1); opacity: 0.9; }
          45% { transform: scale(1.06); opacity: 1; }
          100% { transform: scale(1); opacity: 0.9; }
        }

        .diff-pulse {
          display: inline-block;
          transform-origin: center;
          animation: diffPulse 1.15s ease-in-out infinite;
          text-shadow: 0 10px 26px rgba(245,197,66,0.22);
        }

        @keyframes headerIconGlow {
          0% { transform: translateY(0) scale(1); filter: brightness(1); }
          45% { transform: translateY(-1px) scale(1.04); filter: brightness(1.08); }
          100% { transform: translateY(0) scale(1); filter: brightness(1); }
        }

        .page-icon {
          transform-origin: left;
          animation: headerIconGlow 3.6s ease-in-out infinite;
        }

        .nav {
          position: relative;
          padding: ${collapsed ? '12px 10px 10px' : '18px 10px 10px'};
          display: grid;
          gap: ${collapsed ? '8px' : '10px'};
        }

        .nav-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: ${collapsed ? '10px 0 16px' : '12px 0 18px'};
          margin: ${collapsed ? '0 0 6px' : '-6px 0 6px'};
          border-bottom: 1px solid rgba(255,255,255,0.08);
          width: 100%;
        }

        .brand-logo-img {
          height: 34px;
          width: auto;
          max-width: 240px;
          object-fit: contain;
          filter: drop-shadow(0 10px 18px rgba(0,0,0,0.25));
          display: block;
          margin: 0 auto;
        }

        .brand-mark-img {
          height: 32px;
          width: auto;
          object-fit: contain;
          filter: drop-shadow(0 10px 18px rgba(0,0,0,0.25));
          display: block;
          margin: 0 auto;
          transform: none;
        }

        .nav-link {
          width: 100%;
          display: grid;
          grid-template-columns: ${collapsed ? '44px' : '44px 1fr 22px'};
          align-items: center;
          justify-items: ${collapsed ? 'center' : 'stretch'};
          gap: ${collapsed ? '0' : '10px'};
          padding: ${collapsed ? '10px' : '10px 12px'};
          border-radius: 14px;
          color: rgba(255,255,255,0.78);
          border: 1px solid transparent;
          background: transparent;
          cursor: pointer;
          text-align: ${collapsed ? 'center' : 'left'};
          transition: transform 200ms ease, background 200ms ease, border-color 200ms ease, color 200ms ease;
        }

        .nav-link .nav-text {
          display: ${collapsed ? 'none' : 'block'};
          font-size: 0.92rem;
          font-weight: 650;
          letter-spacing: 0.01em;
        }

        .nav-link .nav-chevron {
          display: ${collapsed ? 'none' : 'block'};
          opacity: 0.65;
          transition: transform 200ms ease;
        }

        .nav-link .nav-icon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: 0 10px 20px rgba(0,0,0,0.15);
        }

        .nav-link:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.92);
        }

        .nav-link.active {
          background:
            radial-gradient(200px 120px at 25% 20%, rgba(0,174,157,0.28) 0%, transparent 70%),
            linear-gradient(135deg, rgba(0,174,157,0.16) 0%, rgba(255,255,255,0.06) 50%, rgba(0,54,65,0.16) 100%);
          border-color: rgba(0,174,157,0.35);
          color: rgba(255,255,255,0.96);
        }

        .nav-sub {
          display: ${collapsed ? 'none' : 'grid'};
          gap: 8px;
          margin-left: 56px;
          margin-top: -6px;
          padding-bottom: 8px;
        }

        .nav-sub button {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.78);
          cursor: pointer;
          transition: background 200ms ease, border-color 200ms ease, transform 200ms ease, color 200ms ease;
        }

        .nav-sub button.active {
          background:
            radial-gradient(220px 140px at 25% 20%, rgba(0,174,157,0.22) 0%, transparent 70%),
            rgba(255,255,255,0.06);
          border-color: rgba(0,174,157,0.35);
          color: rgba(255,255,255,0.92);
        }

        .nav-sub button:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.14);
          color: rgba(255,255,255,0.92);
        }

        .nav-sub button strong {
          font-size: 0.9rem;
          font-weight: 650;
        }

        .nav-sub button span {
          margin-left: auto;
          font-size: 0.72rem;
          color: rgba(255,255,255,0.6);
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .main {
          position: relative;
          overflow: auto;
        }

        .main::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(255,255,255,0.05) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.05) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.05) 75%);
          background-size: 24px 24px;
          background-position: 0 0, 0 12px, 12px -12px, -12px 0;
          opacity: 0.22;
          pointer-events: none;
        }

        .main-inner {
          position: relative;
          padding: 26px 28px;
          display: grid;
          gap: 18px;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 2px 6px;
          border-radius: 20px;
          background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: var(--shadow);
          backdrop-filter: blur(18px);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        .page-icon {
          width: 36px;
          height: 36px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          line-height: 0;
          background:
            radial-gradient(18px 18px at 30% 30%, rgba(255,255,255,0.35) 0%, transparent 60%),
            linear-gradient(135deg, rgba(0,174,157,0.92) 0%, rgba(0,54,65,0.92) 100%);
          box-shadow: 0 16px 35px rgba(0,174,157,0.18);
        }

        .page-icon > svg {
          width: 20px;
          height: 20px;
          max-width: 100%;
          max-height: 100%;
          display: block;
        }

        .title-wrap {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .title-wrap h1 {
          margin: 0;
          font-size: 1.15rem;
          letter-spacing: 0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .title-wrap p {
          margin: 0;
          font-size: 0.85rem;
          color: var(--muted);
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dev-credit {
          margin: 0;
          font-size: 0.64rem;
          color: rgba(255,255,255,0.55);
          font-weight: 650;
          font-style: italic;
          letter-spacing: 0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          animation: devPulse 6s ease-in-out infinite;
        }

        @keyframes devPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.82; }
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .lock-balloon {
          position: fixed;
          transform: translate(-50%, calc(-100% - 12px));
          padding: 9px 12px;
          border-radius: 12px;
          background: rgba(245, 158, 11, 0.98);
          border: 1px solid rgba(251, 191, 36, 0.85);
          color: rgba(17, 24, 39, 0.95);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.02em;
          white-space: nowrap;
          box-shadow: 0 22px 70px rgba(0,0,0,0.55);
          pointer-events: none;
          z-index: 999999;
        }

        .lock-balloon::after {
          content: '';
          position: absolute;
          left: 50%;
          bottom: -7px;
          transform: translateX(-50%);
          border-width: 7px 7px 0 7px;
          border-style: solid;
          border-color: rgba(245, 158, 11, 0.98) transparent transparent transparent;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 11px 14px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.88);
          cursor: pointer;
          font-weight: 650;
          transition: transform 200ms ease, background 200ms ease, border-color 200ms ease;
        }

        .btn:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.16);
        }

        .btn-primary {
          border-color: rgba(0,174,157,0.38);
          background:
            radial-gradient(200px 120px at 20% 20%, rgba(255,255,255,0.16) 0%, transparent 70%),
            linear-gradient(135deg, rgba(0,174,157,0.45) 0%, rgba(0,54,65,0.35) 100%);
          box-shadow: 0 18px 50px rgba(0,174,157,0.14);
        }

        .toolbar {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        @media (min-width: 900px) {
          .toolbar { grid-template-columns: 1.3fr 0.7fr; }
        }

        @media (min-width: 900px) {
          .toolbar-home { grid-template-columns: 0.65fr 1.35fr; }
        }

        .home-context-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          align-items: end;
        }

        @media (min-width: 900px) {
          .home-context-grid { grid-template-columns: 150px 1fr 240px; }
        }

        .field label.home-toggle {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          height: 44px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
          margin-bottom: 0;
          min-width: 0;
        }

        .field label.home-toggle input {
          width: 18px;
          height: 18px;
        }

        .field label.home-toggle span {
          font-weight: 800;
          color: rgba(255,255,255,0.82);
          letter-spacing: 0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .form-grid-3 {
          grid-template-columns: 1fr;
        }

        .form-grid-4 {
          grid-template-columns: 1fr;
        }

        @media (min-width: 900px) {
          .form-grid { grid-template-columns: 1fr 1fr; }
          .form-grid-3 { grid-template-columns: 160px 1fr 260px; }
          .form-grid-4 { grid-template-columns: 160px 1fr 240px 260px; }
        }

        .field label {
          display: block;
          margin-bottom: 8px;
          font-size: 0.78rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.62);
          font-weight: 800;
        }

        .control {
          width: 100%;
          appearance: none;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 16px;
          padding: 12px 12px;
          color: rgba(255,255,255,0.92);
          outline: none;
          transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
        }

        .control::placeholder {
          color: rgba(255,255,255,0.55);
        }

        .control:focus {
          border-color: rgba(0,174,157,0.45);
          background: rgba(255,255,255,0.08);
        }

        .control.control-highlight {
          border-color: rgba(0,174,157,0.32);
          background:
            radial-gradient(220px 120px at 20% 25%, rgba(0,174,157,0.20) 0%, transparent 70%),
            rgba(0,174,157,0.10);
        }

        .control.control-highlight:focus {
          border-color: rgba(0,174,157,0.55);
          background:
            radial-gradient(220px 120px at 20% 25%, rgba(0,174,157,0.26) 0%, transparent 70%),
            rgba(0,174,157,0.14);
        }

        .month-select option,
        .access-select option {
          background: rgba(223, 246, 255, 0.96);
          color: #003641;
        }

        .month-select option:checked,
        .access-select option:checked {
          background: rgba(0, 174, 157, 0.24);
          color: #003641;
        }

        .orgao-select {
          color-scheme: dark;
        }

        .orgao-select option {
          background: rgba(15, 27, 49, 0.98);
          color: rgba(255,255,255,0.92);
        }

        .orgao-select option:checked {
          background: rgba(0, 174, 157, 0.24);
          color: rgba(255,255,255,0.92);
        }

        .import-type-select {
          color-scheme: dark;
        }

        .import-type-select option {
          background: rgba(15, 27, 49, 0.98);
          color: rgba(255,255,255,0.92);
        }

        .import-type-select option:checked {
          background: rgba(0, 174, 157, 0.24);
          color: rgba(255,255,255,0.92);
        }

        .control-wrap {
          position: relative;
          display: grid;
        }

        .control-wrap .control {
          padding-right: 44px;
        }

        .control-icon {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 32px;
          height: 32px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.82);
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: background 180ms ease, border-color 180ms ease, transform 180ms ease;
        }

        .control-icon:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.18);
          transform: translateY(-50%) scale(1.02);
        }

        input.control[type='email']:not(:placeholder-shown):invalid {
          border-color: rgba(255, 99, 132, 0.55);
        }

        .days {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        @media (min-width: 900px) {
          .days { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }

        .day {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          cursor: pointer;
          user-select: none;
        }

        .day input {
          width: 18px;
          height: 18px;
          accent-color: var(--primary);
        }

        .day span {
          font-weight: 750;
          color: rgba(255,255,255,0.88);
          letter-spacing: 0.02em;
        }

        .help {
          margin-top: 10px;
          color: rgba(255,255,255,0.62);
          font-weight: 600;
          line-height: 1.5;
        }

        .search {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(14px);
          box-shadow: 0 18px 45px rgba(0,0,0,0.18);
        }

        .home-search-card {
          min-height: 92px;
          align-items: center;
          padding: 16px 16px;
        }

        .home-context-card {
          padding: 12px 12px;
          align-items: stretch;
        }

        .search input {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: rgba(255,255,255,0.92);
          font-size: 0.95rem;
        }

        .search input::placeholder {
          color: rgba(255,255,255,0.6);
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }

        @media (min-width: 900px) {
          .grid { grid-template-columns: 1fr 1fr; }
        }

        @media (min-width: 1250px) {
          .grid { grid-template-columns: 1.2fr 0.8fr; }
        }

        .panel {
          border-radius: 22px;
          background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: var(--shadow);
          backdrop-filter: blur(18px);
          overflow: hidden;
        }

        .panel-head {
          padding: 16px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.10);
        }

        .panel-head h2 {
          margin: 0;
          font-size: 0.95rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.82);
        }

        .panel-body {
          padding: 16px 18px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        @media (min-width: 1250px) {
          .stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }

        .stats-responsive {
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        }

        .stats-home {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        @media (min-width: 900px) {
          .stats-home { grid-template-columns: repeat(8, minmax(0, 1fr)); }
        }

        .stat-icon {
          width: 28px;
          height: 28px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.88);
          flex-shrink: 0;
        }

        .stat {
          border-radius: 18px;
          padding: 14px 14px;
          border: 1px solid rgba(255,255,255,0.12);
          background:
            radial-gradient(240px 140px at 20% 20%, rgba(0,174,157,0.18) 0%, transparent 70%),
            rgba(255,255,255,0.05);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 8px;
          min-height: 96px;
        }

        .stat-good {
          border-color: rgba(0,174,157,0.28);
          box-shadow: 0 18px 50px rgba(0,174,157,0.08);
        }

        .stat-warn {
          border-color: rgba(245,197,66,0.30);
          box-shadow: 0 18px 50px rgba(245,197,66,0.06);
        }

        .stat-bad {
          border-color: rgba(255, 99, 132, 0.30);
          box-shadow: 0 18px 50px rgba(255, 99, 132, 0.06);
        }

        .stat::after {
          content: '';
          position: absolute;
          inset: -60%;
          background: conic-gradient(from 180deg, transparent, rgba(255,255,255,0.10), transparent);
          animation: spin 5.2s linear infinite;
          opacity: 0.8;
          pointer-events: none;
        }

        .stat > * { position: relative; z-index: 1; }

        .stat .kpi {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }

        .stat .label {
          font-size: 0.72rem;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.68);
          font-weight: 850;
        }

        .stat .value {
          margin-top: 2px;
          font-size: 1.18rem;
          font-weight: 900;
          letter-spacing: 0.01em;
          line-height: 1.15;
          color: rgba(255,255,255,0.92);
          font-variant-numeric: tabular-nums;
        }

        @media (min-width: 1250px) {
          .stat .value { font-size: 1.24rem; }
        }

        .stat-meter {
          height: 6px;
          border-radius: 999px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.10);
          background:
            repeating-linear-gradient(
              135deg,
              rgba(255,255,255,0.10) 0,
              rgba(255,255,255,0.10) 6px,
              rgba(255,255,255,0.02) 6px,
              rgba(255,255,255,0.02) 12px
            );
        }

        .stat-meter-fill {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, rgba(0,174,157,0.95), rgba(0,174,157,0.35));
        }

        .stat-bad .stat-meter-fill {
          background: linear-gradient(90deg, rgba(255, 99, 132, 0.95), rgba(255, 99, 132, 0.35));
        }

        .stat-warn .stat-meter-fill {
          background: linear-gradient(90deg, rgba(245,197,66,0.98), rgba(245,197,66,0.35));
        }

        .chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 999px;
          background: rgba(0,174,157,0.14);
          border: 1px solid rgba(0,174,157,0.28);
          color: rgba(255,255,255,0.9);
          font-size: 0.82rem;
          font-weight: 750;
          white-space: nowrap;
        }

        .list {
          display: grid;
          gap: 10px;
        }

        .row {
          display: grid;
          grid-template-columns: 40px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 12px 12px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          transition: transform 200ms ease, background 200ms ease, border-color 200ms ease;
        }

        .row:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.16);
        }

        .row .bubble {
          width: 40px;
          height: 40px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .row strong {
          display: block;
          font-size: 0.95rem;
          font-weight: 760;
        }

        .row small {
          display: block;
          color: rgba(255,255,255,0.62);
          margin-top: 2px;
          font-weight: 650;
        }

        .right {
          text-align: right;
          color: rgba(255,255,255,0.78);
          font-weight: 750;
          font-size: 0.85rem;
        }

        .cmd-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(6px);
          z-index: 999999;
        }

        .cmd-content {
          position: fixed;
          left: 50%;
          top: 18%;
          transform: translateX(-50%);
          width: min(720px, calc(100vw - 28px));
          border-radius: 20px;
          background: linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.06) 100%);
          border: 1px solid rgba(255,255,255,0.16);
          box-shadow: 0 30px 120px rgba(0,0,0,0.55);
          overflow: hidden;
          z-index: 1000000;
        }

        .cmd-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.10);
        }

        .cmd-title {
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-size: 0.82rem;
          color: rgba(255,255,255,0.86);
        }

        .cmd-close {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.92);
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
        }

        .cmd-search {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.10);
        }

        .cmd-input {
          flex: 1;
          background: transparent;
          border: 0;
          outline: none;
          color: rgba(255,255,255,0.92);
          font-size: 0.98rem;
        }

        .cmd-list {
          padding: 10px;
          display: grid;
          gap: 8px;
          max-height: min(50vh, 420px);
          overflow: auto;
        }

        .cmd-item {
          width: 100%;
          text-align: left;
          border-radius: 16px;
          padding: 12px 12px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.92);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          transition: transform 180ms ease, background 180ms ease, border-color 180ms ease;
        }

        .cmd-item:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.16);
        }

        .cmd-item-disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .cmd-item-main {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .cmd-item-label {
          font-weight: 850;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cmd-item-hint {
          color: rgba(255,255,255,0.60);
          font-size: 0.86rem;
          font-weight: 650;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cmd-empty {
          padding: 18px 14px;
          color: rgba(255,255,255,0.70);
          font-weight: 700;
        }

        .cmd-kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(0,0,0,0.22);
          color: rgba(255,255,255,0.86);
          font-size: 0.78rem;
          font-weight: 850;
          white-space: nowrap;
        }

        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }

        .skeleton {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.06) 0%,
            rgba(255,255,255,0.12) 25%,
            rgba(255,255,255,0.06) 50%,
            rgba(255,255,255,0.06) 100%
          );
          background-size: 220% 100%;
          animation: shimmer 1.15s ease-in-out infinite;
          border-radius: 12px;
        }

        .stat-skeleton {
          border-color: rgba(255,255,255,0.10);
        }

        .stat-skeleton .kpi {
          justify-content: space-between;
        }
      `}</style>

      <div className="credito-layout">
        <aside
          className="sidebar"
          aria-label="Navegação lateral"
          onMouseEnter={() => setCollapsed(false)}
          onMouseLeave={() => setCollapsed(true)}
        >
          <nav className="nav">
            <div className="nav-brand">
              {collapsed ? (
                <img
                  className="brand-mark-img"
                  src="/assets/Logo Menu Recolhido.png"
                  alt="Sicoob Juriscred"
                />
              ) : (
                <img
                  className="brand-logo-img"
                  src="/assets/sicoob-juriscred.png"
                  alt="Sicoob Juriscred"
                />
              )}
            </div>

            <button
              type="button"
              className={['nav-link', view === 'home' ? 'active' : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => setHash('home')}
              title={collapsed ? 'Home' : undefined}
            >
              <span className="nav-icon">
                <Home size={18} />
              </span>
              <span className="nav-text">Home</span>
              <span className="nav-chevron" />
            </button>

            <button
              type="button"
              className={[
                'nav-link',
                view.startsWith('conciliacao-') ? 'active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                setReportsOpen(false)
                setSettingsOpen(false)
                setHash('conciliacao-extratos')
              }}
              title={collapsed ? 'Conciliação' : undefined}
            >
              <span className="nav-icon">
                <BadgeDollarSign size={18} />
              </span>
              <span className="nav-text">Conciliação</span>
              <span className="nav-chevron" />
            </button>

            <button
              type="button"
              className={['nav-link', view === 'dashboard' ? 'active' : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => setHash('dashboard')}
              title={collapsed ? 'Dashboard' : undefined}
            >
              <span className="nav-icon">
                <LayoutDashboard size={18} />
              </span>
              <span className="nav-text">Dashboard</span>
              <span className="nav-chevron" />
            </button>

            <button
              type="button"
              className={[
                'nav-link',
                view.startsWith('relatorios-') ? 'active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                if (collapsed) {
                  setCollapsed(false)
                  setReportsOpen(true)
                  setSettingsOpen(false)
                  return
                }
                setReportsOpen((v) => !v)
                setSettingsOpen(false)
              }}
              title={collapsed ? 'Relatórios' : undefined}
            >
              <span className="nav-icon">
                <FileText size={18} />
              </span>
              <span className="nav-text">Relatórios</span>
              <span className="nav-chevron" style={{ transform: reportsOpen ? 'rotate(180deg)' : undefined }}>
                <ChevronDown size={16} />
              </span>
            </button>
            {reportsOpen && (
              <div className="nav-sub">
                <button
                  type="button"
                  className={view === 'relatorios-valores' ? 'active' : undefined}
                  onClick={() => {
                    setReportsOpen(true)
                    setSettingsOpen(false)
                    setHash('relatorios-valores')
                  }}
                >
                  <Sparkles size={18} />
                  <strong>Conciliação</strong>
                  <span>novo</span>
                </button>
                <button
                  type="button"
                  className={view === 'relatorios-auditoria' ? 'active' : undefined}
                  onClick={() => {
                    setReportsOpen(true)
                    setSettingsOpen(false)
                    setHash('relatorios-auditoria')
                  }}
                >
                  <ShieldCheck size={18} />
                  <strong>Auditoria</strong>
                  <span>beta</span>
                </button>
              </div>
            )}

            <button
              type="button"
              className={[
                'nav-link',
                view.startsWith('configuracoes-') ? 'active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                if (collapsed) {
                  setCollapsed(false)
                  setSettingsOpen(true)
                  setReportsOpen(false)
                  return
                }
                setSettingsOpen((v) => !v)
                setReportsOpen(false)
              }}
              title={collapsed ? 'Configurações' : undefined}
            >
              <span className="nav-icon">
                <ShieldCheck size={18} />
              </span>
              <span className="nav-text">Configurações</span>
              <span className="nav-chevron" style={{ transform: settingsOpen ? 'rotate(180deg)' : undefined }}>
                <ChevronDown size={16} />
              </span>
            </button>
            {settingsOpen && (
              <div className="nav-sub">
                <button
                  type="button"
                  className={
                    view === 'configuracoes-automacao' ? 'active' : undefined
                  }
                  onClick={() => {
                    setSettingsOpen(true)
                    setReportsOpen(false)
                    setHash('configuracoes-automacao')
                  }}
                >
                  <Zap size={18} />
                  <strong>Automação</strong>
                  <span>soon</span>
                </button>
                <button
                  type="button"
                  className={
                    view === 'configuracoes-acessos' ? 'active' : undefined
                  }
                  onClick={() => {
                    setSettingsOpen(true)
                    setReportsOpen(false)
                    setHash('configuracoes-acessos')
                  }}
                >
                  <ShieldCheck size={18} />
                  <strong>Acessos</strong>
                  <span>iam</span>
                </button>
              </div>
            )}
          </nav>
        </aside>

        <main className="main">
          <div className="main-inner">
            <header className="header">
              <div className="header-left">
                <div className="page-icon">
                  <BadgeDollarSign size={20} />
                </div>
                <div className="title-wrap">
                  <h1>{title}</h1>
                  <p>{subtitle}</p>
                  <div className="dev-credit">
                    Desenvolvido por: Departamento de Tecnologia da Informação - Juriscred
                  </div>
                </div>
              </div>
              <div className="header-actions">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.10)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {userPhotoUrl ? (
                      <img
                        src={userPhotoUrl}
                        alt="Foto"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontWeight: 900, fontSize: 12, opacity: 0.85 }}>
                        {(headerUserLabel.split('|')[0] || 'U')
                          .trim()
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.02em' }}>
                    {headerUserLabel}
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
                    <button
                      type="button"
                      onClick={() => (window.location.href = '/')}
                      aria-label="Home"
                      title="Home"
                      style={{
                        width: 26,
                        height: 26,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 10,
                        border: 0,
                        background: 'transparent',
                        color: 'inherit',
                        cursor: 'pointer',
                        opacity: 0.9,
                        padding: 0,
                        margin: 0,
                        lineHeight: 0,
                      }}
                    >
                      <Home size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const msal = (window as any).__msalInstance as
                          | { logoutRedirect: (opts?: any) => Promise<void> }
                          | undefined
                        try {
                          sessionStorage.removeItem('auth_redirect_url')
                          if (msal?.logoutRedirect) {
                            await msal.logoutRedirect({ postLogoutRedirectUri: window.location.origin })
                            return
                          }
                        } catch {
                          void 0
                        }
                        window.location.href = '/'
                      }}
                      aria-label="Sair"
                      title="Sair"
                      style={{
                        width: 26,
                        height: 26,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 10,
                        border: 0,
                        background: 'transparent',
                        color: 'inherit',
                        cursor: 'pointer',
                        opacity: 0.9,
                        padding: 0,
                        margin: 0,
                        lineHeight: 0,
                      }}
                    >
                      <LogOut size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </header>

            {isMain ? (
              <>
                <section className={view === 'home' ? 'toolbar toolbar-home' : 'toolbar'}>
                  <div className={view === 'home' ? 'search home-search-card' : 'search'}>
                    <Search size={18} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por contrato, CPF, cooperado, produto..."
                    />
                  </div>

                  {view === 'home' ? (
                    <div className="search home-context-card">
                      <div style={{ width: '100%', display: 'grid', gap: 12 }}>
                        <div className="home-context-grid">
                          <div className="field">
                            <label>Competência</label>
                            <select
                              className="control month-select"
                              value={conciliacaoMonth}
                              onChange={(e) => setConciliacaoMonth(e.target.value)}
                              disabled={conciliacaoMonthsLoading || conciliacaoMonthOptions.length === 0}
                              style={{ height: 44 }}
                            >
                              {conciliacaoMonthOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label>Órgão</label>
                            <select
                              className="control month-select"
                              value={conciliacaoOrgao}
                              onChange={(e) => setConciliacaoOrgao(e.target.value)}
                              disabled={orgaoDeParaLoading}
                              style={{ height: 44 }}
                            >
                              <option value="">Selecione...</option>
                              {conciliacaoOrgaoOptions.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label>Exibir</label>
                            <label className="home-toggle">
                              <input
                                type="checkbox"
                                checked={conciliacaoOnlyDiff}
                                onChange={(e) => setConciliacaoOnlyDiff(e.target.checked)}
                              />
                              <span>Somente divergências</span>
                            </label>
                          </div>
                        </div>

                        {conciliacaoError ? (
                          <div className="help" style={{ marginTop: -2, color: 'rgba(255, 99, 132, 0.95)' }}>
                            {conciliacaoError}
                          </div>
                        ) : null}

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => setHash('conciliacao-extratos')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
                          >
                            <BadgeDollarSign size={18} />
                            Abrir conciliação
                          </button>
                          <button
                            type="button"
                            className="btn"
                            disabled={
                              !canExportConciliacaoXlsx ||
                              conciliacaoExportingXlsx ||
                              !conciliacaoOrgao.trim() ||
                              !conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)
                            }
                            onClick={() => void exportConciliacaoXlsx()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
                          >
                            <FileSpreadsheet size={18} />
                            {conciliacaoExportingXlsx ? 'Exportando...' : 'Exportar XLSX'}
                          </button>
                          {conciliacaoData ? (
                            <span
                              className="chip"
                              style={{ alignSelf: 'center', marginLeft: 'auto' }}
                              title={
                                conciliacaoLoadedAtIso ? `Última atualização: ${formatIsoToPtBrDateTime(conciliacaoLoadedAtIso)}` : ''
                              }
                            >
                              <Clock size={16} />
                              Última atualização:{' '}
                              {conciliacaoLoadedAtIso ? formatIsoToPtBrDateTime(conciliacaoLoadedAtIso).slice(0, 10) : '—'}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>

                {view === 'home' ? (
                  <section className="grid">
                    <div className="panel" style={{ gridColumn: '1 / -1' }}>
                      <div className="panel-head">
                        <h2>Indicadores</h2>
                        <span className="chip">
                          <Sparkles size={16} />
                          Conciliação
                        </span>
                      </div>
                      <div className="panel-body">
                        {conciliacaoLoading && !conciliacaoData ? (
                          <div className="stats-home" style={{ marginTop: 2 }}>
                            {Array.from({ length: 8 }).map((_, i) => (
                              <div className="stat stat-skeleton" key={i}>
                                <div className="kpi">
                                  <div className="skeleton" style={{ height: 10, width: '56%' }} />
                                  <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 12 }} />
                                </div>
                                <div className="skeleton" style={{ height: 18, width: '80%', marginTop: 10 }} />
                                <div className="skeleton" style={{ height: 6, width: '100%', marginTop: 12, borderRadius: 999 }} />
                              </div>
                            ))}
                          </div>
                        ) : conciliacaoData ? (
                          <div className="stats-home" style={{ marginTop: 2 }}>
                            {(() => {
                              const totals = conciliacaoData.totals
                              const recursoCents = Number(totals?.recurso?.cents ?? 0) || 0
                              const extratosCents = Number(totals?.extratos?.cents ?? 0) || 0
                              const tarifasCents =
                                (Number(totals?.tarifaLinha?.cents ?? 0) || 0) +
                                (Number(totals?.tarifaTed?.cents ?? 0) || 0)
                              const diffCents = extratosCents - recursoCents

                              const recursoPend = Array.isArray(conciliacaoData?.recurso)
                                ? conciliacaoData.recurso.filter((x: any) => x?.status === 'pendencia').length
                                : 0
                              const relatorioPend = Array.isArray(conciliacaoData?.relatorio)
                                ? conciliacaoData.relatorio.filter((x: any) => x?.status === 'pendencia').length
                                : 0
                              const pendTotal = recursoPend + relatorioPend
                              const recursoOk = Array.isArray(conciliacaoData?.recurso)
                                ? conciliacaoData.recurso.filter((x: any) => x?.status === 'conciliado').length
                                : 0
                              const relatorioOk = Array.isArray(conciliacaoData?.relatorio)
                                ? conciliacaoData.relatorio.filter((x: any) => x?.status === 'conciliado').length
                                : 0
                              const okTotal = recursoOk + relatorioOk
                              const totalRegs = okTotal + pendTotal
                              const pctOk = totalRegs > 0 ? Math.round((okTotal / totalRegs) * 100) : 0

                              const fmt = (cents: number) => `R$ ${centsToPtBr(Math.abs(cents))}`
                              const fmtSigned = (cents: number) => (cents < 0 ? `- ${fmt(cents)}` : fmt(cents))

                              const statusLabel = conciliacaoData.closed?.isClosed ? 'Fechada' : 'Aberta'
                              const statusTone = conciliacaoData.closed?.isClosed ? 'warn' : 'good'
                              const pctTone = pctOk >= 90 ? 'good' : pctOk >= 60 ? 'warn' : 'bad'
                              const diffTone = diffCents === 0 ? 'good' : diffCents < 0 ? 'bad' : 'warn'
                              const pendTone = pendTotal === 0 ? 'good' : 'warn'

                              const items = [
                                {
                                  label: 'Status',
                                  value: statusLabel,
                                  icon: conciliacaoData.closed?.isClosed ? <Lock size={18} /> : <Unlock size={18} />,
                                  tone: statusTone,
                                  meterPct: 100,
                                },
                                { label: 'Conciliação pronta', value: `${pctOk}%`, icon: <Sparkles size={18} />, tone: pctTone, meterPct: pctOk },
                                { label: 'Conciliados', value: String(okTotal), icon: <ShieldCheck size={18} />, tone: pctTone, meterPct: pctOk },
                                { label: 'Recurso (débito)', value: fmt(recursoCents), icon: <BadgeDollarSign size={18} />, tone: 'good', meterPct: 100 },
                                { label: 'Extrato (crédito)', value: fmt(extratosCents), icon: <FileText size={18} />, tone: 'good', meterPct: 100 },
                                { label: 'Diferença', value: fmtSigned(diffCents), icon: diffCents < 0 ? <TrendingDown size={18} /> : <TrendingUp size={18} />, tone: diffTone, meterPct: 100 },
                                { label: 'Tarifas', value: fmt(tarifasCents), icon: <Zap size={18} />, tone: 'warn', meterPct: 100 },
                                { label: 'Pendências', value: String(pendTotal), icon: <ShieldCheck size={18} />, tone: pendTone, meterPct: 100 },
                              ]

                              return items.map((it, idx) => (
                                <motion.div
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.18, ease: 'easeOut', delay: idx * 0.02 }}
                                  whileHover={{ y: -2, scale: 1.01 }}
                                  className={['stat', (it as any).tone ? `stat-${(it as any).tone}` : '']
                                    .filter(Boolean)
                                    .join(' ')}
                                  key={it.label}
                                >
                                  <div className="kpi">
                                    <div className="label">{it.label}</div>
                                    <div className="stat-icon">{(it as any).icon}</div>
                                  </div>
                                  <div className="value">{it.value}</div>
                                  <div className="stat-meter" style={{ marginTop: 10 }}>
                                    <div
                                      className="stat-meter-fill"
                                      style={{
                                        width: `${Math.max(0, Math.min(100, Number((it as any).meterPct ?? 100)))}%`,
                                      }}
                                    />
                                  </div>
                                </motion.div>
                              ))
                            })()}
                          </div>
                        ) : (
                          <div className="help">
                            Selecione uma competência e um órgão para ver os indicadores.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="panel" style={{ gridColumn: '1 / -1' }}>
                      <div className="panel-head">
                        <h2>Pendências prioritárias</h2>
                        <span className="chip">
                          <Zap size={16} />
                          Foco
                        </span>
                      </div>
                      <div className="panel-body">
                        {conciliacaoData ? (
                          <div className="list">
                            {(() => {
                              const recurso = Array.isArray(conciliacaoData?.recurso) ? conciliacaoData.recurso : []
                              const relatorio = Array.isArray(conciliacaoData?.relatorio) ? conciliacaoData.relatorio : []
                              const searchText = normalizeSearchText(search)
                              const searchDigits = normalizeSearchDigits(search)
                              const pend = [
                                ...recurso
                                  .filter((x: any) => x?.status === 'pendencia')
                                  .map((x: any) => ({ ...x, __src: 'Recurso' as const })),
                                ...relatorio
                                  .filter((x: any) => x?.status === 'pendencia')
                                  .map((x: any) => ({ ...x, __src: 'Relatório Sisbr' as const })),
                              ]
                              const filtered = searchText || searchDigits
                                ? pend.filter((p: any) => {
                                    const cpfDigits = normalizeSearchDigits(p?.cpf)
                                    const nome = normalizeSearchText(p?.nome)
                                    if (searchDigits && cpfDigits.includes(searchDigits)) return true
                                    if (searchText && nome.includes(searchText)) return true
                                    return false
                                  })
                                : pend
                              const ordered = filtered.slice().sort((a: any, b: any) => {
                                const av = Math.abs(ptBrMoneyToCents(String(a?.value ?? '0')))
                                const bv = Math.abs(ptBrMoneyToCents(String(b?.value ?? '0')))
                                return bv - av
                              })
                              const top = ordered.slice(0, 8)
                              if (top.length === 0) {
                                return (
                                  <div className="row" style={{ gridTemplateColumns: '72px 1fr', padding: 18 }}>
                                    <div className="bubble" style={{ width: 72, height: 72, borderRadius: 20, position: 'relative', overflow: 'hidden' }}>
                                      <motion.div
                                        aria-hidden="true"
                                        style={{
                                          position: 'absolute',
                                          inset: -18,
                                          background:
                                            'radial-gradient(circle at 50% 50%, rgba(0,174,157,0.30) 0%, rgba(0,174,157,0.00) 60%)',
                                        }}
                                        initial={{ opacity: 0.35, scale: 0.92 }}
                                        animate={{ opacity: [0.25, 0.5, 0.25], scale: [0.92, 1.06, 0.92] }}
                                        transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
                                      />
                                      <div style={{ position: 'relative' }}>
                                        <Megaphone size={28} />
                                      </div>
                                    </div>
                                    <div style={{ display: 'grid', gap: 6, alignContent: 'center' }}>
                                      <strong style={{ fontSize: '1.05rem' }}>Tudo em ordem por aqui!</strong>
                                      <small style={{ fontSize: '0.9rem' }}>Nenhuma pendência para o filtro atual.</small>
                                    </div>
                                  </div>
                                )
                              }
                              return top.map((p: any, idx: number) => (
                                <div
                                  key={`${p.__src}-${p.cpf}-${p.value}-${idx}`}
                                  className="row"
                                  onClick={() => setHash('conciliacao-extratos')}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <div className="bubble">
                                    <ShieldCheck size={18} />
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {String(p.nome ?? '').trim() || '-'}
                                    </strong>
                                    <small>
                                      {p.__src} • CPF {String(p.cpf ?? '').trim() || '-'}
                                    </small>
                                  </div>
                                  <div className="right">{withCurrency(String(p.value ?? '0,00'))}</div>
                                </div>
                              ))
                            })()}
                          </div>
                        ) : (
                          <div className="help">
                            Carregue uma conciliação para visualizar pendências.
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}

            {view === 'configuracoes-automacao' ? (
              <>
                <section className="panel">
                  <div className="panel-head">
                    <h2>SharePoint</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={async () => {
                          if (settingsLocked) return
                          const target = manualImportTarget
                          const folderUrl = (() => {
                            if (target === 'recurso_alego') return recursoAlegoUrl.trim()
                            if (target === 'recurso_mpgo') return recursoMpgoUrl.trim()
                            return sharePointFolderPath.trim()
                          })()
                          if (!folderUrl) {
                            setImportNowMessage({
                              kind: 'error',
                              text:
                                target === 'recurso_alego'
                                  ? 'Informe a pasta/arquivo do SharePoint (ALEGO) antes de importar.'
                                  : target === 'recurso_mpgo'
                                    ? 'Informe a pasta/arquivo do SharePoint (MPGO) antes de importar.'
                                  : 'Informe o diretório raiz do SharePoint antes de importar.',
                            })
                            return
                          }
                          if (/^https:\/\/teams\.microsoft\.com\/meet\//i.test(folderUrl)) {
                            setImportNowMessage({
                              kind: 'error',
                              text:
                                'Esse link é de reunião do Teams e não é um arquivo. Cole a URL do SharePoint (pasta ou arquivo).',
                            })
                            return
                          }
                          await saveAutomationConfigToServer({
                            sharePointFolderUrl:
                              target !== 'recurso_alego' && target !== 'recurso_mpgo'
                                ? folderUrl
                                : sharePointFolderPath.trim() || null,
                            recursoAlegoUrl:
                              target === 'recurso_alego'
                                ? folderUrl
                                : recursoAlegoUrl.trim() || null,
                            recursoMpgoUrl:
                              target === 'recurso_mpgo'
                                ? folderUrl
                                : recursoMpgoUrl.trim() || null,
                            notificationEmail: notificationEmail.trim() || null,
                            notificationEmailContabilidade:
                              notificationEmailContabilidade.trim() || null,
                          })
                          setImportNowMessage(null)
                          setImportingNow(true)
                          try {
                            const res = await fetch('/api/consignado/import', {
                              method: 'POST',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({
                                ...(target === 'recurso_alego' || target === 'recurso_mpgo'
                                  ? { learningUrl: folderUrl, target }
                                  : {
                                      folderUrl,
                                      notificationTo:
                                        notificationEmail.trim() || undefined,
                                      modalidades,
                                      mode: 'append',
                                      target,
                                    }),
                              }),
                            })

                            const data = (await res.json().catch(() => null)) as null | {
                              profileId?: string
                              tableName?: string
                              rows?: number
                              columns?: number
                              importedExtratosCount?: number
                              movedExtratosCount?: number
                              importedRelatoriosCount?: number
                              movedRelatoriosCount?: number
                              insertedExtratosRows?: number
                              skippedExtratosRows?: number
                              insertedRelatoriosRows?: number
                              skippedRelatoriosRows?: number
                              extratosSelected?: Array<{ name?: string }>
                              relatoriosSelected?: Array<{ name?: string }>
                              relatoriosFoundOutsideImportados?: Array<{ name?: string }>
                              relatoriosFoundIncludingImportados?: Array<{ name?: string }>
                              extratosFiles?: Array<{
                                name?: string
                                rowsTotal?: number
                                insertedRows?: number
                                skippedRows?: number
                              }>
                              relatoriosFiles?: Array<{
                                name?: string
                                rowsTotal?: number
                                insertedRows?: number
                                skippedRows?: number
                                ignoredReason?: string
                                error?: string
                              }>
                              totalsInDb?: { extratos?: number; relatorio?: number }
                              message?: string
                              dbFilePath?: string
                              mode?: string
                            }

                            if (!res.ok) {
                              const fallback = `Falha na importação (HTTP ${res.status}).`
                              const text = data?.message ? data.message : fallback
                              throw new Error(text)
                            }

                            if (target === 'recurso_alego' || target === 'recurso_mpgo') {
                              const moved =
                                typeof (data as any)?.movedToImportados === 'boolean'
                                  ? ((data as any).movedToImportados as boolean)
                                  : false
                              const skippedNoCpf =
                                typeof (data as any)?.skippedNoCpf === 'number'
                                  ? Number((data as any).skippedNoCpf)
                                  : 0
                              const skippedDup =
                                typeof (data as any)?.skippedDuplicates === 'number'
                                  ? Number((data as any).skippedDuplicates)
                                  : 0
                              const moveError =
                                typeof (data as any)?.moveError === 'string'
                                  ? String((data as any).moveError).trim()
                                  : ''
                              const label = target === 'recurso_alego' ? 'ALEGO' : 'MPGO'
                              setImportNowMessage({
                                kind: 'success',
                                text: `Importação ${label} concluída. Tabela: ${String(
                                  data?.tableName ??
                                    (target === 'recurso_alego' ? 'Recurso ALEGO' : 'Recurso MPGO'),
                                )}. Linhas: ${Number(data?.rows ?? 0)}. Colunas: ${Number(
                                  data?.columns ?? 0,
                                )}. Ignoradas sem CPF: ${skippedNoCpf}. Duplicadas: ${skippedDup}. ${
                                  moved
                                    ? 'Movido para Importados: sim.'
                                    : `Movido para Importados: não.${
                                        moveError ? ` Motivo: ${moveError}` : ''
                                      }`
                                } SQLite: ${String(data?.dbFilePath ?? '-')}`,
                              })
                              return
                            }

                            const relatoriosFiles = Array.isArray(data?.relatoriosFiles)
                              ? data!.relatoriosFiles!
                              : []
                            const relatoriosImportados = relatoriosFiles.filter((f) => {
                              const ins = Number(f.insertedRows ?? 0)
                              const dup = Number(f.skippedRows ?? 0)
                              return ins > 0 || dup > 0
                            })
                            const relatoriosIgnorados = relatoriosFiles.filter((f) => {
                              const ins = Number(f.insertedRows ?? 0)
                              const dup = Number(f.skippedRows ?? 0)
                              if (ins > 0 || dup > 0) return false
                              const reason = String(f.ignoredReason ?? '').trim()
                              const err = String(f.error ?? '').trim()
                              return Boolean(reason || err)
                            })
                            const relatoriosImportadosText =
                              relatoriosImportados.length > 0
                                ? relatoriosImportados
                                    .map(
                                      (f) =>
                                        `${String(f.name ?? '-')} (${Number(f.insertedRows ?? 0)} ins, ${Number(f.skippedRows ?? 0)} dup)`,
                                    )
                                    .join(' | ')
                                : '-'
                            const relatoriosIgnoradosText =
                              relatoriosIgnorados.length > 0
                                ? relatoriosIgnorados
                                    .map((f) => {
                                      const base = String(f.name ?? '-')
                                      const reason = String(f.ignoredReason ?? '').trim()
                                      const err = String(f.error ?? '').trim()
                                      const detail = reason || err ? ` (${reason || err})` : ''
                                      return `${base}${detail}`
                                    })
                                    .join(' | ')
                                : '-'

                            setImportNowMessage({
                              kind: 'success',
                              text: `Importação concluída (${data?.mode ?? 'append'}). Extratos: ${data?.importedExtratosCount ?? 0} arquivo(s), ${data?.insertedExtratosRows ?? 0} linha(s) inserida(s) (${data?.skippedExtratosRows ?? 0} duplicada(s)). Relatórios: ${data?.importedRelatoriosCount ?? 0} arquivo(s), ${data?.insertedRelatoriosRows ?? 0} linha(s) inserida(s) (${data?.skippedRelatoriosRows ?? 0} duplicada(s)). Arquivos do Relatório importados: ${relatoriosImportadosText}. Arquivos do Relatório ignorados: ${relatoriosIgnoradosText}. Total no BD: Extratos=${data?.totalsInDb?.extratos ?? '-'} | Relatório=${data?.totalsInDb?.relatorio ?? '-'}. ${data?.message ? `Aviso: ${data.message} ` : ''}SQLite: ${data?.dbFilePath ?? '-'}`,
                            })
                          } catch (e) {
                            const message =
                              e instanceof Error ? e.message : 'Erro ao importar.'
                            setImportNowMessage({ kind: 'error', text: message })
                          } finally {
                            setImportingNow(false)
                          }
                        }}
                        disabled={settingsLocked || importingNow}
                      >
                        <Zap size={18} />
                        {importingNow ? 'Importando...' : 'Importar manual'}
                      </button>
                      <span className="chip">
                        <FileText size={16} />
                        Importação
                      </span>
                    </div>
                  </div>
                  <div className="panel-body">
                    <div className="form-grid">
                      <div className="field">
                        <label>Tipo de importação</label>
                        <select
                          className="control import-type-select"
                          value={manualImportTarget}
                          onChange={(e) =>
                            setManualImportTarget(
                              e.target.value === 'recurso_alego'
                                ? 'recurso_alego'
                                : e.target.value === 'recurso_mpgo'
                                  ? 'recurso_mpgo'
                                : e.target.value === 'relatorio'
                                  ? 'relatorio'
                                  : e.target.value === 'extratos'
                                    ? 'extratos'
                                    : 'relatorio',
                            )
                          }
                          disabled={settingsLocked}
                        >
                          <option value="relatorio">Relatório SISBR</option>
                          <option value="extratos">Extrato Recurso</option>
                          <option value="recurso_alego">Recurso ALEGO</option>
                          <option value="recurso_mpgo">Recurso MPGO</option>
                        </select>
                      </div>
                      {manualImportTarget !== 'recurso_alego' && manualImportTarget !== 'recurso_mpgo' ? (
                        <div className="field">
                          <label>Diretório raiz (SharePoint)</label>
                          <input
                            className="control"
                            value={sharePointFolderPath}
                            onChange={(e) => setSharePointFolderPath(e.target.value)}
                            placeholder="Ex.: https://.../9.Recuperação%20de%20Crédito"
                            disabled={settingsLocked}
                          />
                        </div>
                      ) : null}
                      {manualImportTarget === 'recurso_alego' ? (
                        <div className="field">
                          <label>Pasta/Arquivo do SharePoint (ALEGO)</label>
                          <input
                            className="control"
                            value={recursoAlegoUrl}
                            onChange={(e) => setRecursoAlegoUrl(e.target.value)}
                            placeholder="Ex.: https://.../Relatório%20Orgão/ (ou .../ALEGO%20-%20042026.xlsx)"
                            disabled={settingsLocked}
                          />
                        </div>
                      ) : null}
                      {manualImportTarget === 'recurso_mpgo' ? (
                        <div className="field">
                          <label>Pasta/Arquivo do SharePoint (MPGO)</label>
                          <input
                            className="control"
                            value={recursoMpgoUrl}
                            onChange={(e) => setRecursoMpgoUrl(e.target.value)}
                            placeholder="Ex.: https://.../Relatório%20Orgao/GOIAS%20MPGO"
                            disabled={settingsLocked}
                          />
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          if (settingsLocked) return
                          void saveAutomationConfigToServer({
                            sharePointFolderUrl: sharePointFolderPath.trim() || null,
                            recursoAlegoUrl: recursoAlegoUrl.trim() || null,
                            recursoMpgoUrl: recursoMpgoUrl.trim() || null,
                            notificationEmail: notificationEmail.trim() || null,
                            notificationEmailContabilidade:
                              notificationEmailContabilidade.trim() || null,
                          })
                        }}
                        disabled={settingsLocked || sharePointFolderPathSaving || sharePointFolderPathLoading}
                      >
                        <Zap size={18} />
                        {sharePointFolderPathSaving ? 'Salvando...' : 'Salvar pasta'}
                      </button>
                      {sharePointFolderPathLoading ? (
                        <div className="help" style={{ margin: 0 }}>
                          Carregando configuração...
                        </div>
                      ) : null}
                      {sharePointFolderPathSavedMsg ? (
                        <div className="help" style={{ margin: 0, color: 'rgba(0,174,157,0.95)' }}>
                          {sharePointFolderPathSavedMsg}
                        </div>
                      ) : null}
                      {sharePointFolderPathError ? (
                        <div className="help" style={{ margin: 0, color: 'rgba(255, 99, 132, 0.95)' }}>
                          {sharePointFolderPathError}
                        </div>
                      ) : null}
                    </div>
                    <div className="help">
                      As planilhas nesses caminhos serão importadas para o banco de
                      dados para conciliação de consignados.
                    </div>
                    {importNowMessage ? (
                      <div
                        className="help"
                        style={{
                          marginTop: 10,
                          color:
                            importNowMessage.kind === 'success'
                              ? 'rgba(0,174,157,0.95)'
                              : 'rgba(255, 99, 132, 0.95)',
                        }}
                      >
                        {importNowMessage.text}
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <h2>Modalidade aceita</h2>
                    <span className="chip">
                      <ShieldCheck size={16} />
                      Consignado
                    </span>
                  </div>
                  <div className="panel-body">
                    <div className="form-grid">
                      <div className="field">
                        <label>Adicionar modalidade</label>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            gap: 10,
                            alignItems: 'center',
                          }}
                        >
                          <input
                            className="control"
                            value={modalidadeDraft}
                            onChange={(e) => setModalidadeDraft(e.target.value)}
                            placeholder="Ex.: CCCP"
                            disabled={settingsLocked || modalidadesSaving}
                          />
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                              if (settingsLocked) return
                              const next = modalidadeDraft.trim().toUpperCase()
                              if (!next) return
                              setModalidades((prev) => {
                                const updated = prev.includes(next) ? prev : [...prev, next]
                                void saveModalidadesToServer(updated)
                                return updated
                              })
                              setModalidadeDraft('')
                            }}
                            disabled={settingsLocked || modalidadesSaving}
                          >
                            <Zap size={18} />
                            {modalidadesSaving ? 'Salvando...' : 'Adicionar'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                      {modalidades.map((m) => (
                        <button
                          key={m}
                          type="button"
                          className="chip"
                          onClick={() => {
                            if (settingsLocked) return
                            setModalidades((prev) => {
                              const updated = prev.filter((x) => x !== m)
                              void saveModalidadesToServer(updated)
                              return updated
                            })
                          }}
                          disabled={settingsLocked || modalidadesSaving}
                          title="Remover"
                          style={{
                            cursor: 'pointer',
                            borderColor: 'rgba(0,174,157,0.22)',
                          }}
                        >
                          <ShieldCheck size={16} />
                          {m}
                        </button>
                      ))}
                    </div>
                    <div className="help">
                      Clique em uma modalidade para remover. Essas modalidades
                      serão usadas para validações de conciliação.
                    </div>
                    {modalidadesError ? (
                      <div className="help" style={{ marginTop: 10, color: 'rgba(255, 99, 132, 0.95)' }}>
                        {modalidadesError}
                      </div>
                    ) : null}
                    {modalidadesSavedMsg ? (
                      <div className="help" style={{ marginTop: 10, color: 'rgba(0, 174, 157, 0.95)' }}>
                        {modalidadesSavedMsg}
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <h2>De/Para de Orgão</h2>
                    <span className="chip">
                      <FileText size={16} />
                      Associação
                    </span>
                  </div>
                  <div className="panel-body">
                    {orgaoValuesLoading ? (
                      <div className="help">Carregando órgãos...</div>
                    ) : null}
                    {orgaoValuesError ? (
                      <div className="help" style={{ color: 'rgba(255, 99, 132, 0.95)' }}>
                        {orgaoValuesError}
                      </div>
                    ) : null}
                    <div className="form-grid">
                      <div className="field">
                        <label>Extratos</label>
                        <select
                          className="control orgao-select"
                          value={orgaoDeParaDraft.extratos}
                          onChange={(e) => {
                            const nextExtrato = e.target.value
                            const relList = orgaoValues.relatorio
                            const norm = (s: string) =>
                              s
                                .trim()
                                .replace(/\s+/g, ' ')
                                .toUpperCase()
                            const stripCode = (s: string) =>
                              s.replace(/^\d+\s*-\s*/g, '').trim()
                            const wanted = norm(nextExtrato)
                            const suggested =
                              relList.find((r) => norm(stripCode(r)).includes(wanted)) ??
                              relList.find((r) => wanted && norm(stripCode(r)) === wanted) ??
                              ''
                            setOrgaoDeParaDraft((prev) => ({
                              ...prev,
                              extratos: nextExtrato,
                              relatorio: prev.relatorio || suggested,
                            }))
                          }}
                          disabled={settingsLocked || orgaoDeParaLoading || orgaoValuesLoading}
                        >
                          <option value="">(Selecione)</option>
                          {(() => {
                            const used = new Set(orgaoDePara.map((x) => x.extratos))
                            return orgaoValues.extratos
                              .filter((v) => !used.has(v))
                              .slice()
                              .sort(orgaoSort)
                              .map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))
                          })()}
                        </select>
                      </div>
                      <div className="field">
                        <label>Relatório</label>
                        <select
                          className="control orgao-select"
                          value={orgaoDeParaDraft.relatorio}
                          onChange={(e) =>
                            setOrgaoDeParaDraft((prev) => ({
                              ...prev,
                              relatorio: e.target.value,
                            }))
                          }
                          disabled={settingsLocked || orgaoDeParaLoading || orgaoValuesLoading}
                        >
                          <option value="">(Selecione)</option>
                          {(() => {
                            const used = new Set(orgaoDePara.map((x) => x.relatorio))
                            return orgaoValues.relatorio
                              .filter((v) => !used.has(v))
                              .slice()
                              .sort(orgaoSort)
                              .map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))
                          })()}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={async () => {
                          if (settingsLocked) return
                          const extratos = orgaoDeParaDraft.extratos.trim()
                          const relatorio = orgaoDeParaDraft.relatorio.trim()
                          if (!extratos || !relatorio) return
                          setOrgaoDeParaSavedMsg(null)
                          setOrgaoDeParaError(null)
                          setOrgaoDeParaLoading(true)
                          try {
                            const res = await fetch('/api/consignado/orgao-depara', {
                              method: 'POST',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({ extratos, relatorio }),
                            })
                            const data = (await res.json().catch(() => null)) as null | {
                              items?: Array<{ extratos?: string; relatorio?: string }>
                              message?: string
                            }
                            if (!res.ok) {
                              throw new Error(
                                data?.message || `Falha ao salvar de/para (HTTP ${res.status}).`,
                              )
                            }
                            const items = Array.isArray(data?.items)
                              ? data!.items!
                                  .map((i) => ({
                                    extratos: typeof i.extratos === 'string' ? i.extratos : '',
                                    relatorio: typeof i.relatorio === 'string' ? i.relatorio : '',
                                  }))
                                  .filter((i) => Boolean(i.extratos) && Boolean(i.relatorio))
                              : []
                            setOrgaoDePara(items)
                            setOrgaoDeParaDraft({ extratos: '', relatorio: '' })
                            setOrgaoDeParaSavedMsg('De/para salvo.')
                          } catch (e) {
                            const msg =
                              e instanceof Error ? e.message : 'Falha ao salvar de/para.'
                            setOrgaoDeParaError(msg)
                          } finally {
                            setOrgaoDeParaLoading(false)
                          }
                        }}
                        disabled={settingsLocked || orgaoDeParaLoading}
                      >
                        <Zap size={18} />
                        {orgaoDeParaLoading ? 'Salvando...' : 'Salvar de/para'}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          if (settingsLocked) return
                          setOrgaoDeParaDraft({ extratos: '', relatorio: '' })
                        }}
                        disabled={settingsLocked || orgaoDeParaLoading}
                      >
                        Limpar
                      </button>
                    </div>

                    {orgaoDeParaError ? (
                      <div className="help" style={{ marginTop: 10, color: 'rgba(255, 99, 132, 0.95)' }}>
                        {orgaoDeParaError}
                      </div>
                    ) : null}
                    {orgaoDeParaSavedMsg ? (
                      <div className="help" style={{ marginTop: 10, color: 'rgba(0, 174, 157, 0.95)' }}>
                        {orgaoDeParaSavedMsg}
                      </div>
                    ) : null}

                    <div style={{ marginTop: 14, overflow: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {['Extratos', 'Relatório', 'Ações'].map((h) => (
                              <th
                                key={h}
                                style={{
                                  textAlign: 'left',
                                  padding: '8px 10px',
                                  fontSize: '0.72rem',
                                  letterSpacing: '0.08em',
                                  textTransform: 'uppercase',
                                  color: 'rgba(255,255,255,0.62)',
                                  borderBottom: '1px solid rgba(255,255,255,0.12)',
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {orgaoDePara.map((m) => (
                            <tr key={m.extratos}>
                              <td
                                style={{
                                  padding: '8px 10px',
                                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                                }}
                              >
                                {m.extratos}
                              </td>
                              <td
                                style={{
                                  padding: '8px 10px',
                                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                                  color: 'rgba(255,255,255,0.85)',
                                }}
                              >
                                {m.relatorio}
                              </td>
                              <td
                                style={{
                                  padding: '8px 10px',
                                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                                  width: 110,
                                }}
                              >
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={async () => {
                                    if (settingsLocked) return
                                    setOrgaoDeParaSavedMsg(null)
                                    setOrgaoDeParaError(null)
                                    setOrgaoDeParaLoading(true)
                                    try {
                                      const res = await fetch('/api/consignado/orgao-depara/delete', {
                                        method: 'POST',
                                        headers: { 'content-type': 'application/json' },
                                        body: JSON.stringify({ extratos: m.extratos }),
                                      })
                                      const data = (await res.json().catch(() => null)) as null | {
                                        items?: Array<{ extratos?: string; relatorio?: string }>
                                        message?: string
                                      }
                                      if (!res.ok) {
                                        throw new Error(
                                          data?.message ||
                                            `Falha ao remover de/para (HTTP ${res.status}).`,
                                        )
                                      }
                                      const items = Array.isArray(data?.items)
                                        ? data!.items!
                                            .map((i) => ({
                                              extratos:
                                                typeof i.extratos === 'string' ? i.extratos : '',
                                              relatorio:
                                                typeof i.relatorio === 'string' ? i.relatorio : '',
                                            }))
                                            .filter((i) => Boolean(i.extratos) && Boolean(i.relatorio))
                                        : []
                                      setOrgaoDePara(items)
                                      setOrgaoDeParaSavedMsg('De/para removido.')
                                    } catch (e) {
                                      const msg =
                                        e instanceof Error ? e.message : 'Falha ao remover de/para.'
                                      setOrgaoDeParaError(msg)
                                    } finally {
                                      setOrgaoDeParaLoading(false)
                                    }
                                  }}
                                  disabled={settingsLocked || orgaoDeParaLoading}
                                >
                                  Remover
                                </button>
                              </td>
                            </tr>
                          ))}
                          {orgaoDePara.length === 0 ? (
                            <tr>
                              <td
                                colSpan={3}
                                style={{
                                  padding: '10px 10px',
                                  color: 'rgba(255,255,255,0.70)',
                                }}
                              >
                                Nenhum de/para cadastrado.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <h2>Consolidação • Recurso do Órgão (Extratos)</h2>
                    <span className="chip">
                      <FileText size={16} />
                      Regras
                    </span>
                  </div>
                  <div className="panel-body">
                    {extratosConsolidacaoRecursoLoading ? (
                      <div className="help">Carregando regras...</div>
                    ) : null}
                    {extratosConsolidacaoRecursoError ? (
                      <div className="help" style={{ color: 'rgba(255, 99, 132, 0.95)' }}>
                        {extratosConsolidacaoRecursoError}
                      </div>
                    ) : null}

                    <div className="form-grid">
                      <div className="field">
                        <label>Órgão (Extratos)</label>
                        <select
                          className="control orgao-select"
                          value={extratosConsolidacaoRecursoDraft.orgao}
                          onChange={(e) =>
                            setExtratosConsolidacaoRecursoDraft((prev) => ({
                              ...prev,
                              orgao: e.target.value,
                            }))
                          }
                          disabled={settingsLocked || extratosConsolidacaoRecursoLoading || orgaoValuesLoading}
                        >
                          <option value="">(Selecione)</option>
                          {orgaoValues.extratos.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>HISTÓRICO_1 (valor para somar)</label>
                        <input
                          className="control"
                          list="extratos-historico1-options"
                          value={extratosConsolidacaoRecursoDraft.historico1}
                          onChange={(e) =>
                            setExtratosConsolidacaoRecursoDraft((prev) => ({
                              ...prev,
                              historico1: e.target.value,
                            }))
                          }
                          placeholder="Ex.: 1780 FUNDO FIN RPPS TED TARIFADA"
                          disabled={
                            settingsLocked ||
                            extratosConsolidacaoRecursoLoading ||
                            extratosHistorico1OptionsLoading
                          }
                        />
                        <datalist id="extratos-historico1-options">
                          {extratosHistorico1Options.map((v) => (
                            <option key={v} value={v} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={async () => {
                          if (settingsLocked) return
                          const orgao = extratosConsolidacaoRecursoDraft.orgao.trim()
                          const historico1 = extratosConsolidacaoRecursoDraft.historico1.trim()
                          if (!orgao || !historico1) return
                          setExtratosConsolidacaoRecursoSavedMsg(null)
                          setExtratosConsolidacaoRecursoError(null)
                          setExtratosConsolidacaoRecursoLoading(true)
                          try {
                            const res = await fetch('/api/consignado/extratos-consolidacao-recurso', {
                              method: 'POST',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({ orgao, historico1 }),
                            })
                            const data = (await res.json().catch(() => null)) as null | {
                              items?: Array<{ orgao?: string; historico1?: string; createdAt?: string }>
                              message?: string
                            }
                            if (!res.ok) {
                              throw new Error(
                                data?.message ||
                                  `Falha ao salvar regra de consolidação (HTTP ${res.status}).`,
                              )
                            }
                            const items = Array.isArray(data?.items)
                              ? data!.items!
                                  .map((i) => ({
                                    orgao: typeof i.orgao === 'string' ? i.orgao : '',
                                    historico1: typeof i.historico1 === 'string' ? i.historico1 : '',
                                    createdAt: typeof i.createdAt === 'string' ? i.createdAt : '',
                                  }))
                                  .filter((i) => Boolean(i.orgao) && Boolean(i.historico1))
                              : []
                            setExtratosConsolidacaoRecurso(items)
                            setExtratosConsolidacaoRecursoDraft({ orgao: '', historico1: '' })
                            setExtratosConsolidacaoRecursoSavedMsg('Regra salva.')
                          } catch (e) {
                            const msg =
                              e instanceof Error ? e.message : 'Falha ao salvar regra.'
                            setExtratosConsolidacaoRecursoError(msg)
                          } finally {
                            setExtratosConsolidacaoRecursoLoading(false)
                          }
                        }}
                        disabled={settingsLocked || extratosConsolidacaoRecursoLoading}
                      >
                        <Zap size={18} />
                        {extratosConsolidacaoRecursoLoading ? 'Salvando...' : 'Salvar regra'}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          if (settingsLocked) return
                          setExtratosConsolidacaoRecursoDraft({ orgao: '', historico1: '' })
                        }}
                        disabled={settingsLocked || extratosConsolidacaoRecursoLoading}
                      >
                        Limpar
                      </button>
                    </div>

                    {extratosConsolidacaoRecursoSavedMsg ? (
                      <div className="help" style={{ marginTop: 10, color: 'rgba(0, 174, 157, 0.95)' }}>
                        {extratosConsolidacaoRecursoSavedMsg}
                      </div>
                    ) : null}

                    <div style={{ marginTop: 14, overflow: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {['Órgão', 'HISTÓRICO_1', 'Ações'].map((h) => (
                              <th
                                key={h}
                                style={{
                                  textAlign: 'left',
                                  padding: '8px 10px',
                                  fontSize: '0.72rem',
                                  letterSpacing: '0.08em',
                                  textTransform: 'uppercase',
                                  color: 'rgba(255,255,255,0.62)',
                                  borderBottom: '1px solid rgba(255,255,255,0.12)',
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {extratosConsolidacaoRecurso.map((m) => (
                            <tr key={`${m.orgao}__${m.historico1}`}>
                              <td style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                {m.orgao}
                              </td>
                              <td style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' }}>
                                {m.historico1}
                              </td>
                              <td style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', width: 110 }}>
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={async () => {
                                    if (settingsLocked) return
                                    setExtratosConsolidacaoRecursoSavedMsg(null)
                                    setExtratosConsolidacaoRecursoError(null)
                                    setExtratosConsolidacaoRecursoLoading(true)
                                    try {
                                      const res = await fetch('/api/consignado/extratos-consolidacao-recurso/delete', {
                                        method: 'POST',
                                        headers: { 'content-type': 'application/json' },
                                        body: JSON.stringify({ orgao: m.orgao, historico1: m.historico1 }),
                                      })
                                      const data = (await res.json().catch(() => null)) as null | {
                                        items?: Array<{ orgao?: string; historico1?: string; createdAt?: string }>
                                        message?: string
                                      }
                                      if (!res.ok) {
                                        throw new Error(
                                          data?.message ||
                                            `Falha ao remover regra (HTTP ${res.status}).`,
                                        )
                                      }
                                      const items = Array.isArray(data?.items)
                                        ? data!.items!
                                            .map((i) => ({
                                              orgao: typeof i.orgao === 'string' ? i.orgao : '',
                                              historico1: typeof i.historico1 === 'string' ? i.historico1 : '',
                                              createdAt: typeof i.createdAt === 'string' ? i.createdAt : '',
                                            }))
                                            .filter((i) => Boolean(i.orgao) && Boolean(i.historico1))
                                        : []
                                      setExtratosConsolidacaoRecurso(items)
                                      setExtratosConsolidacaoRecursoSavedMsg('Regra removida.')
                                    } catch (e) {
                                      const msg =
                                        e instanceof Error ? e.message : 'Falha ao remover regra.'
                                      setExtratosConsolidacaoRecursoError(msg)
                                    } finally {
                                      setExtratosConsolidacaoRecursoLoading(false)
                                    }
                                  }}
                                  disabled={settingsLocked || extratosConsolidacaoRecursoLoading}
                                >
                                  Remover
                                </button>
                              </td>
                            </tr>
                          ))}
                          {extratosConsolidacaoRecurso.length === 0 ? (
                            <tr>
                              <td colSpan={3} style={{ padding: '10px 10px', color: 'rgba(255,255,255,0.70)' }}>
                                Nenhuma regra cadastrada.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <section className="grid">
                <div className="panel">
                  <div className="panel-head">
                    <h2>Agendamento</h2>
                    <span className="chip">
                      <Zap size={16} />
                      Rotina
                    </span>
                  </div>
                  <div className="panel-body">
                    <div className="field">
                      <label>Dias da semana</label>
                      <div className="days">
                        {(
                          [
                            ['seg', 'Segunda'],
                            ['ter', 'Terça'],
                            ['qua', 'Quarta'],
                            ['qui', 'Quinta'],
                            ['sex', 'Sexta'],
                            ['sab', 'Sábado'],
                            ['dom', 'Domingo'],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key} className="day">
                            <input
                              type="checkbox"
                              checked={importDays[key]}
                              onChange={(e) => {
                                if (settingsLocked) return
                                setImportDays((prev) => ({
                                  ...prev,
                                  [key]: e.target.checked,
                                }))
                              }}
                              disabled={settingsLocked}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="field" style={{ marginTop: 12 }}>
                      <label>Horário</label>
                      <div className="control-wrap">
                        <select
                          ref={timeSelectRef}
                          className="control"
                          value={importTime}
                          onChange={(e) => setImportTime(e.target.value)}
                          disabled={settingsLocked}
                        >
                          {Array.from({ length: 24 }, (_, i) => {
                            const h = String(i).padStart(2, '0')
                            const value = `${h}:00`
                            return (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            )
                          })}
                        </select>
                        <button
                          type="button"
                          className="control-icon"
                          onClick={() => timeSelectRef.current?.focus()}
                          aria-label="Selecionar horário"
                          disabled={settingsLocked}
                        >
                          <Clock size={16} />
                        </button>
                      </div>
                      <div className="help">
                        Define quando a importação automática será executada.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-head">
                    <h2>Notificações</h2>
                    <span className="chip">
                      <ShieldCheck size={16} />
                      Sucesso/Erro
                    </span>
                  </div>
                  <div className="panel-body">
                    <div className="field">
                      <label>E-mail de notificação</label>
                      <input
                        className="control"
                        type="email"
                        value={notificationEmail}
                        onChange={(e) => setNotificationEmail(e.target.value)}
                        onBlur={() => void saveNotificationsConfigToServer()}
                        placeholder="ex.: financeiro@sicoobjuriscred.com.br"
                        disabled={settingsLocked}
                      />
                    </div>
                    <div className="field">
                      <label>E-mail contabilidade</label>
                      <input
                        className="control"
                        type="text"
                        value={notificationEmailContabilidade}
                        onChange={(e) =>
                          setNotificationEmailContabilidade(e.target.value)
                        }
                        onBlur={() => void saveNotificationsConfigToServer()}
                        placeholder="ex.: contabilidade@sicoobjuriscred.com.br; fiscal@sicoobjuriscred.com.br"
                        disabled={settingsLocked}
                      />
                    </div>
                    <div
                      style={{
                        marginTop: 14,
                        paddingTop: 14,
                        borderTop: '1px solid rgba(255,255,255,0.10)',
                        display: 'grid',
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ fontWeight: 750, color: 'rgba(255,255,255,0.92)' }}>
                          Teams (Chat 1:1) — Login Microsoft (delegado)
                        </div>
                        <span className="chip">
                          {teamsDelegatedConnected ? 'conectado' : 'desconectado'}
                        </span>
                      </div>

                      {teamsDelegatedDeviceCode ? (
                        <div
                          style={{
                            padding: '10px 12px',
                            borderRadius: 14,
                            border: '1px solid rgba(255,255,255,0.10)',
                            background: 'rgba(255,255,255,0.04)',
                            display: 'grid',
                            gap: 8,
                          }}
                        >
                          <div style={{ color: 'rgba(255,255,255,0.92)', fontWeight: 650 }}>
                            Acesse:{' '}
                            <a
                              href={teamsDelegatedDeviceCode.verificationUri}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'rgba(127, 210, 255, 0.95)' }}
                            >
                              {teamsDelegatedDeviceCode.verificationUri}
                            </a>
                          </div>
                          <div style={{ color: 'rgba(255,255,255,0.92)' }}>
                            Código: <span style={{ fontWeight: 800 }}>{teamsDelegatedDeviceCode.userCode}</span>
                          </div>
                          {teamsDelegatedDeviceCode.message ? (
                            <div style={{ color: 'rgba(255,255,255,0.70)' }}>
                              {teamsDelegatedDeviceCode.message}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {!teamsDelegatedConnected ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => void startTeamsDelegatedLogin()}
                            disabled={settingsLocked || teamsDelegatedLoading}
                          >
                            Iniciar login
                          </button>
                        ) : null}
                        {teamsDelegatedDeviceCode ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => void finishTeamsDelegatedLogin()}
                            disabled={settingsLocked || teamsDelegatedLoading}
                          >
                            Concluir login
                          </button>
                        ) : null}
                        {teamsDelegatedConnected ? (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => void disconnectTeamsDelegatedLogin()}
                            disabled={settingsLocked || teamsDelegatedLoading}
                          >
                            Desconectar
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="help">
                      Recebe o resultado (sucesso ou erro) do processo de
                      importação. Para múltiplos destinatários, separe por “;” ou “,”.
                    </div>
                  </div>
                </div>
                </section>
              </>
            ) : null}

            {view === 'configuracoes-acessos' ? (
              <section className="grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="panel" style={{ gridColumn: '1 / -1' }}>
                  <div className="panel-head">
                    <h2>Acessos</h2>
                    <span className="chip">
                      <ShieldCheck size={16} />
                      IAM
                    </span>
                  </div>
                  <div className="panel-body">
                    <div className="help">
                      Defina os e-mails que poderão acessar este módulo. Usuários
                      autenticados fora desta lista verão a mensagem de acesso não
                      autorizado.
                    </div>

                    {accessEmailsError ? (
                      <div
                        style={{
                          marginTop: 10,
                          color: 'rgba(255, 99, 132, 0.95)',
                          fontWeight: 650,
                        }}
                      >
                        {accessEmailsError}
                      </div>
                    ) : null}

                    <div className="form-grid" style={{ marginTop: 12 }}>
                      <div className="field">
                        <label>Adicionar e-mail</label>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(320px, 1fr) 160px auto',
                            gap: 10,
                            alignItems: 'center',
                          }}
                        >
                          <input
                            className="control"
                            type="email"
                            value={accessEmailDraft}
                            onChange={(e) => setAccessEmailDraft(e.target.value)}
                            placeholder="ex.: usuario@sicoobjuriscred.com.br"
                            disabled={settingsLocked || accessEmailsLoading || accessEmailsSaving}
                          />
                          <select
                            className="control access-select"
                            value={accessRoleDraft}
                            onChange={(e) =>
                              setAccessRoleDraft(
                                e.target.value === 'admin' ? 'admin' : 'usuario',
                              )
                            }
                            disabled={settingsLocked || accessEmailsLoading || accessEmailsSaving}
                            style={{ height: 44 }}
                          >
                            <option value="usuario">Usuário</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={settingsLocked || accessEmailsLoading || accessEmailsSaving}
                            onClick={() => {
                              if (settingsLocked) return
                              const next = accessEmailDraft.trim().toLowerCase()
                              if (!next) return
                              const fixed = accessFixedEmail.trim().toLowerCase()
                              const existing = accessEmails
                                .map((e) => e.trim().toLowerCase())
                                .filter(Boolean)
                              const base = existing.includes(fixed) ? existing : [fixed, ...existing]
                              const nextEmails = base.includes(next)
                                ? base
                                : [fixed, ...base.filter((e) => e !== fixed), next]

                              const nextRoles: Record<string, 'admin' | 'usuario'> = {
                                ...accessRoleByEmail,
                                [fixed]: 'admin',
                                [next]: accessRoleDraft,
                              }

                              setAccessEmails(nextEmails)
                              setAccessRoleByEmail(nextRoles)
                              setAccessEmailDraft('')
                              persistAccess(nextEmails, nextRoles)
                            }}
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                      {accessEmails.map((email) => {
                        const fixed = email === accessFixedEmail
                        return (
                          <div
                            key={email}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(320px, 1fr) 160px 44px',
                              alignItems: 'center',
                              gap: 12,
                              padding: '10px 12px',
                              borderRadius: 16,
                              border: '1px solid rgba(255,255,255,0.10)',
                              background: 'rgba(255,255,255,0.04)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: 'rgba(255,255,255,0.92)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {email}
                              </span>
                              {fixed ? (
                                <span className="chip">
                                  <ShieldCheck size={16} />
                                  fixo
                                </span>
                              ) : null}
                            </div>
                            <select
                              className="control access-select"
                              value={accessRoleByEmail[email] ?? (fixed ? 'admin' : 'usuario')}
                              onChange={(e) => {
                                if (settingsLocked) return
                                const role = e.target.value === 'admin' ? 'admin' : 'usuario'
                                if (fixed) return
                                const nextRoles: Record<string, 'admin' | 'usuario'> = {
                                  ...accessRoleByEmail,
                                  [email]: role,
                                  [accessFixedEmail]: 'admin',
                                }
                                setAccessRoleByEmail(nextRoles)
                                persistAccess(accessEmails, nextRoles)
                              }}
                              disabled={settingsLocked || accessEmailsLoading || accessEmailsSaving || fixed}
                              style={{ height: 44 }}
                            >
                              <option value="usuario">Usuário</option>
                              <option value="admin">Admin</option>
                            </select>
                            {!fixed ? (
                              <button
                                type="button"
                                className="btn"
                                disabled={settingsLocked || accessEmailsLoading || accessEmailsSaving}
                                onClick={() => {
                                  if (settingsLocked) return
                                  const nextEmails = accessEmails.filter((e) => e !== email)
                                  const nextRoles: Record<string, 'admin' | 'usuario'> = {
                                    ...accessRoleByEmail,
                                  }
                                  delete nextRoles[email]
                                  nextRoles[accessFixedEmail] = 'admin'
                                  setAccessEmails(nextEmails)
                                  setAccessRoleByEmail(nextRoles)
                                  persistAccess(nextEmails, nextRoles)
                                }}
                                title="Remover"
                                aria-label={`Remover ${email}`}
                                style={{ padding: 11, width: 44, justifyContent: 'center' }}
                              >
                                <Trash2 size={18} />
                              </button>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {view === 'relatorios-valores' ? (
              <section className="grid">
                <div className="panel" style={{ gridColumn: '1 / -1' }}>
                  <div className="panel-head">
                    <h2>Conciliação</h2>
                    <span className="chip">
                      <FileText size={16} />
                      Relatório
                    </span>
                  </div>
                  <div className="panel-body">
                    <div className="home-toolbar" style={{ marginBottom: 10 }}>
                      <div className="grid" style={{ gridTemplateColumns: '180px 1fr 220px', gap: 12 }}>
                        <div className="field">
                          <label>Competência</label>
                          <select
                            className="control month-select"
                            value={conciliacaoMonth}
                            onChange={(e) => setConciliacaoMonth(e.target.value)}
                            disabled={conciliacaoMonthsLoading || conciliacaoMonthOptions.length === 0}
                            style={{ height: 44 }}
                          >
                            {conciliacaoMonthOptions.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="field">
                          <label>Órgão</label>
                          <select
                            className="control month-select"
                            value={conciliacaoOrgao}
                            onChange={(e) => setConciliacaoOrgao(e.target.value)}
                            disabled={orgaoDeParaLoading}
                            style={{ height: 44 }}
                          >
                            <option value="">Selecione...</option>
                            {conciliacaoOrgaoOptions.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="field">
                          <label>Exibir</label>
                          <label className="home-toggle">
                            <input
                              type="checkbox"
                              checked={conciliacaoOnlyDiff}
                              onChange={(e) => setConciliacaoOnlyDiff(e.target.checked)}
                            />
                            <span>Somente divergências</span>
                          </label>
                        </div>
                      </div>

                      {conciliacaoError ? (
                        <div className="help" style={{ marginTop: 10, color: 'rgba(255, 99, 132, 0.95)' }}>
                          {conciliacaoError}
                        </div>
                      ) : null}

                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => void exportConciliacaoPdf()}
                          disabled={
                            !canExportConciliacaoXlsx ||
                            conciliacaoExportingPdf ||
                            !conciliacaoOrgao.trim() ||
                            !conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)
                          }
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
                        >
                          <FileText size={18} />
                          {conciliacaoExportingPdf ? 'Exportando...' : 'Exportar PDF'}
                        </button>

                        <button
                          type="button"
                          className="btn"
                          disabled={
                            !canExportConciliacaoXlsx ||
                            conciliacaoExportingXlsx ||
                            !conciliacaoOrgao.trim() ||
                            !conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)
                          }
                          onClick={() => void exportConciliacaoXlsx()}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
                        >
                          <FileSpreadsheet size={18} />
                          {conciliacaoExportingXlsx ? 'Exportando...' : 'Exportar XLSX'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="panel" style={{ gridColumn: '1 / -1' }}>
                  <div className="panel-head">
                    <h2>Lista da conciliação</h2>
                    <span className="chip">
                      <Sparkles size={16} />
                      Recurso x Relatório Sisbr
                    </span>
                  </div>
                  <div className="panel-body">
                    {conciliacaoLoading && !conciliacaoData ? (
                      <div className="help">Carregando conciliação...</div>
                    ) : conciliacaoData ? (
                      (() => {
                        const recursoAll = Array.isArray(conciliacaoData?.recurso) ? conciliacaoData.recurso : []
                        const relatorioAll = Array.isArray(conciliacaoData?.relatorio) ? conciliacaoData.relatorio : []
                        const recursoRows = conciliacaoOnlyDiff ? recursoAll.filter((x: any) => x?.status === 'pendencia') : recursoAll
                        const relatorioRows = conciliacaoOnlyDiff ? relatorioAll.filter((x: any) => x?.status === 'pendencia') : relatorioAll
                        const rows = [
                          ...recursoRows.map((r: any) => ({ ...r, __src: 'Recurso' as const, __occ: null as any })),
                          ...relatorioRows.map((r: any) => ({ ...r, __src: 'Relatório Sisbr' as const, __occ: r?.ocorrencia ?? null })),
                        ]
                        const shown = rows.slice(0, 500)

                        return (
                          <>
                            <div className="help" style={{ marginBottom: 10 }}>
                              Mostrando {shown.length} de {rows.length} linha(s).
                            </div>
                            <div style={{ overflow: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                                <thead>
                                  <tr>
                                    {['Origem', 'CPF', 'Nome', 'Valor', 'Status', 'Ocorrência'].map((h) => (
                                      <th
                                        key={h}
                                        style={{
                                          textAlign: 'left',
                                          padding: '10px 12px',
                                          fontSize: '0.78rem',
                                          letterSpacing: '0.08em',
                                          textTransform: 'uppercase',
                                          color: 'rgba(255,255,255,0.62)',
                                          borderBottom: '1px solid rgba(255,255,255,0.12)',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {shown.map((r: any, idx: number) => {
                                    const status = r?.status === 'conciliado' ? 'Conciliado' : 'Pendente'
                                    const occ =
                                      r.__src === 'Relatório Sisbr' && r.__occ
                                        ? [r.__occ.action, r.__occ.justification].filter(Boolean).join(' • ')
                                        : ''
                                    return (
                                      <tr key={`${r.__src}-${r.cpf}-${r.value}-${idx}`}>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                          {r.__src}
                                        </td>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>
                                          {String(r?.cpf ?? '').trim() || '-'}
                                        </td>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', minWidth: 260 }}>
                                          {String(r?.nome ?? '').trim() || '-'}
                                        </td>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                          {withCurrency(String(r?.value ?? '0,00'))}
                                        </td>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>
                                          <span className="chip" style={{ borderColor: r?.status === 'conciliado' ? 'rgba(22,163,74,0.35)' : 'rgba(245,158,11,0.35)' }}>
                                            {status}
                                          </span>
                                        </td>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', minWidth: 260 }}>
                                          {occ || '—'}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )
                      })()
                    ) : (
                      <div className="help">Selecione uma competência e um órgão para listar a conciliação.</div>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {view === 'relatorios-auditoria' ? (
              <section className="grid">
                <div className="panel" style={{ gridColumn: '1 / -1' }}>
                  <div className="panel-head">
                    <h2>Auditoria Sistêmica</h2>
                    <span className="chip">
                      <ShieldCheck size={16} />
                      Logs
                    </span>
                  </div>
                  <div className="panel-body">
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: 10,
                        alignItems: 'end',
                      }}
                    >
                      <div className="field">
                        <label>Competência</label>
                        <select
                          className="control orgao-select"
                          value={auditoriaMonth}
                          onChange={(e) => setAuditoriaMonth(e.target.value)}
                          disabled={conciliacaoMonthsLoading}
                        >
                          <option value="">Todas</option>
                          {conciliacaoMonthOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Órgão</label>
                        <select
                          className="control orgao-select"
                          value={auditoriaOrgao}
                          onChange={(e) => setAuditoriaOrgao(e.target.value)}
                          disabled={orgaoDeParaLoading}
                        >
                          <option value="">Todos</option>
                          {conciliacaoOrgaoOptions.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Tipo</label>
                        <select
                          className="control orgao-select"
                          value={auditoriaGroup}
                          onChange={(e) => setAuditoriaGroup(e.target.value)}
                        >
                          <option value="">Todos</option>
                          <option value="ocorrencias">Ocorrências</option>
                          <option value="tarifas">Tarifas</option>
                          <option value="fechamentos">Fechamentos</option>
                          <option value="contabilidade">Contabilidade</option>
                        </select>
                      </div>
                    </div>

                    {auditoriaError ? (
                      <div className="help" style={{ marginTop: 10, color: 'rgba(255, 99, 132, 0.95)' }}>
                        {auditoriaError}
                      </div>
                    ) : null}

                    {auditoriaLoading && !auditoriaData ? (
                      <div className="help" style={{ marginTop: 10 }}>
                        Carregando auditoria...
                      </div>
                    ) : auditoriaData ? (
                      (() => {
                        const total = Number.isFinite(auditoriaData.total) ? auditoriaData.total : 0
                        const offset = Number.isFinite(auditoriaData.offset) ? auditoriaData.offset : 0
                        const limit = Number.isFinite(auditoriaData.limit) ? auditoriaData.limit : 100
                        const shown = Array.isArray(auditoriaData.items) ? auditoriaData.items : []
                        const canPrev = offset > 0
                        const canNext = offset + shown.length < total

                        const groupLabel = (g: string) => {
                          if (g === 'ocorrencias') return 'Ocorrências'
                          if (g === 'tarifas') return 'Tarifas'
                          if (g === 'fechamentos') return 'Fechamentos'
                          if (g === 'contabilidade') return 'Contabilidade'
                          return g || '—'
                        }

                        return (
                          <>
                            <div
                              style={{
                                marginTop: 12,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                flexWrap: 'wrap',
                              }}
                            >
                              <div className="help" style={{ margin: 0 }}>
                                Mostrando {shown.length} de {total} evento(s).
                              </div>
                              <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                  type="button"
                                  className="btn"
                                  disabled={!canPrev || auditoriaLoading}
                                  onClick={() => setAuditoriaOffset(Math.max(0, offset - limit))}
                                >
                                  Anterior
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  disabled={!canNext || auditoriaLoading}
                                  onClick={() => setAuditoriaOffset(offset + limit)}
                                >
                                  Próxima
                                </button>
                              </div>
                            </div>

                            <div style={{ marginTop: 12, overflow: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                                <thead>
                                  <tr>
                                    {['Data/Hora', 'Tipo', 'Competência', 'Órgão', 'Ação', 'Usuário', 'Detalhe', 'CPF', 'Nome', 'Valor'].map(
                                      (h) => (
                                        <th
                                          key={h}
                                          style={{
                                            textAlign: 'left',
                                            padding: '10px 12px',
                                            fontSize: '0.78rem',
                                            letterSpacing: '0.08em',
                                            textTransform: 'uppercase',
                                            color: 'rgba(255,255,255,0.62)',
                                            borderBottom: '1px solid rgba(255,255,255,0.12)',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {h}
                                        </th>
                                      ),
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {shown.map((ev) => (
                                    <tr key={ev.id}>
                                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>
                                        {formatIsoToPtBrDateTime(ev.occurredAt)}
                                      </td>
                                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>
                                        <span className="chip">{groupLabel(String(ev.group ?? ''))}</span>
                                      </td>
                                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>
                                        {String(ev.month ?? '').trim() || '—'}
                                      </td>
                                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', minWidth: 220 }}>
                                        {String(ev.orgao ?? '').trim() || '—'}
                                      </td>
                                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', minWidth: 220 }}>
                                        {String(ev.action ?? '').trim() || '—'}
                                      </td>
                                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>
                                        {String(ev.user ?? '').trim() || '—'}
                                      </td>
                                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', minWidth: 320 }}>
                                        {String(ev.detail ?? '').trim() || '—'}
                                      </td>
                                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>
                                        {String(ev.cpf ?? '').trim() || '—'}
                                      </td>
                                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', minWidth: 240 }}>
                                        {String(ev.nome ?? '').trim() || '—'}
                                      </td>
                                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                        {String(ev.value ?? '').trim()
                                          ? withCurrency(String(ev.value ?? ''))
                                          : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )
                      })()
                    ) : (
                      <div className="help" style={{ marginTop: 10 }}>
                        Ajuste os filtros para listar os eventos de auditoria.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {view === 'conciliacao-extratos' ? (
              <section className="panel">
                <div className="panel-head">
                  <h2>Recurso x Relatório SISBR</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={
                        conciliacaoMonthsLoading ||
                        orgaoDeParaLoading ||
                        !conciliacaoOrgao.trim() ||
                        !conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth) ||
                        Boolean(conciliacaoData?.closed?.isClosed) ||
                        conciliacaoClosing ||
                        conciliacaoReopening ||
                        conciliacaoResending
                      }
                      title="Incluir tarifa"
                      aria-label="Incluir tarifa"
                      style={{ padding: 11, width: 44, justifyContent: 'center' }}
                      onClick={() => {
                        setTarifaError(null)
                        setTarifaTypeDraft('linha')
                        setTarifaDraft('')
                        setTarifaModalOpen(true)
                      }}
                    >
                      <Plus size={18} />
                    </button>
                    <div
                      ref={conciliacaoLockBalloonAnchorRef}
                      style={{ position: 'relative', display: 'inline-flex' }}
                    >
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={
                          conciliacaoMonthsLoading ||
                          orgaoDeParaLoading ||
                          !conciliacaoOrgao.trim() ||
                          !conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth) ||
                          conciliacaoClosing ||
                          conciliacaoReopening ||
                          conciliacaoResending
                        }
                        title={
                          conciliacaoClosing
                            ? 'Fechando...'
                            : conciliacaoReopening
                              ? 'Reabrindo...'
                              : conciliacaoIsClosed
                                ? 'Reabrir conciliação'
                                : 'Fechar conciliação'
                        }
                        aria-label={
                          conciliacaoClosing
                            ? 'Fechando conciliação'
                            : conciliacaoReopening
                              ? 'Reabrindo conciliação'
                              : conciliacaoIsClosed
                                ? 'Reabrir conciliação'
                                : 'Fechar conciliação'
                        }
                        style={{ padding: 11, width: 44, justifyContent: 'center' }}
                        onClick={() => {
                          if (!conciliacaoOrgao.trim()) return
                          if (!conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)) return
                          if (conciliacaoIsClosed) {
                            setConciliacaoReopenError(null)
                            setConciliacaoReopenPassword('')
                            setConciliacaoReopenMode(conciliacaoTotalIsClosed ? 'total' : 'parcial')
                            setConciliacaoReopenVencimento(
                              conciliacaoTotalIsClosed ? '' : vencimentoSelecionado,
                            )
                            setConciliacaoReopenModalOpen(true)
                            return
                          }
                          setConciliacaoCloseError(null)
                          setConciliacaoCloseMode('total')
                          setConciliacaoCloseVencimento('')
                          setConciliacaoCloseStep(1)
                          setConciliacaoCloseModalOpen(true)
                        }}
                      >
                        {conciliacaoClosing || conciliacaoReopening ? (
                          <Clock size={18} />
                        ) : conciliacaoIsClosed ? (
                          <Lock size={18} />
                        ) : (
                          <Unlock size={18} />
                        )}
                      </button>
                    </div>
                    {!conciliacaoTotalIsClosed &&
                    closedVencimentos.length > 0 &&
                    !conciliacaoMonthsLoading &&
                    !orgaoDeParaLoading ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={conciliacaoClosing || conciliacaoReopening || conciliacaoResending}
                        title="Reabrir vencimento (parcial)"
                        aria-label="Reabrir vencimento"
                        style={{ padding: 11, width: 44, justifyContent: 'center' }}
                        onClick={() => {
                          if (!conciliacaoOrgao.trim()) return
                          if (!conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)) return
                          setConciliacaoReopenError(null)
                          setConciliacaoReopenPassword('')
                          setConciliacaoReopenMode('parcial')
                          setConciliacaoReopenVencimento('')
                          setConciliacaoReopenModalOpen(true)
                        }}
                      >
                        <Unlock size={18} />
                      </button>
                    ) : null}
                    {conciliacaoIsClosed &&
                    conciliacaoClosedBalloonVisible &&
                    conciliacaoLockBalloonPos &&
                    typeof document !== 'undefined'
                      ? createPortal(
                          <div
                            className="lock-balloon"
                            style={{
                              left: conciliacaoLockBalloonPos.left,
                              top: conciliacaoLockBalloonPos.top,
                            }}
                          >
                            Conciliação fechada{vencimentoSelecionado ? ` • Vencimento ${vencimentoSelecionado}` : ''}
                          </div>,
                          document.body,
                        )
                      : null}
                    {conciliacaoIsClosed ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={
                          conciliacaoMonthsLoading ||
                          orgaoDeParaLoading ||
                          !conciliacaoOrgao.trim() ||
                          !conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth) ||
                          conciliacaoClosing ||
                          conciliacaoReopening ||
                          conciliacaoResending
                        }
                        title={conciliacaoResending ? 'Reenviando...' : 'Reenviar fechamento para Contabilidade'}
                        aria-label={conciliacaoResending ? 'Reenviando para Contabilidade' : 'Reenviar para Contabilidade'}
                        style={{ padding: 11, width: 44, justifyContent: 'center' }}
                        onClick={async () => {
                          if (!conciliacaoOrgao.trim()) return
                          if (!conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)) return
                          if (!conciliacaoIsClosed) return
                          setConciliacaoError(null)
                          setConciliacaoResending(true)
                          try {
                            const evidencePngBase64 = await captureConciliacaoEvidencePngBase64()
                            const res = await fetch(
                              '/api/consignado/conciliacao/recurso-vs-relatorio/reenviar-contabilidade',
                              {
                                method: 'POST',
                                headers: { 'content-type': 'application/json' },
                                body: JSON.stringify({
                                  month: conciliacaoMonth,
                                  orgao: conciliacaoOrgao.trim(),
                                  vencimento: vencimentoSelecionado || undefined,
                                  requestedBy: accessFixedEmail,
                                  contabilidadeEmail: notificationEmailContabilidade,
                                  evidencePngBase64,
                                }),
                              },
                            )
                            const json = (await res.json().catch(() => null)) as null | { message?: string }
                            if (!res.ok) {
                              throw new Error(json?.message || 'Falha ao reenviar para contabilidade.')
                            }
                            await reloadConciliacaoKeepExpanded()
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : 'Falha ao reenviar para contabilidade.'
                            setConciliacaoError(msg)
                          } finally {
                            setConciliacaoResending(false)
                          }
                        }}
                      >
                        {conciliacaoResending ? <Clock size={18} /> : <Printer size={18} />}
                      </button>
                    ) : null}
                    <span className="chip">
                      <FileText size={16} />
                      Conciliação
                    </span>
                    {conciliacaoTotalIsClosed ? (
                      <span className="chip">
                        <Lock size={16} />
                        Fechada
                      </span>
                    ) : closedVencimentos.length > 0 ? (
                      <span
                        className="chip"
                        title={`Fechamentos parciais: ${closedVencimentos.join(' | ')}`}
                      >
                        <Lock size={16} />
                        Parcial ({closedVencimentos.length})
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="panel-body" ref={conciliacaoEvidenceRef}>
                  {conciliacaoIsClosed ? (
                    <div
                      style={{
                        marginBottom: 12,
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,140,0,0.45)',
                        background:
                          'radial-gradient(240px 120px at 15% 20%, rgba(255,140,0,0.22) 0%, transparent 70%), rgba(255,255,255,0.03)',
                        color: 'rgba(255,255,255,0.92)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <Lock size={16} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 850, letterSpacing: '0.02em' }}>
                            Conciliação fechada{vencimentoSelecionado ? ` • Vencimento ${vencimentoSelecionado}` : ''}
                          </div>
                          <div style={{ opacity: 0.78, fontSize: 13, lineHeight: 1.25 }}>
                            Campos de edição desabilitados (somente leitura).
                          </div>
                        </div>
                      </div>
                      <div style={{ opacity: 0.78, fontSize: 13, whiteSpace: 'nowrap' }}>
                        {conciliacaoData?.closed?.closedAt
                          ? `Fechado em ${String(conciliacaoData?.closed?.closedAt).slice(0, 10)}`
                          : null}
                      </div>
                    </div>
                  ) : null}
                  {!conciliacaoTotalIsClosed && closedVencimentos.length > 0 ? (
                    <div
                      style={{
                        marginBottom: 12,
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,140,0,0.35)',
                        background: 'rgba(255,255,255,0.03)',
                        color: 'rgba(255,255,255,0.92)',
                        display: 'grid',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <Lock size={16} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 850, letterSpacing: '0.02em' }}>
                            Fechamentos parciais ({closedVencimentos.length})
                          </div>
                          <div style={{ opacity: 0.78, fontSize: 13, lineHeight: 1.25 }}>
                            Vencimentos fechados: {closedVencimentos.join(' | ')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="form-grid form-grid-4">
                    <div className="field">
                      <label>Competência</label>
                      <select
                        className="control month-select"
                        value={conciliacaoMonth}
                        onChange={(e) => setConciliacaoMonth(e.target.value)}
                        disabled={conciliacaoMonthsLoading || conciliacaoMonthOptions.length === 0}
                        style={{ height: 44 }}
                      >
                        {conciliacaoMonthOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Orgão</label>
                      <select
                        className="control month-select"
                        value={conciliacaoOrgao}
                        onChange={(e) => setConciliacaoOrgao(e.target.value)}
                        disabled={orgaoDeParaLoading}
                        style={{ height: 44 }}
                      >
                        <option value="">Nenhum</option>
                        {conciliacaoOrgaoOptions.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Vencimento</label>
                      <select
                        className="control month-select control-highlight"
                        value={relatorioVencimentoFilter}
                        onChange={(e) => setRelatorioVencimentoFilter(e.target.value)}
                        disabled={!conciliacaoOrgao.trim() || relatorioVencimentoOptions.length === 0}
                        style={{ height: 44 }}
                      >
                        <option value="">Todos</option>
                        {relatorioVencimentoOptions.map((v) => {
                          const isClosed = closedVencimentos.includes(v)
                          return (
                            <option key={v} value={v}>
                              {isClosed ? `${v} (Fechado)` : v}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                    <div className="field">
                      <label>Exibir</label>
                      <label
                        className="day"
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          gap: 10,
                          height: 44,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={conciliacaoOnlyDiff}
                          onChange={(e) => setConciliacaoOnlyDiff(e.target.checked)}
                        />
                        <span>Somente divergências</span>
                      </label>
                    </div>
                  </div>

                  {isCapturingEvidence ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.04)',
                        color: 'rgba(255,255,255,0.88)',
                        fontWeight: 750,
                        lineHeight: 1.25,
                        wordBreak: 'break-word',
                      }}
                    >
                      Órgão: {conciliacaoOrgao.trim() || '—'}
                    </div>
                  ) : null}

                  {conciliacaoMonthsLoading ? (
                    <div className="help" style={{ marginTop: 12 }}>
                      Carregando competências...
                    </div>
                  ) : null}
                  {!conciliacaoMonthsLoading && conciliacaoMonthOptions.length === 0 ? (
                    <div className="help" style={{ marginTop: 12 }}>
                      Nenhuma competência disponível para conciliação.
                    </div>
                  ) : null}
                  {!conciliacaoMonthsLoading && conciliacaoMonthOptions.length > 0 && !conciliacaoOrgao.trim() ? (
                    <div className="help" style={{ marginTop: 12 }}>
                      Selecione um orgão para visualizar a conciliação.
                    </div>
                  ) : null}

                  {conciliacaoLoading ? (
                    <div className="help" style={{ marginTop: 12 }}>
                      Carregando conciliação...
                    </div>
                  ) : null}
                  {conciliacaoError ? (
                    <div className="help" style={{ marginTop: 12, color: 'rgba(255, 99, 132, 0.95)' }}>
                      {conciliacaoError}
                    </div>
                  ) : null}

                  {conciliacaoData ? (
                    <>
                      <style>
                        {`
                        @keyframes celebrateCheck {
                          0% { opacity: 0; transform: translateY(-1px) scale(0.85); }
                          6% { opacity: 1; transform: translateY(-2px) scale(1.05); }
                          38% { opacity: 1; transform: translateY(-2px) scale(1); }
                          55% { opacity: 0; transform: translateY(-2px) scale(0.98); }
                          100% { opacity: 0; transform: translateY(-2px) scale(0.98); }
                        }
                        .celebrate-check {
                          position: relative;
                          display: inline-block;
                        }
                        .celebrate-check::after {
                          content: '✓';
                          position: absolute;
                          left: 100%;
                          top: 50%;
                          transform: translate(8px, -58%);
                          pointer-events: none;
                          opacity: 0;
                          font-weight: 900;
                          font-size: 0.95em;
                          color: rgba(0,174,157,0.98);
                          animation: celebrateCheck 8000ms ease-out infinite;
                        }
                        `}
                      </style>
                      <div
                        className="stats stats-responsive"
                        style={{
                          marginTop: 14,
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                          gap: 12,
                          alignItems: 'stretch',
                        }}
                      >
                        {(() => {
                          const totalRecursoItens = conciliacaoData.recurso.length
                          const totalRelatorioItens = conciliacaoData.relatorio.length
                          const tarifaSumCents =
                            (conciliacaoData.totals.tarifaLinha?.cents ?? 0) +
                            (conciliacaoData.totals.tarifaTed?.cents ?? 0)
                          const recursoNetCents =
                            conciliacaoData.totals.recurso.cents -
                            conciliacaoData.totals.tarifaLinha.cents -
                            conciliacaoData.totals.tarifaTed.cents
                          const diffNetCents = tarifaSumCents - Math.abs(conciliacaoData.totals.diff.cents)
                          const isExtratoEqualRecurso = conciliacaoData.totals.extratos.cents === recursoNetCents
                          const green = 'rgba(0,174,157,0.98)'
                          const red = 'rgba(255, 99, 132, 0.95)'
                          return [
                            {
                              label: 'Extrato SicoobNet',
                              value: (
                                <span
                                  className={isExtratoEqualRecurso ? 'celebrate-check' : undefined}
                                  style={isExtratoEqualRecurso ? { color: green } : undefined}
                                >
                                  {withCurrency(conciliacaoData.totals.extratos.text)}
                                </span>
                              ),
                            },
                            {
                              label: 'Total recurso Orgão',
                              value: (
                                <span
                                  className={isExtratoEqualRecurso ? 'celebrate-check' : undefined}
                                  style={isExtratoEqualRecurso ? { color: green } : { color: red }}
                                >
                                  {withCurrency(centsToPtBr(recursoNetCents))}
                                </span>
                              ),
                            },
                            {
                              label: 'Total relatório SISbr',
                              value: withCurrency(conciliacaoData.totals.relatorio.text),
                            },
                            {
                              label: 'Tarifa Linha',
                              value: withCurrency(conciliacaoData.totals.tarifaLinha?.text ?? '0,00'),
                            },
                            {
                              label: 'Tarifa TED',
                              value: withCurrency(conciliacaoData.totals.tarifaTed?.text ?? '0,00'),
                            },
                            {
                              label: 'Diferença',
                              value: withCurrency(centsToPtBr(diffNetCents)),
                              diff: diffNetCents !== 0,
                            },
                            {
                              label: 'Itens',
                              value: (
                                <div style={{ display: 'grid', gap: 6 }}>
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: '1fr 1fr',
                                      gap: 10,
                                      justifyItems: 'center',
                                      fontSize: '0.78rem',
                                      opacity: 0.85,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.08em',
                                    }}
                                  >
                                    <div>Recurso</div>
                                    <div>Relatório</div>
                                  </div>
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: '1fr 1fr',
                                      gap: 10,
                                      justifyItems: 'center',
                                    }}
                                  >
                                    <div style={{ fontWeight: 900 }}>{String(totalRecursoItens)}</div>
                                    <div style={{ fontWeight: 900 }}>{String(totalRelatorioItens)}</div>
                                  </div>
                                </div>
                              ),
                            },
                          ]
                        })().map((s) => (
                          <div className="stat" key={s.label}>
                            <div className="label">{s.label}</div>
                            <div
                              className="value"
                              style={
                                'diff' in s && s.diff
                                  ? { color: 'rgba(245,197,66,0.98)' }
                                  : undefined
                              }
                            >
                              {'diff' in s && s.diff ? (
                                <span className="diff-pulse">{s.value}</span>
                              ) : (
                                s.value
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: 14, overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                          <thead>
                            <tr>
                              {['Competência', 'Recurso do Órgão', 'Relatório SISBR', 'Diferença'].map((h) => (
                                <th
                                  key={h}
                                  style={{
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    fontSize: '0.78rem',
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                    color: 'rgba(255,255,255,0.62)',
                                    borderBottom: '1px solid rgba(255,255,255,0.12)',
                                  }}
                                >
                                  {h}
                                </th>
                              ))}
                              <th
                                style={{
                                  textAlign: 'right',
                                  padding: '10px 12px',
                                  fontSize: '0.78rem',
                                  letterSpacing: '0.08em',
                                  textTransform: 'uppercase',
                                  color: 'rgba(255,255,255,0.62)',
                                  borderBottom: '1px solid rgba(255,255,255,0.12)',
                                  width: 1,
                                }}
                              />
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const monthKey = '__MONTH__'
                              const tarifaSumCents =
                                (conciliacaoData.totals.tarifaLinha?.cents ?? 0) +
                                (conciliacaoData.totals.tarifaTed?.cents ?? 0)
                              const diffNetCents = tarifaSumCents - Math.abs(conciliacaoData.totals.diff.cents)
                              const hasDiff = diffNetCents !== 0
                              const ok = !hasDiff
                              const expanded = conciliacaoExpandedKeys.includes(monthKey)
                              const bg = ok ? 'rgba(0,174,157,0.12)' : 'rgba(245,197,66,0.10)'
                              const border = ok ? 'rgba(0,174,157,0.22)' : 'rgba(245,197,66,0.22)'
                              const diffText = withCurrency(centsToPtBr(diffNetCents))
                              const linkedPairId =
                                conciliacaoSelectedPairId ??
                                (conciliacaoSelectedPersonKey ? null : conciliacaoAutoPairId)

                              const searchText = normalizeSearchText(search)
                              const searchDigits = normalizeSearchDigits(search)
                              const matchesSearch = (x: { cpf: string; nome: string }) => {
                                const cpfDigits = normalizeSearchDigits(x?.cpf)
                                const nome = normalizeSearchText(x?.nome)
                                if (searchDigits && cpfDigits.includes(searchDigits)) return true
                                if (searchText && nome.includes(searchText)) return true
                                return false
                              }

                              const recursoBase = conciliacaoOnlyDiff
                                ? conciliacaoData.recurso.filter((x) => x.status === 'pendencia')
                                : conciliacaoData.recurso
                              const relatorioBase = conciliacaoOnlyDiff
                                ? conciliacaoData.relatorio.filter((x) => x.status === 'pendencia')
                                : conciliacaoData.relatorio
                              const recursoRows = searchText || searchDigits
                                ? recursoBase.filter((x) => matchesSearch(x))
                                : recursoBase
                              const relatorioRows = searchText || searchDigits
                                ? relatorioBase.filter((x) => matchesSearch(x))
                                : relatorioBase

                              const relatorioRowsByVencimento = (() => {
                                const wanted = relatorioVencimentoFilter.trim()
                                if (!wanted) return relatorioRows
                                return relatorioRows.filter(
                                  (r) => normalizeVencimentoLabel((r as any).vencimento) === wanted,
                                )
                              })()

                              const eligibleGroupKeys = (() => {
                                const countByCents = (items: Array<{ value: string }>) => {
                                  const m = new Map<number, number>()
                                  for (const it of items) {
                                    const cents = ptBrMoneyToCents(it.value)
                                    m.set(cents, (m.get(cents) ?? 0) + 1)
                                  }
                                  return m
                                }
                                const sameCounts = (a: Map<number, number>, b: Map<number, number>) => {
                                  if (a.size !== b.size) return false
                                  for (const [k, v] of a.entries()) {
                                    if ((b.get(k) ?? 0) !== v) return false
                                  }
                                  return true
                                }
                                const concRecurso = recursoRows.filter(
                                  (x) => x.status === 'conciliado' && Boolean(x.pairId),
                                )
                                const concRelatorio = relatorioRowsByVencimento.filter(
                                  (x) => x.status === 'conciliado' && Boolean(x.pairId),
                                )
                                const byKeyRecurso = new Map<string, typeof concRecurso>()
                                for (const it of concRecurso) {
                                  const k = normalizeLinkKey(it.cpf, it.nome)
                                  const arr = byKeyRecurso.get(k)
                                  if (arr) arr.push(it)
                                  else byKeyRecurso.set(k, [it])
                                }
                                const byKeyRelatorio = new Map<string, typeof concRelatorio>()
                                for (const it of concRelatorio) {
                                  const k = normalizeLinkKey(it.cpf, it.nome)
                                  const arr = byKeyRelatorio.get(k)
                                  if (arr) arr.push(it)
                                  else byKeyRelatorio.set(k, [it])
                                }
                                const out = new Set<string>()
                                for (const [k, rItems] of byKeyRecurso.entries()) {
                                  const lItems = byKeyRelatorio.get(k) ?? []
                                  if (rItems.length < 2 || lItems.length < 2) continue
                                  if (!sameCounts(countByCents(rItems), countByCents(lItems))) continue
                                  out.add(k)
                                }
                                return out
                              })()

                              if (
                                conciliacaoOnlyDiff &&
                                !hasDiff &&
                                recursoRows.length === 0 &&
                                relatorioRows.length === 0
                              ) {
                                return (
                                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <td
                                      colSpan={5}
                                      style={{
                                        padding: '12px 12px',
                                        borderBottom: '1px solid rgba(255,255,255,0.12)',
                                      }}
                                    >
                                      <div className="help">
                                        Nenhuma divergência para a competência selecionada.
                                      </div>
                                    </td>
                                  </tr>
                                )
                              }

                              return (
                                <Fragment>
                                  <tr style={{ background: bg }}>
                                    <td
                                      style={{
                                        padding: '10px 12px',
                                        borderBottom: `1px solid ${border}`,
                                        fontWeight: 750,
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setConciliacaoExpandedKeys((prev) => {
                                            const willOpen = !prev.includes(monthKey)
                                            if (willOpen) setConciliacaoGroupedOpenKeys([])
                                            return willOpen ? [...prev, monthKey] : prev.filter((k) => k !== monthKey)
                                          })
                                        }}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 10,
                                          background: 'transparent',
                                          border: '0',
                                          color: 'inherit',
                                          padding: 0,
                                          cursor: 'pointer',
                                          fontWeight: 750,
                                        }}
                                        title={expanded ? 'Recolher' : 'Expandir'}
                                      >
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            transform: expanded ? 'rotate(180deg)' : undefined,
                                            transition: 'transform 150ms ease',
                                            opacity: 0.85,
                                          }}
                                        >
                                          <ChevronDown size={16} />
                                        </span>
                                        <span style={{ fontWeight: 850 }}>{conciliacaoMonthLabel}</span>
                                      </button>
                                    </td>
                                    <td style={{ padding: '10px 12px', borderBottom: `1px solid ${border}` }}>
                                      {withCurrency(conciliacaoData.totals.recurso.text)}
                                    </td>
                                    <td style={{ padding: '10px 12px', borderBottom: `1px solid ${border}` }}>
                                      {withCurrency(conciliacaoData.totals.relatorio.text)}
                                    </td>
                                    <td
                                      style={{
                                        padding: '10px 12px',
                                        borderBottom: `1px solid ${border}`,
                                        fontWeight: 900,
                                        color: hasDiff
                                          ? 'rgba(245,197,66,0.98)'
                                          : 'rgba(255,255,255,0.92)',
                                      }}
                                    >
                                      <span className={hasDiff ? 'diff-pulse' : undefined}>
                                        {diffText}
                                      </span>
                                    </td>
                                    <td
                                      style={{
                                        padding: '10px 12px',
                                        borderBottom: `1px solid ${border}`,
                                        textAlign: 'right',
                                      }}
                                    >
                                      <button
                                        type="button"
                                        className="btn"
                                        title="Exportar XLSX"
                                        aria-label="Exportar XLSX"
                                        disabled={!canExportConciliacaoXlsx || conciliacaoExportingXlsx}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          void exportConciliacaoXlsx()
                                        }}
                                        style={{ padding: 10, width: 44, justifyContent: 'center' }}
                                      >
                                        <FileSpreadsheet size={18} />
                                      </button>
                                    </td>
                                  </tr>

                                  {expanded ? (
                                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                      <td
                                        colSpan={5}
                                        style={{
                                          padding: '12px 12px 14px',
                                          borderBottom: `1px solid ${border}`,
                                        }}
                                      >
                                        {conciliacaoData.message ? (
                                          <div
                                            className="help"
                                            style={{
                                              marginBottom: 10,
                                              color: 'rgba(245,197,66,0.95)',
                                            }}
                                          >
                                            {conciliacaoData.message}
                                          </div>
                                        ) : null}

                                        <div
                                          ref={conciliacaoLinkHostRef}
                                          style={{
                                            marginTop: 14,
                                            position: 'relative',
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: 72,
                                          }}
                                        >
                                          {conciliacaoLinkOverlay ? (
                                            <svg
                                              data-link-svg="1"
                                              width={conciliacaoLinkOverlay.width}
                                              height={conciliacaoLinkOverlay.height}
                                              viewBox={`0 0 ${conciliacaoLinkOverlay.width} ${conciliacaoLinkOverlay.height}`}
                                              preserveAspectRatio="none"
                                              overflow="visible"
                                              shapeRendering="geometricPrecision"
                                              style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                width: conciliacaoLinkOverlay.width,
                                                height: conciliacaoLinkOverlay.height,
                                                pointerEvents: 'none',
                                                zIndex: 50,
                                              }}
                                            >
                                              {conciliacaoLinkOverlay.paths.map((d, i) => (
                                                <Fragment key={i}>
                                                  <path
                                                    data-link-path="1"
                                                    d={d}
                                                    fill="none"
                                                    stroke="rgba(120, 230, 160, 0.12)"
                                                    strokeWidth={10}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                  />
                                                  <path
                                                    data-link-path="1"
                                                    d={d}
                                                    fill="none"
                                                    stroke="rgba(140, 240, 185, 0.88)"
                                                    strokeWidth={2.25}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                  />
                                                </Fragment>
                                              ))}
                                            </svg>
                                          ) : null}

                                          <div>
                                            <div data-evidence-title="recurso" style={{ fontWeight: 850, marginBottom: 8 }}>
                                              Recurso do Órgão ({conciliacaoData.recursoTable})
                                            </div>
                                            <div
                                              style={{
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                borderRadius: 12,
                                                overflow: 'hidden',
                                              }}
                                            >
                                              <table
                                                style={{
                                                  width: '100%',
                                                  borderCollapse: 'collapse',
                                                  tableLayout: 'fixed',
                                                }}
                                              >
                                                <colgroup>
                                                  <col style={{ width: '54%' }} />
                                                  <col style={{ width: '20%' }} />
                                                  <col style={{ width: '26%' }} />
                                                </colgroup>
                                                <thead>
                                                  <tr>
                                                    {['Nome', 'CPF', 'Valor Parcela'].map((h) => (
                                                      <th
                                                        key={h}
                                                        style={{
                                                          textAlign: 'left',
                                                          padding: '8px 10px',
                                                          fontSize: '0.72rem',
                                                          letterSpacing: '0.08em',
                                                          textTransform: 'uppercase',
                                                          color: 'rgba(255,255,255,0.62)',
                                                          borderBottom: '1px solid rgba(255,255,255,0.12)',
                                                          whiteSpace: 'normal',
                                                          lineHeight: 1.15,
                                                          overflowWrap: 'anywhere',
                                                          wordBreak: 'break-word',
                                                        }}
                                                      >
                                                        {h}
                                                      </th>
                                                    ))}
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {(() => {
                                                    const withIndex = recursoRows
                                                      .slice(0, 300)
                                                      .map((r, idx) => ({ ...r, __idx: idx }))
                                                    const conc = withIndex.filter((r) => r.status === 'conciliado')
                                                    const pend = withIndex.filter((r) => r.status !== 'conciliado')
                                                    const groupBorder = '2px solid rgba(255,140,0,0.85)'
                                                    const byKey = new Map<
                                                      string,
                                                      Array<(typeof withIndex)[number]>
                                                    >()
                                                    for (const r of conc) {
                                                      const key = normalizeLinkKey(r.cpf, r.nome)
                                                      const arr = byKey.get(key)
                                                      if (arr) arr.push(r)
                                                      else byKey.set(key, [r])
                                                    }
                                                    const groups = Array.from(byKey.entries()).map(
                                                      ([key, items]) => ({
                                                        key,
                                                        items,
                                                        cpf: items[0]?.cpf ?? '',
                                                        nome: items[0]?.nome ?? '',
                                                      }),
                                                    )
                                                    const groupedConc = groups
                                                      .filter((g) => g.items.length > 1 && eligibleGroupKeys.has(g.key))
                                                      .sort((a, b) =>
                                                        normalizeSortNome(a.items[0]?.nome ?? '').localeCompare(
                                                          normalizeSortNome(b.items[0]?.nome ?? ''),
                                                          'pt-BR',
                                                        ),
                                                      )
                                                    const groupedKeys = new Set(groupedConc.map((g) => g.key))
                                                    const concSingle = conc
                                                      .filter((r) => !groupedKeys.has(normalizeLinkKey(r.cpf, r.nome)))
                                                      .sort((a, b) =>
                                                        normalizeSortNome(a.nome ?? '').localeCompare(
                                                          normalizeSortNome(b.nome ?? ''),
                                                          'pt-BR',
                                                        ),
                                                      )
                                                    const pendSorted = [...pend].sort((a, b) =>
                                                      normalizeSortNome(a.nome ?? '').localeCompare(
                                                        normalizeSortNome(b.nome ?? ''),
                                                        'pt-BR',
                                                      ),
                                                    )

                                                    const renderItemRow = (
                                                      r: (typeof withIndex)[number],
                                                      opts?: {
                                                        indented?: boolean
                                                        groupBorderActive?: boolean
                                                        groupBorderLast?: boolean
                                                      },
                                                    ) => (
                                                      <tr
                                                        key={`${r.cpf}-${r.value}-${r.__idx}`}
                                                        data-side="recurso"
                                                        data-pair-id={r.pairId ?? ''}
                                                        data-status={r.status}
                                                        data-person-key={normalizeLinkKey(r.cpf, r.nome)}
                                                        ref={(el) => {
                                                          conciliacaoExtratoRowRefs.current[r.__idx] = el
                                                        }}
                                                        onClick={() => {
                                                          setConciliacaoSelectedPersonKey(null)
                                                          setConciliacaoSelectedPairId(r.pairId ? r.pairId : null)
                                                        }}
                                                        style={{
                                                          cursor: r.pairId ? 'pointer' : 'default',
                                                          background:
                                                            r.pairId && r.pairId === linkedPairId
                                                              ? 'rgba(0,174,157,0.10)'
                                                              : undefined,
                                                        }}
                                                      >
                                                        <td
                                                          onClick={(e) => {
                                                            if (r.status !== 'pendencia') return
                                                            const rowLocked = isVencimentoLocked(r.vencimento)
                                                            if (rowLocked) return
                                                            e.stopPropagation()
                                                            setCloneSisbrError(null)
                                                            setCloneSisbrAction('clonar_para_relatorio_sisbr')
                                                            setCloneSisbrJustification('')
                                                            setCloneSisbrModal({
                                                              cpf: r.cpf,
                                                              nome: r.nome,
                                                              value: r.value,
                                                              vencimento: r.vencimento ?? null,
                                                            })
                                                          }}
                                                          style={{
                                                            padding: opts?.indented ? '8px 10px 8px 28px' : '8px 10px',
                                                            borderBottom: opts?.groupBorderLast
                                                              ? groupBorder
                                                              : '1px solid rgba(255,255,255,0.08)',
                                                            borderLeft: opts?.groupBorderActive ? groupBorder : undefined,
                                                            color: 'rgba(255,255,255,0.78)',
                                                            maxWidth: 340,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            cursor:
                                                              r.status === 'pendencia' && !isVencimentoLocked(r.vencimento)
                                                                ? 'pointer'
                                                                : r.status === 'pendencia' && isVencimentoLocked(r.vencimento)
                                                                  ? 'not-allowed'
                                                                  : undefined,
                                                            textDecoration:
                                                              r.status === 'pendencia' && !isVencimentoLocked(r.vencimento)
                                                                ? 'underline'
                                                                : undefined,
                                                            opacity:
                                                              r.status === 'pendencia' && isVencimentoLocked(r.vencimento)
                                                                ? 0.55
                                                                : opts?.indented
                                                                  ? 0.92
                                                                  : undefined,
                                                          }}
                                                          title={r.nome}
                                                        >
                                                          {r.nome || '-'}
                                                        </td>
                                                        <td
                                                          style={{
                                                            padding: '8px 10px',
                                                            borderBottom: opts?.groupBorderLast
                                                              ? groupBorder
                                                              : '1px solid rgba(255,255,255,0.08)',
                                                            whiteSpace: 'nowrap',
                                                            fontWeight: 750,
                                                            opacity: opts?.indented ? 0.92 : undefined,
                                                          }}
                                                        >
                                                          {r.cpf}
                                                        </td>
                                                        <td
                                                          style={{
                                                            padding: '8px 10px',
                                                            borderBottom: opts?.groupBorderLast
                                                              ? groupBorder
                                                              : '1px solid rgba(255,255,255,0.08)',
                                                            borderRight: opts?.groupBorderActive ? groupBorder : undefined,
                                                            whiteSpace: 'nowrap',
                                                            textAlign: 'right',
                                                            fontWeight: 900,
                                                            color:
                                                              r.status === 'conciliado'
                                                                ? 'rgba(0,174,157,0.98)'
                                                                : 'rgba(245,197,66,0.98)',
                                                            opacity: opts?.indented ? 0.92 : undefined,
                                                          }}
                                                        >
                                                          {withCurrency(r.value)}
                                                        </td>
                                                      </tr>
                                                    )

                                                    const rendered: Array<ReactElement> = []

                                                    for (const g of groupedConc) {
                                                      const cpf = g.cpf
                                                      const nome = g.nome
                                                      const groupOpenKey = `recurso|${g.key}`
                                                      const isOpen = conciliacaoGroupedOpenKeys.includes(groupOpenKey)
                                                      const totalCents = g.items.reduce(
                                                        (acc, it) => acc + ptBrMoneyToCents(it.value),
                                                        0,
                                                      )
                                                      rendered.push(
                                                        <tr
                                                          key={`group-${groupOpenKey}`}
                                                          data-side="recurso"
                                                          data-status="group"
                                                          data-group-key={g.key}
                                                          style={{
                                                            background: 'rgba(255,255,255,0.03)',
                                                            cursor: 'pointer',
                                                          }}
                                                          onClick={(e) => {
                                                            e.stopPropagation()
                                                            if (!isOpen) {
                                                              setConciliacaoSelectedPersonKey(g.key)
                                                              setConciliacaoSelectedPairId(null)
                                                              setConciliacaoGroupedOpenKeys([groupOpenKey])
                                                              return
                                                            }
                                                            setConciliacaoGroupedOpenKeys([])
                                                            setConciliacaoSelectedPersonKey(null)
                                                            setConciliacaoSelectedPairId(null)
                                                          }}
                                                        >
                                                          <td
                                                            style={{
                                                              padding: '8px 10px',
                                                              borderBottom:
                                                                '1px solid rgba(255,255,255,0.08)',
                                                              borderTop: isOpen ? groupBorder : undefined,
                                                              borderLeft: isOpen ? groupBorder : undefined,
                                                              color: 'rgba(255,255,255,0.86)',
                                                              fontWeight: 850,
                                                              maxWidth: 340,
                                                              overflow: 'hidden',
                                                              textOverflow: 'ellipsis',
                                                              whiteSpace: 'nowrap',
                                                            }}
                                                            title={nome}
                                                          >
                                                            <span style={{ display: 'inline-flex', gap: 8 }}>
                                                              <span style={{ opacity: 0.9 }}>
                                                                {isOpen ? '▾' : '▸'}
                                                              </span>
                                                              <span style={{ minWidth: 0 }}>
                                                                {nome || '-'}
                                                              </span>
                                                            </span>
                                                          </td>
                                                          <td
                                                            style={{
                                                              padding: '8px 10px',
                                                              borderBottom:
                                                                '1px solid rgba(255,255,255,0.08)',
                                                              borderTop: isOpen ? groupBorder : undefined,
                                                              whiteSpace: 'nowrap',
                                                              fontWeight: 750,
                                                              color: 'rgba(255,255,255,0.82)',
                                                            }}
                                                          >
                                                            {cpf}
                                                          </td>
                                                          <td
                                                            style={{
                                                              padding: '8px 10px',
                                                              borderBottom:
                                                                '1px solid rgba(255,255,255,0.08)',
                                                              borderTop: isOpen ? groupBorder : undefined,
                                                              borderRight: isOpen ? groupBorder : undefined,
                                                              whiteSpace: 'nowrap',
                                                              textAlign: 'right',
                                                              fontWeight: 900,
                                                              color: 'rgba(0,174,157,0.98)',
                                                            }}
                                                          >
                                                            {withCurrency(centsToPtBr(totalCents))}{' '}
                                                            <span style={{ opacity: 0.78, fontWeight: 800 }}>
                                                              ({g.items.length})
                                                            </span>
                                                          </td>
                                                        </tr>,
                                                      )
                                                      if (isOpen) {
                                                        for (let i = 0; i < g.items.length; i++) {
                                                          const it = g.items[i]
                                                          rendered.push(
                                                            renderItemRow(it, {
                                                              indented: true,
                                                              groupBorderActive: true,
                                                              groupBorderLast: i === g.items.length - 1,
                                                            }),
                                                          )
                                                        }
                                                      }
                                                    }

                                                    for (const r of concSingle) {
                                                      rendered.push(renderItemRow(r))
                                                    }

                                                    for (const r of pendSorted) {
                                                      rendered.push(renderItemRow(r))
                                                    }

                                                    return rendered
                                                  })()}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>

                                          <div>
                                            <div data-evidence-title="relatorio" style={{ fontWeight: 850, marginBottom: 8 }}>
                                              Relatório SISBR
                                            </div>
                                            <div
                                              style={{
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                borderRadius: 12,
                                                overflow: 'hidden',
                                              }}
                                            >
                                              <table
                                                style={{
                                                  width: '100%',
                                                  borderCollapse: 'collapse',
                                                  tableLayout: 'fixed',
                                                }}
                                              >
                                                <colgroup>
                                                  <col style={{ width: '40%' }} />
                                                  <col style={{ width: '18%' }} />
                                                  <col style={{ width: '18%' }} />
                                                  <col style={{ width: '12%' }} />
                                                  <col style={{ width: '12%' }} />
                                                </colgroup>
                                                <thead>
                                                  <tr>
                                                    {[
                                                      'Nome',
                                                      'CPF',
                                                      'Valor Parcela',
                                                      'Vencimento',
                                                      'Modalidade',
                                                    ].map((h) => (
                                                      <th
                                                        key={h}
                                                        style={{
                                                          textAlign: 'left',
                                                          padding: '8px 10px',
                                                          fontSize: '0.66rem',
                                                          letterSpacing: '0.06em',
                                                          textTransform: 'uppercase',
                                                          color: 'rgba(255,255,255,0.62)',
                                                          borderBottom: '1px solid rgba(255,255,255,0.12)',
                                                          whiteSpace: 'normal',
                                                          lineHeight: 1.15,
                                                          overflowWrap: 'anywhere',
                                                          wordBreak: 'break-word',
                                                        }}
                                                      >
                                                        {h}
                                                      </th>
                                                    ))}
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {(() => {
                                                    const withIndex = relatorioRowsByVencimento
                                                      .slice(0, 300)
                                                      .map((r, idx) => ({ ...r, __idx: idx }))
                                                    const conc = withIndex.filter((r) => r.status === 'conciliado')
                                                    const pend = withIndex.filter((r) => r.status !== 'conciliado')
                                                    const groupBorder = '2px solid rgba(255,140,0,0.85)'

                                                    const byKey = new Map<
                                                      string,
                                                      Array<(typeof withIndex)[number]>
                                                    >()
                                                    for (const r of conc) {
                                                      const key = normalizeLinkKey(r.cpf, r.nome)
                                                      const arr = byKey.get(key)
                                                      if (arr) arr.push(r)
                                                      else byKey.set(key, [r])
                                                    }
                                                    const groups = Array.from(byKey.entries()).map(
                                                      ([key, items]) => ({
                                                        key,
                                                        items,
                                                        cpf: items[0]?.cpf ?? '',
                                                        nome: items[0]?.nome ?? '',
                                                      }),
                                                    )
                                                    const groupedConc = groups
                                                      .filter((g) => g.items.length > 1 && eligibleGroupKeys.has(g.key))
                                                      .sort((a, b) =>
                                                        normalizeSortNome(a.items[0]?.nome ?? '').localeCompare(
                                                          normalizeSortNome(b.items[0]?.nome ?? ''),
                                                          'pt-BR',
                                                        ),
                                                      )
                                                    const groupedKeys = new Set(groupedConc.map((g) => g.key))
                                                    const concSingle = conc
                                                      .filter((r) => !groupedKeys.has(normalizeLinkKey(r.cpf, r.nome)))
                                                      .sort((a, b) =>
                                                        normalizeSortNome(a.nome ?? '').localeCompare(
                                                          normalizeSortNome(b.nome ?? ''),
                                                          'pt-BR',
                                                        ),
                                                      )
                                                    const pendSorted = [...pend].sort((a, b) =>
                                                      normalizeSortNome(a.nome ?? '').localeCompare(
                                                        normalizeSortNome(b.nome ?? ''),
                                                        'pt-BR',
                                                      ),
                                                    )

                                                    const renderItemRow = (
                                                      r: (typeof withIndex)[number],
                                                      opts?: {
                                                        indented?: boolean
                                                        groupBorderActive?: boolean
                                                        groupBorderLast?: boolean
                                                      },
                                                    ) => (
                                                      <tr
                                                        key={`${r.cpf}-${r.value}-${r.__idx}`}
                                                        data-side="relatorio"
                                                        data-pair-id={r.pairId ?? ''}
                                                        data-status={r.status}
                                                        data-person-key={normalizeLinkKey(r.cpf, r.nome)}
                                                        ref={(el) => {
                                                          conciliacaoRelatorioRowRefs.current[r.__idx] = el
                                                        }}
                                                        onClick={() => {
                                                          setConciliacaoSelectedPersonKey(null)
                                                          setConciliacaoSelectedPairId(r.pairId ? r.pairId : null)
                                                        }}
                                                        style={{
                                                          cursor: r.pairId ? 'pointer' : 'default',
                                                          background:
                                                            r.pairId && r.pairId === linkedPairId
                                                              ? 'rgba(0,174,157,0.10)'
                                                              : undefined,
                                                        }}
                                                      >
                                                        <td
                                                          style={{
                                                            padding: opts?.indented ? '8px 10px 8px 28px' : '8px 10px',
                                                            borderBottom: opts?.groupBorderLast
                                                              ? groupBorder
                                                              : '1px solid rgba(255,255,255,0.08)',
                                                            borderLeft: opts?.groupBorderActive ? groupBorder : undefined,
                                                            color: 'rgba(255,255,255,0.78)',
                                                            maxWidth: 320,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            opacity: opts?.indented ? 0.92 : undefined,
                                                          }}
                                                          title={r.nome}
                                                        >
                                                          <span
                                                            style={{
                                                              display: 'inline-flex',
                                                              alignItems: 'center',
                                                              gap: 8,
                                                              minWidth: 0,
                                                            }}
                                                          >
                                                            <span
                                                              style={{
                                                                minWidth: 0,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                cursor:
                                                                  (r.status === 'pendencia' || r.status === 'conciliado') &&
                                                                  !isVencimentoLocked(r.vencimento)
                                                                    ? 'pointer'
                                                                    : (r.status === 'pendencia' ||
                                                                          r.status === 'conciliado') &&
                                                                        isVencimentoLocked(r.vencimento)
                                                                      ? 'not-allowed'
                                                                      : undefined,
                                                                textDecoration:
                                                                  r.status === 'pendencia' && !isVencimentoLocked(r.vencimento)
                                                                    ? 'underline'
                                                                    : undefined,
                                                                opacity:
                                                                  (r.status === 'pendencia' || r.status === 'conciliado') &&
                                                                  isVencimentoLocked(r.vencimento)
                                                                    ? 0.55
                                                                    : undefined,
                                                              }}
                                                              onClick={(e) => {
                                                                if (isVencimentoLocked(r.vencimento)) return
                                                                e.stopPropagation()
                                                                if (!conciliacaoMonth || !conciliacaoOrgao) return
                                                                setRelatorioOcorrenciaError(null)
                                                                setRelatorioOcorrenciaAction(
                                                                  'alterar_orgao_relatorio_sisbr',
                                                                )
                                                                setRelatorioOcorrenciaToOrgao(conciliacaoOrgao)
                                                                setRelatorioOcorrenciaJustification('')
                                                                setRelatorioOcorrenciaUndoJustification('')
                                                                setRelatorioLiquidacaoForaVencimentoDate('')
                                                                setRelatorioRepactuacaoStatus('pendente_gerente')
                                                                setRelatorioRepactuacaoGerenteEmail('')
                                                                setOcorrenciaModal({
                                                                  nome: r.nome,
                                                                  cpf: r.cpf,
                                                                  value: r.value,
                                                                  vencimento: r.vencimento ?? null,
                                                                  empresa: r.empresa ?? null,
                                                                  status: r.status === 'conciliado' ? 'conciliado' : 'pendencia',
                                                                  ocorrencia: r.ocorrencia ?? null,
                                                                  ocorrencias: Array.isArray((r as any).ocorrencias)
                                                                    ? ((r as any).ocorrencias as any[])
                                                                    : r.ocorrencia
                                                                      ? [r.ocorrencia]
                                                                      : [],
                                                                  repactuacoes: Array.isArray((r as any).repactuacoes)
                                                                    ? ((r as any).repactuacoes as any[])
                                                                    : [],
                                                                  readOnly: isVencimentoLocked(r.vencimento),
                                                                })
                                                              }}
                                                            >
                                                              {r.nome || '-'}
                                                            </span>
                                                            {r.ocorrencia ? (
                                                              <button
                                                                type="button"
                                                                className="btn btn-ghost"
                                                                style={{
                                                                  padding: 0,
                                                                  width: 20,
                                                                  height: 20,
                                                                  display: 'inline-flex',
                                                                  alignItems: 'center',
                                                                  justifyContent: 'center',
                                                                  opacity: 0.65,
                                                                  flex: '0 0 auto',
                                                                }}
                                                                title="Ocorrência"
                                                                onClick={(e) => {
                                                                  e.stopPropagation()
                                                                  if (!conciliacaoMonth || !conciliacaoOrgao) return
                                                                  const readOnly = isVencimentoLocked(r.vencimento)
                                                                  if (!readOnly) {
                                                                    setRelatorioOcorrenciaError(null)
                                                                    setRelatorioOcorrenciaAction(
                                                                      'alterar_orgao_relatorio_sisbr',
                                                                    )
                                                                    setRelatorioOcorrenciaToOrgao(conciliacaoOrgao)
                                                                    setRelatorioOcorrenciaJustification('')
                                                                    setRelatorioOcorrenciaUndoJustification('')
                                                                    setRelatorioLiquidacaoForaVencimentoDate('')
                                                                    setRelatorioRepactuacaoStatus('pendente_gerente')
                                                                    setRelatorioRepactuacaoGerenteEmail('')
                                                                  }
                                                                  setOcorrenciaModal({
                                                                    nome: r.nome,
                                                                    cpf: r.cpf,
                                                                    value: r.value,
                                                                    vencimento: r.vencimento ?? null,
                                                                    empresa: r.empresa ?? null,
                                                                    status: r.status === 'conciliado' ? 'conciliado' : 'pendencia',
                                                                    ocorrencia: r.ocorrencia ?? null,
                                                                    ocorrencias: Array.isArray((r as any).ocorrencias)
                                                                      ? ((r as any).ocorrencias as any[])
                                                                      : r.ocorrencia
                                                                        ? [r.ocorrencia]
                                                                        : [],
                                                                    repactuacoes: Array.isArray((r as any).repactuacoes)
                                                                      ? ((r as any).repactuacoes as any[])
                                                                      : [],
                                                                    readOnly,
                                                                  })
                                                                }}
                                                              >
                                                                <Info size={14} />
                                                              </button>
                                                            ) : null}
                                                          </span>
                                                        </td>
                                                        <td
                                                          style={{
                                                            padding: '8px 10px',
                                                            borderBottom: opts?.groupBorderLast
                                                              ? groupBorder
                                                              : '1px solid rgba(255,255,255,0.08)',
                                                            whiteSpace: 'nowrap',
                                                            fontWeight: 750,
                                                            opacity: opts?.indented ? 0.92 : undefined,
                                                          }}
                                                        >
                                                          {r.cpf}
                                                        </td>
                                                        <td
                                                          style={{
                                                            padding: '8px 10px',
                                                            borderBottom: opts?.groupBorderLast
                                                              ? groupBorder
                                                              : '1px solid rgba(255,255,255,0.08)',
                                                            whiteSpace: 'nowrap',
                                                            textAlign: 'right',
                                                            fontWeight: 900,
                                                            color:
                                                              r.status === 'conciliado'
                                                                ? 'rgba(0,174,157,0.98)'
                                                                : 'rgba(245,197,66,0.98)',
                                                            opacity: opts?.indented ? 0.92 : undefined,
                                                          }}
                                                        >
                                                          {withCurrency(r.value)}
                                                        </td>
                                                        <td
                                                          style={{
                                                            padding: '8px 10px',
                                                            borderBottom: opts?.groupBorderLast
                                                              ? groupBorder
                                                              : '1px solid rgba(255,255,255,0.08)',
                                                            color: 'rgba(255,255,255,0.78)',
                                                            whiteSpace: 'nowrap',
                                                            opacity: opts?.indented ? 0.92 : undefined,
                                                          }}
                                                        >
                                                          {r.vencimento ?? '-'}
                                                        </td>
                                                        <td
                                                          style={{
                                                            padding: '8px 10px',
                                                            borderBottom: opts?.groupBorderLast
                                                              ? groupBorder
                                                              : '1px solid rgba(255,255,255,0.08)',
                                                            borderRight: opts?.groupBorderActive ? groupBorder : undefined,
                                                            color: 'rgba(255,255,255,0.78)',
                                                            whiteSpace: 'nowrap',
                                                            opacity: opts?.indented ? 0.92 : undefined,
                                                          }}
                                                        >
                                                          {r.modalidade ?? '-'}
                                                        </td>
                                                      </tr>
                                                    )

                                                    const rendered: Array<ReactElement> = []

                                                    for (const g of groupedConc) {
                                                      const cpf = g.cpf
                                                      const nome = g.nome
                                                      const groupOpenKey = `relatorio|${g.key}`
                                                      const isOpen = conciliacaoGroupedOpenKeys.includes(groupOpenKey)
                                                      const hasOcorrencia = g.items.some((it) => Boolean(it.ocorrencia))
                                                      const totalCents = g.items.reduce(
                                                        (acc, it) => acc + ptBrMoneyToCents(it.value),
                                                        0,
                                                      )
                                                      rendered.push(
                                                        <tr
                                                          key={`group-${groupOpenKey}`}
                                                          data-side="relatorio"
                                                          data-status="group"
                                                          data-group-key={g.key}
                                                          style={{
                                                            background: 'rgba(255,255,255,0.03)',
                                                            cursor: 'pointer',
                                                          }}
                                                          onClick={(e) => {
                                                            e.stopPropagation()
                                                            if (!isOpen) {
                                                              setConciliacaoSelectedPersonKey(g.key)
                                                              setConciliacaoSelectedPairId(null)
                                                              setConciliacaoGroupedOpenKeys([groupOpenKey])
                                                              return
                                                            }
                                                            setConciliacaoGroupedOpenKeys([])
                                                            setConciliacaoSelectedPersonKey(null)
                                                            setConciliacaoSelectedPairId(null)
                                                          }}
                                                        >
                                                          <td
                                                            style={{
                                                              padding: '8px 10px',
                                                              borderBottom:
                                                                '1px solid rgba(255,255,255,0.08)',
                                                              borderTop: isOpen ? groupBorder : undefined,
                                                              borderLeft: isOpen ? groupBorder : undefined,
                                                              color: 'rgba(255,255,255,0.86)',
                                                              fontWeight: 850,
                                                              maxWidth: 320,
                                                              overflow: 'hidden',
                                                              textOverflow: 'ellipsis',
                                                              whiteSpace: 'nowrap',
                                                            }}
                                                            title={nome}
                                                          >
                                                            <span
                                                              style={{
                                                                display: 'inline-flex',
                                                                gap: 8,
                                                                alignItems: 'center',
                                                                minWidth: 0,
                                                              }}
                                                            >
                                                              <span style={{ opacity: 0.9 }}>
                                                                {isOpen ? '▾' : '▸'}
                                                              </span>
                                                              <span style={{ minWidth: 0 }}>
                                                                {nome || '-'}
                                                              </span>
                                                              {hasOcorrencia ? (
                                                                <span style={{ display: 'inline-flex', opacity: 0.6 }}>
                                                                  <Info size={13} />
                                                                </span>
                                                              ) : null}
                                                            </span>
                                                          </td>
                                                          <td
                                                            style={{
                                                              padding: '8px 10px',
                                                              borderBottom:
                                                                '1px solid rgba(255,255,255,0.08)',
                                                              borderTop: isOpen ? groupBorder : undefined,
                                                              whiteSpace: 'nowrap',
                                                              fontWeight: 750,
                                                              color: 'rgba(255,255,255,0.82)',
                                                            }}
                                                          >
                                                            {cpf}
                                                          </td>
                                                          <td
                                                            style={{
                                                              padding: '8px 10px',
                                                              borderBottom:
                                                                '1px solid rgba(255,255,255,0.08)',
                                                              borderTop: isOpen ? groupBorder : undefined,
                                                              whiteSpace: 'nowrap',
                                                              textAlign: 'right',
                                                              fontWeight: 900,
                                                              color: 'rgba(0,174,157,0.98)',
                                                            }}
                                                          >
                                                            {withCurrency(centsToPtBr(totalCents))}{' '}
                                                            <span style={{ opacity: 0.78, fontWeight: 800 }}>
                                                              ({g.items.length})
                                                            </span>
                                                          </td>
                                                          <td
                                                            style={{
                                                              padding: '8px 10px',
                                                              borderBottom:
                                                                '1px solid rgba(255,255,255,0.08)',
                                                              borderTop: isOpen ? groupBorder : undefined,
                                                              color: 'rgba(255,255,255,0.60)',
                                                              whiteSpace: 'nowrap',
                                                            }}
                                                          >
                                                            -
                                                          </td>
                                                          <td
                                                            style={{
                                                              padding: '8px 10px',
                                                              borderBottom:
                                                                '1px solid rgba(255,255,255,0.08)',
                                                              borderTop: isOpen ? groupBorder : undefined,
                                                              borderRight: isOpen ? groupBorder : undefined,
                                                              color: 'rgba(255,255,255,0.60)',
                                                              whiteSpace: 'nowrap',
                                                            }}
                                                          >
                                                            -
                                                          </td>
                                                        </tr>,
                                                      )
                                                      if (isOpen) {
                                                        for (let i = 0; i < g.items.length; i++) {
                                                          const it = g.items[i]
                                                          rendered.push(
                                                            renderItemRow(it, {
                                                              indented: true,
                                                              groupBorderActive: true,
                                                              groupBorderLast: i === g.items.length - 1,
                                                            }),
                                                          )
                                                        }
                                                      }
                                                    }

                                                    for (const r of concSingle) {
                                                      rendered.push(renderItemRow(r))
                                                    }

                                                    for (const r of pendSorted) {
                                                      rendered.push(renderItemRow(r))
                                                    }

                                                    return rendered
                                                  })()}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : null}
                                </Fragment>
                              )
                            })()}
                          </tbody>
                        </table>
                      </div>

                      <div className="help" style={{ marginTop: 10 }}>
                        Verde = conciliado (CPF + valor igual). Amarelo = divergente ou ausente em um dos lados.
                      </div>

                      {cloneSisbrModal
                        ? typeof document !== 'undefined'
                          ? createPortal(
                              <div
                                role="dialog"
                                aria-modal="true"
                                style={{
                                  position: 'fixed',
                                  inset: 0,
                                  background: 'rgba(0,0,0,0.62)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 16,
                                  zIndex: 220,
                                }}
                                onClick={() => {
                                  if (cloneSisbrLoading) return
                                  setCloneSisbrModal(null)
                                  setCloneSisbrError(null)
                                }}
                              >
                                <div
                                  style={{
                                    width: 'min(760px, 96vw)',
                                    borderRadius: 18,
                                    border: '1px solid rgba(255,255,255,0.16)',
                                    background: 'rgba(12, 22, 40, 0.96)',
                                    color: 'rgba(255,255,255,0.92)',
                                    boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
                                    overflow: 'hidden',
                                    maxHeight: '86vh',
                                    display: 'flex',
                                    flexDirection: 'column',
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                            <div
                              style={{
                                padding: '14px 16px',
                                borderBottom: '1px solid rgba(255,255,255,0.10)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                              }}
                            >
                              <div style={{ fontWeight: 900 }}>Ocorrência</div>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => {
                                  if (cloneSisbrLoading) return
                                  setCloneSisbrModal(null)
                                  setCloneSisbrError(null)
                                }}
                              >
                                Fechar
                              </button>
                            </div>
                            <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                              <div style={{ display: 'grid', gap: 6 }}>
                                <div style={{ fontWeight: 850 }}>
                                  {cloneSisbrModal.nome || '-'}
                                </div>
                                <div style={{ opacity: 0.82 }}>
                                  CPF: {cloneSisbrModal.cpf} • Valor: {withCurrency(cloneSisbrModal.value)}
                                </div>
                              </div>

                              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                                <div className="field">
                                  <label>Ação</label>
                                  <CloneSisbrActionSelect
                                    value={cloneSisbrAction}
                                    onChange={setCloneSisbrAction}
                                    disabled={cloneSisbrLoading}
                                  />
                                </div>
                                {cloneSisbrAction === 'clonar_para_relatorio_sisbr' ? (
                                  <div
                                    style={{
                                      padding: '10px 12px',
                                      borderRadius: 12,
                                      border: '1px solid rgba(255,255,255,0.12)',
                                      background: 'rgba(255,255,255,0.04)',
                                      display: 'grid',
                                      gap: 8,
                                    }}
                                  >
                                    <div style={{ fontWeight: 850 }}>Transferência (Relatório SISBR)</div>
                                    <div style={{ opacity: 0.86 }}>
                                      <span style={{ fontWeight: 750 }}>Origem:</span>{' '}
                                      {cloneSisbrContext?.sourceEmpresas &&
                                      cloneSisbrContext.sourceEmpresas.length > 0
                                        ? cloneSisbrContext.sourceEmpresas.join(' | ')
                                        : '(Não encontrado no Relatório SISBR)'}
                                    </div>
                                    <div style={{ opacity: 0.86 }}>
                                      <span style={{ fontWeight: 750 }}>Destino:</span>{' '}
                                      {cloneSisbrContext?.targetEmpresa
                                        ? cloneSisbrContext.targetEmpresa
                                        : '(De/Para não configurado)'}
                                    </div>
                                    {cloneSisbrContext ? (
                                      <div style={{ opacity: 0.72, fontSize: '0.9rem' }}>
                                        Encontrados: {cloneSisbrContext.totalMatches} • Serão ajustados:{' '}
                                        {cloneSisbrContext.willUpdateCount}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                                {cloneSisbrAction === 'quitado_recurso' ? (
                                  <div
                                    style={{
                                      padding: '10px 12px',
                                      borderRadius: 12,
                                      border: '1px solid rgba(255,255,255,0.12)',
                                      background: 'rgba(255,255,255,0.04)',
                                      display: 'grid',
                                      gap: 10,
                                    }}
                                  >
                                    <div style={{ fontWeight: 850 }}>Quitado (Recurso do Órgão)</div>
                                    <div style={{ opacity: 0.86 }}>
                                      Esta ação remove a linha do Recurso do Órgão para não compor a conciliação.
                                    </div>
                                    <div className="field">
                                      <label>Data de devolução (dd/mm/aaaa)</label>
                                      <input
                                        className="control"
                                        type="text"
                                        value={cloneSisbrDevolucaoDate}
                                        onChange={(e) => {
                                          const raw = e.target.value || ''
                                          const next = raw
                                            .replace(/[^\d/]/g, '')
                                            .replace(/\/{2,}/g, '/')
                                            .slice(0, 10)
                                          setCloneSisbrDevolucaoDate(next)
                                        }}
                                        disabled={cloneSisbrLoading}
                                        placeholder="dd/mm/aaaa"
                                      />
                                    </div>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                      <div className="field">
                                        <label>Nome</label>
                                        <input
                                          className="control"
                                          type="text"
                                          value={cloneSisbrModal.nome || '-'}
                                          disabled
                                        />
                                      </div>
                                      <div className="field">
                                        <label>Valor</label>
                                        <input
                                          className="control"
                                          type="text"
                                          value={withCurrency(cloneSisbrModal.value)}
                                          disabled
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                                <div className="field">
                                  <label>
                                    {cloneSisbrAction === 'quitado_recurso'
                                      ? 'Justificativa (opcional)'
                                      : 'Justificativa (obrigatória)'}
                                  </label>
                                  <textarea
                                    className="control"
                                    rows={4}
                                    value={cloneSisbrJustification}
                                    onChange={(e) => setCloneSisbrJustification(e.target.value)}
                                    disabled={cloneSisbrLoading}
                                    placeholder="Descreva o motivo da ação..."
                                  />
                                </div>
                              </div>

                              {cloneSisbrError ? (
                                <div className="help" style={{ marginTop: 10, color: 'rgba(245,197,66,0.98)' }}>
                                  {cloneSisbrError}
                                </div>
                              ) : null}

                              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  disabled={
                                    cloneSisbrLoading ||
                                    (cloneSisbrAction === 'quitado_recurso' &&
                                      !/^\d{2}\/\d{2}\/\d{4}$/.test(cloneSisbrDevolucaoDate)) ||
                                    (cloneSisbrAction !== 'quitado_recurso' &&
                                      !cloneSisbrJustification.trim()) ||
                                    (cloneSisbrModal?.vencimento
                                      ? isVencimentoLocked(cloneSisbrModal.vencimento)
                                      : conciliacaoIsClosed)
                                  }
                                  onClick={async () => {
                                    if (!cloneSisbrModal) return
                                    if (!conciliacaoOrgao.trim()) return
                                    setCloneSisbrLoading(true)
                                    setCloneSisbrError(null)
                                    try {
                                      const res = await fetch(
                                        '/api/consignado/conciliacao/recurso-vs-relatorio/clonar-para-sisbr',
                                        {
                                          method: 'POST',
                                          headers: { 'content-type': 'application/json' },
                                          body: JSON.stringify({
                                            month: conciliacaoMonth,
                                            orgao: conciliacaoOrgao.trim(),
                                            cpf: cloneSisbrModal.cpf,
                                            nome: cloneSisbrModal.nome,
                                            value: cloneSisbrModal.value,
                                            recursoTable: conciliacaoData?.recursoTable,
                                            action: cloneSisbrAction,
                                            justification: cloneSisbrJustification,
                                            devolucaoDate:
                                              cloneSisbrAction === 'quitado_recurso' ? cloneSisbrDevolucaoDate : null,
                                          }),
                                        },
                                      )
                                      const data = (await res.json().catch(() => null)) as null | {
                                        message?: string
                                      }
                                      if (!res.ok) {
                                        throw new Error(
                                          data?.message || `Falha ao clonar (HTTP ${res.status}).`,
                                        )
                                      }
                                      await reloadConciliacaoKeepExpanded()
                                      setCloneSisbrModal(null)
                                    } catch (e) {
                                      const msg =
                                        e instanceof Error ? e.message : 'Falha ao clonar.'
                                      setCloneSisbrError(msg)
                                    } finally {
                                      setCloneSisbrLoading(false)
                                    }
                                  }}
                                >
                                  {cloneSisbrLoading
                                    ? cloneSisbrAction === 'quitado_recurso'
                                      ? 'Salvando...'
                                      : 'Clonando...'
                                    : cloneSisbrAction === 'quitado_recurso'
                                      ? 'Marcar como Quitado'
                                      : 'Clonar para Relatorio Sisbr'}
                                </button>
                              </div>
                            </div>
                          </div>
                              </div>,
                              document.body,
                            )
                          : null
                        : null}

                      {tarifaModalOpen ? (
                        <div
                          role="dialog"
                          aria-modal="true"
                          style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.62)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 16,
                            zIndex: 230,
                          }}
                          onClick={() => {
                            if (tarifaSaving) return
                            setTarifaModalOpen(false)
                            setTarifaError(null)
                          }}
                        >
                          <div
                            style={{
                              width: 'min(620px, 96vw)',
                              borderRadius: 18,
                              border: '1px solid rgba(255,255,255,0.16)',
                              background: 'rgba(12, 22, 40, 0.96)',
                              color: 'rgba(255,255,255,0.92)',
                              boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
                              overflow: 'hidden',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div
                              style={{
                                padding: '14px 16px',
                                borderBottom: '1px solid rgba(255,255,255,0.10)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                              }}
                            >
                              <div style={{ fontWeight: 900 }}>Tarifa</div>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => {
                                  if (tarifaSaving) return
                                  setTarifaModalOpen(false)
                                  setTarifaError(null)
                                }}
                              >
                                Fechar
                              </button>
                            </div>
                            <div style={{ padding: '14px 16px' }}>
                              <div className="field">
                                <label>Tipo de tarifa</label>
                                <select
                                  className="control"
                                  value={tarifaTypeDraft}
                                  onChange={(e) =>
                                    setTarifaTypeDraft(
                                      e.target.value === 'ted' ? 'ted' : 'linha',
                                    )
                                  }
                                  disabled={tarifaSaving}
                                  style={{
                                    background: 'rgba(255,255,255,0.06)',
                                    color: 'rgba(255,255,255,0.92)',
                                    border: '1px solid rgba(255,255,255,0.16)',
                                  }}
                                >
                                  <option
                                    value="linha"
                                    style={{ background: 'rgb(12, 22, 40)', color: 'rgba(255,255,255,0.92)' }}
                                  >
                                    Tarifa de Linha
                                  </option>
                                  <option
                                    value="ted"
                                    style={{ background: 'rgb(12, 22, 40)', color: 'rgba(255,255,255,0.92)' }}
                                  >
                                    Tarifa TED
                                  </option>
                                </select>
                              </div>
                              <div className="field">
                                <label>Valor da tarifa</label>
                                <input
                                  className="control"
                                  value={tarifaDraft}
                                  onChange={(e) => setTarifaDraft(e.target.value)}
                                  disabled={tarifaSaving}
                                  placeholder="Ex.: 12,34"
                                />
                              </div>

                              {tarifaError ? (
                                <div className="help" style={{ marginTop: 10, color: 'rgba(245,197,66,0.98)' }}>
                                  {tarifaError}
                                </div>
                              ) : null}

                              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  disabled={tarifaSaving || !tarifaDraft.trim()}
                                  onClick={async () => {
                                    if (!conciliacaoOrgao.trim()) return
                                    if (!conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)) return
                                    setTarifaSaving(true)
                                    setTarifaError(null)
                                    try {
                                      const res = await fetch(
                                        '/api/consignado/conciliacao/recurso-vs-relatorio/tarifa',
                                        {
                                          method: 'POST',
                                          headers: { 'content-type': 'application/json' },
                                          body: JSON.stringify({
                                            month: conciliacaoMonth,
                                            orgao: conciliacaoOrgao.trim(),
                                            type: tarifaTypeDraft,
                                            value: tarifaDraft,
                                          }),
                                        },
                                      )
                                      const data = (await res.json().catch(() => null)) as null | { message?: string }
                                      if (!res.ok) {
                                        throw new Error(
                                          data?.message || `Falha ao salvar tarifa (HTTP ${res.status}).`,
                                        )
                                      }
                                      await reloadConciliacaoKeepExpanded()
                                      setTarifaModalOpen(false)
                                      setTarifaDraft('')
                                    } catch (e) {
                                      const msg =
                                        e instanceof Error ? e.message : 'Falha ao salvar tarifa.'
                                      setTarifaError(msg)
                                    } finally {
                                      setTarifaSaving(false)
                                    }
                                  }}
                                >
                                  {tarifaSaving ? 'Salvando...' : 'Salvar tarifa'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {conciliacaoCloseModalOpen
                        ? createPortal(
                            <div
                              role="dialog"
                              aria-modal="true"
                              style={{
                                position: 'fixed',
                                inset: 0,
                                background: 'rgba(0,0,0,0.62)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 16,
                                zIndex: 230,
                              }}
                              onClick={() => {
                                if (conciliacaoClosing) return
                                setConciliacaoCloseModalOpen(false)
                                setConciliacaoCloseError(null)
                                setConciliacaoCloseMode('total')
                                setConciliacaoCloseVencimento('')
                                setConciliacaoCloseStep(1)
                              }}
                            >
                              <div
                                style={{
                                  width: 'min(720px, 96vw)',
                                  borderRadius: 18,
                                  border: '1px solid rgba(255,255,255,0.16)',
                                  background: 'rgba(12, 22, 40, 0.96)',
                                  color: 'rgba(255,255,255,0.92)',
                                  boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
                                  overflow: 'hidden',
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div
                                  style={{
                                    padding: '14px 16px',
                                    borderBottom: '1px solid rgba(255,255,255,0.10)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 10,
                                  }}
                                >
                                  <div style={{ fontWeight: 900 }}>Fechar conciliação</div>
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => {
                                      if (conciliacaoClosing) return
                                      setConciliacaoCloseModalOpen(false)
                                      setConciliacaoCloseError(null)
                                      setConciliacaoCloseMode('total')
                                      setConciliacaoCloseVencimento('')
                                      setConciliacaoCloseStep(1)
                                    }}
                                  >
                                    Fechar
                                  </button>
                                </div>
                                <div style={{ padding: '14px 16px' }}>
                                  <div style={{ display: 'grid', gap: 10 }}>
                                    <div style={{ fontWeight: 850 }}>
                                      {conciliacaoCloseStep === 1
                                        ? 'Foi feita a liquidação no SISBR?'
                                        : conciliacaoCloseStep === 2
                                          ? 'Tem certeza que deseja fechar a conciliação? Após fechar não será possível alterar esta conciliação.'
                                          : 'Ao fechar a conciliação, o relatório será enviado para a Contabilidade. Continuar?'}
                                    </div>
                                    <div style={{ opacity: 0.8 }}>
                                      Órgão: {conciliacaoOrgao.trim() || '—'} • Competência:{' '}
                                      {conciliacaoMonthOptions.find((o) => o.value === conciliacaoMonth)?.label ??
                                        conciliacaoMonth}
                                    </div>
                                    <div style={{ opacity: 0.75 }}>Etapa {conciliacaoCloseStep}/3</div>
                                  </div>

                                  <div
                                    style={{
                                      marginTop: 12,
                                      padding: '10px 12px',
                                      borderRadius: 12,
                                      border: '1px solid rgba(255,255,255,0.12)',
                                      background: 'rgba(255,255,255,0.03)',
                                    }}
                                  >
                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                      <label
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 10,
                                          cursor: conciliacaoClosing ? 'not-allowed' : 'pointer',
                                          opacity: conciliacaoClosing ? 0.6 : 1,
                                        }}
                                      >
                                        <input
                                          type="radio"
                                          name="conciliacao-close-mode"
                                          checked={conciliacaoCloseMode === 'total'}
                                          onChange={() => {
                                            if (conciliacaoClosing) return
                                            setConciliacaoCloseMode('total')
                                            setConciliacaoCloseVencimento('')
                                          }}
                                          disabled={conciliacaoClosing}
                                        />
                                        <span style={{ fontWeight: 850, opacity: 0.9 }}>
                                          Fechamento total
                                        </span>
                                      </label>
                                      <label
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 10,
                                          cursor:
                                            conciliacaoClosing || conciliacaoCloseVencimentoOptions.length === 0
                                              ? 'not-allowed'
                                              : 'pointer',
                                          opacity:
                                            conciliacaoClosing || conciliacaoCloseVencimentoOptions.length === 0
                                              ? 0.6
                                              : 1,
                                        }}
                                        title={
                                          conciliacaoCloseVencimentoOptions.length === 0
                                            ? 'Nenhum vencimento disponível para fechamento parcial.'
                                            : undefined
                                        }
                                      >
                                        <input
                                          type="radio"
                                          name="conciliacao-close-mode"
                                          checked={conciliacaoCloseMode === 'parcial'}
                                          onChange={() => {
                                            if (conciliacaoClosing) return
                                            if (conciliacaoCloseVencimentoOptions.length === 0) return
                                            setConciliacaoCloseMode('parcial')
                                          }}
                                          disabled={conciliacaoClosing || conciliacaoCloseVencimentoOptions.length === 0}
                                        />
                                        <span style={{ fontWeight: 850, opacity: 0.9 }}>
                                          Fechamento parcial
                                        </span>
                                      </label>
                                    </div>

                                    {conciliacaoCloseMode === 'parcial' ? (
                                      <div style={{ marginTop: 10 }}>
                                        <div style={{ fontSize: 12, opacity: 0.72, marginBottom: 6 }}>
                                          Selecione o vencimento para fechar
                                        </div>
                                        <select
                                          className="control month-select"
                                          value={conciliacaoCloseVencimento}
                                          onChange={(e) => setConciliacaoCloseVencimento(e.target.value)}
                                          disabled={conciliacaoClosing || conciliacaoCloseVencimentoOptions.length === 0}
                                          style={{ height: 44 }}
                                        >
                                          <option value="">Selecione...</option>
                                          {conciliacaoCloseVencimentoOptions.map((v) => (
                                            <option key={v} value={v}>
                                              {v}
                                            </option>
                                          ))}
                                        </select>
                                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                                          {conciliacaoCloseVencimentoOptions.length === 0
                                            ? 'Nenhum vencimento disponível para fechamento parcial.'
                                            : null}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>

                                  {conciliacaoCloseError ? (
                                    <div className="help" style={{ marginTop: 10, color: 'rgba(245,197,66,0.98)' }}>
                                      {conciliacaoCloseError}
                                    </div>
                                  ) : null}

                                  <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
                                    <button
                                      type="button"
                                      className="btn btn-ghost"
                                      disabled={conciliacaoClosing}
                                      onClick={() => {
                                        if (conciliacaoClosing) return
                                        if (conciliacaoCloseStep === 1) {
                                          setConciliacaoCloseModalOpen(false)
                                          setConciliacaoCloseError(null)
                                          setConciliacaoCloseMode('total')
                                          setConciliacaoCloseVencimento('')
                                          setConciliacaoCloseStep(1)
                                          return
                                        }
                                        setConciliacaoCloseError(null)
                                        setConciliacaoCloseStep((s) => (s === 3 ? 2 : 1))
                                      }}
                                    >
                                      {conciliacaoCloseStep === 1 ? 'Cancelar' : 'Voltar'}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-primary"
                                      disabled={
                                        conciliacaoClosing ||
                                        !conciliacaoOrgao.trim() ||
                                        !conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth) ||
                                        (conciliacaoCloseMode === 'parcial' && !conciliacaoCloseVencimento.trim())
                                      }
                                      onClick={async () => {
                                        if (!conciliacaoOrgao.trim()) return
                                        if (!conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)) return
                                        if (conciliacaoCloseMode === 'parcial' && !conciliacaoCloseVencimento.trim()) return

                                        if (conciliacaoCloseStep < 3) {
                                          setConciliacaoCloseError(null)
                                          setConciliacaoCloseStep((s) => (s === 1 ? 2 : 3))
                                          return
                                        }

                                        setConciliacaoError(null)
                                        setConciliacaoCloseError(null)
                                        setConciliacaoClosing(true)
                                        try {
                                          const evidencePngBase64 = await captureConciliacaoEvidencePngBase64()
                                          const res = await fetch(
                                            '/api/consignado/conciliacao/recurso-vs-relatorio/fechar',
                                            {
                                              method: 'POST',
                                              headers: { 'content-type': 'application/json' },
                                              body: JSON.stringify({
                                                month: conciliacaoMonth,
                                                orgao: conciliacaoOrgao.trim(),
                                                vencimento:
                                                  conciliacaoCloseMode === 'parcial'
                                                    ? conciliacaoCloseVencimento.trim()
                                                    : undefined,
                                                closedBy: accessFixedEmail,
                                                contabilidadeEmail: notificationEmailContabilidade,
                                                evidencePngBase64,
                                              }),
                                            },
                                          )
                                          const json = (await res.json().catch(() => null)) as null | {
                                            message?: string
                                          }
                                          if (!res.ok) {
                                            throw new Error(json?.message || 'Falha ao fechar conciliação.')
                                          }
                                          setConciliacaoCloseModalOpen(false)
                                          setConciliacaoCloseMode('total')
                                          setConciliacaoCloseVencimento('')
                                          setConciliacaoCloseStep(1)
                                          await reloadConciliacaoKeepExpanded()
                                        } catch (e) {
                                          const msg =
                                            e instanceof Error ? e.message : 'Falha ao fechar conciliação.'
                                          setConciliacaoCloseError(msg)
                                        } finally {
                                          setConciliacaoClosing(false)
                                        }
                                      }}
                                    >
                                      {conciliacaoClosing
                                        ? 'Fechando...'
                                        : conciliacaoCloseStep < 3
                                          ? 'Continuar'
                                          : 'Fechar conciliação'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>,
                            document.body,
                          )
                        : null}

                      {conciliacaoReopenModalOpen ? (
                        <div
                          role="dialog"
                          aria-modal="true"
                          style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.62)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 16,
                            zIndex: 230,
                          }}
                          onClick={() => {
                            if (conciliacaoReopening) return
                            setConciliacaoReopenModalOpen(false)
                            setConciliacaoReopenError(null)
                            setConciliacaoReopenMode('total')
                            setConciliacaoReopenVencimento('')
                            setConciliacaoReopenPassword('')
                          }}
                        >
                          <div
                            style={{
                              width: 'min(560px, 96vw)',
                              borderRadius: 18,
                              border: '1px solid rgba(255,255,255,0.16)',
                              background: 'rgba(12, 22, 40, 0.96)',
                              color: 'rgba(255,255,255,0.92)',
                              boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
                              overflow: 'hidden',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div
                              style={{
                                padding: '14px 16px',
                                borderBottom: '1px solid rgba(255,255,255,0.10)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                              }}
                            >
                              <div style={{ fontWeight: 900 }}>Reabrir conciliação</div>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => {
                                  if (conciliacaoReopening) return
                                  setConciliacaoReopenModalOpen(false)
                                  setConciliacaoReopenError(null)
                                  setConciliacaoReopenMode('total')
                                  setConciliacaoReopenVencimento('')
                                  setConciliacaoReopenPassword('')
                                }}
                              >
                                Fechar
                              </button>
                            </div>
                            <div style={{ padding: '14px 16px' }}>
                              <div
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: 12,
                                  border: '1px solid rgba(255,255,255,0.12)',
                                  background: 'rgba(255,255,255,0.03)',
                                  marginBottom: 12,
                                }}
                              >
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                  <label
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      cursor: conciliacaoReopening ? 'not-allowed' : 'pointer',
                                      opacity: conciliacaoReopening ? 0.6 : 1,
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name="conciliacao-reopen-mode"
                                      checked={conciliacaoReopenMode === 'total'}
                                      onChange={() => {
                                        if (conciliacaoReopening) return
                                        setConciliacaoReopenMode('total')
                                        setConciliacaoReopenVencimento('')
                                      }}
                                      disabled={conciliacaoReopening}
                                    />
                                    <span style={{ fontWeight: 850, opacity: 0.9 }}>Reabrir total</span>
                                  </label>
                                  <label
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      cursor:
                                        conciliacaoReopening ||
                                        conciliacaoTotalIsClosed ||
                                        conciliacaoReopenVencimentoOptions.length === 0
                                          ? 'not-allowed'
                                          : 'pointer',
                                      opacity:
                                        conciliacaoReopening ||
                                        conciliacaoTotalIsClosed ||
                                        conciliacaoReopenVencimentoOptions.length === 0
                                          ? 0.6
                                          : 1,
                                    }}
                                    title={
                                      conciliacaoTotalIsClosed
                                        ? 'A conciliação está fechada totalmente. Reabra o total para destravar os vencimentos.'
                                        : conciliacaoReopenVencimentoOptions.length === 0
                                          ? 'Nenhum vencimento fechado para reabrir.'
                                          : undefined
                                    }
                                  >
                                    <input
                                      type="radio"
                                      name="conciliacao-reopen-mode"
                                      checked={conciliacaoReopenMode === 'parcial'}
                                      onChange={() => {
                                        if (conciliacaoReopening) return
                                        if (conciliacaoTotalIsClosed) return
                                        if (conciliacaoReopenVencimentoOptions.length === 0) return
                                        setConciliacaoReopenMode('parcial')
                                      }}
                                      disabled={
                                        conciliacaoReopening ||
                                        conciliacaoTotalIsClosed ||
                                        conciliacaoReopenVencimentoOptions.length === 0
                                      }
                                    />
                                    <span style={{ fontWeight: 850, opacity: 0.9 }}>Reabrir parcial</span>
                                  </label>
                                </div>

                                {conciliacaoReopenMode === 'parcial' ? (
                                  <div style={{ marginTop: 10 }}>
                                    <div style={{ fontSize: 12, opacity: 0.72, marginBottom: 6 }}>
                                      Selecione o vencimento para reabrir
                                    </div>
                                    <select
                                      className="control month-select"
                                      value={conciliacaoReopenVencimento}
                                      onChange={(e) => setConciliacaoReopenVencimento(e.target.value)}
                                      disabled={
                                        conciliacaoReopening ||
                                        conciliacaoTotalIsClosed ||
                                        conciliacaoReopenVencimentoOptions.length === 0
                                      }
                                      style={{ height: 44 }}
                                    >
                                      <option value="">Selecione...</option>
                                      {conciliacaoReopenVencimentoOptions.map((v) => (
                                        <option key={v} value={v}>
                                          {v}
                                        </option>
                                      ))}
                                    </select>
                                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                                      {conciliacaoTotalIsClosed
                                        ? 'A conciliação está fechada totalmente. Reabra o total para destravar os vencimentos.'
                                        : conciliacaoReopenVencimentoOptions.length === 0
                                          ? 'Nenhum vencimento fechado para reabrir.'
                                          : null}
                                    </div>
                                  </div>
                                ) : null}
                              </div>

                              <div className="field">
                                <label>Senha</label>
                                <input
                                  className="control"
                                  type="password"
                                  value={conciliacaoReopenPassword}
                                  onChange={(e) => setConciliacaoReopenPassword(e.target.value)}
                                  disabled={conciliacaoReopening}
                                  placeholder="Informe a senha"
                                  autoFocus
                                />
                              </div>

                              {conciliacaoReopenError ? (
                                <div className="help" style={{ marginTop: 10, color: 'rgba(245,197,66,0.98)' }}>
                                  {conciliacaoReopenError}
                                </div>
                              ) : null}

                              <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  disabled={
                                    conciliacaoReopening ||
                                    !conciliacaoReopenPassword ||
                                    !conciliacaoOrgao.trim() ||
                                    !conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth) ||
                                    (conciliacaoReopenMode === 'parcial' && !conciliacaoReopenVencimento.trim())
                                  }
                                  onClick={async () => {
                                    if (!conciliacaoOrgao.trim()) return
                                    if (!conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)) return
                                    if (conciliacaoReopenMode === 'parcial' && !conciliacaoReopenVencimento.trim())
                                      return
                                    setConciliacaoReopenError(null)
                                    setConciliacaoError(null)
                                    setConciliacaoReopening(true)
                                    try {
                                      const res = await fetch(
                                        '/api/consignado/conciliacao/recurso-vs-relatorio/reabrir',
                                        {
                                          method: 'POST',
                                          headers: { 'content-type': 'application/json' },
                                          body: JSON.stringify({
                                            month: conciliacaoMonth,
                                            orgao: conciliacaoOrgao.trim(),
                                            vencimento:
                                              conciliacaoReopenMode === 'parcial'
                                                ? conciliacaoReopenVencimento.trim()
                                                : undefined,
                                            password: conciliacaoReopenPassword,
                                            reopenedBy: accessFixedEmail,
                                          }),
                                        },
                                      )
                                      const json = (await res.json().catch(() => null)) as null | { message?: string }
                                      if (!res.ok) {
                                        throw new Error(json?.message || 'Falha ao reabrir conciliação.')
                                      }
                                      setConciliacaoReopenModalOpen(false)
                                      setConciliacaoReopenPassword('')
                                      setConciliacaoReopenMode('total')
                                      setConciliacaoReopenVencimento('')
                                      await reloadConciliacaoKeepExpanded()
                                    } catch (e) {
                                      const msg = e instanceof Error ? e.message : 'Falha ao reabrir conciliação.'
                                      setConciliacaoReopenError(msg)
                                    } finally {
                                      setConciliacaoReopening(false)
                                    }
                                  }}
                                >
                                  {conciliacaoReopening ? 'Reabrindo...' : 'Reabrir'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {ocorrenciaModal
                        ? typeof document !== 'undefined'
                          ? createPortal(
                              <div
                                role="dialog"
                                aria-modal="true"
                                style={{
                                  position: 'fixed',
                                  inset: 0,
                                  background: 'rgba(0,0,0,0.62)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 16,
                                  zIndex: 230,
                                }}
                                onClick={() => setOcorrenciaModal(null)}
                              >
                                <div
                                  style={{
                                    width: 'min(740px, 96vw)',
                                    borderRadius: 18,
                                    border: '1px solid rgba(255,255,255,0.16)',
                                    background: 'rgba(12, 22, 40, 0.96)',
                                    color: 'rgba(255,255,255,0.92)',
                                    boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
                                    overflow: 'hidden',
                                    maxHeight: '86vh',
                                    display: 'flex',
                                    flexDirection: 'column',
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                            <div
                              style={{
                                padding: '14px 16px',
                                borderBottom: '1px solid rgba(255,255,255,0.10)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                              }}
                            >
                              <div style={{ fontWeight: 900 }}>Ocorrência</div>
                              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                {!ocorrenciaReadOnly ? (
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    disabled={relatorioOcorrenciaSaving}
                                    title="Nova ocorrência"
                                    onClick={() => {
                                      setRelatorioOcorrenciaError(null)
                                      setRelatorioOcorrenciaAction('alterar_orgao_relatorio_sisbr')
                                      setRelatorioOcorrenciaToOrgao('')
                                      setRelatorioOcorrenciaJustification('')
                                      setRelatorioOcorrenciaUndoJustification('')
                                      setRelatorioRepactuacaoStatus('pendente_gerente')
                                      setRelatorioRepactuacaoGerenteEmail('')
                                      setRelatorioNaoPossuiRecursoGerenteEmail('')
                                      setRelatorioRecursoJudicialNovoValor(ocorrenciaModal.value)
                                      setRelatorioRecursoJudicialAutoJustification(true)
                                      setOcorrenciaModalShowNew(true)
                                    }}
                                  >
                                    +
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  onClick={() => setOcorrenciaModal(null)}
                                >
                                  Fechar
                                </button>
                              </div>
                            </div>
                            <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                              <div style={{ display: 'grid', gap: 6 }}>
                                <div style={{ fontWeight: 850 }}>{ocorrenciaModal.nome || '-'}</div>
                                <div style={{ opacity: 0.82 }}>
                                  CPF: {ocorrenciaModal.cpf} • Valor: {withCurrency(ocorrenciaModal.value)}
                                </div>
                                <div style={{ opacity: 0.82 }}>
                                  Empresa atual (SISBR): {ocorrenciaModal.empresa || '-'}
                                </div>
                              </div>

                              {ocorrenciaModalOcorrenciasByTipo.length > 0 ? (
                                <div style={{ marginTop: 14 }}>
                                  <div style={{ fontWeight: 750, marginBottom: 8 }}>
                                    Ocorrências registradas
                                  </div>
                                  <div style={{ display: 'grid', gap: 10 }}>
                                    {ocorrenciaModalOcorrenciasByTipo.map(({ label, items }) => {
                                      const open = Boolean(ocorrenciaModalGroupsOpen[label])
                                      return (
                                        <div
                                          key={label}
                                          style={{
                                            borderRadius: 12,
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            background: 'rgba(255,255,255,0.03)',
                                            overflow: 'hidden',
                                          }}
                                        >
                                          <button
                                            type="button"
                                            className="btn btn-ghost"
                                            style={{
                                              width: '100%',
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              padding: '10px 12px',
                                            }}
                                            onClick={() =>
                                              setOcorrenciaModalGroupsOpen((prev) => ({
                                                ...prev,
                                                [label]: !open,
                                              }))
                                            }
                                          >
                                            <span style={{ fontWeight: 850 }}>
                                              {open ? '▾' : '▸'} {label} ({items.length})
                                            </span>
                                          </button>
                                          {open ? (
                                            <div style={{ padding: '10px 12px', display: 'grid', gap: 10 }}>
                                              {items.map((o: any) => (
                                                <div
                                                  key={String(o.id)}
                                                  style={{
                                                    padding: '10px 12px',
                                                    borderRadius: 12,
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    background: 'rgba(255,255,255,0.03)',
                                                    display: 'grid',
                                                    gap: 6,
                                                  }}
                                                >
                                                  <div
                                                    style={{
                                                      display: 'flex',
                                                      justifyContent: 'space-between',
                                                      gap: 10,
                                                      alignItems: 'center',
                                                    }}
                                                  >
                                                    <div style={{ fontWeight: 850 }}>
                                                      #{String(o.id)} • {String(o.createdAt || '-')}
                                                    </div>
                                                    {!ocorrenciaReadOnly ? (
                                                      <button
                                                        type="button"
                                                        className="btn btn-ghost"
                                                        disabled={relatorioOcorrenciaSaving}
                                                        onClick={async () => {
                                                          setRelatorioOcorrenciaSaving(true)
                                                          setRelatorioOcorrenciaError(null)
                                                          try {
                                                            const res = await fetch(
                                                              '/api/consignado/conciliacao/recurso-vs-relatorio/desfazer-ocorrencia',
                                                              {
                                                                method: 'POST',
                                                                headers: { 'content-type': 'application/json' },
                                                                body: JSON.stringify({
                                                                  id: Number(o.id),
                                                                  undoJustification: relatorioOcorrenciaUndoJustification,
                                                                }),
                                                              },
                                                            )
                                                            const json = (await res.json().catch(() => null)) as
                                                              | null
                                                              | { message?: string }
                                                            if (!res.ok) {
                                                              throw new Error(
                                                                json?.message || 'Falha ao desfazer ocorrência.',
                                                              )
                                                            }
                                                            await reloadConciliacaoKeepExpanded()
                                                            setOcorrenciaModal(null)
                                                          } catch (e) {
                                                            const msg =
                                                              e instanceof Error
                                                                ? e.message
                                                                : 'Falha ao desfazer ocorrência.'
                                                            setRelatorioOcorrenciaError(msg)
                                                          } finally {
                                                            setRelatorioOcorrenciaSaving(false)
                                                          }
                                                        }}
                                                      >
                                                        Desfazer
                                                      </button>
                                                    ) : null}
                                                  </div>
                                                  <div style={{ opacity: 0.86, whiteSpace: 'pre-wrap' }}>
                                                    {String(o.justification || '-')}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          ) : null}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              ) : null}

                              {ocorrenciaModalOcorrencias.length > 0 && !ocorrenciaModalShowNew ? (
                                <div style={{ marginTop: 14 }}>
                                  <div style={{ opacity: 0.82 }}>
                                    Esta linha já possui ocorrência. Você pode desfazer a ocorrência ou registrar uma
                                    repactuação (máximo 2).
                                  </div>
                                  {ocorrenciaModal.repactuacoes.length > 0 ? (
                                    <div style={{ marginTop: 12 }}>
                                      <div style={{ fontWeight: 750, marginBottom: 8 }}>Repactuações registradas</div>
                                      <div style={{ display: 'grid', gap: 8 }}>
                                        {ocorrenciaModal.repactuacoes.map((it) => (
                                          <div
                                            key={it.id}
                                            style={{
                                              padding: '10px 12px',
                                              borderRadius: 12,
                                              border: '1px solid rgba(255,255,255,0.12)',
                                              background: 'rgba(255,255,255,0.03)',
                                              display: 'grid',
                                              gap: 4,
                                            }}
                                          >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                              <div style={{ fontWeight: 850 }}>
                                                {it.status === 'pendente_gerente'
                                                  ? 'Pendente Gerente'
                                                  : it.status === 'concluido'
                                                    ? 'Concluido'
                                                    : it.status || '-'}
                                              </div>
                                              <div style={{ opacity: 0.72, whiteSpace: 'nowrap' }}>
                                                #{it.id} • {it.createdAt || '-'}
                                              </div>
                                            </div>
                                            {it.gerenteEmail ? (
                                              <div style={{ opacity: 0.82 }}>Gerente: {it.gerenteEmail}</div>
                                            ) : null}
                                            <div style={{ opacity: 0.82, whiteSpace: 'pre-wrap' }}>
                                              {it.justification || '-'}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                  <div style={{ marginTop: 12 }}>
                                    <div style={{ fontWeight: 750, marginBottom: 8 }}>
                                      Justificativa para desfazer (opcional)
                                    </div>
                                    <textarea
                                      value={relatorioOcorrenciaUndoJustification}
                                      onChange={(e) => setRelatorioOcorrenciaUndoJustification(e.target.value)}
                                      rows={3}
                                      style={{
                                        width: '100%',
                                        resize: 'vertical',
                                        padding: '10px 12px',
                                        borderRadius: 12,
                                        border: '1px solid rgba(255,255,255,0.16)',
                                        background: 'rgba(255,255,255,0.06)',
                                        color: 'rgba(255,255,255,0.88)',
                                        opacity: ocorrenciaReadOnly ? 0.55 : 1,
                                      }}
                                      placeholder="Opcional..."
                                      disabled={relatorioOcorrenciaSaving || ocorrenciaReadOnly}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {ocorrenciaModalOcorrencias.length > 0 && ocorrenciaModalShowNew ? (
                                    <div
                                      style={{
                                        marginTop: 14,
                                        padding: '10px 12px',
                                        borderRadius: 12,
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        background: 'rgba(255,255,255,0.03)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 12,
                                      }}
                                    >
                                      <div style={{ fontWeight: 750 }}>Nova ocorrência</div>
                                      <button
                                        type="button"
                                        className="btn btn-ghost"
                                        disabled={relatorioOcorrenciaSaving}
                                        onClick={() => {
                                          setRelatorioOcorrenciaError(null)
                                          setOcorrenciaModalShowNew(false)
                                        }}
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  ) : null}
                                  <div style={{ marginTop: 18 }}>
                                    <div style={{ fontWeight: 750, marginBottom: 8 }}>Ação</div>
                                    <select
                                      value={relatorioOcorrenciaAction}
                                      onChange={(e) => {
                                        const next = e.target.value
                                        setRelatorioOcorrenciaAction(next)
                                        if (next !== 'alterar_orgao_relatorio_sisbr') {
                                          setRelatorioOcorrenciaToOrgao('')
                                        }
                                        if (next === 'repactuacao_relatorio_sisbr') {
                                          setRelatorioRepactuacaoStatus('pendente_gerente')
                                          setRelatorioRepactuacaoGerenteEmail('')
                                        }
                                        if (next === 'nao_possui_recurso_relatorio_sisbr') {
                                          setRelatorioNaoPossuiRecursoGerenteEmail('')
                                        }
                                        if (next === 'liquidacao_fora_vencimento_relatorio_sisbr') {
                                          setRelatorioLiquidacaoForaVencimentoDate('')
                                          if (!relatorioOcorrenciaJustification.trim()) {
                                            setRelatorioOcorrenciaJustification('')
                                          }
                                        } else {
                                          setRelatorioLiquidacaoForaVencimentoDate('')
                                        }
                                        if (next === 'recurso_judicial_valor_a_menor_relatorio_sisbr') {
                                          setRelatorioRecursoJudicialNovoValor(ocorrenciaModal.value)
                                          setRelatorioOcorrenciaJustification('')
                                          setRelatorioRecursoJudicialAutoJustification(true)
                                        } else {
                                          setRelatorioRecursoJudicialNovoValor('')
                                          setRelatorioRecursoJudicialAutoJustification(false)
                                        }
                                      }}
                                      disabled={relatorioOcorrenciaSaving || ocorrenciaReadOnly}
                                      style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 12,
                                        border: '1px solid rgba(255,255,255,0.16)',
                                        background: 'rgba(255,255,255,0.06)',
                                        color: 'rgba(255,255,255,0.88)',
                                        opacity: ocorrenciaReadOnly ? 0.55 : 1,
                                      }}
                                    >
                                      <option
                                        value="alterar_orgao_relatorio_sisbr"
                                        style={{
                                          background: 'rgb(12, 22, 40)',
                                          color: 'rgba(255,255,255,0.92)',
                                        }}
                                      >
                                        Alterar Orgão
                                      </option>
                                      <option
                                        value="repactuacao_relatorio_sisbr"
                                        style={{
                                          background: 'rgb(12, 22, 40)',
                                          color: 'rgba(255,255,255,0.92)',
                                        }}
                                      >
                                        Repactuação
                                      </option>
                                      <option
                                        value="liquidacao_ccs_relatorio_sisbr"
                                        style={{
                                          background: 'rgb(12, 22, 40)',
                                          color: 'rgba(255,255,255,0.92)',
                                        }}
                                      >
                                        Liquidação CCS (Excluir do Relatório SISBR)
                                      </option>
                                      <option
                                        value="liquidacao_fora_vencimento_relatorio_sisbr"
                                        disabled={ocorrenciaModal?.status !== 'conciliado'}
                                        style={{
                                          background: 'rgb(12, 22, 40)',
                                          color: 'rgba(255,255,255,0.92)',
                                        }}
                                      >
                                        Liquidação Fora do Vencimento
                                      </option>
                                      <option
                                        value="nao_possui_recurso_relatorio_sisbr"
                                        style={{
                                          background: 'rgb(12, 22, 40)',
                                          color: 'rgba(255,255,255,0.92)',
                                        }}
                                      >
                                        Não possui Recurso
                                      </option>
                                      <option
                                        value="recurso_judicial_valor_a_menor_relatorio_sisbr"
                                        style={{
                                          background: 'rgb(12, 22, 40)',
                                          color: 'rgba(255,255,255,0.92)',
                                        }}
                                      >
                                        Recurso Judicial - Valor a Menor
                                      </option>
                                    </select>
                                  </div>

                                  {relatorioOcorrenciaAction === 'alterar_orgao_relatorio_sisbr' ? (
                                    <div style={{ marginTop: 14 }}>
                                      <div style={{ fontWeight: 750, marginBottom: 8 }}>Órgão de destino</div>
                                      <select
                                        value={relatorioOcorrenciaToOrgao}
                                        onChange={(e) => setRelatorioOcorrenciaToOrgao(e.target.value)}
                                        disabled={relatorioOcorrenciaSaving || ocorrenciaReadOnly}
                                        style={{
                                          width: '100%',
                                          padding: '10px 12px',
                                          borderRadius: 12,
                                          border: '1px solid rgba(255,255,255,0.16)',
                                          background: 'rgba(255,255,255,0.06)',
                                          color: 'rgba(255,255,255,0.88)',
                                          opacity: ocorrenciaReadOnly ? 0.55 : 1,
                                        }}
                                      >
                                        <option
                                          value=""
                                          style={{
                                            background: 'rgb(12, 22, 40)',
                                            color: 'rgba(255,255,255,0.92)',
                                          }}
                                        >
                                          Selecione...
                                        </option>
                                        {relatorioOcorrenciaOrgaoOptions.map((o) => (
                                          <option
                                            key={o}
                                            value={o}
                                            style={{
                                              background: 'rgb(12, 22, 40)',
                                              color: 'rgba(255,255,255,0.92)',
                                            }}
                                          >
                                            {o}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : null}

                                  {relatorioOcorrenciaAction === 'repactuacao_relatorio_sisbr' ? (
                                    <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                                      <div className="field">
                                        <label>Status</label>
                                        <RepactuacaoStatusSelect
                                          value={relatorioRepactuacaoStatus}
                                          onChange={setRelatorioRepactuacaoStatus}
                                          disabled={relatorioOcorrenciaSaving || ocorrenciaReadOnly}
                                        />
                                      </div>
                                      <div className="field">
                                        <label>E-mail do gerente responsável</label>
                                        <input
                                          className="control"
                                          type="email"
                                          value={relatorioRepactuacaoGerenteEmail}
                                          onChange={(e) => setRelatorioRepactuacaoGerenteEmail(e.target.value)}
                                          disabled={relatorioOcorrenciaSaving || ocorrenciaReadOnly}
                                          placeholder="ex.: gerente@sicoobjuriscred.com.br"
                                        />
                                      </div>
                                    </div>
                                  ) : null}
                                  {relatorioOcorrenciaAction === 'liquidacao_ccs_relatorio_sisbr' ? (
                                    <div
                                      style={{
                                        marginTop: 14,
                                        padding: '10px 12px',
                                        borderRadius: 12,
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        background: 'rgba(255,255,255,0.03)',
                                        opacity: 0.92,
                                      }}
                                    >
                                      Esta ação remove a linha do Relatório SISBR para não compor a conciliação.
                                    </div>
                                  ) : null}
                                  {relatorioOcorrenciaAction ===
                                  'liquidacao_fora_vencimento_relatorio_sisbr' ? (
                                    <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                                      <div className="field">
                                        <label>Data de liquidação (dd/mm/aaaa)</label>
                                        <input
                                          className="control"
                                          type="text"
                                          value={relatorioLiquidacaoForaVencimentoDate}
                                          onChange={(e) => {
                                            const next = e.target.value
                                            setRelatorioLiquidacaoForaVencimentoDate(next)
                                            const normalized = next.trim()
                                            if (
                                              !relatorioOcorrenciaJustification.trim() ||
                                              relatorioOcorrenciaJustification
                                                .trim()
                                                .toLowerCase()
                                                .startsWith('liquidação fora do vencimento')
                                            ) {
                                              if (normalized) {
                                                setRelatorioOcorrenciaJustification(
                                                  `Liquidação fora do vencimento. Data de liquidação: ${normalized}`,
                                                )
                                              } else {
                                                setRelatorioOcorrenciaJustification('')
                                              }
                                            }
                                          }}
                                          disabled={relatorioOcorrenciaSaving || ocorrenciaReadOnly}
                                          placeholder="ex.: 05/06/2026"
                                        />
                                      </div>
                                      <div
                                        style={{
                                          padding: '10px 12px',
                                          borderRadius: 12,
                                          border: '1px solid rgba(255,255,255,0.12)',
                                          background: 'rgba(255,255,255,0.03)',
                                          opacity: 0.92,
                                        }}
                                      >
                                        A data informada será usada no relatório da contabilidade para separar os
                                        valores por data.
                                      </div>
                                    </div>
                                  ) : null}
                                  {relatorioOcorrenciaAction === 'nao_possui_recurso_relatorio_sisbr' ? (
                                    <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                                      <div className="field">
                                        <label>E-mail do gerente responsável</label>
                                        <input
                                          className="control"
                                          type="email"
                                          value={relatorioNaoPossuiRecursoGerenteEmail}
                                          onChange={(e) =>
                                            setRelatorioNaoPossuiRecursoGerenteEmail(e.target.value)
                                          }
                                          disabled={relatorioOcorrenciaSaving || ocorrenciaReadOnly}
                                          placeholder="ex.: gerente@sicoobjuriscred.com.br"
                                        />
                                      </div>
                                      <div
                                        style={{
                                          padding: '10px 12px',
                                          borderRadius: 12,
                                          border: '1px solid rgba(255,255,255,0.12)',
                                          background: 'rgba(255,255,255,0.03)',
                                          opacity: 0.92,
                                        }}
                                      >
                                        Esta ação exclui a linha do Relatório SISBR, registra a ocorrência e envia a
                                        mensagem ao gerente.
                                      </div>
                                    </div>
                                  ) : null}
                                  {relatorioOcorrenciaAction ===
                                  'recurso_judicial_valor_a_menor_relatorio_sisbr' ? (
                                    <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                                      {(() => {
                                        const oldCents = ptBrMoneyToCents(ocorrenciaModal.value)
                                        const newCents = ptBrMoneyToCents(
                                          relatorioRecursoJudicialNovoValor || ocorrenciaModal.value,
                                        )
                                        const diffCents = Math.max(0, oldCents - newCents)
                                        return (
                                          <>
                                            <div className="field">
                                              <label>Valor Contrato Original</label>
                                              <input
                                                className="control"
                                                type="text"
                                                value={`R$ ${centsToPtBr(oldCents)}`}
                                                disabled
                                              />
                                            </div>
                                            <div className="field">
                                              <label>Valor Judicial (valor editado)</label>
                                              <input
                                                className="control"
                                                type="text"
                                                value={relatorioRecursoJudicialNovoValor}
                                                onChange={(e) =>
                                                  setRelatorioRecursoJudicialNovoValor(e.target.value)
                                                }
                                                disabled={relatorioOcorrenciaSaving || ocorrenciaReadOnly}
                                                placeholder="ex.: 115,19"
                                              />
                                            </div>
                                            <div
                                              style={{
                                                padding: '10px 12px',
                                                borderRadius: 12,
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                background: 'rgba(255,255,255,0.03)',
                                                opacity: 0.92,
                                              }}
                                            >
                                              Diferença: <b>{`R$ ${centsToPtBr(diffCents)}`}</b>
                                              <div style={{ marginTop: 6, opacity: 0.9 }}>
                                                Esta ação altera o valor no SISBR para o valor judicial e registra a
                                                diferença na ocorrência para contabilidade verificar.
                                              </div>
                                            </div>
                                          </>
                                        )
                                      })()}
                                    </div>
                                  ) : null}

                                  <div style={{ marginTop: 14 }}>
                                    <div style={{ fontWeight: 750, marginBottom: 8 }}>
                                      {relatorioOcorrenciaAction === 'nao_possui_recurso_relatorio_sisbr'
                                        ? 'Mensagem (obrigatória)'
                                        : 'Justificativa (obrigatória)'}
                                    </div>
                                    <textarea
                                      value={relatorioOcorrenciaJustification}
                                      onChange={(e) => {
                                        setRelatorioOcorrenciaJustification(e.target.value)
                                        if (
                                          relatorioOcorrenciaAction ===
                                          'recurso_judicial_valor_a_menor_relatorio_sisbr'
                                        ) {
                                          setRelatorioRecursoJudicialAutoJustification(false)
                                        }
                                      }}
                                      rows={4}
                                      style={{
                                        width: '100%',
                                        resize: 'vertical',
                                        padding: '10px 12px',
                                        borderRadius: 12,
                                        border: '1px solid rgba(255,255,255,0.16)',
                                        background: 'rgba(255,255,255,0.06)',
                                        color: 'rgba(255,255,255,0.88)',
                                        opacity: ocorrenciaReadOnly ? 0.55 : 1,
                                      }}
                                      placeholder="Descreva o motivo da ação..."
                                      disabled={relatorioOcorrenciaSaving || ocorrenciaReadOnly}
                                    />
                                  </div>
                                </>
                              )}

                              {relatorioOcorrenciaError ? (
                                <div style={{ marginTop: 12, color: 'rgba(245,197,66,0.98)', fontWeight: 750 }}>
                                  {relatorioOcorrenciaError}
                                </div>
                              ) : null}

                              {!ocorrenciaReadOnly ? (
                                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                  {ocorrenciaModalOcorrencias.length === 0 || ocorrenciaModalShowNew ? (
                                    <button
                                      type="button"
                                      className="btn btn-primary"
                                      disabled={
                                        relatorioOcorrenciaSaving ||
                                        ocorrenciaReadOnly ||
                                        !conciliacaoMonth ||
                                        !relatorioOcorrenciaJustification.trim() ||
                                        (relatorioOcorrenciaAction === 'alterar_orgao_relatorio_sisbr' &&
                                          (!relatorioOcorrenciaToOrgao || !ocorrenciaModal.empresa)) ||
                                        (relatorioOcorrenciaAction === 'repactuacao_relatorio_sisbr' &&
                                          relatorioRepactuacaoStatus === 'pendente_gerente' &&
                                          !relatorioRepactuacaoGerenteEmail.trim()) ||
                                        (relatorioOcorrenciaAction === 'nao_possui_recurso_relatorio_sisbr' &&
                                          !relatorioNaoPossuiRecursoGerenteEmail.trim()) ||
                                        (relatorioOcorrenciaAction ===
                                          'liquidacao_fora_vencimento_relatorio_sisbr' &&
                                          !/^\d{2}\/\d{2}\/\d{4}$/.test(
                                            relatorioLiquidacaoForaVencimentoDate.trim(),
                                          )) ||
                                        (relatorioOcorrenciaAction ===
                                          'recurso_judicial_valor_a_menor_relatorio_sisbr' &&
                                          !relatorioRecursoJudicialNovoValor.trim())
                                      }
                                      onClick={async () => {
                                        if (!conciliacaoMonth) return
                                        if (ocorrenciaReadOnly) return
                                        const isAlterarOrgao =
                                          relatorioOcorrenciaAction === 'alterar_orgao_relatorio_sisbr'
                                        const isRepactuacao =
                                          relatorioOcorrenciaAction === 'repactuacao_relatorio_sisbr'
                                        const isLiquidacaoCcs =
                                          relatorioOcorrenciaAction === 'liquidacao_ccs_relatorio_sisbr'
                                        const isNaoPossuiRecurso =
                                          relatorioOcorrenciaAction === 'nao_possui_recurso_relatorio_sisbr'
                                        const isLiquidacaoForaVencimento =
                                          relatorioOcorrenciaAction ===
                                          'liquidacao_fora_vencimento_relatorio_sisbr'
                                        const isRecursoJudicialValorAMenor =
                                          relatorioOcorrenciaAction ===
                                          'recurso_judicial_valor_a_menor_relatorio_sisbr'
                                        if (isAlterarOrgao && !relatorioOcorrenciaToOrgao) return
                                        if (isAlterarOrgao && !ocorrenciaModal.empresa) {
                                          setRelatorioOcorrenciaError(
                                            'Empresa atual (SISBR) não encontrada no registro.',
                                          )
                                          return
                                        }
                                        if (
                                          isRepactuacao &&
                                          relatorioRepactuacaoStatus === 'pendente_gerente' &&
                                          !relatorioRepactuacaoGerenteEmail.trim()
                                        ) {
                                          setRelatorioOcorrenciaError('Informe o e-mail do gerente responsável.')
                                          return
                                        }
                                        if (isNaoPossuiRecurso && !relatorioNaoPossuiRecursoGerenteEmail.trim()) {
                                          setRelatorioOcorrenciaError('Informe o e-mail do gerente responsável.')
                                          return
                                        }
                                        if (isLiquidacaoForaVencimento) {
                                          if (ocorrenciaModal.status !== 'conciliado') {
                                            setRelatorioOcorrenciaError(
                                              'Para registrar Liquidação Fora do Vencimento, o registro deve estar conciliado.',
                                            )
                                            return
                                          }
                                          const t = relatorioLiquidacaoForaVencimentoDate.trim()
                                          if (!t) {
                                            setRelatorioOcorrenciaError('Informe a data de liquidação (dd/mm/aaaa).')
                                            return
                                          }
                                          if (!/^\d{2}\/\d{2}\/\d{4}$/.test(t)) {
                                            setRelatorioOcorrenciaError(
                                              'Informe a data de liquidação no formato dd/mm/aaaa.',
                                            )
                                            return
                                          }
                                        }
                                        if (isRecursoJudicialValorAMenor) {
                                          if (!relatorioRecursoJudicialNovoValor.trim()) {
                                            setRelatorioOcorrenciaError('Informe o valor judicial (valor editado).')
                                            return
                                          }
                                          const oldCents = ptBrMoneyToCents(ocorrenciaModal.value)
                                          const newCents = ptBrMoneyToCents(relatorioRecursoJudicialNovoValor)
                                          if (!oldCents || !newCents || newCents >= oldCents) {
                                            setRelatorioOcorrenciaError(
                                              'O valor judicial deve ser um valor válido e menor que o valor do contrato.',
                                            )
                                            return
                                          }
                                        }
                                        setRelatorioOcorrenciaSaving(true)
                                        setRelatorioOcorrenciaError(null)
                                        try {
                                          const res = await fetch(
                                            isAlterarOrgao
                                              ? '/api/consignado/conciliacao/recurso-vs-relatorio/alterar-orgao-relatorio'
                                              : isLiquidacaoCcs
                                                ? '/api/consignado/conciliacao/recurso-vs-relatorio/liquidacao-ccs-excluir-relatorio'
                                                : isNaoPossuiRecurso
                                                  ? '/api/consignado/conciliacao/recurso-vs-relatorio/nao-possui-recurso'
                                                  : isLiquidacaoForaVencimento
                                                    ? '/api/consignado/conciliacao/recurso-vs-relatorio/liquidacao-fora-vencimento'
                                                : isRecursoJudicialValorAMenor
                                                  ? '/api/consignado/conciliacao/recurso-vs-relatorio/recurso-judicial-valor-a-menor'
                                                : '/api/consignado/conciliacao/recurso-vs-relatorio/repactuacao-relatorio',
                                            {
                                              method: 'POST',
                                              headers: { 'content-type': 'application/json' },
                                              body: JSON.stringify(
                                                isAlterarOrgao
                                                  ? {
                                                      month: conciliacaoMonth,
                                                      orgao: conciliacaoOrgao.trim(),
                                                      cpf: ocorrenciaModal.cpf,
                                                      nome: ocorrenciaModal.nome,
                                                      value: ocorrenciaModal.value,
                                                      fromEmpresa: ocorrenciaModal.empresa,
                                                      toOrgao: relatorioOcorrenciaToOrgao,
                                                      action: relatorioOcorrenciaAction,
                                                      justification: relatorioOcorrenciaJustification,
                                                    }
                                                  : isLiquidacaoCcs
                                                    ? {
                                                        month: conciliacaoMonth,
                                                        orgao: conciliacaoOrgao.trim(),
                                                        cpf: ocorrenciaModal.cpf,
                                                        nome: ocorrenciaModal.nome,
                                                        value: ocorrenciaModal.value,
                                                        fromEmpresa: ocorrenciaModal.empresa,
                                                        action: relatorioOcorrenciaAction,
                                                        justification: relatorioOcorrenciaJustification,
                                                      }
                                                    : isNaoPossuiRecurso
                                                      ? {
                                                          month: conciliacaoMonth,
                                                          orgao: conciliacaoOrgao.trim(),
                                                          cpf: ocorrenciaModal.cpf,
                                                          nome: ocorrenciaModal.nome,
                                                          value: ocorrenciaModal.value,
                                                          fromEmpresa: ocorrenciaModal.empresa,
                                                          gerenteEmail: relatorioNaoPossuiRecursoGerenteEmail,
                                                          message: relatorioOcorrenciaJustification,
                                                          action: relatorioOcorrenciaAction,
                                                        }
                                                      : isLiquidacaoForaVencimento
                                                        ? {
                                                            month: conciliacaoMonth,
                                                            orgao: conciliacaoOrgao.trim(),
                                                            cpf: ocorrenciaModal.cpf,
                                                            nome: ocorrenciaModal.nome,
                                                            value: ocorrenciaModal.value,
                                                            fromEmpresa: ocorrenciaModal.empresa,
                                                            liquidationDate:
                                                              relatorioLiquidacaoForaVencimentoDate.trim(),
                                                            action: relatorioOcorrenciaAction,
                                                            justification: relatorioOcorrenciaJustification,
                                                          }
                                                      : isRecursoJudicialValorAMenor
                                                        ? {
                                                            month: conciliacaoMonth,
                                                            orgao: conciliacaoOrgao.trim(),
                                                            cpf: ocorrenciaModal.cpf,
                                                            nome: ocorrenciaModal.nome,
                                                            value: ocorrenciaModal.value,
                                                            fromEmpresa: ocorrenciaModal.empresa,
                                                            newValue: relatorioRecursoJudicialNovoValor,
                                                            action: relatorioOcorrenciaAction,
                                                            justification: relatorioOcorrenciaJustification,
                                                          }
                                                    : {
                                                        month: conciliacaoMonth,
                                                        orgao: conciliacaoOrgao.trim(),
                                                        cpf: ocorrenciaModal.cpf,
                                                        nome: ocorrenciaModal.nome,
                                                        value: ocorrenciaModal.value,
                                                        status: relatorioRepactuacaoStatus,
                                                        gerenteEmail: relatorioRepactuacaoGerenteEmail,
                                                        action: relatorioOcorrenciaAction,
                                                        justification: relatorioOcorrenciaJustification,
                                                      },
                                              ),
                                            },
                                          )
                                          const json = (await res.json().catch(() => null)) as
                                            | null
                                            | {
                                                message?: string
                                                teams?: { attempted?: boolean; sent?: boolean; error?: string | null }
                                              }
                                          if (!res.ok)
                                            throw new Error(json?.message || 'Falha ao salvar ocorrência.')
                                          await reloadConciliacaoKeepExpanded()
                                          if (json?.teams && json.teams.sent === false) {
                                            const details = String(json.teams.error ?? '').trim()
                                            setRelatorioOcorrenciaError(
                                              `Ocorrência salva, mas não foi possível enviar no Teams. ${details || 'Verifique o login do Teams.'}`,
                                            )
                                            return
                                          }
                                          setOcorrenciaModal(null)
                                        } catch (e) {
                                          const msg =
                                            e instanceof Error ? e.message : 'Falha ao salvar ocorrência.'
                                          setRelatorioOcorrenciaError(msg)
                                        } finally {
                                          setRelatorioOcorrenciaSaving(false)
                                        }
                                      }}
                                    >
                                      {relatorioOcorrenciaSaving
                                        ? 'Salvando...'
                                        : relatorioOcorrenciaAction === 'repactuacao_relatorio_sisbr'
                                          ? 'Registrar repactuação'
                                          : relatorioOcorrenciaAction ===
                                                'liquidacao_ccs_relatorio_sisbr'
                                            ? 'Excluir do Relatório SISBR'
                                            : relatorioOcorrenciaAction ===
                                                  'nao_possui_recurso_relatorio_sisbr'
                                              ? 'Registrar e enviar'
                                          : 'Concluir ocorrência'}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                              </div>,
                              document.body,
                            )
                          : null
                        : null}
                    </>
                  ) : null}
                </div>
              </section>
            ) : null}

            {view === 'conciliacao-relatorio' ? (
              <section className="panel">
                <div className="panel-head">
                  <h2>Relatório</h2>
                  <span className="chip">
                    <Sparkles size={16} />
                    SQLite
                  </span>
                </div>
                <div className="panel-body">
                  <div className="help">
                    O relatório é importado e fica disponível para cruzamento com os extratos.
                  </div>
                </div>
              </section>
            ) : null}

            {view === 'dashboard' ? (
              <>
                <section className="panel">
                  <div className="panel-head">
                    <h2>Contexto</h2>
                    {conciliacaoLoading ? (
                      <span className="chip">
                        <Clock size={16} />
                        Carregando
                      </span>
                    ) : conciliacaoData?.closed?.isClosed ? (
                      <span className="chip">
                        <Lock size={16} />
                        Fechada
                      </span>
                    ) : conciliacaoOrgao.trim() ? (
                      <span className="chip">
                        <Unlock size={16} />
                        Aberta
                      </span>
                    ) : (
                      <span className="chip">
                        <Info size={16} />
                        Selecione
                      </span>
                    )}
                  </div>
                  <div className="panel-body">
                    <div className="form-grid form-grid-3">
                      <div className="field">
                        <label>Competência</label>
                        <select
                          className="control month-select"
                          value={conciliacaoMonth}
                          onChange={(e) => setConciliacaoMonth(e.target.value)}
                          disabled={conciliacaoMonthsLoading || conciliacaoMonthOptions.length === 0}
                          style={{ height: 44 }}
                        >
                          {conciliacaoMonthOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Órgão</label>
                        <select
                          className="control month-select"
                          value={conciliacaoOrgao}
                          onChange={(e) => setConciliacaoOrgao(e.target.value)}
                          disabled={orgaoDeParaLoading}
                          style={{ height: 44 }}
                        >
                          <option value="">Selecione...</option>
                          {conciliacaoOrgaoOptions.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Exibir</label>
                        <label
                          className="day"
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            gap: 10,
                            height: 44,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={conciliacaoOnlyDiff}
                            onChange={(e) => setConciliacaoOnlyDiff(e.target.checked)}
                          />
                          <span>Somente divergências</span>
                        </label>
                      </div>
                    </div>

                    {conciliacaoError ? (
                      <div className="help" style={{ marginTop: 12, color: 'rgba(255, 99, 132, 0.95)' }}>
                        {conciliacaoError}
                      </div>
                    ) : null}

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setHash('conciliacao-extratos')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
                      >
                        <BadgeDollarSign size={18} />
                        Abrir conciliação
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={
                          !canExportConciliacaoXlsx ||
                          conciliacaoExportingXlsx ||
                          !conciliacaoOrgao.trim() ||
                          !conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)
                        }
                        onClick={() => void exportConciliacaoXlsx()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
                      >
                        <FileSpreadsheet size={18} />
                        {conciliacaoExportingXlsx ? 'Exportando...' : 'Exportar XLSX'}
                      </button>
                      {conciliacaoData ? (
                        <span
                          className="chip"
                          style={{ alignSelf: 'center' }}
                          title={
                            conciliacaoLoadedAtIso ? `Última atualização: ${formatIsoToPtBrDateTime(conciliacaoLoadedAtIso)}` : ''
                          }
                        >
                          <Clock size={16} />
                          Última atualização:{' '}
                          {conciliacaoLoadedAtIso ? formatIsoToPtBrDateTime(conciliacaoLoadedAtIso).slice(0, 10) : '—'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="grid">
                  <div className="panel">
                    <div className="panel-head">
                      <h2>Status da Conciliação</h2>
                      <span className="chip">
                        <Sparkles size={16} />
                        Visão rápida
                      </span>
                    </div>
                    <div className="panel-body">
                      {conciliacaoData ? (
                        (() => {
                          const recurso = Array.isArray(conciliacaoData?.recurso) ? conciliacaoData.recurso : []
                          const relatorio = Array.isArray(conciliacaoData?.relatorio) ? conciliacaoData.relatorio : []
                          const recOk = recurso.filter((x: any) => x?.status === 'conciliado').length
                          const recPend = recurso.filter((x: any) => x?.status === 'pendencia').length
                          const relOk = relatorio.filter((x: any) => x?.status === 'conciliado').length
                          const relPend = relatorio.filter((x: any) => x?.status === 'pendencia').length

                          const totalRec = recOk + recPend
                          const totalRel = relOk + relPend
                          const recPct = totalRec > 0 ? Math.round((recOk / totalRec) * 100) : 0
                          const relPct = totalRel > 0 ? Math.round((relOk / totalRel) * 100) : 0
                          const statusOption = {
                            backgroundColor: 'transparent',
                            tooltip: { trigger: 'item' },
                            legend: { show: false },
                            title: [
                              {
                                text: 'Recurso',
                                left: '25%',
                                top: 12,
                                textAlign: 'center',
                                textStyle: {
                                  color: 'rgba(255,255,255,0.75)',
                                  fontSize: 12,
                                  fontWeight: 800,
                                },
                              },
                              {
                                text: `${recPct}%`,
                                left: '25%',
                                top: '38%',
                                textAlign: 'center',
                                textStyle: {
                                  color: 'rgba(255,255,255,0.94)',
                                  fontSize: 28,
                                  fontWeight: 900,
                                },
                              },
                              {
                                text: 'conciliado',
                                left: '25%',
                                top: '56%',
                                textAlign: 'center',
                                textStyle: {
                                  color: 'rgba(255,255,255,0.58)',
                                  fontSize: 11,
                                  fontWeight: 750,
                                },
                              },
                              {
                                text: 'Relatório Sisbr',
                                left: '75%',
                                top: 12,
                                textAlign: 'center',
                                textStyle: {
                                  color: 'rgba(255,255,255,0.75)',
                                  fontSize: 12,
                                  fontWeight: 800,
                                },
                              },
                              {
                                text: `${relPct}%`,
                                left: '75%',
                                top: '38%',
                                textAlign: 'center',
                                textStyle: {
                                  color: 'rgba(255,255,255,0.94)',
                                  fontSize: 28,
                                  fontWeight: 900,
                                },
                              },
                              {
                                text: 'conciliado',
                                left: '75%',
                                top: '56%',
                                textAlign: 'center',
                                textStyle: {
                                  color: 'rgba(255,255,255,0.58)',
                                  fontSize: 11,
                                  fontWeight: 750,
                                },
                              },
                            ],
                            series: [
                              {
                                name: 'Recurso',
                                type: 'pie',
                                radius: ['60%', '78%'],
                                center: ['25%', '58%'],
                                avoidLabelOverlap: true,
                                label: { show: false },
                                labelLine: { show: false },
                                itemStyle: {
                                  borderColor: 'rgba(255,255,255,0.04)',
                                  borderWidth: 2,
                                },
                                data: [
                                  { value: recOk, name: 'Conciliado', itemStyle: { color: '#00AE9D' } },
                                  { value: recPend, name: 'Pendência', itemStyle: { color: '#F5C542' } },
                                ],
                              },
                              {
                                name: 'Relatório Sisbr',
                                type: 'pie',
                                radius: ['60%', '78%'],
                                center: ['75%', '58%'],
                                avoidLabelOverlap: true,
                                label: { show: false },
                                labelLine: { show: false },
                                itemStyle: {
                                  borderColor: 'rgba(255,255,255,0.04)',
                                  borderWidth: 2,
                                },
                                data: [
                                  { value: relOk, name: 'Conciliado', itemStyle: { color: '#00AE9D' } },
                                  { value: relPend, name: 'Pendência', itemStyle: { color: '#F5C542' } },
                                ],
                              },
                            ],
                          }

                          return (
                            <div style={{ display: 'grid', gap: 12 }}>
                              <ReactECharts
                                option={statusOption}
                                style={{ height: 260, width: '100%' }}
                                opts={{ renderer: 'canvas' }}
                              />
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                <span className="chip">
                                  <Sparkles size={16} />
                                  Recurso: {recOk} OK • {recPend} pend.
                                </span>
                                <span className="chip">
                                  <Sparkles size={16} />
                                  Relatório Sisbr: {relOk} OK • {relPend} pend.
                                </span>
                                <span className="chip">
                                  {(conciliacaoData as any)?.closed?.isClosed ? <Lock size={16} /> : <Unlock size={16} />}
                                  {(conciliacaoData as any)?.closed?.isClosed ? 'Fechada' : 'Aberta'}
                                </span>
                              </div>
                            </div>
                          )
                        })()
                      ) : (
                        <div className="help">
                          Selecione um órgão/competência na Home para carregar o painel.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-head">
                      <h2>Valores (R$)</h2>
                      <span className="chip">
                        <BadgeDollarSign size={16} />
                        Totais
                      </span>
                    </div>
                    <div className="panel-body">
                      {conciliacaoData ? (
                        (() => {
                          const totals = conciliacaoData.totals
                          const recursoCents = Number(totals?.recurso?.cents ?? 0) || 0
                          const extratosCents = Number(totals?.extratos?.cents ?? 0) || 0
                          const relatorioCents = Number(totals?.relatorio?.cents ?? 0) || 0
                          const tarifasCents =
                            (Number(totals?.tarifaLinha?.cents ?? 0) || 0) +
                            (Number(totals?.tarifaTed?.cents ?? 0) || 0)
                          const diffCents = extratosCents - recursoCents
                          const seriesData = [
                            { name: 'Recurso', value: recursoCents },
                            { name: 'Extrato', value: extratosCents },
                            { name: 'Relatório Sisbr', value: relatorioCents },
                            { name: 'Tarifas', value: tarifasCents },
                            { name: 'Diferença', value: diffCents },
                          ]
                          const maxAbs = Math.max(...seriesData.map((x) => Math.abs(x.value)), 1)
                          const limit = Math.ceil(maxAbs * 1.15)
                          const fmtSigned = (cents: number) => {
                            const sign = cents < 0 ? '- ' : ''
                            return `${sign}R$ ${centsToPtBr(Math.abs(cents))}`
                          }
                          const colorOf = (name: string) => {
                            if (name === 'Extrato') return '#00AE9D'
                            if (name === 'Recurso') return '#F5C542'
                            if (name === 'Tarifas') return 'rgba(255, 99, 132, 0.85)'
                            if (name === 'Diferença') return diffCents === 0 ? '#00AE9D' : '#F5C542'
                            return 'rgba(255,255,255,0.70)'
                          }
                          const valuesOption = {
                            backgroundColor: 'transparent',
                            grid: { left: 120, right: 18, top: 18, bottom: 18 },
                            tooltip: {
                              trigger: 'item',
                              formatter: (p: any) => `${p?.name}: ${fmtSigned(Number(p?.value ?? 0))}`,
                            },
                            xAxis: {
                              type: 'value',
                              min: -limit,
                              max: limit,
                              axisLabel: {
                                color: 'rgba(255,255,255,0.55)',
                                formatter: (v: number) => `R$ ${centsToPtBr(Math.abs(Number(v) || 0))}`,
                              },
                              splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
                              axisLine: { lineStyle: { color: 'rgba(255,255,255,0.10)' } },
                            },
                            yAxis: {
                              type: 'category',
                              data: seriesData.map((x) => x.name),
                              axisLabel: { color: 'rgba(255,255,255,0.78)', fontWeight: 800 },
                              axisTick: { show: false },
                              axisLine: { show: false },
                            },
                            series: [
                              {
                                type: 'bar',
                                barWidth: 14,
                                data: seriesData.map((x) => ({
                                  name: x.name,
                                  value: x.value,
                                  itemStyle: {
                                    color: colorOf(x.name),
                                    borderRadius: [999, 999, 999, 999],
                                    shadowColor: 'rgba(0,0,0,0.18)',
                                    shadowBlur: 10,
                                  },
                                })),
                                emphasis: {
                                  itemStyle: {
                                    shadowColor: 'rgba(0,0,0,0.35)',
                                    shadowBlur: 18,
                                  },
                                },
                              },
                            ],
                          }
                          return (
                            <ReactECharts
                              option={valuesOption}
                              style={{ height: 260, width: '100%' }}
                              opts={{ renderer: 'canvas' }}
                            />
                          )
                        })()
                      ) : (
                        <div className="help">
                          Carregue uma conciliação para visualizar os gráficos.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-head">
                      <h2>Pendências (Top)</h2>
                      <span className="chip">
                        <Zap size={16} />
                        Prioridade
                      </span>
                    </div>
                    <div className="panel-body">
                      {conciliacaoData ? (
                        (() => {
                          const recurso = Array.isArray(conciliacaoData?.recurso) ? conciliacaoData.recurso : []
                          const relatorio = Array.isArray(conciliacaoData?.relatorio) ? conciliacaoData.relatorio : []
                          const pend = [
                            ...recurso
                              .filter((x: any) => x?.status === 'pendencia')
                              .map((x: any) => ({ ...x, __src: 'Recurso' as const })),
                            ...relatorio
                              .filter((x: any) => x?.status === 'pendencia')
                              .map((x: any) => ({ ...x, __src: 'Relatório Sisbr' as const })),
                          ]
                          const ordered = pend
                            .slice()
                            .sort((a: any, b: any) => Math.abs(ptBrMoneyToCents(String(b?.value ?? '0'))) - Math.abs(ptBrMoneyToCents(String(a?.value ?? '0'))))
                          const top = ordered.slice(0, 8)
                          if (top.length === 0) {
                            return <div className="help">Nenhuma pendência para o contexto atual.</div>
                          }
                          const labels = top.map((p: any) => `${String(p.nome ?? '').trim() || '-'} • ${String(p.__src ?? '')}`)
                          const values = top.map((p: any) => Math.abs(ptBrMoneyToCents(String(p?.value ?? '0'))))
                          const maxAbs = Math.max(...values, 1)
                          const fmt = (cents: number) => `R$ ${centsToPtBr(Math.abs(cents))}`
                          const pendOption = {
                            backgroundColor: 'transparent',
                            grid: { left: 160, right: 18, top: 18, bottom: 18 },
                            tooltip: {
                              trigger: 'item',
                              formatter: (p: any) => `${labels[p?.dataIndex] ?? ''}<br/>${fmt(Number(p?.value ?? 0))}`,
                            },
                            xAxis: {
                              type: 'value',
                              min: 0,
                              max: Math.ceil(maxAbs * 1.15),
                              axisLabel: {
                                color: 'rgba(255,255,255,0.55)',
                                formatter: (v: number) => `R$ ${centsToPtBr(Number(v) || 0)}`,
                              },
                              splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
                              axisLine: { lineStyle: { color: 'rgba(255,255,255,0.10)' } },
                            },
                            yAxis: {
                              type: 'category',
                              data: labels,
                              axisLabel: {
                                color: 'rgba(255,255,255,0.78)',
                                fontWeight: 800,
                                formatter: (v: string) => (String(v).length > 28 ? `${String(v).slice(0, 28)}…` : String(v)),
                              },
                              axisTick: { show: false },
                              axisLine: { show: false },
                            },
                            series: [
                              {
                                type: 'bar',
                                barWidth: 14,
                                data: values.map((v, idx) => ({
                                  value: v,
                                  itemStyle: {
                                    color: idx % 2 === 0 ? '#F5C542' : 'rgba(245,197,66,0.72)',
                                    borderRadius: [999, 999, 999, 999],
                                    shadowColor: 'rgba(0,0,0,0.18)',
                                    shadowBlur: 10,
                                  },
                                })),
                                emphasis: {
                                  itemStyle: {
                                    shadowColor: 'rgba(0,0,0,0.35)',
                                    shadowBlur: 18,
                                  },
                                },
                              },
                            ],
                          }
                          return (
                            <div onClick={() => setHash('conciliacao-extratos')} style={{ cursor: 'pointer' }}>
                              <ReactECharts
                                option={pendOption}
                                style={{ height: 260, width: '100%' }}
                                opts={{ renderer: 'canvas' }}
                              />
                            </div>
                          )
                        })()
                      ) : (
                        <div className="help">
                          Carregue uma conciliação para visualizar pendências.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-head">
                      <h2>Pareto de pendências</h2>
                      <span className="chip">
                        <Zap size={16} />
                        80/20
                      </span>
                    </div>
                    <div className="panel-body">
                      {conciliacaoData ? (
                        (() => {
                          const recursoPend = (conciliacaoData.recurso ?? [])
                            .filter((x: any) => x?.status === 'pendencia')
                            .map((x: any) => ({ ...x, __src: 'Recurso' as const }))
                          const relatorioPend = (conciliacaoData.relatorio ?? [])
                            .filter((x: any) => x?.status === 'pendencia')
                            .map((x: any) => ({ ...x, __src: 'Relatório Sisbr' as const }))
                          const pend = [...recursoPend, ...relatorioPend]
                          const byKey = new Map<string, { nome: string; cpf: string; cents: number }>()
                          for (const p of pend) {
                            const key = normalizeLinkKey(String(p?.cpf ?? ''), String(p?.nome ?? ''))
                            const current = byKey.get(key)
                            const add = Math.abs(ptBrMoneyToCents(String(p?.value ?? '0')))
                            if (current) current.cents += add
                            else
                              byKey.set(key, {
                                nome: String(p?.nome ?? '').trim(),
                                cpf: String(p?.cpf ?? '').trim(),
                                cents: add,
                              })
                          }
                          const ordered = Array.from(byKey.values()).sort((a, b) => b.cents - a.cents)
                          const top = ordered.slice(0, 10)
                          const total = ordered.reduce((acc, x) => acc + x.cents, 0) || 1
                          const labels = top.map((x) => {
                            const name = x.nome || '-'
                            return name.length > 22 ? `${name.slice(0, 22)}…` : name
                          })
                          const values = top.map((x) => x.cents)
                          let running = 0
                          const pct = top.map((x) => {
                            running += x.cents
                            return Math.round((running / total) * 100)
                          })
                          const option = {
                            backgroundColor: 'transparent',
                            tooltip: {
                              trigger: 'axis',
                              axisPointer: { type: 'shadow' },
                              formatter: (params: any[]) => {
                                const idx = Number(params?.[0]?.dataIndex ?? 0)
                                const row = top[idx]
                                if (!row) return ''
                                return [
                                  `<b>${row.nome || '-'}</b>`,
                                  `CPF: ${row.cpf || '-'}`,
                                  `Valor: R$ ${centsToPtBr(row.cents)}`,
                                  `Acumulado: ${pct[idx]}%`,
                                ].join('<br/>')
                              },
                            },
                            grid: { left: 44, right: 44, top: 18, bottom: 40, containLabel: true },
                            xAxis: {
                              type: 'category',
                              data: labels,
                              axisLabel: {
                                color: 'rgba(255,255,255,0.62)',
                                fontWeight: 800,
                                interval: 0,
                                rotate: 25,
                              },
                              axisTick: { show: false },
                              axisLine: { lineStyle: { color: 'rgba(255,255,255,0.10)' } },
                            },
                            yAxis: [
                              {
                                type: 'value',
                                axisLabel: {
                                  color: 'rgba(255,255,255,0.55)',
                                  formatter: (v: number) => `R$ ${centsToPtBr(Math.abs(Number(v) || 0))}`,
                                },
                                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
                              },
                              {
                                type: 'value',
                                min: 0,
                                max: 100,
                                axisLabel: { color: 'rgba(255,255,255,0.55)', formatter: '{value}%' },
                                splitLine: { show: false },
                              },
                            ],
                            series: [
                              {
                                name: 'Valor',
                                type: 'bar',
                                data: values,
                                barWidth: 14,
                                itemStyle: { color: '#F5C542', borderRadius: [10, 10, 0, 0] },
                              },
                              {
                                name: 'Acumulado',
                                type: 'line',
                                yAxisIndex: 1,
                                data: pct,
                                smooth: true,
                                symbol: 'circle',
                                symbolSize: 7,
                                lineStyle: { color: '#00AE9D', width: 2 },
                                itemStyle: { color: '#00AE9D' },
                                areaStyle: { color: 'rgba(0,174,157,0.12)' },
                              },
                            ],
                          }
                          return (
                            <ReactECharts option={option} style={{ height: 260, width: '100%' }} opts={{ renderer: 'canvas' }} />
                          )
                        })()
                      ) : (
                        <div className="help">Carregue uma conciliação para visualizar o pareto.</div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="grid">
                  <div className="panel">
                    <div className="panel-head">
                      <h2>Conciliação pronta</h2>
                      <span className="chip">
                        <Sparkles size={16} />
                        Gauge
                      </span>
                    </div>
                    <div className="panel-body">
                      {conciliacaoData ? (
                        (() => {
                          const recurso = Array.isArray(conciliacaoData?.recurso) ? conciliacaoData.recurso : []
                          const relatorio = Array.isArray(conciliacaoData?.relatorio) ? conciliacaoData.relatorio : []
                          const total = recurso.length + relatorio.length
                          const ok =
                            recurso.filter((x: any) => x?.status === 'conciliado').length +
                            relatorio.filter((x: any) => x?.status === 'conciliado').length
                          const pct = total > 0 ? Math.round((ok / total) * 100) : 0
                          const option = {
                            backgroundColor: 'transparent',
                            series: [
                              {
                                type: 'gauge',
                                startAngle: 210,
                                endAngle: -30,
                                radius: '100%',
                                progress: { show: true, width: 16 },
                                axisLine: {
                                  lineStyle: {
                                    width: 16,
                                    color: [
                                      [0.6, '#F5C542'],
                                      [0.9, '#00AE9D'],
                                      [1, '#00AE9D'],
                                    ],
                                  },
                                },
                                axisTick: { show: false },
                                splitLine: { show: false },
                                axisLabel: { show: false },
                                pointer: { show: true, length: '65%', width: 6 },
                                anchor: { show: true, size: 10, itemStyle: { color: '#00AE9D' } },
                                detail: {
                                  valueAnimation: true,
                                  formatter: `{value}%`,
                                  color: 'rgba(255,255,255,0.92)',
                                  fontSize: 18,
                                  fontWeight: 900,
                                  offsetCenter: [0, '12%'],
                                },
                                title: {
                                  show: true,
                                  offsetCenter: [0, '48%'],
                                  color: 'rgba(255,255,255,0.65)',
                                  fontSize: 12,
                                  fontWeight: 800,
                                },
                                data: [{ value: pct, name: `${ok}/${total} conciliados` }],
                              },
                            ],
                          }
                          return (
                            <div style={{ display: 'grid', gap: 10 }}>
                              <ReactECharts option={option} style={{ height: 260, width: '100%' }} opts={{ renderer: 'canvas' }} />
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                <span className="chip">
                                  <Sparkles size={16} />
                                  {ok} conciliados
                                </span>
                                <span className="chip">
                                  <Zap size={16} />
                                  {total - ok} pendências
                                </span>
                              </div>
                            </div>
                          )
                        })()
                      ) : (
                        <div className="help">Carregue uma conciliação para visualizar o gauge.</div>
                      )}
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-head">
                      <h2>Matriz de totais</h2>
                      <span className="chip">
                        <BadgeDollarSign size={16} />
                        Radar
                      </span>
                    </div>
                    <div className="panel-body">
                      {conciliacaoData ? (
                        (() => {
                          const totals = conciliacaoData.totals
                          const recurso = Math.abs(Number(totals?.recurso?.cents ?? 0) || 0)
                          const extrato = Math.abs(Number(totals?.extratos?.cents ?? 0) || 0)
                          const relatorio = Math.abs(Number(totals?.relatorio?.cents ?? 0) || 0)
                          const tarifas =
                            Math.abs(Number(totals?.tarifaLinha?.cents ?? 0) || 0) +
                            Math.abs(Number(totals?.tarifaTed?.cents ?? 0) || 0)
                          const diff = Math.abs(Number(totals?.diff?.cents ?? 0) || 0)
                          const max = Math.max(recurso, extrato, relatorio, tarifas, diff, 1)
                          const option = {
                            backgroundColor: 'transparent',
                            radar: {
                              radius: '70%',
                              indicator: [
                                { name: 'Recurso', max: Math.ceil(max * 1.2) },
                                { name: 'Extrato', max: Math.ceil(max * 1.2) },
                                { name: 'Relatório Sisbr', max: Math.ceil(max * 1.2) },
                                { name: 'Tarifas', max: Math.ceil(max * 1.2) },
                                { name: 'Diferença', max: Math.ceil(max * 1.2) },
                              ],
                              splitNumber: 4,
                              axisName: { color: 'rgba(255,255,255,0.78)', fontWeight: 800 },
                              splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
                              splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.00)'] } },
                              axisLine: { lineStyle: { color: 'rgba(255,255,255,0.12)' } },
                            },
                            tooltip: {
                              trigger: 'item',
                              formatter: () =>
                                [
                                  `Recurso: R$ ${centsToPtBr(recurso)}`,
                                  `Extrato: R$ ${centsToPtBr(extrato)}`,
                                  `Relatório Sisbr: R$ ${centsToPtBr(relatorio)}`,
                                  `Tarifas: R$ ${centsToPtBr(tarifas)}`,
                                  `Diferença: R$ ${centsToPtBr(diff)}`,
                                ].join('<br/>'),
                            },
                            series: [
                              {
                                type: 'radar',
                                data: [
                                  {
                                    value: [recurso, extrato, relatorio, tarifas, diff],
                                    name: 'Totais',
                                    areaStyle: { color: 'rgba(0,174,157,0.22)' },
                                    lineStyle: { color: '#00AE9D', width: 2 },
                                    itemStyle: { color: '#00AE9D' },
                                  },
                                ],
                              },
                            ],
                          }
                          return <ReactECharts option={option} style={{ height: 260, width: '100%' }} opts={{ renderer: 'canvas' }} />
                        })()
                      ) : (
                        <div className="help">Carregue uma conciliação para visualizar a matriz.</div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="grid">
                  <div className="panel">
                    <div className="panel-head">
                      <h2>Distribuição por faixa</h2>
                      <span className="chip">
                        <Sparkles size={16} />
                        Histograma
                      </span>
                    </div>
                    <div className="panel-body">
                      {conciliacaoData ? (
                        (() => {
                          const bins = [
                            { label: '0–100', min: 0, max: 10000 },
                            { label: '100–500', min: 10000, max: 50000 },
                            { label: '500–1k', min: 50000, max: 100000 },
                            { label: '1k–5k', min: 100000, max: 500000 },
                            { label: '5k–10k', min: 500000, max: 1000000 },
                            { label: '10k+', min: 1000000, max: Infinity },
                          ]
                          const recursoPend = (conciliacaoData.recurso ?? []).filter((x: any) => x?.status === 'pendencia')
                          const relatorioPend = (conciliacaoData.relatorio ?? []).filter((x: any) => x?.status === 'pendencia')
                          const countRecurso = bins.map(() => 0)
                          const countRelatorio = bins.map(() => 0)
                          const sumRecurso = bins.map(() => 0)
                          const sumRelatorio = bins.map(() => 0)
                          const put = (arr: any[], count: number[], sum: number[]) => {
                            for (const it of arr) {
                              const cents = Math.abs(ptBrMoneyToCents(String(it?.value ?? '0')))
                              const idx = bins.findIndex((b) => cents >= b.min && cents < b.max)
                              const safe = idx >= 0 ? idx : bins.length - 1
                              count[safe] += 1
                              sum[safe] += cents
                            }
                          }
                          put(recursoPend, countRecurso, sumRecurso)
                          put(relatorioPend, countRelatorio, sumRelatorio)
                          const option = {
                            backgroundColor: 'transparent',
                            tooltip: {
                              trigger: 'axis',
                              axisPointer: { type: 'shadow' },
                              formatter: (params: any[]) => {
                                const idx = Number(params?.[0]?.dataIndex ?? 0)
                                const title = bins[idx]?.label ?? ''
                                return [
                                  `<b>R$ ${title}</b>`,
                                  `Recurso: ${countRecurso[idx]} (${`R$ ${centsToPtBr(sumRecurso[idx])}`})`,
                                  `Relatório Sisbr: ${countRelatorio[idx]} (${`R$ ${centsToPtBr(sumRelatorio[idx])}`})`,
                                ].join('<br/>')
                              },
                            },
                            legend: {
                              top: 0,
                              textStyle: { color: 'rgba(255,255,255,0.72)', fontWeight: 800 },
                            },
                            grid: { left: 34, right: 18, top: 36, bottom: 18, containLabel: true },
                            xAxis: {
                              type: 'category',
                              data: bins.map((b) => b.label),
                              axisLabel: { color: 'rgba(255,255,255,0.62)', fontWeight: 800 },
                              axisTick: { show: false },
                              axisLine: { lineStyle: { color: 'rgba(255,255,255,0.10)' } },
                            },
                            yAxis: {
                              type: 'value',
                              axisLabel: { color: 'rgba(255,255,255,0.55)' },
                              splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
                            },
                            series: [
                              {
                                name: 'Recurso',
                                type: 'bar',
                                stack: 'count',
                                barWidth: 16,
                                data: countRecurso,
                                itemStyle: { color: '#F5C542', borderRadius: [10, 10, 0, 0] },
                              },
                              {
                                name: 'Relatório Sisbr',
                                type: 'bar',
                                stack: 'count',
                                barWidth: 16,
                                data: countRelatorio,
                                itemStyle: { color: '#00AE9D', borderRadius: [10, 10, 0, 0] },
                              },
                            ],
                          }
                          return <ReactECharts option={option} style={{ height: 260, width: '100%' }} opts={{ renderer: 'canvas' }} />
                        })()
                      ) : (
                        <div className="help">Carregue uma conciliação para visualizar a distribuição.</div>
                      )}
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-head">
                      <h2>Ocorrências no tempo</h2>
                      <span className="chip">
                        <ShieldCheck size={16} />
                        Trilha
                      </span>
                    </div>
                    <div className="panel-body">
                      {conciliacaoData ? (
                        (() => {
                          const rel = Array.isArray(conciliacaoData?.relatorio) ? conciliacaoData.relatorio : []
                          const events = rel
                            .filter((x: any) => x?.ocorrencia && x.ocorrencia?.createdAt)
                            .map((x: any) => ({
                              day: String(x.ocorrencia.createdAt).slice(0, 10),
                              action: String(x.ocorrencia.action ?? 'outros'),
                            }))
                          if (events.length === 0) {
                            return <div className="help">Nenhuma ocorrência registrada para o contexto atual.</div>
                          }
                          const countByAction = new Map<string, number>()
                          const countByDayAction = new Map<string, number>()
                          for (const e of events) {
                            countByAction.set(e.action, (countByAction.get(e.action) ?? 0) + 1)
                            const k = `${e.day}||${e.action}`
                            countByDayAction.set(k, (countByDayAction.get(k) ?? 0) + 1)
                          }
                          const topActions = Array.from(countByAction.entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 4)
                            .map(([k]) => k)
                          const actions = [...topActions, 'Outros']
                          const days = Array.from(new Set(events.map((e) => e.day))).sort()
                          const fmtDay = (d: string) => {
                            const dd = d.slice(8, 10)
                            const mm = d.slice(5, 7)
                            return `${dd}/${mm}`
                          }
                          const series = actions.map((a) => {
                            const data = days.map((day) => {
                              const key = `${day}||${a}`
                              if (a === 'Outros') {
                                let sum = 0
                                for (const e of events) {
                                  if (e.day !== day) continue
                                  if (topActions.includes(e.action)) continue
                                  sum += 1
                                }
                                return sum
                              }
                              return countByDayAction.get(key) ?? 0
                            })
                            return {
                              name: a,
                              type: 'bar',
                              stack: 'occ',
                              barWidth: 14,
                              emphasis: { focus: 'series' },
                              data,
                            }
                          })
                          const totals = days.map((day) => events.filter((e) => e.day === day).length)
                          const option = {
                            backgroundColor: 'transparent',
                            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                            legend: { top: 0, textStyle: { color: 'rgba(255,255,255,0.70)', fontWeight: 800 } },
                            grid: { left: 34, right: 18, top: 36, bottom: 18, containLabel: true },
                            xAxis: {
                              type: 'category',
                              data: days.map(fmtDay),
                              axisLabel: { color: 'rgba(255,255,255,0.62)', fontWeight: 800 },
                              axisTick: { show: false },
                              axisLine: { lineStyle: { color: 'rgba(255,255,255,0.10)' } },
                            },
                            yAxis: {
                              type: 'value',
                              axisLabel: { color: 'rgba(255,255,255,0.55)' },
                              splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
                            },
                            series: [
                              ...series.map((s: any, idx: number) => ({
                                ...s,
                                itemStyle: {
                                  color:
                                    idx === 0
                                      ? '#00AE9D'
                                      : idx === 1
                                        ? '#F5C542'
                                        : idx === 2
                                          ? 'rgba(255,255,255,0.55)'
                                          : idx === 3
                                            ? 'rgba(255, 99, 132, 0.75)'
                                            : 'rgba(255,255,255,0.25)',
                                  borderRadius: [10, 10, 0, 0],
                                },
                              })),
                              {
                                name: 'Total',
                                type: 'line',
                                data: totals,
                                smooth: true,
                                symbol: 'circle',
                                symbolSize: 7,
                                lineStyle: { color: 'rgba(255,255,255,0.70)', width: 2 },
                                itemStyle: { color: 'rgba(255,255,255,0.80)' },
                              },
                            ],
                          }
                          return <ReactECharts option={option} style={{ height: 260, width: '100%' }} opts={{ renderer: 'canvas' }} />
                        })()
                      ) : (
                        <div className="help">Carregue uma conciliação para visualizar as ocorrências.</div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="grid">
                  <div className="panel" style={{ gridColumn: '1 / -1' }}>
                    <div className="panel-head">
                      <h2>Empresa × Modalidade</h2>
                      <span className="chip">
                        <Sparkles size={16} />
                        Heatmap
                      </span>
                    </div>
                    <div className="panel-body">
                      {conciliacaoData ? (
                        (() => {
                          const rel = Array.isArray(conciliacaoData?.relatorio) ? conciliacaoData.relatorio : []
                          const relPend = rel.filter((x: any) => x?.status === 'pendencia')
                          const base = relPend.length > 0 ? relPend : rel
                          const countEmpresa = new Map<string, number>()
                          const countModalidade = new Map<string, number>()
                          const getKey = (v: any) => String(v ?? '').trim() || '—'
                          for (const it of base) {
                            const e = getKey((it as any)?.empresa)
                            const m = getKey((it as any)?.modalidade)
                            countEmpresa.set(e, (countEmpresa.get(e) ?? 0) + 1)
                            countModalidade.set(m, (countModalidade.get(m) ?? 0) + 1)
                          }
                          const topEmpresas = Array.from(countEmpresa.entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 12)
                            .map(([k]) => k)
                          const topModalidades = Array.from(countModalidade.entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 8)
                            .map(([k]) => k)
                          const empresas = topEmpresas.includes('Outros') ? topEmpresas : [...topEmpresas, 'Outros']
                          const modalidades = topModalidades.includes('Outros') ? topModalidades : [...topModalidades, 'Outros']
                          const idxE = new Map(empresas.map((v, i) => [v, i]))
                          const idxM = new Map(modalidades.map((v, i) => [v, i]))
                          const matrix = new Map<string, number>()
                          const key = (xi: number, yi: number) => `${xi}||${yi}`
                          for (const it of base) {
                            const e0 = getKey((it as any)?.empresa)
                            const m0 = getKey((it as any)?.modalidade)
                            const e = idxE.has(e0) ? e0 : 'Outros'
                            const m = idxM.has(m0) ? m0 : 'Outros'
                            const xi = idxM.get(m) ?? 0
                            const yi = idxE.get(e) ?? 0
                            const k = key(xi, yi)
                            matrix.set(k, (matrix.get(k) ?? 0) + 1)
                          }
                          const data: Array<[number, number, number]> = []
                          let max = 0
                          for (let yi = 0; yi < empresas.length; yi++) {
                            for (let xi = 0; xi < modalidades.length; xi++) {
                              const v = matrix.get(key(xi, yi)) ?? 0
                              max = Math.max(max, v)
                              data.push([xi, yi, v])
                            }
                          }
                          const option = {
                            backgroundColor: 'transparent',
                            tooltip: {
                              position: 'top',
                              formatter: (p: any) => {
                                const [xi, yi, v] = p?.value ?? []
                                const m = modalidades[xi] ?? ''
                                const e = empresas[yi] ?? ''
                                return `${e}<br/>${m}: <b>${v ?? 0}</b>`
                              },
                            },
                            grid: { left: 150, right: 18, top: 18, bottom: 18 },
                            xAxis: {
                              type: 'category',
                              data: modalidades,
                              axisLabel: { color: 'rgba(255,255,255,0.62)', fontWeight: 800 },
                              axisLine: { lineStyle: { color: 'rgba(255,255,255,0.10)' } },
                              axisTick: { show: false },
                              splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.02)'] } },
                            },
                            yAxis: {
                              type: 'category',
                              data: empresas,
                              axisLabel: {
                                color: 'rgba(255,255,255,0.78)',
                                fontWeight: 800,
                                formatter: (v: string) => (String(v).length > 22 ? `${String(v).slice(0, 22)}…` : String(v)),
                              },
                              axisLine: { show: false },
                              axisTick: { show: false },
                              splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.02)'] } },
                            },
                            visualMap: {
                              min: 0,
                              max: Math.max(max, 1),
                              calculable: false,
                              orient: 'horizontal',
                              left: 'center',
                              bottom: 0,
                              inRange: {
                                color: ['rgba(255,255,255,0.06)', 'rgba(0,174,157,0.25)', '#00AE9D'],
                              },
                              textStyle: { color: 'rgba(255,255,255,0.65)', fontWeight: 800 },
                            },
                            series: [
                              {
                                type: 'heatmap',
                                data,
                                label: { show: false },
                                emphasis: {
                                  itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.35)' },
                                },
                              },
                            ],
                          }
                          return <ReactECharts option={option} style={{ height: 300, width: '100%' }} opts={{ renderer: 'canvas' }} />
                        })()
                      ) : (
                        <div className="help">Carregue uma conciliação para visualizar o heatmap.</div>
                      )}
                    </div>
                  </div>
                </section>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
