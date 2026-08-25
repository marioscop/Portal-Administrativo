import ExcelJS from 'exceljs';
type ConciliacaoTarifaType = 'linha' | 'ted';
type ConciliacaoFechamentoInfo = {
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
export declare function upsertConciliacaoTarifa(opts: {
    month: string;
    orgao: string;
    type?: string;
    value: string;
}): Promise<{
    month: string;
    orgao: string;
    type: ConciliacaoTarifaType;
    tarifa: {
        cents: number;
        text: string;
    };
    dbFilePath: string;
}>;
export declare function conciliarExtratoRelatorio(opts: {
    month: string;
    orgao?: string;
}): Promise<{
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
export declare function listarMesesConcilicacaoDisponiveis(): Promise<{
    months: string[];
    dbFilePath: string;
}>;
export declare function listarAuditoriaSistemica(opts: {
    month?: string | null;
    orgao?: string | null;
    group?: string | null;
    limit?: number | null;
    offset?: number | null;
}): Promise<{
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
export declare function conciliarExtratoRelatorioDetalhe(opts: {
    month: string;
    key: string;
    orgao?: string;
}): Promise<{
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
export declare function conciliarRecursoOrgaoRelatorio(opts: {
    month: string;
    orgao: string;
    recursoTable?: string;
}): Promise<{
    dbFilePath: string;
    message?: string | undefined;
    month: string;
    orgao: string;
    recursoTable: string;
    lastUpdatedAt: string | null;
    closed: ConciliacaoFechamentoInfo;
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
export declare function fecharConciliacaoRecursoVsRelatorio(opts: {
    month: string;
    orgao: string;
    vencimento?: string;
    closedBy?: string;
    contabilidadeEmail?: string;
    evidencePngBase64?: string;
}): Promise<{
    month: string;
    orgao: string;
    closed: ConciliacaoFechamentoInfo;
    dbFilePath: string;
}>;
export declare function reabrirConciliacaoRecursoVsRelatorio(opts: {
    month: string;
    orgao: string;
    vencimento?: string;
    password: string;
    reopenedBy?: string;
    justification: string;
}): Promise<{
    month: string;
    orgao: string;
    closed: ConciliacaoFechamentoInfo;
    dbFilePath: string;
}>;
export declare function listarPendenciasFluxoConcilicacao(opts: {
    month: string;
    orgao: string;
    vencimento?: string | null;
    includeConcluidas?: boolean;
}): Promise<{
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
export declare function atualizarPendenciaFluxoConcilicacao(opts: {
    id: number;
    toStage?: 'financeiro' | 'credito' | 'negocios';
    action: 'mover' | 'concluir' | 'reabrir';
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
export declare function reenviarFechamentoConciliacaoParaContabilidade(opts: {
    month: string;
    orgao: string;
    vencimento?: string;
    requestedBy?: string;
    contabilidadeEmail?: string;
    evidencePngBase64?: string;
}): Promise<{
    month: string;
    orgao: string;
    closed: ConciliacaoFechamentoInfo;
    dbFilePath: string;
}>;
export declare function clonarParaRelatorioSisbrFromExtratos(opts: {
    month: string;
    orgao: string;
    cpf: string;
    nome: string;
    value: string;
    recursoTable?: string;
    sourceRecursoTable?: string;
    action?: string;
    justification: string;
    dueDate?: string | null;
    devolucaoDate?: string | null;
}): Promise<{
    insertedRows: number;
    skippedRows: number;
    dbFilePath: string;
}>;
export declare function incluirServidorAcordoJudicialTjgo(opts: {
    orgao: string;
    nome: string;
    cpf: string;
    value: string;
    competencia: string;
    target?: 'recurso' | 'relatorio';
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
export declare function getOcorrenciaCloneParaSisbrContext(opts: {
    month: string;
    orgao: string;
    cpf: string;
    value: string;
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
export declare function alterarOrgaoRelatorioSisbr(opts: {
    month: string;
    orgao?: string;
    cpf: string;
    nome: string;
    value: string;
    fromEmpresa: string;
    toOrgao: string;
    action?: string;
    justification: string;
}): Promise<{
    month: string;
    cpf: string;
    value: string;
    fromEmpresa: string;
    toEmpresa: string;
    updatedRows: number;
    dbFilePath: string;
}>;
export declare function recursoJudicialValorAMenorRelatorioSisbr(opts: {
    month: string;
    orgao: string;
    cpf: string;
    nome: string;
    value: string;
    fromEmpresa?: string | null;
    newValue: string;
    action?: string;
    justification: string;
}): Promise<{
    month: string;
    orgao: string;
    cpf: string;
    previousValue: string;
    nextValue: string;
    matchedRows: number;
    dbFilePath: string;
}>;
export declare function liquidacaoAntecipadaViaCaixaRelatorioSisbr(opts: {
    month: string;
    orgao: string;
    cpf: string;
    nome: string;
    value: string;
    fromEmpresa?: string | null;
    liquidationDate: string;
    liquidatedValue: string;
    action?: string;
    justification: string;
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
export declare function recursoRecebidoAMenorRelatorioSisbr(opts: {
    month: string;
    orgao: string;
    cpf: string;
    nome: string;
    value: string;
    fromEmpresa?: string | null;
    liquidationDate: string;
    debitAccountDate?: string;
    debitAccountValue?: string;
    noDebitInAccount?: boolean;
    differenceValue?: string;
    action?: string;
    justification: string;
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
export declare function recursoRecebidoAMaiorRelatorioSisbr(opts: {
    month: string;
    orgao: string;
    cpf: string;
    nome: string;
    value: string;
    fromEmpresa?: string | null;
    liquidationDate: string;
    devolucaoDate: string;
    devolucaoValue: string;
    action?: string;
    justification: string;
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
export declare function devolucaoParcialAverbacaoRelatorioSisbr(opts: {
    month: string;
    orgao: string;
    cpf: string;
    nome: string;
    value: string;
    fromEmpresa?: string | null;
    liquidationDate: string;
    devolucaoDate: string;
    devolucaoValue: string;
    action?: string;
    justification: string;
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
export declare function liquidacaoRecursoJudicialRelatorioSisbr(opts: {
    month: string;
    orgao: string;
    cpf: string;
    nome: string;
    value: string;
    fromEmpresa?: string | null;
    liquidationDate: string;
    liquidatedValue: string;
    action?: string;
    justification: string;
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
export declare function liquidacaoForaDoVencimentoRelatorioSisbr(opts: {
    month: string;
    orgao: string;
    cpf: string;
    nome: string;
    value: string;
    fromEmpresa: string | null;
    liquidationDate: string;
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
export declare function estornoValoresRelatorioSisbr(opts: {
    month: string;
    orgao: string;
    cpf: string;
    nome: string;
    value: string;
    fromEmpresa?: string | null;
    estornoLiquidationDate: string;
    estornoDate: string;
    estornoValue: string;
    liquidationDate: string;
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
export declare function liquidacaoCcsExcluirRelatorioSisbr(opts: {
    month: string;
    orgao: string;
    cpf: string;
    nome: string;
    value: string;
    fromEmpresa: string | null;
    action?: string;
    justification: string;
}): Promise<{
    month: string;
    orgao: string;
    cpf: string;
    value: string;
    deletedRows: number;
    dbFilePath: string;
}>;
export declare function liquidacaoProcessoJudicialExcluirRelatorioSisbr(opts: {
    month: string;
    orgao: string;
    cpf: string;
    nome: string;
    value: string;
    fromEmpresa: string | null;
    action?: string;
    justification: string;
}): Promise<{
    month: string;
    orgao: string;
    cpf: string;
    value: string;
    deletedRows: number;
    dbFilePath: string;
}>;
export declare function naoPossuiRecursoRelatorioSisbr(opts: {
    month: string;
    orgao: string;
    cpf: string;
    nome: string;
    value: string;
    fromEmpresa?: string | null;
    gerenteEmail: string;
    message: string;
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
export declare function repactuacaoRelatorioSisbr(opts: {
    month: string;
    orgao: string;
    cpf: string;
    nome: string;
    value: string;
    status?: string;
    gerenteEmail?: string;
    action?: string;
    justification: string;
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
export declare function antecipadoDevolvidoRelatorioSisbr(opts: {
    month: string;
    orgao: string;
    cpf: string;
    nome: string;
    value: string;
    devolucaoDate: string;
    action?: string;
    justification: string;
}): Promise<{
    month: string;
    orgao: string;
    cpf: string;
    value: string;
    devolucaoDate: string;
    dbFilePath: string;
}>;
export declare function desfazerOcorrenciaRelatorioSisbr(opts: {
    id: number;
    undoJustification?: string;
}): Promise<{
    id: number;
    undoneAt: string;
    restoredRows: number;
    dbFilePath: string;
}>;
export declare function saveModalidades(opts?: {
    modalidades?: string[];
}): Promise<{
    modalidades: string[];
    dbFilePath: string;
}>;
export declare function getModalidades(): Promise<{
    modalidades: string[];
    dbFilePath: string;
}>;
export declare function getConsignadoAutomationConfig(): Promise<{
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
export declare function saveConsignadoAutomationConfig(opts: {
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
export declare function startTeamsDelegatedDeviceCodeLogin(): Promise<{
    userCode: string;
    verificationUri: string;
    message: string;
    expiresAt: string;
    interval: number | null;
    scope: string;
    dbFilePath: string;
}>;
export declare function finishTeamsDelegatedDeviceCodeLogin(): Promise<{
    status: string;
    dbFilePath: string;
}>;
export declare function disconnectTeamsDelegatedLogin(): Promise<{
    status: string;
    dbFilePath: string;
}>;
export declare function searchGraphUsers(opts: {
    q: string;
    limit?: number;
}): Promise<{
    items: Array<{
        displayName: string;
        email: string;
    }>;
    warning: string | null;
}>;
export declare function getOrgaoColumnsConfig(): Promise<{
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
export declare function saveOrgaoColumnsConfig(opts: {
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
export declare function importExtratosTemporario(opts: {
    filePath: string;
    tableName?: string;
}): Promise<{
    tableName: string;
    filePath: string;
    batchId: string | null;
    columns: number;
    rows: number;
    insertedRows: number;
    skippedRows: number;
    skippedByHistoricoFilter: number;
    dbFilePath: string;
}>;
export declare function importExtratosTemporarioFromBuffer(opts: {
    fileName: string;
    file: Buffer;
    tableName?: string;
}): Promise<{
    tableName: string;
    fileName: string;
    batchId: string | null;
    columns: number;
    rows: number;
    insertedRows: number;
    skippedRows: number;
    skippedByHistoricoFilter: number;
    dbFilePath: string;
}>;
export declare function conciliarTemporario(opts?: {
    competencia?: string | null;
    orgao?: string | null;
    status?: string | null;
    extratosTable?: string;
    relatoriosTable?: string;
}): Promise<{
    competencia: string;
    orgao: string;
    status: string;
    extratosTable: string;
    relatoriosTable: string;
    total: number;
    conciliados: number;
    naoConciliados: number;
    rows: {
        Nome: string;
        CPF: string;
        Orgao: string;
        ValorRelatorio: string;
        ValorExtrato: string;
        StatusKey: string;
        Status: string;
    }[];
    dbFilePath: string;
}>;
export declare function listarFiltrosTemporario(opts?: {
    extratosTable?: string;
    relatoriosTable?: string;
}): Promise<{
    competencias: string[];
    orgaos: string[];
    dbFilePath: string;
    extratosTable: string;
    relatoriosTable: string;
}>;
export declare function exportConcilicacaoTemporarioXlsx(opts?: {
    competencia?: string | null;
    orgao?: string | null;
    status?: string | null;
    extratosTable?: string;
    relatoriosTable?: string;
}): Promise<{
    fileName: string;
    buffer: Buffer<ExcelJS.Buffer>;
    meta: {
        competencia: string;
        orgao: string;
        total: number;
        conciliados: number;
        naoConciliados: number;
    };
}>;
export declare function exportConcilicacaoRecursoVsRelatorioXlsx(opts: {
    month: string;
    orgao: string;
    onlyDiff?: boolean;
    vencimento?: string | null;
}): Promise<{
    fileName: string;
    buffer: Buffer<any>;
}>;
type ConciliacaoPorDataMode = 'todos' | 'vencimento' | 'data_liquidacao' | 'liquidacao' | 'devolucao';
export declare function exportRelatoriosValoresListaXlsx(opts: {
    month: string;
    orgao?: string | null;
    onlyDiff?: boolean;
    onlyConciliados?: boolean;
    vencimento?: string | null;
}): Promise<{
    fileName: string;
    buffer: Buffer<any>;
}>;
export declare function exportConcilicacaoOcorrenciasXlsx(opts: {
    month: string;
    orgao?: string | null;
    vencimento?: string | null;
    action?: string | null;
}): Promise<{
    fileName: string;
    buffer: Buffer<any>;
    total: number;
}>;
export declare function listarConcilicacaoOcorrencias(opts: {
    month: string;
    orgao?: string | null;
    vencimento?: string | null;
    action?: string | null;
}): Promise<{
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
export declare function exportConcilicacaoRecursoVsRelatorioPdf(opts: {
    month: string;
    orgao: string;
    vencimento?: string | null;
}): Promise<{
    fileName: string;
    buffer: Buffer<ArrayBufferLike>;
}>;
export declare function exportConcilicacaoPorDataXlsx(opts: {
    month: string;
    orgao?: string | null;
    dateType?: string | null;
    liquidationDate?: string | null;
}): Promise<{
    fileName: string;
    buffer: Buffer<any>;
}>;
export declare function getConciliacaoPorDataPreview(opts: {
    month: string;
    orgao?: string | null;
    dateType?: string | null;
    liquidationDate?: string | null;
}): Promise<{
    monthKey: string;
    orgaoRaw: string;
    mode: ConciliacaoPorDataMode;
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
            status: ConciliacaoPorDataValidationStatus;
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
export declare function exportConcilicacaoPorDataPdf(opts: {
    month: string;
    orgao?: string | null;
    dateType?: string | null;
    liquidationDate?: string | null;
}): Promise<{
    fileName: string;
    buffer: Buffer<ArrayBufferLike>;
}>;
export declare function importRelatoriosTemporario(opts: {
    filePath: string;
    tableName?: string;
}): Promise<{
    tableName: string;
    fileName: string;
    batchId: string | null;
    columns: number;
    rows: number;
    insertedRows: number;
    skippedRows: number;
    dbFilePath: string;
}>;
export declare function importRelatoriosTemporarioFromBuffer(opts: {
    fileName: string;
    file: Buffer;
    tableName?: string;
}): Promise<{
    tableName: string;
    fileName: string;
    batchId: string | null;
    columns: number;
    rows: number;
    insertedRows: number;
    skippedRows: number;
    dbFilePath: string;
}>;
export declare function getOrgaoDePara(): Promise<{
    items: {
        extratos: string;
        relatorio: string;
        createdAt: string;
    }[];
    dbFilePath: string;
}>;
export declare function listHomeConciliacaoStatuses(opts: {
    month: string;
}): Promise<{
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
export declare function upsertOrgaoDePara(opts: {
    extratos: string;
    relatorio: string;
}): Promise<{
    items: {
        extratos: string;
        relatorio: string;
        createdAt: string;
    }[];
    dbFilePath: string;
}>;
export declare function deleteOrgaoDePara(opts: {
    extratos: string;
}): Promise<{
    items: {
        extratos: string;
        relatorio: string;
        createdAt: string;
    }[];
    dbFilePath: string;
}>;
export declare function getExtratosConsolidacaoRecurso(): Promise<{
    items: Array<{
        orgao: string;
        historico1: string;
        createdAt: string;
    }>;
    dbFilePath: string;
}>;
export declare function upsertExtratosConsolidacaoRecurso(opts: {
    orgao: string;
    historico1: string;
}): Promise<{
    items: Array<{
        orgao: string;
        historico1: string;
        createdAt: string;
    }>;
    dbFilePath: string;
}>;
export declare function deleteExtratosConsolidacaoRecurso(opts: {
    orgao: string;
    historico1: string;
}): Promise<{
    items: Array<{
        orgao: string;
        historico1: string;
        createdAt: string;
    }>;
    dbFilePath: string;
}>;
export declare function getRelatorioConsolidacaoRecurso(): Promise<{
    items: Array<{
        recursoTable: string;
        targetRecursoTable: string;
        createdAt: string;
    }>;
    dbFilePath: string;
}>;
export declare function upsertRelatorioConsolidacaoRecurso(opts: {
    recursoTable: string;
    targetRecursoTable: string;
}): Promise<{
    items: Array<{
        recursoTable: string;
        targetRecursoTable: string;
        createdAt: string;
    }>;
    dbFilePath: string;
}>;
export declare function deleteRelatorioConsolidacaoRecurso(opts: {
    recursoTable: string;
    targetRecursoTable: string;
}): Promise<{
    items: Array<{
        recursoTable: string;
        targetRecursoTable: string;
        createdAt: string;
    }>;
    dbFilePath: string;
}>;
export declare function getRecursoTableNames(): Promise<{
    values: string[];
    dbFilePath: string;
}>;
export declare function getExtratosHistorico1Values(): Promise<{
    values: Array<{
        value: string;
        count: number;
    }>;
    dbFilePath: string;
}>;
type ConsignadoAccessRole = 'admin' | 'usuario';
type ConsignadoMenuPermission = 'home' | 'dashboard' | 'fluxo-pendencias' | 'conciliacao-extratos' | 'conciliacao-relatorio' | 'relatorios-valores' | 'relatorios-ocorrencias' | 'relatorios-auditoria' | 'configuracoes-automacao' | 'configuracoes-acessos';
type ConsignadoFlowStagePermission = 'financeiro' | 'credito' | 'negocios';
export declare function getConsignadoAccessEmails(): Promise<{
    entries: {
        email: string;
        role: ConsignadoAccessRole;
        menus: ConsignadoMenuPermission[];
        flowStages: ConsignadoFlowStagePermission[];
    }[];
    emails: string[];
    fixedEmail: string;
    dbFilePath: string;
}>;
export declare function setConsignadoAccessEmails(opts: {
    entries?: Array<{
        email: string;
        role?: ConsignadoAccessRole;
        menus?: ConsignadoMenuPermission[];
        flowStages?: ConsignadoFlowStagePermission[];
    }>;
    emails?: string[];
}): Promise<{
    entries: {
        email: string;
        role: ConsignadoAccessRole;
        menus: ConsignadoMenuPermission[];
        flowStages: ConsignadoFlowStagePermission[];
    }[];
    emails: string[];
    fixedEmail: string;
    dbFilePath: string;
}>;
type ConciliacaoPorDataValidationStatus = 'pending' | 'approved' | 'rejected';
type ConciliacaoPorDataValidationDecision = 'approved' | 'rejected';
export declare function requestConciliacaoPorDataValidation(opts: {
    month: string;
    orgao: string;
    liquidationDate: string;
    requestedBy?: string | null;
    rowSnapshot?: Record<string, unknown> | null;
}): Promise<{
    created: boolean;
    resent: boolean;
    process: {
        id: string;
        status: ConciliacaoPorDataValidationStatus;
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
export declare function decideConciliacaoPorDataValidation(opts: {
    token: string;
    decision: ConciliacaoPorDataValidationDecision;
    justification?: string | null;
}): Promise<{
    alreadyProcessed: boolean;
    process: {
        id: string;
        status: ConciliacaoPorDataValidationStatus;
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
export declare function getConciliacaoPorDataValidationPortalHtml(token: string): Promise<string>;
export declare function downloadFileBinaryByDriveRef(opts: {
    driveId: string;
    itemId: string;
    siteId?: string;
}): Promise<Buffer>;
export declare function importByLearningProfileFromFolderUrl(opts: {
    folderUrl: string;
    forceKind?: string;
    forceMode?: 'append' | 'replace';
}, ctxOpts?: {
    onProgressHook?: (partial: {
        importedFiles: unknown[];
        totalFilesScanned?: number;
        totalFilesMatched?: number;
        totalRowsInserted?: number;
        totalRowsSkipped?: number;
        snapshotPath?: string;
    }) => void;
    cancellationRequested?: () => boolean;
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
    mode: 'append' | 'replace';
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
export declare function importByLearningProfileFromShareUrl(opts: {
    fileUrl: string;
}): Promise<ReturnType<typeof importByLearningProfileFromFolderUrl>>;
export declare function runImportConsignado(opts: {
    folderUrl?: string;
    notificationTo?: string[];
    modalidades?: string[];
    mode?: 'append' | 'replace';
    target?: string;
}, ctxOpts?: {
    onProgressHook?: (partial: {
        importedFiles: unknown[];
        totalFilesScanned?: number;
        totalFilesMatched?: number;
        totalRowsInserted?: number;
        totalRowsSkipped?: number;
        snapshotPath?: string;
    }) => void;
    cancellationRequested?: () => boolean;
}): Promise<{
    executed: true;
    summary: Record<string, unknown>;
    resultsPerKind: Record<string, ReturnType<typeof importByLearningProfileFromFolderUrl>>;
}>;
export declare function sendDailyOccurrencesPanoramaEmail(_opts?: Record<string, unknown>): Promise<{
    sent: boolean;
    recipients: Array<{
        type: 'diretoria' | 'gerencia' | 'contabilidade';
        email: string;
    }>;
    subjectPrefix: string;
    countsByMonth: Record<string, {
        total: number;
        byAction: Record<string, number>;
    }>;
}>;
export declare function getTeamsDelegatedLoginStatus(): Promise<{
    connected: boolean;
    hasRefreshToken: boolean;
    hasDeviceCode: boolean;
    deviceCodeExpiresAt: string | null;
    deviceCodeExpired: boolean;
    status: 'connected' | 'pending' | 'expired' | 'disconnected';
    dbFilePath: string;
}>;
export declare function startDailyOccurrencesPanoramaScheduler(): {
    started: boolean;
    alreadyRunning: boolean;
    nextRunAtIso: string | null;
    intervalMs: number;
};
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
type JobKind = 'runImportConsignado' | 'importByLearningProfileFromFolderUrl' | 'importByLearningProfileFromShareUrl';
export interface JobProgressFile {
    idx: number;
    fileName: string;
    targetTable?: string;
    insertedRows: number;
    skippedRows: number;
    skippedReason?: string;
    atIso?: string;
}
export interface JobRecord {
    jobId: string;
    kind: JobKind;
    status: JobStatus;
    createdAtIso: string;
    startedAtIso?: string;
    finishedAtIso?: string;
    queuedBy?: string;
    optsSnapshot?: unknown;
    totalFilesMatched?: number;
    totalFilesScanned?: number;
    totalRowsInserted?: number;
    totalRowsSkipped?: number;
    progressFiles?: JobProgressFile[];
    errorMessage?: string;
    errorStack?: string;
    resultSummary?: unknown;
    preImportSnapshotPath?: string;
    cancelled?: boolean;
    cancellationRequestedAtIso?: string;
    heartbeatAtIso?: string;
}
declare function graphResolveDriveFolderHealthCheck(folderUrl: string): Promise<{
    ok: boolean;
    reason?: string;
    driveId?: string;
    rootFolderId?: string;
    filesSample?: Array<{
        id: string;
        name: string;
        kind?: 'folder' | 'file' | null;
    }>;
    canWrite?: boolean;
}>;
export declare function runAutomationDriveHealthCheck(which?: 'principal' | 'alego' | 'adfego' | 'sisbr' | 'all'): Promise<{
    checked: Record<string, {
        label: string;
        url?: string | null;
        result: Awaited<ReturnType<typeof graphResolveDriveFolderHealthCheck>>;
    }>;
    overallOk: boolean;
}>;
export declare function listImportJobsRecent(opts?: {
    limit?: number;
}): {
    jobs: JobRecord[];
    totalInMemory: number;
};
export declare function getImportJob(jobId: string): Promise<JobRecord | null>;
export declare function cancelImportJob(jobId: string): Promise<{
    ok: boolean;
    reason?: string;
}>;
export declare function attachImportJobSse(jobId: string, res: {
    writeHead?: (status: number, headers: Record<string, string>) => void;
    write?: (chunk: string) => boolean;
    flushHeaders?: () => void;
    end?: () => void;
    socket?: unknown;
    connection?: unknown;
}): Promise<{
    ok: boolean;
    reason?: string;
}>;
export declare function submitImportJobAsync(kind: JobKind, opts: unknown): {
    jobId: string;
    status: JobStatus;
    createdAtIso: string;
    kind: JobKind;
};
export interface AutomationScheduleRecord {
    id: string;
    title: string;
    kind: 'runImportConsignado' | 'importByLearningProfileFromFolderUrl';
    target?: string | null;
    folderUrl?: string | null;
    hora: number;
    minuto: number;
    diasUteisOnly: boolean;
    diasSemana?: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
    enabled: boolean;
    createdAtIso: string;
    updatedAtIso?: string;
    lastRunAtIso?: string;
    lastJobId?: string;
    lastStatus?: JobStatus;
    nextRunAtIso?: string;
    notificationTeams?: boolean;
}
export interface AutomationConfigFull {
    teamsWebhookUrl?: string | null;
    teamsNotifyEnabled: boolean;
    jobsTtlDias: number;
    schedulerEnabled: boolean;
    scheduleDefaultHora: number;
    scheduleDefaultMin: number;
}
export interface SchedTickState {
    startedAtIso: string;
    running: boolean;
    tickCount: number;
    lastTickAtIso?: string;
    lastRunDueCheckAtIso?: string;
}
export declare function getAutomationConfig(): Promise<AutomationConfigFull>;
export declare function saveAutomationConfigPartial(partial: Partial<AutomationConfigFull> & {
    teamsWebhookUrlClear?: boolean;
}): Promise<AutomationConfigFull>;
export declare function cleanupOldJobsTtl(overrideTtlDias?: number): Promise<{
    removed: number;
    ttlDias: number;
    checked: number;
}>;
export declare function listAutomationSchedules(): Promise<AutomationScheduleRecord[]>;
export declare function getAutomationSchedule(id: string): Promise<AutomationScheduleRecord | null>;
export declare function toggleAutomationSchedule(id: string, force?: boolean): Promise<{
    ok: boolean;
    record?: AutomationScheduleRecord;
    reason?: string;
}>;
export declare function runAutomationScheduleNow(id: string): Promise<{
    ok: boolean;
    reason?: string;
    jobId?: string;
    status?: JobStatus;
    createdAtIso?: string;
}>;
export interface FailureDashboardRow {
    jobId: string;
    jobKind: string;
    jobStatus: JobStatus;
    jobCreatedAtIso: string;
    fileName?: string;
    targetTable?: string;
    insertedRows: number;
    skippedRows: number;
    skippedReason?: string;
    fileAtIso?: string;
    errorMessage?: string;
}
export declare function listAutomationImportFailures(opts?: {
    dias?: number;
    limit?: number;
    onlySkipped?: boolean;
}): Promise<{
    total: number;
    rows: FailureDashboardRow[];
    dias: number;
}>;
export declare function runAutomationHealthGeneral(): Promise<{
    serverAtIso: string;
    scheduler: SchedTickState & {
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
    drive?: Awaited<ReturnType<typeof runAutomationDriveHealthCheck>>;
    config: AutomationConfigFull;
}>;
export declare function bootstrapAutomationSystem(): Promise<{
    ok: boolean;
    cleanupTtl: {
        removed: number;
        ttlDias: number;
        checked: number;
    };
}>;
export declare function debugEnsureExtratosRelatoriosTables(): Promise<{
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
export {};
