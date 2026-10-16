# Debug Session — juridico-zero-dados
Status: `[OPEN]`
Data: 2026-09-30
Sintoma: Módulo Jurídico não traz dados do banco de dados (tabela Tipo de ações, KPIs, gráfico Ativo×Passivo aparecem todos vazios = 0).
Expectativa: Trazer 256 registros do `juridico.sqlite` igual endpoint `/api/juridico/processos` retorna via curl interno.

---

## 1 — Hipóteses (falsificáveis, ordem de probabilidade)

| # | Hipótese | O que procurar nos logs | Status |
|---|---|---|---|
| **H1** | **401 / 403 FORBIDDEN** do endpoint `/api/juridico/dashboard` (auth RBAC: e-mail não cadastrado em `juridico_access_emails`) | `ev.response.status ∈ [401, 403]` + `response.message` indicando acesso negado | 🔍 pendente |
| **H2** | **MISMATCH SHAPE** da resposta do backend. Frontend espera `{ rows, kpis, chart, anos, origens, total }` mas backend retorna formato errado (ex: um objeto `data: {...}` wrapando, ou array sozinho). | `typeof payload !== 'object' \|\| !Array.isArray(payload.rows)` + print de `Object.keys(pagamento)` | 🔍 pendente |
| **H3** | **Filtros ANO/MÊS/ORIGEM/CONSULTA NOME** no URL params estão bloqueando tudo. Ex: `ano=2026` não tem rows / `mes=09` não tem / `q=nome` muito restrito. | params enviados vs `rows.length` antes e depois de limpar filtros | 🔍 pendente |
| **H4** | **AbortController aborta múltiplos loads** (useEffect rodou 2 vezes StrictMode React 18 → sign.abort() durante 2ª chamada cai no catch, setRows([])). | `ev.aborted === true` em qualquer evento | 🔍 pendente |
| **H5** | **Erro parse JSON ou TypeError** no client (`res.json()` com conteúdo não-JSON). | `err.message` + `ev.stage = 'invalid_json'` ou `ev.stage = 'apply_state_err'` | 🔍 pendente |

---

## 2 — Pontos de instrumentação (6 eventos)

| Evento | Stage | Quando dispara |
|---|---|---|
| `ev:load:start` | start | Antes do fetch (envia params) |
| `ev:load:bad_status` | bad_status | Fetch ok mas HTTP != 2xx |
| `ev:load:invalid_json` | invalid_json | `res.json()` lança exceção |
| `ev:load:shape` | shape | Payload válido — loga chaves + rows.length |
| `ev:load:state_applied` | state_applied | Depois de setRows/setKpis/setChart/setTotal |
| `ev:load:error` | error | catch (err) do fetch (rede, abort) |
| `ev:load:finally` | finally | sempre, no final do try |

---

## 3 — Evidências (pre-populate com o smoke do backend)

### Pré debug smoke (backend direto, 127.0.0.1:3002, bypass ProxyPass/MSAL)
- [ ] `curl -s http://127.0.0.1:3002/api/juridico/dashboard | jq '.total, (.rows|length), (.kpis|length), (.chart.meses|length)'` → esperado `256 / 256 / 8+ / 12`
- [ ] `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3002/api/juridico/kpis` → esperado 200

### Navegador (usuário reproduz)
- [ ] Ctrl + Shift + R na página `/juridico` → esperado pelo menos 1 evento load:start.
- [ ] Ao clicar em "Limpar filtros" → novo load:start.

---

## 4 — Workflow
| Step | Ação | Status |
|---|---|---|
| 1 | Setup debug session (sessionId + hypotheses) | ✅ |
| 2 | Smoke backend `/api/juridico/dashboard` | 🔲 |
| 3 | Instrumentar loadDashboard + build + reload | 🔲 |
| 4 | Reprodução usuário → coleta de logs | 🔲 |
| 5 | Análise logs → validar H1..H5 | 🔲 |
| 6 | Fix minimal baseado na hipótese | 🔲 |
| 7 | Re-reprodução → pós-fix logs comparison | 🔲 |
| 8 | Confirmação usuário + cleanup | 🔲 |
