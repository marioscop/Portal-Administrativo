import {
  Body,
  Controller,
  InternalServerErrorException,
  Query,
  Post,
  Get,
  Header,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  conciliarRecursoOrgaoRelatorio,
  conciliarExtratoRelatorio,
  conciliarExtratoRelatorioDetalhe,
  conciliarTemporario,
  clonarParaRelatorioSisbrFromExtratos,
  alterarOrgaoRelatorioSisbr,
  desfazerOcorrenciaRelatorioSisbr,
  getOcorrenciaCloneParaSisbrContext,
  upsertConciliacaoTarifa,
  deleteOrgaoDePara,
  exportConcilicacaoTemporarioXlsx,
  getConsignadoAutomationConfig,
  getConsignadoAccessEmails,
  getModalidades,
  getOrgaoColumnsConfig,
  getOrgaoDePara,
  getExtratosConsolidacaoRecurso,
  getExtratosHistorico1Values,
  importByLearningProfileFromShareUrl,
  importByLearningProfileFromFolderUrl,
  importExtratosTemporarioFromBuffer,
  importRelatoriosTemporarioFromBuffer,
  listarFiltrosTemporario,
  listarMesesConcilicacaoDisponiveis,
  runImportConsignado,
  saveConsignadoAutomationConfig,
  upsertOrgaoDePara,
  upsertExtratosConsolidacaoRecurso,
  saveOrgaoColumnsConfig,
  saveModalidades,
  setConsignadoAccessEmails,
  deleteExtratosConsolidacaoRecurso,
} from './import-consignado';

@Controller('api/consignado')
export class ConsignadoController {
  private isTeamsMeetingUrl(value: string): boolean {
    try {
      const u = new URL(value);
      return (
        u.hostname.toLowerCase() === 'teams.microsoft.com' &&
        u.pathname.toLowerCase().startsWith('/meet/')
      );
    } catch {
      return false;
    }
  }

