import * as fs from 'node:fs';
import { getJuridicoDbFilePath, openJuridicoDatabase } from './juridico.db.js';
import * as jdb from './juridico.db.js';

export interface ProcessoJuridico {  id?: number;
  origem?: string;
  numero_contrato_sicoob?: string;
  numero_processo_ajuizamento?: string;
  valor_dado_causa_ajuizamento?: number;
  data_distribuicao_ajuizamento?: string | null;
  probabilidade_ganho_ajuizamento?: number;
  probabilidade_perda_ajuizamento?: number;
  valor_estimado_perda_ajuizamento?: number;
  tipo_acao_ajuizamento?: string;
  origem_processo_1grau_ajuizamento?: string;
  processos_vinculados_ajuizamento?: string;
  status_ultimo_andamento_ajuizamento?: string;
  data_ultimo_andamento_ajuizamento?: string | null;
  data_recebimento_cobranca_extrajudicial?: string | null;
  status_extrajudicial?: string;
  matricula_extrajudicial?: string;
  numero_protocolo_cartorio_extrajudicial?: string;
  cartorio_extrajudicial?: string;
  data_protocolizacao_cartorio_extrajudicial?: string | null;
  data_ultima_etapa_extrajudicial?: string | null;
  observacoes_extrajudicial?: string;
  data_limite_protocolar_extrajudicial?: string | null;
  autor_1_nome?: string; autor_1_cpf_cnpj: string;
  autor_2_nome?: string; autor_2_cpf_cnpj: string;
  autor_3_nome?: string; autor_3_cpf_cnpj: string;
  autor_4_nome?: string; autor_4_cpf_cnpj: string;
  autor_5_nome?: string; autor_5_cpf_cnpj: string;
  autor_6_nome?: string; autor_6_cpf_cnpj: string;
  reu_1_nome?: string; reu_1_cpf_cnpj: string;
  reu_2_nome?: string; reu_2_cpf_cnpj: string;
  reu_3_nome?: string; reu_3_cpf_cnpj: string;
  reu_4_nome?: string; reu_4_cpf_cnpj: string;
  reu_5_nome?: string; reu_5_cpf_cnpj: string;
  reu_6_nome?: string; reu_6_cpf_cnpj: string;
  honorarios_realizados?: number;
  custas_processuais_extrajudiciais?: number;
  numero_pa_enviados_ajuizamento?: string;
  gerente?: string;
  serasa_enviados_juridico?: string;
  data_prescricao_3anos_enviados_ajuizamento?: string | null;
  data_prescricao_5anos_enviados_ajuizamento?: string | null;
  data_limite_ajuizamento?: string | null;
  status?: string;
  natureza?: 'Ativo' | 'Passivo' | 'Extinta' | null;
  valor?: number;
  custas_honorarios?: number;
  observacoes?: string;
  contrato_sicoob?: string;
  numero_processo?: string;
  autores?: string;
  reus?: string;
  data_evento?: string | null;
  created_at?: string;
  updated_at?: string;
  origem_importacao?: string;
  row_hash?: string;
}

export interface FiltrosListagem {
  ano?: number;
  mes?: number;
  origem?: string;
  busca?: string;
  status?: string;
  natureza?: string;
  limit?: number;
  offset?: number;
  order?: string;
}

type DbCtx = Awaited<ReturnType<typeof openJuridicoDatabase>>;

export class JuridicoService {
  dbFilePath(): string { return getJuridicoDbFilePath(); }

  readonly fixedAdminEmail = jdb.JURIDICO_FIXED_ACCESS_EMAIL;
  readonly requireJuridicoAdmin = jdb.requireJuridicoAdmin;
  readonly getJuridicoAccessEmails = jdb.getJuridicoAccessEmails;
  readonly setJuridicoAccessEmails = jdb.setJuridicoAccessEmails;
  readonly deleteJuridicoAccessEmail = jdb.deleteJuridicoAccessEmail;
  readonly getJuridicoNotificacoesConfig = jdb.getJuridicoNotificacoesConfig;
  readonly setJuridicoNotificacoesConfig = jdb.setJuridicoNotificacoesConfig;
  readonly getJuridicoRegrasPrazosConfig = jdb.getJuridicoRegrasPrazosConfig;
  readonly setJuridicoRegrasPrazosConfig = jdb.setJuridicoRegrasPrazosConfig;
  readonly getJuridicoAccessRole = jdb.getJuridicoAccessRole;
  readonly hasJuridicoAccess = jdb.hasJuridicoAccess;
  readonly autoGrantSicoobjUsuarioAccessIfApplicable = jdb.autoGrantSicoobjUsuarioAccessIfApplicable;
  readonly juridicoIsSicoobjEmail = jdb.juridicoIsSicoobjEmail;
  readonly setJuridicoAccessEmailRole = jdb.setJuridicoAccessEmailRole;
  readonly obterAcordoPorProcessoId = jdb.getAcordoByProcessoId;
  readonly criarAcordo = jdb.createAcordo;
  readonly atualizarAcordo = jdb.updateAcordo;

  private async withDb<T>(fn: (ctx: DbCtx) => Promise<T> | T): Promise<T> {
    const ctx = await openJuridicoDatabase();
    try { return await fn(ctx); } finally { try { ctx.db.close(); } catch {} }
  }

