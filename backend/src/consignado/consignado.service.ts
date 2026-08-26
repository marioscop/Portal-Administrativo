import { Injectable } from '@nestjs/common';
import * as _mod from './import-consignado.js';
import { resolveModuleFn } from '../utils/resolve-module-fn.js';

type RecursoTarget =
  | 'both'
  | 'extratos'
  | 'relatorio'
  | 'recurso_alego'
  | 'recurso_neoconsig_demais'
  | 'recurso_adfego'
  | 'recurso_tce'
  | 'recurso_tcm'
  | 'recurso_tre'
  | 'recurso_trt'
  | 'recurso_eletra'
  | 'recurso_mpgo'
  | 'recurso_tjgo';

const ns = ((_mod as { default?: typeof _mod }).default ?? _mod) as typeof _mod;

@Injectable()
export class ConsignadoService {
  readonly conciliarRecursoOrgaoRelatorio = ns.conciliarRecursoOrgaoRelatorio;
  readonly conciliarExtratoRelatorio = ns.conciliarExtratoRelatorio;
  readonly conciliarExtratoRelatorioDetalhe = ns.conciliarExtratoRelatorioDetalhe;
  readonly conciliarTemporario = ns.conciliarTemporario;
  readonly clonarParaRelatorioSisbrFromExtratos = ns.clonarParaRelatorioSisbrFromExtratos;
  readonly incluirServidorAcordoJudicialTjgo = ns.incluirServidorAcordoJudicialTjgo;
  readonly liquidacaoCcsExcluirRelatorioSisbr = ns.liquidacaoCcsExcluirRelatorioSisbr;
  readonly liquidacaoProcessoJudicialExcluirRelatorioSisbr = ns.liquidacaoProcessoJudicialExcluirRelatorioSisbr;
  readonly naoPossuiRecursoRelatorioSisbr = ns.naoPossuiRecursoRelatorioSisbr;
  readonly liquidacaoForaDoVencimentoRelatorioSisbr = ns.liquidacaoForaDoVencimentoRelatorioSisbr;
  readonly liquidacaoRecursoJudicialRelatorioSisbr = ns.liquidacaoRecursoJudicialRelatorioSisbr;
  readonly liquidacaoAntecipadaViaCaixaRelatorioSisbr = ns.liquidacaoAntecipadaViaCaixaRelatorioSisbr;
  readonly recursoRecebidoAMaiorRelatorioSisbr = ns.recursoRecebidoAMaiorRelatorioSisbr;
  readonly devolucaoParcialAverbacaoRelatorioSisbr = ns.devolucaoParcialAverbacaoRelatorioSisbr;
  readonly recursoRecebidoAMenorRelatorioSisbr = ns.recursoRecebidoAMenorRelatorioSisbr;
  readonly recursoJudicialValorAMenorRelatorioSisbr = ns.recursoJudicialValorAMenorRelatorioSisbr;
  readonly estornoValoresRelatorioSisbr = ns.estornoValoresRelatorioSisbr;
  readonly alterarOrgaoRelatorioSisbr = ns.alterarOrgaoRelatorioSisbr;
  readonly repactuacaoRelatorioSisbr = ns.repactuacaoRelatorioSisbr;
  readonly antecipadoDevolvidoRelatorioSisbr = ns.antecipadoDevolvidoRelatorioSisbr;
  readonly desfazerOcorrenciaRelatorioSisbr = ns.desfazerOcorrenciaRelatorioSisbr;
  readonly getOcorrenciaCloneParaSisbrContext = ns.getOcorrenciaCloneParaSisbrContext;
  readonly upsertConciliacaoTarifa = ns.upsertConciliacaoTarifa;
  readonly fecharConciliacaoRecursoVsRelatorio = ns.fecharConciliacaoRecursoVsRelatorio;
  readonly reenviarFechamentoConciliacaoParaContabilidade = ns.reenviarFechamentoConciliacaoParaContabilidade;
  readonly reabrirConciliacaoRecursoVsRelatorio = ns.reabrirConciliacaoRecursoVsRelatorio;
  readonly deleteOrgaoDePara = ns.deleteOrgaoDePara;
  readonly exportConcilicacaoTemporarioXlsx = ns.exportConcilicacaoTemporarioXlsx;
  readonly exportConcilicacaoOcorrenciasXlsx = ns.exportConcilicacaoOcorrenciasXlsx;
  readonly listarConcilicacaoOcorrencias = ns.listarConcilicacaoOcorrencias;
  readonly exportConcilicacaoRecursoVsRelatorioXlsx = ns.exportConcilicacaoRecursoVsRelatorioXlsx;
  readonly exportRelatoriosValoresListaXlsx = ns.exportRelatoriosValoresListaXlsx;
  readonly exportConcilicacaoRecursoVsRelatorioPdf = ns.exportConcilicacaoRecursoVsRelatorioPdf;
  readonly getConciliacaoPorDataPreview = ns.getConciliacaoPorDataPreview;
  readonly exportConcilicacaoPorDataXlsx = ns.exportConcilicacaoPorDataXlsx;
  readonly exportConcilicacaoPorDataPdf = ns.exportConcilicacaoPorDataPdf;
  readonly requestConciliacaoPorDataValidation = ns.requestConciliacaoPorDataValidation;
  readonly decideConciliacaoPorDataValidation = ns.decideConciliacaoPorDataValidation;
  readonly getConciliacaoPorDataValidationPortalHtml = ns.getConciliacaoPorDataValidationPortalHtml;
  readonly getConsignadoAutomationConfig = ns.getConsignadoAutomationConfig;
  readonly getConsignadoAccessEmails = ns.getConsignadoAccessEmails;
  readonly setConsignadoAccessEmails = ns.setConsignadoAccessEmails;
  readonly getModalidades = ns.getModalidades;
  readonly saveModalidades = ns.saveModalidades;
  readonly getOrgaoColumnsConfig = ns.getOrgaoColumnsConfig;
  readonly saveOrgaoColumnsConfig = ns.saveOrgaoColumnsConfig;
  readonly getOrgaoDePara = ns.getOrgaoDePara;
  readonly upsertOrgaoDePara = ns.upsertOrgaoDePara;
  readonly getExtratosConsolidacaoRecurso = ns.getExtratosConsolidacaoRecurso;
  readonly upsertExtratosConsolidacaoRecurso = ns.upsertExtratosConsolidacaoRecurso;
  readonly deleteExtratosConsolidacaoRecurso = ns.deleteExtratosConsolidacaoRecurso;
  readonly getExtratosHistorico1Values = ns.getExtratosHistorico1Values;
  readonly getRecursoTableNames = ns.getRecursoTableNames;
  readonly getRelatorioConsolidacaoRecurso = ns.getRelatorioConsolidacaoRecurso;
  readonly upsertRelatorioConsolidacaoRecurso = ns.upsertRelatorioConsolidacaoRecurso;
  readonly deleteRelatorioConsolidacaoRecurso = ns.deleteRelatorioConsolidacaoRecurso;
  readonly importExtratosTemporarioFromBuffer = ns.importExtratosTemporarioFromBuffer;
  readonly importRelatoriosTemporarioFromBuffer = ns.importRelatoriosTemporarioFromBuffer;
  readonly listarFiltrosTemporario = ns.listarFiltrosTemporario;
  readonly listarMesesConcilicacaoDisponiveis = ns.listarMesesConcilicacaoDisponiveis;
  readonly listarPendenciasFluxoConcilicacao = ns.listarPendenciasFluxoConcilicacao;
  readonly atualizarPendenciaFluxoConcilicacao = ns.atualizarPendenciaFluxoConcilicacao;
  readonly listarAuditoriaSistemica = ns.listarAuditoriaSistemica;
  readonly saveConsignadoAutomationConfig = ns.saveConsignadoAutomationConfig;
  readonly searchGraphUsers = ns.searchGraphUsers;
  readonly importByLearningProfileFromFolderUrl = ns.importByLearningProfileFromFolderUrl;
  readonly importByLearningProfileFromShareUrl = ns.importByLearningProfileFromShareUrl;
  readonly runImportConsignado = ns.runImportConsignado;
  readonly sendDailyOccurrencesPanoramaEmail = resolveModuleFn(
    ns.sendDailyOccurrencesPanoramaEmail,
    _mod,
    'sendDailyOccurrencesPanoramaEmail',
  );
  readonly listHomeConciliacaoStatuses = resolveModuleFn(
    ns.listHomeConciliacaoStatuses,
    _mod,
    'listHomeConciliacaoStatuses',
  );
  readonly importByLearningProfileFromFolderUrlResolved = resolveModuleFn(
    ns.importByLearningProfileFromFolderUrl,
    _mod,
    'importByLearningProfileFromFolderUrl',
  );
  readonly importByLearningProfileFromShareUrlResolved = resolveModuleFn(
    ns.importByLearningProfileFromShareUrl,
    _mod,
    'importByLearningProfileFromShareUrl',
  );
  readonly runImportConsignadoResolved = resolveModuleFn(
    ns.runImportConsignado,
    _mod,
    'runImportConsignado',
  );
  readonly getTeamsDelegatedLoginStatus = resolveModuleFn(
    ns.getTeamsDelegatedLoginStatus,
    _mod,
    'getTeamsDelegatedLoginStatus',
  );
  readonly startTeamsDelegatedDeviceCodeLogin = resolveModuleFn(
    ns.startTeamsDelegatedDeviceCodeLogin,
    _mod,
    'startTeamsDelegatedDeviceCodeLogin',
  );
  readonly finishTeamsDelegatedDeviceCodeLogin = resolveModuleFn(
    ns.finishTeamsDelegatedDeviceCodeLogin,
    _mod,
    'finishTeamsDelegatedDeviceCodeLogin',
  );
  readonly disconnectTeamsDelegatedLogin = resolveModuleFn(
    ns.disconnectTeamsDelegatedLogin,
    _mod,
    'disconnectTeamsDelegatedLogin',
  );
  readonly debugEvent = resolveModuleFn(
    (ns as { debugEvent?: unknown }).debugEvent as unknown,
    _mod,
    'debugEvent',
  ) as unknown as (opts: unknown) => Promise<unknown>;