  @Get('automation/config')
  async getAutomationConfig() {
    try {
      return await getConsignadoAutomationConfig();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao carregar configuração.';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('automation/config')
  async saveAutomationConfig(
    @Body()
    body: {
      sharePointFolderUrl?: string | null;
      recursoAlegoUrl?: string | null;
      recursoMpgoUrl?: string | null;
    },
  ) {
    try {
      return await saveConsignadoAutomationConfig({
        sharePointFolderUrl: body.sharePointFolderUrl ?? null,
        recursoAlegoUrl: body.recursoAlegoUrl ?? null,
        recursoMpgoUrl: body.recursoMpgoUrl ?? null,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao salvar configuração.';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('import')
  async importNow(
    @Body()
    body: {
      folderUrl?: string;
      learningUrl?: string;
      notificationTo?: string;
      modalidades?: string[];
      mode?: 'append' | 'replace';
      target?: 'both' | 'extratos' | 'relatorio' | 'recurso_alego' | 'recurso_mpgo';
    },
  ) {
    try {
      if (body.target === 'recurso_alego' || body.target === 'recurso_mpgo') {
        const url = String(body.learningUrl ?? body.folderUrl ?? '').trim();
        if (!url) {
          throw new Error('Informe learningUrl (ou folderUrl) com a URL do SharePoint.');
        }
        return await importByLearningProfileFromFolderUrl({ folderUrl: url });
      }
      const url = String(body.folderUrl ?? '').trim();
      if (url && this.isTeamsMeetingUrl(url)) {
        throw new Error(
          'Link do Teams (reunião) não é um arquivo. Para importar Extrato/Relatório, informe a URL do SharePoint (pasta ou arquivo).',
        );
      }
      const result = await runImportConsignado({
        folderUrl: body.folderUrl,
        notificationTo: body.notificationTo,
        modalidades: body.modalidades,
        mode: body.mode,
        target: body.target as any,
      });
      return result;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao executar importação.';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('recurso-alego/import')
  async importRecursoAlego(
    @Body()
    body: {
      fileUrl?: string;
    },
  ) {
    try {
      return await importByLearningProfileFromShareUrl({
        fileUrl: body.fileUrl ?? '',
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao importar arquivo.';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('modalidades')
  async saveModalidadesNow(
    @Body()
    body: {
      modalidades?: string[];
    },
  ) {
    try {
      return await saveModalidades({ modalidades: body.modalidades });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao salvar modalidades.';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('modalidades')
  async getModalidadesNow() {
    try {
      return await getModalidades();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao carregar modalidades.';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('orgao-columns')
  async getOrgaoColumns() {
    try {
      return await getOrgaoColumnsConfig();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao buscar colunas de órgão.';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('orgao-columns')
  async saveOrgaoColumns(
    @Body()
    body: {
      extratos?: string | null;
      relatorio?: string | null;
    },
  ) {
    try {
      return await saveOrgaoColumnsConfig({
        extratos: body.extratos ?? null,
        relatorio: body.relatorio ?? null,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao salvar colunas de órgão.';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('orgao-depara')
  async getOrgaoDeParaNow() {
    try {
      return await getOrgaoDePara();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao buscar de/para de órgão.';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('orgao-depara')
  async upsertOrgaoDeParaNow(
    @Body()
    body: {
      extratos?: string;
      relatorio?: string;
    },
  ) {
    try {
      return await upsertOrgaoDePara({
        extratos: body.extratos ?? '',
        relatorio: body.relatorio ?? '',
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao salvar de/para de órgão.';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('orgao-depara/delete')
  async deleteOrgaoDeParaNow(
    @Body()
    body: {
      extratos?: string;
    },
  ) {
    try {
      return await deleteOrgaoDePara({ extratos: body.extratos ?? '' });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao remover de/para de órgão.';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('extratos-consolidacao-recurso')
  async getExtratosConsolidacaoRecursoNow() {
    try {
      return await getExtratosConsolidacaoRecurso();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao buscar consolidação de recurso.';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('extratos-consolidacao-recurso')
  async upsertExtratosConsolidacaoRecursoNow(
    @Body()
    body: {
      orgao?: string;
      historico1?: string;
    },
  ) {
    try {
      return await upsertExtratosConsolidacaoRecurso({
        orgao: body.orgao ?? '',
        historico1: body.historico1 ?? '',
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao salvar consolidação de recurso.';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('extratos-consolidacao-recurso/delete')
  async deleteExtratosConsolidacaoRecursoNow(
    @Body()
    body: {
      orgao?: string;
      historico1?: string;
    },
  ) {
    try {
      return await deleteExtratosConsolidacaoRecurso({
        orgao: body.orgao ?? '',
        historico1: body.historico1 ?? '',
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao remover consolidação de recurso.';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('extratos/historico1-values')
  async getExtratosHistorico1ValuesNow() {
    try {
      return await getExtratosHistorico1Values();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao buscar HISTÓRICO_1 dos extratos.';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('conciliacao/extratos')
  async conciliarExtratos(
    @Query('month') month?: string,
    @Query('orgao') orgao?: string,
  ) {
    if (!month) {
      throw new InternalServerErrorException(
        'Informe a competência no formato YYYY-MM.',
      );
    }
    try {
      return await conciliarExtratoRelatorio({ month, orgao });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao conciliar.';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('conciliacao/meses')
  async listarMeses() {
    try {
      return await listarMesesConcilicacaoDisponiveis();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao listar meses.';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('conciliacao/extratos/detalhe')
  async conciliarExtratosDetalhe(
    @Query('month') month?: string,
    @Query('key') key?: string,
    @Query('orgao') orgao?: string,
  ) {
    if (!month) {
      throw new InternalServerErrorException(
        'Informe a competência no formato YYYY-MM.',
      );
    }
    if (!key) {
      throw new InternalServerErrorException('Informe a Operação/Documento.');
    }
    try {
      return await conciliarExtratoRelatorioDetalhe({ month, key, orgao });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao detalhar.';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('conciliacao/recurso-vs-relatorio')
  async conciliarRecursoVsRelatorio(
    @Query('month') month?: string,
    @Query('orgao') orgao?: string,
  ) {
    if (!month) {
      throw new InternalServerErrorException(
        'Informe a competência no formato YYYY-MM.',
      );
    }
    if (!orgao || !orgao.trim()) {
      throw new InternalServerErrorException('Informe o órgão.');
    }
    try {
      return await conciliarRecursoOrgaoRelatorio({ month, orgao });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao conciliar recurso x relatório.';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('conciliacao/recurso-vs-relatorio/clonar-para-sisbr')
  async clonarParaSisbr(
    @Body()
    body: {
      month?: string;
      orgao?: string;
      cpf?: string;
      nome?: string;
      value?: string;
      recursoTable?: string;
      action?: string;
      justification?: string;
    },
  ) {
    if (!body.month) {
      throw new InternalServerErrorException('Informe a competência no formato YYYY-MM.');
    }
    if (!body.orgao || !body.orgao.trim()) {
      throw new InternalServerErrorException('Informe o órgão.');
    }
    if (!body.cpf || !body.cpf.trim()) {
      throw new InternalServerErrorException('Informe o CPF.');
    }
    if (!body.nome || !body.nome.trim()) {
      throw new InternalServerErrorException('Informe o nome.');
    }
    if (!body.value || !body.value.trim()) {
      throw new InternalServerErrorException('Informe o valor.');
    }
    if (!body.justification || !body.justification.trim()) {
      throw new InternalServerErrorException('Informe a justificativa.');
    }
    try {
      return await clonarParaRelatorioSisbrFromExtratos({
        month: body.month,
        orgao: body.orgao,
        cpf: body.cpf,
        nome: body.nome,
        value: body.value,
        recursoTable: body.recursoTable,
        action: body.action,
        justification: body.justification,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao clonar para o SISBR.';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('conciliacao/recurso-vs-relatorio/ocorrencia-context')
  async ocorrenciaContext(
    @Body()
    body: { month?: string; orgao?: string; cpf?: string; value?: string },
  ) {
    if (!body.month) {
      throw new InternalServerErrorException('Informe a competência no formato YYYY-MM.');
    }
    if (!body.orgao || !body.orgao.trim()) {
      throw new InternalServerErrorException('Informe o órgão.');
    }
    if (!body.cpf || !body.cpf.trim()) {
      throw new InternalServerErrorException('Informe o CPF.');
    }
    if (!body.value || !body.value.trim()) {
      throw new InternalServerErrorException('Informe o valor.');
    }
    try {
      return await getOcorrenciaCloneParaSisbrContext({
        month: body.month,
        orgao: body.orgao,
        cpf: body.cpf,
        value: body.value,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao carregar ocorrência.';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('conciliacao/recurso-vs-relatorio/tarifa')
  async upsertTarifa(
    @Body()
    body: { month?: string; orgao?: string; type?: string; value?: string },
  ) {
    if (!body.month) {
      throw new InternalServerErrorException('Informe a competência no formato YYYY-MM.');
    }
    if (!body.orgao || !body.orgao.trim()) {
      throw new InternalServerErrorException('Informe o órgão.');
    }
    if (!body.value || !body.value.trim()) {
      throw new InternalServerErrorException('Informe o valor da tarifa.');
    }
    try {
      return await upsertConciliacaoTarifa({
        month: body.month,
        orgao: body.orgao,
        type: body.type,
        value: body.value,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao salvar tarifa.';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('conciliacao/recurso-vs-relatorio/alterar-orgao-relatorio')
  async alterarOrgaoRelatorio(
    @Body()
    body: {
      month?: string;
      cpf?: string;
      nome?: string;
      value?: string;
      fromEmpresa?: string;
      toOrgao?: string;
      action?: string;
      justification?: string;
    },
  ) {
    if (!body.month) {
      throw new InternalServerErrorException('Informe a competência no formato YYYY-MM.');
    }
    if (!body.cpf || !body.cpf.trim()) {
      throw new InternalServerErrorException('Informe o CPF.');
    }
    if (!body.nome || !body.nome.trim()) {
      throw new InternalServerErrorException('Informe o nome.');
    }
    if (!body.value || !body.value.trim()) {
      throw new InternalServerErrorException('Informe o valor.');
    }
    if (!body.fromEmpresa || !body.fromEmpresa.trim()) {
      throw new InternalServerErrorException('Empresa atual não informada.');
    }
    if (!body.toOrgao || !body.toOrgao.trim()) {
      throw new InternalServerErrorException('Informe o órgão de destino.');
    }
    if (!body.justification || !body.justification.trim()) {
      throw new InternalServerErrorException('Informe a justificativa.');
    }
    try {
      return await alterarOrgaoRelatorioSisbr({
        month: body.month,
        cpf: body.cpf,
        nome: body.nome,
        value: body.value,
        fromEmpresa: body.fromEmpresa,
        toOrgao: body.toOrgao,
        action: body.action,
        justification: body.justification,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao alterar órgão no Relatório SISBR.';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('conciliacao/recurso-vs-relatorio/desfazer-ocorrencia')
  async desfazerOcorrencia(
    @Body()
    body: { id?: number; undoJustification?: string },
  ) {
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      throw new InternalServerErrorException('Informe o ID da ocorrência.');
    }
    try {
      return await desfazerOcorrenciaRelatorioSisbr({
        id,
        undoJustification: body.undoJustification,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao desfazer ocorrência.';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('access/emails')
  async getAccessEmails() {
    try {
      return await getConsignadoAccessEmails();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao buscar acessos.';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('access/emails')
  async setAccessEmails(
    @Body()
    body: {
      entries?: Array<{ email: string; role?: 'admin' | 'usuario' }>;
      emails?: string[];
    },
  ) {
    try {
      return await setConsignadoAccessEmails({
        entries: body.entries,
        emails: body.emails,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao salvar acessos.';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('temporario')
  @Header('content-type', 'text/html; charset=utf-8')
  async temporarioPage() {
    const filters = await listarFiltrosTemporario();
    const escAttr = (v: unknown) =>
      String(v ?? '')
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

  @Get('temporario/conciliacao')
  @Header('content-type', 'text/html; charset=utf-8')
  async conciliacaoTemporarioPage(
    @Query('competencia') competencia?: string,
    @Query('orgao') orgao?: string,
    @Query('status') status?: string,
  ) {
    try {
      const result = await conciliarTemporario({
        competencia: competencia ?? null,
        orgao: orgao ?? null,
        status: status ?? null,
      });

      const esc = (v: unknown) =>
        String(v ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');

      const statusKey =
        String(status ?? '')
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '_') || '';

      const max = 200;
      const shown = result.rows.slice(0, max);
      const query = `competencia=${encodeURIComponent(competencia ?? '')}&orgao=${encodeURIComponent(orgao ?? '')}&status=${encodeURIComponent(status ?? '')}`;

      const rowsHtml = shown
        .map(
          (r) => {
            const ok = (r as any).StatusKey === 'conciliado';
            return `<tr>
  <td>${esc(r.Nome)}</td>
  <td>${esc(r.CPF)}</td>
  <td style="text-align:right">${esc(r.ValorRelatorio)}</td>
  <td style="text-align:right">${esc(r.ValorExtrato)}</td>
  <td><span class="pill ${ok ? 'ok' : 'bad'}">${esc(r.Status)}</span></td>
</tr>`;
          },
        )
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
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao conciliar temporário.';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('temporario/conciliacao.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  async conciliacaoTemporarioCsv(
    @Query('competencia') competencia?: string,
    @Query('orgao') orgao?: string,
    @Query('status') status?: string,
  ) {
    try {
      const result = await conciliarTemporario({
        competencia: competencia ?? null,
        orgao: orgao ?? null,
        status: status ?? null,
      });

      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = ['Nome', 'CPF', 'ValorRelatorio', 'ValorExtrato', 'Status']
        .map(esc)
        .join(';');
      const lines = result.rows.map((r) =>
        [r.Nome, r.CPF, r.ValorRelatorio, r.ValorExtrato, r.Status]
          .map(esc)
          .join(';'),
      );
      return [header, ...lines].join('\r\n');
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao exportar conciliação.';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('temporario/conciliacao.xlsx')
  async conciliacaoTemporarioXlsx(
    @Query('competencia') competencia: string | undefined,
    @Query('orgao') orgao: string | undefined,
    @Query('status') status: string | undefined,
    @Res() res: Response,
  ) {
    try {
      const out = await exportConcilicacaoTemporarioXlsx({
        competencia: competencia ?? null,
        orgao: orgao ?? null,
        status: status ?? null,
      });
      res.setHeader(
        'content-type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'content-disposition',
        `attachment; filename="${out.fileName}"`,
      );
      res.status(200).send(out.buffer);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao exportar XLSX.';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('temporario/extratos')
  @Header('content-type', 'text/html; charset=utf-8')
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

  @Post('temporario/extratos')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  @Header('content-type', 'text/html; charset=utf-8')
  async extratosTemporarioUpload(
    @UploadedFile() file?: any,
    @Body() body?: { tableName?: string },
  ) {
    try {
      if (!file || !file.buffer || file.buffer.length === 0) {
        throw new Error('Nenhum arquivo recebido.');
      }
      const name = String(file.originalname ?? '').trim();
      const lower = name.toLowerCase();
      if (!(lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv') || lower.endsWith('.pdf'))) {
        throw new Error('Formato inválido. Envie .xls, .xlsx, .csv ou .pdf.');
      }

      const result = await importExtratosTemporarioFromBuffer({
        fileName: name || 'upload',
        file: file.buffer,
        tableName: body?.tableName,
      });

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
        <div>Linhas: <code>${result.rows}</code></div>
        <div>Colunas: <code>${result.columns}</code></div>
      </div>
      <a href="/api/consignado/temporario">Voltar</a>
    </div>
  </body>
</html>`;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao importar arquivo.';
      throw new InternalServerErrorException(message);
    }
  }

  @Get('temporario/relatorios')
  @Header('content-type', 'text/html; charset=utf-8')
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

  @Post('temporario/relatorios')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 30 * 1024 * 1024 },
    }),
  )
  @Header('content-type', 'text/html; charset=utf-8')
  async relatoriosTemporarioUpload(
    @UploadedFile() file?: any,
    @Body() body?: { tableName?: string },
  ) {
    try {
      if (!file || !file.buffer || file.buffer.length === 0) {
        throw new Error('Nenhum arquivo recebido.');
      }
      const name = String(file.originalname ?? '').trim();
      const lower = name.toLowerCase();
      if (!lower.endsWith('.pdf')) {
        throw new Error('Formato inválido. Envie .pdf.');
      }

      const result = await importRelatoriosTemporarioFromBuffer({
        fileName: name || 'upload.pdf',
        file: file.buffer,
        tableName: body?.tableName,
      });

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
        <div>Linhas: <code>${result.rows}</code></div>
        <div>Colunas: <code>${result.columns}</code></div>
      </div>
      <a href="/api/consignado/temporario">Voltar</a>
    </div>
  </body>
</html>`;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao importar arquivo.';
      throw new InternalServerErrorException(message);
    }
  }
}
