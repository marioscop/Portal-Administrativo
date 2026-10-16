[CLOSED]

# Debug Session: sisbr-pdf-misassign

## Sintoma
- Importação do PDF SISBR em SharePoint gerou linhas incorretas na tabela `relatorio_consignado`.
- Exemplo reportado: CPF `912.793.301-63` (LARISSA DE SOUSA DELLA COLETTA VIEIRA) ficou com valores de parcela que pertencem a outra pessoa (ANDRE DE OLIVEIRA CAMPOS), dentro da competência `09/2026`, órgão `GOIAS MP PROCURADORIA GERAL DE JUSTICA`.

## Fonte do arquivo
- SharePoint (Importados):
  - `.../2026/Agosto/Relatório Sisbr/Importados/GOIAS MP PROCURADORIA GERAL DE JUSTICA.pdf`

## Hipóteses (falsificáveis)
1. O parser PDF SISBR está “carregando” campos de uma linha anterior (ex.: `Nome/CPF`) e aplicando valores de parcela de uma linha posterior, por falha no reconhecimento de quebra de linha/colunas.
2. O texto extraído do PDF perdeu TABs/posições (ou sofreu normalização), levando a shift de colunas e associação incorreta.
3. Há linhas no PDF com wrap (quebra visual) que o parser interpreta como múltiplas linhas, juntando registros diferentes.
4. Existem registros com CPF repetido/contratos múltiplos no PDF; a lógica de “agregação”/dedupe do import está associando o valor ao nome errado.
5. O import está usando heurística de “empresa/órgão” ou “bloco” que, em alguns trechos do PDF, muda e não é detectada corretamente, deslocando o parse.

## Evidências a coletar
- Extrair do banco todas as linhas `relatorio_consignado` do arquivo/origem e competência, para isolar o conjunto afetado.
- Localizar no PDF (ou texto extraído) as linhas correspondentes a:
  - CPF `912.793.301-63` e nome LARISSA
  - Nome ANDRE DE OLIVEIRA CAMPOS
- Comparar “texto extraído (pré-parse)” vs. “campos parseados” com logs de instrumentação durante o import.

## Próximos passos
1. Consultas SQL de confirmação (não destrutivas) para validar o erro no banco e medir escopo.
2. Instrumentação mínima do parser SISBR (somente logs) para registrar:
   - trecho bruto da linha (com visualização de TABs)
   - campos parseados (cpf/nome/valor parcela/contrato)
   - regra/heurística aplicada no momento do parse
3. Reprocessar o mesmo arquivo em modo de simulação (sem inserir no banco) para comparar.

## Evidências coletadas (2026-09-09)
- Banco (`relatorio_consignado`, Copetencia `09/2026`, __source_file contendo `GOIAS MP PROCURADORIA GERAL DE JUSTICA.pdf`):
  - 247 linhas importadas.
  - Linhas incorretas confirmadas:
    - CPF `912.793.301-63` (LARISSA...) com `Valor Parcela` `1.180,32` (Operação `22311-5`)
    - CPF `912.793.301-63` (LARISSA...) com `Valor Parcela` `1.247,01` (Operação `22038-8`)
- Parse local do PDF em `Modelos/GOIAS MP PROCURADORIA GERAL DE JUSTICA.pdf`:
  - 248 linhas extraídas (diferença +1 vs banco).
  - Linha presente no PDF atual e ausente no banco desse `__source_file`:
    - CPF `008.835.381-80` (MARIA ISABEL NASCIMENTO GARCIA TEODORO), Operação `19141-8`, Parcela `29`, Valor Parcela `2.010,29`.
- Causa raiz confirmada do “nome/CPF carregar anterior” (Hipótese 1):
  - A linha do ANDRE existe no texto do PDF, mas vem com telefone `null`, ex.:
    - `132064-5 607800 ANDRE DE OLIVEIRA CAMPOS null\t957.736.731-34`
  - O regex do parser SISBR exigia telefone numérico (`\d+`), então essa linha não era reconhecida como “linha cliente”.
  - Resultado: `currentClient` permanecia como LARISSA e as operações seguintes eram associadas ao CPF/nome errado.