  readonly debugEnsureExtratosRelatoriosTables = resolveModuleFn(
    (ns as { debugEnsureExtratosRelatoriosTables?: unknown }).debugEnsureExtratosRelatoriosTables as unknown,
    _mod,
    'debugEnsureExtratosRelatoriosTables',
  ) as unknown as () => Promise<{
    ok: boolean;
    dbFilePath: string;
    tablesAfter: Array<{ name: string; columnsCount: number; rowCount?: number | null }>;
    learningProfiles: Array<{ id: string; kind: string; targetTable: string }>;
    allTablesContainingExtratoOrRelatorio: Array<{ name: string; rowCount: number | null; kind: string }>;
    walCheckpointResult: unknown;
    lastExtratosRows: Array<Record<string, unknown>>;
    extratosColumns: Array<string>;
    adfegoEletraFound: Array<Record<string, unknown>>;
    extratosRowIdInfo: Record<string, unknown>;
  }>;

  readonly listImportJobsRecent = resolveModuleFn(
    ns.listImportJobsRecent,
    _mod,
    'listImportJobsRecent',
  );
  readonly getImportJob = resolveModuleFn(
    ns.getImportJob,
    _mod,
    'getImportJob',
  );
  readonly cancelImportJob = resolveModuleFn(
    ns.cancelImportJob,
    _mod,
    'cancelImportJob',
  );
  readonly attachImportJobSse = resolveModuleFn(
    ns.attachImportJobSse,
    _mod,
    'attachImportJobSse',
  );
  readonly submitImportJobAsync = resolveModuleFn(
    ns.submitImportJobAsync,
    _mod,
    'submitImportJobAsync',
  );
  readonly runAutomationDriveHealthCheck = resolveModuleFn(
    ns.runAutomationDriveHealthCheck,
    _mod,
    'runAutomationDriveHealthCheck',
  );
  readonly listAutomationSchedules = resolveModuleFn(
    ns.listAutomationSchedules,
    _mod,
    'listAutomationSchedules',
  );
  readonly getAutomationSchedule = resolveModuleFn(
    ns.getAutomationSchedule,
    _mod,
    'getAutomationSchedule',
  );
  readonly toggleAutomationSchedule = resolveModuleFn(
    ns.toggleAutomationSchedule,
    _mod,
    'toggleAutomationSchedule',
  );
  readonly runAutomationScheduleNow = resolveModuleFn(
    ns.runAutomationScheduleNow,
    _mod,
    'runAutomationScheduleNow',
  );
  readonly getAutomationGlobalConfig = resolveModuleFn(
    ns.getAutomationConfig,
    _mod,
    'getAutomationConfig',
  );
  readonly saveAutomationGlobalConfigPartial = resolveModuleFn(
    ns.saveAutomationConfigPartial,
    _mod,
    'saveAutomationConfigPartial',
  );
  readonly runAutomationHealthGeneral = resolveModuleFn(
    ns.runAutomationHealthGeneral,
    _mod,
    'runAutomationHealthGeneral',
  );
  readonly listAutomationImportFailures = resolveModuleFn(
    ns.listAutomationImportFailures,
    _mod,
    'listAutomationImportFailures',
  );
  readonly cleanupOldJobsTtl = resolveModuleFn(
    ns.cleanupOldJobsTtl,
    _mod,
    'cleanupOldJobsTtl',
  );