  // ============= KPIs (8 cards do dashboard) =============
  async kpis(filtros?: FiltrosListagem): Promise<Record<string, any>> {
    const colValor = `COALESCE(NULLIF(valor,0),NULLIF(valor_dado_causa_ajuizamento,0),0)`;
    const colData = `COALESCE(
      NULLIF(data_distribuicao_ajuizamento,''), NULLIF(data_evento,''),
      NULLIF(data_recebimento_cobranca_extrajudicial,''), NULLIF(data_protocolizacao_cartorio_extrajudicial,''), created_at)`;
    const atrasoCond = `(
      (data_limite_ajuizamento IS NOT NULL AND date(data_limite_ajuizamento) < date('now'))
      OR
      (data_limite_protocolar_extrajudicial IS NOT NULL AND date(data_limite_protocolar_extrajudicial) < date('now'))
    ) AND (status NOT IN ('Extinto','Quitado','Baixado','Arquivado') OR status IS NULL)`;

    const makeAgg = (db: any, f: FiltrosListagem | undefined) => {
      const where = this.buildWhere(f, { forAgg: true });
      const base = `SELECT * FROM processos ${where.sql ? 'WHERE ' + where.sql : ''}`;
      const sqlTotal = `SELECT COUNT(*) c FROM processos ${where.sql ? 'WHERE ' + where.sql : ''}`;
      const total = Number(db.exec(sqlTotal, where.params as any)[0]?.values?.[0]?.[0]) || 0;
      const sqlAtraso = `SELECT COUNT(*) c FROM (${base}) t WHERE ${atrasoCond}`;
      const atraso = Number(db.exec(sqlAtraso, where.params as any)[0]?.values?.[0]?.[0]) || 0;
      const ativo = Number(db.exec(`SELECT COUNT(*) c FROM (${base}) t WHERE (natureza='Ativo' OR (natureza IS NULL AND origem='Cooperativa Ré')) AND (status NOT IN ('Extinto','Quitado','Baixado','Arquivado') OR status IS NULL)`, where.params as any)[0]?.values?.[0]?.[0]) || 0;
      const passivo = Number(db.exec(`SELECT COUNT(*) c FROM (${base}) t WHERE (natureza='Passivo' OR (natureza IS NULL AND origem='Cooperativa Autora')) AND (status NOT IN ('Extinto','Quitado','Baixado','Arquivado') OR status IS NULL)`, where.params as any)[0]?.values?.[0]?.[0]) || 0;
      const extinta = Number(db.exec(`SELECT COUNT(*) c FROM (${base}) t WHERE natureza='Extinta' OR status IN ('Extinto','Quitado','Baixado','Arquivado') OR status_ultimo_andamento_ajuizamento IN ('Extinto','Quitado')`, where.params as any)[0]?.values?.[0]?.[0]) || 0;
      const vAtivo = Number(db.exec(`SELECT COALESCE(SUM(${colValor}),0) FROM processos WHERE (natureza='Ativo' OR (natureza IS NULL AND origem='Cooperativa Ré')) ${where.sql ? 'AND (' + where.sql + ')' : ''}`, where.params as any)[0]?.values?.[0]?.[0]) || 0;
      const vPassivo = Number(db.exec(`SELECT COALESCE(SUM(${colValor}),0) FROM processos WHERE (natureza='Passivo' OR (natureza IS NULL AND origem='Cooperativa Autora')) ${where.sql ? 'AND (' + where.sql + ')' : ''}`, where.params as any)[0]?.values?.[0]?.[0]) || 0;
      const vExtinta = Number(db.exec(`SELECT COALESCE(SUM(${colValor}),0) FROM processos WHERE (natureza='Extinta' OR status IN ('Extinto','Quitado','Baixado','Arquivado') OR status_ultimo_andamento_ajuizamento IN ('Extinto','Quitado')) ${where.sql ? 'AND (' + where.sql + ')' : ''}`, where.params as any)[0]?.values?.[0]?.[0]) || 0;
      const custas = Number(db.exec(`SELECT COALESCE(SUM(COALESCE(custas_processuais_extrajudiciais,0)+COALESCE(honorarios_realizados,0)+COALESCE(custas_honorarios,0)),0) FROM processos ${where.sql ? 'WHERE ' + where.sql : ''}`, where.params as any)[0]?.values?.[0]?.[0]) || 0;
      const extintos = Number(db.exec(`SELECT COUNT(*) c FROM (${base}) t WHERE status_ultimo_andamento_ajuizamento IN ('Extinto','Baixado','Arquivado','Quitado') OR status_extrajudicial IN ('Extinto','Baixado','Arquivado','Quitado') OR status IN ('Extinto','Quitado','Baixado','Arquivado')`, where.params as any)[0]?.values?.[0]?.[0]) || 0;
      const ajuizados = Number(db.exec(`SELECT COUNT(*) c FROM (${base}) t WHERE (numero_processo_ajuizamento IS NOT NULL AND numero_processo_ajuizamento<>'') OR status_ultimo_andamento_ajuizamento IS NOT NULL AND status_ultimo_andamento_ajuizamento<>''`, where.params as any)[0]?.values?.[0]?.[0]) || 0;
      void ativo; void passivo; void extinta;
      return {
        solicitacoes: total,
        atraso,
        total_registros: total,
        contratos_em_atraso: atraso,
        total_valor_ativo: vAtivo,
        total_valor_passivo: vPassivo,
        total_valor_extinta: vExtinta,
        custas,
        custas_honorarios_total: custas,
        extintos,
        processos_extintos: extintos,
        ajuizados,
        processos_ajuizados: ajuizados,
      };
    };

    const mesAnterior = (f: FiltrosListagem | undefined): FiltrosListagem => {
      const clone: any = f ? { ...f as any } : {};
      const anoFiltro = clone.ano ? Number(clone.ano) : null;
      const mesFiltro = clone.mes ? Number(clone.mes) : null;
      let a = anoFiltro ?? new Date().getFullYear();
      let m = mesFiltro ?? (new Date().getMonth() + 1);
      m -= 1;
      if (m < 1) { m = 12; a -= 1; }
      clone.ano = String(a);
      clone.mes = String(m);
      return clone as FiltrosListagem;
    };

    return this.withDb(async ({ db }) => {
      // Determinar filtros de referência (para mes anterior também)
      // REGRAS (ajustadas após validação):
      //  - refFiltros = SEMPRE os filtros do usuário SEM ALTERAÇÕES (preserva base total,
      //    status, natureza, origem, busca, ano, mes etc - NÃO adiciona ano/mes default).
      //  - SÓ calcula trends (prevFiltros mes anterior) se o usuário selecionou
      //    ano e/ou mes explicitamente (nunca gera trends default automático).
      let prevFiltros: FiltrosListagem | undefined = undefined;
      const refFiltros: FiltrosListagem = filtros ? { ...(filtros as any) } : ({} as FiltrosListagem);
      const temAnoMes = Boolean(filtros?.ano != null || filtros?.mes != null);

      if (temAnoMes) {
        prevFiltros = mesAnterior(filtros);
      }
      const ref = makeAgg(db, refFiltros);
      const prev = prevFiltros ? makeAgg(db, prevFiltros) : null;

      const refKeys: (keyof typeof ref)[] = [
        'total_registros', 'contratos_em_atraso',
        'total_valor_passivo', 'total_valor_ativo',
        'total_valor_extinta', 'custas_honorarios_total',
        'processos_extintos', 'processos_ajuizados'
      ];
      // goodList: true = aumento é bom, false = aumento é ruim, null = neutro
      const goodList: (boolean | null)[] = [true, false, false, true, null, false, true, true];
      const trends = refKeys.map((key, idx) => {
        const a = Number(ref[key]) || 0;
        const b = prev ? (Number((prev as any)[key]) || 0) : 0;
        let pct: number | null = null;
        if (b > 0) pct = ((a - b) / b) * 100;
        else if (a > 0) pct = 100;
        else pct = 0;
        const good = goodList[idx];
        let isGood: boolean | null = null;
        if (good === null) isGood = true;
        else if (good === true) isGood = pct >= 0;
        else isGood = pct <= 0;
        return {
          key: String(key),
          ref: a,
          prev: b,
          pct: Number.isFinite(pct as number) ? Number(Number(pct).toFixed(2)) : 0,
          good: Boolean(isGood),
        };
      });
      return { ...ref, trends };
    });
  }

