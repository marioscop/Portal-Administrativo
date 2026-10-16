[CLOSED]

# Debug Session: sisbr-silvana-maria

## Sintoma
- Na conciliação aparece **SILVANA ANTUNES VIEIRA (CPF 804.064.911-00)** com valores **394,47**, **77,89**, **80,72**.
- O usuário informou que esses valores não são da Silvana, e sim de **MARIA DE LOURDES**.
- Objetivo: validar origem desses valores (PDF × banco) e verificar se existem outros casos de associação incorreta no mesmo arquivo/competência.

## Hipóteses (falsificáveis)
1. As parcelas existem no PDF, mas foram associadas ao CPF/nome errado por falha de reconhecimento de “linha cliente” (TAB/telefone/null/matrícula com ponto/etc.).
2. O item exibido no front vem de outra fonte (Recurso/Ações/Fluxo) e não de `relatorio_consignado`, dando a impressão de erro de import.
3. O PDF atual em `Modelos/` é diferente do importado (arquivo substituído), causando divergências.
4. Existem linhas órfãs/incompletas ou duplicadas que contaminam a conciliação.

## Evidências a coletar
- Localizar no banco as linhas do CPF 804.064.911-00 com esses valores e identificar `__source_file`, competência, operação e vencimento.
- Localizar no PDF (parse + pdftotext) quem é o cliente associado a essas operações/valores.
- Rodar auditoria completa PDF × DB para o `__source_file` relevante e listar divergências.

## Evidências coletadas (2026-09-09)
- PDF (`GOIAS MP PROCURADORIA GERAL DE JUSTICA.pdf`) contém:
  - Cliente `28032-1` Matrícula `ASSISTENTEDESE` **MARIA DE LOURDES DE FARIA** (CPF `147.676.781-53`) com as operações:
    - `18664-0` Valor Parcela `80,72`
    - `17402-0` Valor Parcela `77,89`
    - `16429-0` Valor Parcela `394,47`
  - Cliente `4929-8` Matrícula `15.9031` **ADALBERTO GONZAGA NASCIMENTO JUNIOR** (CPF `589.880.841-87`) com as operações:
    - `18823-8` Valor Parcela `72,53`
    - `17277-5` Valor Parcela `2.001,61`
    - `16421-8` Valor Parcela `179,82`
- Banco (antes do ajuste) tinha essas 6 operações associadas aos CPFs errados:
  - `18664-0/17402-0/16429-0` como SILVANA (CPF `804.064.911-00`)
  - `18823-8/17277-5/16421-8` como VANESSA (CPF `883.557.131-68`)

## Correção aplicada
- Parser SISBR ajustado para aceitar Matrícula não numérica (ex.: `ASSISTENTEDESE`) e normalizar para dígitos apenas quando houver.
- Import seguro: aborta se encontrar linha-cliente “quase válida” não reconhecida, ou operação sem cliente/cpf.
- Banco corrigido (sem deletar dados):
  - rowid 5693/5694/5695 → MARIA DE LOURDES (CPF `147.676.781-53`)
  - rowid 5591/5592/5593 → ADALBERTO (CPF `589.880.841-87`)
