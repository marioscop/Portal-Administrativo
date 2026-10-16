# Debug: Dashboard Jurídico — Dados não aparecem na UI
- **sessionId:** `juridico-dashboard-vazio`
- **Data abertura:** 2026-09-29
- **Status:** [OPEN]
- **Módulo:** Jurídico /frontend `JuridicoDashboardPage.tsx` + backend `juridico.controller.ts` / `juridico.service.ts` / SQLite `juridico.sqlite`

---

## 1. Sintoma (Expected × Actual)
| Item | Expected | Actual |
|---|---|---|
| **Tabela Tipo de ações (256 registros)** | Linhas carregadas do SQLite com Autor/Réu/Contrato/... | Apenas estrutura vazia (sem linhas) ou `Nenhum registro encontrado.` |
| **8 KPIs** | Cards com Valor Total, Natureza, ... | Valores 0 / vazios |
| **Gráfico Ativo × Passivo** | 12 meses com barras | Vazio / 0 |
| **Smoke terminal endpoint `/api/juridico/dashboard`** | — | ✅ OK (256 registros) → **Bom sinal**: endpoint backend OK. Problema é no fluxo FE (fetch → setState → render). |

---

## 2. Hipóteses (falsificáveis)
### H1: Fetch endpoint (404/500) → cai no catch silencioso → setRows([ ])
- **Ponto de observação:** `loadDashboard()` JuridicoDashboardPage.tsx, `res.ok`, status code, response body.
- **Probabilidade inicial:** ALTA (já ocorreu antes: frontend fazia fetch de `/dashboard` e a rota não existia no backend).

### H2: `JuridicoRow` shape mismatch (backend retorna `snake_case`, frontend espera `camelCase`) → rows filtrados/length ok mas `.map` retorna vazio / undefined
- **Ponto de observação:** `data.rows[0]` keys vs interface `JuridicoRow` (autor, reu, contrato, processo, status, natureza, valor, custas, origem, data).
- **Probabilidade inicial:** MÉDIA (reconstituição de arquivo pode ter divergido propriedades nomeadas).

### H3: Filtros iniciais (`ano/mes/origem/nome`) bloqueiam resultado (todos 4 selects com valor que não existe)
- **Ponto de observação:** query params enviados (ano/mes/origem/q=...) vs retorno.
- **Probabilidade inicial:** BAIXA (param vazio → não deve filtrar; mas se `setAno(undefined)` vs `''` → pode quebrar).

### H4: `AbortController` bug: useEffect dispara loadDashboard 4× (deps [ano,mes,origem,nome]) e a 1a request aborta as demais → resultado vazio.
- **Ponto de observação:** `ac.current.abort()` no começo da função; log de sinal AbortError vs requisição concluída.
- **Probabilidade inicial:** ALTA (reconstituição colocou `setAno('')` etc mas dependências fazem múltiplos loads).

### H5: `jurSettingsLocked` / `jurIsAdmin` bloqueiam fetch? (não deve, mas se o erro de auth for pego em middleware).
- **Ponto de observação:** sessionStorage `consignado_user_email` e `juridico_user_role` e resposta do controller (JuridicoForbiddenError).
- **Probabilidade inicial:** BAIXA.

---

## 3. Debug Server
- **Porta:** 9229 (auto probe)
- **Log file:** `trae-debug-log-juridico-dashboard-vazio.ndjson`
- **Env file:** `.dbg/juridico-dashboard-vazio.env`

---

## 4. Instrumentação (frontend FE — `loadDashboard`):
```typescript
// #region debug-point fe-load-dashboard
const __dbg = async (payload: any) => { try { const u = window.__TRAE_DEBUG_URL__; if (!u) return; await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-trae-debug-session': 'juridico-dashboard-vazio' }, body: JSON.stringify(payload) }).catch(()=>{}); } catch { /* ignore */ } };
// #endregion
```
Eventos: `fe.load.start` (params), `fe.load.res` (status + ok), `fe.load.data` (rows.length / kpis.length / anos/origens), `fe.load.err` (erro + stack), `fe.load.abort` ou `fe.load.finally`, `fe.render.rows.length` / `fe.render.kpis.length` antes do return.

---

## 5. Fix (TBD após evidência)
Será aplicado minimalmente após confirmar a hipótese.

---

## 6. Verificação pós-fix
- Registros: 256
- Tabela preenchida, KPIs >0, gráfico com barras.
- Log pós-fix: `fe.fix.ok`

---

## 7. Observações (livre)
- Endpoint agregado `/api/juridico/dashboard` foi inserido no backend em etapa anterior; o curl funciona.
- Problema parece ser na **camada FE** (fetch → setState → render) pois o backend responde corretamente via `127.0.0.1:3002`.