  readonly debugExpandRecursoExtratos = resolveModuleFn(
    (ns as { debugExpandRecursoExtratos?: unknown }).debugExpandRecursoExtratos as unknown,
    _mod,
    'debugExpandRecursoExtratos',
  ) as unknown as (opts: {
    folderUrl?: string;
    forceKind?: string;
  }) => Promise<{
    ok: boolean;
    folderUrl: string;
    len: number;
    candidates: Array<{ id: string; name: string; lastModifiedDateTime?: string; folderPath: string; parentId: string }>;
    trace: Array<{ step: string; ts: number; data: Record<string, unknown> }>;
    setup: {
      driveId: string;
      baseFolderId: string;
      basePath: string;
      resolvedDirect: boolean;
      tokenOk: boolean;
      parsedUrlOk: boolean;
      driveDiscoveryOk: boolean;
    };
    error?: string;
  }>;

  readonly debugOneshotTreImportSync = resolveModuleFn(
    (ns as { debugOneshotTreImportSync?: unknown }).debugOneshotTreImportSync as unknown,
    _mod,
    'debugOneshotTreImportSync',
  ) as unknown as (opts: { folderUrl?: string; forceKind?: string }) => Promise<Record<string, unknown>>;

  readonly debugOneshotTrtLocalImport = resolveModuleFn(
    (ns as { debugOneshotTrtLocalImport?: unknown }).debugOneshotTrtLocalImport as unknown,
    _mod,
    'debugOneshotTrtLocalImport',
  ) as unknown as (opts: {
    localXlsxPath?: string;
    fileName?: string;
    folderPath?: string;
    fileId?: string;
    parentFolderId?: string;
    mode?: 'append' | 'replace';
    resetHashesFirst?: boolean;
    deleteLixoRowidsGte2?: boolean;
  }) => Promise<Record<string, unknown>>;

