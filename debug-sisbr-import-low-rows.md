[OPEN]

# Debug Session: sisbr-import-low-rows

## Sintoma
- Importação “Relatório SISBR” pelo front conclui com sucesso, mas insere poucas linhas.
- Caso atual (Agosto/2026 / Relatório Sisbr):
  - `TRIBUNAL REGIONAL DO TRABALHO.pdf` inseriu 1 linha
  - `TRIBUNAL REGIONAL ELEITORAL DE GOIAS.pdf` inseriu 7 linhas

## Objetivo
- Identificar por que o parser/fluxo está reconhecendo poucas linhas nesses PDFs.
- Ajustar a regra padrão do tipo “Relatório SISBR” para importar corretamente (sem associar operações ao cliente errado).

## Hipóteses (falsificáveis)
1. O PDF é escaneado/imagem e a extração de texto retorna poucas linhas (sem OCR), então o parser não encontra operações.
2. O layout do texto extraído difere do esperado (sem TABs/colunas coladas), fazendo as regex de cliente/operação não casarem.
3. O parser está abortando/ignorando partes do arquivo por “modo seguro” (linhas quase-cliente ou operações sem CPF associado).
4. O job está lendo um arquivo diferente do que o usuário espera (nome igual, mas conteúdo diferente), por pasta/SharePoint.
5. Idempotência/hash ou whitelist de colunas está pulando registros, reduzindo inserções.

## Evidências a coletar
- Contagem de páginas/linhas de texto extraído por PDF e amostras do texto.
- Contagem de matches: linhas de cliente reconhecidas, operações reconhecidas e rejeitadas.
- Motivos de skip/abort (se houver) e qual “modo” do parser foi usado.

## Ações
- [ ] Subir Debug Server e instrumentar pontos do fluxo (download → extração texto → parse → persistência).
- [ ] Reproduzir importação (sync) para TRT/TRE e coletar logs.
- [ ] Implementar fix mínimo baseado em evidências.
