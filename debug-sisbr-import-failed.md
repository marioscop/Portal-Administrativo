[OPEN]

# Debug Session: sisbr-import-failed

## Sintoma
- Usuário tentou importar Relatórios SISBR (PDF) e “não importou”.

## Expectativa
- Job de importação deve reconhecer os PDFs SISBR na pasta configurada, processar, inserir/atualizar `relatorio_consignado` e mover para `Importados` quando aplicável.

## Ambiente
- Portal Administrativo (NestJS + SQLite/sql.js)
- Competência alvo: 09/2026 (informado pelo usuário)

## Hipóteses (falsificáveis)
1. O arquivo não foi considerado “compatível” (regex/nome/pasta/perfil) e o job terminou sem processar.
2. O job rodou, mas caiu em idempotência (hash já importado) e não inseriu nada.
3. O job iniciou, mas abortou por “importação segura” do parser SISBR (ex.: linha cliente quase válida não reconhecida / operação sem currentClient), então nada foi persistido.
4. Houve falha de download/Graph/SharePoint (404/403/timeout) e o job encerrou com erro antes de persistir.
5. Houve bloqueio de concorrência/lock do SQLite/sql.js (handle inválido, retry esgotou) e o job não conseguiu gravar.

## Evidências a coletar
- Job ID, perfil selecionado, pasta/arquivo, logs de importação (server).
- Contadores: arquivos varridos/compatíveis; linhas inseridas/puladas; motivo de skip/abort.
- Erros de download, parse ou DB (stacktrace).

## Próximos passos
- Instrumentar pontos do fluxo: detecção do arquivo, idempotência, download, parse SISBR, persistência e move para Importados.

## Evidência (pre-fix)
- Log do backend indicou abort do parser por segurança:
  - `SISBR: linha cliente não reconhecida pelo parser (evitando associação incorreta). Linha=148729-9 50951900 WALBER CAIXETA DA CUNHA   940.020.376-49`
- A linha cliente veio sem telefone e sem TABs antes do CPF, portanto não batia nos regex `cliReComAtiv/cliReSemAtiv`.

## Correção (fix)
- Ajuste no parser SISBR para aceitar linha cliente no formato “sem telefone e sem TAB”, preservando o modo seguro (continua abortando em linhas que parecem cliente mas não casam em nenhum formato).
- Implementado novo regex: `cliReSemTelSemTab` e relaxado `looksLikeClientLine` para aceitar CPF no final com/sem TAB.

## Evidência (post-fix)
- Importação do arquivo `TRIBUNAL DE JUSTICA DO ESTADO DE GOIAS.pdf` via endpoint sync (`target=relatorio`) concluiu com:
  - `totalFilesScanned=1`, `totalFilesMatched=1`
  - `totalRowsInserted=728`, `totalRowsSkipped=0`
  - `movedToImportados=true`, `movedToImportadosCount=1`
