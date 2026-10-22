import initSqlJs, { Database } from 'sql.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

let _sqlPromise: Promise<initSqlJs.SqlJsStatic> | null = null;

export function getJuridicoDbFilePath(): string {
  if (process.env.JURIDICO_DB_PATH) return process.env.JURIDICO_DB_PATH;
  return path.resolve(process.cwd(), 'data', 'juridico.sqlite');
}

export async function openJuridicoDatabase(): Promise<{ sql: initSqlJs.SqlJsStatic; db: initSqlJs.Database; persist: () => void }> {
  if (!_sqlPromise) {
    _sqlPromise = initSqlJs({
      locateFile: (file: string) => {
        const candidates = [
          path.resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
          path.resolve(process.cwd(), '..', 'node_modules', 'sql.js', 'dist', file),
          file,
        ];
        for (const c of candidates) {
          if (fs.existsSync(c)) return c;
        }
        return candidates[0];
      },
    });
  }
  const sql = await _sqlPromise;
  const dbFile = getJuridicoDbFilePath();
  let db: Database;
  try {
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    const raw = fs.existsSync(dbFile) ? fs.readFileSync(dbFile) : null;
    if (raw && raw.length > 0) {
      try {
        db = new sql.Database(raw);
      } catch (e) {
        console.warn('[juridico.db] Arquivo existe mas falhou ao abrir (corrompido?). Backup + recriar:', e);
        try {
          const bkp = dbFile + '.BAK_CORROMPIDO_' + Date.now() + '.sqlite';
          fs.copyFileSync(dbFile, bkp);
        } catch {}
        db = new sql.Database();
      }
    } else {
      db = new sql.Database();
    }
  } catch {
    db = new sql.Database();
  }

  ensureSchema54(db);

  // Seed demo apenas quando NÃO houver nenhuma linha E NÃO existir arquivo físico (não sobreescrever dados)
  let rowCount = 0;
  try { rowCount = Number(db.exec('SELECT COUNT(*) FROM processos')[0].values[0][0]) || 0; } catch {}
  if (rowCount === 0 && !fs.existsSync(dbFile)) {
    seedDemo54(db);
  }

  const persist = () => {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      const tmp = dbFile + '.tmp_' + crypto.randomBytes(6).toString('hex');
      fs.writeFileSync(tmp, buffer);
      fs.renameSync(tmp, dbFile);
    } catch (e) {
      console.error('[juridico.db] persist FALHOU:', e);
      throw e;
    }
  };
  return { sql, db, persist };
}

