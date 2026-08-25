# [OPEN] Debug Session: tre-import-wrong-columns
- Session ID: `tre-import-wrong-columns`
- Data: 2026-08-25
- Sintoma:
  - Importação manual do arquivo TRE-JULHO-2026.xlsx
    (tipo=Extrato Recurso, órgão=TRE-GO) inseriu linhas em colunas TOTALMENTE
    erradas na tabela `extratos`.
  - Modal de progresso não mostrou NENHUM dado de erro nem de sucesso
    (em branco / sem tabela de resultados).
  - Vamos debugar com o arquivo MODELO LOCAL:
    `Modelos\TRE-JULHO-2026.xlsx`
- Reprodução esperada no DEV:
  1. Abrir Automação → Importar Manual
  2. Tipo Importação = Extrato Recurso
  3. Órgão = TRIBUNAL REGIONAL ELEITORAL DE GOIAS
  4. Arquivo = URL do MODELO LOCAL ou SP Modelos/TRE-JULHO-2026.xlsx
  5. Clicar em Importar → verificar tabela `extratos`
- Resultado esperado (mapeamento 1:1):
  | Excel        | Banco      |
  |--------------|------------|
  | DATA         | DATA       |
  | DOCUMENTO    | DOCUMENTO  |
  | HISTÓRICO    | HISTÓRICO  |
  | INFORMAÇÕES COMPLEMENTARES → HISTÓRICO_1 (1ª linha só) |
  | VALOR        | VALOR      |
  | CompetenciaArquivo = TRE-Julho-2026 / TRE-JULHO-2026 |
  | Copetencia = 08/2026 (mês arquivo +1) |

## 4 Hipóteses Falsificáveis
- H1. Orquestrador NÃO está passando por `insertExtratosRows` → está
    caindo em `addMissingColumnsAndImportRows` / `insertRowsWithBatchTracking`
    genérica para extratos.
- H2. `detectCustomFileRules` NÃO detecta TRE em:
    (A) nome arquivo TRE-JULHO-2026.xlsx,
    (B) InfoComplementares ou
    (C) forceOrgaoFromUI.
- H3. `sourceFileFull` passado para insertExtratosRows é o caminho com UUID
    (uploads/2026-08-25/<uuid>.xlsx) → o regex falha em extrair
    TRE-MÊS-ANO.
- H4. Mapeamento colunas Excel → BD dentro do loop INSERT está errado
    (ex: pega indices de coluna mapeados por buildExtratoHeaderMapping,
    mas o Excel modelo LOCAL tem headers diferentes.)
- H5. (extra) O arquivo MODELO LOCAL não corresponde ao layout Extrato
    Recurso TRE → talvez ele seja Relatório Orgão TRE e por isso as
    colunas Nome/CPF são enviadas (H5 é hipótese sobre o arquivo, não o código).

## Status Hipóteses
| Hipótese | Status | Evidência |
|----------|--------|-----------|
| H1. Orquestrador chama insertExtratosRows? | PENDING | Instrumentação em importByLearningProfileFromFolderUrl + insertExtratosRows |
| H2. detectCustomFileRules detecta TRE?      | PENDING | Instrumentação no retorno detectCustomFileRules |
| H3. sourceFileFull = nome original?         | PENDING | Instrumentação opts.sourceFile ao chamar |
| H4. Loop INSERT mapeia colunas errado?      | PENDING | Instrumentação buildExtratoHeaderMapping e sample dos primeiros campos mapeados |
| H5. Arquivo MODELO é Relatório, não Extrato | PENDING | Ler via script xlsx as colunas reais de Modelos/TRE-JULHO-2026.xlsx |

## Logs
- Pasta logs: `.dbg/tre-import-wrong-columns/`
- Arquivo NDJSON: `trae-debug-log-tre-import-wrong-columns.ndjson`
- Debug Server health: `GET http://127.0.0.1:<port>/health`