  // ============= Ativo×Passivo mensal 12m =============
  async graficoAtivoPassivoPorMes(filtros?: FiltrosListagem) { return this.serieNaturezaPorMes(filtros); }

  async serieNaturezaPorMes(filtros?: FiltrosListagem): Promise<{ mes_ano:string; ativo:number; passivo:number; mes_idx:number; }[]> {
    // where: filtros COMPLETOS do usuário (inclui status, natureza, origem, busca, ano, mes etc)
    const where = this.buildWhere(filtros, { forAgg: true });
    return this.withDb(async ({ db }) => {
      const colData = `COALESCE(
        NULLIF(data_distribuicao_ajuizamento,''),
        NULLIF(data_evento,''),
        NULLIF(data_recebimento_cobranca_extrajudicial,''),
        NULLIF(data_protocolizacao_cartorio_extrajudicial,''),
        created_at
      )`;
      const colValor = `COALESCE(
        NULLIF(valor, 0),
        NULLIF(valor_dado_causa_ajuizamento, 0),
        0
      )`;
      let anoRef: number;
      if (filtros?.ano && Number(filtros.ano) > 1990) {
        anoRef = Number(filtros.ano);
      } else {
        // Ano de referência default: pegar o ano mais recente DAS LINHAS QUE PASSAM NO WHERE.
        const anoRows = db.exec(`
          SELECT DISTINCT CAST(strftime('%Y', ${colData}) AS INTEGER) AS a
          FROM processos
          ${where.sql ? 'WHERE ' + where.sql : ''}
          ORDER BY a DESC LIMIT 1
        `, where.params as any)[0]?.values || [];
        const ultim = anoRows[0]?.[0];
        anoRef = ultim && Number(ultim) > 1990 ? Number(ultim) : new Date().getFullYear();
      }
      const dataRow = db.exec(`
        SELECT
          strftime('%Y-%m', ${colData}) AS mes,
          CAST(strftime('%m', ${colData}) AS INTEGER) AS m,
          SUM(CASE WHEN (natureza='Ativo' OR (natureza IS NULL AND origem='Cooperativa Ré')) THEN ${colValor} ELSE 0 END) AS ativo,
          SUM(CASE WHEN (natureza='Passivo' OR (natureza IS NULL AND origem='Cooperativa Autora')) THEN ${colValor} ELSE 0 END) AS passivo
        FROM processos
        ${where.sql ? 'WHERE ' + where.sql : ''}
        GROUP BY mes
      `, where.params as any)[0]?.values || [];
      const map = new Map<number, { ativo:number; passivo:number }>();
      for (const r of dataRow) {
        const m = Number(r[1]);
        if (!m || m < 1 || m > 12) continue;
        const atv = Number(r[2]) || 0;
        const pas = Number(r[3]) || 0;
        const prev = map.get(m) || { ativo: 0, passivo: 0 };
        map.set(m, { ativo: prev.ativo + atv, passivo: prev.passivo + pas });
      }
      const out: { mes_ano:string; ativo:number; passivo:number; mes_idx:number }[] = [];
      const pad2 = (n: number) => n.toString().padStart(2, '0');
      for (let m = 1; m <= 12; m++) {
        const d = map.get(m) || { ativo: 0, passivo: 0 };
        out.push({
          mes_ano: `${anoRef}-${pad2(m)}`,
          ativo: d.ativo,
          passivo: d.passivo,
          mes_idx: m,
        });
      }
      return out;
    });
  }

  // ============= Listar / CRUD =============
  async listar(filtros?: FiltrosListagem): Promise<{ total:number; rows:ProcessoJuridico[] }> {
    const where = this.buildWhere(filtros);
    const limit = Math.max(1, Math.min(1000, Number(filtros?.limit ?? 100)));
    const offset = Math.max(0, Number(filtros?.offset ?? 0));
    const order = this.parseOrder(filtros?.order || 'id DESC');
    return this.withDb(async ({ db }) => {
      const total = Number(db.exec(`SELECT COUNT(*) FROM processos ${where.sql ? 'WHERE ' + where.sql : ''}`, where.params as any)[0].values[0][0]) || 0;
      const rs = db.exec(`SELECT * FROM processos ${where.sql ? 'WHERE ' + where.sql : ''} ORDER BY ${order} LIMIT ? OFFSET ?`, [...(where.params as any), limit, offset] as any);
      const rows = (rs[0]?.values || []).map((row) => this.rowToProcesso(rs[0].columns, row));
      return { total, rows };
    });
  }

  async obter(id: number): Promise<ProcessoJuridico | null> {
    return this.withDb(async ({ db }) => {
      const rs = db.exec('SELECT * FROM processos WHERE id = ?', [id] as any);
      const row = rs[0]?.values?.[0];
      return row ? this.rowToProcesso(rs[0].columns, row) : null;
    });
  }

