# Debug Session: recurso-alego-import-fail

**Session ID:** `recurso-alego-import-fail`
**Status:** [OPEN]
**Created:** 2026-09-15 (data do sistema)
**Arquivo alvo:** `ALEGO-AGOSTO-2026.xlsx` (URL SharePoint fornecida)
**Perfil esperado:** Recurso ALEGO → tabela `Recurso ALEGO`
**Regra competência esperada:** mês do nome do arquivo + 1 → `AGOSTO-2026` = competência `09/2026`
**Sintoma do usuário:** arquivo não importa pelo front; precisa debugar e gravar aprendizado.

---

## 5 Hipóteses Falseáveis (H1 → H5)

| # | Hipótese | Como provar / falsear |
|---|---|---|
| **H1 — Perfil não existe ou match errado** | Não tem `import_learning_profiles` com `id/k/target = ALEGO`; ou `file_name_regex` não casa com `ALEGO-AGOSTO-2026.xlsx`; ou `match_url_contains` não contém o trecho `/ALEGO/` da URL. |
| **H2 — strictColumnWhitelist / alias mapping** | Igual ao TCE: ou whitelist tem colunas canônicas erradas com `strictMinMatches` alto (falha pulando tudo), ou o alias mapping do ALEGO tem o mesmo bug de `buildNorm` ordem (regex `[^a-z0-9]+` antes do `toLowerCase()`, apagando uppercase e colapsando todos cabeçalhos). |
| **H3 — Extração de competência** | `extractCompetenciaFromFileName=false` OU `competenciaMesArquivoSemIncremento=true` (faz AGOSTO=08/2026 em vez de 09/2026); ou a coluna de competência header-top detecta valor errado. Ou a competência fica NULL e cai em whitelist / linhas inválidas. |
| **H4 — idempotência de arquivo ou dedup agressivo** | Hash de bytes do arquivo já gravado em `consignado_app_config imported_file_sha256::v1::` (por tentativa anterior frustrada). Ou intra-run `dedupKey` usa campos ausentes no ALEGO (mesmo bug 19→9 do TCE). |
| **H5 — cabeçalho em linha errada / colunas duplicadas case** | Parser ALEGO espera header linha X (ex.: `detectaLinhaHeader<ORGÃO>`) mas o XLSX ALEGO tem header em outra linha; ou cópia raw keys uppercase gera `NOME vs Nome` e cai no `duplicate column name` no addMissingColumns. |

---

## Plano de Instrumentação (próximos passos)
1.  Sem mexer em lógica: confirmar H1 com `SELECT * FROM import_learning_profiles WHERE id LIKE '%alego%'` + scan no `file_name_regex`.
2.  Montar runner CLI igual ao do TCE (`/tmp/alego-import-runner.mjs`) para reproduzir sem UI e ver `insertedRows x skippedRows`.
3.  Reutilizar os `__dbg.report(...)` do fluxo de consignado (onde já existem pontos A–F) na sessão `recurso-alego-import-fail`, comparando headers mapeados vs whitelist.
4.  Com base no ndjson falsear H2/H3/H4/H5 → só depois aplicar patch mínimo.

---

## Execução / Logs

| Timestamp | Passo | Resultado |
|---|---|---|
| (início) | (a fazer) | |

---

## Referências (fix do TCE que provavelmente replicar pro ALEGO)
- Bug buildNorm ordem em alias mapping;
- Dedup case-insensitive colunas duplicate;
- DedupKey intra-run customizado por kind;
- profileVersion gravado no options_json.
