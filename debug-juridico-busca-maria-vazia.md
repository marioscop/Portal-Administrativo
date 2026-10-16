# Debug Session: `juridico-busca-maria-vazia` [OPEN]

- **Session ID:** `juridico-busca-maria-vazia`
- **Bug relatado (pt-BR):** "digitei maria e não trouxe nada no Autor e nem no reu"
- **Sintoma esperado vs real:**
  - Esperado: `nome=MARIA` retorna linhas onde `autor_1..6_nome` / `reu_1..6_nome` / `autores` / `reus` contêm "MARIA" (case insensitive LIKE `%MARIA%`)
  - Real: tabela "Tipo de ações" retorna 0 registros / KPIs zerados
- **Módulo:** Jurídico (`/juridico`) — `GET /api/juridico/dashboard?nome=MARIA`
- **Backend em execução:** PM2 id=8 `portal-administrativo-backend` PID 68378 porta 3002
- **DB SQLite:** `/var/www/html/Portal-Administrativo/backend/data/juridico.sqlite` tabela `juridico_processos`
- **Data debug:** 2026-09-30

---

## 1. Falsifiable Hypotheses (H1..H5)

| ID | Hipótese | Como falsificar |
|---|---|---|
| H1 | **Case sensitivity no SQL LIKE**: `buildWhere()` usa `LIKE ?` padrão SQLite (SENSÍVEL a maiúscula/minúscula). Usuário digitou "maria" (minúsculo), mas os nomes no banco estão em "MARIA" (maiúsculo) → match 0. | Rodar SQL: `count(*)` WHERE `autor_1_nome LIKE '%maria%'` (case) vs `LIKE '%MARIA%'` vs `UPPER(col) LIKE UPPER('%maria%')`. Se count difere, H1 CONFIRMADA. |
| H2 | **Colunas nomeadas de autor_1_nome / reu_1_nome NÃO EXISTEM na tabela** (`juridico_processos`) e o `buildWhere` referencia coluna errada → WHERE dá erro silencioso `LIKE coluna_nao_existe` sempre false. | `.schema juridico_processos` no sqlite. Se colunas autor_1_nome / reu_1_nome não existem e o WHERE usa elas, H2 CONFIRMADA. |
| H3 | **Frontend envia o `busca` com erro de encoding** ou acento. User digitou "maria" mas query string fica `?nome=%20maria%20` ou algum escape ruim, e o %LIKE% com caractere extra não matcha. | Curl direto: `?nome=maria` vs `?busca=maria` e comparar total, vs usar o request que o browser fez (frontend params.toString()). |
| H4 | **NENHUM registro MARIA existe** mesmo no banco. O usuário ASSUME que existia MARIA mas a base só tem outros nomes. | Contar total com SQL LIKE case-insensitive em TODAS colunas autor/reu/concat autores/reus. Se count = 0 → H4 CONFIRMADA (não é bug, é dado inexistente). |
| H5 | **buildWhere() tem bug na OR / parênteses** ou `forAgg` está zerando busca nos `kpis/grafico` (mesmo problema corrigido antes), então a parte agregada não aplica. | Conferir `buildWhere()` forAgg vs normal e o WHERE completo construído em `listar()` usando `EXPLAIN QUERY PLAN` ou imprimir SQL real. |

---

## 2. Instrumentation (log key points)

- **[APPLIED d1]** Smoke SQL `sqlite3` na tabela `juridico_processos` para cada H1/H2/H4.
- **[APPLIED d1]** Smoke curl 127.0.0.1:3002 `/api/juridico/dashboard?nome=maria` + `/api/juridico/dashboard?nome=MARIA` + `/api/juridico/dashboard?busca=MARIA`.

---

## 3. Evidence collected

*(a preencher após rodar d1)*

---

## 4. Fix

*(a preencher)*

---

## 5. Pre vs Post comparison

*(a preencher)*

---

## 6. Status

- `[OPEN]` Debug em andamento.
