[CLOSED]

# Debug Session: sisbr-pdf-audit

## Sintoma
- Na conciliação (órgão GOIAS MP, competência 09/2026) aparecem casos onde o valor/contrato não “bate” com o PDF SISBR.
- Exemplo reportado: **LINDOMAR LOPES DE MORAIS** com valor **299,40**, que o usuário não encontra no PDF do órgão.
- Objetivo: auditar o PDF `Modelos/GOIAS MP PROCURADORIA GERAL DE JUSTICA.pdf` vs. o que foi persistido em `relatorio_consignado` e explicar divergências (relatório vs recurso vs ações).

## Hipóteses (falsificáveis)
1. O CPF/contrato do LINDOMAR não existe no PDF SISBR e está vindo do **Recurso** (não do Relatório); portanto é uma **pendência legítima** (diferença entre bases).
2. O CPF/contrato do LINDOMAR existe no PDF, mas foi **importado com chave/colunas divergentes** (ex.: operação/contrato ou vencimento), dificultando localizar manualmente.
3. O item mostrado no front não vem direto de `relatorio_consignado`, e sim de `conciliacao_pendencia_actions` (ex.: `clonar_para_relatorio_sisbr`) ou de outra origem, criando impressão de duplicidade/mismatch.
4. Existe divergência entre o PDF atual em `Modelos/` e o arquivo que foi importado do SharePoint (arquivo diferente/substituído), causando mismatch entre parse local e DB.
5. Há linhas órfãs/incompletas (sem operação / sem source) interferindo na conciliação e gerando valores que não deveriam aparecer.

## Evidências a coletar
- Confirmar presença/ausência do LINDOMAR no PDF (parse) e no banco (`relatorio_consignado`) para o `__source_file` do PDF.
- Comparação completa: conjunto de linhas parseadas do PDF vs conjunto de linhas no banco desse mesmo `__source_file` e competência.
- Identificar itens que aparecem no endpoint de conciliação, mas não existem no relatório (e vice-versa), apontando a origem (Recurso/Relatório/Ações).

## Evidências coletadas (2026-09-09)
- PDF (`Modelos/GOIAS MP PROCURADORIA GERAL DE JUSTICA.pdf`) contém a linha do cliente:
  - `5914-5 16.390 KESIA ... 39834408\t973.003.061-87`
  - seguida da operação `19653-6 ... Valor Parcela 299,40`
- No parser SISBR anterior, a matrícula com ponto (`16.390`) fazia a linha cliente não bater no regex (exigia só dígitos). Isso mantinha `currentClient` no cliente anterior (LINDOMAR) e a operação era associada ao CPF errado.
- Idem para a linha:
  - `5347-3 3.948 SUSY ... 982969999\t300.314.861-34`
  - operação `19517-2 ... Valor Parcela 2.844,36`, que estava sendo associada à VALERIA.

## Resultado após fix
- Parser SISBR agora aceita matrícula com ponto e normaliza para dígitos (ex.: `16.390` → `16390`; `3.948` → `3948`).
- Import seguro: se detectar linha cliente “quase válida” não reconhecida, aborta o import (evita contaminar banco).
- Banco corrigido (sem deletar):
  - rowid 5609 (op `19653-6` / `299,40`) → KESIA (CPF `973.003.061-87`)
  - rowid 5600 (op `19517-2` / `2.844,36`) → SUSY (CPF `300.314.861-34`)
