"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AllExceptionsFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const resolve_module_fn_js_1 = require("../utils/resolve-module-fn.js");
let AllExceptionsFilter = AllExceptionsFilter_1 = class AllExceptionsFilter {
    static fallbackFor(urlPath) {
        const p = String(urlPath ?? '').toLowerCase();
        if (p.includes('/automation/config'))
            return 'Falha ao operar configuração.';
        if (p.includes('/automation/occurrences-panorama'))
            return 'Falha ao enviar panorama diário das ocorrências.';
        if (p.includes('/teams/delegated/status'))
            return 'Falha ao consultar status do login do Teams.';
        if (p.includes('/teams/delegated/start'))
            return 'Falha ao iniciar login do Teams.';
        if (p.includes('/teams/delegated/finish'))
            return 'Falha ao concluir login do Teams.';
        if (p.includes('/teams/delegated/disconnect'))
            return 'Falha ao desconectar login do Teams.';
        if (p.includes('/graph/users/search'))
            return 'Falha ao buscar usuários no Graph.';
        if (p.includes('/import'))
            return 'Falha ao executar importação.';
        if (p.includes('/recurso-alego'))
            return 'Falha ao importar arquivo.';
        if (p.includes('/modalidades'))
            return 'Falha ao operar modalidades.';
        if (p.includes('/orgao-columns'))
            return 'Falha ao operar colunas de órgão.';
        if (p.includes('/orgao-depara'))
            return 'Falha ao operar de/para de órgão.';
        if (p.includes('/extratos-consolidacao-recurso'))
            return 'Falha ao operar consolidação de recurso.';
        if (p.includes('/extratos/historico1-values'))
            return 'Falha ao buscar HISTÓRICO_1 dos extratos.';
        if (p.includes('/recurso-tables'))
            return 'Falha ao buscar tabelas de recurso.';
        if (p.includes('/relatorio-consolidacao-recurso'))
            return 'Falha ao operar consolidação de relatório.';
        if (p.includes('/conciliacao/extratos/detalhe'))
            return 'Falha ao detalhar.';
        if (p.includes('/conciliacao/extratos'))
            return 'Falha ao conciliar.';
        if (p.includes('/conciliacao/meses'))
            return 'Falha ao listar meses.';
        if (p.includes('/auditoria'))
            return 'Falha ao listar auditoria.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/home-status'))
            return 'Falha ao listar status da home.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/pendencias/fluxo'))
            return 'Falha ao operar fluxo de pendências.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/data/validacao/portal'))
            return 'Falha ao carregar a página de validação.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/data/validacao/decidir'))
            return 'Falha ao registrar a decisão da validação.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/data/validacao/solicitar'))
            return 'Falha ao solicitar validação da conciliação por data.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/data'))
            return 'Falha ao carregar dados da conciliação por data.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/lista/export.xlsx'))
            return 'Falha ao exportar XLSX da lista da conciliação.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/ocorrencias/export.xlsx'))
            return 'Falha ao exportar XLSX de ocorrências.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/ocorrencias'))
            return 'Falha ao listar ocorrências.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/export.pdf'))
            return 'Falha ao exportar PDF.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/data/export.pdf'))
            return 'Falha ao exportar PDF da conciliação por data.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/export.xlsx'))
            return 'Falha ao exportar XLSX.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/data/export.xlsx'))
            return 'Falha ao exportar XLSX da conciliação por data.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/clonar-para-sisbr'))
            return 'Falha ao clonar para o SISBR.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/ocorrencia-context'))
            return 'Falha ao carregar ocorrência.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/inclusao-servidor-acordo-judicial-tjgo'))
            return 'Falha ao incluir servidor por acordo judicial TJGO.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/tarifa'))
            return 'Falha ao salvar tarifa.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/alterar-orgao-relatorio'))
            return 'Falha ao alterar órgão no Relatório SISBR.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/repactuacao-relatorio'))
            return 'Falha ao registrar repactuação no Relatório SISBR.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/liquidacao-ccs-excluir-relatorio'))
            return 'Falha ao excluir do Relatório SISBR.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/liquidacao-processo-judicial-excluir-relatorio'))
            return 'Falha ao excluir do Relatório SISBR (Processo Judicial).';
        if (p.includes('/conciliacao/recurso-vs-relatorio/nao-possui-recurso'))
            return 'Falha ao registrar Não possui Recurso.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/liquidacao-fora-vencimento'))
            return 'Falha ao registrar Liquidação Fora do Vencimento.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/liquidacao-antecipada-via-caixa'))
            return 'Falha ao registrar Liquidação Antecipada.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/liquidacao-recurso-judicial'))
            return 'Falha ao registrar Liquidação de Recurso Judicial.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/liquidacao-anterior-via-caixa'))
            return 'Falha ao registrar Liquidação Anterior via Caixa.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/liquidacao-antecipada-devolvida'))
            return 'Falha ao registrar Antecipado Devolvido.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/recurso-recebido-a-maior'))
            return 'Falha ao registrar Recurso Recebido a Maior.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/devolucao-parcial-averbacao'))
            return 'Falha ao registrar Devolução Parcial por Averbação.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/recurso-recebido-a-menor'))
            return 'Falha ao registrar Recurso Recebido a Menor.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/recurso-judicial-valor-a-menor'))
            return 'Falha ao registrar Recurso Judicial Valor a Menor.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/estorno'))
            return 'Falha ao registrar Estorno.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/repactuacao'))
            return 'Falha ao registrar Repactuação.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/antecipado-devolvido'))
            return 'Falha ao registrar Antecipado Devolvido.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/desfazer-ocorrencia'))
            return 'Falha ao desfazer ocorrência.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/fechar'))
            return 'Falha ao fechar conciliação.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/reabrir'))
            return 'Falha ao reabrir conciliação.';
        if (p.includes('/conciliacao/recurso-vs-relatorio/reenviar-contabilidade'))
            return 'Falha ao reenviar fechamento para contabilidade.';
        if (p.includes('/conciliacao/recurso-vs-relatorio'))
            return 'Falha ao conciliar recurso x relatório.';
        if (p.includes('/conciliacao/temporario'))
            return 'Falha ao operar temporário da conciliação.';
        if (p.includes('/temporario/conciliacao.csv'))
            return 'Falha ao exportar CSV do temporário.';
        if (p.includes('/temporario/conciliacao.xlsx'))
            return 'Falha ao exportar XLSX do temporário.';
        if (p.includes('/access/emails'))
            return 'Falha ao operar e-mails de acesso.';
        if (p.includes('/debug/event'))
            return 'Falha ao registrar evento de debug.';
        return 'Erro interno ao processar solicitação.';
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const req = ctx.getRequest();
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const payload = exception.getResponse();
            res.status(status).json(payload);
            return;
        }
        const fallback = AllExceptionsFilter_1.fallbackFor(req.url ?? '');
        const message = (0, resolve_module_fn_js_1.toErrorMessage)(exception, fallback);
        const wrapped = new common_1.InternalServerErrorException(message);
        res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json(wrapped.getResponse());
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = AllExceptionsFilter_1 = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map