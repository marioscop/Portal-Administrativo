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
import {
  BadgeDollarSign,
  ChevronDown,
  FileText,
  Home,
  Info,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
  Clock,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react'

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
      }
    }>
    message?: string
  }>(null)
  const [cloneSisbrModal, setCloneSisbrModal] = useState<null | {
    cpf: string
    nome: string
    value: string
  }>(null)
  const [cloneSisbrLoading, setCloneSisbrLoading] = useState(false)
  const [cloneSisbrError, setCloneSisbrError] = useState<string | null>(null)
  const [cloneSisbrAction, setCloneSisbrAction] = useState('clonar_para_relatorio_sisbr')
  const [cloneSisbrJustification, setCloneSisbrJustification] = useState('')
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
  const [ocorrenciaModal, setOcorrenciaModal] = useState<null | {
    nome: string
    cpf: string
    value: string
    empresa: string | null
    ocorrencia: null | { id: number; createdAt: string; action: string; justification: string }
  }>(null)
  const [relatorioOcorrenciaAction, setRelatorioOcorrenciaAction] = useState(
    'alterar_orgao_relatorio_sisbr',
  )
  const [relatorioOcorrenciaToOrgao, setRelatorioOcorrenciaToOrgao] = useState('')
  const [relatorioOcorrenciaJustification, setRelatorioOcorrenciaJustification] = useState('')
  const [relatorioOcorrenciaSaving, setRelatorioOcorrenciaSaving] = useState(false)
  const [relatorioOcorrenciaError, setRelatorioOcorrenciaError] = useState<string | null>(null)
  const [conciliacaoExportingXlsx, setConciliacaoExportingXlsx] = useState(false)
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
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null)
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null)

  const isMain = view === 'home' || view === 'dashboard'

  useEffect(() => {
    const msalInstance = (window as any).__msalInstance as
      | {
          getActiveAccount: () => { name?: string; username?: string } | null
          getAllAccounts: () => Array<{ name?: string; username?: string }>
          setActiveAccount: (acc: any) => void
          acquireTokenSilent: (req: any) => Promise<{ accessToken: string }>
        }
      | undefined

    if (!msalInstance) return
    const accounts = msalInstance.getAllAccounts()
    if (!msalInstance.getActiveAccount() && accounts.length > 0) {
      msalInstance.setActiveAccount(accounts[0])
    }
    const active = msalInstance.getActiveAccount()
    const baseNameRaw = (active?.name || active?.username || '').trim()
    const baseName = baseNameRaw.toUpperCase()
    const display =
      !baseName
        ? 'SICOOB JURISCRED'
        : baseName.includes('|') || baseName.includes('SICOOB JURISCRED')
          ? baseName
          : `${baseName} | SICOOB JURISCRED`
    setUserDisplayName(display)

    let cancelled = false
    let objectUrl: string | null = null
    msalInstance
      .acquireTokenSilent({
        scopes: ['User.Read'],
        account: active,
      })
      .then(async (t) => {
        const res = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
          headers: { Authorization: `Bearer ${t.accessToken}` },
        })
        if (!res.ok) return null
        const blob = await res.blob()
        return URL.createObjectURL(blob)
      })
      .then((url) => {
        if (cancelled) return
        if (url) {
          objectUrl = url
          setUserPhotoUrl(url)
        }
      })
      .catch(() => {
        return
      })

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
              message?: string
            }
        if (!res.ok) {
          throw new Error(data?.message || `Falha ao carregar configuração (HTTP ${res.status}).`)
        }
        if (cancelled) return
        const remote = typeof data?.sharePointFolderUrl === 'string' ? data!.sharePointFolderUrl!.trim() : ''
        const remoteAlego = typeof data?.recursoAlegoUrl === 'string' ? data!.recursoAlegoUrl!.trim() : ''
        const remoteMpgo = typeof data?.recursoMpgoUrl === 'string' ? data!.recursoMpgoUrl!.trim() : ''
        if (remote) setSharePointFolderPath(remote)
        if (remoteAlego) setRecursoAlegoUrl(remoteAlego)
        if (remoteMpgo) setRecursoMpgoUrl(remoteMpgo)
        if (remote) return
        if (didAutoMigrateSharePointFolderPathRef.current) return
        didAutoMigrateSharePointFolderPathRef.current = true
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY)
          const parsed = raw ? (JSON.parse(raw) as { sharePointFolderPath?: string }) : null
          const local = typeof parsed?.sharePointFolderPath === 'string' ? parsed.sharePointFolderPath.trim() : ''
          if (!local) return
          await saveAutomationConfigToServer({
            sharePointFolderUrl: local,
            recursoAlegoUrl: remoteAlego || null,
            recursoMpgoUrl: remoteMpgo || null,
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
    if (view !== 'configuracoes-automacao' && view !== 'conciliacao-extratos')
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
    if (view === 'relatorios-valores') return 'Valores a Descontar'
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
    if (view !== 'conciliacao-extratos') return
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
    if (view !== 'conciliacao-extratos') return
    if (!conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)) return
    if (!conciliacaoOrgao.trim()) {
      setConciliacaoData(null)
      setConciliacaoExpandedKeys([])
      setConciliacaoSelectedPairId(null)
      setConciliacaoSelectedPersonKey(null)
      return
    }

    const requestId = conciliacaoFetchRef.current + 1
    conciliacaoFetchRef.current = requestId

    Promise.resolve().then(() => {
      setConciliacaoLoading(true)
      setConciliacaoError(null)
    })

    const orgaoQuery = `&orgao=${encodeURIComponent(conciliacaoOrgao.trim())}`
    fetch(
      `/api/consignado/conciliacao/recurso-vs-relatorio?month=${encodeURIComponent(conciliacaoMonth)}${orgaoQuery}`,
    )
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as ConciliacaoResponse | null
        if (!res.ok) {
          throw new Error(
            data && 'message' in data ? data.message : `Falha ao conciliar (HTTP ${res.status}).`,
          )
        }
        if (conciliacaoFetchRef.current !== requestId) return
        setConciliacaoData(data as NonNullable<typeof conciliacaoData>)
        setConciliacaoExpandedKeys([])
        setConciliacaoSelectedPairId(null)
        setConciliacaoSelectedPersonKey(null)
      })
      .catch((e) => {
        if (conciliacaoFetchRef.current !== requestId) return
        const message = e instanceof Error ? e.message : 'Falha ao conciliar.'
        setConciliacaoError(message)
        setConciliacaoData(null)
        setConciliacaoSelectedPairId(null)
        setConciliacaoSelectedPersonKey(null)
      })
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
      const res = await fetch(
        `/api/consignado/conciliacao/recurso-vs-relatorio?month=${encodeURIComponent(conciliacaoMonth)}${orgaoQuery}`,
      )
      const data = (await res.json().catch(() => null)) as ConciliacaoResponse | null
      if (!res.ok) {
        throw new Error(
          data && 'message' in data ? data.message : `Falha ao conciliar (HTTP ${res.status}).`,
        )
      }
      if (conciliacaoFetchRef.current !== requestId) return
      setConciliacaoData(data as NonNullable<typeof conciliacaoData>)
      setConciliacaoSelectedPairId(null)
      setConciliacaoSelectedPersonKey(null)
    } finally {
      if (conciliacaoFetchRef.current !== requestId) return
      setConciliacaoLoading(false)
    }
  }

  const exportConciliacaoXlsx = async () => {
    if (!canExportConciliacaoXlsx) return
    if (!conciliacaoOrgao.trim()) return
    if (!conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)) return
    if (!conciliacaoExpandedKeys.includes('__MONTH__')) return
    const data = conciliacaoData as NonNullable<typeof conciliacaoData>

    const sanitizeFileName = (v: string) =>
      v
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 140)

    const monthLabel =
      conciliacaoMonthOptions.find((o) => o.value === conciliacaoMonth)?.label ?? conciliacaoMonth
    const orgaoLabel = conciliacaoOrgao.trim()

    setConciliacaoExportingXlsx(true)
    setConciliacaoError(null)
    try {
      const mod = (await import('exceljs')) as any
      const workbook = new mod.Workbook()
      workbook.creator = 'Portal Administrativo'
      workbook.created = new Date()

      const logoRes = await fetch('/assets/sicoob-juriscred_Logo Verde.png').catch(() => null)
      const logoBuf = logoRes && logoRes.ok ? await logoRes.arrayBuffer() : null
      const logoId = logoBuf
        ? workbook.addImage({
            buffer: logoBuf,
            extension: 'png',
          })
        : null

      const hostEl = conciliacaoLinkHostRef.current
      let screenshot: null | { buffer: ArrayBuffer; width: number; height: number } = null
      if (hostEl) {
        try {
          const html2canvas = (await import('html2canvas')).default as any
          const canvas = await html2canvas(hostEl, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#0B1320',
            scale: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
          })
          const blob: Blob | null = await new Promise((resolve) => {
            canvas.toBlob((b: Blob | null) => resolve(b), 'image/png')
          })
          if (blob) {
            const buf = await blob.arrayBuffer()
            screenshot = { buffer: buf, width: canvas.width, height: canvas.height }
          }
        } catch {
          screenshot = null
        }
      }

      if (screenshot) {
        const wsFoto = workbook.addWorksheet('Foto')
        wsFoto.columns = [{ width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }]
        if (logoId) {
          wsFoto.addImage(logoId, {
            tl: { col: 0, row: 0 },
            ext: { width: 240, height: 55 },
          })
        }
        wsFoto.getRow(1).height = 46
        wsFoto.mergeCells(2, 1, 2, 6)
        const t = wsFoto.getCell(2, 1)
        t.value = `Conciliação • Extratos — ${monthLabel} — ${orgaoLabel}`
        t.font = { bold: true, size: 14, color: { argb: 'FF0B2A1F' } }
        t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7F5EF' } }
        t.alignment = { vertical: 'middle', horizontal: 'left' }
        wsFoto.getRow(2).height = 28

        const shotId = workbook.addImage({ buffer: screenshot.buffer, extension: 'png' })
        const maxWidth = 1120
        const scale = Math.min(1, maxWidth / Math.max(1, screenshot.width))
        const width = Math.round(screenshot.width * scale)
        const height = Math.round(screenshot.height * scale)
        wsFoto.addImage(shotId, {
          tl: { col: 0, row: 3 },
          ext: { width, height },
        })
      }

      const ws = workbook.addWorksheet('Tabela')
      if (logoId) {
        ws.addImage(logoId, {
          tl: { col: 0, row: 0 },
          ext: { width: 240, height: 55 },
        })
      }
      ws.getRow(1).height = 46

      const titleRowIndex = 2
      ws.mergeCells(titleRowIndex, 1, titleRowIndex, 12)
      const titleCell = ws.getCell(titleRowIndex, 1)
      titleCell.value = `Conciliação • Extratos — ${monthLabel} — ${orgaoLabel}`
      titleCell.font = { bold: true, size: 14, color: { argb: 'FF0B2A1F' } }
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7F5EF' },
      }
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
      ws.getRow(titleRowIndex).height = 28

      const headerRowIndex = 4
      const headers = [
        'Origem',
        'CPF',
        'Nome',
        'Valor',
        'Status',
        'PairId',
        'Competência',
        'Vencimento',
        'Modalidade',
        'Empresa',
        'Ocorrência Ação',
        'Ocorrência Justificativa',
      ]

      const headerRow = ws.getRow(headerRowIndex)
      for (let i = 0; i < headers.length; i++) {
        const cell = headerRow.getCell(i + 1)
        cell.value = headers[i]
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF006B4F' },
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF0B2A1F' } },
          left: { style: 'thin', color: { argb: 'FF0B2A1F' } },
          bottom: { style: 'thin', color: { argb: 'FF0B2A1F' } },
          right: { style: 'thin', color: { argb: 'FF0B2A1F' } },
        }
      }
      headerRow.height = 22

      ws.columns = [
        { width: 12 },
        { width: 16 },
        { width: 36 },
        { width: 14 },
        { width: 16 },
        { width: 10 },
        { width: 14 },
        { width: 14 },
        { width: 16 },
        { width: 44 },
        { width: 28 },
        { width: 46 },
      ]

      const rowBaseIndex = headerRowIndex + 1
      const rows: Array<{
        origem: string
        cpf: string
        nome: string
        value: string
        status: string
        pairId: string | null
        competencia: string | null
        vencimento: string | null
        modalidade: string | null
        empresa: string | null
        occAction: string | null
        occJust: string | null
      }> = []

      if ('recurso' in data && Array.isArray((data as any).recurso)) {
        for (const r of (data as any).recurso as any[]) {
          rows.push({
            origem: 'Recurso',
            cpf: String(r.cpf ?? ''),
            nome: String(r.nome ?? ''),
            value: String(r.value ?? ''),
            status: String(r.status ?? ''),
            pairId: (r.pairId ?? null) as string | null,
            competencia: null,
            vencimento: null,
            modalidade: null,
            empresa: null,
            occAction: null,
            occJust: null,
          })
        }
      }

      if ('relatorio' in data && Array.isArray((data as any).relatorio)) {
        for (const r of (data as any).relatorio as any[]) {
          const occ = r.ocorrencia ?? null
          rows.push({
            origem: 'Relatório',
            cpf: String(r.cpf ?? ''),
            nome: String(r.nome ?? ''),
            value: String(r.value ?? ''),
            status: String(r.status ?? ''),
            pairId: (r.pairId ?? null) as string | null,
            competencia: typeof r.competencia === 'string' ? r.competencia : null,
            vencimento: typeof r.vencimento === 'string' ? r.vencimento : null,
            modalidade: typeof r.modalidade === 'string' ? r.modalidade : null,
            empresa: typeof r.empresa === 'string' ? r.empresa : null,
            occAction: typeof occ?.action === 'string' ? occ.action : null,
            occJust: typeof occ?.justification === 'string' ? occ.justification : null,
          })
        }
      }

      for (let i = 0; i < rows.length; i++) {
        const rowIndex = rowBaseIndex + i
        const row = ws.getRow(rowIndex)
        const r = rows[i]
        const values = [
          r.origem,
          r.cpf,
          r.nome,
          r.value,
          r.status === 'conciliado' ? 'Conciliado' : 'Não conciliado',
          r.pairId ?? '',
          r.competencia ?? '',
          r.vencimento ?? '',
          r.modalidade ?? '',
          r.empresa ?? '',
          r.occAction ?? '',
          r.occJust ?? '',
        ]
        for (let c = 0; c < values.length; c++) {
          const cell = row.getCell(c + 1)
          cell.value = values[c]
          cell.alignment = { vertical: 'top', horizontal: c === 3 ? 'right' : 'left', wrapText: true }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          }
        }

        const statusCell = row.getCell(5)
        const isOk = r.status === 'conciliado'
        statusCell.font = { bold: true, color: { argb: isOk ? 'FF16A34A' : 'FFDC2626' } }
        row.height = 18
      }

      ws.views = [{ state: 'frozen', ySplit: headerRowIndex }]

      const out = (await workbook.xlsx.writeBuffer()) as unknown
      const bytes =
        out instanceof ArrayBuffer
          ? new Uint8Array(out)
          : out instanceof Uint8Array
            ? out
            : new Uint8Array(out as ArrayBufferLike)
      const safeBuf = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(safeBuf).set(bytes)
      const blob = new Blob([safeBuf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const fileName = `Conciliação_Extratos_${sanitizeFileName(monthLabel)}_${sanitizeFileName(orgaoLabel)}.xlsx`
      const navAny = navigator as any
      if (typeof navAny?.msSaveOrOpenBlob === 'function') {
        navAny.msSaveOrOpenBlob(blob, fileName)
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao exportar XLSX.'
      setConciliacaoError(msg)
    } finally {
      setConciliacaoExportingXlsx(false)
    }
  }

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

  return (
    <div className="credito-root">
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
          background:
            radial-gradient(18px 18px at 30% 30%, rgba(255,255,255,0.35) 0%, transparent 60%),
            linear-gradient(135deg, rgba(0,174,157,0.92) 0%, rgba(0,54,65,0.92) 100%);
          box-shadow: 0 16px 35px rgba(0,174,157,0.18);
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

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
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

        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .form-grid-3 {
          grid-template-columns: 1fr;
        }

        @media (min-width: 900px) {
          .form-grid { grid-template-columns: 1fr 1fr; }
          .form-grid-3 { grid-template-columns: 160px 1fr 260px; }
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

        .stat {
          border-radius: 18px;
          padding: 14px 14px;
          border: 1px solid rgba(255,255,255,0.12);
          background:
            radial-gradient(240px 140px at 20% 20%, rgba(0,174,157,0.18) 0%, transparent 70%),
            rgba(255,255,255,0.05);
          position: relative;
          overflow: hidden;
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
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .stat .label {
          font-size: 0.78rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.65);
          font-weight: 800;
        }

        .stat .value {
          margin-top: 10px;
          font-size: 1.5rem;
          font-weight: 820;
          letter-spacing: 0.02em;
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
                  <strong>Valores</strong>
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
                </div>
              </div>
              <div className="header-actions">
                {userDisplayName ? (
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
                          {(userDisplayName.split('|')[0] || 'U')
                            .trim()
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.02em' }}>
                      {userDisplayName}
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
                            await msal?.logoutRedirect({ postLogoutRedirectUri: window.location.origin })
                          } catch {
                            return
                          }
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
                ) : (
                  <button
                    type="button"
                    onClick={() => (window.location.href = '/')}
                    aria-label="Home"
                    title="Home"
                    style={{
                      width: 38,
                      height: 38,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 12,
                      border: 0,
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      opacity: 0.9,
                    }}
                  >
                    <Home size={18} />
                  </button>
                )}
              </div>
            </header>

            {isMain ? (
              <section className="toolbar">
              <div className="search">
                <Search size={18} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por contrato, CPF (mascarado), cooperado, produto..."
                />
              </div>
              <div className="panel">
                <div className="panel-head">
                  <h2>Modo Operação</h2>
                  <span className="chip">
                    <ShieldCheck size={16} />
                    Governança
                  </span>
                </div>
                <div className="panel-body">
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span className="chip">
                        <Zap size={16} />
                        Alta Prioridade
                      </span>
                      <span className="chip">
                        <Sparkles size={16} />
                        UX First
                      </span>
                      <span className="chip">
                        <BadgeDollarSign size={16} />
                        Crédito
                      </span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 600, lineHeight: 1.5 }}>
                      Página inicial do módulo (sem integração). A estrutura já está pronta para evoluir
                      com dados, filtros e ações de negociação.
                    </div>
                  </div>
                </div>
              </div>
              </section>
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
                        placeholder="ex.: financeiro@sicoobjuriscred.com.br"
                        disabled={settingsLocked}
                      />
                    </div>
                    <div className="field">
                      <label>E-mail contabilidade</label>
                      <input
                        className="control"
                        type="email"
                        value={notificationEmailContabilidade}
                        onChange={(e) =>
                          setNotificationEmailContabilidade(e.target.value)
                        }
                        placeholder="ex.: contabilidade@sicoobjuriscred.com.br"
                        disabled={settingsLocked}
                      />
                    </div>
                    <div className="help">
                      Recebe o resultado (sucesso ou erro) do processo de
                      importação.
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
                <div className="panel">
                  <div className="panel-head">
                    <h2>Valores a Descontar</h2>
                    <span className="chip">
                      <FileText size={16} />
                      Relatório
                    </span>
                  </div>
                  <div className="panel-body">
                    <div className="help">
                      Tela pronta para receber a tabela/visão de valores importados
                      do SharePoint.
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {view === 'relatorios-auditoria' ? (
              <section className="grid">
                <div className="panel">
                  <div className="panel-head">
                    <h2>Auditoria Sistêmica</h2>
                    <span className="chip">
                      <ShieldCheck size={16} />
                      Logs
                    </span>
                  </div>
                  <div className="panel-body">
                    <div className="help">
                      Tela pronta para mostrar logs de importação, erros e
                      validações.
                    </div>
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
                        !conciliacaoMonthOptions.some((o) => o.value === conciliacaoMonth)
                      }
                      onClick={() => {
                        setTarifaError(null)
                        setTarifaTypeDraft('linha')
                        setTarifaDraft('')
                        setTarifaModalOpen(true)
                      }}
                    >
                      Incluir tarifa
                    </button>
                    <span className="chip">
                      <FileText size={16} />
                      Conciliação
                    </span>
                  </div>
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
                          const recursoNetCents =
                            conciliacaoData.totals.recurso.cents -
                            conciliacaoData.totals.tarifaLinha.cents -
                            conciliacaoData.totals.tarifaTed.cents
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
                              value: withCurrency(conciliacaoData.totals.diff.text),
                              diff: conciliacaoData.totals.diff.cents !== 0,
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
                              const hasDiff = conciliacaoData.totals.diff.cents !== 0
                              const ok = !hasDiff
                              const expanded = conciliacaoExpandedKeys.includes(monthKey)
                              const bg = ok ? 'rgba(0,174,157,0.12)' : 'rgba(245,197,66,0.10)'
                              const border = ok ? 'rgba(0,174,157,0.22)' : 'rgba(245,197,66,0.22)'
                              const diffText = withCurrency(conciliacaoData.totals.diff.text)
                              const linkedPairId =
                                conciliacaoSelectedPairId ??
                                (conciliacaoSelectedPersonKey ? null : conciliacaoAutoPairId)

                              const recursoRows = conciliacaoOnlyDiff
                                ? conciliacaoData.recurso.filter((x) => x.status === 'pendencia')
                                : conciliacaoData.recurso
                              const relatorioRows = conciliacaoOnlyDiff
                                ? conciliacaoData.relatorio.filter((x) => x.status === 'pendencia')
                                : conciliacaoData.relatorio

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
                                const concRelatorio = relatorioRows.filter(
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
                                        title={
                                          expanded
                                            ? 'Exportar XLSX'
                                            : 'Expanda a competência para exportar'
                                        }
                                        aria-label="Exportar XLSX"
                                        disabled={
                                          !expanded || !canExportConciliacaoXlsx || conciliacaoExportingXlsx
                                        }
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
                                            <div style={{ fontWeight: 850, marginBottom: 8 }}>
                                              Recurso do Órgão ({conciliacaoData.recursoTable})
                                            </div>
                                            <div
                                              style={{
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                borderRadius: 12,
                                                overflow: 'hidden',
                                              }}
                                            >
                                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                                                            e.stopPropagation()
                                                            setCloneSisbrError(null)
                                                            setCloneSisbrAction('clonar_para_relatorio_sisbr')
                                                            setCloneSisbrJustification('')
                                                            setCloneSisbrModal({
                                                              cpf: r.cpf,
                                                              nome: r.nome,
                                                              value: r.value,
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
                                                              r.status === 'pendencia' ? 'pointer' : undefined,
                                                            textDecoration:
                                                              r.status === 'pendencia' ? 'underline' : undefined,
                                                            opacity: opts?.indented ? 0.92 : undefined,
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
                                            <div style={{ fontWeight: 850, marginBottom: 8 }}>
                                              Relatório SISBR
                                            </div>
                                            <div
                                              style={{
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                borderRadius: 12,
                                                overflow: 'hidden',
                                              }}
                                            >
                                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                                                  {(() => {
                                                    const withIndex = relatorioRows
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
                                                                  r.status === 'pendencia' ? 'pointer' : undefined,
                                                                textDecoration:
                                                                  r.status === 'pendencia' ? 'underline' : undefined,
                                                              }}
                                                              onClick={(e) => {
                                                                if (r.status !== 'pendencia') return
                                                                e.stopPropagation()
                                                                if (!conciliacaoMonth || !conciliacaoOrgao) return
                                                                setRelatorioOcorrenciaError(null)
                                                                setRelatorioOcorrenciaAction(
                                                                  'alterar_orgao_relatorio_sisbr',
                                                                )
                                                                setRelatorioOcorrenciaToOrgao(conciliacaoOrgao)
                                                                setRelatorioOcorrenciaJustification('')
                                                                setOcorrenciaModal({
                                                                  nome: r.nome,
                                                                  cpf: r.cpf,
                                                                  value: r.value,
                                                                  empresa: r.empresa ?? null,
                                                                  ocorrencia: r.ocorrencia ?? null,
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
                                                                  setRelatorioOcorrenciaError(null)
                                                                  setRelatorioOcorrenciaAction(
                                                                    'alterar_orgao_relatorio_sisbr',
                                                                  )
                                                                  setRelatorioOcorrenciaToOrgao(conciliacaoOrgao)
                                                                  setRelatorioOcorrenciaJustification('')
                                                                  setOcorrenciaModal({
                                                                    nome: r.nome,
                                                                    cpf: r.cpf,
                                                                    value: r.value,
                                                                    empresa: r.empresa ?? null,
                                                                    ocorrencia: r.ocorrencia ?? null,
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
                            <div style={{ padding: '14px 16px' }}>
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
                                  <select
                                    className="control"
                                    value={cloneSisbrAction}
                                    onChange={(e) => setCloneSisbrAction(e.target.value)}
                                    disabled={cloneSisbrLoading}
                                  >
                                    <option value="clonar_para_relatorio_sisbr">
                                      Clonar para Relatorio Sisbr
                                    </option>
                                  </select>
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
                                <div className="field">
                                  <label>Justificativa (obrigatória)</label>
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
                                  disabled={cloneSisbrLoading || !cloneSisbrJustification.trim()}
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
                                  {cloneSisbrLoading ? 'Clonando...' : 'Clonar para Relatorio Sisbr'}
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
                              <button type="button" className="btn btn-ghost" onClick={() => setOcorrenciaModal(null)}>
                                Fechar
                              </button>
                            </div>
                            <div style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'grid', gap: 6 }}>
                                <div style={{ fontWeight: 850 }}>{ocorrenciaModal.nome || '-'}</div>
                                <div style={{ opacity: 0.82 }}>
                                  CPF: {ocorrenciaModal.cpf} • Valor: {withCurrency(ocorrenciaModal.value)}
                                </div>
                                <div style={{ opacity: 0.82 }}>
                                  Empresa atual (SISBR): {ocorrenciaModal.empresa || '-'}
                                </div>
                              </div>

                              {ocorrenciaModal.ocorrencia ? (
                                <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                                  <div style={{ opacity: 0.8 }}>
                                    <span style={{ fontWeight: 750 }}>ID:</span>{' '}
                                    {String(ocorrenciaModal.ocorrencia.id)}
                                  </div>
                                  <div style={{ opacity: 0.8 }}>
                                    <span style={{ fontWeight: 750 }}>Data:</span>{' '}
                                    {ocorrenciaModal.ocorrencia.createdAt || '-'}
                                  </div>
                                  <div style={{ opacity: 0.8 }}>
                                    <span style={{ fontWeight: 750 }}>Ação anterior:</span>{' '}
                                    {ocorrenciaModal.ocorrencia.action || '-'}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 750, marginBottom: 6 }}>Justificativa anterior</div>
                                    <div style={{ whiteSpace: 'pre-wrap', opacity: 0.86 }}>
                                      {ocorrenciaModal.ocorrencia.justification || '-'}
                                    </div>
                                  </div>
                                </div>
                              ) : null}

                              {ocorrenciaModal.ocorrencia ? (
                                <div style={{ marginTop: 14 }}>
                                  <div style={{ opacity: 0.82 }}>
                                    Esta linha já possui ocorrência. Para alterar novamente, primeiro desfaça a
                                    ocorrência.
                                  </div>
                                  <div style={{ marginTop: 12 }}>
                                    <div style={{ fontWeight: 750, marginBottom: 8 }}>
                                      Justificativa para desfazer (opcional)
                                    </div>
                                    <textarea
                                      value={relatorioOcorrenciaJustification}
                                      onChange={(e) => setRelatorioOcorrenciaJustification(e.target.value)}
                                      rows={3}
                                      style={{
                                        width: '100%',
                                        resize: 'vertical',
                                        padding: '10px 12px',
                                        borderRadius: 12,
                                        border: '1px solid rgba(255,255,255,0.16)',
                                        background: 'rgba(255,255,255,0.06)',
                                        color: 'rgba(255,255,255,0.88)',
                                      }}
                                      placeholder="Opcional..."
                                      disabled={relatorioOcorrenciaSaving}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div style={{ marginTop: 18 }}>
                                    <div style={{ fontWeight: 750, marginBottom: 8 }}>Ação</div>
                                    <select
                                      value={relatorioOcorrenciaAction}
                                      onChange={(e) => setRelatorioOcorrenciaAction(e.target.value)}
                                      disabled={relatorioOcorrenciaSaving}
                                      style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 12,
                                        border: '1px solid rgba(255,255,255,0.16)',
                                        background: 'rgba(255,255,255,0.06)',
                                        color: 'rgba(255,255,255,0.88)',
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
                                    </select>
                                  </div>

                                  <div style={{ marginTop: 14 }}>
                                    <div style={{ fontWeight: 750, marginBottom: 8 }}>Órgão de destino</div>
                                    <select
                                      value={relatorioOcorrenciaToOrgao}
                                      onChange={(e) => setRelatorioOcorrenciaToOrgao(e.target.value)}
                                      disabled={relatorioOcorrenciaSaving}
                                      style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 12,
                                        border: '1px solid rgba(255,255,255,0.16)',
                                        background: 'rgba(255,255,255,0.06)',
                                        color: 'rgba(255,255,255,0.88)',
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

                                  <div style={{ marginTop: 14 }}>
                                    <div style={{ fontWeight: 750, marginBottom: 8 }}>
                                      Justificativa (obrigatória)
                                    </div>
                                    <textarea
                                      value={relatorioOcorrenciaJustification}
                                      onChange={(e) => setRelatorioOcorrenciaJustification(e.target.value)}
                                      rows={4}
                                      style={{
                                        width: '100%',
                                        resize: 'vertical',
                                        padding: '10px 12px',
                                        borderRadius: 12,
                                        border: '1px solid rgba(255,255,255,0.16)',
                                        background: 'rgba(255,255,255,0.06)',
                                        color: 'rgba(255,255,255,0.88)',
                                      }}
                                      placeholder="Descreva o motivo da ação..."
                                      disabled={relatorioOcorrenciaSaving}
                                    />
                                  </div>
                                </>
                              )}

                              {relatorioOcorrenciaError ? (
                                <div style={{ marginTop: 12, color: 'rgba(245,197,66,0.98)', fontWeight: 750 }}>
                                  {relatorioOcorrenciaError}
                                </div>
                              ) : null}

                              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                {ocorrenciaModal.ocorrencia ? (
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    disabled={relatorioOcorrenciaSaving}
                                    onClick={async () => {
                                      if (!ocorrenciaModal.ocorrencia) return
                                      setRelatorioOcorrenciaSaving(true)
                                      setRelatorioOcorrenciaError(null)
                                      try {
                                        const res = await fetch(
                                          '/api/consignado/conciliacao/recurso-vs-relatorio/desfazer-ocorrencia',
                                          {
                                            method: 'POST',
                                            headers: { 'content-type': 'application/json' },
                                            body: JSON.stringify({
                                              id: ocorrenciaModal.ocorrencia.id,
                                              undoJustification: relatorioOcorrenciaJustification,
                                            }),
                                          },
                                        )
                                        const json = (await res.json().catch(() => null)) as
                                          | null
                                          | { message?: string }
                                        if (!res.ok) {
                                          throw new Error(json?.message || 'Falha ao desfazer ocorrência.')
                                        }
                                        await reloadConciliacaoKeepExpanded()
                                        setOcorrenciaModal(null)
                                      } catch (e) {
                                        const msg =
                                          e instanceof Error ? e.message : 'Falha ao desfazer ocorrência.'
                                        setRelatorioOcorrenciaError(msg)
                                      } finally {
                                        setRelatorioOcorrenciaSaving(false)
                                      }
                                    }}
                                  >
                                    {relatorioOcorrenciaSaving ? 'Desfazendo...' : 'Desfazer ocorrência'}
                                  </button>
                                ) : null}
                                {!ocorrenciaModal.ocorrencia ? (
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    disabled={
                                      relatorioOcorrenciaSaving ||
                                      !conciliacaoMonth ||
                                      !relatorioOcorrenciaToOrgao ||
                                      !relatorioOcorrenciaJustification.trim() ||
                                      !ocorrenciaModal.empresa
                                    }
                                    onClick={async () => {
                                      if (!conciliacaoMonth || !relatorioOcorrenciaToOrgao) return
                                      if (!ocorrenciaModal.empresa) {
                                        setRelatorioOcorrenciaError(
                                          'Empresa atual (SISBR) não encontrada no registro.',
                                        )
                                        return
                                      }
                                      setRelatorioOcorrenciaSaving(true)
                                      setRelatorioOcorrenciaError(null)
                                      try {
                                        const res = await fetch(
                                          '/api/consignado/conciliacao/recurso-vs-relatorio/alterar-orgao-relatorio',
                                          {
                                            method: 'POST',
                                            headers: { 'content-type': 'application/json' },
                                            body: JSON.stringify({
                                              month: conciliacaoMonth,
                                              cpf: ocorrenciaModal.cpf,
                                              nome: ocorrenciaModal.nome,
                                              value: ocorrenciaModal.value,
                                              fromEmpresa: ocorrenciaModal.empresa,
                                              toOrgao: relatorioOcorrenciaToOrgao,
                                              action: relatorioOcorrenciaAction,
                                              justification: relatorioOcorrenciaJustification,
                                            }),
                                          },
                                        )
                                        const json = (await res.json().catch(() => null)) as
                                          | null
                                          | { message?: string }
                                        if (!res.ok)
                                          throw new Error(json?.message || 'Falha ao salvar ocorrência.')
                                        await reloadConciliacaoKeepExpanded()
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
                                    {relatorioOcorrenciaSaving ? 'Salvando...' : 'Concluir ocorrência'}
                                  </button>
                                ) : null}
                              </div>
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

            {isMain ? (
              <section className="panel">
              <div className="panel-head">
                <h2>Indicadores</h2>
                <span className="chip">
                  <Sparkles size={16} />
                  Live Widgets
                </span>
              </div>
              <div className="panel-body">
                <div className="stats">
                  {[
                    { label: 'Contratos em atraso', value: '—', icon: <BadgeDollarSign size={18} /> },
                    { label: 'Carteira em aberto', value: '—', icon: <Zap size={18} /> },
                    { label: 'Negociações ativas', value: '—', icon: <Sparkles size={18} /> },
                    { label: 'Risco operacional', value: '—', icon: <ShieldCheck size={18} /> },
                  ].map((s) => (
                    <div className="stat" key={s.label}>
                      <div className="kpi">
                        <div className="label">{s.label}</div>
                        <div style={{ opacity: 0.85 }}>{s.icon}</div>
                      </div>
                      <div className="value">{s.value}</div>
                      <div style={{ marginTop: 8 }}>
                        <span className="chip">
                          <Sparkles size={16} />
                          pronto p/ dados
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </section>
            ) : null}

            {isMain ? (
              <section className="grid">
              <div className="panel">
                <div className="panel-head">
                  <h2>Atalhos</h2>
                  <span className="chip">
                    <Zap size={16} />
                    Ultra Rápido
                  </span>
                </div>
                <div className="panel-body">
                  <div className="list">
                    {[
                      {
                        icon: <LayoutDashboard size={18} />,
                        title: 'Abrir Dashboard',
                        desc: 'KPIs, alertas e cards dinâmicos',
                        tag: 'ui',
                        action: () => setHash('dashboard'),
                      },
                      {
                        icon: <FileText size={18} />,
                        title: 'Relatórios',
                        desc: 'Exportações e visões gerenciais',
                        tag: 'beta',
                        action: () => setHash('relatorios-valores'),
                      },
                      {
                        icon: <ShieldCheck size={18} />,
                        title: 'Configurações',
                        desc: 'Regras, acessos e integrações',
                        tag: 'iam',
                        action: () => setHash('configuracoes-automacao'),
                      },
                    ].map((r) => (
                      <button
                        key={r.title}
                        type="button"
                        className="row"
                        onClick={r.action}
                        style={{ width: '100%', cursor: 'pointer' }}
                      >
                        <span className="bubble">{r.icon}</span>
                        <span style={{ textAlign: 'left' }}>
                          <strong>{r.title}</strong>
                          <small>{r.desc}</small>
                        </span>
                        <span className="right">{r.tag.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h2>Feed Operacional</h2>
                  <span className="chip">
                    <Sparkles size={16} />
                    Em tempo real
                  </span>
                </div>
                <div className="panel-body">
                  <div className="list" style={{ opacity: 0.98 }}>
                    {[
                      { icon: <Zap size={18} />, title: 'Nova fila de negociações', desc: 'Pronta para conectar na API', right: 'AGORA' },
                      { icon: <ShieldCheck size={18} />, title: 'Políticas de acesso', desc: 'Estrutura desenhada para IAM', right: 'HOJE' },
                      { icon: <Sparkles size={18} />, title: 'Componentização moderna', desc: 'Layout inspirado no plano-saúde, repaginado', right: 'OK' },
                    ].map((e) => (
                      <div className="row" key={e.title}>
                        <span className="bubble">{e.icon}</span>
                        <span>
                          <strong>{e.title}</strong>
                          <small>{e.desc}</small>
                        </span>
                        <span className="right">{e.right}</span>
                      </div>
                    ))}
                    {search ? (
                      <div className="row">
                        <span className="bubble">
                          <Search size={18} />
                        </span>
                        <span>
                          <strong>Busca</strong>
                          <small>{search}</small>
                        </span>
                        <span className="right">FILTRAR</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