  async criar(input: Partial<ProcessoJuridico>, opts?: { requestedByEmail?: unknown }): Promise<ProcessoJuridico> {
    await jdb.requireJuridicoAdmin(opts?.requestedByEmail);
    return this.withDb(async ({ db, persist }) => {
      const norm = this.normalizarLinha(input, 0);
      if ('erro' in norm) throw new Error(norm.erro);
      const pRaw = norm.row as Record<string, any>;
      // Remove undefined para evitar "bind unknown type" do SQLite
      const p: Record<string, any> = {};
      for (const k of Object.keys(pRaw)) {
        const v = pRaw[k];
        if (v === undefined) continue;
        p[k] = v == null ? null : v;
      }
      const cols = Object.keys(p).filter((k) => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
      const placeholders = cols.map(() => '?').join(',');
      const values = cols.map((c) => p[c]);
      db.run(`INSERT INTO processos (${cols.join(',')}) VALUES (${placeholders})`, values as any);
      const id = Number(db.exec('SELECT last_insert_rowid()')[0].values[0][0]) || 0;
      persist();
      const criado = (await this.obter(id))!;
      // Disparo NÃO bloqueante de e-mail automático (Escritório de Cobrança — Notificações > Cobrança)
      Promise.resolve()
        .then(() => jdb.notificarNovoProcessoCobranca(criado as any))
        .then((r) => {
          if (r?.enviado) {
            console.info(
              `[juridico:notif-cobranca] id=${criado?.id} enviado: ${r?.destinatarios?.join(',') || '-'}`,
            );
          } else {
            console.warn(
              `[juridico:notif-cobranca] id=${criado?.id} não enviado: ${r?.mensagem || '-'} (destinatarios: ${r?.destinatarios?.join(',') || 'nenhum'})`,
            );
          }
        })
        .catch((e) => console.error(`[juridico:notif-cobranca] id=${criado?.id} hook falhou:`, e?.message || e));
      return criado;
    });
  }

  async atualizar(id: number, input: Partial<ProcessoJuridico>, opts?: { requestedByEmail?: unknown }): Promise<ProcessoJuridico> {
    await jdb.requireJuridicoAdmin(opts?.requestedByEmail);
    return this.withDb(async ({ db, persist }) => {
      // Primeiro obtemos o estado ATUAL do registro (para preservar campos não enviados no body parcial!)
      const curRs = db.exec('SELECT * FROM processos WHERE id = ?', [id] as any);
      const curRowRaw = curRs[0]?.values?.[0];
      const curCols = curRs[0]?.columns ?? [];
      const current: Record<string, any> = {};
      if (curRowRaw) {
        for (let i = 0; i < curCols.length; i++) current[curCols[i]] = curRowRaw[i];
      }
      // Merge: input SÓ PREENCHE os campos que o usuário enviou (chave existe em input && valor !== undefined).
      // Campos ausentes no body → mantém o valor atual do DB (isso evita sobrescrever com 0/null!)
      const merged: Record<string, any> = { ...current };
      const inObj = (input ?? {}) as Record<string, any>;
      for (const k of Object.keys(inObj)) {
        const v = inObj[k];
        if (v === undefined) continue;
        merged[k] = v == null ? null : v;
      }
      const norm = this.normalizarLinha(merged, 0);
      if ('erro' in norm) throw new Error(norm.erro);
      const pRaw = norm.row as Record<string, any>;
      const p: Record<string, any> = {};
      for (const k of Object.keys(pRaw)) {
        const v = pRaw[k];
        if (v === undefined) continue;
        p[k] = v == null ? null : v;
      }
      p.updated_at = this.isoNow();
      const keys = Object.keys(p).filter((k) => k !== 'id' && k !== 'created_at');
      const sets = keys.map((k) => `${k}=?`).join(',');
      const vals = keys.map((k) => p[k]);
      if (sets.length) {
        db.run(`UPDATE processos SET ${sets} WHERE id=?`, [...vals, id] as any);
      }
      persist();
      return (await this.obter(id))!;
    });
  }

  async excluir(id: number, opts?: { requestedByEmail?: unknown }): Promise<{ ok: boolean; id: number }> {
    await jdb.requireJuridicoAdmin(opts?.requestedByEmail);
    return this.withDb(async ({ db, persist }) => {
      db.run('DELETE FROM processos WHERE id=?', [id] as any);
      persist();
      return { ok: true, id };
    });
  }

  async anosDisponiveis(): Promise<number[]> {
    return this.withDb(async ({ db }) => {
      const r = db.exec(`SELECT DISTINCT CAST(strftime('%Y', COALESCE(
        NULLIF(data_distribuicao_ajuizamento,''), NULLIF(data_evento,''),
        NULLIF(data_recebimento_cobranca_extrajudicial,''), NULLIF(data_protocolizacao_cartorio_extrajudicial,''),
        created_at)) AS INTEGER) AS a FROM processos ORDER BY a DESC`);
      return (r[0]?.values ?? []).map((x) => Number(x[0])).filter((n) => Number.isFinite(n) && n > 1990);
    });
  }

  async origensDisponiveis(): Promise<string[]> {
    return this.withDb(async ({ db }) => {
      const r = db.exec("SELECT DISTINCT origem FROM processos WHERE origem IS NOT NULL ORDER BY origem");
      return (r[0]?.values ?? []).map((x) => String(x[0] ?? '')).filter(Boolean);
    });
  }

  async truncateProcessos(opts?: { requestedByEmail?: unknown }): Promise<{ removidos: number }> {
    await jdb.requireJuridicoAdmin(opts?.requestedByEmail);
    return this.withDb(async ({ db, persist }) => {
      const before = Number(db.exec('SELECT COUNT(*) FROM processos')[0].values[0][0]) || 0;
      db.exec('DELETE FROM processos');
      db.exec("DELETE FROM sqlite_sequence WHERE name='processos'");
      persist();
      return { removidos: Number(before) || 0 };
    });
  }

  // ============= IMPORTAÇÃO EM MASSA =============
  async importarProcessosEmMassa(
    rows: any[],
    opcoes?: { substituir?: boolean; origem_importacao?: string; dedupHash?: boolean; requestedByEmail?: unknown }
  ): Promise<{ total_lidos: number; importados: number; ignorados: number; atualizados: number; erros: string[]; truncate_executado: boolean }> {
    await jdb.requireJuridicoAdmin(opcoes?.requestedByEmail);
    const erros: string[] = [];
    const normalizados = ((rows || []) as Record<string, any>[]).map((r, i) => this.normalizarLinha(r, i));
    const validos = normalizados.filter((x) => {
      if (x != null && typeof x === 'object' && 'erro' in x && typeof (x as any).erro === 'string') {
        erros.push(String((x as any).erro));
        return false;
      }
      return true;
    }) as { row: Partial<ProcessoJuridico>; hash?: string }[];

    return this.withDb(async ({ db, persist }) => {
      // Colunas novas + colunas compat (mapeamento)
      const colsOriginais = [
        'origem','numero_contrato_sicoob','numero_processo_ajuizamento','valor_dado_causa_ajuizamento',
        'data_distribuicao_ajuizamento','probabilidade_ganho_ajuizamento','probabilidade_perda_ajuizamento',
        'valor_estimado_perda_ajuizamento','tipo_acao_ajuizamento','origem_processo_1grau_ajuizamento',
        'processos_vinculados_ajuizamento','status_ultimo_andamento_ajuizamento',
        'data_ultimo_andamento_ajuizamento','data_recebimento_cobranca_extrajudicial','status_extrajudicial',
        'matricula_extrajudicial','numero_protocolo_cartorio_extrajudicial','cartorio_extrajudicial',
        'data_protocolizacao_cartorio_extrajudicial','data_ultima_etapa_extrajudicial','observacoes_extrajudicial',
        'data_limite_protocolar_extrajudicial',
        'autor_1_nome','autor_1_cpf_cnpj','autor_2_nome','autor_2_cpf_cnpj','autor_3_nome','autor_3_cpf_cnpj',
        'autor_4_nome','autor_4_cpf_cnpj','autor_5_nome','autor_5_cpf_cnpj','autor_6_nome','autor_6_cpf_cnpj',
        'reu_1_nome','reu_1_cpf_cnpj','reu_2_nome','reu_2_cpf_cnpj','reu_3_nome','reu_3_cpf_cnpj',
        'reu_4_nome','reu_4_cpf_cnpj','reu_5_nome','reu_5_cpf_cnpj','reu_6_nome','reu_6_cpf_cnpj',
        'honorarios_realizados','custas_processuais_extrajudiciais','numero_pa_enviados_ajuizamento',
        'gerente','serasa_enviados_juridico',
        'data_prescricao_3anos_enviados_ajuizamento','data_prescricao_5anos_enviados_ajuizamento',
        'data_limite_ajuizamento',
        'status','natureza','valor','custas_honorarios','observacoes',
        'contrato_sicoob','numero_processo','autores','reus','data_evento',
        'origem_importacao','row_hash','updated_at'
      ];
      const allCols = [...new Set(colsOriginais)];

      let truncateExecutado = false;
      if (opcoes?.substituir) {
        db.exec('DELETE FROM processos');
        try { db.exec("DELETE FROM sqlite_sequence WHERE name='processos'"); } catch {}
        truncateExecutado = true;
      }

      const dedup = Boolean(opcoes?.dedupHash ?? true);
      const origemImp = opcoes?.origem_importacao || 'api/importar/json';
      const insCols = allCols.filter((c) => c !== 'id' && c !== 'created_at');
      const placeholders = insCols.map(() => '?').join(',');
      const stmt = db.prepare(`INSERT INTO processos (${insCols.join(',')}) VALUES (${placeholders})`);
      const stmtUpd = db.prepare(`UPDATE processos SET ${insCols.map((c)=>c+'=?').join(',')} WHERE row_hash=?`);
      let importados = 0, ignorados = 0, atualizados = 0;
      try {
        for (const item of validos) {
          try {
            const rec: Record<string, any> = { ...(item.row as any) };
            rec.origem_importacao = origemImp;
            rec.updated_at = this.isoNow();
            if (item.hash && dedup) rec.row_hash = item.hash;
            else rec.row_hash = this.rowHash(rec);
            const vals = insCols.map((c) => (rec as any)[c] ?? null);
            try {
              stmt.run(vals as any[]);
              importados++;
            } catch (eIns: any) {
              const isDupConstraint = /(UNIQUE|unique).*row_hash/i.test(String(eIns?.message || eIns));
              if (isDupConstraint && dedup) {
                stmtUpd.run([...vals, rec.row_hash] as any[]);
                atualizados++;
              } else {
                ignorados++;
                if (erros.length < 80) erros.push(`linha ${importados + ignorados + atualizados}: ${String(eIns?.message || eIns)}`);
              }
            }
          } catch (e: any) {
            ignorados++;
            if (erros.length < 80) erros.push(`linha ${importados + ignorados + atualizados}: ${String(e?.message || e)}`);
          }
        }
      } finally {
        try { stmt.free(); } catch {}
        try { stmtUpd.free(); } catch {}
      }
      persist();
      return {
        total_lidos: (rows || []).length,
        importados, ignorados, atualizados, erros,
        truncate_executado: truncateExecutado,
      };
    });
  }

  // ============= CSV export =============
  async csv(filtros?: FiltrosListagem) { return this.csvExport(filtros); }

  async csvExport(filtros?: FiltrosListagem): Promise<string> {
    const list = await this.listar({ ...(filtros || {}), limit: 100000, offset: 0 });
    const headers = [
      'id','origem','numero_contrato_sicoob','numero_processo_ajuizamento','valor_dado_causa_ajuizamento',
      'data_distribuicao_ajuizamento','probabilidade_ganho_ajuizamento','probabilidade_perda_ajuizamento',
      'valor_estimado_perda_ajuizamento','tipo_acao_ajuizamento','origem_processo_1grau_ajuizamento',
      'processos_vinculados_ajuizamento','status_ultimo_andamento_ajuizamento',
      'data_ultimo_andamento_ajuizamento','data_recebimento_cobranca_extrajudicial','status_extrajudicial',
      'matricula_extrajudicial','numero_protocolo_cartorio_extrajudicial','cartorio_extrajudicial',
      'data_protocolizacao_cartorio_extrajudicial','data_ultima_etapa_extrajudicial','observacoes_extrajudicial',
      'data_limite_protocolar_extrajudicial',
      'autor_1_nome','autor_1_cpf_cnpj','reu_1_nome','reu_1_cpf_cnpj',
      'honorarios_realizados','custas_processuais_extrajudiciais','gerente','serasa_enviados_juridico',
      'data_limite_ajuizamento','status','natureza','created_at','updated_at'
    ];
    const lines = [headers.join(';')];
    for (const r of list.rows) {
      const row: any = r;
      lines.push(headers.map((h) => this.escapeCsv(row[h])).join(';'));
    }
    return '\uFEFF' + lines.join('\n');
  }

  // ============= HELPERS =============
  private isoNow(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const pad3 = (n: number) => String(n).padStart(3, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
  }

  private rowHash(obj: Record<string, any>): string {
    const fields = [
      'origem','numero_contrato_sicoob','numero_processo_ajuizamento','valor_dado_causa_ajuizamento',
      'data_distribuicao_ajuizamento','reu_1_nome','reu_1_cpf_cnpj','autor_1_nome','autor_1_cpf_cnpj',
      'status_ultimo_andamento_ajuizamento','status_extrajudicial','numero_pa_enviados_ajuizamento'
    ];
    const s = fields.map((f) => String((obj as any)[f] ?? '')).join('||');
    return require('node:crypto').createHash('sha1').update(s).digest('hex');
  }

  private buildWhere(f?: FiltrosListagem, opts?: { forAgg?: boolean }) {
    const parts: string[] = []; const params: any[] = [];
    if (!f) return { sql: '', params };
    if (f.ano != null || f.mes != null) {
      const col = `COALESCE(NULLIF(data_distribuicao_ajuizamento,''),NULLIF(data_evento,''),NULLIF(data_recebimento_cobranca_extrajudicial,''),NULLIF(data_protocolizacao_cartorio_extrajudicial,''),created_at)`;
      if (f.ano != null) { parts.push(`CAST(strftime('%Y', ${col}) AS INTEGER) = ?`); params.push(Number(f.ano)); }
      if (f.mes != null) { parts.push(`CAST(strftime('%m', ${col}) AS INTEGER) = ?`); params.push(Number(f.mes)); }
    }
    if (f.origem) { parts.push("origem = ?"); params.push(f.origem); }
    if (f.status) { parts.push("(status=? OR status_ultimo_andamento_ajuizamento=? OR status_extrajudicial=?)"); params.push(f.status, f.status, f.status); }
    if (f.natureza) { parts.push("natureza = ?"); params.push(f.natureza); }
    let buscaSql = '';
    let buscaParams: any[] = [];
    if (f.busca) {
      const like = `%${String(f.busca).replace(/[%_]/g, '\\$&')}%`;
      buscaSql = `(
        numero_contrato_sicoob LIKE ? ESCAPE '\\' OR
        numero_processo_ajuizamento LIKE ? ESCAPE '\\' OR
        COALESCE(numero_processo,'') LIKE ? ESCAPE '\\' OR
        autor_1_nome LIKE ? ESCAPE '\\' OR autor_2_nome LIKE ? ESCAPE '\\' OR
        autor_3_nome LIKE ? ESCAPE '\\' OR autor_4_nome LIKE ? ESCAPE '\\' OR
        autor_5_nome LIKE ? ESCAPE '\\' OR autor_6_nome LIKE ? ESCAPE '\\' OR
        reu_1_nome LIKE ? ESCAPE '\\' OR reu_2_nome LIKE ? ESCAPE '\\' OR
        reu_3_nome LIKE ? ESCAPE '\\' OR reu_4_nome LIKE ? ESCAPE '\\' OR
        reu_5_nome LIKE ? ESCAPE '\\' OR reu_6_nome LIKE ? ESCAPE '\\' OR
        COALESCE(autores,'') LIKE ? ESCAPE '\\' OR COALESCE(reus,'') LIKE ? ESCAPE '\\' OR
        autor_1_cpf_cnpj LIKE ? ESCAPE '\\' OR reu_1_cpf_cnpj LIKE ? ESCAPE '\\'
      )`;
      const qty = (buscaSql.match(/\?/g) || []).length;
      buscaParams = Array(qty).fill(like);
      parts.push(buscaSql);
      for (let i = 0; i < qty; i++) params.push(like);
    }
    if (opts?.forAgg) {
      const aggParts: string[] = [...parts];
      const aggParams: any[] = [...params];
      return { sql: aggParts.join(' AND '), params: aggParams };
    }
    return { sql: parts.join(' AND '), params };
  }

  private parseOrder(o: string): string {
    const allow = ['id','origem','numero_contrato_sicoob','numero_processo_ajuizamento','valor_dado_causa_ajuizamento',
      'data_distribuicao_ajuizamento','status_ultimo_andamento_ajuizamento','data_limite_ajuizamento','created_at'];
    const [col, dir] = o.split(/\s+/);
    if (!allow.includes(col)) return 'id DESC';
    return `${col} ${dir && String(dir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'}`;
  }

  private escapeCsv(v: any): string {
    if (v == null) return '';
    const s = String(v);
    if (/[;"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  /** Mapeia 54 colunas do CSV Padronização + aliases antigos para schema novo. */
  normalizarLinha(r: Record<string, any>, idx: number): { row: any; hash?: string } | { erro: string } {
    if (!r || typeof r !== 'object') return { erro: `linha ${idx + 1}: objeto inválido` };

    const T = (keys: string[], max = 1000): string | undefined => {
      for (const k of keys) {
        const v = (r as any)[k];
        if (v == null) continue;
        const s = typeof v === 'string' ? v : String(v);
        const t = s.trim();
        if (t !== '') return t.length > max ? t.slice(0, max) : t;
      }
      return undefined;
    };
    const N = (keys: string[]): number => {
      for (const k of keys) {
        const v = (r as any)[k];
        if (v == null || v === '') continue;
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        const s = String(v).replace(/\s/g,'').replace(/R\$/gi,'').replace(/\./g,'').replace(',','.');
        const n = Number(s);
        if (Number.isFinite(n)) return n;
      }
      return 0;
    };
    const D = (keys: string[]): string | undefined => {
      const s = T(keys, 40);
      if (!s) return undefined;
      const m = s.match(/^(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})$/);
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const m2 = s.match(/^(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})([ T]\d{1,2}:\d{1,2}(:\d{1,2})?)?$/);
      if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
      return undefined;
    };
    const P = (keys: string[]): number => {
      const s = T(keys, 30);
      if (!s) return 0;
      const clean = s.replace(',','.').replace('%','').replace(/\s/g,'');
      const n = Number(clean);
      if (!Number.isFinite(n)) return 0;
      return n > 1 ? n / 100 : n;
    };

    const origem = T([
      'origem','Origem*','Origem','ORIGEM','Tipo de Origem','origem_tipo'
    ]) || 'Enviado ao Jurídico';

    const autor1 = T([
      'autor_1_nome','Autor(ES)-1*','Autor(ES)-1','Autor-1','autor_1','Autor 1','Autores','autor','Autor(es)','Autor'
    ]);
    const autor1cpf = T([
      'autor_1_cpf_cnpj','CPF/CNPJ Autor(ES)-1*','CPF/CNPJ Autor(ES)-1','Autor-1 CPF/CNPJ'
    ], 40);
    const autor2 = T(['autor_2_nome','Autor(ES)-2','Autor-2','Autor 2']);
    const autor2cpf = T(['autor_2_cpf_cnpj','CPF/CNPJ Autor(ES)-2','Autor-2 CPF/CNPJ'], 40);
    const autor3 = T(['autor_3_nome','Autor(ES)-3','Autor-3','Autor 3']);
    const autor3cpf = T(['autor_3_cpf_cnpj','CPF/CNPJ Autor(ES)-3','Autor-3 CPF/CNPJ'], 40);
    const autor4 = T(['autor_4_nome','Autor(ES)-4','Autor-4','Autor 4']);
    const autor4cpf = T(['autor_4_cpf_cnpj','CPF/CNPJ Autor(ES)-4','Autor-4 CPF/CNPJ'], 40);
    const autor5 = T(['autor_5_nome','Autor(ES)-5','Autor-5','Autor 5']);
    const autor5cpf = T(['autor_5_cpf_cnpj','CPF/CNPJ Autor(ES)-5','Autor-5 CPF/CNPJ'], 40);
    const autor6 = T(['autor_6_nome','Autor(ES)-6','Autor-6','Autor 6']);
    const autor6cpf = T(['autor_6_cpf_cnpj','CPF/CNPJ Autor(ES)-6','Autor-6 CPF/CNPJ'], 40);

    const reu1 = T([
      'reu_1_nome','Réu(s)-1*','Réu(s)-1','Réu 1','Reu(s)-1','Reu-1','Réus','Réu(s)','reu','Réu','Reu'
    ]);
    const reu1cpf = T([
      'reu_1_cpf_cnpj','CPF/CNPJ Réu(s)-1*','CPF/CNPJ Réu(s)-1','Reu(s)-1 CPF/CNPJ'
    ], 40);
    const reu2 = T(['reu_2_nome','Réu(s)-2','Réu-2','Reu(s)-2']);
    const reu2cpf = T(['reu_2_cpf_cnpj','CPF/CNPJ Réu(s)-2','Reu-2 CPF/CNPJ'], 40);
    const reu3 = T(['reu_3_nome','Réu(s)-3','Réu-3','Reu(s)-3']);
    const reu3cpf = T(['reu_3_cpf_cnpj','CPF/CNPJ Réu(s)-3','Reu-3 CPF/CNPJ'], 40);
    const reu4 = T(['reu_4_nome','Réu(s)-4','Réu-4','Reu(s)-4']);
    const reu4cpf = T(['reu_4_cpf_cnpj','CPF/CNPJ Réu(s)-4','Reu-4 CPF/CNPJ'], 40);
    const reu5 = T(['reu_5_nome','Réu(s)-5','Réu-5','Reu(s)-5']);
    const reu5cpf = T(['reu_5_cpf_cnpj','CPF/CNPJ Réu(s)-5','Reu-5 CPF/CNPJ'], 40);
    const reu6 = T(['reu_6_nome','Réu(s)-6','Réu-6','Reu(s)-6']);
    const reu6cpf = T(['reu_6_cpf_cnpj','CPF/CNPJ Réu(s)-6','Reu-6 CPF/CNPJ'], 40);

    const numero_processo_ajuizamento = T([
      'numero_processo_ajuizamento','Número do Processo (ajuizamento)','Número Processo (ajuizamento)','Nº Processo (ajuizamento)','Processo (ajuizamento)','Nº Processo (ajuizamento)'
    ], 160);

    const status_ajuiz = T([
      'status_ultimo_andamento_ajuizamento','Status do Último Andamento - (ajuizamento)','Status do Último Andamento (ajuizamento)','Status Último Andamento (ajuizamento)'
    ], 200);
    const status_extrajud = T([
      'status_extrajudicial','STATUS (extrajudicial)','STATUS extrajudicial','Status Extrajudicial'
    ], 200);
    const statusGeral = (status_ajuiz || status_extrajud || '');

    let natureza: 'Ativo'|'Passivo'|'Extinta'|null = (T(['natureza','Natureza'], 40) as any) || null;
    if (!natureza) {
      if (origem === 'Cooperativa Ré') natureza = 'Ativo';
      else if (origem === 'Cooperativa Autora') natureza = 'Passivo';
      else natureza = null;
    }
    const extintos = ['Extinto','Quitado','Baixado','Arquivado','Finalizado','Acordado','Satisfeito'];
    if (extintos.includes(statusGeral)) natureza = 'Extinta';

    const valorDadoCausa = N([
      'valor_dado_causa_ajuizamento','Valor Dado à Causa (ajuizamento)','Valor da Causa (ajuizamento)','Valor Dado a Causa'
    ]);

    const row: Partial<ProcessoJuridico> = {
      origem,
      numero_contrato_sicoob: T([
        'numero_contrato_sicoob','Número Contrato (s) Sicoob*','Número Contrato(s) Sicoob','Contrato Sicoob','Contrato'
      ], 120),
      numero_processo_ajuizamento,
      valor_dado_causa_ajuizamento: valorDadoCausa,
      data_distribuicao_ajuizamento: D([
        'data_distribuicao_ajuizamento','Data de Distribuição (ajuizamento)','Data Distribuição (ajuizamento)'
      ]),
      probabilidade_ganho_ajuizamento: P([
        'probabilidade_ganho_ajuizamento','Probabilidade de Ganho (ajuizamento)','Prob. Ganho'
      ]),
      probabilidade_perda_ajuizamento: P([
        'probabilidade_perda_ajuizamento','Probabilidade de Perda (ajuizamento)','Prob. Perda'
      ]),
      valor_estimado_perda_ajuizamento: N([
        'valor_estimado_perda_ajuizamento','Valor Estimado de Perda (ajuizamento)','Valor Estimado Perda'
      ]),
      tipo_acao_ajuizamento: T([
        'tipo_acao_ajuizamento','Tipo de Ação (ajuizamento)','Tipo Ação'
      ], 200),
      origem_processo_1grau_ajuizamento: T([
        'origem_processo_1grau_ajuizamento','Origem do Processo 1° Grau (ajuizamento)','Origem 1º Grau'
      ], 200),
      processos_vinculados_ajuizamento: T([
        'processos_vinculados_ajuizamento','Processos Vinculados/Apensos N° (ajuizamento)','Processos Vinculados (ajuizamento)'
      ], 500),
      status_ultimo_andamento_ajuizamento: status_ajuiz,
      data_ultimo_andamento_ajuizamento: D([
        'data_ultimo_andamento_ajuizamento','Data do Último Andamento (ajuizamento)','Data Último Andamento (ajuizamento)'
      ]),
      data_recebimento_cobranca_extrajudicial: D([
        'data_recebimento_cobranca_extrajudicial','Data de Recebimento para Cobrança (Extrajudicial)','Data Recebimento (Extrajudicial)'
      ]),
      status_extrajudicial: status_extrajud,
      matricula_extrajudicial: T([
        'matricula_extrajudicial','Matrícula (extrajudicial)','Matrícula'
      ], 120),
      numero_protocolo_cartorio_extrajudicial: T([
        'numero_protocolo_cartorio_extrajudicial','Número Protocolo do cartório de Títulos e Documentos (extrajudicial)','Protocolo Cartório (extrajudicial)'
      ], 200),
      cartorio_extrajudicial: T([
        'cartorio_extrajudicial','Cartório  (extrajudicial)','Cartório (extrajudicial)','Cartório'
      ], 200),
      data_protocolizacao_cartorio_extrajudicial: D([
        'data_protocolizacao_cartorio_extrajudicial','Data da Protocolização no Cartório (Extrajudicial)','Data Protocolização Cartório'
      ]),
      data_ultima_etapa_extrajudicial: D([
        'data_ultima_etapa_extrajudicial','Data da Última Etapa (Extrajudicial)','Data Última Etapa Extrajudicial'
      ]),
      observacoes_extrajudicial: T([
        'observacoes_extrajudicial','Observações (Extrajudicial)','Observação (Extrajudicial)'
      ], 4000),
      data_limite_protocolar_extrajudicial: D([
        'data_limite_protocolar_extrajudicial','Data Limite para Protocolar Cartório/Correios (Extrajudicial)','Data Limite Protocolar'
      ]),
      autor_1_nome: autor1, autor_1_cpf_cnpj: autor1cpf,
      autor_2_nome: autor2, autor_2_cpf_cnpj: autor2cpf,
      autor_3_nome: autor3, autor_3_cpf_cnpj: autor3cpf,
      autor_4_nome: autor4, autor_4_cpf_cnpj: autor4cpf,
      autor_5_nome: autor5, autor_5_cpf_cnpj: autor5cpf,
      autor_6_nome: autor6, autor_6_cpf_cnpj: autor6cpf,
      reu_1_nome: reu1, reu_1_cpf_cnpj: reu1cpf,
      reu_2_nome: reu2, reu_2_cpf_cnpj: reu2cpf,
      reu_3_nome: reu3, reu_3_cpf_cnpj: reu3cpf,
      reu_4_nome: reu4, reu_4_cpf_cnpj: reu4cpf,
      reu_5_nome: reu5, reu_5_cpf_cnpj: reu5cpf,
      reu_6_nome: reu6, reu_6_cpf_cnpj: reu6cpf,
      honorarios_realizados: N([
        'honorarios_realizados','Honorários (R$) efetivamente já realizados','Honorários Realizados (R$)'
      ]),
      custas_processuais_extrajudiciais: N([
        'custas_processuais_extrajudiciais','Custa Processuais e extrajudiciais (R$)','Custas Processuais (R$)'
      ]),
      numero_pa_enviados_ajuizamento: T([
        'numero_pa_enviados_ajuizamento','Número PA (enviados ao ajuizamento)','Número PA','PA'
      ], 120),
      gerente: T(['gerente','Gerente','GERENTE'], 160),
      serasa_enviados_juridico: T([
        'serasa_enviados_juridico','Serasa (enviados ao jurídico)','Serasa','SERASA'
      ], 200),
      data_prescricao_3anos_enviados_ajuizamento: D([
        'data_prescricao_3anos_enviados_ajuizamento','Data da Prescrição (3 anos) - (enviados ao ajuizamento)','Prescrição 3 anos'
      ]),
      data_prescricao_5anos_enviados_ajuizamento: D([
        'data_prescricao_5anos_enviados_ajuizamento','Data da Prescrição (5 anos) - (enviados ao ajuizamento)','Prescrição 5 anos'
      ]),
      data_limite_ajuizamento: D([
        'data_limite_ajuizamento','Data limite para Ajuizamento','Data Limite Ajuizamento','Data Limite'
      ]),
      origem_importacao: T([
        'origem_importacao','Origem Importação','Fonte Importação','Origem Fonte'
      ], 200),
      status: T(['status','Status'], 200) || statusGeral,
      natureza,
      valor: (() => { const v = N(['valor','Valor','Valor (R$)','Valor Principal']); return Number.isFinite(v) && v !== 0 ? v : valorDadoCausa; })(),
      custas_honorarios: N([
        'custas_honorarios','Custas / Honorários (R$)','Custas Honorários'
      ]),
      observacoes: T(['observacoes','Observações','Observacao','Obs'], 4000),
      contrato_sicoob: T([
        'contrato_sicoob','Número Contrato (s) Sicoob*','Contrato Sicoob','Número Contrato(s) Sicoob'
      ], 120),
      numero_processo: (() => { const v = T(['numero_processo','Número do Processo','Nº Processo','Processo'], 160); return v || numero_processo_ajuizamento; })(),
      autores: [autor1,autor2,autor3,autor4,autor5,autor6].filter(Boolean).join('; '),
      reus: [reu1,reu2,reu3,reu4,reu5,reu6].filter(Boolean).join('; '),
      data_evento:
        D(['data_evento','Data Evento','Data'])
        || D(['data_distribuicao_ajuizamento','Data de Distribuição (ajuizamento)','Data Distribuição (ajuizamento)'])
        || D(['data_recebimento_cobranca_extrajudicial','Data de Recebimento para Cobrança (Extrajudicial)'])
        || D(['data_protocolizacao_cartorio_extrajudicial','Data da Protocolização no Cartório (Extrajudicial)']),
    };

    // Linha totalmente vazia? ignorar
    const temConteudo = Object.values(row).some((v) => {
      if (v == null) return false;
      if (typeof v === 'number') return v !== 0;
      return String(v).trim() !== '';
    });
    if (!temConteudo) return { erro: `linha ${idx + 1}: vazia (ignorada)` };
    return { row };
  }

  private rowToProcesso(cols: string[], values: any[]): ProcessoJuridico {
    const obj: Record<string, any> = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = values[i];
    return obj as ProcessoJuridico;
  }
}
