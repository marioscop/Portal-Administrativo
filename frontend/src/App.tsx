import { useEffect, useMemo, useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import PortalHomePage from './pages/PortalHomePage'
import CreditoPage from './pages/CreditoPage'

const msalLib = (window as any).msal as any

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
            data?.message || `Falha ao validar acesso (HTTP ${res.status}).`
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
              }))
              .filter((e) => Boolean(e.email))
          : (Array.isArray(data?.emails) ? data?.emails : [])
              .map((email) => ({
                email: String(email).trim().toLowerCase(),
                role: String(email).trim().toLowerCase() === fixed ? 'admin' : 'usuario',
              }))
              .filter((e) => Boolean(e.email))

        const found = entries.find((e) => e.email === username)
        const allowed = Boolean(found)
        const role = found?.role ?? 'usuario'
        sessionStorage.setItem('consignado_user_email', username)
        sessionStorage.setItem('consignado_user_role', role)

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
      <div className="bg-gray-50 h-screen flex items-center justify-center">
        <style>{`
          @keyframes softPulse {
            0%, 100% { transform: scale(1); filter: brightness(1); }
            50% { transform: scale(1.05); filter: brightness(1.05); }
          }
          .soft-pulse { animation: softPulse 5s ease-in-out infinite; will-change: transform, filter; }
        `}</style>

        <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-gradient-to-b from-[#00AE9D] to-[#008C7D] shadow-2xl">
          <div className="px-8 py-10">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-gradient-to-r from-[#00AE9D] to-[#008C7D] p-[2px] rounded-2xl shadow-md soft-pulse">
                <div className="bg-[#003641] rounded-xl p-3 shadow-md ring-1 ring-black/5 transition-transform duration-300 ease-out hover:scale-105 hover:shadow-lg">
                  <img
                    src="/assets/sicoob-juriscred.png"
                    alt="Juriscred"
                    className="h-10 w-auto"
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = '/assets/sicoob-juriscred_Logo Verde.png'
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-3xl font-bold text-white tracking-tight">Acesso Restrito</h1>
              </div>
              <div className="flex items-center justify-center gap-2 text-white/95">
                <svg
                  className="h-7 w-7 text-white soft-pulse"
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
                <span className="text-sm">Portal Administrativo</span>
              </div>
              <p className="text-sm text-white/90">
                Autentique-se com sua conta Microsoft para continuar.
              </p>
            </div>

            <div className="mt-8">
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
                className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 rounded-lg font-semibold text-white bg-[#003641] hover:bg-[#004554] transition-all duration-300 ease-out shadow-md hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#003641] disabled:opacity-80 disabled:cursor-not-allowed"
              >
                <span className="inline-flex items-center justify-center">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 22 22"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    className="flex-shrink-0"
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
                className="mt-3 w-full inline-flex items-center justify-center px-5 py-2 rounded-lg border border-white/60 text-sm font-medium text-white/90 bg-white/5 hover:bg-white/10 hover:text-white transition-all duration-300 ease-out shadow-sm"
              >
                Voltar ao Portal
              </button>

              <p className="mt-3 text-center text-xs text-white/80">
                Use sua conta corporativa Microsoft 365
              </p>
              <p className="mt-1 text-center text-xs text-white/80">
                Solicite Suporte à Equipe de TI:{' '}
                <a
                  href="mailto:suporte@sicoobjuriscred.com.br"
                  className="text-white underline hover:text-white"
                >
                  suporte@sicoobjuriscred.com.br
                </a>
              </p>
              {cryptoWarning ? (
                <p className="mt-2 text-center text-xs text-yellow-200">
                  Para login via IP, é necessário HTTPS. Acesse por{' '}
                  <a href="http://localhost:5173/" className="underline hover:text-yellow-100">
                    localhost
                  </a>{' '}
                  ou solicite certificado HTTPS.
                </p>
              ) : null}
            </div>

            <div className="mt-8 text-center">
              <a
                href="https://www.sicoob.com.br/web/sicoob/politica-privacidade-tratamento-dados"
                className="text-[11px] text-white underline hover:text-white"
                target="_blank"
                rel="noopener"
              >
                Política de Privacidade
              </a>
            </div>
          </div>
        </div>

        <div className="fixed bottom-3 left-0 right-0 text-center text-xs text-gray-600">
          © 2026 Juriscred
          <span className="block">Desenvolvido pelo Departamento de Tecnologia da Informação.</span>
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
      <div className="bg-gray-50 h-screen flex items-center justify-center">
        <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-gradient-to-b from-[#00AE9D] to-[#008C7D] shadow-2xl">
          <div className="px-8 py-10">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-[#003641] rounded-xl p-3 shadow-md ring-1 ring-black/5">
                <img
                  src="/assets/sicoob-juriscred.png"
                  alt="Juriscred"
                  className="h-10 w-auto"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = '/assets/sicoob-juriscred_Logo Verde.png'
                  }}
                />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-white tracking-tight">Acesso Restrito</h1>
              <p className="text-sm text-white/90">{accessMessage ?? 'Acesso não autorizado.'}</p>
            </div>
            <div className="mt-8">
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/'
                }}
                className="w-full inline-flex items-center justify-center px-5 py-2 rounded-lg border border-white/60 text-sm font-medium text-white/90 bg-white/5 hover:bg-white/10 hover:text-white transition-all duration-300 ease-out shadow-sm"
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
                className="mt-3 w-full inline-flex items-center justify-center gap-3 px-5 py-3 rounded-lg font-semibold text-white bg-[#003641] hover:bg-[#004554] transition-all duration-300 ease-out shadow-md hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#003641]"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
        <div className="fixed bottom-3 left-0 right-0 text-center text-xs text-gray-600">
          © 2026 Juriscred
          <span className="block">Desenvolvido pelo Departamento de Tecnologia da Informação.</span>
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
