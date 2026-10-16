# [OPEN] Session: bloqueio-nao-possui-recurso-global

## Bug Description (PT-BR)
Usuário tentou criar ação "Não Possui Recurso" para servidor CAIO LEOPOLDO POSSE JUBE CPF 016.337.551-85 parcela R$ 167,49 empresa PM 48941 competência 09/2026.

Bloqueio retornou:
> Não é permitido criar a ação "Não Possui Recurso". Existe um lançamento financeiro real nos recursos/extratos com o mesmo valor desta parcela (R$ 167,49) para este servidor. - Tabela de origem: **Recurso POLICIA MILITAR** - Match por: CPF (competência 09/2026) - CPF 016.337.551-85 / Nome / Valor: R$ 167,49. Ação bloqueada para não gerar divergências.

**Pedido do usuário:** Deixar inserir a ação *caso CPF + valor de parcela sejam de órgão DIFERENTE* (match deve considerar o órgão/empresa da parcela também, não só CPF+valor+competencia). Usuário afirma que essa mesma regra "já foi aplicada anteriormente em outro órgão" e agora **precisa ser GLOBAL** para todos os órgãos.

## Hipóteses (H1-H5 falsificáveis)
- **H1 (maior probabilidade):** Regra de validação da ação `NAO_POSSUI_RECURSO` (ou variante slug `nao-possui-recurso` / `NaoPossuiRecurso`) existe em um service DTO, e o WHERE do SQL que busca lançamentos recursos/extratos para bloquear **não inclui filtro de órgão/empresa (codigoEmpresaSisbr / orgaoId / origemNome)** na consulta.
- **H2 (média):** A regra de bloqueio já tem filtro órgão, mas existe um *fallback* "match global (sem órgão)" que pega o lançamento da PM mesmo quando servidor está em outro órgão.
- **H3 (média):** A versão "aplicada anteriormente em outro órgão" está em um bloco `if (perfil === X)` isolado e o caso PM caiu na versão genérica sem esse bloco (restrição de globalizar).
- **H4 (baixa):** Campos órgão estão nulos no servidor e/ou na parcela e a comparação de igualdade sempre dá false → nunca bloqueia.
- **H5 (baixa):** A consulta de bloqueio usa `LEFT JOIN` com tabela de órgãos, mas JOIN key errada → traz sempre Recurso POLICIA MILITAR.

## Arquivos-alvo prováveis (antes grep)
- `backend/src` ou `backend/dist` → service de Ocorrência / Ação / Parcela / Recurso
- Palavras chave exatas do erro para grep: `"Não é permitido criar a ação \"Não Possui Recurso\""`, `"NaoPossuiRecurso"`, `"lançamento financeiro real nos recursos/extratos"`, `"Match por:"`
