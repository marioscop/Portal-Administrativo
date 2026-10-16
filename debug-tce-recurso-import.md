# Debug Session: tce-recurso-import
- **Status**: [OPEN]
- **Issue**: Importação Recurso TCE (TCE-AGOSTO-2026.XLSX) finaliza “Sucesso” mas fica 0 inseridas / 19 puladas e não cria competência 09/2026 no SQLite.
- **Debug Server**: (iniciar) http://127.0.0.1:<port>/event
- **Log File**: .dbg/trae-debug-log-tce-recurso-import.ndjson

## Reproduction Steps
1. No front: importar Recurso TCE pelo link SharePoint do arquivo TCE-AGOSTO-2026.XLSX.
2. Confirmar no resumo do Job: 0 inseridas / 19 puladas.
3. Conferir SQLite: tabela "Recurso TCE" não ganha Copetencia=09/2026.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | O Job está caindo em “idempotente por bytes” (hash do arquivo) e não tenta inserir linhas. | Med | Low | Pending |
| B | O parser está detectando cabeçalho errado / mapeando colunas errado, e a strict whitelist falha (arquivo é “pulado”). | Med | Med | Pending |
| C | A competência (Copetencia) não está sendo preenchida antes do dedupe, então o hash da linha fica igual ao mês anterior e todas as 19 viram duplicatas. | High | Med | Pending |
| D | O dedupe está sendo feito por um kind diferente (ex.: “learning_profile:Recurso TCE” vs “recurso_tce:Recurso TCE”), causando comportamento inesperado de “tudo duplicado”. | Med | Med | Pending |
| E | O Job escreve no snapshot, mas não persiste de volta no banco principal por falha silenciosa de persistDatabase. | Low | Med | Pending |

## Log Evidence
- (a coletar via Debug Server)

## Verification Conclusion
- (pre-fix vs post-fix)