export function ensureSchema54(db: Database): void {
  // Schema 54 colunas IDÊNTICO ao CSV Padronização da Planilha_Nova.CSV (54 colunas header)
  // + colunas de controle (id, created_at, updated_at, origem_importacao, row_hash)
  db.exec(`CREATE TABLE IF NOT EXISTS processos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- [00] Origem*
    origem TEXT,
    -- [01] Número Contrato (s) Sicoob*
    numero_contrato_sicoob TEXT,
    -- [02] Número do Processo (ajuizamento)
    numero_processo_ajuizamento TEXT,
    -- [03] Valor Dado à Causa (ajuizamento)
    valor_dado_causa_ajuizamento REAL DEFAULT 0,
    -- [04] Data de Distribuição (ajuizamento)
    data_distribuicao_ajuizamento TEXT,
    -- [05] Probabilidade de Ganho (ajuizamento)
    probabilidade_ganho_ajuizamento REAL DEFAULT 0,
    -- [06] Probabilidade de Perda (ajuizamento)
    probabilidade_perda_ajuizamento REAL DEFAULT 0,
    -- [07] Valor Estimado de Perda (ajuizamento)
    valor_estimado_perda_ajuizamento REAL DEFAULT 0,
    -- [08] Tipo de Ação (ajuizamento)
    tipo_acao_ajuizamento TEXT,
    -- [09] Origem do Processo 1º Grau (ajuizamento)
    origem_processo_1grau_ajuizamento TEXT,
    -- [10] Processos Vinculados/Apensos Nº (ajuizamento)
    processos_vinculados_ajuizamento TEXT,
    -- [11] Status do Último Andamento - (ajuizamento)
    status_ultimo_andamento_ajuizamento TEXT,
    -- [12] Data do Último Andamento (ajuizamento)
    data_ultimo_andamento_ajuizamento TEXT,
    -- [13] Data de Recebimento para Cobrança (Extrajudicial)
    data_recebimento_cobranca_extrajudicial TEXT,
    -- [14] STATUS (extrajudicial)
    status_extrajudicial TEXT,
    -- [15] Matrícula (extrajudicial)
    matricula_extrajudicial TEXT,
    -- [16] Número Protocolo do cartório de Títulos e Documentos (extrajudicial)
    numero_protocolo_cartorio_extrajudicial TEXT,
    -- [17] Cartório  (extrajudicial)
    cartorio_extrajudicial TEXT,
    -- [18] Data da Protocolização no Cartório (Extrajudicial)
    data_protocolizacao_cartorio_extrajudicial TEXT,
    -- [19] Data da Última Etapa (Extrajudicial)
    data_ultima_etapa_extrajudicial TEXT,
    -- [20] Observações (Extrajudicial)
    observacoes_extrajudicial TEXT,
    -- [21] Data Limite para Protocolar Cartório/Correios (Extrajudicial)
    data_limite_protocolar_extrajudicial TEXT,
    -- [22-33] Autor(ES)-N + CPF/CNPJ (6 pares)
    autor_1_nome TEXT, autor_1_cpf_cnpj TEXT,
    autor_2_nome TEXT, autor_2_cpf_cnpj TEXT,
    autor_3_nome TEXT, autor_3_cpf_cnpj TEXT,
    autor_4_nome TEXT, autor_4_cpf_cnpj TEXT,
    autor_5_nome TEXT, autor_5_cpf_cnpj TEXT,
    autor_6_nome TEXT, autor_6_cpf_cnpj TEXT,
    -- [34-45] Réu(s)-N + CPF/CNPJ (6 pares)
    reu_1_nome TEXT, reu_1_cpf_cnpj TEXT,
    reu_2_nome TEXT, reu_2_cpf_cnpj TEXT,
    reu_3_nome TEXT, reu_3_cpf_cnpj TEXT,
    reu_4_nome TEXT, reu_4_cpf_cnpj TEXT,
    reu_5_nome TEXT, reu_5_cpf_cnpj TEXT,
    reu_6_nome TEXT, reu_6_cpf_cnpj TEXT,
    -- [46] Honorários (R$) efetivamente já realizados
    honorarios_realizados REAL DEFAULT 0,
    -- [47] Custa Processuais e extrajudiciais (R$)
    custas_processuais_extrajudiciais REAL DEFAULT 0,
    -- [48] Número PA (enviados ao ajuizamento)
    numero_pa_enviados_ajuizamento TEXT,
    -- [49] Gerente
    gerente TEXT,
    -- [50] Serasa (enviados ao jurídico)
    serasa_enviados_juridico TEXT,
    -- [51] Data da Prescrição (3 anos) - (enviados ao ajuizamento)
    data_prescricao_3anos_enviados_ajuizamento TEXT,
    -- [52] Data da Prescrição (5 anos) - (enviados ao ajuizamento)
    data_prescricao_5anos_enviados_ajuizamento TEXT,
    -- [53] Data limite para Ajuizamento
    data_limite_ajuizamento TEXT,
    --
    -- Colunas de controle do módulo
    status TEXT,
    natureza TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now')),
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now')),
    origem_importacao TEXT,
    row_hash TEXT UNIQUE
  ) STRICT;`);

  // Upgrade de schema: se tabela existia com 14 colunas antigas, adicionar faltantes
  try {
    const cols = (db.exec("PRAGMA table_info('processos')")[0]?.values || []).map((r: any) => String(r[1] || ''));
    const want = [
      'numero_contrato_sicoob','numero_processo_ajuizamento','valor_dado_causa_ajuizamento','data_distribuicao_ajuizamento',
      'probabilidade_ganho_ajuizamento','probabilidade_perda_ajuizamento','valor_estimado_perda_ajuizamento','tipo_acao_ajuizamento',
      'origem_processo_1grau_ajuizamento','processos_vinculados_ajuizamento','status_ultimo_andamento_ajuizamento',
      'data_ultimo_andamento_ajuizamento','data_recebimento_cobranca_extrajudicial','status_extrajudicial','matricula_extrajudicial',
      'numero_protocolo_cartorio_extrajudicial','cartorio_extrajudicial','data_protocolizacao_cartorio_extrajudicial',
      'data_ultima_etapa_extrajudicial','observacoes_extrajudicial','data_limite_protocolar_extrajudicial',
      'autor_1_nome','autor_1_cpf_cnpj','autor_2_nome','autor_2_cpf_cnpj','autor_3_nome','autor_3_cpf_cnpj',
      'autor_4_nome','autor_4_cpf_cnpj','autor_5_nome','autor_5_cpf_cnpj','autor_6_nome','autor_6_cpf_cnpj',
      'reu_1_nome','reu_1_cpf_cnpj','reu_2_nome','reu_2_cpf_cnpj','reu_3_nome','reu_3_cpf_cnpj',
      'reu_4_nome','reu_4_cpf_cnpj','reu_5_nome','reu_5_cpf_cnpj','reu_6_nome','reu_6_cpf_cnpj',
      'honorarios_realizados','custas_processuais_extrajudiciais','numero_pa_enviados_ajuizamento','gerente',
      'serasa_enviados_juridico','data_prescricao_3anos_enviados_ajuizamento','data_prescricao_5anos_enviados_ajuizamento',
      'data_limite_ajuizamento','origem_importacao','row_hash'
    ];
    for (const c of want) {
      if (!cols.includes(c)) {
        let type = 'TEXT';
        if (c.includes('valor') || c.includes('probabilidade') || c === 'honorarios_realizados' || c === 'custas_processuais_extrajudiciais') type = 'REAL DEFAULT 0';
        db.exec(`ALTER TABLE processos ADD COLUMN ${c} ${type}`);
      }
    }
  } catch (e) {
    // STRICT table não existe nas versoes antigas do sql.js; falha de ALTER por coluna já existente = ignorar
  }

  const idx = [
    ['idx_proc_origem', 'processos(origem)'],
    ['idx_proc_status', 'processos(status)'],
    ['idx_proc_natureza', 'processos(natureza)'],
    ['idx_proc_contrato', 'processos(numero_contrato_sicoob)'],
    ['idx_proc_nprocesso', 'processos(numero_processo_ajuizamento)'],
    ['idx_proc_reu1', 'processos(reu_1_nome)'],
    ['idx_proc_reu1cpf', 'processos(reu_1_cpf_cnpj)'],
    ['idx_proc_hash', 'processos(row_hash)'],
    ['idx_proc_dataajuiz', 'processos(data_limite_ajuizamento)'],
  ];
  for (const [name, expr] of idx) {
    try { db.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${expr}`); } catch {}
  }

  // --- RBAC JURÍDICO (ACESSOS SEPARADOS DO MÓDULO CRÉDITO) ---
  db.exec(`CREATE TABLE IF NOT EXISTS juridico_access_emails (
    email TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'usuario',
    menu_permissions_json TEXT DEFAULT '[]',
    flow_stage_permissions_json TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now'))
  );`);
  try {
    const colsAccess = (db.exec("PRAGMA table_info('juridico_access_emails')")[0]?.values || []).map((r: any) => String(r[1] || ''));
    const addIfMissing = (col: string, ddl: string) => {
      if (!colsAccess.includes(col)) {
        try { db.exec(`ALTER TABLE juridico_access_emails ADD COLUMN ${col} ${ddl}`); } catch {}
      }
    };
    addIfMissing('role', "TEXT NOT NULL DEFAULT 'usuario'");
    addIfMissing('menu_permissions_json', "TEXT DEFAULT '[]'");
    addIfMissing('flow_stage_permissions_json', "TEXT DEFAULT '[]'");
    addIfMissing('created_at', "TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now'))");
  } catch {}
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_jur_access_role ON juridico_access_emails(role);`);
  } catch {}

  // --- CONFIGURAÇÕES GERAIS DO MÓDULO JURÍDICO (KV store) ---
  db.exec(`CREATE TABLE IF NOT EXISTS juridico_app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`);

  // --- ACORDOS (tabela separada, 1 acordo por processo) ---
  db.exec(`CREATE TABLE IF NOT EXISTS juridico_acordos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    processo_id INTEGER NOT NULL,
    devedor TEXT,
    numero_processo_ou_extrajudicial TEXT,
    titulos_objeto_cobranca TEXT,
    total_parcelas INTEGER DEFAULT 0,
    valor_parcela REAL DEFAULT 0,
    numero_parcela INTEGER DEFAULT 0,
    forma_pagamento TEXT,
    confirmacao_pagamento TEXT,
    observacoes TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now')),
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now')),
    FOREIGN KEY (processo_id) REFERENCES processos(id) ON DELETE CASCADE,
    UNIQUE(processo_id)
  );`);
  try {
    const colsAcordo = (db.exec("PRAGMA table_info('juridico_acordos')")[0]?.values || []).map((r: any) => String(r[1] || ''));
    const addCol = (col: string, ddl: string) => {
      if (!colsAcordo.includes(col)) { try { db.exec(`ALTER TABLE juridico_acordos ADD COLUMN ${col} ${ddl}`); } catch {} }
    };
    addCol('processo_id', 'INTEGER NOT NULL');
    addCol('devedor', 'TEXT');
    addCol('numero_processo_ou_extrajudicial', 'TEXT');
    addCol('titulos_objeto_cobranca', 'TEXT');
    addCol('total_parcelas', 'INTEGER DEFAULT 0');
    addCol('valor_parcela', 'REAL DEFAULT 0');
    addCol('numero_parcela', 'INTEGER DEFAULT 0');
    addCol('forma_pagamento', 'TEXT');
    addCol('confirmacao_pagamento', 'TEXT');
    addCol('observacoes', 'TEXT');
    addCol('created_at', "TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now'))");
    addCol('updated_at', "TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now'))");
  } catch {}
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_acordos_processo ON juridico_acordos(processo_id);`);
  } catch {}
}

export const JURIDICO_CONFIG_KEY_NOTIFICACOES_ESCRITORIO = 'notificacoes:escritorio_juridico:emails';
export const JURIDICO_CONFIG_KEY_NOTIFICACOES_COBRANCA = 'notificacoes:cobranca:emails';
export const JURIDICO_CONFIG_KEY_PRAZO_PROTOCOLO_EXTRAJ = 'regras:prazos:protocolo_extrajudicial:dias';
export const JURIDICO_CONFIG_KEY_PRAZO_AJUIZAMENTO = 'regras:prazos:ajuizamento:dias';
export const JURIDICO_CONFIG_KEY_CADASTRO_GERENTES = 'cadastro:gerentes:pares';
export const JURIDICO_CONFIG_KEY_TIPO_ACOES_COLUNAS_PREFIX = 'ui:tipo_acoes:colunas:';

export const DEFAULT_PRAZO_PROTOCOLO_EXTRAJ = 15;
export const DEFAULT_PRAZO_AJUIZAMENTO = 45;

export interface JuridicoNotificacoesConfig {
  escritorioJuridico: string[];
  cobranca: string[];
}

export interface JuridicoRegrasPrazosConfig {
  prazoProtocoloExtrajudicialDias: number;
  prazoAjuizamentoDias: number;
}

export interface JuridicoGerenteCadastro {
  nome: string;
  pa: string;
}

export interface JuridicoTipoAcoesColumnWidths {
  origem: number;
  autor: number;
  reu: number;
  contrato: number;
  processo: number;
  status: number;
  natureza: number;
  valor: number;
}

export interface JuridicoTipoAcoesColumnWidthsConfig {
  widths: JuridicoTipoAcoesColumnWidths;
  customized: boolean;
}

const JURIDICO_TIPO_ACOES_COLUNAS_DEFAULT: JuridicoTipoAcoesColumnWidths = {
  origem: 148,
  autor: 128,
  reu: 248,
  contrato: 126,
  processo: 192,
  status: 168,
  natureza: 162,
  valor: 118,
};

const JURIDICO_TIPO_ACOES_COLUNAS_MIN: JuridicoTipoAcoesColumnWidths = {
  origem: 120,
  autor: 110,
  reu: 140,
  contrato: 110,
  processo: 160,
  status: 140,
  natureza: 142,
  valor: 100,
};

function _tipoAcoesColunasConfigKey(email: string): string {
  return `${JURIDICO_CONFIG_KEY_TIPO_ACOES_COLUNAS_PREFIX}${email}`;
}

function _clampTipoAcoesColuna(key: keyof JuridicoTipoAcoesColumnWidths, value: unknown): number {
  const n = Math.round(Number(value));
  const fallback = JURIDICO_TIPO_ACOES_COLUNAS_DEFAULT[key];
  if (!Number.isFinite(n)) return fallback;
  return Math.max(JURIDICO_TIPO_ACOES_COLUNAS_MIN[key], Math.min(420, n));
}

function _parseTipoAcoesColumnWidths(raw: unknown): JuridicoTipoAcoesColumnWidths {
  let parsed: any = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  }
  const source = parsed && typeof parsed === 'object' ? parsed : {};
  return {
    origem: _clampTipoAcoesColuna('origem', source.origem),
    autor: _clampTipoAcoesColuna('autor', source.autor),
    reu: _clampTipoAcoesColuna('reu', source.reu),
    contrato: _clampTipoAcoesColuna('contrato', source.contrato),
    processo: _clampTipoAcoesColuna('processo', source.processo),
    status: _clampTipoAcoesColuna('status', source.status),
    natureza: _clampTipoAcoesColuna('natureza', source.natureza),
    valor: _clampTipoAcoesColuna('valor', source.valor),
  };
}

function _tableExists(db: Database, name: string): boolean {
  try {
    const r = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [name] as any);
    return Boolean(r?.[0]?.values?.length);
  } catch {
    return false;
  }
}

export function getJuridicoAppConfigValue(db: Database, key: string): string | null {
  if (!_tableExists(db, 'juridico_app_config')) return null;
  const stmt = db.prepare(`SELECT value FROM juridico_app_config WHERE key=? LIMIT 1;`);
  try {
    stmt.bind([key]);
    if (!stmt.step()) return null;
    const row = stmt.getAsObject() as { value?: unknown };
    const value = typeof row.value === 'string' ? row.value : '';
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  } finally {
    stmt.free();
  }
}

export function setJuridicoAppConfigValue(
  db: Database,
  key: string,
  value: string | null,
) {
  const normalizedKey = key.trim();
  if (!normalizedKey) throw new Error('Chave de configuração inválida.');
  const updatedAt = new Date().toISOString();
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    const stmt = db.prepare(`DELETE FROM juridico_app_config WHERE key=?;`);
    try { stmt.run([normalizedKey]); } finally { stmt.free(); }
    return;
  }
  const stmt = db.prepare(
    `INSERT INTO juridico_app_config (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;`,
  );
  try { stmt.run([normalizedKey, trimmed, updatedAt]); } finally { stmt.free(); }
}

function _parseEmailList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((e) => String(e ?? '').trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return _parseEmailList(parsed);
    } catch {
      return raw
        .split(/[,;]/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    }
  }
  return [];
}

export async function getJuridicoNotificacoesConfig(): Promise<JuridicoNotificacoesConfig> {
  return withJuridicoDbInternal(({ db }) => {
    const escritorioRaw = getJuridicoAppConfigValue(db, JURIDICO_CONFIG_KEY_NOTIFICACOES_ESCRITORIO);
    const cobrancaRaw = getJuridicoAppConfigValue(db, JURIDICO_CONFIG_KEY_NOTIFICACOES_COBRANCA);
    return {
      escritorioJuridico: _parseEmailList(escritorioRaw),
      cobranca: _parseEmailList(cobrancaRaw),
    };
  });
}

export async function setJuridicoNotificacoesConfig(input: {
  escritorioJuridico?: unknown;
  cobranca?: unknown;
  requestedByEmail: unknown;
}): Promise<JuridicoNotificacoesConfig> {
  await requireJuridicoAdmin(input.requestedByEmail);
  const escritorioList = _parseEmailList(input?.escritorioJuridico);
  const cobrancaList = _parseEmailList(input?.cobranca);
  await withJuridicoDbInternal(({ db, persist }) => {
    setJuridicoAppConfigValue(
      db,
      JURIDICO_CONFIG_KEY_NOTIFICACOES_ESCRITORIO,
      escritorioList.length ? JSON.stringify(escritorioList) : null,
    );
    setJuridicoAppConfigValue(
      db,
      JURIDICO_CONFIG_KEY_NOTIFICACOES_COBRANCA,
      cobrancaList.length ? JSON.stringify(cobrancaList) : null,
    );
    persist();
  });
  return { escritorioJuridico: escritorioList, cobranca: cobrancaList };
}

function _parseDias(valueRaw: string | null, fallbackPadrao: number): number {
  if (valueRaw === null || valueRaw === undefined) return fallbackPadrao;
  const trimmed = String(valueRaw).trim();
  if (!trimmed) return fallbackPadrao;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return fallbackPadrao;
  return Math.floor(n);
}

export async function getJuridicoRegrasPrazosConfig(): Promise<JuridicoRegrasPrazosConfig> {
  return withJuridicoDbInternal(({ db }) => {
    const protocoloRaw = getJuridicoAppConfigValue(db, JURIDICO_CONFIG_KEY_PRAZO_PROTOCOLO_EXTRAJ);
    const ajuizamentoRaw = getJuridicoAppConfigValue(db, JURIDICO_CONFIG_KEY_PRAZO_AJUIZAMENTO);
    return {
      prazoProtocoloExtrajudicialDias: _parseDias(protocoloRaw, DEFAULT_PRAZO_PROTOCOLO_EXTRAJ),
      prazoAjuizamentoDias: _parseDias(ajuizamentoRaw, DEFAULT_PRAZO_AJUIZAMENTO),
    };
  });
}

export async function getJuridicoTipoAcoesColumnWidths(requestedByEmail: unknown): Promise<JuridicoTipoAcoesColumnWidthsConfig> {
  const by = juridicoNormalizeEmail(requestedByEmail);
  if (!by) throw new JuridicoForbiddenError('E-mail solicitante não informado.');
  if (!(await hasJuridicoAccess(by))) {
    throw new JuridicoForbiddenError('Acesso ao Módulo Jurídico não identificado para este usuário.');
  }
  return withJuridicoDbInternal(({ db }) => {
    const raw = getJuridicoAppConfigValue(db, _tipoAcoesColunasConfigKey(by));
    return {
      widths: _parseTipoAcoesColumnWidths(raw),
      customized: Boolean(raw),
    };
  });
}

export async function setJuridicoTipoAcoesColumnWidths(input: {
  requestedByEmail: unknown;
  widths?: unknown;
  reset?: unknown;
}): Promise<JuridicoTipoAcoesColumnWidthsConfig> {
  const by = juridicoNormalizeEmail(input?.requestedByEmail);
  if (!by) throw new JuridicoForbiddenError('E-mail solicitante não informado.');
  if (!(await hasJuridicoAccess(by))) {
    throw new JuridicoForbiddenError('Acesso ao Módulo Jurídico não identificado para este usuário.');
  }
  const reset = Boolean(input?.reset);
  const widths = _parseTipoAcoesColumnWidths(input?.widths);
  await withJuridicoDbInternal(({ db, persist }) => {
    setJuridicoAppConfigValue(
      db,
      _tipoAcoesColunasConfigKey(by),
      reset ? null : JSON.stringify(widths),
    );
    persist();
  });
  return {
    widths: reset ? { ...JURIDICO_TIPO_ACOES_COLUNAS_DEFAULT } : widths,
    customized: !reset,
  };
}

export async function getDistinctStatusesOptions(): Promise<string[]> {
  return withJuridicoDbInternal(({ db }) => {
    try {
      const rs = db.exec(
        `SELECT DISTINCT status FROM processos WHERE status IS NOT NULL AND TRIM(status) <> '' ORDER BY status COLLATE NOCASE ASC`,
      );
      const cols = rs[0]?.columns || [];
      const values = rs[0]?.values || [];
      const idxStatus = cols.indexOf('status');
      const list: string[] = [];
      const seen = new Set<string>();
      for (const row of values) {
        const v = String((idxStatus >= 0 ? row[idxStatus] : null) ?? '').trim();
        if (!v) continue;
        const k = v.toUpperCase();
        if (seen.has(k)) continue;
        seen.add(k);
        list.push(v);
      }
      list.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
      return list;
    } catch {
      return [] as string[];
    }
  });
}

export async function getDistinctGerentesOptions(): Promise<string[]> {
  return withJuridicoDbInternal(({ db }) => {
    try {
      const rs = db.exec(
        `SELECT DISTINCT gerente FROM processos WHERE gerente IS NOT NULL AND TRIM(gerente) <> '' ORDER BY gerente COLLATE NOCASE ASC`,
      );
      const cols = rs[0]?.columns || [];
      const values = rs[0]?.values || [];
      const idxGerente = cols.indexOf('gerente');
      const list: string[] = [];
      const seen = new Set<string>();
      for (const row of values) {
        const v = String((idxGerente >= 0 ? row[idxGerente] : null) ?? '').trim();
        if (!v) continue;
        const k = v.toUpperCase();
        if (seen.has(k)) continue;
        seen.add(k);
        list.push(v);
      }
      list.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
      return list;
    } catch {
      return [] as string[];
    }
  });
}

function _parseGerentesCadastro(raw: unknown): JuridicoGerenteCadastro[] {
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { arr = []; }
  }
  if (!Array.isArray(arr)) return [];
  const out: JuridicoGerenteCadastro[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const nome = String((item as any).nome ?? '').trim();
    const pa = String((item as any).pa ?? '').trim();
    if (!nome) continue;
    const k = nome.toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ nome, pa });
  }
  out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  return out;
}

function _derivedGerentesComPa(db: Database): JuridicoGerenteCadastro[] {
  try {
    const rs = db.exec(
      `SELECT gerente, numero_pa_enviados_ajuizamento FROM processos
       WHERE TRIM(COALESCE(gerente, '')) <> ''
         AND TRIM(COALESCE(numero_pa_enviados_ajuizamento, '')) <> ''
       ORDER BY id ASC`,
    );
    const cols = rs[0]?.columns || [];
    const values = rs[0]?.values || [];
    const idxGerente = cols.indexOf('gerente');
    const idxPa = cols.indexOf('numero_pa_enviados_ajuizamento');
    const map = new Map<string, JuridicoGerenteCadastro>();
    for (const row of values) {
      const nome = String((idxGerente >= 0 ? row[idxGerente] : null) ?? '').trim();
      const pa = String((idxPa >= 0 ? row[idxPa] : null) ?? '').trim();
      if (!nome || !pa || pa === '0') continue;
      map.set(nome.toUpperCase(), { nome, pa });
    }
    return Array.from(map.values());
  } catch {
    return [];
  }
}

function _mergeGerentesCadastro(...lists: JuridicoGerenteCadastro[][]): JuridicoGerenteCadastro[] {
  const map = new Map<string, JuridicoGerenteCadastro>();
  for (const list of lists) {
    for (const g of list) map.set(g.nome.toUpperCase(), g);
  }
  const out = Array.from(map.values());
  out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  return out;
}

export async function getJuridicoGerentesCadastro(): Promise<JuridicoGerenteCadastro[]> {
  return withJuridicoDbInternal(({ db }) =>
    _mergeGerentesCadastro(
      _derivedGerentesComPa(db),
      _parseGerentesCadastro(getJuridicoAppConfigValue(db, JURIDICO_CONFIG_KEY_CADASTRO_GERENTES)),
    ),
  );
}

export async function addJuridicoGerenteCadastro(input: {
  nome?: unknown;
  pa?: unknown;
  requestedByEmail: unknown;
}): Promise<JuridicoGerenteCadastro[]> {
  await requireJuridicoAdmin(input?.requestedByEmail);
  const nome = String(input?.nome ?? '').trim();
  const pa = String(input?.pa ?? '').trim();
  if (nome.length < 2) throw new Error('Informe o nome do gerente (mínimo 2 caracteres).');
  return withJuridicoDbInternal(({ db, persist }) => {
    const current = _parseGerentesCadastro(getJuridicoAppConfigValue(db, JURIDICO_CONFIG_KEY_CADASTRO_GERENTES));
    const key = nome.toUpperCase();
    const idx = current.findIndex((g) => g.nome.toUpperCase() === key);
    if (idx >= 0) current[idx] = { nome, pa };
    else current.push({ nome, pa });
    current.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
    setJuridicoAppConfigValue(db, JURIDICO_CONFIG_KEY_CADASTRO_GERENTES, JSON.stringify(current));
    persist();
    return _mergeGerentesCadastro(_derivedGerentesComPa(db), current);
  });
}

export async function setJuridicoRegrasPrazosConfig(input: {
  prazoProtocoloExtrajudicialDias?: unknown;
  prazoAjuizamentoDias?: unknown;
  requestedByEmail: unknown;
}): Promise<JuridicoRegrasPrazosConfig> {
  await requireJuridicoAdmin(input.requestedByEmail);
  const protocolo = _parseDias(input?.prazoProtocoloExtrajudicialDias == null ? null : String(input.prazoProtocoloExtrajudicialDias), DEFAULT_PRAZO_PROTOCOLO_EXTRAJ);
  const ajuizamento = _parseDias(input?.prazoAjuizamentoDias == null ? null : String(input.prazoAjuizamentoDias), DEFAULT_PRAZO_AJUIZAMENTO);
  await withJuridicoDbInternal(({ db, persist }) => {
    setJuridicoAppConfigValue(db, JURIDICO_CONFIG_KEY_PRAZO_PROTOCOLO_EXTRAJ, String(protocolo));
    setJuridicoAppConfigValue(db, JURIDICO_CONFIG_KEY_PRAZO_AJUIZAMENTO, String(ajuizamento));
    persist();
  });
  return { prazoProtocoloExtrajudicialDias: protocolo, prazoAjuizamentoDias: ajuizamento };
}

// ===== ACORDOS JURÍDICOS (CRUD tabela juridico_acordos) =====

export interface AcordoJuridico {
  id?: number;
  processo_id: number;
  devedor?: string;
  numero_processo_ou_extrajudicial?: string;
  titulos_objeto_cobranca?: string;
  total_parcelas?: number;
  valor_parcela?: number;
  numero_parcela?: number;
  forma_pagamento?: string;
  confirmacao_pagamento?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

function _acordoRowToObj(cols: string[], values: any[]): AcordoJuridico {
  const row: Record<string, any> = {};
  cols.forEach((c, i) => (row[c] = values[i]));
  return {
    id: row.id ? Number(row.id) : undefined,
    processo_id: Number(row.processo_id),
    devedor: row.devedor ? String(row.devedor) : undefined,
    numero_processo_ou_extrajudicial: row.numero_processo_ou_extrajudicial ? String(row.numero_processo_ou_extrajudicial) : undefined,
    titulos_objeto_cobranca: row.titulos_objeto_cobranca ? String(row.titulos_objeto_cobranca) : undefined,
    total_parcelas: row.total_parcelas != null ? Number(row.total_parcelas) : 0,
    valor_parcela: row.valor_parcela != null ? Number(row.valor_parcela) : 0,
    numero_parcela: row.numero_parcela != null ? Number(row.numero_parcela) : 0,
    forma_pagamento: row.forma_pagamento ? String(row.forma_pagamento) : undefined,
    confirmacao_pagamento: row.confirmacao_pagamento ? String(row.confirmacao_pagamento) : undefined,
    observacoes: row.observacoes ? String(row.observacoes) : undefined,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export async function getAcordoByProcessoId(processoId: number): Promise<AcordoJuridico | null> {
  return withJuridicoDbInternal(({ db }) => {
    const pid = Number(processoId) || 0;
    if (!pid) return null;
    const rs = db.exec('SELECT * FROM juridico_acordos WHERE processo_id = ? LIMIT 1', [pid] as any);
    const row = rs?.[0]?.values?.[0];
    return row ? _acordoRowToObj(rs[0].columns, row) : null;
  });
}

export async function createAcordo(input: Partial<AcordoJuridico> & { processo_id: number }, opts?: { requestedByEmail?: unknown }): Promise<AcordoJuridico> {
  await requireJuridicoAdmin(opts?.requestedByEmail);
  return withJuridicoDbInternal(({ db, persist }) => {
    const pid = Number(input.processo_id) || 0;
    if (!pid) throw new Error('processo_id é obrigatório');
    const procRs = db.exec('SELECT origem FROM processos WHERE id = ? LIMIT 1', [pid] as any);
    const procOrigem = String(procRs?.[0]?.values?.[0]?.[0] ?? '').trim();
    if (procOrigem === 'Enviado ao Jurídico') {
      throw new Error('Acordos não podem ser registrados para processos com Origem "Enviado ao Jurídico".');
    }
    const p: Record<string, any> = { processo_id: pid };
    const fields = ['devedor','numero_processo_ou_extrajudicial','titulos_objeto_cobranca','total_parcelas','valor_parcela','numero_parcela','forma_pagamento','confirmacao_pagamento','observacoes'];
    for (const k of fields) {
      const v = (input as any)[k];
      if (k === 'total_parcelas' || k === 'valor_parcela' || k === 'numero_parcela') {
        p[k] = v == null ? 0 : Number(v);
      } else {
        p[k] = v == null ? null : String(v);
      }
    }
    const cols = Object.keys(p).filter((k) => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
    const placeholders = cols.map(() => '?').join(',');
    const values = cols.map((c) => p[c]);
    db.run(
      `INSERT OR REPLACE INTO juridico_acordos (${cols.join(',')}) VALUES (${placeholders})`,
      values as any,
    );
    persist();
    return getAcordoByProcessoId(pid) as any;
  });
}

export async function updateAcordo(id: number, input: Partial<AcordoJuridico>, opts?: { requestedByEmail?: unknown }): Promise<AcordoJuridico | null> {
  await requireJuridicoAdmin(opts?.requestedByEmail);
  return withJuridicoDbInternal(async ({ db, persist }) => {
    const aid = Number(id) || 0;
    if (!aid) return null;
    const curRs = db.exec('SELECT * FROM juridico_acordos WHERE id = ? LIMIT 1', [aid] as any);
    const curRow = curRs?.[0]?.values?.[0];
    if (!curRow) return null;
    const curCols = curRs[0].columns ?? [];
    const current: Record<string, any> = {};
    for (let i = 0; i < curCols.length; i++) current[curCols[i]] = curRow[i];
    const pid = Number(current.processo_id) || 0;
    if (pid) {
      const procRs = db.exec('SELECT origem FROM processos WHERE id = ? LIMIT 1', [pid] as any);
      const procOrigem = String(procRs?.[0]?.values?.[0]?.[0] ?? '').trim();
      if (procOrigem === 'Enviado ao Jurídico') {
        throw new Error('Acordos não podem ser registrados para processos com Origem "Enviado ao Jurídico".');
      }
    }
    const merged: Record<string, any> = { ...current };
    const inObj = input as Record<string, any>;
    const numFields = new Set(['total_parcelas','valor_parcela','numero_parcela']);
    for (const k of Object.keys(inObj)) {
      if (k === 'id' || k === 'processo_id' || k === 'created_at') continue;
      const v = inObj[k];
      if (numFields.has(k)) {
        merged[k] = v == null ? 0 : Number(v);
      } else {
        merged[k] = v == null ? null : String(v);
      }
    }
    merged.updated_at = new Date().toISOString().replace('Z','').replace('T',' ').slice(0, 26);
    const sets: string[] = [];
    const vals: any[] = [];
    for (const k of Object.keys(merged)) {
      if (k === 'id') continue;
      sets.push(`${k}=?`);
      vals.push(merged[k]);
    }
    if (sets.length) {
      db.run(`UPDATE juridico_acordos SET ${sets.join(',')} WHERE id=?`, [...vals, aid] as any);
    }
    persist();
    return pid ? (getAcordoByProcessoId(pid) as any) : null;
  });
}

// ===== Helpers de normalização e RBAC Jurídico =====

export const JURIDICO_FIXED_ACCESS_EMAIL = 'mario.junior@sicoobjuriscred.com.br';

export type JuridicoAccessRole = 'admin' | 'usuario';
export type JuridicoMenuPermission =
  | 'home'
  | 'dashboard'
  | 'listagem-processos'
  | 'detalhes-processo'
  | 'relatorios'
  | 'configuracoes-automacao'
  | 'configuracoes-acessos'
  | 'importacao';

export const JURIDICO_ALL_MENU_PERMISSION_VALUES: JuridicoMenuPermission[] = [
  'home', 'dashboard', 'listagem-processos', 'detalhes-processo',
  'relatorios', 'importacao',
  'configuracoes-automacao', 'configuracoes-acessos',
];
export const JURIDICO_USER_DEFAULT_MENU_PERMISSIONS: JuridicoMenuPermission[] = [
  'home', 'dashboard', 'listagem-processos', 'detalhes-processo',
  'relatorios', 'importacao',
];
export const JURIDICO_FLOW_STAGE_PERMISSION_VALUES: string[] = [
  'extrajudicial', 'ajuizamento', 'gerencial',
];

export class JuridicoForbiddenError extends Error {
  readonly name = 'JuridicoForbiddenError';
  constructor(msg: string) { super(msg); Object.setPrototypeOf(this, JuridicoForbiddenError.prototype); }
}

export function juridicoNormalizeEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}
export function juridicoNormalizeRole(role: unknown): JuridicoAccessRole {
  const s = String(role ?? '').trim().toLowerCase();
  return s === 'admin' ? 'admin' : 'usuario';
}
export function juridicoNormalizeMenus(menus: unknown): JuridicoMenuPermission[] {
  if (!Array.isArray(menus)) return [...JURIDICO_USER_DEFAULT_MENU_PERMISSIONS];
  const all = new Set(JURIDICO_ALL_MENU_PERMISSION_VALUES.map((m) => String(m)));
  const out: JuridicoMenuPermission[] = [];
  for (const raw of menus) {
    const s = String(raw ?? '').trim();
    if (all.has(s)) out.push(s as JuridicoMenuPermission);
  }
  return out;
}
export function juridicoNormalizeFlowStages(stages: unknown, fallbackAll = true): string[] {
  if (!Array.isArray(stages) || stages.length === 0) {
    return fallbackAll ? [...JURIDICO_FLOW_STAGE_PERMISSION_VALUES] : [];
  }
  const ok = new Set(JURIDICO_FLOW_STAGE_PERMISSION_VALUES);
  const out: string[] = [];
  for (const raw of stages) {
    const s = String(raw ?? '').trim().toLowerCase();
    if (ok.has(s) && !out.includes(s)) out.push(s);
  }
  return out.length > 0 ? out : (fallbackAll ? [...JURIDICO_FLOW_STAGE_PERMISSION_VALUES] : []);
}

export function juridicoParseMoneyToCents(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null;
    return Math.round(v * 100);
  }
  const s = String(v).replace(/\s/g, '');
  if (!s) return null;
  const neg = s.startsWith('-');
  const t = s.replace(/[R$\s.]/g, '').replace(',', '.');
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(Math.abs(n) * 100);
  return neg ? -cents : cents;
}

// ====== RBAC Jurídico — acesso ao banco ======

export interface JuridicoAccessEntry {
  email: string;
  role: JuridicoAccessRole;
  menus: JuridicoMenuPermission[];
  flowStages: string[];
  createdAt?: string;
}

export function juridicoAccessRowToEntry(cols: string[], values: any[]): JuridicoAccessEntry {
  const row: Record<string, any> = {};
  cols.forEach((c, i) => (row[c] = values[i]));
  let menus: JuridicoMenuPermission[] = [];
  try {
    const parsed = JSON.parse(String(row.menu_permissions_json ?? '[]'));
    if (Array.isArray(parsed)) menus = juridicoNormalizeMenus(parsed);
  } catch {}
  if (!menus || menus.length === 0) menus = [...JURIDICO_USER_DEFAULT_MENU_PERMISSIONS];
  let flowStages: string[] = [];
  try {
    const parsed = JSON.parse(String(row.flow_stage_permissions_json ?? '[]'));
    flowStages = juridicoNormalizeFlowStages(parsed);
  } catch {}
  if (!flowStages || flowStages.length === 0) flowStages = [...JURIDICO_FLOW_STAGE_PERMISSION_VALUES];
  return {
    email: juridicoNormalizeEmail(row.email),
    role: juridicoNormalizeRole(row.role),
    menus,
    flowStages,
    createdAt: String(row.created_at ?? ''),
  };
}

async function withJuridicoDbInternal<T>(fn: (ctx: { sql: initSqlJs.SqlJsStatic; db: initSqlJs.Database; persist: () => void }) => Promise<T> | T): Promise<T> {
  const ctx = await openJuridicoDatabase();
  try { return await fn(ctx); } finally { try { ctx.db.close(); } catch {} }
}

export function juridicoIsSicoobjEmail(email: string): boolean {
  const e = (email || '').trim().toLowerCase();
  if (!e) return false;
  return e.endsWith('@sicoobjuriscred.com.br');
}

export async function autoGrantSicoobjUsuarioAccessIfApplicable(requestedByEmail: unknown): Promise<{ granted: boolean; email: string; role: JuridicoAccessRole }> {
  const by = juridicoNormalizeEmail(requestedByEmail);
  if (!by) return { granted: false, email: '', role: 'usuario' };
  if (by === JURIDICO_FIXED_ACCESS_EMAIL) return { granted: false, email: by, role: 'admin' };
  const exists = await withJuridicoDbInternal(({ db }) => {
    const r = db.exec('SELECT role FROM juridico_access_emails WHERE email = ? LIMIT 1', [by] as any);
    if (!r?.[0]?.values?.length) return null;
    return String(r[0].values[0][0] ?? '').trim().toLowerCase();
  });
  if (exists) return { granted: false, email: by, role: juridicoNormalizeRole(exists) };
  if (juridicoIsSicoobjEmail(by)) {
    await withJuridicoDbInternal(({ db, persist }) => {
      const menusJ = JSON.stringify(juridicoNormalizeMenus(null));
      const flowsJ = JSON.stringify(juridicoNormalizeFlowStages(null));
      db.run(
        `INSERT INTO juridico_access_emails (email, role, menu_permissions_json, flow_stage_permissions_json) VALUES (?, 'usuario', ?, ?)
         ON CONFLICT(email) DO UPDATE SET role = excluded.role, menu_permissions_json = excluded.menu_permissions_json, flow_stage_permissions_json = excluded.flow_stage_permissions_json`,
        [by, menusJ, flowsJ] as any
      );
      persist();
    });
    return { granted: true, email: by, role: 'usuario' };
  }
  return { granted: false, email: by, role: 'usuario' };
}

export async function requireJuridicoAdmin(requestedByEmail: unknown): Promise<void> {
  const by = juridicoNormalizeEmail(requestedByEmail);
  if (!by) throw new JuridicoForbiddenError('E-mail solicitante não informado.');
  if (by === JURIDICO_FIXED_ACCESS_EMAIL) return;
  await autoGrantSicoobjUsuarioAccessIfApplicable(by);
  const exists = await withJuridicoDbInternal(({ db }) => {
    const r = db.exec('SELECT role FROM juridico_access_emails WHERE email = ?', [by] as any);
    if (!r?.[0]?.values?.length) return null;
    return String(r[0].values[0][0] ?? '').trim().toLowerCase();
  });
  if (exists === 'admin') return;
  throw new JuridicoForbiddenError('Operação permitida apenas para administradores do Módulo Jurídico.');
}

export async function getJuridicoAccessRole(email: unknown): Promise<JuridicoAccessRole | null> {
  const by = juridicoNormalizeEmail(email);
  if (!by) return null;
  if (by === JURIDICO_FIXED_ACCESS_EMAIL) return 'admin';
  await autoGrantSicoobjUsuarioAccessIfApplicable(by);
  const role = await withJuridicoDbInternal(({ db }) => {
    const r = db.exec('SELECT role FROM juridico_access_emails WHERE email = ? LIMIT 1', [by] as any);
    if (!r?.[0]?.values?.length) return null;
    return String(r[0].values[0][0] ?? '').trim().toLowerCase();
  });
  if (!role) return null;
  return juridicoNormalizeRole(role);
}

export async function hasJuridicoAccess(email: unknown): Promise<boolean> {
  const role = await getJuridicoAccessRole(email);
  return role === 'admin' || role === 'usuario';
}

export async function setJuridicoAccessEmailRole(input: {
  email: unknown;
  role: unknown;
  requestedByEmail: unknown;
}): Promise<{ email: string; role: JuridicoAccessRole; fixedEmail: string; dbFilePath: string }> {
  await requireJuridicoAdmin(input.requestedByEmail);
  const targetEmail = juridicoNormalizeEmail(input.email);
  if (!targetEmail) throw new Error('E-mail alvo não informado.');
  const by = juridicoNormalizeEmail(input.requestedByEmail);
  const newRole = targetEmail === JURIDICO_FIXED_ACCESS_EMAIL ? 'admin' : juridicoNormalizeRole(input.role);

  // Se o alvo é o admin fixo, não é permitido alterar role (já é sempre admin)
  if (targetEmail === JURIDICO_FIXED_ACCESS_EMAIL) {
    return { email: targetEmail, role: 'admin', fixedEmail: JURIDICO_FIXED_ACCESS_EMAIL, dbFilePath: getJuridicoDbFilePath() };
  }

  // Validação de domínio: só e-mails @sicoobjuriscred.com.br podem ser cadastrados
  if (!juridicoIsSicoobjEmail(targetEmail)) {
    throw new JuridicoForbiddenError(
      'Apenas colaboradores com e-mail @sicoobjuriscred.com.br podem ter acesso ao Módulo Jurídico.'
    );
  }

  // Role atual (antes da alteração) para comparação
  const currentRole = await withJuridicoDbInternal(({ db }) => {
    const r = db.exec('SELECT role FROM juridico_access_emails WHERE email = ? LIMIT 1', [targetEmail] as any);
    if (!r?.[0]?.values?.length) return null;
    return String(r[0].values[0][0] ?? '').trim().toLowerCase();
  });

  // 🔒 RESTRIÇÃO ADMIN FIXO:
  //    - Tornar alguém ADMIN (usuario→admin)
  //    - Rebaixar um ADMIN existente (admin→usuario)
  //    Ambas as ações são permitidas SOMENTE pelo "administrador fixo" Mario.
  const becomingAdmin = newRole === 'admin';
  const currentIsAdmin = currentRole === 'admin';
  const adminRoleTransition = becomingAdmin || currentIsAdmin;
  if (adminRoleTransition && by !== JURIDICO_FIXED_ACCESS_EMAIL) {
    throw new JuridicoForbiddenError(
      `Apenas o administrador fixo (${JURIDICO_FIXED_ACCESS_EMAIL}) pode conceder ou revogar perfil de administrador.`
    );
  }

  await withJuridicoDbInternal(({ db, persist }) => {
    const menus = newRole === 'admin'
      ? [...JURIDICO_ALL_MENU_PERMISSION_VALUES]
      : juridicoNormalizeMenus(null);
    const flows = newRole === 'admin'
      ? [...JURIDICO_FLOW_STAGE_PERMISSION_VALUES]
      : juridicoNormalizeFlowStages(null);
    const menusJ = JSON.stringify(menus);
    const flowsJ = JSON.stringify(flows);
    db.run(
      `INSERT INTO juridico_access_emails (email, role, menu_permissions_json, flow_stage_permissions_json) VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET role = excluded.role, menu_permissions_json = excluded.menu_permissions_json, flow_stage_permissions_json = excluded.flow_stage_permissions_json`,
      [targetEmail, newRole, menusJ, flowsJ] as any
    );
    persist();
  });

  return { email: targetEmail, role: newRole, fixedEmail: JURIDICO_FIXED_ACCESS_EMAIL, dbFilePath: getJuridicoDbFilePath() };
}

export async function getJuridicoAccessEmails(
  opts?: { requestedByEmail?: unknown; ensureFixed?: boolean }
): Promise<{ entries: JuridicoAccessEntry[]; fixedEmail: string; dbFilePath: string }> {
  const by = opts?.requestedByEmail ? juridicoNormalizeEmail(opts.requestedByEmail) : '';
  const entries = await withJuridicoDbInternal(({ db, persist }) => {
    const list: JuridicoAccessEntry[] = [];
    // Garante FIXED admin existe
    if (opts?.ensureFixed !== false) {
      const menusAll = JSON.stringify([...JURIDICO_ALL_MENU_PERMISSION_VALUES]);
      const flowAll = JSON.stringify([...JURIDICO_FLOW_STAGE_PERMISSION_VALUES]);
      db.run(
        `INSERT INTO juridico_access_emails (email, role, menu_permissions_json, flow_stage_permissions_json) VALUES (?, 'admin', ?, ?)
         ON CONFLICT(email) DO UPDATE SET role = 'admin', menu_permissions_json = ?, flow_stage_permissions_json = ?`,
        [JURIDICO_FIXED_ACCESS_EMAIL, menusAll, flowAll, menusAll, flowAll] as any
      );
      persist();
    }
    const rs = db.exec('SELECT email, role, menu_permissions_json, flow_stage_permissions_json, created_at FROM juridico_access_emails ORDER BY email ASC');
    if (rs?.[0]) {
      for (const v of rs[0].values) list.push(juridicoAccessRowToEntry(rs[0].columns, v));
    }
    return list;
  });
  return {
    entries,
    fixedEmail: JURIDICO_FIXED_ACCESS_EMAIL,
    dbFilePath: getJuridicoDbFilePath(),
  };
}

export async function setJuridicoAccessEmails(input: {
  entries?: Partial<JuridicoAccessEntry>[] | null;
  deleteEmails?: string[] | null;
  requestedByEmail: unknown;
}): Promise<{ entries: JuridicoAccessEntry[]; upserted: number; deletedEmails: string[]; fixedEmail: string }> {
  await requireJuridicoAdmin(input.requestedByEmail);
  const by = juridicoNormalizeEmail(input.requestedByEmail);
  const deleteListRaw = Array.isArray(input?.deleteEmails) ? input.deleteEmails : [];
  const deleteList = deleteListRaw
    .map((e) => juridicoNormalizeEmail(e))
    .filter((e) => !!e && e !== JURIDICO_FIXED_ACCESS_EMAIL);
  const upserts = Array.isArray(input?.entries) ? input.entries!.filter((x) => x && juridicoNormalizeEmail((x as any).email) !== '') : [];
  let upserted = 0;
  let deletedEmails: string[] = [];
  const result = await withJuridicoDbInternal(async ({ db, persist }) => {
    // Roles ATUAIS (before update) para checagem de transições admin permitidas apenas pelo admin fixo
    const currentRoles = new Map<string, JuridicoAccessRole>();
    const rsBefore = db.exec('SELECT email, role FROM juridico_access_emails');
    if (rsBefore?.[0]) {
      for (const v of rsBefore[0].values) {
        const k = String(v[0] ?? '').trim().toLowerCase();
        if (k) currentRoles.set(k, juridicoNormalizeRole(v[1]));
      }
    }
    db.exec('BEGIN');
    try {
      for (const email of deleteList) {
        const r = db.run('DELETE FROM juridico_access_emails WHERE email = ?', [email] as any);
        if ((r as any)?.changes && (r as any).changes > 0) deletedEmails.push(email);
      }
      for (const raw of upserts) {
        const email = juridicoNormalizeEmail((raw as any).email);
        if (!email) continue;
        // Validação: apenas colaboradores @sicoobjuriscred.com.br
        if (email !== JURIDICO_FIXED_ACCESS_EMAIL && !juridicoIsSicoobjEmail(email)) {
          throw new JuridicoForbiddenError(
            `Apenas colaboradores com e-mail @sicoobjuriscred.com.br podem ter acesso ao Módulo Jurídico (email: ${email}).`
          );
        }
        const role = email === JURIDICO_FIXED_ACCESS_EMAIL ? 'admin' : juridicoNormalizeRole((raw as any).role);
        const currentRole = currentRoles.get(email) || null;
        const becomingAdmin = role === 'admin';
        const currentIsAdmin = currentRole === 'admin';
        const adminTransition = becomingAdmin || currentIsAdmin;
        // Perfil admin só pode ser concedido/removido pelo administrador fixo (Mario)
        if (email !== JURIDICO_FIXED_ACCESS_EMAIL && adminTransition && by !== JURIDICO_FIXED_ACCESS_EMAIL) {
          throw new JuridicoForbiddenError(
            `Apenas o administrador fixo (${JURIDICO_FIXED_ACCESS_EMAIL}) pode conceder ou revogar perfil de administrador (email alvo: ${email}).`
          );
        }
        const menus = email === JURIDICO_FIXED_ACCESS_EMAIL
          ? [...JURIDICO_ALL_MENU_PERMISSION_VALUES]
          : (role === 'admin'
              ? [...JURIDICO_ALL_MENU_PERMISSION_VALUES]
              : juridicoNormalizeMenus((raw as any).menus ?? (raw as any).menu_permissions));
        const flows = email === JURIDICO_FIXED_ACCESS_EMAIL
          ? [...JURIDICO_FLOW_STAGE_PERMISSION_VALUES]
          : juridicoNormalizeFlowStages((raw as any).flowStages ?? (raw as any).flow_stage_permissions);
        const menusJ = JSON.stringify(menus);
        const flowsJ = JSON.stringify(flows);
        db.run(
          `INSERT INTO juridico_access_emails (email, role, menu_permissions_json, flow_stage_permissions_json) VALUES (?, ?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET role = excluded.role, menu_permissions_json = excluded.menu_permissions_json, flow_stage_permissions_json = excluded.flow_stage_permissions_json`,
          [email, role, menusJ, flowsJ] as any
        );
        upserted++;
      }
      // FIXED admin sempre no final — UPSERT garantindo full perms
      const fixedMenusJ = JSON.stringify([...JURIDICO_ALL_MENU_PERMISSION_VALUES]);
      const fixedFlowsJ = JSON.stringify([...JURIDICO_FLOW_STAGE_PERMISSION_VALUES]);
      db.run(
        `INSERT INTO juridico_access_emails (email, role, menu_permissions_json, flow_stage_permissions_json) VALUES (?, 'admin', ?, ?)
         ON CONFLICT(email) DO UPDATE SET role = 'admin', menu_permissions_json = ?, flow_stage_permissions_json = ?`,
        [JURIDICO_FIXED_ACCESS_EMAIL, fixedMenusJ, fixedFlowsJ, fixedMenusJ, fixedFlowsJ] as any
      );
      db.exec('COMMIT');
      persist();
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch {}
      throw e;
    }
    const list: JuridicoAccessEntry[] = [];
    const rs = db.exec('SELECT email, role, menu_permissions_json, flow_stage_permissions_json, created_at FROM juridico_access_emails ORDER BY email ASC');
    if (rs?.[0]) for (const v of rs[0].values) list.push(juridicoAccessRowToEntry(rs[0].columns, v));
    return list;
  });
  return { entries: result, upserted, deletedEmails, fixedEmail: JURIDICO_FIXED_ACCESS_EMAIL };
}

export async function deleteJuridicoAccessEmail(input: {
  email: unknown;
  requestedByEmail: unknown;
}): Promise<{ email: string; removed: boolean; rowsAffected: number; fixedEmail: string; dbFilePath: string }> {
  await requireJuridicoAdmin(input.requestedByEmail);
  const target = juridicoNormalizeEmail(input.email);
  if (!target) throw new Error('E-mail alvo não informado.');
  if (target === JURIDICO_FIXED_ACCESS_EMAIL) throw new JuridicoForbiddenError('Não é permitido remover o e-mail fixo do administrador.');
  const { rowsAffected, removed } = await withJuridicoDbInternal(({ db, persist }) => {
    const r = db.run('DELETE FROM juridico_access_emails WHERE email = ?', [target] as any);
    const rowsAffected = Number((r as any)?.changes ?? 0) || 0;
    persist();
    return { rowsAffected, removed: rowsAffected > 0 };
  });
  return { email: target, removed, rowsAffected, fixedEmail: JURIDICO_FIXED_ACCESS_EMAIL, dbFilePath: getJuridicoDbFilePath() };
}



export function seedDemo54(db: Database): void {
  // NÃO GERAR LINHAS DE DEMO NA VERDADE — usuário quer apenas as linhas do CSV.
  // Deixar tabela vazia, para o importador preencher.
  void db;
}

// #region Graph Email (Microsoft Graph API via Azure client credentials)
const JURIDICO_FIXED_SENDER_EMAIL = String(
  process.env.JURIDICO_MAIL_SENDER || process.env.MAIL_SENDER || 'mario.junior@sicoobjuriscred.com.br',
).trim().toLowerCase();

const GRAPH_TOKEN_CACHE_TTL_MS = 50 * 60 * 1000;
interface GraphTokenCacheEntry { accessToken: string; expiresAtMs: number; }
const _graphTokenCacheJur = new Map<string, GraphTokenCacheEntry>();
let _graphTokenCacheLastPurge = 0;
function _graphTokenCacheKey(tenantId: string, clientId: string): string {
  return `${tenantId}::${clientId}`;
}
function _evictGraphTokenCacheJur() {
  const nowMs = Date.now();
  if (nowMs - _graphTokenCacheLastPurge < 60_000) return;
  _graphTokenCacheLastPurge = nowMs;
  for (const [k, v] of Array.from(_graphTokenCacheJur.entries())) {
    if (nowMs >= v.expiresAtMs) _graphTokenCacheJur.delete(k);
  }
}
async function _getGraphTokenJur(): Promise<string> {
  const tenantId = String(process.env.AZURE_TENANT_ID ?? '').trim();
  const clientId = String(process.env.AZURE_CLIENT_ID ?? '').trim();
  const clientSecret = String(process.env.AZURE_CLIENT_SECRET ?? '');
  if (!tenantId || !clientId) throw new Error('Azure tenantId/clientId não configurados (AZURE_TENANT_ID / AZURE_CLIENT_ID).');
  if (!clientSecret) throw new Error('AZURE_CLIENT_SECRET não configurado.');
  const cacheKey = _graphTokenCacheKey(tenantId, clientId);
  _evictGraphTokenCacheJur();
  const cached = _graphTokenCacheJur.get(cacheKey);
  const nowMs = Date.now();
  if (cached && cached.accessToken && nowMs < cached.expiresAtMs) return cached.accessToken;
  const params = new URLSearchParams();
  params.set('client_id', clientId);
  if (clientSecret) params.set('client_secret', clientSecret);
  params.set('grant_type', 'client_credentials');
  params.set('scope', 'https://graph.microsoft.com/.default');
  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
    },
  );
  if (!res.ok) throw new Error(`Falha ao obter token Graph Jurídico (HTTP ${res.status}).`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('Falha ao obter token Graph Jurídico (sem access_token).');
  const expiresAtMs = nowMs + GRAPH_TOKEN_CACHE_TTL_MS;
  _graphTokenCacheJur.set(cacheKey, { accessToken: data.access_token, expiresAtMs });
  _evictGraphTokenCacheJur();
  return data.access_token;
}
function _parseEmailListJur(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : String(input ?? '').split(/[,;\n]/g).map(s => s.trim()).filter(Boolean);
  const out: string[] = []; const seen = new Set<string>();
  for (const it of raw) {
    const e = String(it ?? '').trim().toLowerCase();
    if (!e || !e.includes('@') || e.startsWith('@') || e.endsWith('@')) continue;
    if (seen.has(e)) continue;
    seen.add(e);
    out.push(String(it).trim());
  }
  return out;
}
async function _sendGraphMailJur(opts: {
  to: string | string[]; cc?: string | string[]; subject: string; html: string;
  importance?: 'low' | 'normal' | 'high';
  from?: string;
  attachments?: Array<{ name: string; contentType: string; contentBytesBase64: string }>;
}): Promise<void> {
  const from = String(opts.from ?? JURIDICO_FIXED_SENDER_EMAIL).trim();
  if (!from.includes('@')) throw new Error('E-mail remetente inválido.');
  const toRecipients = _parseEmailListJur(opts.to);
  if (toRecipients.length === 0) throw new Error('Nenhum destinatário de e-mail válido.');
  const ccRaw = _parseEmailListJur(opts.cc ?? []);
  const toLowerSet = new Set(toRecipients.map(e => e.toLowerCase()));
  const ccRecipients = ccRaw.filter(e => !toLowerSet.has(e.toLowerCase()));
  const token = await _getGraphTokenJur();
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: opts.subject,
          ...(opts.importance ? { importance: opts.importance } : {}),
          body: { contentType: 'HTML', content: opts.html },
          toRecipients: toRecipients.map(address => ({ emailAddress: { address } })),
          ...(ccRecipients.length > 0 ? { ccRecipients: ccRecipients.map(a => ({ emailAddress: { address: a } })) } : {}),
          ...(opts.attachments && opts.attachments.length > 0 ? {
            attachments: opts.attachments.map(a => ({
              '@odata.type': '#microsoft.graph.fileAttachment',
              name: a.name, contentType: a.contentType, contentBytes: a.contentBytesBase64,
            })),
          } : {}),
        },
        saveToSentItems: false,
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Falha ao enviar e-mail Jurídico (HTTP ${res.status}).`);
  }
}
let _logoDataUriCache: string | null = null;
function _logoDataUri(): string {
  if (_logoDataUriCache) return _logoDataUriCache;
  const LOGO_FN_PRIMARY = 'sicoob-juriscred.png';
  const LOGO_FN_FALLBACK = 'sicoob-juriscred_Logo Verde.png';
  const candidates = [
    path.resolve(process.cwd(), '..', 'assets', LOGO_FN_PRIMARY),
    path.resolve(process.cwd(), '..', 'frontend', 'public', 'assets', LOGO_FN_PRIMARY),
    path.resolve(process.cwd(), '..', 'frontend', 'dist', 'assets', LOGO_FN_PRIMARY),
    path.resolve(process.cwd(), 'assets', LOGO_FN_PRIMARY),
    path.resolve(process.cwd(), '..', 'assets', LOGO_FN_FALLBACK),
    path.resolve(process.cwd(), '..', 'frontend', 'public', 'assets', LOGO_FN_FALLBACK),
    path.resolve(process.cwd(), '..', 'frontend', 'dist', 'assets', LOGO_FN_FALLBACK),
    path.resolve(process.cwd(), 'assets', LOGO_FN_FALLBACK),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        const b64 = fs.readFileSync(c).toString('base64');
        _logoDataUriCache = `data:image/png;base64,${b64}`;
        return _logoDataUriCache;
      }
    } catch { /* ignore */ }
  }
  _logoDataUriCache = '';
  return _logoDataUriCache;
}
function _fmtMoneyBr(v: unknown): string {
  const n = Number(v); if (!isFinite(n)) return '-';
  const neg = n < 0; const abs = Math.abs(n);
  const s = abs.toFixed(2); const [whole, dec] = s.split('.');
  const withDots = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}R$ ${withDots},${dec || '00'}`;
}
function _fmtDateBr(v: unknown): string {
  if (!v) return '-';
  const s = String(v).trim();
  if (!s) return '-';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d || '??'}/${m || '??'}/${y || '????'}`;
  }
  return s;
}
function _str(v: unknown, fallback = '-'): string {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s.length > 0 ? s : fallback;
}
function _rowCampo(row: Record<string, any>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s.length > 0) return s;
  }
  return '-';
}
function _buildNovoProcessoCobrancaTemplate(params: { row: Record<string, any> }): string {
  const r = params.row ?? {} as Record<string, any>;
  const logo = _logoDataUri();
  const id = r.id ?? '(novo)';
  const contrato = _rowCampo(r, ['numero_contrato_sicoob', 'contrato_sicoob', 'contrato']);
  const nProcesso = _rowCampo(r, ['numero_processo_ajuizamento', 'numero_processo', 'processo']);
  const valorCausa = _fmtMoneyBr(_rowCampo(r, ['valor_dado_causa_ajuizamento', 'valor']));
  const tipoAcao = _rowCampo(r, ['tipo_acao_ajuizamento', 'tipo_acao']);
  const gerente = _rowCampo(r, ['gerente_responsavel', 'gerente']);
  const origem = _rowCampo(r, ['origem_importacao', 'origem']);
  const statusProces = _rowCampo(r, ['status_processual', 'status']);
  const dataDistri = _fmtDateBr(_rowCampo(r, ['data_distribuicao', 'data_distribuicao_ajuizamento']));
  const extraStatus = _rowCampo(r, ['status_extrajudicial']);
  const observExtra = _rowCampo(r, ['observacoes_extrajudicial', 'observacao_extrajudicial']);
  const obsGeral = _rowCampo(r, ['observacoes_gerais', 'observacao_geral', 'observacoes']);
  const partesToStr = (prefix: 'autor' | 'reu'): string[] => {
    const out: string[] = [];
    for (let n = 1; n <= 6; n++) {
      const nome = _str(r[`${prefix}_${n}_nome`], '');
      const doc = _str(r[`${prefix}_${n}_cpf_cnpj`], '');
      if (!nome && !doc) continue;
      out.push(
        `<tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#234;">${n}.</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#112;font-weight:600;">${nome || '(sem nome)'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#334;font-family:monospace;">${doc || '-'}</td>
        </tr>`,
      );
    }
    return out.length > 0 ? out : [`<tr><td colspan="3" style="padding:10px;color:#777;font-size:12px;">Nenhuma parte informada.</td></tr>`];
  };
  const autoresTbl = partesToStr('autor').join('\n');
  const reusTbl = partesToStr('reu').join('\n');
  const honorarios = _fmtMoneyBr(r.honorarios_realizados ?? r.honorarios);
  const custas = _fmtMoneyBr(r.custas_honorarios ?? r.custas);
  const custasExtra = _fmtMoneyBr(r.custas_processuais_extra);
  const valor = _fmtMoneyBr(r.valor);
  const hoje = new Date();
  const hojeBr = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()} ${String(hoje.getHours()).padStart(2, '0')}:${String(hoje.getMinutes()).padStart(2, '0')}`;
  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Ateste de Novo Registro — Módulo Jurídico</title>
  </head>
  <body style="margin:0;padding:0;background:#EEF2F4;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#112;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:820px;margin:24px auto;background:#fff;border-radius:18px;box-shadow:0 12px 30px rgba(0,60,70,0.12);overflow:hidden;">
      <tr>
        <td style="padding:16px 22px;background:#003641;border-bottom:4px solid #7DB61C;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="middle" width="172">
                ${logo ? `<img src="${logo}" alt="Sicoob Juriscred" height="52" style="display:block;width:auto;max-width:170px;height:52px;" />` : `<div style="width:170px;height:52px;background:#0A5460;border-radius:10px;"></div>`}
              </td>
              <td valign="middle" style="padding-left:10px;">
                <div style="color:#FFFFFF;font-size:18px;font-weight:900;letter-spacing:0.2px;text-shadow:0 1px 1px rgba(0,0,0,0.18);">Módulo Jurídico · Novo Registro</div>
                <div style="color:#F4FAFE;font-size:13px;font-weight:700;margin-top:5px;letter-spacing:0.15px;">Automação · Jurídica · Ateste e Validação</div>
              </td>
              <td valign="middle" align="right" style="color:#FFFFFF;font-size:12px;font-weight:700;">
                Enviado em<br /><span style="color:#FFFFFF;font-weight:850;">${hojeBr}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="padding:22px 24px;">
        <div style="background:linear-gradient(135deg,#E7F6EB 0%,#D9EFF1 100%);border:1px solid #B5E1C0;border-radius:14px;padding:12px 14px;margin-bottom:18px;">
          <div style="font-size:13px;color:#1F4F2A;font-weight:700;">🔔 Uma nova movimentação foi cadastrada.</div>
          <div style="font-size:12.5px;color:#2E5D3D;margin-top:4px;line-height:1.55;">
            Por favor, confira os campos abaixo para fins de <b>ateste</b> e <b>validação</b> (Escritório Jurídico). Todos os anexos já se encontra na pasta do sharepoint compartilhada com o escritório. Se houver inconsistência, responda este e-mail para <a href="mailto:cobranca@sicoobjuriscred.com.br" style="color:#0B6B5F;font-weight:750;text-decoration:underline;">cobranca@sicoobjuriscred.com.br</a>, solicitando o ajuste.
          </div>
        </div>

        <div style="font-size:14px;font-weight:800;color:#003641;margin-bottom:10px;">📋 Dados Principais</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E6EBEF;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="background:#F4F7F9;padding:9px 12px;font-size:12px;color:#456;border-bottom:1px solid #E6EBEF;">ID</td>
            <td style="padding:9px 12px;font-size:13px;font-weight:700;color:#003641;border-bottom:1px solid #E6EBEF;">#${String(id).padStart(6, '0')}</td>
            <td style="background:#F4F7F9;padding:9px 12px;font-size:12px;color:#456;border-bottom:1px solid #E6EBEF;">Origem</td>
            <td style="padding:9px 12px;font-size:13px;color:#112;border-bottom:1px solid #E6EBEF;">${origem}</td>
          </tr>
          <tr>
            <td style="background:#F4F7F9;padding:9px 12px;font-size:12px;color:#456;border-bottom:1px solid #E6EBEF;">Contrato Sicoob</td>
            <td style="padding:9px 12px;font-size:13px;font-family:monospace;color:#112;border-bottom:1px solid #E6EBEF;">${contrato}</td>
            <td style="background:#F4F7F9;padding:9px 12px;font-size:12px;color:#456;border-bottom:1px solid #E6EBEF;">Nº Processo</td>
            <td style="padding:9px 12px;font-size:13px;font-family:monospace;color:#112;border-bottom:1px solid #E6EBEF;">${nProcesso}</td>
          </tr>
          <tr>
            <td style="background:#F4F7F9;padding:9px 12px;font-size:12px;color:#456;border-bottom:1px solid #E6EBEF;">Tipo Ação</td>
            <td style="padding:9px 12px;font-size:13px;color:#112;border-bottom:1px solid #E6EBEF;">${tipoAcao}</td>
            <td style="background:#F4F7F9;padding:9px 12px;font-size:12px;color:#456;border-bottom:1px solid #E6EBEF;">Gerente</td>
            <td style="padding:9px 12px;font-size:13px;color:#112;border-bottom:1px solid #E6EBEF;">${gerente}</td>
          </tr>
          <tr>
            <td style="background:#F4F7F9;padding:9px 12px;font-size:12px;color:#456;border-bottom:1px solid #E6EBEF;">Status Processual</td>
            <td style="padding:9px 12px;font-size:13px;color:#112;border-bottom:1px solid #E6EBEF;">${statusProces}</td>
            <td style="background:#F4F7F9;padding:9px 12px;font-size:12px;color:#456;border-bottom:1px solid #E6EBEF;">Data Distribuição</td>
            <td style="padding:9px 12px;font-size:13px;color:#112;border-bottom:1px solid #E6EBEF;">${dataDistri}</td>
          </tr>
          <tr>
            <td style="background:#F4F7F9;padding:9px 12px;font-size:12px;color:#456;">Valor Causa</td>
            <td style="padding:9px 12px;font-size:14px;font-weight:800;color:#003641;">${valorCausa}</td>
            <td style="background:#F4F7F9;padding:9px 12px;font-size:12px;color:#456;">Status Extrajudicial</td>
            <td style="padding:9px 12px;font-size:13px;color:#112;">${extraStatus}</td>
          </tr>
        </table>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px;">
          <div>
            <div style="font-size:14px;font-weight:800;color:#003641;margin-bottom:10px;">⚖️ Autor(es)</div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E6EBEF;border-radius:14px;overflow:hidden;">
              <tr style="background:#F4F7F9;">
                <th style="width:30px;padding:10px;text-align:left;font-size:11.5px;color:#456;">#</th>
                <th style="padding:10px;text-align:left;font-size:11.5px;color:#456;">Nome</th>
                <th style="padding:10px;text-align:left;font-size:11.5px;color:#456;">CPF/CNPJ</th>
              </tr>
              ${autoresTbl}
            </table>
          </div>
          <div>
            <div style="font-size:14px;font-weight:800;color:#003641;margin-bottom:10px;">🛑 Réu(ns)</div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E6EBEF;border-radius:14px;overflow:hidden;">
              <tr style="background:#F4F7F9;">
                <th style="width:30px;padding:10px;text-align:left;font-size:11.5px;color:#456;">#</th>
                <th style="padding:10px;text-align:left;font-size:11.5px;color:#456;">Nome</th>
                <th style="padding:10px;text-align:left;font-size:11.5px;color:#456;">CPF/CNPJ</th>
              </tr>
              ${reusTbl}
            </table>
          </div>
        </div>

        ${(obsGeral !== '-' || observExtra !== '-') ? `
        <div style="margin-top:18px;">
          <div style="font-size:14px;font-weight:800;color:#003641;margin-bottom:10px;">📝 Observações</div>
          ${obsGeral !== '-' ? `
          <div style="background:#FAFBFC;border:1px solid #E6EBEF;border-radius:14px;padding:12px 14px;margin-bottom:10px;">
            <div style="font-size:11px;color:#667;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Gerais</div>
            <div style="font-size:13px;color:#112;white-space:pre-wrap;line-height:1.5;">${obsGeral}</div>
          </div>` : ''}
          ${observExtra !== '-' ? `
          <div style="background:#FFF7EC;border:1px solid #F5E1B3;border-radius:14px;padding:12px 14px;">
            <div style="font-size:11px;color:#926417;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Extrajudicial</div>
            <div style="font-size:13px;color:#3E2A05;white-space:pre-wrap;line-height:1.5;">${observExtra}</div>
          </div>` : ''}
        </div>` : ''}

      </td></tr>
      <tr><td style="background:#F4F7F9;padding:14px 24px;font-size:11.5px;color:#556;text-align:center;border-top:1px solid #E6EBEF;line-height:1.55;">
        © 2026 Sicoob Juriscred • Jurídico<br/>
        Desenvolvido Por: Tecnologia da Informação Juriscred<br/>
        🤖 E-mail automático por agentes de IA - Por favor não responder.
      </td></tr>
    </table>
  </body>
  </html>`;
}
export interface NotificarNovoProcessoCobrancaResult {
  ok: boolean;
  enviado: boolean;
  destinatarios: string[];
  mensagem?: string;
  dbFilePath: string;
  senderEmail: string;
}
export async function notificarNovoProcessoCobranca(row: Record<string, any> | null | undefined): Promise<NotificarNovoProcessoCobrancaResult> {
  const base: NotificarNovoProcessoCobrancaResult = {
    ok: false, enviado: false, destinatarios: [], dbFilePath: getJuridicoDbFilePath(), senderEmail: JURIDICO_FIXED_SENDER_EMAIL,
  };
  try {
    const cfg = await getJuridicoNotificacoesConfig();
    const escritorio = _parseEmailListJur(cfg?.escritorioJuridico ?? []);
    const cobranca = _parseEmailListJur(cfg?.cobranca ?? []);
    let to: string[] = escritorio.length ? escritorio : cobranca;
    let cc: string[] = [];
    if (escritorio.length > 0) cc = cobranca;
    const uniqLower = new Set<string>();
    to = to.filter((e) => { const k = e.toLowerCase(); if (uniqLower.has(k)) return false; uniqLower.add(k); return true; });
    cc = cc.filter((e) => { const k = e.toLowerCase(); if (uniqLower.has(k)) return false; uniqLower.add(k); return true; });
    base.destinatarios = [...to, ...cc];
    if (!row) { base.mensagem = 'Registro vazio — sem disparo.'; return base; }
    if (to.length === 0 && cc.length === 0) {
      base.mensagem = 'Nenhum e-mail configurado em "Notificações > Escritório Jurídico / Cobrança". Disparo ignorado.';
      return { ...base, ok: true };
    }
    const r = Object.assign(Object.create(null), row || {});
    const contrato = (
      String(r.numero_contrato_sicoob ?? r.contrato_sicoob ?? r.contrato ?? '').trim()
    );
    const reu = (
      String(r.reu_1_nome ?? r.reu ?? '').trim() ||
      String(r.autor_1_nome ?? r.autor ?? '').trim() ||
      '(sem parte)'
    );
    const valor = Number(r.valor_dado_causa_ajuizamento ?? r.valor ?? 0);
    const assunto = `[ATSTE NOVO] ${reu.slice(0, 40)} · ${contrato ? 'Contrato ' + contrato : 'ID ' + (String(r.id ?? '?'))} · ${_fmtMoneyBr(valor)}`;
    const html = _buildNovoProcessoCobrancaTemplate({ row: r });
    await _sendGraphMailJur({
      to, cc, subject: assunto, html, importance: 'normal',
    });
    base.ok = true; base.enviado = true;
    base.mensagem = `E-mail enviado. (to=${to.join(', ') || '-'}) (cc=${cc.join(', ') || '-'})`;
    return base;
  } catch (e: any) {
    base.mensagem = e?.message || 'Erro ao enviar e-mail de notificação.';
    return base;
  }
}
// #endregion
