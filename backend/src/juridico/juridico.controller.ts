import { Controller, Get, Post, Put, Delete, Patch, Query, Param, Body, Header, Res, UseInterceptors, UploadedFile, ForbiddenException, InternalServerErrorException, HttpException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as cp from 'node:child_process';
import { JuridicoService, type FiltrosListagem } from './juridico.service.js';
import { JuridicoForbiddenError } from './juridico.db.js';
import * as jdb from './juridico.db.js';

function jurCatch<T>(p: Promise<T>): Promise<T> {
  return p.catch((e) => {
    if (e instanceof JuridicoForbiddenError) throw new ForbiddenException(e.message);
    if (e?.name === 'JuridicoForbiddenError') throw new ForbiddenException(String(e.message || 'Forbidden'));
    if (e instanceof HttpException) throw e;
    if (e instanceof ForbiddenException || e instanceof InternalServerErrorException) throw e;
    throw new InternalServerErrorException(String(e?.message || e));
  });
}

@Controller('api/juridico')
export class JuridicoController {
  constructor(private readonly svc: JuridicoService) {}

  @Get('db/path')
  dbPath() {
    return { path: this.svc.dbFilePath() };
  }

  @Get('anos')
  anos() {
    return this.svc.anosDisponiveis();
  }

  @Get('origens')
  async origens() {
    return this.svc.origensDisponiveis();
  }

  private filtrosFromQuery(q: Record<string, any>): any {
    return {
      ano: q.ano ? Number(q.ano) : undefined,
      mes: q.mes ? Number(q.mes) : undefined,
      origem: q.origem ? String(q.origem) : undefined,
      busca: q.busca ? String(q.busca) : (q.nome ? String(q.nome) : undefined),
      status: q.status ? String(q.status) : undefined,
      natureza: q.natureza ? String(q.natureza) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
      order: q.order ? String(q.order) : undefined,
    };
  }

  @Get('processos')
  async listar(@Query() q: Record<string, any>) {
    return this.svc.listar(this.filtrosFromQuery(q));
  }

  @Get('kpis')
  async kpis(@Query() q: Record<string, any>) {
    return this.svc.kpis(this.filtrosFromQuery(q));
  }

  @Get('grafico/ativo-passivo')
  async grafico(@Query() q: Record<string, any>) {
    return this.svc.graficoAtivoPassivoPorMes(this.filtrosFromQuery(q));
  }

  @Get('dashboard')
  async dashboard(@Query() q: Record<string, any>) {
    const f = this.filtrosFromQuery(q);
    const [listar, kpis, grafico, anos, origens, statusesDistinctDbArr] = await Promise.all([
      this.svc.listar({ ...f, limit: 5000, offset: 0, order: undefined }),
      this.svc.kpis(f),
      this.svc.graficoAtivoPassivoPorMes(f),
      this.svc.anosDisponiveis(),
      this.svc.origensDisponiveis(),
      Promise.resolve(jdb.getDistinctStatusesOptions?.()).then(r => (Array.isArray(r) ? r : [])),
    ]);
    const statusesOptions = (() => {
      try {
        const list = statusesDistinctDbArr as string[];
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    })();
    const out: any = {
      anos,
      origens,
      statusesOptions,
      total: typeof listar === 'object' && listar && typeof (listar as any).total === 'number'
        ? Number((listar as any).total)
        : Number(Array.isArray(listar) ? listar.length : 0),
      rows: Array.isArray(listar) ? listar : (Array.isArray((listar as any)?.rows) ? (listar as any).rows : []),
      kpis: typeof kpis === 'object' && kpis && !Array.isArray(kpis) ? kpis : {},
      grafico,
    };
    out.chart = out.grafico;
    return out;
  }

  @Get('options/distinct-gerentes')
  async distinctGerentes() {
    try {
      const list = await Promise.resolve(jdb.getDistinctGerentesOptions?.()).then(r => (Array.isArray(r) ? r : []));
      return { options: Array.isArray(list) ? list : [] };
    } catch (e: any) {
      return { options: [], error: e?.message || 'Falha ao carregar gerentes.' };
    }
  }

  @Get('options/distinct-statuses')
  async distinctStatuses() {
    try {
      const list = await Promise.resolve(jdb.getDistinctStatusesOptions?.()).then(r => (Array.isArray(r) ? r : []));
      return { options: Array.isArray(list) ? list : [] };
    } catch (e: any) {
      return { options: [], error: e?.message || 'Falha ao carregar statuses.' };
    }
  }

  @Get('options/cadastro-gerentes')
  async cadastroGerentes() {
    try {
      const list = await Promise.resolve(jdb.getJuridicoGerentesCadastro?.()).then(r => (Array.isArray(r) ? r : []));
      return { options: Array.isArray(list) ? list : [] };
    } catch (e: any) {
      return { options: [], error: e?.message || 'Falha ao carregar cadastro de gerentes.' };
    }
  }

  @Post('config/gerentes/add')
  async gerentesAdd(@Body() body: any) {
    return jurCatch(
      Promise.resolve(jdb.addJuridicoGerenteCadastro?.({
        nome: body?.nome,
        pa: body?.pa,
        requestedByEmail: body?.requestedByEmail,
      })).then(r => ({ entries: Array.isArray(r) ? r : [] })),
    );
  }

  @Get('csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="processos-juridico.csv"')
  async csv(@Query() q: Record<string, any>, @Res() res: Response) {
    const body = await this.svc.csv(this.filtrosFromQuery(q));
    res.send(body);
  }

  @Get('processos/:id')
  async obter(@Param('id') id: string) {
    return jurCatch(Promise.resolve(this.svc.obter(Number(id))));
  }

  @Post('processos')
  async criar(@Body() body: any) {
    return jurCatch(this.svc.criar(body || {}, { requestedByEmail: body?.requestedByEmail }));
  }

  @Put('processos/:id')
  async atualizar(@Param('id') id: string, @Body() body: any) {
    return jurCatch(this.svc.atualizar(Number(id), body || {}, { requestedByEmail: body?.requestedByEmail }));
  }

  @Delete('processos/:id')
  async excluir(@Param('id') id: string, @Query() q: any, @Body() body: any) {
    const by = q?.requestedBy ?? body?.requestedByEmail;
    return jurCatch(this.svc.excluir(Number(id), { requestedByEmail: by }));
  }

  @Post('processos/truncate')
  async truncate(@Body() body: any, @Query() q: any) {
    const by = body?.requestedByEmail ?? q?.requestedBy;
    return jurCatch(this.svc.truncateProcessos({ requestedByEmail: by }));
  }

  // ====== ACORDOS JURÍDICOS ======

  @Get('acordos/:processoId')
  async acordoGet(@Param('processoId') processoId: string) {
    return jurCatch(Promise.resolve(this.svc.obterAcordoPorProcessoId(Number(processoId))));
  }

  @Post('acordos')
  async acordoCriar(@Body() body: any) {
    return jurCatch(this.svc.criarAcordo(body || {}, { requestedByEmail: body?.requestedByEmail }));
  }

  @Put('acordos/:id')
  async acordoAtualizar(@Param('id') id: string, @Body() body: any) {
    return jurCatch(this.svc.atualizarAcordo(Number(id), body || {}, { requestedByEmail: body?.requestedByEmail }));
  }

  @Post('importar/json')
  async importarJson(@Body() body: any) {
    const substituir = Boolean(body?.substituir);
    const linhas = Array.isArray(body?.linhas) ? body.linhas : Array.isArray(body) ? body : [];
    const backup = await this.backupSqlite();
    const res = await jurCatch(
      this.svc.importarProcessosEmMassa(linhas, {
        substituir,
        requestedByEmail: body?.requestedByEmail,
      })
    );
    return { ...res, backup };
  }

  @Post('importar/xlsm')
  @UseInterceptors(FileInterceptor('arquivo', {
    limits: { fileSize: 50 * 1024 * 1024 },
    storage: require('multer').diskStorage({
      destination: (req, file, cb) => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'juridico-xlsm-'));
        cb(null, tmp);
      },
      filename: (req, file, cb) => cb(null, 'upload_' + Date.now() + '_' + file.originalname.replace(/[^a-z0-9\.\-_]/gi, '_')),
    }),
  }))
  async importarXlsm(@UploadedFile() file: any, @Body() body: any) {
    if (!file) {
      return { ok: false, erro: 'Nenhum arquivo enviado. Use multipart/form-data field "arquivo".', importados: 0 };
    }
    const substituir = Boolean(body?.substituir);
    const senha = body?.senha ? String(body.senha) : undefined;
    const sheetArg = body?.sheet ? String(body.sheet) : undefined;
    const helper = path.resolve(
      process.cwd(),
      fs.existsSync(path.resolve(process.cwd(), 'scripts')) ? 'scripts/juridico-xlsm-to-json.py' : '../scripts/juridico-xlsm-to-json.py'
    );
    if (!fs.existsSync(helper)) {
      return { ok: false, erro: `Helper parser não encontrado: ${helper}`, importados: 0 };
    }
    const args: string[] = [helper, file.path];
    if (senha) { args.push('--password', senha); }
    if (sheetArg != null) { args.push('--sheet', sheetArg); }
    let parsed: any = null;
    try {
      const res = cp.spawnSync('python3', args, {
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: 180_000,
      });
      if (res.status !== 0) {
        return {
          ok: false,
          erro: (res.stderr || res.stdout || `exit=${res.status}`).trim().slice(0, 2000),
          importados: 0,
          exit_code: res.status,
        };
      }
      try { parsed = JSON.parse(res.stdout || '{}'); } catch (e) {
        return { ok: false, erro: `Saída Python não é JSON: ${String(e)}`, parser_stdout: (res.stdout || '').slice(0, 800) };
      }
    } catch (e: any) {
      return { ok: false, erro: `Falha ao executar parser: ${String(e?.message || e)}`, importados: 0 };
    }
    const linhas = Array.isArray(parsed?.linhas) ? parsed.linhas : [];
    const backup = await this.backupSqlite();
    const resImport = await jurCatch(
      this.svc.importarProcessosEmMassa(linhas, {
        substituir,
        requestedByEmail: body?.requestedByEmail,
      })
    );
    return {
      ok: true,
      ...resImport,
      backup,
      parser_info: {
        arquivo: parsed?.arquivo ?? null,
        sheets: parsed?.sheets ?? [],
        total_linhas_planilha: parsed?.total_linhas ?? 0,
        colunas_detectadas: parsed?.colunas_detectadas ?? [],
      },
    };
  }

  // ====== RBAC ACESSOS JURÍDICO (tabela SEPARADA juridico_access_emails) ======

  @Get('access/emails')
  async accessGet(@Query() q: any) {
    const by = q?.requestedBy;
    return jurCatch(this.svc.getJuridicoAccessEmails({ requestedByEmail: by, ensureFixed: true }));
  }

  @Get('access/me')
  async accessMe(@Query() q: any) {
    const email = String(q?.email ?? q?.requestedBy ?? '').trim().toLowerCase();
    return jurCatch(
      (async () => {
        const fixedEmail = this.svc.fixedAdminEmail;
        const isSicoobj = email.endsWith('@sicoobjuriscred.com.br');
        const isFixed = email === fixedEmail.toLowerCase();
        let dbRole: string | null = null;
        let autoGranted = false;
        if (isSicoobj) {
          try { await this.svc.autoGrantSicoobjUsuarioAccessIfApplicable(email); autoGranted = true; } catch { /* ignore */ }
        }
        try { dbRole = (await this.svc.getJuridicoAccessRole(email)) ?? null; } catch { dbRole = null; }
        let effectiveRole: 'admin' | 'usuario' | null = isFixed ? 'admin' : (dbRole as any) ?? null;
        if (!effectiveRole && isSicoobj) effectiveRole = 'usuario';
        const hasAccess = effectiveRole === 'admin' || effectiveRole === 'usuario';
        return {
          email,
          role: effectiveRole,
          admin: effectiveRole === 'admin',
          hasAccess,
          autoGranted,
          isSicoobj,
          isFixed,
          fixedEmail,
          dbFilePath: this.svc.fixedAdminEmail && ('' as any),
        };
      })()
    );
  }

  @Post('access/emails')
  async accessSet(@Body() body: any) {
    const entries = Array.isArray(body?.entries) ? body.entries : [];
    // Suporta formato simples { email, role } (front-end usa esse ao adicionar novo acesso)
    const emailRaw = body?.email ? String(body.email).trim() : '';
    if (emailRaw) {
      entries.push({
        email: emailRaw,
        role: body?.role ?? 'usuario',
        menus: Array.isArray(body?.menus) ? body.menus : undefined,
        flowStages: Array.isArray(body?.flowStages) ? body.flowStages : undefined,
      });
    }
    const deleteEmails = Array.isArray(body?.deleteEmails) ? body.deleteEmails : [];
    const requestedByEmail = body?.requestedByEmail ?? body?.requestedBy;
    return jurCatch(
      this.svc.setJuridicoAccessEmails({ entries, deleteEmails, requestedByEmail })
    );
  }

  @Delete('access/emails/:email')
  async accessDelete(@Param('email') email: string, @Query() q: any, @Body() body: any) {
    const by = q?.requestedBy ?? body?.requestedByEmail;
    return jurCatch(this.svc.deleteJuridicoAccessEmail({ email, requestedByEmail: by }));
  }

  @Patch('access/emails/:email')
  async accessChangeRole(@Param('email') email: string, @Body() body: any, @Query() q: any) {
    const by = body?.requestedByEmail ?? q?.requestedBy ?? body?.requestedBy;
    return jurCatch(
      this.svc.setJuridicoAccessEmailRole({
        email,
        role: body?.role,
        requestedByEmail: by,
      })
    );
  }

  // ====== CONFIGURAÇÕES DE NOTIFICAÇÕES ======

  @Get('config/notificacoes')
  async notificacoesGet(@Query() q: any) {
    const by = q?.requestedBy;
    if (by) {
      try {
        await this.svc.requireJuridicoAdmin(by);
      } catch (e) {
        return jurCatch(Promise.reject(e));
      }
    }
    return jurCatch(this.svc.getJuridicoNotificacoesConfig());
  }

  @Put('config/notificacoes')
  async notificacoesSet(@Body() body: any) {
    return jurCatch(
      this.svc.setJuridicoNotificacoesConfig({
        escritorioJuridico: body?.escritorioJuridico,
        cobranca: body?.cobranca,
        requestedByEmail: body?.requestedByEmail ?? body?.requestedBy,
      })
    );
  }

  // ====== REGRAS DE PRAZOS ======

  @Get('config/regras-prazos')
  async regrasPrazosGet(@Query() q: any) {
    const by = q?.requestedBy;
    if (by) {
      try {
        await this.svc.requireJuridicoAdmin(by);
      } catch (e) {
        return jurCatch(Promise.reject(e));
      }
    }
    return jurCatch(this.svc.getJuridicoRegrasPrazosConfig());
  }

  @Put('config/regras-prazos')
  async regrasPrazosSet(@Body() body: any) {
    return jurCatch(
      this.svc.setJuridicoRegrasPrazosConfig({
        prazoProtocoloExtrajudicialDias: body?.prazoProtocoloExtrajudicialDias,
        prazoAjuizamentoDias: body?.prazoAjuizamentoDias,
        requestedByEmail: body?.requestedByEmail ?? body?.requestedBy,
      })
    );
  }

  @Get('config/tipo-acoes-colunas')
  async tipoAcoesColunasGet(@Query() q: any) {
    const by = q?.requestedBy;
    return jurCatch(
      Promise.resolve(jdb.getJuridicoTipoAcoesColumnWidths?.(by)).then((cfg) => ({
        widths: cfg?.widths,
        customized: Boolean(cfg?.customized),
      }))
    );
  }

  @Put('config/tipo-acoes-colunas')
  async tipoAcoesColunasSet(@Body() body: any) {
    return jurCatch(
      Promise.resolve(jdb.setJuridicoTipoAcoesColumnWidths?.({
        requestedByEmail: body?.requestedByEmail ?? body?.requestedBy,
        widths: body?.widths,
        reset: body?.reset,
      })).then((cfg) => ({
        widths: cfg?.widths,
        customized: Boolean(cfg?.customized),
      }))
    );
  }

  private async backupSqlite(): Promise<{ path: string | null; erro?: string }> {
    try {
      const src = this.svc.dbFilePath();
      if (!fs.existsSync(src)) return { path: null, erro: 'sem banco para backup' };
      const dir = path.join(path.dirname(src), 'backups');
      fs.mkdirSync(dir, { recursive: true });
      const t = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
      const dest = path.join(dir, `juridico.sqlite.BAK_IMPORT_${t}.sqlite`);
      fs.copyFileSync(src, dest);
      return { path: dest };
    } catch (e: any) {
      return { path: null, erro: String(e?.message || e) };
    }
  }
}
