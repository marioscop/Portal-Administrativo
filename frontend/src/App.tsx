import { useEffect, useMemo, useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import PortalHomePage from './pages/PortalHomePage'
import CreditoPage from './pages/CreditoPage'
import AutomacaoPage from './pages/AutomacaoPage'

const disableMsal = String((import.meta as any).env?.VITE_DISABLE_MSAL ?? '').trim() === '1'

const msalLib = disableMsal ? null : ((window as any).msal as any)

const msalClientId =
  (import.meta as any).env?.VITE_MSAL_CLIENT_ID ?? 'b44c4177-d834-4814-b9c5-8b696212d09d'
const msalTenantId =
  (import.meta as any).env?.VITE_MSAL_TENANT_ID ?? '18a4c374-8b47-4a76-a311-2520dd7131cc'

const msalInstance = msalLib
  ? new msalLib.PublicClientApplication({
      auth: {
        clientId: msalClientId,
        authority: `https://login.microsoftonline.com/${msalTenantId}`,
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
      },
      system: {
        loggerOptions: {
          loggerCallback: (level: any, message: string, containsPii: boolean) => {
            if (containsPii) return
            if (level === msalLib.LogLevel.Error) console.error(message)
            else if (level === msalLib.LogLevel.Warning) console.warn(message)
            else if (level === msalLib.LogLevel.Info) console.info(message)
          },
          logLevel: msalLib.LogLevel.Warning,
        },
      },
    })
  : null

if (msalInstance) {
  ;(window as any).__msalInstance = msalInstance
}

function RequireMicrosoftLogin({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [hasAccount, setHasAccount] = useState(() =>
    Boolean(msalInstance?.getActiveAccount()),
  )
  const [accessChecked, setAccessChecked] = useState(false)
  const [accessAuthorized, setAccessAuthorized] = useState(true)
  const [accessMessage, setAccessMessage] = useState<string | null>(null)
  const [cryptoWarning, setCryptoWarning] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    const run = async () => {
      if (!msalInstance) {
        setHasAccount(true)
        setReady(true)
        return
      }

      const accounts = msalInstance.getAllAccounts()
      if (!msalInstance.getActiveAccount() && accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0])
      }

      setHasAccount(Boolean(msalInstance.getActiveAccount()))
      setCryptoWarning(!window.isSecureContext || !window.crypto || !window.crypto.subtle)
      setReady(true)
    }

    run().catch((e) => {
      console.error(e)
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!hasAccount) {
      setAccessChecked(false)
      setAccessAuthorized(true)
      setAccessMessage(null)
      return
    }
    if (!msalInstance) {
      setAccessChecked(true)
      setAccessAuthorized(true)
      setAccessMessage(null)
      return
    }

    const account = msalInstance.getActiveAccount()
    const username = (account?.username || '').trim().toLowerCase()
    let cancelled = false

    Promise.resolve().then(() => {
      setAccessChecked(false)
      setAccessAuthorized(true)
      setAccessMessage(null)
    })

    const accessFetchWithRetry = async (
      input: RequestInfo | URL,
      init?: RequestInit,
      maxAttempts = 4,
      baseDelayMs = 400,
    ): Promise<Response> => {
      let lastErr: unknown = null
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await fetch(input, init)
          if (
            res.status === 502 ||
            res.status === 503 ||
            res.status === 504 ||
            (res.status >= 500 && attempt < maxAttempts)
          ) {
            lastErr = new Error(`HTTP ${res.status}`)
            if (attempt < maxAttempts) {
              await new Promise((r) =>
                setTimeout(r, baseDelayMs * attempt * attempt),
              )
              continue
            }
            return res
          }
          return res
        } catch (e) {
          lastErr = e
          if (attempt < maxAttempts) {
            await new Promise((r) =>
              setTimeout(r, baseDelayMs * attempt * attempt),
            )
            continue
          }
          throw e
        }
      }
      if (lastErr instanceof Error) throw lastErr
      throw new Error('Falha ao validar acesso (tentativas esgotadas).')
    }

    accessFetchWithRetry('/api/consignado/access/emails', undefined, 4, 400)
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | {
              entries?: Array<{
                email?: string
                role?: 'admin' | 'usuario'
                menus?: string[]
                flowStages?: string[]
              }>
              emails?: string[]
              fixedEmail?: string
              message?: string
            }
          | null
        if (!res.ok) {
          const defaultMsg =
            res.status === 502 || res.status === 503 || res.status === 504
              ? location.port === '5173'
                ? `Back-end DEV ainda está iniciando (HTTP ${res.status}). Aguarde alguns segundos e recarregue — ou rode \`npm run start\` no backend.`
                : `Servidor de produção indisponível (HTTP ${res.status}). Contate TI para reiniciar PM2.`
              : `Falha ao validar acesso (HTTP ${res.status}).`
          const msg = data?.message || defaultMsg
          throw new Error(msg)
        }
        return data
      })
      .then((data) => {
        if (cancelled) return
        const fixed = (data?.fixedEmail || '').trim().toLowerCase()

        const entriesRaw = Array.isArray(data?.entries) ? data?.entries : null
        const entries = entriesRaw
          ? entriesRaw
              .map((e) => ({
                email: String(e.email ?? '').trim().toLowerCase(),
                role: e.role === 'admin' ? 'admin' : 'usuario',
                menus: Array.isArray(e.menus) ? e.menus.map((item) => String(item)) : [],
                flowStages: Array.isArray(e.flowStages)
                  ? e.flowStages.map((item) => String(item))
                  : [],
              }))
              .filter((e) => Boolean(e.email))
          : (Array.isArray(data?.emails) ? data?.emails : [])
              .map((email) => ({
                email: String(email).trim().toLowerCase(),
                role: String(email).trim().toLowerCase() === fixed ? 'admin' : 'usuario',
                menus: [],
                flowStages: [],
              }))
              .filter((e) => Boolean(e.email))

        const found = entries.find((e) => e.email === username)
        const allowed = Boolean(found)
        const role = found?.role ?? 'usuario'
        sessionStorage.setItem('consignado_user_email', username)
        sessionStorage.setItem('consignado_user_role', role)
        sessionStorage.setItem(
          'consignado_user_menu_permissions',
          JSON.stringify(Array.isArray(found?.menus) && found?.menus.length > 0 ? found?.menus : []),
        )
        sessionStorage.setItem(
          'consignado_user_flow_stage_permissions',
          JSON.stringify(
            Array.isArray(found?.flowStages) && found?.flowStages.length > 0
              ? found?.flowStages
              : [],
          ),
        )

        setAccessAuthorized(Boolean(username) && allowed)
        setAccessMessage(
          Boolean(username) && allowed
            ? null
            : 'O acesso ao módulo não está autorizado para este usuário.',
        )
        setAccessChecked(true)
      })
      .catch((e) => {
        if (cancelled) return
        setAccessAuthorized(false)
        setAccessMessage(
          e instanceof Error ? e.message : 'Não foi possível validar o acesso.',
        )
        setAccessChecked(true)
      })

    return () => {
      cancelled = true
    }
  }, [hasAccount, ready])

  if (!ready) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, Segoe UI, Roboto, sans-serif' }}>
        Carregando...
      </div>
    )
  }

  if (!hasAccount) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#f5f7fa',
          fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <style>{`
          @keyframes softPulse {
            0%, 100% { transform: scale(1); filter: brightness(1); }
            50% { transform: scale(1.05); filter: brightness(1.05); }
          }
          .soft-pulse { animation: softPulse 5s ease-in-out infinite; will-change: transform, filter; }
        `}</style>

        <div
          style={{
            width: '100%',
            maxWidth: 420,
            margin: '0 auto',
            borderRadius: 16,
            overflow: 'hidden',
            background: 'linear-gradient(180deg, #00AE9D, #008C7D)',
            boxShadow: '0 22px 60px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ padding: '38px 34px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
              <div
                className="soft-pulse"
                style={{
                  padding: 2,
                  borderRadius: 16,
                  background: 'linear-gradient(90deg, #00AE9D, #008C7D)',
                  boxShadow: '0 10px 20px rgba(0,0,0,0.16)',
                }}
              >
                <div
                  style={{
                    background: '#003641',
                    borderRadius: 12,
                    padding: 12,
                    boxShadow: '0 10px 20px rgba(0,0,0,0.16)',
                    border: '1px solid rgba(0,0,0,0.12)',
                  }}
                >
                  <img
                    src="/assets/sicoob-juriscred.png"
                    alt="Juriscred"
                    style={{ height: 40, width: 'auto', display: 'block' }}
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = '/assets/sicoob-juriscred_Logo Verde.png'
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0 }}>
                Acesso Restrito
              </h1>
              <div
                style={{
                  marginTop: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: 'rgba(255,255,255,0.95)',
                }}
              >
                <svg
                  className="soft-pulse"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="8" cy="9" r="3" fill="currentColor" />
                  <path
                    d="M4 16c0-2.2 1.8-4 4-4s4 1.8 4 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <circle cx="17" cy="9" r="2.5" fill="currentColor" opacity="0.85" />
                  <path
                    d="M13.5 15c.5-1.7 2-3 3.5-3 1.8 0 3.25 1.5 3.25 3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    opacity="0.9"
                  />
                  <rect x="5" y="4" width="14" height="2" rx="1" fill="currentColor" opacity="0.5" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 650 }}>Portal Administrativo</span>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
                Autentique-se com sua conta Microsoft para continuar.
              </p>
            </div>

            <div style={{ marginTop: 26 }}>
              <button
                type="button"
                onClick={async () => {
                  if (!msalInstance) return
                  try {
                    setLoggingIn(true)
                    sessionStorage.setItem('auth_redirect_url', window.location.href)
                    await msalInstance.loginRedirect({ scopes: ['User.Read'] })
                  } catch (e) {
                    console.error(e)
                    setLoggingIn(false)
                    alert('Falha ao iniciar o login Microsoft.')
                  }
                }}
                disabled={loggingIn}
                style={{
                  width: '100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.15)',
                  background: '#003641',
                  color: '#fff',
                  fontWeight: 750,
                  cursor: loggingIn ? 'not-allowed' : 'pointer',
                  opacity: loggingIn ? 0.82 : 1,
                  boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 22 22"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  >
                    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                    <rect x="12" y="1" width="9" height="9" fill="#7FBA00" />
                    <rect x="1" y="12" width="9" height="9" fill="#00A4EF" />
                    <rect x="12" y="12" width="9" height="9" fill="#FFB900" />
                  </svg>
                </span>
                <span>{loggingIn ? 'Autenticando...' : 'Acessar com seu Login'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = '/'
                }}
                style={{
                  marginTop: 10,
                  width: '100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.55)',
                  background: 'rgba(255,255,255,0.07)',
                  color: 'rgba(255,255,255,0.92)',
                  fontSize: 13,
                  fontWeight: 650,
                  cursor: 'pointer',
                }}
              >
                Voltar ao Portal
              </button>

              <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.82)' }}>
                Use sua conta corporativa Microsoft 365
              </p>
              <p style={{ margin: '6px 0 0', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.82)' }}>
                Solicite Suporte à Equipe de TI:{' '}
                <a
                  href="mailto:suporte@sicoobjuriscred.com.br"
                  style={{ color: '#fff', textDecoration: 'underline' }}
                >
                  suporte@sicoobjuriscred.com.br
                </a>
              </p>
              {cryptoWarning ? (
                <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 12, color: '#fde68a' }}>
                  Para login via IP, é necessário HTTPS. Acesse por{' '}
                  <a href="http://localhost:5173/" style={{ color: '#fde68a', textDecoration: 'underline' }}>
                    localhost
                  </a>{' '}
                  ou solicite certificado HTTPS.
                </p>
              ) : null}
            </div>

            <div style={{ marginTop: 18, textAlign: 'center' }}>
              <a
                href="https://www.sicoob.com.br/web/sicoob/politica-privacidade-tratamento-dados"
                style={{ fontSize: 11, color: '#fff', textDecoration: 'underline' }}
                target="_blank"
                rel="noopener"
              >
                Política de Privacidade
              </a>
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 12,
            textAlign: 'center',
            fontSize: 12,
            color: '#64748b',
          }}
        >
          © 2026 Juriscred
          <div>Desenvolvido pelo Departamento de Tecnologia da Informação.</div>
        </div>
      </div>
    )
  }

  if (!accessChecked) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, Segoe UI, Roboto, sans-serif' }}>
        Validando acesso...
      </div>
    )
  }

  if (!accessAuthorized) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#f5f7fa',
          fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            margin: '0 auto',
            borderRadius: 16,
            overflow: 'hidden',
            background: 'linear-gradient(180deg, #00AE9D, #008C7D)',
            boxShadow: '0 22px 60px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ padding: '38px 34px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
              <div
                style={{
                  background: '#003641',
                  borderRadius: 12,
                  padding: 12,
                  boxShadow: '0 10px 20px rgba(0,0,0,0.16)',
                  border: '1px solid rgba(0,0,0,0.12)',
                }}
              >
                <img
                  src="/assets/sicoob-juriscred.png"
                  alt="Juriscred"
                  style={{ height: 40, width: 'auto', display: 'block' }}
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = '/assets/sicoob-juriscred_Logo Verde.png'
                  }}
                />
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0 }}>
                Acesso Restrito
              </h1>
              <p style={{ margin: '10px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
                {accessMessage ?? 'Acesso não autorizado.'}
              </p>
            </div>
            <div style={{ marginTop: 26 }}>
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/'
                }}
                style={{
                  width: '100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.55)',
                  background: 'rgba(255,255,255,0.07)',
                  color: 'rgba(255,255,255,0.92)',
                  fontSize: 13,
                  fontWeight: 650,
                  cursor: 'pointer',
                }}
              >
                Voltar ao Portal
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!msalInstance) return
                  try {
                    await msalInstance.logoutRedirect({ postLogoutRedirectUri: window.location.origin })
                  } catch (e) {
                    console.error(e)
                  }
                }}
                style={{
                  marginTop: 10,
                  width: '100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.15)',
                  background: '#003641',
                  color: '#fff',
                  fontWeight: 750,
                  cursor: 'pointer',
                  boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
                }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 12,
            textAlign: 'center',
            fontSize: 12,
            color: '#64748b',
          }}
        >
          © 2026 Juriscred
          <div>Desenvolvido pelo Departamento de Tecnologia da Informação.</div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export default function App() {
  const [authBootstrapped, setAuthBootstrapped] = useState(false)

  useEffect(() => {
    const run = async () => {
      if (!msalInstance) {
        setAuthBootstrapped(true)
        return
      }

      await msalInstance.initialize()
      const response = await msalInstance.handleRedirectPromise()
      if (response?.account) {
        msalInstance.setActiveAccount(response.account)
      } else {
        const accounts = msalInstance.getAllAccounts()
        if (!msalInstance.getActiveAccount() && accounts.length > 0) {
          msalInstance.setActiveAccount(accounts[0])
        }
      }

      const redirectUrl = sessionStorage.getItem('auth_redirect_url')
      if (
        redirectUrl &&
        redirectUrl !== window.location.href &&
        msalInstance.getActiveAccount()
      ) {
        sessionStorage.removeItem('auth_redirect_url')
        window.location.href = redirectUrl
        return
      }

      setAuthBootstrapped(true)
    }
    run().catch((e) => {
      console.error(e)
      setAuthBootstrapped(true)
    })
  }, [])

  const router = useMemo(() => {
    return createBrowserRouter([
      {
        path: '/',
        element: <PortalHomePage />,
      },
      {
        path: '/credito',
        element: (
          <RequireMicrosoftLogin>
            <CreditoPage />
          </RequireMicrosoftLogin>
        ),
      },
      {
        path: '/automacao',
        element: (
          <RequireMicrosoftLogin>
            <AutomacaoPage />
          </RequireMicrosoftLogin>
        ),
      },
    ])
  }, [])

  if (!authBootstrapped) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, Segoe UI, Roboto, sans-serif' }}>
        Inicializando autenticação...
      </div>
    )
  }

  return <RouterProvider router={router} />
}
