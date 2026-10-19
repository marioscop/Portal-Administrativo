export const RECURSO_ALEGO_LEARNING_PROFILE = {
  id: 'recurso_alego',
  kind: 'recurso_alego',
  matchUrlContainsRaw: '/99-Automações_TI/9.Recuperação de Crédito/',
  fileNameRegex: '^ALEGO\\s*-\\s*.+\\.(xlsx|xlsm|xls)$',
  targetTable: 'Recurso ALEGO',
  options: {
    mode: 'append',
    profileVersion: '2026-10-19_alego_plugin_alias_competencia_v1',
    pluginId: 'recurso_alego',
    folderCandidates: ['ALEGO'],
    ignoreImportados: true,
    checkDuplicateContent: true,
    moveToImportadosSubfolderAfterImport: true,
  },
} as const;
