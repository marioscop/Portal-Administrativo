"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsignadoController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const consignado_service_js_1 = require("./consignado.service.js");
let ConsignadoController = class ConsignadoController {
    service;
    constructor(service) {
        this.service = service;
    }
    async getAutomationConfig() {
        return await this.service.getConsignadoAutomationConfig();
    }
    async saveAutomationConfig(body) {
        return await this.service.saveConsignadoAutomationConfig({
            sharePointFolderUrl: body.sharePointFolderUrl,
            relatorioSisbrUrl: body.relatorioSisbrUrl,
            recursoAlegoUrl: body.recursoAlegoUrl,
            recursoNeoconsigDemaisUrl: body.recursoNeoconsigDemaisUrl,
            recursoAdfegoUrl: body.recursoAdfegoUrl,
            recursoTceUrl: body.recursoTceUrl,
            recursoTcmUrl: body.recursoTcmUrl,
            recursoTreUrl: body.recursoTreUrl,
            recursoTrtUrl: body.recursoTrtUrl,
            recursoEletraUrl: body.recursoEletraUrl,
            recursoMpgoUrl: body.recursoMpgoUrl,
            recursoTjgoUrl: body.recursoTjgoUrl,
            notificationEmail: body.notificationEmail,
            notificationEmailContabilidade: body.notificationEmailContabilidade,
            occurrencesPanoramaDiretoriaEmail: body.occurrencesPanoramaDiretoriaEmail,
            occurrencesPanoramaGerentesEmail: body.occurrencesPanoramaGerentesEmail,
        });
    }
    async sendOccurrencesPanorama(body, queryForce) {
        const safeBody = body && typeof body === 'object' ? body : {};
        const forceEffective = Boolean(safeBody.force) || Boolean(queryForce) || String(queryForce).toLowerCase() === 'true';
        return await this.service.sendDailyOccurrencesPanoramaEmail({
            to: safeBody.to ?? null,
            cc: safeBody.cc ?? null,
            month: safeBody.month ?? null,
            previewOnly: Boolean(safeBody.previewOnly),
            force: forceEffective,
        });
    }
    async getTeamsDelegatedStatus() {
        return await this.service.getTeamsDelegatedLoginStatus();
    }
    async startTeamsDelegated() {
        return await this.service.startTeamsDelegatedDeviceCodeLogin();
    }
    async finishTeamsDelegated() {
        return await this.service.finishTeamsDelegatedDeviceCodeLogin();
    }
    async disconnectTeamsDelegated() {
        return await this.service.disconnectTeamsDelegatedLogin();
    }
    async searchUsers(q, limit) {
        return await this.service.searchGraphUsers({ q: String(q ?? ''), limit: Number(limit) || 10 });
    }
    async importNow(body, res) {
        try {
            if (body.mode === 'replace') {
                throw new Error('Importação em modo "replace" está desabilitada para evitar apagar dados.');
            }
            const forceSync = Boolean(body.sync);
            if (forceSync) {
                if (this.service.isRecursoTarget(body.target)) {
                    const url = String(body.learningUrl ?? body.folderUrl ?? '').trim();
                    return await this.service.importByLearningProfileFromFolderUrlResolved({
                        folderUrl: url,
                        forceKind: body.target,
                        ...(body.mode ? { forceMode: body.mode } : {}),
                    });
                }
                const url = String(body.folderUrl ?? '').trim();
                if (url && this.service.isTeamsMeetingUrl(url)) {
                    throw new Error('Link do Teams (reunião) não é um arquivo. Para importar Extrato/Relatório, informe a URL do SharePoint (pasta ou arquivo).');
                }
                const notificationTo = Array.isArray(body.notificationTo)
                    ? body.notificationTo
                    : typeof body.notificationTo === 'string' && body.notificationTo.trim()
                        ? body.notificationTo.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
                        : undefined;
                return await this.service.runImportConsignadoResolved({
                    folderUrl: body.folderUrl,
                    notificationTo,
                    modalidades: body.modalidades,
                    mode: body.mode,
                    target: body.target,
                });
            }
            let submitted = null;
            if (this.service.isRecursoTarget(body.target)) {
                const url = String(body.learningUrl ?? body.folderUrl ?? '').trim();
                submitted = await this.service.submitImportJobAsync('importByLearningProfileFromFolderUrl', {
                    folderUrl: url,
                    forceKind: body.target,
                    ...(body.mode ? { forceMode: body.mode } : {}),
                });
            }
            else {
                const url = String(body.folderUrl ?? '').trim();
                if (url && this.service.isTeamsMeetingUrl(url)) {
                    throw new Error('Link do Teams (reunião) não é um arquivo. Para importar Extrato/Relatório, informe a URL do SharePoint (pasta ou arquivo).');
                }
                const notificationTo = Array.isArray(body.notificationTo)
                    ? body.notificationTo
                    : typeof body.notificationTo === 'string' && body.notificationTo.trim()
                        ? body.notificationTo.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
                        : undefined;
                submitted = await this.service.submitImportJobAsync('runImportConsignado', {
                    folderUrl: body.folderUrl,
                    notificationTo,
                    modalidades: body.modalidades,
                    mode: body.mode,
                    target: body.target,
                });
            }
            try {
                if (res)
                    res.statusCode = 202;
            }
            catch { }
            return {
                accepted: true,
                async: true,
                ...submitted,
                streamUrl: submitted ? `/api/consignado/jobs/stream/${submitted.jobId}` : null,
                statusUrl: submitted ? `/api/consignado/jobs/${submitted.jobId}` : null,
                cancelUrl: submitted ? `/api/consignado/jobs/${submitted.jobId}/cancel` : null,
            };
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao executar importação.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async importRecursoAlego(body) {
        return await this.service.importByLearningProfileFromShareUrlResolved({
            fileUrl: body.fileUrl ?? '',
        });
    }
    async debugEnsureExtratosRelatorios() {
        try {
            return await this.service.debugEnsureExtratosRelatoriosTables();
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao executar ensureSchema extratos/relatorios.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async automationDriveHealthCheck(which) {
        try {
            return await this.service.runAutomationDriveHealthCheck(which);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao verificar saúde do drive.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async automationListSchedules() {
        try {
            return await this.service.listAutomationSchedules();
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao listar agendamentos.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async automationToggleSchedule(idRaw, body) {
        try {
            const id = String(idRaw ?? '').trim();
            if (!id)
                throw new Error('id do agendamento é obrigatório');
            const r = await this.service.toggleAutomationSchedule(id, typeof body?.enabled === 'boolean' ? body.enabled : undefined);
            if (!r.ok)
                throw new Error(r.reason || 'falha_ao_toggle');
            return r;
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao alternar agendamento.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async automationRunScheduleNow(idRaw) {
        try {
            const id = String(idRaw ?? '').trim();
            if (!id)
                throw new Error('id do agendamento é obrigatório');
            const r = await this.service.runAutomationScheduleNow(id);
            if (!r.ok)
                throw new Error(r.reason || 'falha_ao_executar');
            return { accepted: true, async: true, ...r };
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao executar agendamento manualmente.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async automationGetGlobalConfig() {
        try {
            return await this.service.getAutomationGlobalConfig();
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao ler configurações globais.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async automationSaveGlobalConfig(body) {
        try {
            return await this.service.saveAutomationGlobalConfigPartial(body);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao salvar configurações globais.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async automationHealthGeral() {
        try {
            return await this.service.runAutomationHealthGeneral();
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao verificar saúde geral da automação.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async automationListFailures(dias, limit, onlySkipped) {
        try {
            const opts = {};
            if (dias)
                opts.dias = Number(dias);
            if (limit)
                opts.limit = Number(limit);
            if (typeof onlySkipped === 'string' && ['1', 'true', 'yes', 'on'].includes(onlySkipped.toLowerCase()))
                opts.onlySkipped = true;
            return await this.service.listAutomationImportFailures(opts);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao listar falhas/skips da automação.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async automationCleanupTtlNow(body) {
        try {
            return await this.service.cleanupOldJobsTtl(body?.overrideTtlDias);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao executar limpeza TTL de jobs antigos.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async listImportJobs(limit) {
        const n = Math.max(1, Math.min(500, Number(limit) || 50));
        return await this.service.listImportJobsRecent({ limit: n });
    }
    async getImportJobById(jobIdRaw, _res) {
        const jobId = String(jobIdRaw ?? '').trim();
        if (!jobId)
            throw new common_1.InternalServerErrorException('jobId requerido');
        const r = await this.service.getImportJob(jobId);
        if (!r)
            throw new common_1.InternalServerErrorException(`job ${jobId} não encontrado`);
        return r;
    }
    async cancelImportJob(jobIdRaw) {
        const jobId = String(jobIdRaw ?? '').trim();
        if (!jobId)
            throw new common_1.InternalServerErrorException('jobId requerido');
        return await this.service.cancelImportJob(jobId);
    }
    async streamImportJobSse(res, jobIdRaw) {
        const jobId = String(jobIdRaw ?? '').trim();
        if (!jobId) {
            res.status(400).type('text/plain').send('jobId requerido');
            return;
        }
        const r = await this.service.attachImportJobSse(jobId, res);
        if (!r?.ok) {
            try {
                res.writeHead?.(404, { 'Content-Type': 'application/json' });
                res.write?.(JSON.stringify({ error: r?.reason || 'job_not_found' }));
                res.end?.();
            }
            catch { }
        }
    }
    async importNowSyncCompat(body) {
        try {
            if (body.mode === 'replace') {
                throw new Error('Importação em modo "replace" está desabilitada para evitar apagar dados.');
            }
            if (this.service.isRecursoTarget(body.target)) {
                const url = String(body.learningUrl ?? body.folderUrl ?? '').trim();
                return await this.service.importByLearningProfileFromFolderUrlResolved({
                    folderUrl: url,
                    forceKind: body.target,
                    ...(body.mode ? { forceMode: body.mode } : {}),
                });
            }
            const url = String(body.folderUrl ?? '').trim();
            if (url && this.service.isTeamsMeetingUrl(url)) {
                throw new Error('Link do Teams (reunião) não é um arquivo. Para importar Extrato/Relatório, informe a URL do SharePoint (pasta ou arquivo).');
            }
            const notificationTo = Array.isArray(body.notificationTo)
                ? body.notificationTo
                : typeof body.notificationTo === 'string' && body.notificationTo.trim()
                    ? body.notificationTo.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
                    : undefined;
            const result = await this.service.runImportConsignadoResolved({
                folderUrl: body.folderUrl,
                notificationTo,
                modalidades: body.modalidades,
                mode: body.mode,
                target: body.target,
            });
            return result;
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao executar importação.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async saveModalidadesNow(body) {
        return await this.service.saveModalidades({ modalidades: body.modalidades });
    }
    async getModalidadesNow() {
        return await this.service.getModalidades();
    }
    async getOrgaoColumns() {
        return await this.service.getOrgaoColumnsConfig();
    }
    async saveOrgaoColumns(body) {
        return await this.service.saveOrgaoColumnsConfig({
            extratos: body.extratos ?? null,
            relatorio: body.relatorio ?? null,
        });
    }
    async getOrgaoDeParaNow() {
        return await this.service.getOrgaoDePara();
    }
    async upsertOrgaoDeParaNow(body) {
        return await this.service.upsertOrgaoDePara({
            extratos: body.extratos ?? '',
            relatorio: body.relatorio ?? '',
        });
    }
    async deleteOrgaoDeParaNow(body) {
        return await this.service.deleteOrgaoDePara({ extratos: body.extratos ?? '' });
    }
    async getExtratosConsolidacaoRecursoNow() {
        return await this.service.getExtratosConsolidacaoRecurso();
    }
    async upsertExtratosConsolidacaoRecursoNow(body) {
        return await this.service.upsertExtratosConsolidacaoRecurso({
            orgao: body.orgao ?? '',
            historico1: body.historico1 ?? '',
        });
    }
    async deleteExtratosConsolidacaoRecursoNow(body) {
        return await this.service.deleteExtratosConsolidacaoRecurso({
            orgao: body.orgao ?? '',
            historico1: body.historico1 ?? '',
        });
    }
    async getExtratosHistorico1ValuesNow() {
        return await this.service.getExtratosHistorico1Values();
    }
    async getRecursoTableNamesNow() {
        return await this.service.getRecursoTableNames();
    }
    async getRelatorioConsolidacaoRecursoNow() {
        return await this.service.getRelatorioConsolidacaoRecurso();
    }
    async upsertRelatorioConsolidacaoRecursoNow(body) {
        return await this.service.upsertRelatorioConsolidacaoRecurso({
            recursoTable: body.recursoTable ?? '',
            targetRecursoTable: body.targetRecursoTable ?? '',
        });
    }
    async deleteRelatorioConsolidacaoRecursoNow(body) {
        return await this.service.deleteRelatorioConsolidacaoRecurso({
            recursoTable: body.recursoTable ?? '',
            targetRecursoTable: body.targetRecursoTable ?? '',
        });
    }
    async conciliarExtratos(month, orgao) {
        if (!month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        return await this.service.conciliarExtratoRelatorio({ month, orgao });
    }
    async listarMeses() {
        return await this.service.listarMesesConcilicacaoDisponiveis();
    }
    async listarAuditoria(month, orgao, group, limit, offset) {
        try {
            const parsedLimit = Number(String(limit ?? '').trim() || '100');
            const parsedOffset = Number(String(offset ?? '').trim() || '0');
            return await this.service.listarAuditoriaSistemica({
                month: String(month ?? '').trim() || null,
                orgao: String(orgao ?? '').trim() || null,
                group: String(group ?? '').trim() || null,
                limit: Number.isFinite(parsedLimit) ? parsedLimit : 100,
                offset: Number.isFinite(parsedOffset) ? parsedOffset : 0,
            });
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao listar auditoria.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async conciliarExtratosDetalhe(month, key, orgao) {
        if (!month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!key) {
            throw new common_1.InternalServerErrorException('Informe a Operação/Documento.');
        }
        return await this.service.conciliarExtratoRelatorioDetalhe({ month, key, orgao });
    }
    async conciliarRecursoVsRelatorio(month, orgao) {
        if (!month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!orgao || !orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        return await this.service.conciliarRecursoOrgaoRelatorio({ month, orgao });
    }
    async listarHomeStatusConciliacao(month) {
        if (!month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        return await this.service.listHomeConciliacaoStatuses({ month });
    }
    async listarPendenciasFluxo(month, orgao, vencimento, includeConcluidas) {
        if (!month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!orgao || !orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        return await this.service.listarPendenciasFluxoConcilicacao({
            month,
            orgao,
            vencimento: String(vencimento ?? '').trim() || null,
            includeConcluidas: String(includeConcluidas ?? '').trim() === '1',
        });
    }
    async atualizarPendenciaFluxo(body) {
        const id = Number(body.id);
        if (!Number.isFinite(id) || id <= 0) {
            throw new common_1.InternalServerErrorException('Informe o ID da ocorrência.');
        }
        if (!body.action) {
            throw new common_1.InternalServerErrorException('Informe a ação.');
        }
        return await this.service.atualizarPendenciaFluxoConcilicacao({
            id,
            toStage: body.toStage,
            action: body.action,
            note: body.note ?? null,
            gerenteEmail: body.gerenteEmail ?? null,
            requestedBy: body.requestedBy ?? null,
        });
    }
    async exportConciliacaoRecursoVsRelatorioXlsxNow(res, month, orgao, onlyDiff, vencimento) {
        if (!month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!orgao || !orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        try {
            const out = await this.service.exportConcilicacaoRecursoVsRelatorioXlsx({
                month,
                orgao,
                onlyDiff: String(onlyDiff ?? '').trim() === '1',
                vencimento: String(vencimento ?? '').trim() || null,
            });
            res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('content-disposition', `attachment; filename="${out.fileName}"`);
            res.status(200).send(out.buffer);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao exportar XLSX.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async exportRelatoriosValoresListaXlsxNow(res, month, orgao, onlyDiff, onlyConciliados, vencimento) {
        if (!month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        try {
            const out = await this.service.exportRelatoriosValoresListaXlsx({
                month,
                orgao: String(orgao ?? '').trim() || null,
                onlyDiff: String(onlyDiff ?? '').trim() === '1',
                onlyConciliados: String(onlyConciliados ?? '').trim() === '1',
                vencimento: String(vencimento ?? '').trim() || null,
            });
            res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('content-disposition', `attachment; filename="${out.fileName}"`);
            res.status(200).send(out.buffer);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao exportar XLSX da lista da conciliação.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async exportConciliacaoOcorrenciasXlsxNow(res, month, orgao, vencimento, action) {
        if (!month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        try {
            const out = await this.service.exportConcilicacaoOcorrenciasXlsx({
                month,
                orgao: String(orgao ?? '').trim() || null,
                vencimento: String(vencimento ?? '').trim() || null,
                action: String(action ?? '').trim() || null,
            });
            res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('content-disposition', `attachment; filename="${out.fileName}"`);
            res.status(200).send(out.buffer);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao exportar XLSX de ocorrências.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async listarConciliacaoOcorrenciasNow(month, orgao, vencimento, action) {
        if (!month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        return await this.service.listarConcilicacaoOcorrencias({
            month,
            orgao: String(orgao ?? '').trim() || null,
            vencimento: String(vencimento ?? '').trim() || null,
            action: String(action ?? '').trim() || null,
        });
    }
    async exportConciliacaoRecursoVsRelatorioPdfNow(res, month, orgao, vencimento) {
        if (!month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!orgao || !orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        try {
            const out = await this.service.exportConcilicacaoRecursoVsRelatorioPdf({
                month,
                orgao,
                vencimento: String(vencimento ?? '').trim() || null,
            });
            res.setHeader('content-type', 'application/pdf');
            res.setHeader('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('pragma', 'no-cache');
            res.setHeader('expires', '0');
            res.setHeader('surrogate-control', 'no-store');
            res.setHeader('content-disposition', `attachment; filename="${out.fileName}"`);
            res.status(200).send(out.buffer);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao exportar PDF.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async getConciliacaoPorDataNow(month, orgao, dateType, liquidationDate) {
        if (!month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        return await this.service.getConciliacaoPorDataPreview({
            month,
            orgao: String(orgao ?? '').trim() || null,
            dateType: String(dateType ?? '').trim() || 'todos',
            liquidationDate: String(liquidationDate ?? '').trim() || null,
        });
    }
    async requestConciliacaoPorDataValidationNow(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.liquidationDate || !String(body.liquidationDate).trim()) {
            throw new common_1.InternalServerErrorException('Informe a data de liquidação.');
        }
        return await this.service.requestConciliacaoPorDataValidation({
            month: body.month,
            orgao: body.orgao,
            liquidationDate: body.liquidationDate,
            requestedBy: body.requestedBy ?? null,
            rowSnapshot: body.rowSnapshot && typeof body.rowSnapshot === 'object' ? body.rowSnapshot : null,
        });
    }
    async decideConciliacaoPorDataValidationNow(body) {
        if (!body.token || !String(body.token).trim()) {
            throw new common_1.InternalServerErrorException('Informe o token de validação.');
        }
        if (!body.decision || (body.decision !== 'approved' && body.decision !== 'rejected')) {
            throw new common_1.InternalServerErrorException('Informe uma decisão válida.');
        }
        return await this.service.decideConciliacaoPorDataValidation({
            token: body.token,
            decision: body.decision,
            justification: body.justification ?? null,
        });
    }
    async getConciliacaoPorDataValidationPortalNow(res, token) {
        try {
            const html = await this.service.getConciliacaoPorDataValidationPortalHtml(String(token ?? '').trim());
            res.status(200).send(html);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao carregar a página de validação.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async exportConciliacaoPorDataXlsxNow(res, month, orgao, dateType, liquidationDate) {
        if (!month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        try {
            const out = await this.service.exportConcilicacaoPorDataXlsx({
                month,
                orgao: String(orgao ?? '').trim() || null,
                dateType: String(dateType ?? '').trim() || 'todos',
                liquidationDate: String(liquidationDate ?? '').trim() || null,
            });
            res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('content-disposition', `attachment; filename="${out.fileName}"`);
            res.status(200).send(out.buffer);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao exportar XLSX da conciliação por data.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async exportConciliacaoPorDataPdfNow(res, month, orgao, dateType, liquidationDate) {
        if (!month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        try {
            const out = await this.service.exportConcilicacaoPorDataPdf({
                month,
                orgao: String(orgao ?? '').trim() || null,
                dateType: String(dateType ?? '').trim() || 'todos',
                liquidationDate: String(liquidationDate ?? '').trim() || null,
            });
            res.setHeader('content-type', 'application/pdf');
            res.setHeader('content-disposition', `attachment; filename="${out.fileName}"`);
            res.status(200).send(out.buffer);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao exportar PDF da conciliação por data.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async clonarParaSisbr(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor.');
        }
        if (!body.justification || !body.justification.trim()) {
            throw new common_1.InternalServerErrorException('Informe a justificativa.');
        }
        return await this.service.clonarParaRelatorioSisbrFromExtratos({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            nome: body.nome,
            value: body.value,
            recursoTable: body.recursoTable,
            sourceRecursoTable: body.sourceRecursoTable,
            action: body.action,
            justification: body.justification,
            dueDate: body.dueDate,
            devolucaoDate: body.devolucaoDate,
        });
    }
    async ocorrenciaContext(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor.');
        }
        return await this.service.getOcorrenciaCloneParaSisbrContext({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            value: body.value,
        });
    }
    async incluirServidorAcordoJudicial(body) {
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor da parcela.');
        }
        if (!body.competencia || !body.competencia.trim()) {
            throw new common_1.InternalServerErrorException('Informe a competência.');
        }
        return await this.service.incluirServidorAcordoJudicialTjgo({
            target: body.target,
            orgao: body.orgao,
            nome: body.nome,
            cpf: body.cpf,
            value: body.value,
            competencia: body.competencia,
        });
    }
    async upsertTarifa(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor da tarifa.');
        }
        return await this.service.upsertConciliacaoTarifa({
            month: body.month,
            orgao: body.orgao,
            type: body.type,
            value: body.value,
        });
    }
    async alterarOrgaoRelatorio(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor.');
        }
        if (!body.fromEmpresa || !body.fromEmpresa.trim()) {
            throw new common_1.InternalServerErrorException('Empresa atual não informada.');
        }
        if (!body.toOrgao || !body.toOrgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão de destino.');
        }
        if (!body.justification || !body.justification.trim()) {
            throw new common_1.InternalServerErrorException('Informe a justificativa.');
        }
        return await this.service.alterarOrgaoRelatorioSisbr({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            nome: body.nome,
            value: body.value,
            fromEmpresa: body.fromEmpresa,
            toOrgao: body.toOrgao,
            action: body.action,
            justification: body.justification,
        });
    }
    async repactuacaoRelatorio(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor.');
        }
        if (!body.justification || !body.justification.trim()) {
            throw new common_1.InternalServerErrorException('Informe a justificativa.');
        }
        return await this.service.repactuacaoRelatorioSisbr({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            nome: body.nome,
            value: body.value,
            status: body.status,
            gerenteEmail: body.gerenteEmail,
            action: body.action,
            justification: body.justification,
        });
    }
    async liquidacaoCcsExcluirRelatorio(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor.');
        }
        if (!body.justification || !body.justification.trim()) {
            throw new common_1.InternalServerErrorException('Informe a justificativa.');
        }
        return await this.service.liquidacaoCcsExcluirRelatorioSisbr({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            nome: body.nome,
            value: body.value,
            fromEmpresa: body.fromEmpresa ?? null,
            action: body.action,
            justification: body.justification,
        });
    }
    async liquidacaoProcessoJudicialExcluirRelatorio(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor.');
        }
        if (!body.justification || !body.justification.trim()) {
            throw new common_1.InternalServerErrorException('Informe a justificativa.');
        }
        return await this.service.liquidacaoProcessoJudicialExcluirRelatorioSisbr({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            nome: body.nome,
            value: body.value,
            fromEmpresa: body.fromEmpresa ?? null,
            action: body.action,
            justification: body.justification,
        });
    }
    async naoPossuiRecursoRelatorio(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor.');
        }
        if (!body.gerenteEmail || !body.gerenteEmail.trim()) {
            throw new common_1.InternalServerErrorException('Informe o e-mail do gerente responsável.');
        }
        if (!body.message || !body.message.trim()) {
            throw new common_1.InternalServerErrorException('Informe a mensagem.');
        }
        return await this.service.naoPossuiRecursoRelatorioSisbr({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            nome: body.nome,
            value: body.value,
            fromEmpresa: body.fromEmpresa ?? null,
            gerenteEmail: body.gerenteEmail,
            message: body.message,
            action: body.action,
        });
    }
    async liquidacaoForaVencimento(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor.');
        }
        if (!body.liquidationDate || !body.liquidationDate.trim()) {
            throw new common_1.InternalServerErrorException('Informe a data de liquidação (dd/mm/aaaa).');
        }
        return await this.service.liquidacaoForaDoVencimentoRelatorioSisbr({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            nome: body.nome,
            value: body.value,
            fromEmpresa: body.fromEmpresa ?? null,
            liquidationDate: body.liquidationDate,
            action: body.action,
            justification: body.justification,
        });
    }
    async liquidacaoAntecipadaViaCaixa(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor.');
        }
        if (!body.liquidationDate || !body.liquidationDate.trim()) {
            throw new common_1.InternalServerErrorException('Informe a data de liquidação (dd/mm/aaaa).');
        }
        if (!body.liquidatedValue || !body.liquidatedValue.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor da antecipação.');
        }
        if (!body.justification || !body.justification.trim()) {
            throw new common_1.InternalServerErrorException('Informe a justificativa.');
        }
        return await this.service.liquidacaoAntecipadaViaCaixaRelatorioSisbr({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            nome: body.nome,
            value: body.value,
            fromEmpresa: body.fromEmpresa ?? null,
            liquidationDate: body.liquidationDate,
            liquidatedValue: body.liquidatedValue,
            action: body.action,
            justification: body.justification,
        });
    }
    async antecipadoDevolvido(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor.');
        }
        if (!body.devolucaoDate || !body.devolucaoDate.trim()) {
            throw new common_1.InternalServerErrorException('Informe a data de devolução (dd/mm/aaaa).');
        }
        if (!body.justification || !body.justification.trim()) {
            throw new common_1.InternalServerErrorException('Informe a justificativa.');
        }
        return await this.service.antecipadoDevolvidoRelatorioSisbr({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            nome: body.nome,
            value: body.value,
            devolucaoDate: body.devolucaoDate,
            action: body.action,
            justification: body.justification,
        });
    }
    async recursoJudicialValorAMenor(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor.');
        }
        if (!body.newValue || !body.newValue.trim()) {
            throw new common_1.InternalServerErrorException('Informe o novo valor.');
        }
        if (!body.justification || !body.justification.trim()) {
            throw new common_1.InternalServerErrorException('Informe a justificativa.');
        }
        return await this.service.recursoJudicialValorAMenorRelatorioSisbr({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            nome: body.nome,
            value: body.value,
            fromEmpresa: body.fromEmpresa ?? null,
            newValue: body.newValue,
            action: body.action,
            justification: body.justification,
        });
    }
    async recursoRecebidoAMenor(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor.');
        }
        if (!body.liquidationDate || !body.liquidationDate.trim()) {
            throw new common_1.InternalServerErrorException('Informe a data de liquidação (dd/mm/aaaa).');
        }
        const noDebitInAccount = Boolean(body.noDebitInAccount);
        if (!noDebitInAccount) {
            if (!body.debitAccountDate || !body.debitAccountDate.trim()) {
                throw new common_1.InternalServerErrorException('Informe a data de débito em conta (dd/mm/aaaa).');
            }
            if (!body.debitAccountValue || !body.debitAccountValue.trim()) {
                throw new common_1.InternalServerErrorException('Informe o valor de débito em conta.');
            }
        }
        if (!body.justification || !body.justification.trim()) {
            throw new common_1.InternalServerErrorException('Informe a justificativa.');
        }
        return await this.service.recursoRecebidoAMenorRelatorioSisbr({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            nome: body.nome,
            value: body.value,
            fromEmpresa: body.fromEmpresa ?? null,
            liquidationDate: body.liquidationDate,
            debitAccountDate: body.debitAccountDate ?? '',
            debitAccountValue: body.debitAccountValue ?? '',
            noDebitInAccount,
            differenceValue: body.differenceValue ?? '',
            action: body.action,
            justification: body.justification,
        });
    }
    async recursoRecebidoAMaior(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor.');
        }
        if (!body.liquidationDate || !body.liquidationDate.trim()) {
            throw new common_1.InternalServerErrorException('Informe a data de liquidação (dd/mm/aaaa).');
        }
        if (!body.devolucaoDate || !body.devolucaoDate.trim()) {
            throw new common_1.InternalServerErrorException('Informe a data de devolução (dd/mm/aaaa).');
        }
        if (!body.devolucaoValue || !body.devolucaoValue.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor devolvido.');
        }
        if (!body.justification || !body.justification.trim()) {
            throw new common_1.InternalServerErrorException('Informe a justificativa.');
        }
        return await this.service.recursoRecebidoAMaiorRelatorioSisbr({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            nome: body.nome,
            value: body.value,
            fromEmpresa: body.fromEmpresa ?? null,
            liquidationDate: body.liquidationDate,
            devolucaoDate: body.devolucaoDate,
            devolucaoValue: body.devolucaoValue,
            action: body.action,
            justification: body.justification,
        });
    }
    async devolucaoParcialAverbacao(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor.');
        }
        if (!body.liquidationDate || !body.liquidationDate.trim()) {
            throw new common_1.InternalServerErrorException('Informe a data de liquidação (dd/mm/aaaa).');
        }
        if (!body.devolucaoDate || !body.devolucaoDate.trim()) {
            throw new common_1.InternalServerErrorException('Informe a data de devolução (dd/mm/aaaa).');
        }
        if (!body.devolucaoValue || !body.devolucaoValue.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor devolvido.');
        }
        if (!body.justification || !body.justification.trim()) {
            throw new common_1.InternalServerErrorException('Informe a justificativa.');
        }
        return await this.service.devolucaoParcialAverbacaoRelatorioSisbr({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            nome: body.nome,
            value: body.value,
            fromEmpresa: body.fromEmpresa ?? null,
            liquidationDate: body.liquidationDate,
            devolucaoDate: body.devolucaoDate,
            devolucaoValue: body.devolucaoValue,
            action: body.action,
            justification: body.justification,
        });
    }
    async liquidacaoRecursoJudicial(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor.');
        }
        if (!body.liquidationDate || !body.liquidationDate.trim()) {
            throw new common_1.InternalServerErrorException('Informe a data da liquidação (dd/mm/aaaa).');
        }
        if (!body.liquidatedValue || !body.liquidatedValue.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor liquidado.');
        }
        if (!body.justification || !body.justification.trim()) {
            throw new common_1.InternalServerErrorException('Informe a justificativa.');
        }
        return await this.service.liquidacaoRecursoJudicialRelatorioSisbr({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            nome: body.nome,
            value: body.value,
            fromEmpresa: body.fromEmpresa ?? null,
            liquidationDate: body.liquidationDate,
            liquidatedValue: body.liquidatedValue,
            action: body.action,
            justification: body.justification,
        });
    }
    async estornoValores(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.cpf || !body.cpf.trim()) {
            throw new common_1.InternalServerErrorException('Informe o CPF.');
        }
        if (!body.nome || !body.nome.trim()) {
            throw new common_1.InternalServerErrorException('Informe o nome.');
        }
        if (!body.value || !body.value.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor atual.');
        }
        if (!body.estornoDate || !body.estornoDate.trim()) {
            throw new common_1.InternalServerErrorException('Informe a data de estorno (dd/mm/aaaa).');
        }
        if (!body.estornoValue || !body.estornoValue.trim()) {
            throw new common_1.InternalServerErrorException('Informe o valor de estorno.');
        }
        if (!body.estornoLiquidationDate || !body.estornoLiquidationDate.trim()) {
            throw new common_1.InternalServerErrorException('Informe a data de liquidação do estorno (dd/mm/aaaa).');
        }
        if (!body.liquidationDate || !body.liquidationDate.trim()) {
            throw new common_1.InternalServerErrorException('Informe a data da liquidação correta (dd/mm/aaaa).');
        }
        return await this.service.estornoValoresRelatorioSisbr({
            month: body.month,
            orgao: body.orgao,
            cpf: body.cpf,
            nome: body.nome,
            value: body.value,
            fromEmpresa: body.fromEmpresa ?? null,
            estornoLiquidationDate: body.estornoLiquidationDate,
            estornoDate: body.estornoDate,
            estornoValue: body.estornoValue,
            liquidationDate: body.liquidationDate,
            correctValue: body.correctValue,
            action: body.action,
            justification: body.justification,
        });
    }
    async fecharConciliacao(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        return await this.service.fecharConciliacaoRecursoVsRelatorio({
            month: body.month,
            orgao: body.orgao,
            vencimento: body.vencimento,
            closedBy: body.closedBy,
            contabilidadeEmail: body.contabilidadeEmail,
            evidencePngBase64: body.evidencePngBase64,
        });
    }
    async reabrirConciliacao(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        if (!body.password) {
            throw new common_1.InternalServerErrorException('Informe a senha.');
        }
        if (!body.justification || !body.justification.trim()) {
            throw new common_1.InternalServerErrorException('Informe a justificativa da reabertura.');
        }
        return await this.service.reabrirConciliacaoRecursoVsRelatorio({
            month: body.month,
            orgao: body.orgao,
            vencimento: body.vencimento,
            password: body.password,
            reopenedBy: body.reopenedBy,
            justification: body.justification,
        });
    }
    async reenviarContabilidade(body) {
        if (!body.month) {
            throw new common_1.InternalServerErrorException('Informe a competência no formato YYYY-MM.');
        }
        if (!body.orgao || !body.orgao.trim()) {
            throw new common_1.InternalServerErrorException('Informe o órgão.');
        }
        return await this.service.reenviarFechamentoConciliacaoParaContabilidade({
            month: body.month,
            orgao: body.orgao,
            vencimento: body.vencimento,
            requestedBy: body.requestedBy,
            contabilidadeEmail: body.contabilidadeEmail,
            evidencePngBase64: body.evidencePngBase64,
        });
    }
    async desfazerOcorrencia(body) {
        const id = Number(body.id);
        if (!Number.isFinite(id) || id <= 0) {
            throw new common_1.InternalServerErrorException('Informe o ID da ocorrência.');
        }
        return await this.service.desfazerOcorrenciaRelatorioSisbr({
            id,
            undoJustification: body.undoJustification,
        });
    }
    async getAccessEmails() {
        const result = await this.service.getConsignadoAccessEmails();
        return result;
    }
    async debugEvent(body) {
        try {
            const fs = require('fs');
            let u = 'http://127.0.0.1:7777/event';
            try {
                const envRaw = fs.readFileSync('/var/www/html/Portal-Administrativo/.dbg/access-validation-503.env', 'utf8');
                u = envRaw.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || u;
            }
            catch {
                void 0;
            }
            if (body && typeof body === 'object') {
                void fetch(u, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }).catch(() => void 0);
            }
        }
        catch {
            void 0;
        }
        return { ok: true };
    }
    async setAccessEmails(body) {
        return await this.service.setConsignadoAccessEmails({
            entries: body.entries,
            emails: body.emails,
        });
    }
    async temporarioPage() {
        const filters = await this.service.listarFiltrosTemporario();
        const escAttr = (v) => String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        const compOptions = filters.competencias
            .map((v) => `<option value="${escAttr(v)}">${escAttr(v)}</option>`)
            .join('\n');
        const orgaoOptions = filters.orgaos
            .map((v) => `<option value="${escAttr(v)}">${escAttr(v)}</option>`)
            .join('\n');
        return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Upload Temporário</title>
    <style>
      :root {
        --bg: #f6f7fb;
        --card: #ffffff;
        --text: #111827;
        --muted: #6b7280;
        --border: rgba(17, 24, 39, 0.12);
        --shadow: 0 10px 24px rgba(17, 24, 39, 0.08);
        --primary: #2563eb;
        --primary-2: #1d4ed8;
        --ring: rgba(37, 99, 235, 0.25);
      }
      * { box-sizing: border-box; }
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; background: var(--bg); color: var(--text); }
      .wrap { max-width: 1060px; margin: 0 auto; padding: 28px 18px 40px; }
      .top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
      .title { margin: 0; font-size: 20px; letter-spacing: -0.02em; }
      .subtitle { margin: 6px 0 0; color: var(--muted); font-size: 13px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .card { border: 1px solid var(--border); background: var(--card); padding: 16px; border-radius: 12px; box-shadow: var(--shadow); }
      h3 { margin: 0 0 10px; font-size: 14px; letter-spacing: -0.01em; }
      label { display: block; margin-top: 12px; font-weight: 600; font-size: 13px; }
      input[type="text"], input[type="file"], select {
        width: 100%;
        margin-top: 6px;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: #fff;
        outline: none;
      }
      input[type="text"]:focus, select:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 4px var(--ring);
      }
      button {
        margin-top: 14px;
        padding: 10px 14px;
        border-radius: 10px;
        border: 0;
        background: var(--primary);
        color: #fff;
        font-weight: 600;
        cursor: pointer;
      }
      button:hover { background: var(--primary-2); }
      .hint { color: var(--muted); font-size: 12px; margin-top: 6px; line-height: 1.4; }
      .divider { height: 1px; background: var(--border); margin: 12px 0; }
      @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="top">
        <div>
          <h2 class="title">Importação Temporária</h2>
          <div class="subtitle">Upload de Extratos/Relatórios e geração de conciliação com exportação CSV.</div>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h3>Extratos</h3>
          <div class="hint">Importa para <strong>extratos_temporario</strong> (append, não apaga o que já existe).</div>
          <div class="divider"></div>
          <form method="post" action="/api/consignado/temporario/extratos" enctype="multipart/form-data">
            <label for="tableNameEx">Nome da tabela</label>
            <input id="tableNameEx" name="tableName" type="text" value="extratos_temporario" />

            <label for="fileEx">Arquivo (.xls/.xlsx/.csv/.pdf)</label>
            <input id="fileEx" name="file" type="file" accept=".xls,.xlsx,.csv,.pdf" required />

            <button type="submit">Importar extratos</button>
          </form>
        </div>

        <div class="card">
          <h3>Relatórios</h3>
          <div class="hint">Importa para <strong>relatorios_temporario</strong> (append, não apaga o que já existe).</div>
          <div class="divider"></div>
          <form method="post" action="/api/consignado/temporario/relatorios" enctype="multipart/form-data">
            <label for="tableNameRel">Nome da tabela</label>
            <input id="tableNameRel" name="tableName" type="text" value="relatorios_temporario" />

            <label for="fileRel">Arquivo (.pdf)</label>
            <input id="fileRel" name="file" type="file" accept=".pdf" required />

            <button type="submit">Importar relatório</button>
          </form>
        </div>
      </div>

      <div class="card" style="margin-top: 16px;">
        <h3>Conciliação</h3>
        <div class="hint">Cruzamento por CPF e valor (Valor Parcela × VALOR).</div>
        <div class="divider"></div>
        <form method="get" action="/api/consignado/temporario/conciliacao">
          <div class="grid" style="grid-template-columns: 1fr 1fr;">
            <div>
              <label for="competencia">Competência</label>
              <select id="competencia" name="competencia">
                <option value="">Selecione...</option>
                ${compOptions}
              </select>
              <div class="hint">Usa: extratos_temporario.Competencia e relatorios_temporario.Copetencia</div>
            </div>
            <div>
              <label for="orgao">Órgão</label>
              <select id="orgao" name="orgao">
                <option value="">Todos</option>
                ${orgaoOptions}
              </select>
              <div class="hint">Filtra em: relatorios_temporario.EMPRESA</div>
            </div>
          </div>
          <div style="display:flex; gap: 10px; flex-wrap: wrap;">
            <button type="submit">Gerar conciliação</button>
          </div>
        </form>
      </div>
    </div>
  </body>
</html>`;
    }
    async conciliacaoTemporarioPage(competencia, orgao, status) {
        try {
            const result = await this.service.conciliarTemporario({
                competencia: competencia ?? null,
                orgao: orgao ?? null,
                status: status ?? null,
            });
            const esc = (v) => String(v ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            const statusKey = String(status ?? '')
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, '_') || '';
            const max = 200;
            const shown = result.rows.slice(0, max);
            const query = `competencia=${encodeURIComponent(competencia ?? '')}&orgao=${encodeURIComponent(orgao ?? '')}&status=${encodeURIComponent(status ?? '')}`;
            const rowsHtml = shown
                .map((r) => {
                const ok = r.StatusKey === 'conciliado';
                return `<tr>
  <td>${esc(r.Nome)}</td>
  <td>${esc(r.CPF)}</td>
  <td style="text-align:right">${esc(r.ValorRelatorio)}</td>
  <td style="text-align:right">${esc(r.ValorExtrato)}</td>
  <td><span class="pill ${ok ? 'ok' : 'bad'}">${esc(r.Status)}</span></td>
</tr>`;
            })
                .join('\n');
            return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Conciliação Temporária</title>
    <style>
      :root {
        --bg: #f6f7fb;
        --card: #ffffff;
        --text: #111827;
        --muted: #6b7280;
        --border: rgba(17, 24, 39, 0.12);
        --shadow: 0 10px 24px rgba(17, 24, 39, 0.08);
        --primary: #2563eb;
        --primary-2: #1d4ed8;
        --ok: #16a34a;
        --bad: #dc2626;
      }
      * { box-sizing: border-box; }
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; background: var(--bg); color: var(--text); }
      .wrap { max-width: 1060px; margin: 0 auto; padding: 28px 18px 40px; }
      .card { border: 1px solid var(--border); background: var(--card); padding: 16px; border-radius: 12px; box-shadow: var(--shadow); }
      h2 { margin: 0; font-size: 18px; letter-spacing: -0.02em; }
      .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 10px; }
      .kpi { border: 1px solid var(--border); border-radius: 12px; padding: 12px; background: #fff; }
      .kpi .label { color: var(--muted); font-size: 12px; }
      .kpi .value { font-size: 16px; font-weight: 700; margin-top: 4px; }
      .hint { color: var(--muted); font-size: 12px; margin-top: 8px; line-height: 1.4; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      a.btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid var(--border);
        text-decoration: none;
        color: var(--text);
        background: #fff;
        font-weight: 600;
      }
      a.btn.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
      a.btn.primary:hover { background: var(--primary-2); border-color: var(--primary-2); }
      .filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin-top: 12px; }
      .field { min-width: 220px; }
      label { display: block; font-weight: 700; font-size: 12px; color: #374151; margin-bottom: 6px; }
      select {
        width: 100%;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: #fff;
        outline: none;
      }
      select:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.18);
      }
      button.btn {
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: #fff;
        color: var(--text);
        font-weight: 700;
        cursor: pointer;
      }
      button.btn.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
      button.btn.primary:hover { background: var(--primary-2); border-color: var(--primary-2); }
      table { width: 100%; border-collapse: collapse; margin-top: 14px; overflow: hidden; border-radius: 12px; }
      thead th { position: sticky; top: 0; background: #fbfbfd; }
      th, td { border-bottom: 1px solid rgba(17, 24, 39, 0.08); padding: 10px 10px; font-size: 13px; vertical-align: top; }
      th { text-align: left; color: #374151; }
      tbody tr:nth-child(even) { background: rgba(17, 24, 39, 0.02); }
      .pill { display: inline-flex; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid var(--border); background: #fff; }
      .pill.ok { color: var(--ok); font-weight: 800; border-color: rgba(22, 163, 74, 0.25); background: rgba(22, 163, 74, 0.07); }
      .pill.bad { color: var(--bad); font-weight: 800; border-color: rgba(220, 38, 38, 0.25); background: rgba(220, 38, 38, 0.07); }
      @media (max-width: 900px) { .meta { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h2>Resultado da Conciliação</h2>
        <div class="hint">Competência: <strong>${esc(result.competencia || '')}</strong> | Órgão: <strong>${esc(result.orgao || '')}</strong> | Status: <strong>${esc(statusKey || 'todos')}</strong></div>

        <div class="meta">
          <div class="kpi"><div class="label">Total</div><div class="value">${result.total}</div></div>
          <div class="kpi"><div class="label">Conciliados</div><div class="value">${result.conciliados}</div></div>
          <div class="kpi"><div class="label">Não conciliados</div><div class="value">${result.naoConciliados}</div></div>
        </div>

        <div class="actions">
          <a class="btn" href="/api/consignado/temporario">Voltar</a>
          <a class="btn primary" href="/api/consignado/temporario/conciliacao.xlsx?${query}">Exportar XLSX</a>
          <a class="btn" href="/api/consignado/temporario/conciliacao.csv?${query}">Exportar CSV</a>
        </div>

        <form class="filters" method="get" action="/api/consignado/temporario/conciliacao">
          <input type="hidden" name="competencia" value="${esc(competencia ?? '')}" />
          <input type="hidden" name="orgao" value="${esc(orgao ?? '')}" />
          <div class="field">
            <label for="status">Filtrar status</label>
            <select id="status" name="status">
              <option value="" ${statusKey === '' ? 'selected' : ''}>Todos</option>
              <option value="conciliado" ${statusKey === 'conciliado' ? 'selected' : ''}>Conciliado</option>
              <option value="nao_conciliado" ${statusKey === 'nao_conciliado' ? 'selected' : ''}>Não conciliado</option>
            </select>
          </div>
          <button class="btn primary" type="submit">Aplicar filtro</button>
        </form>

        <div class="hint">Mostrando ${shown.length} de ${result.total} (use Exportar XLSX/CSV para o completo).</div>

        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th style="text-align:right">Valor Relatório</th>
              <th style="text-align:right">Valor Extrato</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  </body>
</html>`;
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao conciliar temporário.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async conciliacaoTemporarioCsv(competencia, orgao, status) {
        try {
            const result = await this.service.conciliarTemporario({
                competencia: competencia ?? null,
                orgao: orgao ?? null,
                status: status ?? null,
            });
            const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
            const header = ['Nome', 'CPF', 'ValorRelatorio', 'ValorExtrato', 'Status']
                .map(esc)
                .join(';');
            const lines = result.rows.map((r) => [r.Nome, r.CPF, r.ValorRelatorio, r.ValorExtrato, r.Status]
                .map(esc)
                .join(';'));
            return [header, ...lines].join('\r\n');
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao exportar conciliação.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async conciliacaoTemporarioXlsx(competencia, orgao, status, res) {
        try {
            const out = await this.service.exportConcilicacaoTemporarioXlsx({
                competencia: competencia ?? null,
                orgao: orgao ?? null,
                status: status ?? null,
            });
            res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('content-disposition', `attachment; filename="${out.fileName}"`);
            res.status(200).send(out.buffer);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao exportar XLSX.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async extratosTemporarioPage() {
        return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Upload - Extratos Temporário</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; }
      .box { max-width: 720px; border: 1px solid #ddd; padding: 16px; border-radius: 8px; }
      label { display: block; margin-top: 12px; font-weight: 600; }
      input[type="text"], input[type="file"] { width: 100%; padding: 8px; }
      button { margin-top: 16px; padding: 10px 14px; cursor: pointer; }
      .hint { color: #555; font-size: 13px; margin-top: 6px; }
    </style>
  </head>
  <body>
    <div class="box">
      <h2>Importar Extratos (Tabela Temporária)</h2>
      <form method="post" action="/api/consignado/temporario/extratos" enctype="multipart/form-data">
        <label for="tableName">Nome da tabela</label>
        <input id="tableName" name="tableName" type="text" value="extratos_temporario" />
        <div class="hint">O upload faz append (não apaga o que já existe).</div>

        <label for="file">Arquivo (.xls/.xlsx/.csv/.pdf)</label>
        <input id="file" name="file" type="file" accept=".xls,.xlsx,.csv,.pdf" required />

        <button type="submit">Importar</button>
      </form>
      <div class="hint"><a href="/api/consignado/temporario">Voltar</a></div>
    </div>
  </body>
</html>`;
    }
    async extratosTemporarioUpload(file, body) {
        try {
            if (!file || !file.buffer || file.buffer.length === 0) {
                throw new Error('Nenhum arquivo recebido.');
            }
            const name = String(file.originalname ?? '').trim();
            const lower = name.toLowerCase();
            if (!(lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv') || lower.endsWith('.pdf'))) {
                throw new Error('Formato inválido. Envie .xls, .xlsx, .csv ou .pdf.');
            }
            const result = await this.service.importExtratosTemporarioFromBuffer({
                fileName: name || 'upload',
                file: file.buffer,
                tableName: body?.tableName,
            });
            const statsRow = `<div>Inseridas: <code>${Number(result.insertedRows ?? 0).toLocaleString('pt-BR')}</code></div>` +
                (result.skippedRows && Number(result.skippedRows) > 0
                    ? `<div>Puladas (já existiam ou HISTÓRICO sem CRÉD.TED-STR): <code>${Number(result.skippedRows).toLocaleString('pt-BR')}</code></div>`
                    : '') +
                (Number(result?.skippedByHistoricoFilter ?? 0) > 0
                    ? `<div>Puladas por filtro HISTÓRICO (sem CRÉD.TED-STR): <code>${Number(result.skippedByHistoricoFilter).toLocaleString('pt-BR')}</code></div>`
                    : '');
            return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Upload - Extratos Temporário</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; }
      .box { max-width: 720px; border: 1px solid #ddd; padding: 16px; border-radius: 8px; }
      .ok { padding: 10px; background: #eef9f0; border: 1px solid #bfe7c7; border-radius: 6px; }
      a { display: inline-block; margin-top: 12px; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    </style>
  </head>
  <body>
    <div class="box">
      <div class="ok">
        <div><strong>Importação concluída</strong></div>
        <div>Tabela: <code>${result.tableName}</code></div>
        <div>Arquivo: <code>${result.fileName}</code></div>
        <div>Total de linhas no arquivo: <code>${result.rows}</code></div>
        <div>Colunas: <code>${result.columns}</code></div>
        ${statsRow}
      </div>
      <a href="/api/consignado/temporario">Voltar</a>
    </div>
  </body>
</html>`;
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao importar arquivo.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
    async relatoriosTemporarioPage() {
        return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Upload - Relatórios Temporário</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; }
      .box { max-width: 720px; border: 1px solid #ddd; padding: 16px; border-radius: 8px; }
      label { display: block; margin-top: 12px; font-weight: 600; }
      input[type="text"], input[type="file"] { width: 100%; padding: 8px; }
      button { margin-top: 16px; padding: 10px 14px; cursor: pointer; }
      .hint { color: #555; font-size: 13px; margin-top: 6px; }
    </style>
  </head>
  <body>
    <div class="box">
      <h2>Importar Relatórios (Tabela Temporária)</h2>
      <form method="post" action="/api/consignado/temporario/relatorios" enctype="multipart/form-data">
        <label for="tableName">Nome da tabela</label>
        <input id="tableName" name="tableName" type="text" value="relatorios_temporario" />
        <div class="hint">O upload faz append (não apaga o que já existe).</div>

        <label for="file">Arquivo (.pdf)</label>
        <input id="file" name="file" type="file" accept=".pdf" required />

        <button type="submit">Importar</button>
      </form>
      <div class="hint"><a href="/api/consignado/temporario">Voltar</a></div>
    </div>
  </body>
</html>`;
    }
    async relatoriosTemporarioUpload(file, body) {
        try {
            if (!file || !file.buffer || file.buffer.length === 0) {
                throw new Error('Nenhum arquivo recebido.');
            }
            const name = String(file.originalname ?? '').trim();
            const lower = name.toLowerCase();
            if (!lower.endsWith('.pdf')) {
                throw new Error('Formato inválido. Envie .pdf.');
            }
            const result = await this.service.importRelatoriosTemporarioFromBuffer({
                fileName: name || 'upload.pdf',
                file: file.buffer,
                tableName: body?.tableName,
            });
            const statsRow = `<div>Inseridas: <code>${Number(result.insertedRows ?? 0).toLocaleString('pt-BR')}</code></div>` +
                (result.skippedRows && Number(result.skippedRows) > 0
                    ? `<div>Puladas (já existiam): <code>${Number(result.skippedRows).toLocaleString('pt-BR')}</code></div>`
                    : '');
            return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Upload - Relatórios Temporário</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; }
      .box { max-width: 720px; border: 1px solid #ddd; padding: 16px; border-radius: 8px; }
      .ok { padding: 10px; background: #eef9f0; border: 1px solid #bfe7c7; border-radius: 6px; }
      a { display: inline-block; margin-top: 12px; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    </style>
  </head>
  <body>
    <div class="box">
      <div class="ok">
        <div><strong>Importação concluída</strong></div>
        <div>Tabela: <code>${result.tableName}</code></div>
        <div>Arquivo: <code>${result.fileName}</code></div>
        <div>Total de linhas no arquivo: <code>${result.rows}</code></div>
        <div>Colunas: <code>${result.columns}</code></div>
        ${statsRow}
      </div>
      <a href="/api/consignado/temporario">Voltar</a>
    </div>
  </body>
</html>`;
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Falha ao importar arquivo.';
            throw new common_1.InternalServerErrorException(message);
        }
    }
};
exports.ConsignadoController = ConsignadoController;
__decorate([
    (0, common_1.Get)('automation/config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "getAutomationConfig", null);
__decorate([
    (0, common_1.Post)('automation/config'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "saveAutomationConfig", null);
__decorate([
    (0, common_1.Post)('automation/occurrences-panorama/send'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('force')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "sendOccurrencesPanorama", null);
__decorate([
    (0, common_1.Get)('teams/delegated/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "getTeamsDelegatedStatus", null);
__decorate([
    (0, common_1.Post)('teams/delegated/start'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "startTeamsDelegated", null);
__decorate([
    (0, common_1.Post)('teams/delegated/finish'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "finishTeamsDelegated", null);
__decorate([
    (0, common_1.Post)('teams/delegated/disconnect'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "disconnectTeamsDelegated", null);
__decorate([
    (0, common_1.Get)('graph/users/search'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "searchUsers", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, common_1.Header)('X-Content-Type-Options', 'nosniff'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "importNow", null);
__decorate([
    (0, common_1.Post)('recurso-alego/import'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "importRecursoAlego", null);
__decorate([
    (0, common_1.Post)('debug/ensure-extratos-relatorios'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "debugEnsureExtratosRelatorios", null);
__decorate([
    (0, common_1.Get)('automation/health/drive'),
    __param(0, (0, common_1.Query)('which')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "automationDriveHealthCheck", null);
__decorate([
    (0, common_1.Get)('automation/schedules'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "automationListSchedules", null);
__decorate([
    (0, common_1.Post)('automation/schedules/:id/toggle'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "automationToggleSchedule", null);
__decorate([
    (0, common_1.Post)('automation/schedules/:id/run'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "automationRunScheduleNow", null);
__decorate([
    (0, common_1.Get)('automation/global-config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "automationGetGlobalConfig", null);
__decorate([
    (0, common_1.Post)('automation/global-config'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "automationSaveGlobalConfig", null);
__decorate([
    (0, common_1.Get)('automation/health/geral'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "automationHealthGeral", null);
__decorate([
    (0, common_1.Get)('automation/failures'),
    __param(0, (0, common_1.Query)('dias')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('onlySkipped')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "automationListFailures", null);
__decorate([
    (0, common_1.Post)('automation/cleanup-ttl'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "automationCleanupTtlNow", null);
__decorate([
    (0, common_1.Get)('jobs'),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "listImportJobs", null);
__decorate([
    (0, common_1.Get)('jobs/:jobId'),
    __param(0, (0, common_1.Param)('jobId')),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "getImportJobById", null);
__decorate([
    (0, common_1.Post)('jobs/:jobId/cancel'),
    __param(0, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "cancelImportJob", null);
__decorate([
    (0, common_1.Get)('jobs/stream/:jobId'),
    (0, common_1.Header)('Cache-Control', 'no-cache, no-transform'),
    (0, common_1.Header)('Connection', 'keep-alive'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "streamImportJobSse", null);
__decorate([
    (0, common_1.Post)('import/sync'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "importNowSyncCompat", null);
__decorate([
    (0, common_1.Post)('modalidades'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "saveModalidadesNow", null);
__decorate([
    (0, common_1.Get)('modalidades'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "getModalidadesNow", null);
__decorate([
    (0, common_1.Get)('orgao-columns'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "getOrgaoColumns", null);
__decorate([
    (0, common_1.Post)('orgao-columns'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "saveOrgaoColumns", null);
__decorate([
    (0, common_1.Get)('orgao-depara'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "getOrgaoDeParaNow", null);
__decorate([
    (0, common_1.Post)('orgao-depara'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "upsertOrgaoDeParaNow", null);
__decorate([
    (0, common_1.Post)('orgao-depara/delete'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "deleteOrgaoDeParaNow", null);
__decorate([
    (0, common_1.Get)('extratos-consolidacao-recurso'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "getExtratosConsolidacaoRecursoNow", null);
__decorate([
    (0, common_1.Post)('extratos-consolidacao-recurso'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "upsertExtratosConsolidacaoRecursoNow", null);
__decorate([
    (0, common_1.Post)('extratos-consolidacao-recurso/delete'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "deleteExtratosConsolidacaoRecursoNow", null);
__decorate([
    (0, common_1.Get)('extratos/historico1-values'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "getExtratosHistorico1ValuesNow", null);
__decorate([
    (0, common_1.Get)('recurso-tables'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "getRecursoTableNamesNow", null);
__decorate([
    (0, common_1.Get)('relatorio-consolidacao-recurso'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "getRelatorioConsolidacaoRecursoNow", null);
__decorate([
    (0, common_1.Post)('relatorio-consolidacao-recurso'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "upsertRelatorioConsolidacaoRecursoNow", null);
__decorate([
    (0, common_1.Post)('relatorio-consolidacao-recurso/delete'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "deleteRelatorioConsolidacaoRecursoNow", null);
__decorate([
    (0, common_1.Get)('conciliacao/extratos'),
    __param(0, (0, common_1.Query)('month')),
    __param(1, (0, common_1.Query)('orgao')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "conciliarExtratos", null);
__decorate([
    (0, common_1.Get)('conciliacao/meses'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "listarMeses", null);
__decorate([
    (0, common_1.Get)('auditoria'),
    __param(0, (0, common_1.Query)('month')),
    __param(1, (0, common_1.Query)('orgao')),
    __param(2, (0, common_1.Query)('group')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "listarAuditoria", null);
__decorate([
    (0, common_1.Get)('conciliacao/extratos/detalhe'),
    __param(0, (0, common_1.Query)('month')),
    __param(1, (0, common_1.Query)('key')),
    __param(2, (0, common_1.Query)('orgao')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "conciliarExtratosDetalhe", null);
__decorate([
    (0, common_1.Get)('conciliacao/recurso-vs-relatorio'),
    __param(0, (0, common_1.Query)('month')),
    __param(1, (0, common_1.Query)('orgao')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "conciliarRecursoVsRelatorio", null);
__decorate([
    (0, common_1.Get)('conciliacao/recurso-vs-relatorio/home-status'),
    __param(0, (0, common_1.Query)('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "listarHomeStatusConciliacao", null);
__decorate([
    (0, common_1.Get)('conciliacao/recurso-vs-relatorio/pendencias/fluxo'),
    __param(0, (0, common_1.Query)('month')),
    __param(1, (0, common_1.Query)('orgao')),
    __param(2, (0, common_1.Query)('vencimento')),
    __param(3, (0, common_1.Query)('includeConcluidas')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "listarPendenciasFluxo", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/pendencias/fluxo'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "atualizarPendenciaFluxo", null);
__decorate([
    (0, common_1.Get)('conciliacao/recurso-vs-relatorio/export.xlsx'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('month')),
    __param(2, (0, common_1.Query)('orgao')),
    __param(3, (0, common_1.Query)('onlyDiff')),
    __param(4, (0, common_1.Query)('vencimento')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "exportConciliacaoRecursoVsRelatorioXlsxNow", null);
__decorate([
    (0, common_1.Get)('conciliacao/recurso-vs-relatorio/lista/export.xlsx'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('month')),
    __param(2, (0, common_1.Query)('orgao')),
    __param(3, (0, common_1.Query)('onlyDiff')),
    __param(4, (0, common_1.Query)('onlyConciliados')),
    __param(5, (0, common_1.Query)('vencimento')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "exportRelatoriosValoresListaXlsxNow", null);
__decorate([
    (0, common_1.Get)('conciliacao/recurso-vs-relatorio/ocorrencias/export.xlsx'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('month')),
    __param(2, (0, common_1.Query)('orgao')),
    __param(3, (0, common_1.Query)('vencimento')),
    __param(4, (0, common_1.Query)('action')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "exportConciliacaoOcorrenciasXlsxNow", null);
__decorate([
    (0, common_1.Get)('conciliacao/recurso-vs-relatorio/ocorrencias'),
    __param(0, (0, common_1.Query)('month')),
    __param(1, (0, common_1.Query)('orgao')),
    __param(2, (0, common_1.Query)('vencimento')),
    __param(3, (0, common_1.Query)('action')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "listarConciliacaoOcorrenciasNow", null);
__decorate([
    (0, common_1.Get)('conciliacao/recurso-vs-relatorio/export.pdf'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('month')),
    __param(2, (0, common_1.Query)('orgao')),
    __param(3, (0, common_1.Query)('vencimento')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "exportConciliacaoRecursoVsRelatorioPdfNow", null);
__decorate([
    (0, common_1.Get)('conciliacao/recurso-vs-relatorio/data'),
    __param(0, (0, common_1.Query)('month')),
    __param(1, (0, common_1.Query)('orgao')),
    __param(2, (0, common_1.Query)('dateType')),
    __param(3, (0, common_1.Query)('liquidationDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "getConciliacaoPorDataNow", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/data/validacao/solicitar'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "requestConciliacaoPorDataValidationNow", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/data/validacao/decidir'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "decideConciliacaoPorDataValidationNow", null);
__decorate([
    (0, common_1.Get)('conciliacao/recurso-vs-relatorio/data/validacao/portal'),
    (0, common_1.Header)('content-type', 'text/html; charset=utf-8'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "getConciliacaoPorDataValidationPortalNow", null);
__decorate([
    (0, common_1.Get)('conciliacao/recurso-vs-relatorio/data/export.xlsx'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('month')),
    __param(2, (0, common_1.Query)('orgao')),
    __param(3, (0, common_1.Query)('dateType')),
    __param(4, (0, common_1.Query)('liquidationDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "exportConciliacaoPorDataXlsxNow", null);
__decorate([
    (0, common_1.Get)('conciliacao/recurso-vs-relatorio/data/export.pdf'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('month')),
    __param(2, (0, common_1.Query)('orgao')),
    __param(3, (0, common_1.Query)('dateType')),
    __param(4, (0, common_1.Query)('liquidationDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "exportConciliacaoPorDataPdfNow", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/clonar-para-sisbr'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "clonarParaSisbr", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/ocorrencia-context'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "ocorrenciaContext", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/inclusao-servidor-acordo-judicial-tjgo'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "incluirServidorAcordoJudicial", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/tarifa'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "upsertTarifa", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/alterar-orgao-relatorio'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "alterarOrgaoRelatorio", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/repactuacao-relatorio'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "repactuacaoRelatorio", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/liquidacao-ccs-excluir-relatorio'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "liquidacaoCcsExcluirRelatorio", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/liquidacao-processo-judicial-excluir-relatorio'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "liquidacaoProcessoJudicialExcluirRelatorio", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/nao-possui-recurso'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "naoPossuiRecursoRelatorio", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/liquidacao-fora-vencimento'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "liquidacaoForaVencimento", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/liquidacao-antecipada-via-caixa'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "liquidacaoAntecipadaViaCaixa", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/antecipado-devolvido'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "antecipadoDevolvido", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/recurso-judicial-valor-a-menor'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "recursoJudicialValorAMenor", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/recurso-recebido-a-menor'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "recursoRecebidoAMenor", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/recurso-recebido-a-maior'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "recursoRecebidoAMaior", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/devolucao-parcial-averbacao'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "devolucaoParcialAverbacao", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/liquidacao-recurso-judicial'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "liquidacaoRecursoJudicial", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/estorno-valores'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "estornoValores", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/fechar'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "fecharConciliacao", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/reabrir'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "reabrirConciliacao", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/reenviar-contabilidade'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "reenviarContabilidade", null);
__decorate([
    (0, common_1.Post)('conciliacao/recurso-vs-relatorio/desfazer-ocorrencia'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "desfazerOcorrencia", null);
__decorate([
    (0, common_1.Get)('access/emails'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "getAccessEmails", null);
__decorate([
    (0, common_1.Post)('debug/event'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "debugEvent", null);
__decorate([
    (0, common_1.Post)('access/emails'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "setAccessEmails", null);
__decorate([
    (0, common_1.Get)('temporario'),
    (0, common_1.Header)('content-type', 'text/html; charset=utf-8'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "temporarioPage", null);
__decorate([
    (0, common_1.Get)('temporario/conciliacao'),
    (0, common_1.Header)('content-type', 'text/html; charset=utf-8'),
    __param(0, (0, common_1.Query)('competencia')),
    __param(1, (0, common_1.Query)('orgao')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "conciliacaoTemporarioPage", null);
__decorate([
    (0, common_1.Get)('temporario/conciliacao.csv'),
    (0, common_1.Header)('content-type', 'text/csv; charset=utf-8'),
    __param(0, (0, common_1.Query)('competencia')),
    __param(1, (0, common_1.Query)('orgao')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "conciliacaoTemporarioCsv", null);
__decorate([
    (0, common_1.Get)('temporario/conciliacao.xlsx'),
    __param(0, (0, common_1.Query)('competencia')),
    __param(1, (0, common_1.Query)('orgao')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "conciliacaoTemporarioXlsx", null);
__decorate([
    (0, common_1.Get)('temporario/extratos'),
    (0, common_1.Header)('content-type', 'text/html; charset=utf-8'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "extratosTemporarioPage", null);
__decorate([
    (0, common_1.Post)('temporario/extratos'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: { fileSize: 25 * 1024 * 1024 },
    })),
    (0, common_1.Header)('content-type', 'text/html; charset=utf-8'),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "extratosTemporarioUpload", null);
__decorate([
    (0, common_1.Get)('temporario/relatorios'),
    (0, common_1.Header)('content-type', 'text/html; charset=utf-8'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "relatoriosTemporarioPage", null);
__decorate([
    (0, common_1.Post)('temporario/relatorios'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: { fileSize: 30 * 1024 * 1024 },
    })),
    (0, common_1.Header)('content-type', 'text/html; charset=utf-8'),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ConsignadoController.prototype, "relatoriosTemporarioUpload", null);
exports.ConsignadoController = ConsignadoController = __decorate([
    (0, common_1.Controller)('api/consignado'),
    __metadata("design:paramtypes", [consignado_service_js_1.ConsignadoService])
], ConsignadoController);
//# sourceMappingURL=consignado.controller.js.map