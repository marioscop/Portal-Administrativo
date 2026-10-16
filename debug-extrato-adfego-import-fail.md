# Debug Session: extrato-adfego-import-fail
- **Status**: [RESOLVED]
- **Session ID**: extrato-adfego-import-fail
- **Arquivo alvo**: ADFEGO-SETEMBRO-2026.xlsx (Extrato Recurso ADFEGO) — layout "conta corrente"
- **Tabela alvo**: extratos
- **Regra competência**: mês arquivo + 1 → SETEMBRO → 10/2026
- **Restrição crítica**: aprendizado SOMENTE para arquivos ADFEGO (não afetar demais extratos de recurso)

---

## Causa-raiz (confirmada)

Foram **duas** causas independentes somadas:

### CAUSA 1 — Filtro `credTedFilterColumn` reativado (código)
- O layout "conta corrente" (ADFEGO/ELETRA/EQTPREV) tem colunas
  `DATA | DOCUMENTO | HISTÓRICO | INFORMAÇÕES COMPLEMENTARES | VALOR`, onde `HISTÓRICO` é o
  histórico real (`CRÉD.LIQUIDAÇÃO COBRANÇA`) e **não** contém o marcador `CRÉD.TED-STR`.
- `buildExtratoHeaderMapping` já retornava `credTedFilterColumn: null` para conta corrente,
  **mas** a linha de consumo usava `?? historicoSource`, e `null ?? historicoSource` reconvertia
  o `null` para a coluna HISTÓRICO, **reativando** o filtro → 100% das linhas puladas
  (`totalRowsInserted=0, totalRowsSkipped=2`).
- **Correção**: não aplicar o fallback quando `isContaCorrenteExtrato === true`
  (`import-consignado.ts`, função `insertExtratosRows`).

### CAUSA 2 — Arquivo "enterrado" em `Importados/Importados` (dados SharePoint)
- A pasta `Extrato Recurso` contém apenas a subpasta `Importados`, e a expansão de candidatos
  **ignora deliberadamente** pastas `Importados`
  (`motivoIgnorar: "usuario_ordem_ignorar_pasta_importados_todas_pastas"`).
- Como as tentativas anteriores "matcharam" o arquivo e moveram-no para `Importados` mesmo com
  `skippedRows>0`, e uma 2ª passagem (via URL direta do arquivo já dentro de `Importados`)
  executou o move novamente, o arquivo terminou em:
  `9.Recuperação de Crédito/2026/Setembro/Extrato Recurso/Importados/Importados/ADFEGO-SETEMBRO-2026.xlsx`
  → **inacessível** à varredura (que ignora `Importados`).

---

## Evidências

- Estrutura real via Graph (`root:/.../Extrato Recurso:/children`):
  - `Importados/` (folder)
    - `Importados/` (folder, criado 2026-10-15T19:23:45Z) → `ADFEGO-SETEMBRO-2026.xlsx`
    - `TODOS-SETEMBRO-2026.xlsx`
  - `ELETRA-SETEMBRO-2026.xlsx`
- Trace de expansão (URL base `9.Recuperação de Crédito`):
  - `ex.passo5IgnoradoImportadosNivel2 -> motivoIgnorar: usuario_ordem_ignorar_pasta_importados_todas_pastas`
  - `expandResult: { len: 0 }`
- Antes do fix: `totals { totalRowsInserted: 0, totalRowsSkipped: 2 }`.
- Depois do fix (arquivo reposicionado em `Extrato Recurso/`):
  - `totals { totalRowsInserted: 1, totalRowsSkipped: 0, totalFilesMatched: 1, totalFilesScanned: 1 }`
  - `movedToImportados: true, movedToImportadosCount: 1`

---

## Registro inserido (validação final)

```
rowid 547 | DATA 13/10/2026 | DOCUMENTO 772848 | HISTÓRICO CRÉD.LIQUIDAÇÃO COBRANÇA
          | VALOR 499.85 | Copetencia 10/2026 | __source_file Extrato Recurso/ADFEGO-SETEMBRO-2026.xlsx
```

---

## Ações concluídas

| Ação | Status |
|---|---|
| Inicializar session | ✅ |
| Evidências banco | ✅ |
| Inspecionar arquivo real | ✅ |
| Corrigir fallback `credTedFilterColumn` (conta corrente) | ✅ |
| Build + restart backend (pm2 id 8) | ✅ |
| Reposicionar arquivo (remover de `Importados/Importados`) | ✅ |
| Reimportar e validar 1 linha | ✅ |
| PM2 restart | ✅ |

## Pendência residual (não bloqueante)
- A rotina que move arquivos para `Importados` **aninha** `Importados/Importados` quando o arquivo
  já está dentro de uma pasta `Importados` (ocorre só em reimportação manual apontando URL direta
  para um arquivo já movido). Sugestão: guard para não mover se o parent já se chama `Importados`.