  readonly debugOneshotTreLocalImport = resolveModuleFn(
    (ns as { debugOneshotTreLocalImport?: unknown }).debugOneshotTreLocalImport as unknown,
    _mod,
    'debugOneshotTreLocalImport',
  ) as unknown as (opts: {
    localXlsxPath?: string;
    fileName?: string;
    folderPath?: string;
    fileId?: string;
    parentFolderId?: string;
    mode?: 'append' | 'replace';
    resetHashesFirst?: boolean;
    deleteLixoRowidsGte2?: boolean;
  }) => Promise<Record<string, unknown>>;

  readonly debugLocalSisbrPdfFile = resolveModuleFn(
    (ns as { debugLocalSisbrPdfFile?: unknown }).debugLocalSisbrPdfFile as unknown,
    _mod,
    'debugLocalSisbrPdfFile',
  ) as unknown as (
    filePathAbs: string,
  ) => Promise<{
    ok: boolean;
    filePath: string;
    fileExists: boolean;
    fileName: string;
    fileSizeBytes: number | null;
    pdfText: string | null;
    pdfTextLength: number;
    extractResult: {
      headers: string[];
      rows: Array<Record<string, unknown>>;
    } | null;
    extractRowsCount: number;
    headersFirst30: Array<{ key: string; sampleRow0: unknown; sampleRow1: unknown }>;
    rowsFirst20: Array<Record<string, unknown>>;
    allMoneysCount: number;
    allMoneysFirst30: string[];
    error?: string;
  }>;

  readonly isTeamsMeetingUrl = (value: string): boolean => {
    try {
      const u = new URL(value);
      return (
        u.hostname.toLowerCase() === 'teams.microsoft.com' &&
        u.pathname.toLowerCase().startsWith('/meet/')
      );
    } catch {
      return false;
    }
  };

  isRecursoTarget(t: RecursoTarget | string): boolean {
    return (
      t === 'recurso_alego' ||
      t === 'recurso_neoconsig_demais' ||
      t === 'recurso_adfego' ||
      t === 'recurso_tce' ||
      t === 'recurso_tcm' ||
      t === 'recurso_tre' ||
      t === 'recurso_trt' ||
      t === 'recurso_eletra' ||
      t === 'recurso_mpgo' ||
      t === 'recurso_tjgo'
    );
  }
}

export type { RecursoTarget };
