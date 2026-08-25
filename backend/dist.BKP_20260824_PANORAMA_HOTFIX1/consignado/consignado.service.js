"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsignadoService = void 0;
const common_1 = require("@nestjs/common");
const _mod = __importStar(require("./import-consignado.js"));
const resolve_module_fn_js_1 = require("../utils/resolve-module-fn.js");
const ns = (_mod.default ?? _mod);
let ConsignadoService = class ConsignadoService {
    conciliarRecursoOrgaoRelatorio = ns.conciliarRecursoOrgaoRelatorio;
    conciliarExtratoRelatorio = ns.conciliarExtratoRelatorio;
    conciliarExtratoRelatorioDetalhe = ns.conciliarExtratoRelatorioDetalhe;
    conciliarTemporario = ns.conciliarTemporario;
    clonarParaRelatorioSisbrFromExtratos = ns.clonarParaRelatorioSisbrFromExtratos;
    incluirServidorAcordoJudicialTjgo = ns.incluirServidorAcordoJudicialTjgo;
    liquidacaoCcsExcluirRelatorioSisbr = ns.liquidacaoCcsExcluirRelatorioSisbr;
    liquidacaoProcessoJudicialExcluirRelatorioSisbr = ns.liquidacaoProcessoJudicialExcluirRelatorioSisbr;
    naoPossuiRecursoRelatorioSisbr = ns.naoPossuiRecursoRelatorioSisbr;
    liquidacaoForaDoVencimentoRelatorioSisbr = ns.liquidacaoForaDoVencimentoRelatorioSisbr;
    liquidacaoRecursoJudicialRelatorioSisbr = ns.liquidacaoRecursoJudicialRelatorioSisbr;
    liquidacaoAntecipadaViaCaixaRelatorioSisbr = ns.liquidacaoAntecipadaViaCaixaRelatorioSisbr;
    recursoRecebidoAMaiorRelatorioSisbr = ns.recursoRecebidoAMaiorRelatorioSisbr;
    devolucaoParcialAverbacaoRelatorioSisbr = ns.devolucaoParcialAverbacaoRelatorioSisbr;
    recursoRecebidoAMenorRelatorioSisbr = ns.recursoRecebidoAMenorRelatorioSisbr;
    recursoJudicialValorAMenorRelatorioSisbr = ns.recursoJudicialValorAMenorRelatorioSisbr;
    estornoValoresRelatorioSisbr = ns.estornoValoresRelatorioSisbr;
    alterarOrgaoRelatorioSisbr = ns.alterarOrgaoRelatorioSisbr;
    repactuacaoRelatorioSisbr = ns.repactuacaoRelatorioSisbr;
    antecipadoDevolvidoRelatorioSisbr = ns.antecipadoDevolvidoRelatorioSisbr;
    desfazerOcorrenciaRelatorioSisbr = ns.desfazerOcorrenciaRelatorioSisbr;
    getOcorrenciaCloneParaSisbrContext = ns.getOcorrenciaCloneParaSisbrContext;
    upsertConciliacaoTarifa = ns.upsertConciliacaoTarifa;
    fecharConciliacaoRecursoVsRelatorio = ns.fecharConciliacaoRecursoVsRelatorio;
    reenviarFechamentoConciliacaoParaContabilidade = ns.reenviarFechamentoConciliacaoParaContabilidade;
    reabrirConciliacaoRecursoVsRelatorio = ns.reabrirConciliacaoRecursoVsRelatorio;
    deleteOrgaoDePara = ns.deleteOrgaoDePara;
    exportConcilicacaoTemporarioXlsx = ns.exportConcilicacaoTemporarioXlsx;
    exportConcilicacaoOcorrenciasXlsx = ns.exportConcilicacaoOcorrenciasXlsx;
    listarConcilicacaoOcorrencias = ns.listarConcilicacaoOcorrencias;
    exportConcilicacaoRecursoVsRelatorioXlsx = ns.exportConcilicacaoRecursoVsRelatorioXlsx;
    exportRelatoriosValoresListaXlsx = ns.exportRelatoriosValoresListaXlsx;
    exportConcilicacaoRecursoVsRelatorioPdf = ns.exportConcilicacaoRecursoVsRelatorioPdf;
    getConciliacaoPorDataPreview = ns.getConciliacaoPorDataPreview;
    exportConcilicacaoPorDataXlsx = ns.exportConcilicacaoPorDataXlsx;
    exportConcilicacaoPorDataPdf = ns.exportConcilicacaoPorDataPdf;
    requestConciliacaoPorDataValidation = ns.requestConciliacaoPorDataValidation;
    decideConciliacaoPorDataValidation = ns.decideConciliacaoPorDataValidation;
    getConciliacaoPorDataValidationPortalHtml = ns.getConciliacaoPorDataValidationPortalHtml;
    getConsignadoAutomationConfig = ns.getConsignadoAutomationConfig;
    getConsignadoAccessEmails = ns.getConsignadoAccessEmails;
    setConsignadoAccessEmails = ns.setConsignadoAccessEmails;
    getModalidades = ns.getModalidades;
    saveModalidades = ns.saveModalidades;
    getOrgaoColumnsConfig = ns.getOrgaoColumnsConfig;
    saveOrgaoColumnsConfig = ns.saveOrgaoColumnsConfig;
    getOrgaoDePara = ns.getOrgaoDePara;
    upsertOrgaoDePara = ns.upsertOrgaoDePara;
    getExtratosConsolidacaoRecurso = ns.getExtratosConsolidacaoRecurso;
    upsertExtratosConsolidacaoRecurso = ns.upsertExtratosConsolidacaoRecurso;
    deleteExtratosConsolidacaoRecurso = ns.deleteExtratosConsolidacaoRecurso;
    getExtratosHistorico1Values = ns.getExtratosHistorico1Values;
    getRecursoTableNames = ns.getRecursoTableNames;
    getRelatorioConsolidacaoRecurso = ns.getRelatorioConsolidacaoRecurso;
    upsertRelatorioConsolidacaoRecurso = ns.upsertRelatorioConsolidacaoRecurso;
    deleteRelatorioConsolidacaoRecurso = ns.deleteRelatorioConsolidacaoRecurso;
    importExtratosTemporarioFromBuffer = ns.importExtratosTemporarioFromBuffer;
    importRelatoriosTemporarioFromBuffer = ns.importRelatoriosTemporarioFromBuffer;
    listarFiltrosTemporario = ns.listarFiltrosTemporario;
    listarMesesConcilicacaoDisponiveis = ns.listarMesesConcilicacaoDisponiveis;
    listarPendenciasFluxoConcilicacao = ns.listarPendenciasFluxoConcilicacao;
    atualizarPendenciaFluxoConcilicacao = ns.atualizarPendenciaFluxoConcilicacao;
    listarAuditoriaSistemica = ns.listarAuditoriaSistemica;
    saveConsignadoAutomationConfig = ns.saveConsignadoAutomationConfig;
    searchGraphUsers = ns.searchGraphUsers;
    importByLearningProfileFromFolderUrl = ns.importByLearningProfileFromFolderUrl;
    importByLearningProfileFromShareUrl = ns.importByLearningProfileFromShareUrl;
    runImportConsignado = ns.runImportConsignado;
    sendDailyOccurrencesPanoramaEmail = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.sendDailyOccurrencesPanoramaEmail, _mod, 'sendDailyOccurrencesPanoramaEmail');
    listHomeConciliacaoStatuses = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.listHomeConciliacaoStatuses, _mod, 'listHomeConciliacaoStatuses');
    importByLearningProfileFromFolderUrlResolved = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.importByLearningProfileFromFolderUrl, _mod, 'importByLearningProfileFromFolderUrl');
    importByLearningProfileFromShareUrlResolved = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.importByLearningProfileFromShareUrl, _mod, 'importByLearningProfileFromShareUrl');
    runImportConsignadoResolved = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.runImportConsignado, _mod, 'runImportConsignado');
    getTeamsDelegatedLoginStatus = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.getTeamsDelegatedLoginStatus, _mod, 'getTeamsDelegatedLoginStatus');
    startTeamsDelegatedDeviceCodeLogin = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.startTeamsDelegatedDeviceCodeLogin, _mod, 'startTeamsDelegatedDeviceCodeLogin');
    finishTeamsDelegatedDeviceCodeLogin = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.finishTeamsDelegatedDeviceCodeLogin, _mod, 'finishTeamsDelegatedDeviceCodeLogin');
    disconnectTeamsDelegatedLogin = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.disconnectTeamsDelegatedLogin, _mod, 'disconnectTeamsDelegatedLogin');
    debugEvent = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.debugEvent, _mod, 'debugEvent');
    debugEnsureExtratosRelatoriosTables = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.debugEnsureExtratosRelatoriosTables, _mod, 'debugEnsureExtratosRelatoriosTables');
    listImportJobsRecent = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.listImportJobsRecent, _mod, 'listImportJobsRecent');
    getImportJob = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.getImportJob, _mod, 'getImportJob');
    cancelImportJob = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.cancelImportJob, _mod, 'cancelImportJob');
    attachImportJobSse = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.attachImportJobSse, _mod, 'attachImportJobSse');
    submitImportJobAsync = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.submitImportJobAsync, _mod, 'submitImportJobAsync');
    runAutomationDriveHealthCheck = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.runAutomationDriveHealthCheck, _mod, 'runAutomationDriveHealthCheck');
    listAutomationSchedules = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.listAutomationSchedules, _mod, 'listAutomationSchedules');
    getAutomationSchedule = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.getAutomationSchedule, _mod, 'getAutomationSchedule');
    toggleAutomationSchedule = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.toggleAutomationSchedule, _mod, 'toggleAutomationSchedule');
    runAutomationScheduleNow = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.runAutomationScheduleNow, _mod, 'runAutomationScheduleNow');
    getAutomationGlobalConfig = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.getAutomationConfig, _mod, 'getAutomationConfig');
    saveAutomationGlobalConfigPartial = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.saveAutomationConfigPartial, _mod, 'saveAutomationConfigPartial');
    runAutomationHealthGeneral = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.runAutomationHealthGeneral, _mod, 'runAutomationHealthGeneral');
    listAutomationImportFailures = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.listAutomationImportFailures, _mod, 'listAutomationImportFailures');
    cleanupOldJobsTtl = (0, resolve_module_fn_js_1.resolveModuleFn)(ns.cleanupOldJobsTtl, _mod, 'cleanupOldJobsTtl');
    isTeamsMeetingUrl = (value) => {
        try {
            const u = new URL(value);
            return (u.hostname.toLowerCase() === 'teams.microsoft.com' &&
                u.pathname.toLowerCase().startsWith('/meet/'));
        }
        catch {
            return false;
        }
    };
    isRecursoTarget(t) {
        return (t === 'recurso_alego' ||
            t === 'recurso_neoconsig_demais' ||
            t === 'recurso_adfego' ||
            t === 'recurso_tce' ||
            t === 'recurso_tcm' ||
            t === 'recurso_tre' ||
            t === 'recurso_trt' ||
            t === 'recurso_eletra' ||
            t === 'recurso_mpgo' ||
            t === 'recurso_tjgo');
    }
};
exports.ConsignadoService = ConsignadoService;
exports.ConsignadoService = ConsignadoService = __decorate([
    (0, common_1.Injectable)()
], ConsignadoService);
//# sourceMappingURL=consignado.service.js.map