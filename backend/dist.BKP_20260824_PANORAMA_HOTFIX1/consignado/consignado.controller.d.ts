import type { Response } from 'express';
import { ConsignadoService } from './consignado.service.js';
export declare class ConsignadoController {
    private readonly service;
    constructor(service: ConsignadoService);
    getAutomationConfig(): Promise<{
        sharePointFolderUrl: string | null;
        relatorioSisbrUrl: string | null;
        recursoAlegoUrl: string | null;
        recursoNeoconsigDemaisUrl: string | null;
        recursoAdfegoUrl: string | null;
        recursoTceUrl: string | null;
        recursoTcmUrl: string | null;
        recursoTreUrl: string | null;
        recursoTrtUrl: string | null;
        recursoEletraUrl: string | null;
        recursoMpgoUrl: string | null;
        recursoTjgoUrl: string | null;
        notificationEmail: string | null;
        notificationEmailContabilidade: string | null;
        occurrencesPanoramaDiretoriaEmail: string | null;
        occurrencesPanoramaGerentesEmail: string | null;
        teamsDelegatedConnected: boolean;
        dbFilePath: string;
    }>;
    saveAutomationConfig(body: {
        sharePointFolderUrl?: string | null;
        relatorioSisbrUrl?: string | null;
        recursoAlegoUrl?: string | null;
        recursoNeoconsigDemaisUrl?: string | null;
        recursoAdfegoUrl?: string | null;
        recursoTceUrl?: string | null;
        recursoTcmUrl?: string | null;
        recursoTreUrl?: string | null;
        recursoTrtUrl?: string | null;
        recursoEletraUrl?: string | null;
        recursoMpgoUrl?: string | null;
        recursoTjgoUrl?: string | null;
        notificationEmail?: string | null;
        notificationEmailContabilidade?: string | null;
        occurrencesPanoramaDiretoriaEmail?: string | null;
        occurrencesPanoramaGerentesEmail?: string | null;
    }): Promise<{
        sharePointFolderUrl: string | null;
        relatorioSisbrUrl: string | null;
        recursoAlegoUrl: string | null;
        recursoNeoconsigDemaisUrl: string | null;
        recursoAdfegoUrl: string | null;
        recursoTceUrl: string | null;
        recursoTcmUrl: string | null;
        recursoTreUrl: string | null;
        recursoTrtUrl: string | null;
        recursoEletraUrl: string | null;
        recursoMpgoUrl: string | null;
        recursoTjgoUrl: string | null;
        notificationEmail: string | null;
        notificationEmailContabilidade: string | null;
        occurrencesPanoramaDiretoriaEmail: string | null;
        occurrencesPanoramaGerentesEmail: string | null;
        teamsDelegatedConnected: boolean;
        dbFilePath: string;
    }>;
    sendOccurrencesPanorama(body: {
        to?: string | string[] | null;
        cc?: string | string[] | null;
        month?: string | null;
        previewOnly?: boolean;
        force?: boolean;
    }): Promise<{
        ok?: boolean;
        skipped?: boolean;
        reason?: string;
        previewOnly?: boolean;
        monthKey?: string;
        to?: string[];
        cc?: string[];
        subject?: string;
        summary?: {
            ocorrenciasEmAtraso: number;
            orgaosComAtraso: number;
            filasComAtraso: number;
        };
        managerCards?: Array<{
            label: string;
            total: number;
        }>;
        html?: string;
        dbFilePath?: string | null;
        sent: boolean;
        recipients: Array<{
            type: "diretoria" | "gerencia" | "contabilidade";
            email: string;
        }>;
        subjectPrefix: string;
        countsByMonth: Record<string, {
            total: number;
            byAction: Record<string, number>;
        }>;
    }>;
    getTeamsDelegatedStatus(): Promise<{
        connected: boolean;
        hasRefreshToken: boolean;
        hasDeviceCode: boolean;
        deviceCodeExpiresAt: string | null;
        deviceCodeExpired: boolean;
        status: "connected" | "pending" | "expired" | "disconnected";
        dbFilePath: string;
    }>;
    startTeamsDelegated(): Promise<{
        userCode: string;
        verificationUri: string;
        message: string;
        expiresAt: string;
        interval: number | null;
        scope: string;
        dbFilePath: string;
    }>;
    finishTeamsDelegated(): Promise<{
        status: string;
        dbFilePath: string;
    }>;
    disconnectTeamsDelegated(): Promise<{
        status: string;
        dbFilePath: string;
    }>;
    searchUsers(q?: string, limit?: string): Promise<{
        items: Array<{
            displayName: string;
            email: string;
        }>;
        warning: string | null;
    }>;
    importNow(body: {
        folderUrl?: string;
        learningUrl?: string;
        notificationTo?: string;
        modalidades?: string[];
        mode?: 'append' | 'replace';
        sync?: boolean;
        target?: 'both' | 'extratos' | 'relatorio' | 'recurso_alego' | 'recurso_neoconsig_demais' | 'recurso_adfego' | 'recurso_tce' | 'recurso_tcm' | 'recurso_tre' | 'recurso_trt' | 'recurso_eletra' | 'recurso_mpgo' | 'recurso_tjgo';
    }, res?: Response): Promise<any>;
    importRecursoAlego(body: {
        fileUrl?: string;
    }): Promise<{
        importedFiles: Array<{
            fileName: string;
            targetTable: string;
            kind: string;
            profileId: string;
            insertedRows: number;
            skippedRows: number;
            headers: string[];
            skippedReason?: string;
        }>;
        totalFilesScanned: number;
        totalFilesMatched: number;
        totalRowsInserted: number;
        totalRowsSkipped: number;
        mode: "append" | "replace";
        tableName: string | null;
        rows: number;
        columns: number;
        skippedDuplicates: number;
        skippedNoCpf: number;
        movedToImportados: boolean;
        movedToImportadosCount: number | null;
        moveError: string | null;
        filesImported: Array<{
            name: string;
            insertedRows: number;
            skippedDuplicates: number;
            skippedNoCpf: number;
        }>;
        tablesCreated: Array<{
            tableName: string;
            insertedRows: number;
            skippedDuplicates: number;
            skippedNoCpf: number;
        }>;
        dbFilePath: string | null;
    }>;
    debugEnsureExtratosRelatorios(): Promise<{
        ok: boolean;
        dbFilePath: string;
        tablesAfter: Array<{
            name: string;
            columnsCount: number;
            rowCount?: number | null;
        }>;
        learningProfiles: Array<{
            id: string;
            kind: string;
            targetTable: string;
        }>;
        allTablesContainingExtratoOrRelatorio: Array<{
            name: string;
            rowCount: number | null;
            kind: string;
        }>;
        walCheckpointResult: unknown;
        lastExtratosRows: Array<Record<string, unknown>>;
        extratosColumns: Array<string>;
        adfegoEletraFound: Array<Record<string, unknown>>;
        extratosRowIdInfo: Record<string, unknown>;
    }>;
    automationDriveHealthCheck(which?: 'principal' | 'alego' | 'adfego' | 'sisbr' | 'all'): Promise<{
        checked: Record<string, {
            label: string;
            url?: string | null;
            result: Awaited<ReturnType<(folderUrl: string) => Promise<{
                ok: boolean;
                reason?: string;
                driveId?: string;
                rootFolderId?: string;
                filesSample?: Array<{
                    id: string;
                    name: string;
                    kind?: "folder" | "file" | null;
                }>;
                canWrite?: boolean;
            }>>>;
        }>;
        overallOk: boolean;
    }>;
    automationListSchedules(): Promise<import("./import-consignado.js").AutomationScheduleRecord[]>;
    automationToggleSchedule(idRaw?: string, body?: {
        enabled?: boolean;
    }): Promise<{
        ok: boolean;
        record?: import("./import-consignado.js").AutomationScheduleRecord;
        reason?: string;
    }>;
    automationRunScheduleNow(idRaw?: string): Promise<{
        ok: boolean;
        reason?: string;
        jobId?: string;
        status?: import("./import-consignado.js").JobStatus;
        createdAtIso?: string;
        accepted: boolean;
        async: boolean;
    }>;
    automationGetGlobalConfig(): Promise<import("./import-consignado.js").AutomationConfigFull>;
    automationSaveGlobalConfig(body: {
        teamsWebhookUrl?: string | null;
        teamsNotifyEnabled?: boolean;
        jobsTtlDias?: number;
        schedulerEnabled?: boolean;
        scheduleDefaultHora?: number;
        scheduleDefaultMin?: number;
        teamsWebhookUrlClear?: boolean;
    }): Promise<import("./import-consignado.js").AutomationConfigFull>;
    automationHealthGeral(): Promise<{
        serverAtIso: string;
        scheduler: import("./import-consignado.js").SchedTickState & {
            enabled: boolean;
            nextRuns: Array<{
                id: string;
                title: string;
                nextRunAtIso?: string;
                enabled: boolean;
                lastRunAtIso?: string;
            }>;
        };
        ttl: {
            lastCleanupAtIso?: string;
            jobsInMem: number;
            jobsPersistedApprox?: number;
        };
        jobsLast7d: {
            succeeded: number;
            failed: number;
            cancelled: number;
            queuedRunning: number;
            totalRowsInserted: number;
            totalRowsSkipped: number;
        };
        drive?: Awaited<ReturnType<typeof import("./import-consignado.js").runAutomationDriveHealthCheck>>;
        config: import("./import-consignado.js").AutomationConfigFull;
    }>;
    automationListFailures(dias?: string, limit?: string, onlySkipped?: string): Promise<{
        total: number;
        rows: import("./import-consignado.js").FailureDashboardRow[];
        dias: number;
    }>;
    automationCleanupTtlNow(body?: {
        overrideTtlDias?: number;
    }): Promise<{
        removed: number;
        ttlDias: number;
        checked: number;
    }>;
    listImportJobs(limit?: string): Promise<any>;
    getImportJobById(jobIdRaw?: string, _res?: Response): Promise<any>;
    cancelImportJob(jobIdRaw?: string): Promise<any>;
    streamImportJobSse(res: Response, jobIdRaw?: string): Promise<void>;
    importNowSyncCompat(body: {
        folderUrl?: string;
        learningUrl?: string;
        notificationTo?: string;
        modalidades?: string[];
        mode?: 'append' | 'replace';
        target?: 'both' | 'extratos' | 'relatorio' | 'recurso_alego' | 'recurso_neoconsig_demais' | 'recurso_adfego' | 'recurso_tce' | 'recurso_tcm' | 'recurso_tre' | 'recurso_trt' | 'recurso_eletra' | 'recurso_mpgo' | 'recurso_tjgo';
    }): Promise<{
        importedFiles: Array<{
            fileName: string;
            targetTable: string;
            kind: string;
            profileId: string;
            insertedRows: number;
            skippedRows: number;
            headers: string[];
            skippedReason?: string;
        }>;
        totalFilesScanned: number;
        totalFilesMatched: number;
        totalRowsInserted: number;
        totalRowsSkipped: number;
        mode: "append" | "replace";
        tableName: string | null;
        rows: number;
        columns: number;
        skippedDuplicates: number;
        skippedNoCpf: number;
        movedToImportados: boolean;
        movedToImportadosCount: number | null;
        moveError: string | null;
        filesImported: Array<{
            name: string;
            insertedRows: number;
            skippedDuplicates: number;
            skippedNoCpf: number;
        }>;
        tablesCreated: Array<{
            tableName: string;
            insertedRows: number;
            skippedDuplicates: number;
            skippedNoCpf: number;
        }>;
        dbFilePath: string | null;
    } | {
        executed: true;
        summary: Record<string, unknown>;
        resultsPerKind: Record<string, ReturnType<typeof import("./import-consignado.js").importByLearningProfileFromFolderUrl>>;
    }>;
    saveModalidadesNow(body: {
        modalidades?: string[];
    }): Promise<{
        modalidades: string[];
        dbFilePath: string;
    }>;
    getModalidadesNow(): Promise<{
        modalidades: string[];
        dbFilePath: string;
    }>;
    getOrgaoColumns(): Promise<{
        config: {
            extratos: string | null;
            relatorio: string | null;
        };
        tables: {
            extratos: boolean;
            relatorio: boolean;
        };
        columns: {
            extratos: string[];
            relatorio: string[];
        };
        resolvedOrgaoColumns: {
            extratos: string | null;
            relatorio: string | null;
        };
        values: {
            extratos: {
                value: string;
                count: number;
            }[];
            relatorio: {
                value: string;
                count: number;
            }[];
        };
        dbFilePath: string;
    }>;
    saveOrgaoColumns(body: {
        extratos?: string | null;
        relatorio?: string | null;
    }): Promise<{
        config: {
            extratos: string | null;
            relatorio: string | null;
        };
        tables: {
            extratos: boolean;
            relatorio: boolean;
        };
        columns: {
            extratos: string[];
            relatorio: string[];
        };
        resolvedOrgaoColumns: {
            extratos: string | null;
            relatorio: string | null;
        };
        values: {
            extratos: {
                value: string;
                count: number;
            }[];
            relatorio: {
                value: string;
                count: number;
            }[];
        };
        dbFilePath: string;
    }>;
    getOrgaoDeParaNow(): Promise<{
        items: {
            extratos: string;
            relatorio: string;
            createdAt: string;
        }[];
        dbFilePath: string;
    }>;
    upsertOrgaoDeParaNow(body: {
        extratos?: string;
        relatorio?: string;
    }): Promise<{
        items: {
            extratos: string;
            relatorio: string;
            createdAt: string;
        }[];
        dbFilePath: string;
    }>;
    deleteOrgaoDeParaNow(body: {
        extratos?: string;
    }): Promise<{
        items: {
            extratos: string;
            relatorio: string;
            createdAt: string;
        }[];
        dbFilePath: string;
    }>;
    getExtratosConsolidacaoRecursoNow(): Promise<{
        items: Array<{
            orgao: string;
            historico1: string;
            createdAt: string;
        }>;
        dbFilePath: string;
    }>;
    upsertExtratosConsolidacaoRecursoNow(body: {
        orgao?: string;
        historico1?: string;
    }): Promise<{
        items: Array<{
            orgao: string;
            historico1: string;
            createdAt: string;
        }>;
        dbFilePath: string;
    }>;
    deleteExtratosConsolidacaoRecursoNow(body: {
        orgao?: string;
        historico1?: string;
    }): Promise<{
        items: Array<{
            orgao: string;
            historico1: string;
            createdAt: string;
        }>;
        dbFilePath: string;
    }>;
    getExtratosHistorico1ValuesNow(): Promise<{
        values: Array<{
            value: string;
            count: number;
        }>;
        dbFilePath: string;
    }>;
    getRecursoTableNamesNow(): Promise<{
        values: string[];
        dbFilePath: string;
    }>;
    getRelatorioConsolidacaoRecursoNow(): Promise<{
        items: Array<{
            recursoTable: string;
            targetRecursoTable: string;
            createdAt: string;
        }>;
        dbFilePath: string;
    }>;
    upsertRelatorioConsolidacaoRecursoNow(body: {
        recursoTable?: string;
        targetRecursoTable?: string;
    }): Promise<{
        items: Array<{
            recursoTable: string;
            targetRecursoTable: string;
            createdAt: string;
        }>;
        dbFilePath: string;
    }>;
    deleteRelatorioConsolidacaoRecursoNow(body: {
        recursoTable?: string;
        targetRecursoTable?: string;
    }): Promise<{
        items: Array<{
            recursoTable: string;
            targetRecursoTable: string;
            createdAt: string;
        }>;
        dbFilePath: string;
    }>;
    conciliarExtratos(month?: string, orgao?: string): Promise<{
        dbFilePath: string;
        message?: string | undefined;
        month: string;
        columns: {
            extratos: {
                date: string;
                key: string;
                value: string;
            };
            relatorio: {
                date: string | null;
                key: string;
                value: string;
            };
        };
        totals: {
            extrato: {
                cents: number;
                text: string;
            };
            relatorio: {
                cents: number;
                text: string;
            };
            diff: {
                cents: number;
                text: string;
            };
        };
        items: {
            extratoText: string;
            relatorioText: string;
            diffText: string;
            key: string;
            extratoCents: number;
            relatorioCents: number;
            diffCents: number;
            extratoCount: number;
            relatorioCount: number;
            conciliated: boolean;
        }[];
    }>;
    listarMeses(): Promise<{
        months: string[];
        dbFilePath: string;
    }>;
    listarAuditoria(month?: string, orgao?: string, group?: string, limit?: string, offset?: string): Promise<{
        items: {
            id: string;
            occurredAt: string;
            group: "ocorrencias" | "tarifas" | "fechamentos" | "contabilidade";
            action: string;
            month: string | null;
            orgao: string | null;
            user: string | null;
            detail: string | null;
            cpf: string | null;
            nome: string | null;
            value: string | null;
        }[];
        total: number;
        limit: number;
        offset: number;
        filters: {
            month: string | null;
            orgao: string | null;
            group: string | null;
        };
        dbFilePath: string;
    }>;
    conciliarExtratosDetalhe(month?: string, key?: string, orgao?: string): Promise<{
        message?: string | undefined;
        month: string;
        key: string;
        extrato: {
            competencia: string;
            date: string;
            value: string;
            orgao: string | null;
            historico: string | null;
            status: string;
            pairId: string | null;
        }[];
        relatorio: {
            competencia: string | null;
            vencimento: string | null;
            value: string;
            orgao: string | null;
            modalidade: string | null;
            status: string;
            pairId: string | null;
        }[];
    }>;
    conciliarRecursoVsRelatorio(month?: string, orgao?: string): Promise<{
        dbFilePath: string;
        message?: string | undefined;
        month: string;
        orgao: string;
        recursoTable: string;
        lastUpdatedAt: string | null;
        closed: {
            isClosed: boolean;
            closedAt: string | null;
            closedBy: string | null;
            reopenedAt: string | null;
            reopenedBy: string | null;
            reopenedJustification: string | null;
            contabilidadeEmail: string | null;
            sentToContabilidadeAt: string | null;
            sentToContabilidadeBy: string | null;
            closedVencimentos: string[];
        };
        consolidadoPorVencimento: {
            recursoRecebidoMaiorEstornoCents: number;
            recursoRecebidoMenorDebitoCents: number;
            saldoCents: number;
            vencimento: string;
            recursoCents: number;
            relatorioCents: number;
            extratosCents: number;
        }[];
        extratosPorData: Record<string, number>;
        totals: {
            extratos: {
                cents: number;
                text: string;
            };
            recurso: {
                cents: number;
                text: string;
            };
            relatorio: {
                cents: number;
                text: string;
            };
            tarifaLinha: {
                cents: number;
                text: string;
            };
            tarifaTed: {
                cents: number;
                text: string;
            };
            diff: {
                cents: number;
                text: string;
            };
            recursoRecebidoMaiorEstorno: {
                cents: number;
                text: string;
            };
            recursoRecebidoMenorDebito: {
                cents: number;
                text: string;
            };
        };
        tarifaApplied: boolean;
        tarifaTedApplied: boolean;
        recurso: {
            ocorrencia?: {
                id: number;
                createdAt: string;
                action: string;
                justification: string;
            } | undefined;
            ocorrencias?: {
                id: number;
                createdAt: string;
                action: string;
                justification: string;
            }[] | undefined;
            cpf: string;
            nome: string;
            value: string;
            sourceRecursoTable: string;
            status: string;
            pairId: string | null;
            hideInFront: boolean;
        }[];
        relatorio: {
            cpf: string;
            nome: string;
            contrato: string | null;
            value: string;
            competencia: string | null;
            vencimento: string | null;
            vencimentoRef: string | null;
            modalidade: string | null;
            empresa: string | null;
            status: string;
            pairId: string | null;
            ocorrencia: {
                id: number;
                createdAt: string;
                action: string;
                justification: string;
                status: string | null;
                gerenteEmail: string | null;
                liquidationDate: string | null;
                devolucaoDate: string | null;
                devolucaoValue: string | null;
                vencimentoRef: string | null;
                previousValue: string | null;
                nextValue: string | null;
                estornoLiquidationDate: string | null;
                estornoDate: string | null;
                estornoValue: string | null;
                correctValue: string | null;
                debitAccountDate: string | null;
                debitAccountValue: string | null;
            } | null;
            ocorrencias: {
                id: number;
                createdAt: string;
                action: string;
                justification: string;
                status: string | null;
                gerenteEmail: string | null;
                liquidationDate: string | null;
                devolucaoDate: string | null;
                devolucaoValue: string | null;
                vencimentoRef: string | null;
                previousValue: string | null;
                nextValue: string | null;
                estornoLiquidationDate: string | null;
                estornoDate: string | null;
                estornoValue: string | null;
                correctValue: string | null;
                debitAccountDate: string | null;
                debitAccountValue: string | null;
            }[];
            repactuacoes: {
                id: number;
                createdAt: string;
                status: string;
                gerenteEmail: string | null;
                justification: string;
            }[];
        }[];
    }>;
    listarHomeStatusConciliacao(month?: string): Promise<{
        month: string;
        items: {
            orgao: string;
            vencimento: string;
            status: "aberta" | "fechada";
            contabilidadeValidated: boolean;
            recursoRecebidoCents: number;
            liquidadoCents: number;
            saldoCents: number;
        }[];
        dbFilePath: string;
    }>;
    listarPendenciasFluxo(month?: string, orgao?: string, vencimento?: string, includeConcluidas?: string): Promise<{
        items: {
            id: number;
            createdAt: string;
            createdBy: string | null;
            cpf: string;
            nome: string;
            value: string;
            action: string;
            justification: string;
            gerenteEmail: string | null;
            stage: "financeiro" | "credito" | "negocios";
            status: "aberta" | "concluida";
            slaStartedAt: string | null;
            slaDueAt: string | null;
            slaSeconds: number | null;
            slaStoppedAt: string | null;
            updatedAt: string | null;
            updatedBy: string | null;
            vencimento: string | null;
            history: Array<{
                createdAt: string;
                createdBy: string | null;
                action: string;
                fromStage: string | null;
                toStage: string | null;
                note: string;
                source: "ocorrencia" | "fluxo";
            }>;
        }[];
        dbFilePath: string;
    }>;
    atualizarPendenciaFluxo(body: {
        id?: number;
        toStage?: 'financeiro' | 'credito' | 'negocios';
        action?: 'mover' | 'concluir' | 'reabrir';
        note?: string | null;
        gerenteEmail?: string | null;
        requestedBy?: string | null;
    }): Promise<{
        ok: boolean;
        dbFilePath: string;
        notification: {
            email: {
                attempted: boolean;
                sent: boolean;
                error: string;
            };
            teams: null;
        } | {
            email: {
                attempted: boolean;
                sent: boolean;
                error: string | null;
            };
            teams: {
                attempted: boolean;
                sent: boolean;
                error: string | null;
            };
        } | null;
    }>;
    exportConciliacaoRecursoVsRelatorioXlsxNow(res: Response, month?: string, orgao?: string, onlyDiff?: string, vencimento?: string): Promise<void>;
    exportRelatoriosValoresListaXlsxNow(res: Response, month?: string, orgao?: string, onlyDiff?: string, onlyConciliados?: string, vencimento?: string): Promise<void>;
    exportConciliacaoOcorrenciasXlsxNow(res: Response, month?: string, orgao?: string, vencimento?: string, action?: string): Promise<void>;
    listarConciliacaoOcorrenciasNow(month?: string, orgao?: string, vencimento?: string, action?: string): Promise<{
        month: string;
        items: {
            origem: string;
            competencia: string;
            orgao: string;
            vencimento: string;
            dataHora: string;
            cpf: string;
            nome: string;
            valor: string;
            dataQuitacao: string;
            acaoKey: string;
            acao: string;
            justificativa: string;
            status: string;
            gerenteEmail: string;
        }[];
        dbFilePath: string;
    }>;
    exportConciliacaoRecursoVsRelatorioPdfNow(res: Response, month?: string, orgao?: string, vencimento?: string): Promise<void>;
    getConciliacaoPorDataNow(month?: string, orgao?: string, dateType?: string, liquidationDate?: string): Promise<{
        monthKey: string;
        orgaoRaw: string;
        mode: "vencimento" | "todos" | "data_liquidacao" | "liquidacao" | "devolucao";
        modeLabel: string;
        availableLiquidationDates: string[];
        selectedLiquidationDate: string;
        tarifasByOrgao: {
            orgao: string;
            linhaCents: number;
            tedCents: number;
            totalCents: number;
            oldestLiquidationDate: string | null;
        }[];
        rows: {
            saldoCents: number;
            validation: {
                id: string;
                status: "pending" | "approved" | "rejected";
                requestedAt: string | null;
                requestedBy: string | null;
                accountingEmail: string | null;
                financeEmail: string | null;
                approvedAt: string | null;
                approvedBy: string | null;
                rejectedAt: string | null;
                rejectedBy: string | null;
                rejectionJustification: string | null;
                respondedAt: string | null;
                link: string | null;
                notification: Record<string, unknown> | null;
                decisionNotification: Record<string, unknown> | null;
                rowSnapshot: Record<string, unknown> | null;
            } | null;
            date: string;
            closureRefs: string[];
            liquidationDate: string;
            orgaoReceivedDate: string;
            orgao: string;
            orgaoReceivedCents: number;
            event: string;
            debitCents: number;
            creditCents: number;
        }[];
        totals: {
            saldoFinalCents: number;
            tarifaCents: number;
            debitCents: number;
            creditCents: number;
        };
    }>;
    requestConciliacaoPorDataValidationNow(body: {
        month?: string;
        orgao?: string;
        liquidationDate?: string;
        requestedBy?: string | null;
        rowSnapshot?: Record<string, unknown> | null;
    }): Promise<{
        created: boolean;
        resent: boolean;
        process: {
            id: string;
            status: "pending" | "approved" | "rejected";
            requestedAt: string | null;
            requestedBy: string | null;
            accountingEmail: string | null;
            financeEmail: string | null;
            approvedAt: string | null;
            approvedBy: string | null;
            rejectedAt: string | null;
            rejectedBy: string | null;
            rejectionJustification: string | null;
            respondedAt: string | null;
            link: string | null;
            notification: Record<string, unknown> | null;
            decisionNotification: Record<string, unknown> | null;
            rowSnapshot: Record<string, unknown> | null;
        } | null;
    }>;
    decideConciliacaoPorDataValidationNow(body: {
        token?: string;
        decision?: 'approved' | 'rejected';
        justification?: string | null;
    }): Promise<{
        alreadyProcessed: boolean;
        process: {
            id: string;
            status: "pending" | "approved" | "rejected";
            requestedAt: string | null;
            requestedBy: string | null;
            accountingEmail: string | null;
            financeEmail: string | null;
            approvedAt: string | null;
            approvedBy: string | null;
            rejectedAt: string | null;
            rejectedBy: string | null;
            rejectionJustification: string | null;
            respondedAt: string | null;
            link: string | null;
            notification: Record<string, unknown> | null;
            decisionNotification: Record<string, unknown> | null;
            rowSnapshot: Record<string, unknown> | null;
        } | null;
    }>;
    getConciliacaoPorDataValidationPortalNow(res: Response, token?: string): Promise<void>;
    exportConciliacaoPorDataXlsxNow(res: Response, month?: string, orgao?: string, dateType?: string, liquidationDate?: string): Promise<void>;
    exportConciliacaoPorDataPdfNow(res: Response, month?: string, orgao?: string, dateType?: string, liquidationDate?: string): Promise<void>;
    clonarParaSisbr(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        nome?: string;
        value?: string;
        recursoTable?: string;
        sourceRecursoTable?: string;
        action?: string;
        justification?: string;
        dueDate?: string | null;
        devolucaoDate?: string | null;
    }): Promise<{
        insertedRows: number;
        skippedRows: number;
        dbFilePath: string;
    }>;
    ocorrenciaContext(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        value?: string;
    }): Promise<{
        month: string;
        cpf: string;
        value: string;
        targetEmpresa: string;
        sourceEmpresas: never[];
        totalMatches: number;
        willUpdateCount: number;
        dbFilePath: string;
        wantedCopetenciaFull?: undefined;
    } | {
        month: string;
        cpf: string;
        value: string;
        targetEmpresa: string;
        sourceEmpresas: string[];
        totalMatches: number;
        willUpdateCount: number;
        wantedCopetenciaFull: string;
        dbFilePath: string;
    }>;
    incluirServidorAcordoJudicial(body: {
        target?: 'recurso' | 'relatorio';
        orgao?: string;
        nome?: string;
        cpf?: string;
        value?: string;
        competencia?: string;
    }): Promise<{
        orgao: string;
        targetTable: string;
        recursoTable: string;
        nome: string;
        cpf: string;
        value: string;
        competencia: string;
        empresa: string;
        dbFilePath: string;
    } | {
        orgao: string;
        recursoTable: string;
        nome: string;
        cpf: string;
        value: string;
        competencia: string;
        dbFilePath: string;
        targetTable?: undefined;
        empresa?: undefined;
    }>;
    upsertTarifa(body: {
        month?: string;
        orgao?: string;
        type?: string;
        value?: string;
    }): Promise<{
        month: string;
        orgao: string;
        type: "linha" | "ted";
        tarifa: {
            cents: number;
            text: string;
        };
        dbFilePath: string;
    }>;
    alterarOrgaoRelatorio(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        nome?: string;
        value?: string;
        fromEmpresa?: string;
        toOrgao?: string;
        action?: string;
        justification?: string;
    }): Promise<{
        month: string;
        cpf: string;
        value: string;
        fromEmpresa: string;
        toEmpresa: string;
        updatedRows: number;
        dbFilePath: string;
    }>;
    repactuacaoRelatorio(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        nome?: string;
        value?: string;
        status?: string;
        gerenteEmail?: string;
        action?: string;
        justification?: string;
    }): Promise<{
        month: string;
        orgao: string;
        cpf: string;
        value: string;
        action: string;
        status: "pendente_gerente" | "concluido";
        gerenteEmail: string | null;
        occurrenceId: number | null;
        teams: {
            attempted: boolean;
            sent: boolean;
            error: string | null;
        } | null;
        dbFilePath: string;
    }>;
    liquidacaoCcsExcluirRelatorio(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        nome?: string;
        value?: string;
        fromEmpresa?: string | null;
        action?: string;
        justification?: string;
    }): Promise<{
        month: string;
        orgao: string;
        cpf: string;
        value: string;
        deletedRows: number;
        dbFilePath: string;
    }>;
    liquidacaoProcessoJudicialExcluirRelatorio(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        nome?: string;
        value?: string;
        fromEmpresa?: string | null;
        action?: string;
        justification?: string;
    }): Promise<{
        month: string;
        orgao: string;
        cpf: string;
        value: string;
        deletedRows: number;
        dbFilePath: string;
    }>;
    naoPossuiRecursoRelatorio(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        nome?: string;
        value?: string;
        fromEmpresa?: string | null;
        gerenteEmail?: string;
        message?: string;
        action?: string;
    }): Promise<{
        month: string;
        orgao: string;
        cpf: string;
        value: string;
        gerenteEmail: string;
        matchedRows: number;
        deletedRows: number;
        occurrenceId: number | null;
        teams: {
            attempted: boolean;
            sent: boolean;
            error: string | null;
        };
        dbFilePath: string;
    }>;
    liquidacaoForaVencimento(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        nome?: string;
        value?: string;
        fromEmpresa?: string | null;
        liquidationDate?: string;
        action?: string;
        justification?: string;
    }): Promise<{
        month: string;
        orgao: string;
        cpf: string;
        value: string;
        liquidationDate: string;
        matchedRows: number;
        dbFilePath: string;
    }>;
    liquidacaoAntecipadaViaCaixa(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        nome?: string;
        value?: string;
        fromEmpresa?: string | null;
        liquidationDate?: string;
        liquidatedValue?: string;
        action?: string;
        justification?: string;
    }): Promise<{
        month: string;
        orgao: string;
        cpf: string;
        liquidationDate: string;
        previousValue: string;
        nextValue: string;
        antecipacaoValue: string;
        matchedRows: number;
        dbFilePath: string;
    }>;
    antecipadoDevolvido(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        nome?: string;
        value?: string;
        devolucaoDate?: string;
        action?: string;
        justification?: string;
    }): Promise<{
        month: string;
        orgao: string;
        cpf: string;
        value: string;
        devolucaoDate: string;
        dbFilePath: string;
    }>;
    recursoJudicialValorAMenor(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        nome?: string;
        value?: string;
        fromEmpresa?: string | null;
        newValue?: string;
        action?: string;
        justification?: string;
    }): Promise<{
        month: string;
        orgao: string;
        cpf: string;
        previousValue: string;
        nextValue: string;
        matchedRows: number;
        dbFilePath: string;
    }>;
    recursoRecebidoAMenor(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        nome?: string;
        value?: string;
        fromEmpresa?: string | null;
        liquidationDate?: string;
        debitAccountDate?: string;
        debitAccountValue?: string;
        noDebitInAccount?: boolean;
        differenceValue?: string;
        action?: string;
        justification?: string;
    }): Promise<{
        month: string;
        orgao: string;
        cpf: string;
        value: string;
        liquidationDate: string;
        debitAccountDate: string;
        debitAccountValue: string;
        matchedRows: number;
        dbFilePath: string;
    }>;
    recursoRecebidoAMaior(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        nome?: string;
        value?: string;
        fromEmpresa?: string | null;
        liquidationDate?: string;
        devolucaoDate?: string;
        devolucaoValue?: string;
        action?: string;
        justification?: string;
    }): Promise<{
        month: string;
        orgao: string;
        cpf: string;
        value: string;
        liquidationDate: string;
        devolucaoDate: string;
        devolucaoValue: string;
        matchedRows: number;
        dbFilePath: string;
    }>;
    devolucaoParcialAverbacao(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        nome?: string;
        value?: string;
        fromEmpresa?: string | null;
        liquidationDate?: string;
        devolucaoDate?: string;
        devolucaoValue?: string;
        action?: string;
        justification?: string;
    }): Promise<{
        month: string;
        orgao: string;
        cpf: string;
        value: string;
        liquidationDate: string;
        devolucaoDate: string;
        devolucaoValue: string;
        matchedRows: number;
        dbFilePath: string;
    }>;
    liquidacaoRecursoJudicial(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        nome?: string;
        value?: string;
        fromEmpresa?: string | null;
        liquidationDate?: string;
        liquidatedValue?: string;
        action?: string;
        justification?: string;
    }): Promise<{
        month: string;
        orgao: string;
        cpf: string;
        value: string;
        liquidationDate: string;
        liquidatedValue: string;
        matchedRows: number;
        dbFilePath: string;
    }>;
    estornoValores(body: {
        month?: string;
        orgao?: string;
        cpf?: string;
        nome?: string;
        value?: string;
        fromEmpresa?: string | null;
        estornoLiquidationDate?: string;
        estornoDate?: string;
        estornoValue?: string;
        liquidationDate?: string;
        correctValue?: string;
        action?: string;
        justification?: string;
    }): Promise<{
        month: string;
        orgao: string;
        cpf: string;
        value: string;
        estornoLiquidationDate: string;
        estornoDate: string;
        estornoValue: string;
        liquidationDate: string;
        correctValue: string;
        matchedRows: number;
        dbFilePath: string;
    }>;
    fecharConciliacao(body: {
        month?: string;
        orgao?: string;
        vencimento?: string;
        closedBy?: string;
        contabilidadeEmail?: string;
        evidencePngBase64?: string;
    }): Promise<{
        month: string;
        orgao: string;
        closed: {
            isClosed: boolean;
            closedAt: string | null;
            closedBy: string | null;
            reopenedAt: string | null;
            reopenedBy: string | null;
            reopenedJustification: string | null;
            contabilidadeEmail: string | null;
            sentToContabilidadeAt: string | null;
            sentToContabilidadeBy: string | null;
            closedVencimentos: string[];
        };
        dbFilePath: string;
    }>;
    reabrirConciliacao(body: {
        month?: string;
        orgao?: string;
        vencimento?: string;
        password?: string;
        reopenedBy?: string;
        justification?: string;
    }): Promise<{
        month: string;
        orgao: string;
        closed: {
            isClosed: boolean;
            closedAt: string | null;
            closedBy: string | null;
            reopenedAt: string | null;
            reopenedBy: string | null;
            reopenedJustification: string | null;
            contabilidadeEmail: string | null;
            sentToContabilidadeAt: string | null;
            sentToContabilidadeBy: string | null;
            closedVencimentos: string[];
        };
        dbFilePath: string;
    }>;
    reenviarContabilidade(body: {
        month?: string;
        orgao?: string;
        vencimento?: string;
        requestedBy?: string;
        contabilidadeEmail?: string;
        evidencePngBase64?: string;
    }): Promise<{
        month: string;
        orgao: string;
        closed: {
            isClosed: boolean;
            closedAt: string | null;
            closedBy: string | null;
            reopenedAt: string | null;
            reopenedBy: string | null;
            reopenedJustification: string | null;
            contabilidadeEmail: string | null;
            sentToContabilidadeAt: string | null;
            sentToContabilidadeBy: string | null;
            closedVencimentos: string[];
        };
        dbFilePath: string;
    }>;
    desfazerOcorrencia(body: {
        id?: number;
        undoJustification?: string;
    }): Promise<{
        id: number;
        undoneAt: string;
        restoredRows: number;
        dbFilePath: string;
    }>;
    getAccessEmails(): Promise<{
        entries: {
            email: string;
            role: "admin" | "usuario";
            menus: ("home" | "dashboard" | "fluxo-pendencias" | "conciliacao-extratos" | "conciliacao-relatorio" | "relatorios-valores" | "relatorios-ocorrencias" | "relatorios-auditoria" | "configuracoes-automacao" | "configuracoes-acessos")[];
            flowStages: ("financeiro" | "credito" | "negocios")[];
        }[];
        emails: string[];
        fixedEmail: string;
        dbFilePath: string;
    }>;
    debugEvent(body: any): Promise<{
        ok: boolean;
    }>;
    setAccessEmails(body: {
        entries?: Array<{
            email: string;
            role?: 'admin' | 'usuario';
            menus?: Array<'home' | 'dashboard' | 'fluxo-pendencias' | 'conciliacao-extratos' | 'conciliacao-relatorio' | 'relatorios-valores' | 'relatorios-ocorrencias' | 'relatorios-auditoria' | 'configuracoes-automacao' | 'configuracoes-acessos'>;
            flowStages?: Array<'financeiro' | 'credito' | 'negocios'>;
        }>;
        emails?: string[];
    }): Promise<{
        entries: {
            email: string;
            role: "admin" | "usuario";
            menus: ("home" | "dashboard" | "fluxo-pendencias" | "conciliacao-extratos" | "conciliacao-relatorio" | "relatorios-valores" | "relatorios-ocorrencias" | "relatorios-auditoria" | "configuracoes-automacao" | "configuracoes-acessos")[];
            flowStages: ("financeiro" | "credito" | "negocios")[];
        }[];
        emails: string[];
        fixedEmail: string;
        dbFilePath: string;
    }>;
    temporarioPage(): Promise<string>;
    conciliacaoTemporarioPage(competencia?: string, orgao?: string, status?: string): Promise<string>;
    conciliacaoTemporarioCsv(competencia?: string, orgao?: string, status?: string): Promise<string>;
    conciliacaoTemporarioXlsx(competencia: string | undefined, orgao: string | undefined, status: string | undefined, res: Response): Promise<void>;
    extratosTemporarioPage(): Promise<string>;
    extratosTemporarioUpload(file?: any, body?: {
        tableName?: string;
    }): Promise<string>;
    relatoriosTemporarioPage(): Promise<string>;
    relatoriosTemporarioUpload(file?: any, body?: {
        tableName?: string;
    }): Promise<string>;
}
