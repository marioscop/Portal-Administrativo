import dotenv from 'dotenv';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

type PdfParseResult = { text?: string };
type PdfParseFn = (dataBuffer: Buffer) => Promise<PdfParseResult>;

let cachedPdfParse: PdfParseFn | null = null;
let cachedPdfModule: any | null = null;
let cachedSqlJs: Promise<SqlJsStatic> | null = null;
const cachedDbByPath = new Map<string, { db: Database; mtimeMs: number }>();

async function getPdfParse(): Promise<PdfParseFn> {
  if (cachedPdfParse) return cachedPdfParse;
  let mod: any;
  try {
    mod = await import('pdf-parse');
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`Falha ao importar pdf-parse: ${message}`);
  }

  const directFn = mod?.default;
  if (typeof directFn === 'function') {
    cachedPdfParse = directFn as PdfParseFn;
    return cachedPdfParse;
  }

  const PDFParseClass = mod?.PDFParse;
  if (typeof PDFParseClass === 'function') {
    cachedPdfParse = async (dataBuffer: Buffer) => {
      const parser = new PDFParseClass({ data: dataBuffer });
      try {
        const res = await parser.getText();
        return { text: typeof res?.text === 'string' ? res.text : '' };
      } finally {
        try {
          await parser.destroy();
        } catch {
          void 0;
        }
      }
    };
    return cachedPdfParse;
  }

  const keys = mod && typeof mod === 'object' ? Object.keys(mod).join(', ') : '';
  throw new Error(`Falha ao carregar pdf-parse (exports: ${keys || '-'})`);
}

type PdfExtractPage = { num: number; text: string; tables: string[][][] };
type PdfExtractResult = { text: string; pages: PdfExtractPage[] };

async function extractPdf(file: Buffer): Promise<PdfExtractResult> {
  if (!cachedPdfModule) {
    try {
      cachedPdfModule = await import('pdf-parse');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Falha ao importar pdf-parse: ${message}`);
    }
  }
  const mod: any = cachedPdfModule;

  if (typeof mod?.PDFParse === 'function') {
    const parser = new mod.PDFParse({ data: file });
    try {
      const textRes = await parser.getText();
      const tableRes = await parser.getTable();
      const tablePages = Array.isArray(tableRes?.pages) ? tableRes.pages : [];
      const textPages = Array.isArray(textRes?.pages) ? textRes.pages : [];
      const byPage = new Map<number, PdfExtractPage>();

      for (const p of textPages) {
        const num = typeof (p as any)?.num === 'number' ? (p as any).num : NaN;
        if (!Number.isFinite(num)) continue;
        const pageText = typeof (p as any)?.text === 'string' ? (p as any).text : '';
        byPage.set(num, { num, text: pageText, tables: [] as string[][][] });
      }

      for (const p of tablePages) {
        const num = typeof (p as any)?.num === 'number' ? (p as any).num : NaN;
        if (!Number.isFinite(num)) continue;
        const page =
          byPage.get(num) ?? { num, text: '', tables: [] as string[][][] };
        const t = (p as any)?.tables;
        if (Array.isArray(t)) {
          for (const table of t) {
            if (!Array.isArray(table)) continue;
            page.tables.push(
              table.map((row: any) =>
                Array.isArray(row) ? row.map((c) => String(c ?? '').trim()) : [],
              ),
            );
          }
        }
        byPage.set(num, page);
      }

      const pages = Array.from(byPage.values()).sort((a, b) => a.num - b.num);
      return {
        text: typeof textRes?.text === 'string' ? textRes.text : '',
        pages,
      };
    } finally {
      try {
        await parser.destroy();
      } catch {
        void 0;
      }
    }
  }

  const fn = await getPdfParse();
  const res = await fn(file);
  const text = String(res?.text ?? '');
  return { text, pages: [{ num: 1, text, tables: [] }] };
}

function normalizeUrl(input: string): string {
  const cleaned = input.replace(/[`]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned.replace(/ /g, '%20');
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function toShareId(url: string): string {
  return `u!${toBase64Url(url)}`;
}

async function getGraphToken(opts: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const params = new URLSearchParams();
  params.set('client_id', opts.clientId);
  params.set('client_secret', opts.clientSecret);
  params.set('grant_type', 'client_credentials');
  params.set('scope', 'https://graph.microsoft.com/.default');

  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(opts.tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
    },
  );

  if (!res.ok) {
    throw new Error(`Falha ao obter token do Graph (HTTP ${res.status})`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('Falha ao obter token do Graph');
  return data.access_token;
}

async function graphGet<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Graph GET falhou (HTTP ${res.status})`);
  }
  return (await res.json()) as T;
}

async function graphDownload(token: string, url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Download falhou (HTTP ${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function resolveDriveItemFromShareUrl(
  token: string,
  folderUrl: string,
): Promise<{
  driveId: string;
  itemId: string;
  itemName: string;
  specificFile: null | { id: string; name: string };
}> {
  const shareId = toShareId(folderUrl);
  const data = await graphGet<{
    id: string;
    name?: string;
    folder?: unknown;
    file?: unknown;
    parentReference?: { driveId?: string };
  }>(
    token,
    `https://graph.microsoft.com/v1.0/shares/${encodeURIComponent(
      shareId,
    )}/driveItem?$select=id,name,folder,file,parentReference`,
  );

  const driveId = data.parentReference?.driveId;
  if (!driveId)
    throw new Error('Não foi possível resolver o driveId do SharePoint');
  if (!data.id)
    throw new Error('Não foi possível resolver o itemId do SharePoint');
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (data.folder) {
    return { driveId, itemId: data.id, itemName: name, specificFile: null };
  }

  if (data.file) {
    const fileId = data.id;
    const fileName = name;
    const item = await graphGet<{
      parentReference?: { id?: string };
    }>(
      token,
      `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
        driveId,
      )}/items/${encodeURIComponent(fileId)}?$select=parentReference`,
    );
    const parentId = item.parentReference?.id;
    if (!parentId) {
      throw new Error('Não foi possível resolver a pasta do arquivo no SharePoint');
    }
    const parent = await graphGet<{ name?: string; folder?: unknown }>(
      token,
      `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
        driveId,
      )}/items/${encodeURIComponent(parentId)}?$select=name,folder`,
    );
    if (!parent.folder) {
      throw new Error('A URL informada não aponta para uma pasta');
    }
    const parentName = typeof parent.name === 'string' ? parent.name.trim() : '';
    return {
      driveId,
      itemId: parentId,
      itemName: parentName,
      specificFile: fileId && fileName ? { id: fileId, name: fileName } : null,
    };
  }

  throw new Error('A URL informada não aponta para uma pasta');
}

async function listDriveItemChildren(
  token: string,
  driveId: string,
  itemId: string,
) {
  const data = await graphGet<{
    value: Array<{
      name: string;
      id: string;
      lastModifiedDateTime?: string;
      file?: { mimeType?: string };
      folder?: unknown;
    }>;
  }>(
    token,
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
      driveId,
    )}/items/${encodeURIComponent(itemId)}/children?$select=name,id,lastModifiedDateTime,file,folder`,
  );

  return data.value;
}

function findFolderChildId(
  children: Array<{ name: string; id: string; folder?: unknown }>,
  variants: string[],
): string | null {
  const normalized = variants.map((v) => v.trim().toLowerCase());
  const found = children.find(
    (c) => c.folder && normalized.includes(c.name.trim().toLowerCase()),
  );
  return found?.id ?? null;
}

async function resolveContainerWithSubfolders(opts: {
  token: string;
  driveId: string;
  baseChildren: Array<{
    name: string;
    id: string;
    folder?: unknown;
    lastModifiedDateTime?: string;
  }>;
  extratoCandidates: string[];
  relatorioCandidates: string[];
  maxDepth?: number;
}): Promise<{
  containerName: string;
  extratoFolderId: string;
  relatorioFolderId: string;
}> {
  const directExtrato = findFolderChildId(
    opts.baseChildren,
    opts.extratoCandidates,
  );
  const directRelatorio = findFolderChildId(
    opts.baseChildren,
    opts.relatorioCandidates,
  );

  if (directExtrato && directRelatorio) {
    return {
      containerName: 'base',
      extratoFolderId: directExtrato,
      relatorioFolderId: directRelatorio,
    };
  }

  const maxDepth = opts.maxDepth ?? 5;
  const folders = opts.baseChildren
    .filter((c) => Boolean(c.folder))
    .sort((a, b) =>
      (b.lastModifiedDateTime ?? '').localeCompare(
        a.lastModifiedDateTime ?? '',
      ),
    );

  const queue: Array<{ id: string; path: string; depth: number }> = folders.map(
    (f) => ({ id: f.id, path: f.name, depth: 1 }),
  );
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    const children = await listDriveItemChildren(
      opts.token,
      opts.driveId,
      current.id,
    );

    const extrato = findFolderChildId(children, opts.extratoCandidates);
    const relatorio = findFolderChildId(children, opts.relatorioCandidates);
    if (extrato && relatorio) {
      return {
        containerName: current.path,
        extratoFolderId: extrato,
        relatorioFolderId: relatorio,
      };
    }

    if (current.depth >= maxDepth) continue;
    const childFolders = children
      .filter((c) => Boolean(c.folder))
      .sort((a, b) =>
        (b.lastModifiedDateTime ?? '').localeCompare(
          a.lastModifiedDateTime ?? '',
        ),
      );

    for (const cf of childFolders) {
      queue.push({
        id: cf.id,
        path: `${current.path}/${cf.name}`,
        depth: current.depth + 1,
      });
    }
  }

  const available = folders.map((f) => f.name).join(', ');
  throw new Error(
    `Não encontrei as subpastas de extrato/relatório. Pastas dentro da base: ${available}`,
  );
}

type ResolvedContainer = {
  containerName: string;
  extratoFolderId: string | null;
  relatorioFolderId: string | null;
};

async function resolveFolderIdRecursive(opts: {
  token: string;
  driveId: string;
  baseChildren: Array<{
    name: string;
    id: string;
    folder?: unknown;
    lastModifiedDateTime?: string;
  }>;
  wantedCandidates: string[];
  maxDepth?: number;
}): Promise<{ containerName: string; folderId: string }> {
  const direct = findFolderChildId(opts.baseChildren, opts.wantedCandidates);
  if (direct) return { containerName: 'base', folderId: direct };

  const maxDepth = opts.maxDepth ?? 5;
  const folders = opts.baseChildren
    .filter((c) => Boolean(c.folder))
    .sort((a, b) =>
      (b.lastModifiedDateTime ?? '').localeCompare(a.lastModifiedDateTime ?? ''),
    );

  const queue: Array<{ id: string; path: string; depth: number }> = folders.map(
    (f) => ({ id: f.id, path: f.name, depth: 1 }),
  );
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    const children = await listDriveItemChildren(opts.token, opts.driveId, current.id);
    const found = findFolderChildId(children, opts.wantedCandidates);
    if (found) {
      return { containerName: current.path, folderId: found };
    }

    if (current.depth >= maxDepth) continue;
    const childFolders = children
      .filter((c) => Boolean(c.folder))
      .sort((a, b) =>
        (b.lastModifiedDateTime ?? '').localeCompare(a.lastModifiedDateTime ?? ''),
      );
    for (const cf of childFolders) {
      queue.push({
        id: cf.id,
        path: `${current.path}/${cf.name}`,
        depth: current.depth + 1,
      });
    }
  }

  const available = folders.map((f) => f.name).join(', ');
  throw new Error(
    `Não encontrei a subpasta desejada. Pastas dentro da base: ${available}`,
  );
}

async function resolveContainerForTarget(opts: {
  token: string;
  driveId: string;
  baseItemId: string;
  baseItemName: string;
  baseChildren: Array<{
    name: string;
    id: string;
    folder?: unknown;
    lastModifiedDateTime?: string;
  }>;
  extratoCandidates: string[];
  relatorioCandidates: string[];
  target: 'both' | 'extratos' | 'relatorio';
}): Promise<ResolvedContainer> {
  if (opts.target === 'both') {
    const both = await resolveContainerWithSubfolders({
      token: opts.token,
      driveId: opts.driveId,
      baseChildren: opts.baseChildren,
      extratoCandidates: opts.extratoCandidates,
      relatorioCandidates: opts.relatorioCandidates,
    });
    return {
      containerName: both.containerName,
      extratoFolderId: both.extratoFolderId,
      relatorioFolderId: both.relatorioFolderId,
    };
  }

  const matchesBase = (candidates: string[]) => {
    const normalized = candidates.map((v) => v.trim().toLowerCase());
    return normalized.includes((opts.baseItemName || '').trim().toLowerCase());
  };

  if (opts.target === 'relatorio') {
    const direct = findFolderChildId(opts.baseChildren, opts.relatorioCandidates);
    if (direct) {
      return { containerName: 'base', extratoFolderId: null, relatorioFolderId: direct };
    }
    if (matchesBase(opts.relatorioCandidates)) {
      return {
        containerName: 'base',
        extratoFolderId: null,
        relatorioFolderId: opts.baseItemId,
      };
    }
    const found = await resolveFolderIdRecursive({
      token: opts.token,
      driveId: opts.driveId,
      baseChildren: opts.baseChildren,
      wantedCandidates: opts.relatorioCandidates,
    });
    return {
      containerName: found.containerName,
      extratoFolderId: null,
      relatorioFolderId: found.folderId,
    };
  }

  const direct = findFolderChildId(opts.baseChildren, opts.extratoCandidates);
  if (direct) {
    return { containerName: 'base', extratoFolderId: direct, relatorioFolderId: null };
  }
  if (matchesBase(opts.extratoCandidates)) {
    return {
      containerName: 'base',
      extratoFolderId: opts.baseItemId,
      relatorioFolderId: null,
    };
  }
  const found = await resolveFolderIdRecursive({
    token: opts.token,
    driveId: opts.driveId,
    baseChildren: opts.baseChildren,
    wantedCandidates: opts.extratoCandidates,
  });
  return {
    containerName: found.containerName,
    extratoFolderId: found.folderId,
    relatorioFolderId: null,
  };
}

function folderNameVariants(name: string): string[] {
  const variants = new Set<string>();
  const baseRaw = String(name ?? '').trim();
  if (baseRaw) variants.add(baseRaw);

  const lower = baseRaw.toLowerCase();
  const noAccents = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (noAccents && noAccents !== lower) variants.add(noAccents);

  const addPluralAndSingular = (n: string) => {
    const v = n.trim();
    if (!v) return;
    variants.add(v);
    const l = v.toLowerCase();
    if (l.endsWith('s')) variants.add(v.slice(0, -1));
    else variants.add(`${v}s`);
  };

  if (noAccents) addPluralAndSingular(noAccents);
  if (lower) addPluralAndSingular(lower);

  if (noAccents === 'relatorio' || lower === 'relatório' || lower === 'relatorio') {
    addPluralAndSingular('Relatório');
    addPluralAndSingular('Relatorio');
    addPluralAndSingular('Relatórios');
    addPluralAndSingular('Relatorios');
  }

  if (lower === 'extrato' || noAccents === 'extrato') {
    variants.add('Extrato');
    variants.add('Extratos');
  }
  return Array.from(variants);
}

function isSpreadsheetFile(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.csv') ||
    lower.endsWith('.xlsm')
  );
}

function isPdfFile(name: string): boolean {
  return name.trim().toLowerCase().endsWith('.pdf');
}

async function listSpreadsheetFilesRecursive(opts: {
  token: string;
  driveId: string;
  rootFolderId: string;
  maxDepth?: number;
  excludeFolderNames?: string[];
  fileFilter?: (name: string) => boolean;
}): Promise<Array<{ id: string; name: string; lastModifiedDateTime: string }>> {
  const maxDepth = opts.maxDepth ?? 6;
  const excluded = new Set(
    (opts.excludeFolderNames ?? []).map((n) => n.trim().toLowerCase()),
  );
  const fileFilter = opts.fileFilter ?? isSpreadsheetFile;
  const out: Array<{ id: string; name: string; lastModifiedDateTime: string }> =
    [];
  const queue: Array<{ id: string; depth: number }> = [
    { id: opts.rootFolderId, depth: 0 },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    const children = await listDriveItemChildren(
      opts.token,
      opts.driveId,
      current.id,
    );

    for (const item of children) {
      if (item.file && fileFilter(item.name)) {
        out.push({
          id: item.id,
          name: item.name,
          lastModifiedDateTime: item.lastModifiedDateTime ?? '',
        });
      } else if (item.folder && current.depth < maxDepth) {
        if (excluded.has(item.name.trim().toLowerCase())) continue;
        queue.push({ id: item.id, depth: current.depth + 1 });
      }
    }
  }

  return out;
}

function readSheetTable(file: Buffer): {
  headers: string[];
  rows: Array<Record<string, unknown>>;
} {
  const wb = XLSX.read(file, { type: 'buffer', cellDates: true });
  function cellHasValue(v: unknown): boolean {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (typeof v === 'number') return !Number.isNaN(v);
    return true;
  }

  function toHeaderName(v: unknown): string {
    if (v === null || v === undefined) return '';
    const raw =
      typeof v === 'string'
        ? v
        : typeof v === 'number'
          ? String(v)
          : typeof v === 'boolean'
            ? v
              ? 'true'
              : 'false'
            : '';
    if (!raw) return '';
    let cleaned = raw.normalize('NFKC');
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    cleaned = cleaned.replace(/[^\p{L}\p{N} _.\-\/]/gu, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    if (cleaned.length > 80) cleaned = cleaned.slice(0, 80).trim();
    return cleaned;
  }

  const sheetNames = wb.SheetNames;
  if (!sheetNames || sheetNames.length === 0) return { headers: [], rows: [] };

  const parseSheet = (sheet: XLSX.WorkSheet) => {
    const aoa = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: false,
      dateNF: 'dd/mm/yyyy',
    }) as unknown[][];

    if (!Array.isArray(aoa) || aoa.length === 0) {
      return {
        headers: [] as string[],
        rows: [] as Array<Record<string, unknown>>,
      };
    }

    const searchLimit = Math.min(50, aoa.length);
    let headerIndex = -1;
    let bestScore = -1;

    for (let i = 0; i < searchLimit; i += 1) {
      const row = aoa[i];
      if (!Array.isArray(row)) continue;
      const nonEmpty = row.filter((v) => cellHasValue(v)).length;
      if (nonEmpty < 2) continue;
      const stringish = row.filter(
        (v) => typeof v === 'string' && v.trim().length > 0,
      ).length;
      const score = nonEmpty * 2 + stringish;
      if (score > bestScore) {
        bestScore = score;
        headerIndex = i;
      }
    }

    if (headerIndex === -1) {
      return {
        headers: [] as string[],
        rows: [] as Array<Record<string, unknown>>,
      };
    }

    const maxCols = Math.max(
      ...(aoa
        .slice(headerIndex)
        .map((r) => (Array.isArray(r) ? r.length : 0)) as number[] | []),
      0,
    );
    const headerRow: unknown[] = Array.isArray(aoa[headerIndex])
      ? aoa[headerIndex]
      : [];

    const headersRaw: string[] = [];
    for (let c = 0; c < maxCols; c += 1) {
      headersRaw.push(toHeaderName(headerRow[c]));
    }

    const headers: string[] = [];
    const counts = new Map<string, number>();
    for (let i = 0; i < headersRaw.length; i += 1) {
      const base = headersRaw[i] || `COL_${i + 1}`;
      const prev = counts.get(base) ?? 0;
      counts.set(base, prev + 1);
      headers.push(prev === 0 ? base : `${base}_${prev}`);
    }

    const rows: Array<Record<string, unknown>> = [];
    for (let r = headerIndex + 1; r < aoa.length; r += 1) {
      const row = aoa[r];
      if (!Array.isArray(row)) continue;
      const obj: Record<string, unknown> = {};
      let nonEmptyCount = 0;
      for (let c = 0; c < headers.length; c += 1) {
        const v: unknown = c < row.length ? row[c] : null;
        obj[headers[c]] = v;
        if (cellHasValue(v)) nonEmptyCount += 1;
      }
      if (nonEmptyCount >= 2) rows.push(obj);
    }

    return { headers, rows };
  };

  let best = {
    headers: [] as string[],
    rows: [] as Array<Record<string, unknown>>,
  };
  let bestRank = -1;
  for (const name of sheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const parsed = parseSheet(sheet);
    const rank = parsed.rows.length * 1000 + parsed.headers.length;
    if (rank > bestRank) {
      bestRank = rank;
      best = parsed;
    }
  }

  return best;
}

const RELATORIO_PDF_COLUMNS = [
  'EMPRESA',
  'Cliente',
  'Matrícula',
  'CPF',
  'Nome',
  'Atividade',
  'Telefone',
  'Operação',
  'Modalidade',
  'Vencto. Operação',
  'Tx. Juros',
  'Parcela',
  'Vencimento',
  'Valor Operação',
  'Valor Parcela',
  'Valor Juros',
  'Valorização',
  'Rendas Apropriar',
] as const;

function normalizePdfLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseRelatorioClienteLine(value: string): Record<string, string> {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  const tokens = cleaned.split(' ').filter(Boolean);
  const out: Record<string, string> = {};

  const moneyTokenRe = /^\d{1,3}(?:\.\d{3})*,\d{2}$|^\d+,\d{2}$/;
  const dateRe = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
  const txRe = /^\d{1,3},\d{1,4}$/;

  const digitsOnly = (s: string) => s.replace(/\D/g, '');
  const formatCpf = (digits: string) =>
    `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;

  if (/\btotal\b/i.test(cleaned) && digitsOnly(cleaned).length < 11) return {};

  const takeMoneyPrefix = () => {
    const pref: string[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
      if (!moneyTokenRe.test(tokens[i] ?? '')) break;
      pref.push(tokens[i] as string);
      if (pref.length >= 4) break;
    }
    if (pref.length === 4) {
      out['Valor Parcela'] = pref[0] ?? '';
      out['Valor Juros'] = pref[1] ?? '';
      out['Valorização'] = pref[2] ?? '';
      out['Rendas Apropriar'] = pref[3] ?? '';
      return 4;
    }
    return 0;
  };

  const startIdx = takeMoneyPrefix();

  const isInvalidCpfDigits = (digits: string) =>
    digits.length === 11 && /^(\d)\1{10}$/.test(digits);

  let cpfIndex = -1;
  let cpfSpan = 0;
  let cpfValue = '';
  for (let i = 0; i < tokens.length; i += 1) {
    const d1 = digitsOnly(tokens[i] ?? '');
    if (d1.length === 11 && !isInvalidCpfDigits(d1)) {
      cpfIndex = i;
      cpfSpan = 1;
      cpfValue = formatCpf(d1);
      break;
    }
    const d2 = digitsOnly(tokens[i + 1] ?? '');
    if (d1.length === 9 && d2.length === 2 && !isInvalidCpfDigits(d1 + d2)) {
      cpfIndex = i;
      cpfSpan = 2;
      cpfValue = formatCpf(d1 + d2);
      break;
    }
    const d3 = digitsOnly(tokens[i + 2] ?? '');
    const d4 = digitsOnly(tokens[i + 3] ?? '');
    if (
      d1.length === 3 &&
      d2.length === 3 &&
      d3.length === 3 &&
      d4.length === 2 &&
      !isInvalidCpfDigits(d1 + d2 + d3 + d4)
    ) {
      cpfIndex = i;
      cpfSpan = 4;
      cpfValue = formatCpf(d1 + d2 + d3 + d4);
      break;
    }
  }
  if (cpfIndex !== -1 && cpfValue) out.CPF = cpfValue;

  let telefoneIndex =
    cpfIndex > 0 && /^\d{8,11}$/.test(tokens[cpfIndex - 1] ?? '')
      ? cpfIndex - 1
      : -1;
  if (telefoneIndex === -1 && cpfIndex !== -1) {
    for (let i = cpfIndex - 1; i >= 0; i -= 1) {
      const t = String(tokens[i] ?? '');
      if (/^\d{8,11}$/.test(t)) {
        telefoneIndex = i;
        break;
      }
    }
  }
  if (telefoneIndex !== -1) out.Telefone = tokens[telefoneIndex] ?? '';

  const findClienteTokenInRange = (
    fromIdx: number,
    toIdx: number,
  ): { cliente: string; idx: number; span: number } | null => {
    const start = Math.max(0, fromIdx);
    const end = Math.min(tokens.length - 1, toIdx);
    for (let i = start; i <= end; i += 1) {
      const t0 = String(tokens[i] ?? '');
      if (/^\d{1,10}-\d{1,4}$/.test(t0)) return { cliente: t0, idx: i, span: 1 };
      const t1 = String(tokens[i + 1] ?? '');
      const t2 = String(tokens[i + 2] ?? '');
      if (/^\d{1,10}$/.test(t0) && t1 === '-' && /^\d{1,4}$/.test(t2)) {
        return { cliente: `${t0}-${t2}`, idx: i, span: 3 };
      }
      if (/^\d{1,10}$/.test(t0) && /^-\d{1,4}$/.test(t1)) {
        return { cliente: `${t0}${t1}`, idx: i, span: 2 };
      }
      if (/^\d{1,10}-$/.test(t0) && /^\d{1,4}$/.test(t1)) {
        return { cliente: `${t0}${t1}`, idx: i, span: 2 };
      }
    }
    return null;
  };

  let clienteIdx = -1;
  let clienteSpan = 0;
  const foundCliente =
    cpfIndex !== -1
      ? findClienteTokenInRange(startIdx, Math.max(startIdx, cpfIndex))
      : findClienteTokenInRange(startIdx, tokens.length - 1);
  if (foundCliente) {
    clienteIdx = foundCliente.idx;
    clienteSpan = foundCliente.span;
    out.Cliente = foundCliente.cliente;
  }

  const matriculaIdx =
    clienteIdx !== -1
      ? (() => {
          const start = clienteIdx + Math.max(1, clienteSpan || 1);
          for (let i = start; i < Math.min(tokens.length, start + 6); i += 1) {
            const t = String(tokens[i] ?? '');
            if (/^\d{1,10}$/.test(t)) return i;
            if (cpfIndex !== -1 && i >= cpfIndex) break;
          }
          return -1;
        })()
      : -1;
  if (matriculaIdx !== -1) out['Matrícula'] = tokens[matriculaIdx] ?? '';

  const nomeStart =
    matriculaIdx !== -1
      ? matriculaIdx + 1
      : clienteIdx !== -1
        ? clienteIdx + Math.max(1, clienteSpan || 1)
        : startIdx;
  const nomeEnd =
    telefoneIndex !== -1 ? telefoneIndex : cpfIndex !== -1 ? cpfIndex : -1;
  if (nomeEnd !== -1 && nomeEnd > nomeStart) {
    const nome = tokens.slice(nomeStart, nomeEnd).join(' ').trim();
    if (nome) out.Nome = nome;
  }
  if (cpfIndex !== -1) {
    const segStart =
      clienteIdx !== -1 ? clienteIdx + Math.max(1, clienteSpan || 1) : startIdx;
    const segEnd = telefoneIndex !== -1 ? telefoneIndex : cpfIndex;
    if (segEnd !== -1 && segEnd > segStart) {
      const between = tokens.slice(segStart, segEnd);
      const lettersOnly = between.filter((t) => /[A-Za-zÀ-ÿ]/.test(String(t ?? '')));
      const candidate = lettersOnly.join(' ').trim().replace(/\s+/g, ' ');
      if (candidate && !/\bPESSOA\s+(FISICA|JURIDICA)\b/i.test(candidate)) {
        const existing = typeof out.Nome === 'string' ? out.Nome.trim() : '';
        if (!existing || /\d/.test(existing)) out.Nome = candidate;
      }
    }
  }

  if (cpfIndex !== -1) {
    const after = tokens.slice(cpfIndex + Math.max(1, cpfSpan));

    const opToken = after.find((t) => /^\d{3,}(?:-\d+)?$/.test(t ?? '')) ?? '';
    if (opToken) out['Operação'] = opToken;

    const opIdx = opToken ? after.indexOf(opToken) : -1;
    if (opIdx !== -1) {
      const window = after.slice(opIdx + 1, opIdx + 8);
      const parcelaToken = window.find((t) => /^\d{1,5}$/.test(t ?? '')) ?? '';
      if (parcelaToken) out.Parcela = parcelaToken;

      const modToken =
        window.find((t) => /^[A-Z]{2,10}$/.test(t ?? '')) ?? '';
      if (modToken) out.Modalidade = modToken;
    }

    const dates = after.filter((t) => dateRe.test(t ?? ''));
    if (dates[0]) out['Vencto. Operação'] = dates[0];
    if (dates[1]) out.Vencimento = dates[1];

    const txToken = after.find((t) => txRe.test(t ?? '')) ?? '';
    if (txToken) out['Tx. Juros'] = txToken;

    const ignore = new Set<string>();
    for (const k of [
      'Tx. Juros',
      'Valor Parcela',
      'Valor Juros',
      'Valorização',
      'Rendas Apropriar',
    ] as const) {
      const v = out[k];
      if (v) ignore.add(v);
    }

    const toNumber = (raw: string) => {
      const s = raw.replace(/\./g, '').replace(',', '.');
      const n = Number.parseFloat(s);
      return Number.isFinite(n) ? n : Number.NaN;
    };

    const moneyCandidates = after
      .filter((t) => moneyTokenRe.test(t ?? ''))
      .map((t) => String(t ?? ''))
      .filter((t) => !ignore.has(t));
    if (moneyCandidates.length > 0) {
      let best = moneyCandidates[0] ?? '';
      let bestVal = toNumber(best);
      for (const c of moneyCandidates) {
        const v = toNumber(c);
        if (Number.isFinite(v) && (!Number.isFinite(bestVal) || v > bestVal)) {
          best = c;
          bestVal = v;
        }
      }
      if (best) out['Valor Operação'] = best;
    }
  }

  const activityMatch = /\bPESSOA\s+(FISICA|JURIDICA)\b/i.exec(cleaned);
  if (activityMatch) out.Atividade = `PESSOA ${activityMatch[1]?.toUpperCase() ?? ''}`.trim();

  return out;
}

function parseRelatorioOperacaoLine(value: string): Record<string, string> {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  const tokens = cleaned.split(' ').filter(Boolean);
  const out: Record<string, string> = {};

  if (tokens.length < 3) return out;
  if (/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(cleaned)) return out;
  const op = String(tokens[0] ?? '');
  if (!/^\d{3,}(?:-\d+)?$/.test(op)) return out;
  out['Operação'] = op;

  const parcela = String(tokens.find((t, idx) => idx > 0 && /^\d{1,5}$/.test(String(t ?? ''))) ?? '');
  if (parcela) out.Parcela = parcela;

  const modalidade =
    String(tokens.find((t) => /^[A-Z]{2,10}$/.test(String(t ?? ''))) ?? '');
  if (modalidade) out.Modalidade = modalidade;

  const dateRe = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
  const dates = tokens.filter((t) => dateRe.test(String(t ?? ''))).map((t) => String(t));
  if (dates[0]) out['Vencto. Operação'] = dates[0];
  if (dates[1]) out.Vencimento = dates[1];

  const txRe = /^\d{1,3},\d{1,4}$/;
  const tx = tokens.find((t) => txRe.test(String(t ?? '')));
  if (tx) out['Tx. Juros'] = String(tx);

  const moneyRe = /^\d{1,3}(?:\.\d{3})*,\d{2}$|^\d+,\d{2}$/;
  const money = tokens.filter((t) => moneyRe.test(String(t ?? ''))).map((t) => String(t));
  if (dates.length === 0 && money.length === 0) return {};
  if (money.length >= 4) {
    out['Valor Parcela'] = money[money.length - 4] ?? '';
    out['Valor Juros'] = money[money.length - 3] ?? '';
    out['Valorização'] = money[money.length - 2] ?? '';
    out['Rendas Apropriar'] = money[money.length - 1] ?? '';
  }
  if (money.length >= 5) {
    out['Valor Operação'] = money[money.length - 5] ?? '';
  }
  if (money.length > 0 && !out['Valor Parcela']) {
    out['Valor Parcela'] = money[money.length - 1] ?? '';
  }

  return out;
}

async function readRelatorioPdfTable(
  fileName: string,
  file: Buffer,
): Promise<{
  headers: string[];
  rows: Array<Record<string, unknown>>;
}> {
  const looksLikePdf = (() => {
    const idx = file.indexOf(Buffer.from('%PDF'));
    return idx !== -1 && idx < 1024;
  })();
  if (!isPdfFile(fileName) && !looksLikePdf) {
    throw new Error('Relatório deve ser importado a partir de PDF.');
  }

  const parsed = await extractPdf(file);
  const pages = Array.isArray(parsed.pages) && parsed.pages.length > 0
    ? parsed.pages
    : [{ num: 1, text: String(parsed.text ?? ''), tables: [] as string[][][] }];

  const parseRelatorioLiquidacaoRows = (rawPages: string[]) => {
    const content = rawPages.map((t) => String(t ?? '')).join('\n').replace(/\r/g, '\n');
    const lines = content
      .split('\n')
      .map((l) => l.trim().replace(/\s+/g, ' '))
      .filter(Boolean);

    const looksLikeLiquidacao = lines.some((l) =>
      /movimento\s+de\s+liquida[cç][õo]es\s+em\s+folha/i.test(l),
    );
    if (!looksLikeLiquidacao) return [] as Array<Record<string, unknown>>;

    const empresa =
      (() => {
        for (const p of rawPages) {
          const e = pickEmpresaFromPageText(String(p ?? ''));
          if (e) return e;
        }
        return '';
      })() || '';

    const competencia =
      (() => {
        const periodoLine =
          lines.find((l) => /\bper[ií]odo\b\s*:/i.test(l)) ?? '';
        const dates = periodoLine.match(/\d{2}\/\d{2}\/\d{4}/g) ?? [];
        const d0 = dates[0] ?? '';
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d0);
        if (!m) return '';
        let mm = Number(m[2]);
        let yyyy = Number(m[3]);
        if (!Number.isFinite(mm) || !Number.isFinite(yyyy)) return '';
        mm -= 1;
        if (mm < 1) {
          mm = 12;
          yyyy -= 1;
        }
        const yy = String(yyyy % 100).padStart(2, '0');
        return `${String(mm).padStart(2, '0')}/${yy}`;
      })() || '';

    const out: Array<Record<string, unknown>> = [];
    let currentEmpresa = empresa;
    let currentCliente = '';
    let currentNome = '';
    let currentMatricula = '';
    let currentCpf = '';
    let countCpf = 0;
    let countOp = 0;
    let countOpWithMoney = 0;

    const dateRe = /\d{2}\/\d{2}\/\d{4}/g;
    const moneyRe = /\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}/g;
    const cpfRe = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/;

    const normalizeEmpresaInline = (raw: string) => {
      const cleaned = raw.trim().replace(/\s+/g, ' ');
      if (!cleaned) return '';
      const m = /^(\d{1,5})\s*-\s*(.+)$/.exec(cleaned);
      if (!m) return '';
      const code = (m[1] ?? '').trim();
      const name = (m[2] ?? '').trim().replace(/\s+/g, ' ');
      if (!code || !name) return '';
      if (name.length < 6) return '';
      if (!/[A-Za-zÀ-ÿ]/.test(name)) return '';
      if (/^\d/.test(name)) return '';
      return `${code} - ${name}`.slice(0, 220).trim();
    };

    const empresaFromLineWithLookahead = (idx: number) => {
      const line = lines[idx] ?? '';
      const up = line.toUpperCase();
      if (up.includes('TOTAL') || up.includes('MOVIMENTO DE LIQUIDA')) return '';

      const explicit = /\bEMPRESA\b\s*(?::|\s)\s*(.+)$/i.exec(line)?.[1] ?? '';
      const c1 = normalizeEmpresaInline(explicit);
      if (c1) return c1;

      const c2 = normalizeEmpresaInline(line);
      if (c2) {
        const next = lines[idx + 1] ?? '';
        const nextTrim = next.trim().replace(/\s+/g, ' ');
        const nextLooksLikeContinuation =
          nextTrim.length >= 6 &&
          !/\d{2}\/\d{2}\/\d{4}/.test(nextTrim) &&
          !cpfRe.test(nextTrim) &&
          !/^\d+(?:-\d+)?\s+\d+\s+\d+/.test(nextTrim) &&
          !/\bEMPRESA\b/i.test(nextTrim);
        if (nextLooksLikeContinuation) {
          return `${c2} ${nextTrim}`.replace(/\s+/g, ' ').slice(0, 220).trim();
        }
        return c2;
      }

      return '';
    };

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      const emp = empresaFromLineWithLookahead(i);
      if (emp) {
        currentEmpresa = emp;
        continue;
      }
      if (cpfRe.test(line)) {
        countCpf += 1;
        const tokens = line.split(' ');
        const cpfMatch = line.match(cpfRe);
        if (cpfMatch) {
          currentCpf = cpfMatch[0];
          const cpfIndex = tokens.findIndex((t) => t.includes(currentCpf));
          if (cpfIndex > 0) {
            currentMatricula = tokens[cpfIndex - 1];
            currentCliente = tokens[0];
            currentNome = tokens.slice(1, cpfIndex - 1).join(' ');
          }
        }
        continue;
      }

      if (/^\d+(?:-\d+)?\s+\d+\s+\d+/.test(line)) {
        countOp += 1;
        const dates = Array.from(line.matchAll(dateRe)).map((m) => m[0]);
        const moneys = Array.from(line.matchAll(moneyRe)).map((m) => m[0]);
        const tokens = line.split(' ');

        const operacao = tokens[0];
        const parcela = tokens[2];
        const vencimento = dates[0] ?? '';

        if (moneys.length >= 6) {
          countOpWithMoney += 1;
          const valorOperacao = moneys[0];
          const valorParcela = moneys[5];

          out.push({
            ...(currentEmpresa ? { EMPRESA: currentEmpresa } : {}),
            ...(competencia ? { Copetencia: competencia } : {}),
            Cliente: currentCliente,
            Matrícula: currentMatricula,
            CPF: currentCpf,
            Nome: currentNome,
            Operação: operacao,
            Parcela: parcela,
            Vencimento: vencimento,
            'Valor Operação': valorOperacao,
            'Valor Parcela': valorParcela,
          });
        }
      }
    }
    if (process.env.RELATORIO_PDF_DEBUG === '1') {
      process.stdout.write(
        `Relatório PDF debug: liquidacao_parser | cop=${competencia || '-'} | cpf=${countCpf} | op=${countOp} | op_money=${countOpWithMoney} | out=${out.length}\n`,
      );
    }
    return out;
  };

  const parseOperacoesVencidasRows = (rawPages: string[]) => {
    const content = rawPages.map((t) => String(t ?? '')).join('\n').replace(/\r/g, '\n');
    const lines = content
      .split('\n')
      .map((l) => l.trim().replace(/\s+/g, ' '))
      .filter(Boolean);

    const looksLikeOperacoesVencidas =
      /opera[cç][aã]o/i.test(fileName) && /vencid/i.test(fileName) ||
      lines.some((l) => /total\s+receber/i.test(l)) ||
      lines.some((l) => /\bvalor\s+nominal\b/i.test(l));
    if (!looksLikeOperacoesVencidas) return [] as Array<Record<string, unknown>>;

    const isHeaderLine = (l: string) => {
      const up = l.toUpperCase();
      if (up.includes('CLIENTE') && up.includes('CPF') && up.includes('NOME')) return true;
      if (up.includes('ATIVIDADE') && up.includes('TELEFONE')) return true;
      if (up.includes('TOTAL RECEBER') || up.includes('VALOR NOMINAL')) return true;
      if (up.includes('OPERA') && up.includes('MODALIDADE') && up.includes('VENC')) return true;
      return false;
    };

    const cpfRe = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
    const rowStartRe =
      /^\d+\s+\d+\s+\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;

    const rowBuffers: string[] = [];
    let cur = '';
    for (const l0 of lines) {
      const l = l0.trim();
      if (!l) continue;
      if (/^total\s+/i.test(l)) {
        if (cur) rowBuffers.push(cur);
        cur = '';
        continue;
      }
      if (isHeaderLine(l)) continue;
      if (rowStartRe.test(l)) {
        if (cur) rowBuffers.push(cur);
        cur = l;
        continue;
      }
      if (cur) {
        cur = `${cur} ${l}`.trim().replace(/\s+/g, ' ');
        continue;
      }
    }
    if (cur) rowBuffers.push(cur);

    const dateRe = /\b\d{2}\/\d{2}\/\d{4}\b/g;
    const moneyRe =
      /\b\d{1,3}(?:\.\d{3})*,\d{2}\b|\b\d+,\d{2}\b|\b\d+\.\d{2}\b/g;
    const opRe = /\b\d{4,}-\d+\b|\b\d{6,}\b/g;
    const phoneRe = /\(\d{2}\)\s*\d{4,5}-\d{4}/;

    const empresaFromText = (rawText: string): string => {
      const trimmed = rawText.trim().replace(/\s+/g, ' ');
      if (!trimmed) return '';
      const tre =
        /\bTRIBUNAL\s+REGIONAL\s+ELEITORAL\b/i.test(trimmed) ? 'TRIBUNAL REGIONAL ELEITORAL' : '';
      if (tre) return tre;
      const emp = /\bEMP-\d+\b/i.exec(trimmed)?.[0] ?? '';
      return emp ? emp.toUpperCase() : '';
    };

    const empresa =
      (() => {
        for (const p of rawPages) {
          const e = empresaFromText(String(p ?? ''));
          if (e) return e;
        }
        return '';
      })() || '';

    const out: Array<Record<string, unknown>> = [];
    for (const rowText of rowBuffers) {
      if (!cpfRe.test(rowText)) continue;

      const m0 = /^(\d+)\s+(\d+)\s+(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\s+(.+)$/.exec(
        rowText,
      );
      if (!m0) continue;
      const cliente = (m0[1] ?? '').trim();
      const matricula = (m0[2] ?? '').trim();
      const cpf = (m0[3] ?? '').trim();
      const tail = (m0[4] ?? '').trim();

      const ops = Array.from(tail.matchAll(opRe)).map((x) => x[0]).filter(Boolean);
      const operacao = ops[0] ?? '';

      const tailTokens = tail.split(' ').filter(Boolean);
      let modalidade = '';
      for (const t of tailTokens) {
        const cleaned = t.trim();
        const mMod = /^(?:\d{1,6}-)?([A-Z]{3,6})$/.exec(cleaned.toUpperCase());
        if (!mMod) continue;
        const code = (mMod[1] ?? '').trim();
        if (!code) continue;
        if (['CPF', 'CLIENTE', 'NOME', 'DIAS', 'IOF'].includes(code)) continue;
        modalidade = code;
        break;
      }

      const dates = Array.from(tail.matchAll(dateRe)).map((x) => x[0]).filter(Boolean);
      const vencimento = dates[0] ?? '';

      const money = Array.from(tail.matchAll(moneyRe)).map((x) => x[0]).filter(Boolean);
      const valorOperacao = money[0] ?? '';
      const valorParcela = money.length > 0 ? money[money.length - 1] : '';

      const telefone = phoneRe.exec(tail)?.[0] ?? '';

      const nome = (() => {
        if (!modalidade) return tail;
        const idx = tailTokens.findIndex((t) =>
          /^(?:\d{1,6}-)?[A-Z]{3,6}$/i.test(t),
        );
        if (idx <= 0) return tail;
        const before = tailTokens.slice(0, idx).join(' ');
        const stopIdx = before.search(opRe);
        const namePart = (stopIdx >= 0 ? before.slice(0, stopIdx) : before)
          .trim()
          .replace(/\s+/g, ' ');
        return namePart || before;
      })();

      if (!operacao || !modalidade || !vencimento || !valorParcela) continue;

      out.push({
        ...(empresa ? { EMPRESA: empresa } : {}),
        Cliente: cliente,
        Matrícula: matricula,
        CPF: cpf,
        Nome: nome,
        ...(telefone ? { Telefone: telefone } : {}),
        Operação: operacao,
        Modalidade: modalidade,
        'Vencto. Operação': vencimento,
        Parcela: '',
        Vencimento: vencimento,
        ...(valorOperacao ? { 'Valor Operação': valorOperacao } : {}),
        ...(valorParcela ? { 'Valor Parcela': valorParcela } : {}),
      });
    }

    return out;
  };

  const pickEmpresaFromPageText = (rawText: string): string => {
    const content = rawText.replace(/\r/g, '\n');
    const empresaExplicit = (() => {
      const header = content.split('\n').slice(0, 450).join('\n');
      const re = /\bEMPRESA\b\s*(?::|\s)\s*/gi;
      const candidates: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(header))) {
        const before = header.slice(Math.max(0, m.index - 12), m.index).toLowerCase();
        if (before.includes('total')) continue;
        const start = m.index + m[0].length;
        const tail = header.slice(start, start + 300);
        const endOfLine = tail.indexOf('\n');
        const line1 = (endOfLine === -1 ? tail : tail.slice(0, endOfLine))
          .trim()
          .replace(/\s+/g, ' ');
        const line2 = (endOfLine === -1 ? '' : tail.slice(endOfLine + 1))
          .split('\n')[0]
          ?.trim()
          .replace(/\s+/g, ' ');
        const merged = `${line1} ${line2}`.trim().replace(/\s+/g, ' ');
        if (merged) candidates.push(merged);
      }
      if (candidates.length === 0) return '';

      const nextLabelRe =
        /(?:CENTRAL|COOPERATIVA|PER[IÍ]ODO|DATA|HORA|ÓRGÃO|ORGÃO|ORGAO)\s*:/i;

      const bestByCode = (raw: string) => {
        const nextLabelIdx = raw.search(nextLabelRe);
        const cutRaw = (nextLabelIdx === -1 ? raw : raw.slice(0, nextLabelIdx))
          .trim()
          .replace(/\s+/g, ' ');
        if (!cutRaw) return '';

        const entries: Array<{ code: number; value: string }> = [];
        const entryRe =
          /(\d{1,5})\s*-\s*([^0-9]{6,}?)(?=(?:\s+\d{1,5}\s*-\s*)|$)/g;
        let em: RegExpExecArray | null;
        while ((em = entryRe.exec(cutRaw))) {
          const code = Number.parseInt(em[1] ?? '', 10);
          const name = (em[2] ?? '').trim().replace(/\s+/g, ' ');
          if (!Number.isFinite(code) || !name) continue;
          entries.push({ code, value: `${code} - ${name}`.slice(0, 220).trim() });
        }

        if (entries.length > 0) {
          return entries[entries.length - 1]?.value ?? cutRaw;
        }

        return cutRaw;
      };

      for (const c of candidates) {
        const v = bestByCode(c);
        if (v) return v;
      }
      return bestByCode(candidates[0] ?? '');
    })();
    if (empresaExplicit) return empresaExplicit;

    const matches: string[] = [];
    const re =
      /\b(?:EMPRESA|CONV[ÊE]NIO|CONVENIO|ORG[ÃA]O|ORGAO|EMPREGADOR|ENTIDADE)\s*(?::|\s)\s*(.+?)(?=\n|$)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) {
      const v = (m[1] ?? '').trim().replace(/\s+/g, ' ');
      if (v) matches.push(v);
    }
    const generic: string[] = [];
    const genericRe =
      /\b(\d{1,5})\s*-\s*([A-ZÇÁÉÍÓÚÂÊÔÃÕ][^\n]{8,}?)(?=\n|$)/g;
    while ((m = genericRe.exec(content))) {
      const code = (m[1] ?? '').trim();
      const name = (m[2] ?? '').trim().replace(/\s+/g, ' ');
      if (!code || !name) continue;
      const v = `${code} - ${name}`.slice(0, 220).trim();
      generic.push(v);
    }

    const candidates = matches.length > 0 ? matches : generic;
    if (candidates.length === 0) return '';
    const preferred = candidates.filter((v) => /^\d+\s*-\s*/.test(v));
    const list = preferred.length > 0 ? preferred : candidates;
    if (list.length === 1) return list[0] ?? '';
    let best = list[0] ?? '';
    let bestCode = Number.POSITIVE_INFINITY;
    for (const v of list) {
      const m = /^(\d+)\s*-\s*/.exec(v);
      const code = m ? Number.parseInt(m[1] ?? '', 10) : Number.POSITIVE_INFINITY;
      if (Number.isFinite(code) && code < bestCode) {
        bestCode = code;
        best = v;
      }
    }
    return best;
  };

  const fixedHeaderKeys: Array<{
    key: (typeof RELATORIO_PDF_COLUMNS)[number];
    patterns: RegExp[];
  }> = [
    { key: 'Cliente', patterns: [/\bcliente\b/i] },
    { key: 'Matrícula', patterns: [/\bmatr[ií]cula\b/i] },
    { key: 'CPF', patterns: [/\bcpf\b/i] },
    { key: 'Nome', patterns: [/\bnome\b/i] },
    {
      key: 'Operação',
      patterns: [/\bopera[cç][aã]o\b/i, /\boperacao\b/i],
    },
    { key: 'Modalidade', patterns: [/\bmodalidade\b/i, /\bmod\.\b/i] },
    {
      key: 'Vencto. Operação',
      patterns: [
        /\bvencto\.?\s*opera[cç][aã]o\b/i,
        /\bvencto\.?\s*operacao\b/i,
        /\bvencto\b/i,
      ],
    },
    { key: 'Tx. Juros', patterns: [/\btx\.?\s*juros\b/i, /\btaxa\s*juros\b/i] },
    { key: 'Parcela', patterns: [/\bparcela\b/i] },
    { key: 'Vencimento', patterns: [/\bvencimento\b/i] },
    {
      key: 'Valor Operação',
      patterns: [
        /\bvalor\s*opera[cç][aã]o\b/i,
        /\bvalor\s*operacao\b/i,
        /\bvlr\.?\s*opera[cç][aã]o\b/i,
        /\bvlr\.?\s*operacao\b/i,
      ],
    },
    { key: 'Valor Parcela', patterns: [/\bvalor\s*parcela\b/i, /\bvlr\.?\s*parcela\b/i] },
    { key: 'Valor Juros', patterns: [/\bvalor\s*juros\b/i, /\bvlr\.?\s*juros\b/i] },
    {
      key: 'Valorização',
      patterns: [/\bvaloriz[aç][aã]o\b/i, /\bvalorizacao\b/i],
    },
    {
      key: 'Rendas Apropriar',
      patterns: [/\brendas?\s*apropriar\b/i, /\brendas?\s*aprop/i],
    },
  ];

  const cpfRe = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/;

  const headerKeyByNormalized = new Map<string, (typeof RELATORIO_PDF_COLUMNS)[number]>([
    ['cliente', 'Cliente'],
    ['matricula', 'Matrícula'],
    ['cpf', 'CPF'],
    ['nome', 'Nome'],
    ['atividade', 'Atividade'],
    ['telefone', 'Telefone'],
    ['operacao', 'Operação'],
    ['modalidade', 'Modalidade'],
    ['vencto operacao', 'Vencto. Operação'],
    ['vencto operacao', 'Vencto. Operação'],
    ['tx juros', 'Tx. Juros'],
    ['taxa juros', 'Tx. Juros'],
    ['parcela', 'Parcela'],
    ['vencimento', 'Vencimento'],
    ['valor operacao', 'Valor Operação'],
    ['valor da operacao', 'Valor Operação'],
    ['valor parcela', 'Valor Parcela'],
    ['valor juros', 'Valor Juros'],
    ['valorizacao', 'Valorização'],
    ['rendas apropriar', 'Rendas Apropriar'],
  ]);

  const expectedHeaderSignals = new Set([
    'cliente',
    'cpf',
    'matricula',
    'nome',
    'operacao',
    'modalidade',
  ]);
 
  const allRows: Array<Record<string, unknown>> = [];

  const variantsByKey: Array<{ key: string; variants: string[] }> = [
    { key: 'EMPRESA', variants: ['EMPRESA'] },
    { key: 'Cliente', variants: ['Cliente'] },
    { key: 'Matrícula', variants: ['Matrícula', 'Matricula'] },
    { key: 'CPF', variants: ['CPF'] },
    { key: 'Nome', variants: ['Nome'] },
    { key: 'Atividade', variants: ['Atividade'] },
    { key: 'Telefone', variants: ['Telefone'] },
    { key: 'Operação', variants: ['Operação', 'Operacao'] },
    { key: 'Modalidade', variants: ['Modalidade'] },
    {
      key: 'Vencto. Operação',
      variants: [
        'Vencto. Operação',
        'Vencto. Operacao',
        'Vencto Operação',
        'Vencto Operacao',
      ],
    },
    { key: 'Tx. Juros', variants: ['Tx. Juros', 'Tx Juros', 'Taxa Juros'] },
    { key: 'Parcela', variants: ['Parcela'] },
    { key: 'Vencimento', variants: ['Vencimento'] },
    {
      key: 'Valor Operação',
      variants: [
        'Valor Operação',
        'Valor Operacao',
        'Valor da Operação',
        'Valor da Operacao',
      ],
    },
    { key: 'Valor Parcela', variants: ['Valor Parcela'] },
    { key: 'Valor Juros', variants: ['Valor Juros'] },
    { key: 'Valorização', variants: ['Valorização', 'Valorizacao'] },
    { key: 'Rendas Apropriar', variants: ['Rendas Apropriar'] },
  ];

  const labelToKey = new Map<string, string>();
  const allLabelVariants: string[] = [];
  for (const entry of variantsByKey) {
    for (const v of entry.variants) {
      labelToKey.set(normalizePdfLabel(v), entry.key);
      allLabelVariants.push(v);
    }
  }

  const labelRegex = new RegExp(
    `(${allLabelVariants
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join('|')})\\s*(?:[\\.·•_\\-]{1,40}\\s*)?:\\s*`,
    'gi',
  );

  let fallbackCarryBase: Record<string, unknown> | null = null;
  let fallbackCarryHasOperation = false;

  for (const page of pages) {
    const rowsBeforePage = allRows.length;
    const rawText = String(page.text ?? '').replace(/\r/g, '\n');
    const text = rawText.replace(/[ \t]+/g, ' ');
    const empresa = pickEmpresaFromPageText(rawText);
    const rawLines = rawText
      .split('\n')
      .map((l) => l.replace(/\s+$/g, ''))
      .filter((l) => l.trim().length > 0);

    const hasClienteLabel =
      /(?:^|\n)\s*Cliente\s*(?:[\\.·•_\\-]{1,40}\s*)?:/i.test(rawText);
    let fallbackFixedRows: Array<Record<string, unknown>> | null = null;
    if (hasClienteLabel) {
      fallbackCarryBase = null;
      fallbackCarryHasOperation = false;
    }

    const debugMatchRaw = process.env.RELATORIO_PDF_DEBUG_MATCH ?? '';
    if (process.env.RELATORIO_PDF_DEBUG === '1' && debugMatchRaw.trim().length > 0) {
      const needles = debugMatchRaw
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
      const foundNeedles = needles.filter((n) =>
        rawText.toLowerCase().includes(n.toLowerCase()),
      );
      if (foundNeedles.length > 0) {
        process.stdout.write(
          `Relatório PDF debug: match page=${page.num} EMPRESA=${empresa || '-'} needles=${foundNeedles.join(' | ')}\n`,
        );
        let shown = 0;
        for (const line of rawLines) {
          const hit = foundNeedles.some((n) =>
            line.toLowerCase().includes(n.toLowerCase()),
          );
          if (!hit) continue;
          process.stdout.write(`Relatório PDF debug: match_line=${line}\n`);
          shown += 1;
          if (shown >= 12) break;
        }
      }
    }

    if (!hasClienteLabel) {
      const fixedRows: Array<Record<string, unknown>> = [];
      let base: Record<string, unknown> | null = fallbackCarryBase;
      let baseHasOperation = fallbackCarryHasOperation;
      for (const line of rawLines) {
        if (/\btotal\b/i.test(line)) continue;
        const opFields = base ? parseRelatorioOperacaoLine(line) : {};
        if (base && typeof (opFields as any)['Operação'] === 'string') {
          fixedRows.push({ ...base, ...opFields });
          baseHasOperation = true;
          continue;
        }

        if (base) {
          const cpf = normalizeCpfValue((base as any).CPF);
          const nome = typeof (base as any).Nome === 'string' ? String((base as any).Nome).trim() : '';
          const normalized = normalizePdfLabel(line);
          const looksLikeActivity = /\bpessoa\s+(fisica|juridica)\b/i.test(line);
          const looksLikeHeaderish =
            /(cliente|matricula|cpf|nome|atividade|telefone|operacao|modalidade|vencimento|valor|juros|parcela|empresa|cooperativa|central)/i.test(
              normalized,
            );
          const looksLikeNameLine =
            cpf &&
            normalized.length >= 4 &&
            /[a-z]/i.test(line) &&
            !looksLikeActivity &&
            !looksLikeHeaderish &&
            !/\d/.test(line);
          if (looksLikeNameLine) {
            (base as any).Nome = (nome ? `${nome} ${line}` : line).replace(/\s+/g, ' ').trim();
            continue;
          }
          if (cpf && !nome && looksLikeActivity) {
            const m = /\bPESSOA\s+(FISICA|JURIDICA)\b/i.exec(line);
            if (m) (base as any).Atividade = `PESSOA ${String(m[1] ?? '').toUpperCase()}`.trim();
            continue;
          }
        }

        const parsedLine = parseRelatorioClienteLine(line);
        const parsedCliente = (parsedLine.Cliente ?? '').trim();
        const parsedCpf = typeof parsedLine.CPF === 'string' ? parsedLine.CPF.trim() : '';
        if (!/^\d+-\d+$/.test(parsedCliente) || !parsedCpf) continue;

        if (base && !baseHasOperation) fixedRows.push(base);

        const nextBase: Record<string, unknown> = empresa ? { EMPRESA: empresa } : {};
        nextBase.Cliente = parsedCliente;
        for (const col of RELATORIO_PDF_COLUMNS) {
          if (col === 'EMPRESA' || col === 'Cliente') continue;
          const v = (parsedLine as any)[col];
          if (typeof v === 'string' && v.trim().length > 0) (nextBase as any)[col] = v;
        }
        base = nextBase;
        baseHasOperation =
          typeof (base as any)['Operação'] === 'string' ||
          typeof (base as any)['Valor Operação'] === 'string' ||
          typeof (base as any)['Valor Parcela'] === 'string';

        if (baseHasOperation) {
          fixedRows.push(base);
          base = null;
          baseHasOperation = false;
        }
      }
      fallbackCarryBase = base;
      fallbackCarryHasOperation = baseHasOperation;
      if (fixedRows.length > 0) fallbackFixedRows = fixedRows;
    }

    if (!hasClienteLabel && fallbackFixedRows) {
      for (const r of fallbackFixedRows) allRows.push(r);
      continue;
    }

    const tables = Array.isArray(page.tables) ? page.tables : [];
    if (tables.length > 0) {
      type TableCandidate = {
        table: string[][];
        headerIndex: number;
        score: number;
      };
      let best: TableCandidate | null = null;
      for (const table of tables) {
        for (let i = 0; i < Math.min(table.length, 6); i += 1) {
          const row = table[i] ?? [];
          if (row.length < 3) continue;
          const normalizedCells = row
            .map((c) => normalizePdfLabel(String(c ?? '')))
            .filter(Boolean);
          const hitCount = normalizedCells.filter((c) =>
            expectedHeaderSignals.has(c),
          ).length;
          const score = hitCount * 100 + normalizedCells.length;
          if (score <= 0) continue;
          if (!best || score > best.score) best = { table, headerIndex: i, score };
        }
      }

      if (best) {
        const headerRow = best.table[best.headerIndex] ?? [];
        const headerKeys: Array<(typeof RELATORIO_PDF_COLUMNS)[number] | null> =
          headerRow.map((cell) => {
            const normalized = normalizePdfLabel(String(cell ?? ''));
            if (!normalized) return null;
            return headerKeyByNormalized.get(normalized) ?? null;
          });

        for (let r = best.headerIndex + 1; r < best.table.length; r += 1) {
          const row = best.table[r] ?? [];
          const joined = row.join(' ').toLowerCase();
          if (/\btotal\b/.test(joined)) continue;
          const obj: Record<string, unknown> = empresa ? { EMPRESA: empresa } : {};
          let filled = 0;
          for (let c = 0; c < headerKeys.length; c += 1) {
            const key = headerKeys[c];
            if (!key) continue;
            const value = String(row[c] ?? '').trim();
            if (!value) continue;
            obj[key] = key === 'CPF' ? normalizeCpfValue(value) : value;
            filled += 1;
          }
          const cpf = typeof (obj as any).CPF === 'string' ? normalizeCpfValue((obj as any).CPF) : '';
          const nome =
            typeof (obj as any).Nome === 'string' ? String((obj as any).Nome).trim() : '';
          if (cpf && !nome) {
            const rowLine = row.join(' ').replace(/\s+/g, ' ').trim();
            const parsedLine = parseRelatorioClienteLine(rowLine);
            const parsedNome = typeof parsedLine.Nome === 'string' ? parsedLine.Nome.trim() : '';
            if (parsedNome) (obj as any).Nome = parsedNome;
            if (!(obj as any).Cliente && typeof parsedLine.Cliente === 'string' && parsedLine.Cliente.trim()) {
              (obj as any).Cliente = parsedLine.Cliente.trim();
            }
            if (!(obj as any)['Matrícula'] && typeof (parsedLine as any)['Matrícula'] === 'string' && String((parsedLine as any)['Matrícula']).trim()) {
              (obj as any)['Matrícula'] = String((parsedLine as any)['Matrícula']).trim();
            }
          }
          if (filled > 0) allRows.push(obj);
        }
      }
    }

    type Token = { key: string; valueStart: number; labelStart: number };
    const tokens: Token[] = [];
    let m: RegExpExecArray | null;
    labelRegex.lastIndex = 0;
    while ((m = labelRegex.exec(text))) {
      const label = m[1] ?? '';
      if (m.index > 0 && !/\s/.test(text[m.index - 1] ?? '')) continue;
      const key = labelToKey.get(normalizePdfLabel(label));
      if (!key) continue;
      const before = text.slice(Math.max(0, m.index - 12), m.index);
      if (/total\s*$/i.test(before)) continue;
      tokens.push({ key, valueStart: labelRegex.lastIndex, labelStart: m.index });
    }

    const pageRows: Array<Record<string, unknown>> = [];
    let current: Record<string, unknown> = empresa ? { EMPRESA: empresa } : {};
    const flush = () => {
      const keyCount = Object.keys(current).length;
      const minKeys = empresa ? 2 : 1;
      if (keyCount >= minKeys) pageRows.push(current);
    };

    for (let i = 0; i < tokens.length; i += 1) {
      const t = tokens[i];
      const next = i + 1 < tokens.length ? tokens[i + 1] : null;
      const rawValue = text.slice(t.valueStart, next?.labelStart ?? text.length);
      const value = rawValue.replace(/\s+/g, ' ').trim();

      if (t.key === 'EMPRESA') continue;
      if (t.key === 'Cliente') {
        if (Object.keys(current).length > 0) flush();
        current = empresa ? { EMPRESA: empresa } : {};
      }
      if (value) current[t.key] = value;
    }
    flush();

    const validPageRows: Array<Record<string, unknown>> = [];
    for (const r of pageRows) {
      const clienteVal =
        typeof (r as any).Cliente === 'string' ? String((r as any).Cliente) : '';
      const onlyCliente =
        clienteVal.trim().length > 0 &&
        Object.keys(r).every((k) => k === 'EMPRESA' || k === 'Cliente');

      if (onlyCliente) {
        const parsedLine = parseRelatorioClienteLine(clienteVal);
        const parsedCliente = (parsedLine.Cliente ?? '').trim();
        if (!/^\d+-\d+$/.test(parsedCliente)) continue;
        (r as any).Cliente = parsedCliente;
        for (const [k, v] of Object.entries(parsedLine)) {
          if (k === 'Cliente') continue;
          (r as any)[k] = v;
        }
        validPageRows.push(r);
        continue;
      }

      const normalizedCliente = clienteVal.trim();
      if (normalizedCliente && !/^\d+-\d+$/.test(normalizedCliente)) continue;
      validPageRows.push(r);
    }

    for (const r of validPageRows) allRows.push(r);

    if (fallbackFixedRows && allRows.length === rowsBeforePage) {
      for (const r of fallbackFixedRows) allRows.push(r);
    }
  }

  if (allRows.length === 0) {
    const altLiquidacao = parseRelatorioLiquidacaoRows(pages.map((p) => String(p.text ?? '')));
    if (altLiquidacao.length > 0) {
      return { headers: [...RELATORIO_PDF_COLUMNS, 'Copetencia'], rows: altLiquidacao };
    }

    const alt = parseOperacoesVencidasRows(pages.map((p) => String(p.text ?? '')));
    if (alt.length > 0) {
      return { headers: [...RELATORIO_PDF_COLUMNS], rows: alt };
    }

    const joined = pages.map((p) => String(p.text ?? '')).join('\n');
    if (process.env.RELATORIO_PDF_DEBUG === '1') {
      const normalizedLines = joined
        .replace(/\r/g, '\n')
        .split('\n')
        .map((l) => l.trim().replace(/\s+/g, ' '))
        .filter(Boolean);
      const head = normalizedLines.slice(0, 40);
      const cpfRe = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
      const empresaHits = normalizedLines.filter((l) => /\bEMPRESA\b/i.test(l)).slice(0, 20);
      const dashHits = normalizedLines.filter((l) => /\b\d{1,5}\s*-\s*/.test(l)).slice(0, 20);
      const dashUnique = Array.from(
        new Set(
          normalizedLines
            .filter((l) => /^\d{1,5}\s*-\s*/.test(l))
            .map((l) => l.slice(0, 220).trim()),
        ),
      ).slice(0, 40);
      const cpfMatches = joined.match(cpfRe) ?? [];
      process.stdout.write(
        `Relatório PDF debug: ${fileName} | registros=0 | pages=${pages.length} | linhas=${normalizedLines.length} | cpf_matches=${cpfMatches.length} | empresa_linhas=${empresaHits.length} | codigo_linhas=${dashHits.length}\n`,
      );
      process.stdout.write(`Relatório PDF debug: head=${head.join(' || ')}\n`);
      if (empresaHits.length > 0) {
        process.stdout.write(`Relatório PDF debug: empresa_hits=${empresaHits.join(' | ')}\n`);
      }
      if (dashHits.length > 0) {
        process.stdout.write(`Relatório PDF debug: codigo_hits=${dashHits.join(' | ')}\n`);
      }
      if (dashUnique.length > 0) {
        process.stdout.write(`Relatório PDF debug: codigo_unique=${dashUnique.join(' | ')}\n`);
      }
    }
    const hasTotals =
      /total\s*(cliente|empresa|cooperativa|central|geral)\s*:/i.test(joined) ||
      /\bEMP-\d+\b/i.test(joined) ||
      /\btotal\s+receber\b/i.test(joined);
    const cpfMatches = joined.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g) ?? [];
    if (hasTotals && cpfMatches.length === 0) return { headers: [...RELATORIO_PDF_COLUMNS], rows: [] };
    throw new Error(
      'Relatório em PDF: não foi possível extrair registros (layout do arquivo pode ter mudado).',
    );
  }

  const cpfToNome = new Map<string, string>();
  for (const r of allRows) {
    const cpf = normalizeCpfValue((r as any).CPF);
    if (!cpf) continue;
    const nome = typeof (r as any).Nome === 'string' ? String((r as any).Nome).trim() : '';
    if (nome) cpfToNome.set(cpf, nome);
  }
  if (cpfToNome.size > 0) {
    for (const r of allRows) {
      const cpf = normalizeCpfValue((r as any).CPF);
      if (!cpf) continue;
      (r as any).CPF = cpf;
      const nome = typeof (r as any).Nome === 'string' ? String((r as any).Nome).trim() : '';
      if (!nome) {
        const best = cpfToNome.get(cpf) ?? '';
        if (best) (r as any).Nome = best;
      }
    }
  }

  if (process.env.RELATORIO_PDF_DEBUG === '1') {
    const empresas = new Set<string>();
    for (const r of allRows) {
      const e = typeof (r as any).EMPRESA === 'string' ? String((r as any).EMPRESA).trim() : '';
      if (e) empresas.add(e);
    }
    const empresasPagina = new Set<string>();
    for (const p of pages) {
      const e = pickEmpresaFromPageText(String(p.text ?? ''));
      if (e) empresasPagina.add(e);
    }
    const sampleRow = allRows[0] ?? {};
    const filledCols = RELATORIO_PDF_COLUMNS.filter(
      (c) =>
        typeof (sampleRow as any)[c] === 'string' &&
        String((sampleRow as any)[c]).trim().length > 0,
    );
    process.stdout.write(
      `Relatório PDF debug: ${fileName} | registros=${allRows.length} | empresas_linhas=${empresas.size} | empresas_paginas=${empresasPagina.size}\n`,
    );
    const previewPages = pages.slice(0, 5).map((p) => {
      const e = pickEmpresaFromPageText(String(p.text ?? '')) || '-';
      return `p${p.num}=${e}`;
    });
    process.stdout.write(
      `Relatório PDF debug: empresas_preview=${previewPages.join(' | ')}\n`,
    );
    const tablesPreview = pages.slice(0, 5).map((p) => {
      const t0 = Array.isArray((p as any).tables) ? (p as any).tables[0] : null;
      const rows = Array.isArray(t0) ? t0.length : 0;
      const cols = rows > 0 && Array.isArray(t0[0]) ? t0[0].length : 0;
      const count = Array.isArray((p as any).tables) ? (p as any).tables.length : 0;
      return `p${p.num}:tables=${count}:${rows}x${cols}`;
    });
    process.stdout.write(
      `Relatório PDF debug: tables_preview=${tablesPreview.join(' | ')}\n`,
    );
    const empSnippets = pages.slice(0, 3).map((p) => {
      const t = String(p.text ?? '').replace(/\r/g, '\n');
      const idx = t.toUpperCase().indexOf('EMPRESA');
      if (idx === -1) return `p${p.num}=sem_EMPRESA`;
      const from = Math.max(0, idx - 60);
      const to = Math.min(t.length, idx + 240);
      const snip = t.slice(from, to).replace(/\s+/g, ' ').trim();
      return `p${p.num}=${snip}`;
    });
    process.stdout.write(
      `Relatório PDF debug: empresa_snippet=${empSnippets.join(' || ')}\n`,
    );
    process.stdout.write(
      `Relatório PDF debug: colunas_preenchidas_amostra=${filledCols.join(' | ') || '-'}\n`,
    );
  }

  return { headers: [...RELATORIO_PDF_COLUMNS], rows: allRows };
}

async function readExtratoPdfTable(
  fileName: string,
  file: Buffer,
): Promise<{
  headers: string[];
  rows: Array<Record<string, unknown>>;
}> {
  const looksLikePdf = (() => {
    const idx = file.indexOf(Buffer.from('%PDF'));
    return idx !== -1 && idx < 1024;
  })();
  if (!isPdfFile(fileName) && !looksLikePdf) {
    throw new Error('Extrato deve ser importado a partir de PDF.');
  }

  const parsed = await extractPdf(file);
  const pages = Array.isArray(parsed.pages) && parsed.pages.length > 0
    ? parsed.pages
    : [{ num: 1, text: String(parsed.text ?? ''), tables: [] as string[][][] }];

  const normalizeCompetencia = (mm: number, yyyy: number) => {
    if (!Number.isFinite(mm) || !Number.isFinite(yyyy)) return '';
    if (mm < 1 || mm > 12) return '';
    const yy = String(yyyy % 100).padStart(2, '0');
    return `${String(mm).padStart(2, '0')}/${yy}`;
  };

  const normalizeString = (v: unknown) =>
    String(v ?? '')
      .replace(/\r/g, '\n')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const fileNameNorm = normalizeString(fileName)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const pickCompetenciaFromText = (content: string): string => {
    const t = content
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const periodRe = /(periodo|competencia)\s*:?\s*(\d{2})\s*[\/\-]\s*(\d{4})/i;
    const m = periodRe.exec(t);
    if (m) {
      const mm = Number(m[2]);
      const yyyy = Number(m[3]);
      const out = normalizeCompetencia(mm, yyyy);
      if (out) return out;
    }

    const anyMmYyyy = /\b(\d{2})\s*[\/\-]\s*(\d{4})\b/.exec(t);
    if (anyMmYyyy) {
      const mm = Number(anyMmYyyy[1]);
      const yyyy = Number(anyMmYyyy[2]);
      const out = normalizeCompetencia(mm, yyyy);
      if (out) return out;
    }

    const yearMatch = /\b(20\d{2})\b/.exec(fileNameNorm);
    const yyyy = yearMatch ? Number(yearMatch[1]) : NaN;
    const monthNames: Array<[string, number]> = [
      ['janeiro', 1],
      ['fevereiro', 2],
      ['marco', 3],
      ['abril', 4],
      ['maio', 5],
      ['junho', 6],
      ['julho', 7],
      ['agosto', 8],
      ['setembro', 9],
      ['outubro', 10],
      ['novembro', 11],
      ['dezembro', 12],
    ];
    for (const [name, mm] of monthNames) {
      if (fileNameNorm.includes(name) && Number.isFinite(yyyy)) {
        const out = normalizeCompetencia(mm, yyyy);
        if (out) return out;
      }
    }

    return '';
  };

  const competencia =
    pickCompetenciaFromText(pages.map((p) => String(p.text ?? '')).join('\n')) ||
    pickCompetenciaFromText(String(parsed.text ?? ''));

  const cpfTokenRe = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{11}\b/;
  const cpfTokenReGlobal = new RegExp(cpfTokenRe.source, 'g');
  const moneyRe =
    /\b\d{1,3}(?:\.\d{3})*,\d{2}\b|\b\d+,\d{2}\b|\b\d+\.\d{2}\b/g;

  const normalizeCpf = (v: string) => {
    const digits = v.replace(/\D/g, '');
    return digits.length === 11 ? digits : '';
  };

  const parseLine = (lineRaw: string): { nome: string; cpf: string; valor: string } | null => {
    const line = normalizeString(lineRaw);
    if (!line) return null;
    const up = line.toUpperCase();
    if (up.includes('TOTAL')) return null;
    if (/CPF/i.test(line) && /VLR|PARC|VALOR/i.test(line) && !cpfTokenRe.test(line))
      return null;

    const cpfMatches = Array.from(line.matchAll(cpfTokenReGlobal)).map((m) => m[0]);
    if (cpfMatches.length !== 1) return null;
    const cpfHit = cpfMatches[0] ?? '';
    const cpf = normalizeCpf(cpfHit);
    if (!cpf) return null;

    const moneys = Array.from(line.matchAll(moneyRe)).map((m) => m[0]);
    if (moneys.length === 0) return null;
    if (moneys.length > 4) return null;
    const valor = moneys[moneys.length - 1] ?? '';
    if (!valor) return null;

    const cpfIdx = line.indexOf(cpfHit);
    const nomeRaw = cpfIdx > 0 ? line.slice(0, cpfIdx).trim() : '';
    const nome = nomeRaw
      .replace(/^SERVIDOR\s*:?\s*/i, '')
      .replace(/^NOME\s*:?\s*/i, '')
      .replace(/^\d+\s*-\s*/i, '')
      .replace(/^\d+\s+/, '')
      .replace(/^-+\s*/, '')
      .replace(/\s*-\s*$/, '')
      .trim();

    return { nome, cpf, valor };
  };

  const extractMoneyToken = (s: string): string | null => {
    const matches = s.match(moneyRe);
    if (!matches || matches.length === 0) return null;
    const raw = matches[matches.length - 1] ?? '';
    if (!raw) return null;
    if (raw.includes(',')) return raw;
    return raw.replace('.', ',');
  };

  const parseServidorCell = (cellRaw: string): { nome: string; cpf: string } | null => {
    const cell = normalizeString(cellRaw);
    if (!cell) return null;
    const cpfMatch = cpfTokenRe.exec(cell);
    if (!cpfMatch) return null;
    const cpf = normalizeCpf(cpfMatch[0]);
    if (!cpf) return null;
    const cpfIdx = cell.indexOf(cpfMatch[0]);
    const nomeRaw = cpfIdx > 0 ? cell.slice(0, cpfIdx).trim() : '';
    const nome = nomeRaw
      .replace(/^SERVIDOR\s*:?\s*/i, '')
      .replace(/^NOME\s*:?\s*/i, '')
      .replace(/^\d+\s*-\s*/i, '')
      .replace(/^\d+\s+/, '')
      .replace(/^-+\s*/, '')
      .replace(/\s*-\s*$/, '')
      .trim();
    return { nome, cpf };
  };

  const rowsFromTables: Array<Record<string, unknown>> = [];
  const bestNameByCpf = new Map<string, string>();
  for (const p of pages) {
    const tables = Array.isArray(p.tables) ? p.tables : [];
    for (const t of tables) {
      if (!Array.isArray(t) || t.length === 0) continue;

      let headerIndex = -1;
      let idxServidor = -1;
      let idxVlrParc = -1;

      for (let i = 0; i < t.length; i += 1) {
        const row = t[i];
        if (!Array.isArray(row) || row.length === 0) continue;
        const cells = row.map((c) => normalizeString(c));
        const joined = cells.join(' ').toUpperCase();
        const looksLikeHeader =
          joined.includes('SERVIDOR') &&
          (joined.includes('VLR') || joined.includes('VALOR')) &&
          joined.includes('PARC');
        if (!looksLikeHeader) continue;

        headerIndex = i;
        idxServidor = cells.findIndex((c) => c.toUpperCase().includes('SERVIDOR'));
        idxVlrParc = cells.findIndex((c) => {
          const up = c.toUpperCase();
          return (up.includes('VLR') || up.includes('VALOR')) && up.includes('PARC');
        });
        break;
      }

      if (headerIndex < 0) continue;

      for (let i = headerIndex + 1; i < t.length; i += 1) {
        const row = t[i];
        if (!Array.isArray(row) || row.length === 0) continue;
        const cells = row.map((c) => normalizeString(c));

        const servidorCell = cells[idxServidor] ?? '';
        const servidor = parseServidorCell(servidorCell) ?? parseServidorCell(cells.join(' '));
        if (!servidor) continue;

        const valorCell = cells[idxVlrParc] ?? '';
        const valor =
          extractMoneyToken(valorCell) ??
          (() => {
            const joined = cells.join(' ');
            return extractMoneyToken(joined);
          })();
        if (!valor) continue;

        const nome = servidor.nome || '';
        const prev = bestNameByCpf.get(servidor.cpf) ?? '';
        if (nome && (!prev || nome.length > prev.length)) {
          bestNameByCpf.set(servidor.cpf, nome);
        }

        rowsFromTables.push({
          ...(nome ? { NOME: nome } : { NOME: '' }),
          NMR_CPF: servidor.cpf,
          VALOR: valor,
          Competencia: competencia || '',
        });
      }
    }
  }

  const candidateLines: string[] = [];
  for (const p of pages) {
    const tables = Array.isArray(p.tables) ? p.tables : [];
    for (const t of tables) {
      if (!Array.isArray(t)) continue;
      for (const row of t) {
        if (!Array.isArray(row)) continue;
        const joined = row.map((c) => normalizeString(c)).filter(Boolean).join(' ');
        if (joined) candidateLines.push(joined);
      }
    }
    const textLines = String(p.text ?? '')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const l of textLines) candidateLines.push(l);
  }

  const rows: Array<Record<string, unknown>> = [];
  let carry = '';
  for (const raw of candidateLines) {
    const rawLine = normalizeString(raw);
    if (!rawLine) continue;
    const line = carry ? `${carry} ${rawLine}`.trim() : rawLine;
    const parsedLine = parseLine(line);
    if (!parsedLine) {
      const up = line.toUpperCase();
      const isHeaderish =
        (up.includes('SERVIDOR') && up.includes('CPF')) ||
        up.includes('CORRESP') ||
        up.includes('SERVIÇO') ||
        up.includes('VLR') ||
        up.includes('PARC') ||
        up.includes('COMPET') ||
        up.includes('PERÍODO') ||
        up.includes('PERIODO');
      if (isHeaderish) {
        carry = '';
        continue;
      }

      if (cpfTokenRe.test(line) && !moneyRe.test(line)) {
        carry = line;
        continue;
      }

      const looksLikeNameFragment =
        /[A-Za-zÀ-ÿ]/.test(rawLine) &&
        !cpfTokenRe.test(rawLine) &&
        !moneyRe.test(rawLine) &&
        rawLine.length >= 6 &&
        rawLine.length <= 140;
      if (looksLikeNameFragment) {
        carry = rawLine;
        continue;
      }
      continue;
    }
    carry = '';
    rows.push({
      ...(parsedLine.nome ? { NOME: parsedLine.nome } : { NOME: '' }),
      NMR_CPF: parsedLine.cpf,
      VALOR: parsedLine.valor,
      Competencia: competencia || '',
    });
  }

  const looksBadName = (nomeRaw: string) => {
    const nome = nomeRaw.trim();
    if (!nome) return true;
    if (nome.length < 8) return true;
    const up = nome.toUpperCase();
    if (
      up.includes('LIQUIDADA') ||
      up.includes('EM ANDAMENTO') ||
      up.includes('FOLHA') ||
      up.includes('CONTRATO') ||
      up.includes('PARCELA') ||
      up.includes('SERVIÇO') ||
      up.includes('SERVICO')
    ) return true;
    const words = nome.split(/\s+/g).filter(Boolean);
    if (words.length <= 1) return true;
    return false;
  };

  const merged: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  const addRow = (r: Record<string, unknown>) => {
    const cpf = String((r as any).NMR_CPF ?? '').replace(/\D/g, '');
    const valor = String((r as any).VALOR ?? '').trim();
    const comp = String((r as any).Competencia ?? '').trim();
    const key = `${cpf}|${valor}|${comp}`;
    if (!cpf || !valor) return;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(r);
  };

  for (const r of rowsFromTables) addRow(r);
  for (const r of rows) {
    const cpf = String((r as any).NMR_CPF ?? '').replace(/\D/g, '');
    const best = cpf ? (bestNameByCpf.get(cpf) ?? '') : '';
    const nome = String((r as any).NOME ?? '');
    const bad = looksBadName(nome);
    if (cpf && bestNameByCpf.has(cpf)) {
      const words = nome.trim().split(/\s+/g).filter(Boolean);
      if (bad || words.length < 3 || (best && nome.trim().length < best.length * 0.7)) {
        continue;
      }
    }
    if (best && bad) {
      (r as any).NOME = best;
    }
    addRow(r);
  }

  const headers = ['NOME', 'NMR_CPF', 'VALOR', 'Competencia'];
  return { headers, rows: merged };
}

async function readRelatorioTable(fileName: string, file: Buffer): Promise<{
  headers: string[];
  rows: Array<Record<string, unknown>>;
}> {
  const looksLikePdf = (() => {
    const idx = file.indexOf(Buffer.from('%PDF'));
    return idx !== -1 && idx < 1024;
  })();
  if (!isPdfFile(fileName) && !looksLikePdf) return readSheetTable(file);

  const pdfParse = await getPdfParse();
  const parsed = await pdfParse(file);
  const text = String(parsed.text ?? '');
  const lines = text
    .split(/\r?\n/g)
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .filter((l) => !/opera[cç][aã]o/i.test(l) || !/parcela|valor/i.test(l));

  const headers = ['Operação', 'Vencimento', 'Parcela', 'Valor Operação'];
  const rows: Array<Record<string, unknown>> = [];
  const moneyRe =
    /\b\d{1,3}(?:\.\d{3})*,\d{2}\b|\b\d+,\d{2}\b|\b\d+\.\d{2}\b/g;
  const dateRe = /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/;
  const opRe = /\b\d{6,}\b/;

  const extractMoney = (s: string): string | null => {
    const matches = s.match(moneyRe);
    if (!matches || matches.length === 0) return null;
    const raw = matches[matches.length - 1];
    if (raw.includes(',')) return raw;
    return raw.replace('.', ',');
  };

  const extractOperation = (s: string): string | null => {
    const m = s.match(opRe);
    return m ? m[0] : null;
  };

  const extractDate = (s: string): string | null => {
    const m = dateRe.exec(s);
    return m ? m[1] : null;
  };

  let carry = '';
  for (const raw of lines) {
    const line = `${carry} ${raw}`.trim();
    const op = extractOperation(line);
    const value = extractMoney(line);
    const venc = extractDate(line);

    if (!value && (op || venc)) {
      carry = line;
      continue;
    }

    if (op && value) {
      rows.push({
        Operação: op,
        Vencimento: venc ?? '',
        Parcela: value,
        'Valor Operação': value,
      });
      carry = '';
      continue;
    }

    carry = '';
  }

  if (rows.length === 0) {
    throw new Error(
      'Relatório em PDF: não foi possível extrair linhas (layout do arquivo pode ter mudado).',
    );
  }

  return { headers, rows };
}

async function openDatabase(dbPath: string): Promise<Database> {
  if (!cachedSqlJs) cachedSqlJs = initSqlJs();
  const SQL: SqlJsStatic = await cachedSqlJs;
  const resolvedPath = path.resolve(dbPath);

  const currentMtimeMs = fs.existsSync(resolvedPath)
    ? fs.statSync(resolvedPath).mtimeMs
    : 0;

  const cached = cachedDbByPath.get(resolvedPath);
  if (cached && cached.mtimeMs === currentMtimeMs) return cached.db;
  if (cached) {
    try {
      (cached.db as any).close?.();
    } catch {
      void 0;
    }
  }

  const db = fs.existsSync(resolvedPath)
    ? new SQL.Database(fs.readFileSync(resolvedPath))
    : new SQL.Database();
  cachedDbByPath.set(resolvedPath, { db, mtimeMs: currentMtimeMs });
  return db;
}

function persistDatabase(db: Database, dbFilePath: string) {
  const out = db.export();
  const resolvedPath = path.resolve(dbFilePath);
  fs.writeFileSync(resolvedPath, Buffer.from(out));
  if (cachedDbByPath.has(resolvedPath)) {
    const mtimeMs = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath).mtimeMs : Date.now();
    cachedDbByPath.set(resolvedPath, { db, mtimeMs });
  }
}

function getSqlitePath(): string {
  const raw =
    process.env.SQLITE_PATH ??
    path.join(process.cwd(), 'data', 'consignado.sqlite');
  const resolved = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

function escapeSqlIdentifier(name: string): string {
  const normalized = name
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const safe = normalized.length > 0 ? normalized : 'COL';
  return `"${safe.replaceAll('"', '""')}"`;
}

function tableExists(db: Database, name: string): boolean {
  const escaped = name.replaceAll("'", "''");
  const res = db.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${escaped}' LIMIT 1;`,
  );
  return (res[0]?.values?.length ?? 0) > 0;
}

function getTableColumns(db: Database, tableName: string): string[] {
  const escaped = tableName.replaceAll("'", "''");
  const res = db.exec(`PRAGMA table_info('${escaped}');`);
  const colsIndex = res[0]?.columns?.indexOf('name') ?? -1;
  if (!res[0] || colsIndex === -1) return [];
  return res[0].values.map((row) => String(row[colsIndex]));
}

function intersectionCount(a: string[], b: string[]): number {
  const setB = new Set(b);
  let count = 0;
  for (const v of a) if (setB.has(v)) count += 1;
  return count;
}

function migrateLegacyExtratosIfNeeded(
  db: Database,
  expectedColumns: string[],
) {
  if (!tableExists(db, 'extratos')) return;
  const cols = getTableColumns(db, 'extratos');
  const shouldMigrate =
    cols.includes('payload') ||
    cols.some((c) => c.startsWith('__EMPTY')) ||
    (expectedColumns.length > 0 &&
      cols.length > 0 &&
      intersectionCount(cols, expectedColumns) === 0);

  if (!shouldMigrate) return;
  const suffix = new Date()
    .toISOString()
    .replaceAll(':', '')
    .replaceAll('-', '');
  const legacyName = `extratos_legacy_${suffix}`;
  db.run(`ALTER TABLE extratos RENAME TO ${escapeSqlIdentifier(legacyName)};`);
}

function migrateLegacyRelatorioIfNeeded(
  db: Database,
  expectedColumns: string[],
) {
  if (!tableExists(db, 'relatorio_consignado')) return;
  const cols = getTableColumns(db, 'relatorio_consignado');
  const shouldMigrate =
    cols.includes('payload') ||
    cols.some((c) => c.startsWith('__EMPTY')) ||
    (expectedColumns.length > 0 &&
      cols.length > 0 &&
      intersectionCount(cols, expectedColumns) === 0);

  if (!shouldMigrate) return;
  const suffix = new Date()
    .toISOString()
    .replaceAll(':', '')
    .replaceAll('-', '');
  const legacyName = `relatorio_consignado_legacy_${suffix}`;
  db.run(
    `ALTER TABLE relatorio_consignado RENAME TO ${escapeSqlIdentifier(legacyName)};`,
  );
}

function ensureExtratosTable(db: Database, fileColumns: string[]) {
  migrateLegacyExtratosIfNeeded(db, fileColumns);

  if (!tableExists(db, 'extratos')) {
    const columnsSql = fileColumns
      .map((c) => `${escapeSqlIdentifier(c)} TEXT`)
      .join(', ');
    db.run(`CREATE TABLE IF NOT EXISTS extratos (${columnsSql});`);
    return;
  }

  const existing = new Set(getTableColumns(db, 'extratos'));
  for (const col of fileColumns) {
    if (existing.has(col)) continue;
    db.run(`ALTER TABLE extratos ADD COLUMN ${escapeSqlIdentifier(col)} TEXT;`);
  }
}

function ensureRelatorioConsignadoTable(db: Database, fileColumns: string[]) {
  migrateLegacyRelatorioIfNeeded(db, fileColumns);

  if (!tableExists(db, 'relatorio_consignado')) {
    const columnsSql = fileColumns
      .map((c) => `${escapeSqlIdentifier(c)} TEXT`)
      .join(', ');
    db.run(`CREATE TABLE IF NOT EXISTS relatorio_consignado (${columnsSql});`);
    return;
  }

  const existing = new Set(getTableColumns(db, 'relatorio_consignado'));
  for (const col of fileColumns) {
    if (existing.has(col)) continue;
    db.run(
      `ALTER TABLE relatorio_consignado ADD COLUMN ${escapeSqlIdentifier(col)} TEXT;`,
    );
  }
}

function ensureSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS modalidade_consignados (
      codigo TEXT PRIMARY KEY
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS consignado_app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS orgao_columns_config (
      kind TEXT PRIMARY KEY,
      column_name TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS orgao_depara (
      extratos_value TEXT PRIMARY KEY,
      relatorio_value TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS imported_row_hashes (
      kind TEXT NOT NULL,
      row_hash TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      PRIMARY KEY (kind, row_hash)
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS consignado_access_emails (
      email TEXT PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'usuario',
      created_at TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS import_learning_profiles (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      match_url_contains TEXT NOT NULL,
      file_name_regex TEXT NOT NULL,
      target_table TEXT NOT NULL,
      options_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS conciliacao_tarifas (
      month_key TEXT NOT NULL,
      orgao_extratos_key TEXT NOT NULL,
      tarifa_type TEXT NOT NULL,
      orgao_extratos_raw TEXT NOT NULL,
      tarifa_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (month_key, orgao_extratos_key, tarifa_type)
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS conciliacao_pendencia_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      month TEXT NOT NULL,
      orgao TEXT NOT NULL,
      cpf TEXT NOT NULL,
      nome TEXT NOT NULL,
      value TEXT NOT NULL,
      action TEXT NOT NULL,
      justification TEXT NOT NULL,
      inserted_rows INTEGER NOT NULL DEFAULT 0,
      skipped_rows INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      previous_value TEXT,
      next_value TEXT,
      meta_json TEXT,
      undone_at TEXT,
      undo_justification TEXT
    );
  `);
  const occCols = getTableColumns(db, 'conciliacao_pendencia_actions');
  if (!occCols.includes('previous_value')) {
    db.run(`ALTER TABLE conciliacao_pendencia_actions ADD COLUMN previous_value TEXT;`);
  }
  if (!occCols.includes('next_value')) {
    db.run(`ALTER TABLE conciliacao_pendencia_actions ADD COLUMN next_value TEXT;`);
  }
  if (!occCols.includes('meta_json')) {
    db.run(`ALTER TABLE conciliacao_pendencia_actions ADD COLUMN meta_json TEXT;`);
  }
  if (!occCols.includes('undone_at')) {
    db.run(`ALTER TABLE conciliacao_pendencia_actions ADD COLUMN undone_at TEXT;`);
  }
  if (!occCols.includes('undo_justification')) {
    db.run(`ALTER TABLE conciliacao_pendencia_actions ADD COLUMN undo_justification TEXT;`);
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS extratos_consolidacao_recurso (
      orgao_extratos_key TEXT NOT NULL,
      orgao_extratos_raw TEXT NOT NULL,
      historico1_key TEXT NOT NULL,
      historico1_raw TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (orgao_extratos_key, historico1_key)
    );
  `);
  ensureDefaultLearningProfiles(db);
  ensureDefaultConsignadoConfig(db);

  migrateConciliacaoTarifasToTyped(db);

  const accessCols = getTableColumns(db, 'consignado_access_emails');
  if (!accessCols.includes('role')) {
    db.run(`ALTER TABLE consignado_access_emails ADD COLUMN role TEXT;`);
  }
  if (!accessCols.includes('created_at')) {
    db.run(`ALTER TABLE consignado_access_emails ADD COLUMN created_at TEXT;`);
  }
  db.run(`UPDATE consignado_access_emails SET role='usuario' WHERE role IS NULL OR role='';`);
  const stmt = db.prepare(
    `UPDATE consignado_access_emails SET role='admin' WHERE lower(trim(email))=?;`,
  );
  try {
    stmt.run([FIXED_ACCESS_EMAIL]);
  } finally {
    stmt.free();
  }
}

function migrateConciliacaoTarifasToTyped(db: Database) {
  if (!tableExists(db, 'conciliacao_tarifas')) return;
  const cols = getTableColumns(db, 'conciliacao_tarifas');
  if (cols.includes('tarifa_type')) return;

  db.run('BEGIN;');
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS conciliacao_tarifas__v2 (
        month_key TEXT NOT NULL,
        orgao_extratos_key TEXT NOT NULL,
        tarifa_type TEXT NOT NULL,
        orgao_extratos_raw TEXT NOT NULL,
        tarifa_cents INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (month_key, orgao_extratos_key, tarifa_type)
      );
    `);
    db.run(`
      INSERT INTO conciliacao_tarifas__v2
      (month_key, orgao_extratos_key, tarifa_type, orgao_extratos_raw, tarifa_cents, created_at, updated_at)
      SELECT
        month_key,
        orgao_extratos_key,
        'linha' as tarifa_type,
        orgao_extratos_raw,
        tarifa_cents,
        created_at,
        updated_at
      FROM conciliacao_tarifas;
    `);
    db.run(`DROP TABLE conciliacao_tarifas;`);
    db.run(`ALTER TABLE conciliacao_tarifas__v2 RENAME TO conciliacao_tarifas;`);
    db.run('COMMIT;');
  } catch (e) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  }
}

type ConciliacaoTarifaType = 'linha' | 'ted';

function normalizeConciliacaoTarifaType(value: unknown): ConciliacaoTarifaType {
  if (typeof value !== 'string') return 'linha';
  const v = value.trim().toLowerCase();
  if (v === 'ted') return 'ted';
  return 'linha';
}

function getConciliacaoTarifaCents(
  db: Database,
  opts: { monthKey: string; orgaoRaw: string; type: ConciliacaoTarifaType },
) {
  if (!tableExists(db, 'conciliacao_tarifas')) return { cents: 0, applied: false };
  const orgaoKey = normalizeExtratosOrgaoForMatch(opts.orgaoRaw);
  if (!orgaoKey) return { cents: 0, applied: false };
  const type = normalizeConciliacaoTarifaType(opts.type);
  const cols = getTableColumns(db, 'conciliacao_tarifas');
  const hasType = cols.includes('tarifa_type');
  const stmt = db.prepare(
    hasType
      ? `SELECT tarifa_cents as cents FROM conciliacao_tarifas WHERE month_key=? AND orgao_extratos_key=? AND tarifa_type=?;`
      : `SELECT tarifa_cents as cents FROM conciliacao_tarifas WHERE month_key=? AND orgao_extratos_key=?;`,
  );
  try {
    stmt.bind(
      (hasType ? [opts.monthKey, orgaoKey, type] : [opts.monthKey, orgaoKey]) as unknown as any[],
    );
    if (!stmt.step()) return { cents: 0, applied: false };
    const row = stmt.getAsObject() as { cents?: unknown };
    const cents = Number(row.cents);
    return { cents: Number.isFinite(cents) ? cents : 0, applied: true };
  } finally {
    stmt.free();
  }
}

function tokenizeNormalizedKey(value: string): string[] {
  return value
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getConciliacaoTarifaCentsSoft(
  db: Database,
  opts: { monthKey: string; orgaoRaw: string; type: ConciliacaoTarifaType },
) {
  if (!tableExists(db, 'conciliacao_tarifas')) return { cents: 0, applied: false };
  const orgaoKey = normalizeExtratosOrgaoForMatch(opts.orgaoRaw);
  if (!orgaoKey) return { cents: 0, applied: false };
  const type = normalizeConciliacaoTarifaType(opts.type);
  const cols = getTableColumns(db, 'conciliacao_tarifas');
  const hasType = cols.includes('tarifa_type');

  const direct = getConciliacaoTarifaCents(db, opts);
  if (direct.applied) return direct;

  const stmt = db.prepare(
    hasType
      ? `SELECT orgao_extratos_key as k, tarifa_cents as cents, updated_at as updatedAt
         FROM conciliacao_tarifas
         WHERE month_key=? AND tarifa_type=?;`
      : `SELECT orgao_extratos_key as k, tarifa_cents as cents, updated_at as updatedAt
         FROM conciliacao_tarifas
         WHERE month_key=?;`,
  );
  try {
    stmt.bind((hasType ? [opts.monthKey, type] : [opts.monthKey]) as unknown as any[]);
    const wantedTokens = tokenizeNormalizedKey(orgaoKey);
    if (wantedTokens.length === 0) return { cents: 0, applied: false };

    let best: null | { score: number; cents: number; updatedAt: string } = null;
    while (stmt.step()) {
      const row = stmt.getAsObject() as { k?: unknown; cents?: unknown; updatedAt?: unknown };
      const k = typeof row.k === 'string' ? row.k.trim() : '';
      if (!k) continue;
      const cents = Number(row.cents);
      if (!Number.isFinite(cents)) continue;
      const updatedAt = typeof row.updatedAt === 'string' ? row.updatedAt.trim() : '';

      const tokens = tokenizeNormalizedKey(k);
      if (tokens.length === 0) continue;
      const set = new Set(tokens);
      let score = 0;
      for (const t of wantedTokens) if (set.has(t)) score += 1;
      if (score === 0) continue;

      if (!best) {
        best = { score, cents, updatedAt };
        continue;
      }
      if (score > best.score) {
        best = { score, cents, updatedAt };
        continue;
      }
      if (score === best.score) {
        if ((updatedAt || '') > (best.updatedAt || '')) {
          best = { score, cents, updatedAt };
        }
      }
    }

    const minScore = Math.min(3, wantedTokens.length);
    if (!best || best.score < minScore) return { cents: 0, applied: false };
    return { cents: best.cents, applied: true };
  } finally {
    stmt.free();
  }
}

export async function upsertConciliacaoTarifa(opts: {
  month: string;
  orgao: string;
  type?: string;
  value: string;
}) {
  dotenv.config();
  const { year, month } = parseMonthInput(opts.month);
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const orgaoRaw = String(opts.orgao ?? '').trim();
  if (!orgaoRaw) throw new Error('Informe o órgão.');
  const orgaoKey = normalizeExtratosOrgaoForMatch(orgaoRaw);
  if (!orgaoKey) throw new Error('Órgão inválido.');
  const type = normalizeConciliacaoTarifaType(opts.type);

  const cents = parseMoneyToCents(opts.value);
  if (cents === null) throw new Error('Valor de tarifa inválido.');

  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const now = new Date().toISOString();
  db.run('BEGIN;');
  try {
    const stmt = db.prepare(`
      INSERT INTO conciliacao_tarifas
      (month_key, orgao_extratos_key, tarifa_type, orgao_extratos_raw, tarifa_cents, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(month_key, orgao_extratos_key, tarifa_type)
      DO UPDATE SET
        orgao_extratos_raw=excluded.orgao_extratos_raw,
        tarifa_cents=excluded.tarifa_cents,
        updated_at=excluded.updated_at;
    `);
    try {
      stmt.run([monthKey, orgaoKey, type, orgaoRaw, cents, now, now] as unknown as any[]);
    } finally {
      stmt.free();
    }
    db.run('COMMIT;');
  } catch (e) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  }
  persistDatabase(db, dbFilePath);
  return {
    month: monthKey,
    orgao: orgaoRaw,
    type,
    tarifa: { cents, text: centsToPtBr(cents) },
    dbFilePath,
  };
}

const DEFAULT_SHAREPOINT_ROOT_URL = normalizeUrl(
  'https://sicoobjuriscredcelgbr.sharepoint.com/sites/PortaldeDocumentosSicoobJuriscred/Documents/Diretoria Administrativo/Tecnologia da Informação/99-Automações_TI/9.Recuperação de Crédito',
);

function ensureDefaultConsignadoConfig(db: Database) {
  if (!tableExists(db, 'consignado_app_config')) return;
  const existing = getConsignadoAppConfigValue(db, CONFIG_KEY_SHAREPOINT_FOLDER_URL);
  if (existing) return;
  setConsignadoAppConfigValue(db, CONFIG_KEY_SHAREPOINT_FOLDER_URL, DEFAULT_SHAREPOINT_ROOT_URL);
}

type ImportLearningProfileRow = {
  id?: unknown;
  kind?: unknown;
  match_url_contains?: unknown;
  file_name_regex?: unknown;
  target_table?: unknown;
  options_json?: unknown;
};

function upsertLearningProfile(
  db: Database,
  profile: {
    id: string;
    kind: string;
    matchUrlContains: string;
    fileNameRegex: string;
    targetTable: string;
    options: Record<string, unknown>;
  },
) {
  const id = profile.id.trim();
  const kind = profile.kind.trim();
  const matchUrlContains = profile.matchUrlContains.trim();
  const fileNameRegex = profile.fileNameRegex.trim();
  const targetTable = profile.targetTable.trim();
  if (!id || !kind || !matchUrlContains || !fileNameRegex || !targetTable) {
    throw new Error('Perfil de aprendizado inválido.');
  }
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO import_learning_profiles
      (id, kind, match_url_contains, file_name_regex, target_table, options_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       kind=excluded.kind,
       match_url_contains=excluded.match_url_contains,
       file_name_regex=excluded.file_name_regex,
       target_table=excluded.target_table,
       options_json=excluded.options_json,
       updated_at=excluded.updated_at;`,
  );
  try {
    stmt.run([
      id,
      kind,
      matchUrlContains,
      fileNameRegex,
      targetTable,
      JSON.stringify(profile.options ?? {}),
      now,
      now,
    ]);
  } finally {
    stmt.free();
  }
}

function ensureDefaultLearningProfiles(db: Database) {
  if (!tableExists(db, 'import_learning_profiles')) return;
  upsertLearningProfile(db, {
    id: 'recurso_alego',
    kind: 'recurso_alego',
    matchUrlContains: normalizeUrl(
      '/99-Automações_TI/9.Recuperação de Crédito/2026/Abril/Relatório Orgão/',
    ),
    fileNameRegex: '^ALEGO\\s*-\\s*(?:\\d{6}|\\d{2}\\D{0,3}\\d{4})(?:\\s*\\(\\d+\\))?\\.(xlsx|xlsm|xls)$',
    targetTable: 'Recurso ALEGO',
    options: { mode: 'append' },
  });
  upsertLearningProfile(db, {
    id: 'recurso_mpgo',
    kind: 'recurso_mpgo',
    matchUrlContains: normalizeUrl(
      '/99-Automações_TI/9.Recuperação de Crédito/2026/Abril/Relatório Orgao/GOIAS MPGO',
    ),
    fileNameRegex: '^MPGO\\s*-\\s*.*\\.(pdf)$',
    targetTable: 'Recurso MPGO',
    options: { mode: 'replace' },
  });
}

function getConsignadoAppConfigValue(db: Database, key: string): string | null {
  if (!tableExists(db, 'consignado_app_config')) return null;
  const stmt = db.prepare(
    `SELECT value FROM consignado_app_config WHERE key=? LIMIT 1;`,
  );
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

function setConsignadoAppConfigValue(
  db: Database,
  key: string,
  value: string | null,
) {
  const normalizedKey = key.trim();
  if (!normalizedKey) throw new Error('Chave de configuração inválida.');
  const updatedAt = new Date().toISOString();
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    const stmt = db.prepare(`DELETE FROM consignado_app_config WHERE key=?;`);
    try {
      stmt.run([normalizedKey]);
    } finally {
      stmt.free();
    }
    return;
  }
  const stmt = db.prepare(
    `INSERT INTO consignado_app_config (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;`,
  );
  try {
    stmt.run([normalizedKey, trimmed, updatedAt]);
  } finally {
    stmt.free();
  }
}

function normalizeModalidades(modalidades: string[]): string[] {
  return modalidades
    .map((m) => m.trim().toUpperCase())
    .filter(Boolean)
    .filter((m, i, arr) => arr.indexOf(m) === i);
}

function replaceModalidades(db: Database, modalidades: string[]) {
  const normalized = normalizeModalidades(modalidades);
  db.run('DELETE FROM modalidade_consignados;');
  if (normalized.length === 0) return;
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO modalidade_consignados (codigo) VALUES (?);`,
  );
  try {
    for (const codigo of normalized) {
      stmt.run([codigo]);
    }
  } finally {
    stmt.free();
  }
}

function getModalidadesAceitasSet(db: Database): Set<string> {
  if (!tableExists(db, 'modalidade_consignados')) return new Set();
  const rows = readTableRows(db, 'modalidade_consignados', ['codigo']);
  const raw = rows
    .map((r) => (typeof r.codigo === 'string' ? r.codigo : ''))
    .filter(Boolean);
  return new Set(normalizeModalidades(raw));
}

function getOrgaoColumnsConfigFromDb(db: Database): {
  extratos: string | null;
  relatorio: string | null;
} {
  if (!tableExists(db, 'orgao_columns_config')) {
    return { extratos: null, relatorio: null };
  }
  const rows = readTableRows(db, 'orgao_columns_config', ['kind', 'column_name']);
  const out: { extratos: string | null; relatorio: string | null } = {
    extratos: null,
    relatorio: null,
  };
  for (const r of rows) {
    const kind = typeof r.kind === 'string' ? r.kind.trim().toLowerCase() : '';
    const col =
      typeof r.column_name === 'string' ? r.column_name.trim() : '';
    if (!col) continue;
    if (kind === 'extratos') out.extratos = col;
    if (kind === 'relatorio') out.relatorio = col;
  }
  return out;
}

function normalizeOrgaoValueKey(value: string): string {
  const base = value.trim().replace(/\s+/g, ' ');
  const noAccents = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalized = noAccents
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized;
}

function normalizeExtratosOrgaoForMatch(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^\d+\s*-\s*/, '')
    .replace(/^\d+\s+/, '')
    .trim();
  if (!cleaned) return null;
  return normalizeOrgaoValueKey(cleaned);
}

function normalizeRelatorioOrgaoForMatch(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^\d+\s*-\s*/, '')
    .replace(/^\d+\s+/, '')
    .trim();
  if (!cleaned) return null;
  return normalizeOrgaoValueKey(cleaned);
}

function normalizeExtratosHistoricoForMatch(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;
  return normalizeExtratosOrgaoForMatch(cleaned);
}

function getExtratosConsolidacaoHistoricoKeys(
  db: Database,
  opts: { orgaoExtratosRaw: string },
): Set<string> {
  const baseKey = normalizeExtratosOrgaoForMatch(opts.orgaoExtratosRaw);
  if (!baseKey) return new Set();
  if (!tableExists(db, 'extratos_consolidacao_recurso')) return new Set();
  const rows = readTableRows(db, 'extratos_consolidacao_recurso', [
    'orgao_extratos_key',
    'historico1_key',
  ]);
  const out = new Set<string>();
  for (const r of rows) {
    const ok = typeof (r as any).orgao_extratos_key === 'string' ? String((r as any).orgao_extratos_key).trim() : '';
    if (!ok || ok !== baseKey) continue;
    const hk = typeof (r as any).historico1_key === 'string' ? String((r as any).historico1_key).trim() : '';
    if (hk) out.add(hk);
  }
  return out;
}

function getOrgaoDeParaSets(
  db: Database,
  opts?: { onlyExtratos?: string | null },
): {
  extratos: Set<string>;
  relatorio: Set<string>;
} {
  if (!tableExists(db, 'orgao_depara')) {
    return { extratos: new Set(), relatorio: new Set() };
  }
  const rows = readTableRows(db, 'orgao_depara', ['extratos_value', 'relatorio_value']);
  const wantedRaw =
    typeof opts?.onlyExtratos === 'string' ? opts!.onlyExtratos!.trim() : '';
  const wantedKey = wantedRaw ? normalizeExtratosOrgaoForMatch(wantedRaw) : null;
  if (wantedRaw && !wantedKey) {
    throw new Error('Filtro de órgão inválido.');
  }

  const extratos = new Set<string>();
  const relatorio = new Set<string>();
  let foundWanted = false;
  for (const r of rows) {
    const ex = normalizeExtratosOrgaoForMatch((r as any).extratos_value);
    const re = normalizeRelatorioOrgaoForMatch((r as any).relatorio_value);
    if (wantedKey) {
      if (ex && ex === wantedKey) {
        foundWanted = true;
        if (ex) extratos.add(ex);
        if (re) relatorio.add(re);
        break;
      }
      continue;
    }
    if (ex) extratos.add(ex);
    if (re) relatorio.add(re);
  }
  if (wantedKey && !foundWanted) {
    throw new Error('Órgão não encontrado no De/Para.');
  }
  return { extratos, relatorio };
}

function getOrgaoDeParaMaps(
  db: Database,
  opts?: { onlyExtratos?: string | null },
): {
  extratosToRelatorio: Map<string, string>;
  relatorioToExtratos: Map<string, string>;
} {
  const extratosToRelatorio = new Map<string, string>();
  const relatorioToExtratos = new Map<string, string>();
  if (!tableExists(db, 'orgao_depara')) {
    return { extratosToRelatorio, relatorioToExtratos };
  }

  const rows = readTableRows(db, 'orgao_depara', ['extratos_value', 'relatorio_value']);
  const wantedRaw =
    typeof opts?.onlyExtratos === 'string' ? opts!.onlyExtratos!.trim() : '';
  const wantedKey = wantedRaw ? normalizeExtratosOrgaoForMatch(wantedRaw) : null;
  if (wantedRaw && !wantedKey) {
    throw new Error('Filtro de órgão inválido.');
  }

  let foundWanted = false;
  for (const r of rows) {
    const ex = normalizeExtratosOrgaoForMatch((r as any).extratos_value);
    const re = normalizeRelatorioOrgaoForMatch((r as any).relatorio_value);
    if (!ex || !re) continue;

    if (wantedKey) {
      if (ex === wantedKey) {
        foundWanted = true;
        extratosToRelatorio.set(ex, re);
        relatorioToExtratos.set(re, ex);
        break;
      }
      continue;
    }

    extratosToRelatorio.set(ex, re);
    relatorioToExtratos.set(re, ex);
  }

  if (wantedKey && !foundWanted) {
    throw new Error('Órgão não encontrado no De/Para.');
  }
  return { extratosToRelatorio, relatorioToExtratos };
}

function listDistinctColumnValues(opts: {
  db: Database;
  table: string;
  column: string;
  limit?: number;
  valueTransform?: (raw: string) => string;
}): Array<{ value: string; count: number }> {
  const { db, table, column } = opts;
  const limit = Number.isFinite(opts.limit) ? (opts.limit as number) : 200;
  if (!tableExists(db, table)) return [];
  const cols = getTableColumns(db, table);
  if (!cols.includes(column)) return [];

  const rows = readTableRows(db, table, [column]);
  const byKey = new Map<string, { value: string; count: number }>();
  for (const r of rows) {
    const raw0 = typeof r[column] === 'string' ? r[column] : '';
    const raw = typeof raw0 === 'string' ? raw0.trim() : '';
    if (!raw) continue;
    const transformed = opts.valueTransform ? opts.valueTransform(raw) : raw;
    const cleaned = transformed.trim().replace(/\s+/g, ' ');
    if (!cleaned) continue;
    const key = normalizeOrgaoValueKey(cleaned);
    const cur = byKey.get(key);
    if (cur) {
      cur.count += 1;
    } else {
      byKey.set(key, { value: cleaned, count: 1 });
    }
  }

  return Array.from(byKey.values())
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, Math.max(0, limit));
}

function saveOrgaoColumnsConfigToDb(
  db: Database,
  opts: { extratos?: string | null; relatorio?: string | null },
) {
  ensureSchema(db);
  const upsert = db.prepare(
    `INSERT OR REPLACE INTO orgao_columns_config (kind, column_name) VALUES (?, ?);`,
  );
  const del = db.prepare(`DELETE FROM orgao_columns_config WHERE kind=?;`);
  try {
    if (opts.extratos === null) del.run(['extratos']);
    else if (typeof opts.extratos === 'string' && opts.extratos.trim())
      upsert.run(['extratos', opts.extratos.trim()]);

    if (opts.relatorio === null) del.run(['relatorio']);
    else if (typeof opts.relatorio === 'string' && opts.relatorio.trim())
      upsert.run(['relatorio', opts.relatorio.trim()]);
  } finally {
    upsert.free();
    del.free();
  }
}

function toStableValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'symbol') return value.description ?? '';
  return '';
}

function hashRow(
  kind: string,
  fileColumns: string[],
  row: Record<string, unknown>,
) {
  const parts = fileColumns.map((col) => `${col}=${toStableValue(row[col])}`);
  const payload = `${kind}\u001F${parts.join('\u001E')}`;
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

function insertExtratosRows(opts: {
  db: Database;
  sourceFile: string;
  fileColumns: string[];
  rows: Array<Record<string, unknown>>;
}): { insertedRows: number; skippedRows: number } {
  if (tableExists(opts.db, 'imported_row_hashes') && tableExists(opts.db, 'extratos')) {
    const targetCount = countTableRows(opts.db, 'extratos');
    if (targetCount === 0) {
      const check = opts.db.prepare(
        `SELECT COUNT(1) as c FROM imported_row_hashes WHERE kind=?;`,
      );
      try {
        check.bind(['extratos'] as unknown as any[]);
        if (check.step()) {
          const row = check.getAsObject() as { c?: unknown };
          const c = Number((row as any).c);
          if (Number.isFinite(c) && c > 0) {
            const del = opts.db.prepare(`DELETE FROM imported_row_hashes WHERE kind=?;`);
            try {
              del.run(['extratos'] as unknown as any[]);
            } finally {
              del.free();
            }
          }
        }
      } finally {
        check.free();
      }
    }
  }

  const colsSql = opts.fileColumns.map(escapeSqlIdentifier).join(', ');
  const placeholders = opts.fileColumns.map(() => '?').join(', ');
  const importedAt = new Date().toISOString();
  const hashStmt = opts.db.prepare(
    `INSERT OR IGNORE INTO imported_row_hashes (kind, row_hash, imported_at) VALUES (?, ?, ?);`,
  );
  const stmt = opts.db.prepare(
    `INSERT INTO extratos (${colsSql}) VALUES (${placeholders});`,
  );
  let insertedRows = 0;
  let skippedRows = 0;
  try {
    for (const row of opts.rows) {
      const rowHash = hashRow('extratos', opts.fileColumns, row);
      hashStmt.run(['extratos', rowHash, importedAt]);
      if (opts.db.getRowsModified() === 0) {
        skippedRows += 1;
        continue;
      }
      const values = opts.fileColumns.map((col) =>
        col in row ? row[col] : null,
      );
      stmt.run(values as unknown as any[]);
      insertedRows += 1;
    }
  } finally {
    hashStmt.free();
    stmt.free();
  }
  return { insertedRows, skippedRows };
}

function insertRelatorioConsignadoRows(opts: {
  db: Database;
  fileColumns: string[];
  rows: Array<Record<string, unknown>>;
}): { insertedRows: number; skippedRows: number } {
  if (tableExists(opts.db, 'imported_row_hashes') && tableExists(opts.db, 'relatorio_consignado')) {
    const targetCount = countTableRows(opts.db, 'relatorio_consignado');
    if (targetCount === 0) {
      const check = opts.db.prepare(
        `SELECT COUNT(1) as c FROM imported_row_hashes WHERE kind=?;`,
      );
      try {
        check.bind(['relatorio_consignado'] as unknown as any[]);
        if (check.step()) {
          const row = check.getAsObject() as { c?: unknown };
          const c = Number((row as any).c);
          if (Number.isFinite(c) && c > 0) {
            const del = opts.db.prepare(`DELETE FROM imported_row_hashes WHERE kind=?;`);
            try {
              del.run(['relatorio_consignado'] as unknown as any[]);
            } finally {
              del.free();
            }
          }
        }
      } finally {
        check.free();
      }
    }
  }

  const colsSql = opts.fileColumns.map(escapeSqlIdentifier).join(', ');
  const placeholders = opts.fileColumns.map(() => '?').join(', ');
  const importedAt = new Date().toISOString();
  const hashStmt = opts.db.prepare(
    `INSERT OR IGNORE INTO imported_row_hashes (kind, row_hash, imported_at) VALUES (?, ?, ?);`,
  );
  const stmt = opts.db.prepare(
    `INSERT INTO relatorio_consignado (${colsSql}) VALUES (${placeholders});`,
  );
  let insertedRows = 0;
  let skippedRows = 0;
  try {
    for (const row of opts.rows) {
      const rowHash = hashRow('relatorio_consignado', opts.fileColumns, row);
      hashStmt.run(['relatorio_consignado', rowHash, importedAt]);
      if (opts.db.getRowsModified() === 0) {
        skippedRows += 1;
        continue;
      }
      const values = opts.fileColumns.map((col) =>
        col in row ? row[col] : null,
      );
      stmt.run(values as unknown as any[]);
      insertedRows += 1;
    }
  } finally {
    hashStmt.free();
    stmt.free();
  }
  return { insertedRows, skippedRows };
}

function fillDownRelatorioConsignadoColumn(db: Database, column: string) {
  if (!tableExists(db, 'relatorio_consignado')) return;
  const existing = new Set(getTableColumns(db, 'relatorio_consignado'));
  if (!existing.has(column)) return;

  const col = escapeSqlIdentifier(column);
  db.run(`
    UPDATE relatorio_consignado AS t
    SET ${col} = (
      SELECT t2.${col}
      FROM relatorio_consignado AS t2
      WHERE t2.rowid <= t.rowid
        AND TRIM(COALESCE(t2.${col}, '')) <> ''
      ORDER BY t2.rowid DESC
      LIMIT 1
    )
    WHERE TRIM(COALESCE(t.${col}, '')) = ''
      AND EXISTS (
        SELECT 1
        FROM relatorio_consignado AS t2
        WHERE t2.rowid <= t.rowid
          AND TRIM(COALESCE(t2.${col}, '')) <> ''
      );
  `);
}

function ensureRelatorioConsignadoColumn(db: Database, column: string) {
  if (!tableExists(db, 'relatorio_consignado')) return;
  const existing = new Set(getTableColumns(db, 'relatorio_consignado'));
  if (existing.has(column)) return;
  db.run(
    `ALTER TABLE relatorio_consignado ADD COLUMN ${escapeSqlIdentifier(column)} TEXT;`,
  );
}

function computeRelatorioCopetenciaFromVencimento(db: Database) {
  if (!tableExists(db, 'relatorio_consignado')) return;
  const existing = new Set(getTableColumns(db, 'relatorio_consignado'));
  if (!existing.has('Vencimento')) return;
  ensureRelatorioConsignadoColumn(db, 'Copetencia');

  const select = db.prepare(
    `SELECT rowid as __rowid, ${escapeSqlIdentifier('Vencimento')} as Vencimento, ${escapeSqlIdentifier('Copetencia')} as Copetencia FROM relatorio_consignado;`,
  );
  const update = db.prepare(
    `UPDATE relatorio_consignado SET ${escapeSqlIdentifier('Copetencia')}=? WHERE rowid=?;`,
  );
  try {
    while (select.step()) {
      const row = select.getAsObject() as Record<string, unknown>;
      const rowid = row.__rowid;
      const existingCop =
        typeof (row as any).Copetencia === 'string'
          ? String((row as any).Copetencia).trim()
          : '';
      if (existingCop) continue;
      const venc = typeof row.Vencimento === 'string' ? row.Vencimento.trim() : '';
      let cop = '';
      if (venc) {
        const d = parseDateValue(venc);
        if (d) {
          let y = d.getFullYear();
          let m = d.getMonth() - 1;
          if (m < 0) {
            m = 11;
            y -= 1;
          }
          cop = `${String(m + 1).padStart(2, '0')}/${String(y)}`;
        }
      }
      update.run([cop, rowid] as unknown as any[]);
    }
  } finally {
    select.free();
    update.free();
  }
}

function normalizeRelatorioCopetenciaToFullYear(db: Database) {
  if (!tableExists(db, 'relatorio_consignado')) return;
  const existing = new Set(getTableColumns(db, 'relatorio_consignado'));
  if (!existing.has('Copetencia')) return;
  const select = db.prepare(
    `SELECT rowid as __rowid, ${escapeSqlIdentifier('Copetencia')} as Copetencia FROM relatorio_consignado;`,
  );
  const update = db.prepare(
    `UPDATE relatorio_consignado SET ${escapeSqlIdentifier('Copetencia')}=? WHERE rowid=?;`,
  );
  try {
    while (select.step()) {
      const row = select.getAsObject() as Record<string, unknown>;
      const rowid = row.__rowid;
      const raw = typeof row.Copetencia === 'string' ? row.Copetencia.trim() : '';
      const m = /^(\d{2})\/(\d{2})$/.exec(raw);
      if (!m) continue;
      const mm = Number(m[1]);
      const yy = Number(m[2]);
      if (!Number.isFinite(mm) || mm < 1 || mm > 12) continue;
      if (!Number.isFinite(yy) || yy < 0 || yy > 99) continue;
      const yyyy = yy <= 79 ? 2000 + yy : 1900 + yy;
      update.run([`${String(mm).padStart(2, '0')}/${String(yyyy)}`, rowid] as unknown as any[]);
    }
  } finally {
    select.free();
    update.free();
  }
}

function ensureExtratosColumn(db: Database, column: string) {
  if (!tableExists(db, 'extratos')) return;
  const existing = new Set(getTableColumns(db, 'extratos'));
  if (existing.has(column)) return;
  db.run(`ALTER TABLE extratos ADD COLUMN ${escapeSqlIdentifier(column)} TEXT;`);
}

function normalizeExtratosDateColumn(db: Database, dateCol: string) {
  if (!tableExists(db, 'extratos')) return;
  const existing = new Set(getTableColumns(db, 'extratos'));
  if (!existing.has(dateCol)) return;

  const select = db.prepare(
    `SELECT rowid as __rowid, ${escapeSqlIdentifier(dateCol)} as __data FROM extratos;`,
  );
  const update = db.prepare(
    `UPDATE extratos SET ${escapeSqlIdentifier(dateCol)}=? WHERE rowid=?;`,
  );
  try {
    while (select.step()) {
      const row = select.getAsObject() as Record<string, unknown>;
      const rowid = row.__rowid;
      const raw = typeof row.__data === 'string' ? row.__data.trim() : row.__data;
      if (typeof raw === 'string') {
        const normalized = normalizePossiblyExcelSerialDateString(raw);
        if (normalized && normalized !== raw) {
          update.run([normalized, rowid] as unknown as any[]);
        }
        continue;
      }
      if (typeof raw === 'number') {
        const d = parseDateValue(raw);
        if (!d) continue;
        update.run([formatDatePtBr(d), rowid] as unknown as any[]);
      }
    }
  } finally {
    select.free();
    update.free();
  }
}

function computeExtratosCopetenciaFromData(db: Database) {
  if (!tableExists(db, 'extratos')) return;
  const cols = getTableColumns(db, 'extratos');
  const dateCol = pickFirstExistingColumn(cols, ['DATA', 'Data']);
  if (!dateCol) return;

  normalizeExtratosDateColumn(db, dateCol);

  ensureExtratosColumn(db, 'Copetencia');
  const select = db.prepare(
    `SELECT rowid as __rowid, ${escapeSqlIdentifier(dateCol)} as __data FROM extratos;`,
  );
  const update = db.prepare(
    `UPDATE extratos SET ${escapeSqlIdentifier('Copetencia')}=? WHERE rowid=?;`,
  );
  try {
    while (select.step()) {
      const row = select.getAsObject() as Record<string, unknown>;
      const rowid = row.__rowid;
      const raw = typeof row.__data === 'string' ? row.__data.trim() : '';
      let cop = '';
      if (raw) {
        const d = parseDateValue(raw);
        if (d) {
          const yy = String(d.getFullYear() % 100).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          cop = `${mm}/${yy}`;
        }
      }
      update.run([cop, rowid] as unknown as any[]);
    }
  } finally {
    select.free();
    update.free();
  }
}

function normalizeRelatorioConsignadoFillDown(db: Database) {
  fillDownRelatorioConsignadoColumn(db, 'EMPRESA');
  fillDownRelatorioConsignadoColumn(db, 'Vencimento');
  fillDownRelatorioConsignadoColumn(db, 'Atividade');
  if (tableExists(db, 'relatorio_consignado')) {
    const cols = new Set(getTableColumns(db, 'relatorio_consignado'));
    if (cols.has('CPF') && cols.has('Nome')) {
      const cpfCol = escapeSqlIdentifier('CPF');
      const nomeCol = escapeSqlIdentifier('Nome');
      db.run(`
        UPDATE relatorio_consignado AS t
        SET ${nomeCol} = (
          SELECT t2.${nomeCol}
          FROM relatorio_consignado AS t2
          WHERE t2.rowid <= t.rowid
            AND TRIM(COALESCE(t2.${cpfCol}, '')) = TRIM(COALESCE(t.${cpfCol}, ''))
            AND TRIM(COALESCE(t2.${nomeCol}, '')) <> ''
          ORDER BY t2.rowid DESC
          LIMIT 1
        )
        WHERE TRIM(COALESCE(t.${cpfCol}, '')) <> ''
          AND TRIM(COALESCE(t.${nomeCol}, '')) = ''
          AND EXISTS (
            SELECT 1
            FROM relatorio_consignado AS t2
            WHERE t2.rowid <= t.rowid
              AND TRIM(COALESCE(t2.${cpfCol}, '')) = TRIM(COALESCE(t.${cpfCol}, ''))
              AND TRIM(COALESCE(t2.${nomeCol}, '')) <> ''
          );
      `);

      db.run(`
        DELETE FROM relatorio_consignado
        WHERE (
          REPLACE(REPLACE(TRIM(COALESCE(${cpfCol}, '')), '.', ''), '-', '') IN (
            '00000000000','11111111111','22222222222','33333333333','44444444444',
            '55555555555','66666666666','77777777777','88888888888','99999999999'
          )
        )
          AND TRIM(COALESCE(${nomeCol}, '')) = '';
      `);
    }
  }
  computeRelatorioCopetenciaFromVencimento(db);
  normalizeRelatorioCopetenciaToFullYear(db);

  const cols = new Set(getTableColumns(db, 'relatorio_consignado'));
  if (cols.has('Operação') && cols.has('Valor Parcela') && cols.has('CPF') && cols.has('Nome')) {
    db.run(`
      DELETE FROM relatorio_consignado
      WHERE TRIM(COALESCE(${escapeSqlIdentifier('Operação')}, '')) = ''
        AND TRIM(COALESCE(${escapeSqlIdentifier('Valor Parcela')}, '')) = ''
        AND TRIM(COALESCE(${escapeSqlIdentifier('CPF')}, '')) <> ''
        AND TRIM(COALESCE(${escapeSqlIdentifier('Nome')}, '')) <> '';
    `);
  }
}

function dropAndCreateTable(
  db: Database,
  tableName: string,
  fileColumns: string[],
) {
  if (fileColumns.length === 0) return;
  const columnsSql = fileColumns
    .map((c) => `${escapeSqlIdentifier(c)} TEXT`)
    .join(', ');

  const suffix = new Date()
    .toISOString()
    .replaceAll(':', '')
    .replaceAll('-', '')
    .replaceAll('.', '');
  const tmpName = `${tableName}_tmp_${suffix}`;
  const tmpEscaped = escapeSqlIdentifier(tmpName);
  const tableEscaped = escapeSqlIdentifier(tableName);

  db.run(`DROP TABLE IF EXISTS ${tmpEscaped};`);
  db.run(`CREATE TABLE IF NOT EXISTS ${tmpEscaped} (${columnsSql});`);
  db.run(`DROP TABLE IF EXISTS ${tableEscaped};`);
  db.run(`ALTER TABLE ${tmpEscaped} RENAME TO ${tableEscaped};`);
}

function ensureTableWithColumns(
  db: Database,
  tableName: string,
  columns: string[],
) {
  const cols = columns.map((c) => String(c ?? '').trim()).filter(Boolean);
  if (cols.length === 0) return;

  const tableEscaped = escapeSqlIdentifier(tableName);
  if (!tableExists(db, tableName)) {
    const columnsSql = cols
      .map((c) => `${escapeSqlIdentifier(c)} TEXT`)
      .join(', ');
    db.run(`CREATE TABLE IF NOT EXISTS ${tableEscaped} (${columnsSql});`);
    return;
  }

  const existing = new Set(getTableColumns(db, tableName).map((c) => c.trim().toUpperCase()));
  for (const c of cols) {
    const key = c.trim().toUpperCase();
    if (!key || existing.has(key)) continue;
    db.run(`ALTER TABLE ${tableEscaped} ADD COLUMN ${escapeSqlIdentifier(c)} TEXT;`);
    existing.add(key);
  }
}

function clearImportedHashes(db: Database, kind: string) {
  const escaped = kind.replaceAll("'", "''");
  db.run(`DELETE FROM imported_row_hashes WHERE kind='${escaped}';`);
}

function parseMonthInput(month: string): { year: number; month: number } {
  const trimmed = month.trim();
  const m = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (!m) throw new Error('Mês inválido. Use o formato YYYY-MM.');
  const year = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(mm) || mm < 1 || mm > 12) {
    throw new Error('Mês inválido. Use o formato YYYY-MM.');
  }
  return { year, month: mm };
}

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function parseExcelSerialCandidateFromString(value: string): number | null {
  const s = value.trim().replace(',', '.');
  if (!/^\d{4,6}(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n < 20000 || n > 90000) return null;
  return n;
}

function normalizePossiblyExcelSerialDateString(value: string): string | null {
  const n = parseExcelSerialCandidateFromString(value);
  if (n === null) return null;
  const d = excelSerialToDate(n);
  if (!d) return null;
  return formatDatePtBr(d);
}

function parseDateValue(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return excelSerialToDate(value);
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;

  const maybeSerial = parseExcelSerialCandidateFromString(s);
  if (maybeSerial !== null) {
    const d = excelSerialToDate(maybeSerial);
    if (d) return d;
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (br) {
    const dd = Number(br[1]);
    const mm = Number(br[2]);
    const yy = Number(br[3].length === 2 ? `20${br[3]}` : br[3]);
    const d = new Date(yy, mm - 1, dd);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function parseMoneyToCents(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Math.round(value * 100);
  if (typeof value !== 'string') return null;
  let s = value.trim();
  if (!s) return null;
  s = s.replace(/\s/g, '');
  s = s.replace(/[R$\u00A0]/g, '');
  const negative = s.startsWith('-') || /^\(.*\)$/.test(s);
  s = s.replace(/^\(/, '').replace(/\)$/, '').replace(/^-/, '');
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');

  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasDot) {
    if (/\.\d{1,2}$/.test(s)) {
      void 0;
    } else {
      s = s.replace(/\./g, '');
    }
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return negative ? -cents : cents;
}

function centsToPtBr(cents: number): string {
  const n = cents / 100;
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pickFirstExistingColumn(
  existing: string[],
  candidates: string[],
): string | null {
  const set = new Set(existing);
  for (const c of candidates) if (set.has(c)) return c;

  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '');

  const byKey = new Map<string, string>();
  for (const raw of existing) {
    const key = normalize(raw);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, raw);
  }
  for (const c of candidates) {
    const key = normalize(c);
    const found = key ? byKey.get(key) : null;
    if (found) return found;
  }
  return null;
}

function pickFirstColumnContaining(
  existing: string[],
  fragments: string[],
): string | null {
  const lowered = existing.map((c) => ({ raw: c, lower: c.toLowerCase() }));
  for (const frag of fragments) {
    const f = frag.toLowerCase();
    const found = lowered.find((c) => c.lower.includes(f));
    if (found) return found.raw;
  }
  return null;
}

function normalizeKey(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim().replace(/\s+/g, '');
  if (typeof value === 'number') return String(value).trim();
  return '';
}

function readTableRows(db: Database, tableName: string, columns: string[]) {
  const colsSql = columns.map(escapeSqlIdentifier).join(', ');
  const sql = `SELECT ${colsSql} FROM ${escapeSqlIdentifier(tableName)};`;
  const stmt = db.prepare(sql);
  try {
    const out: Array<Record<string, unknown>> = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      out.push(row);
    }
    return out;
  } finally {
    stmt.free();
  }
}

function countTableRows(db: Database, tableName: string): number {
  if (!tableExists(db, tableName)) return 0;
  const stmt = db.prepare(
    `SELECT COUNT(*) AS c FROM ${escapeSqlIdentifier(tableName)};`,
  );
  try {
    if (!stmt.step()) return 0;
    const row = stmt.getAsObject() as { c?: unknown };
    const n = Number(row.c);
    return Number.isFinite(n) ? n : 0;
  } finally {
    stmt.free();
  }
}

function parseCopetenciaToMonthKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12)
      return null;
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  const br4 = /^(\d{2})\/(\d{4})$/.exec(trimmed);
  if (br4) {
    const month = Number(br4[1]);
    const year = Number(br4[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12)
      return null;
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  const br2 = /^(\d{2})\/(\d{2})$/.exec(trimmed);
  if (br2) {
    const month = Number(br2[1]);
    const yy = Number(br2[2]);
    if (!Number.isFinite(yy) || !Number.isFinite(month) || month < 1 || month > 12)
      return null;
    const year = 2000 + yy;
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  const dash = /^(\d{2})-(\d{4})$/.exec(trimmed);
  if (dash) {
    const month = Number(dash[1]);
    const year = Number(dash[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12)
      return null;
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  return null;
}

export async function conciliarExtratoRelatorio(opts: {
  month: string;
  orgao?: string;
}) {
  dotenv.config();
  const { year, month } = parseMonthInput(opts.month);
  const wantedMonthKey = `${year}-${String(month).padStart(2, '0')}`;
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);

  if (!tableExists(db, 'extratos'))
    throw new Error('Tabela extratos não encontrada.');
  if (!tableExists(db, 'relatorio_consignado'))
    throw new Error('Tabela relatorio_consignado não encontrada.');

  const extratoCols = getTableColumns(db, 'extratos');
  const relCols = getTableColumns(db, 'relatorio_consignado');
  const orgaoConfig = getOrgaoColumnsConfigFromDb(db);
  const orgaoDePara = getOrgaoDeParaSets(db, { onlyExtratos: opts.orgao ?? null });
  const orgaoFilterActive =
    orgaoDePara.extratos.size > 0 && orgaoDePara.relatorio.size > 0;

  const extratoOrgaoCol =
    (orgaoConfig.extratos && extratoCols.includes(orgaoConfig.extratos)
      ? orgaoConfig.extratos
      : null) ??
    pickFirstExistingColumn(extratoCols, [
      'HISTÓRICO_1',
      'HISTORICO_1',
      'HISTÓRICO',
      'HISTORICO',
    ]);
  const extratoOrgaoFallbackCol =
    extratoOrgaoCol &&
    [
      'HISTÓRICO_1',
      'HISTORICO_1',
      'HISTÓRICO',
      'HISTORICO',
    ].includes(extratoOrgaoCol)
      ? (pickFirstExistingColumn(extratoCols, [
          extratoOrgaoCol === 'HISTÓRICO_1' || extratoOrgaoCol === 'HISTORICO_1'
            ? 'HISTÓRICO'
            : 'HISTÓRICO_1',
          extratoOrgaoCol === 'HISTÓRICO_1' || extratoOrgaoCol === 'HISTORICO_1'
            ? 'HISTORICO'
            : 'HISTORICO_1',
        ]) ?? null)
      : null;
  const relOrgaoCol =
    (orgaoConfig.relatorio && relCols.includes(orgaoConfig.relatorio)
      ? orgaoConfig.relatorio
      : null) ??
    pickFirstExistingColumn(relCols, ['EMPRESA', 'Empresa']);

  const extratoKeyCol = pickFirstExistingColumn(extratoCols, [
    'DOCUMENTO',
    'Documento',
  ]);
  const extratoValueCol = pickFirstExistingColumn(extratoCols, [
    'VALOR',
    'Valor',
  ]);
  const extratoDateCol = pickFirstExistingColumn(extratoCols, ['DATA', 'Data']);
  const extratoCopCol = pickFirstExistingColumn(extratoCols, [
    'Copetencia',
    'Competencia',
    'COMPETENCIA',
  ]);
  if (!extratoKeyCol || !extratoValueCol || !extratoDateCol) {
    throw new Error(
      'Tabela extratos não possui colunas obrigatórias (DATA, DOCUMENTO, VALOR).',
    );
  }

  const relKeyCol = pickFirstExistingColumn(relCols, [
    'Operação',
    'OPERACAO',
    'Operacao',
  ]);
  const relValueCol = pickFirstExistingColumn(relCols, [
    'Valor Parcela',
    'VALOR PARCELA',
  ]);
  const relDateCol =
    pickFirstExistingColumn(relCols, [
      'Vencimento',
      'Vencto. Operação',
      'Vencto. Operacao',
    ]) ?? pickFirstColumnContaining(relCols, ['vencto', 'vencim']);
  const relCopCol = pickFirstExistingColumn(relCols, [
    'Copetencia',
    'Competencia',
    'COMPETENCIA',
  ]);
  const relModalidadeCol = pickFirstExistingColumn(relCols, ['Modalidade']);
  const modalidadesAceitas = getModalidadesAceitasSet(db);
  if (!relKeyCol || !relValueCol) {
    throw new Error(
      'Tabela relatorio_consignado não possui colunas obrigatórias (Operação e Valor Parcela).',
    );
  }

  const extratoRows = readTableRows(db, 'extratos', [
    extratoDateCol,
    ...(extratoCopCol ? [extratoCopCol] : []),
    extratoKeyCol,
    extratoValueCol,
    ...(extratoOrgaoCol ? [extratoOrgaoCol] : []),
  ]);
  const relRows = readTableRows(
    db,
    'relatorio_consignado',
    relDateCol
      ? [
          relDateCol,
          ...(relCopCol ? [relCopCol] : []),
          relKeyCol,
          relValueCol,
          ...(relModalidadeCol ? [relModalidadeCol] : []),
          ...(relOrgaoCol ? [relOrgaoCol] : []),
        ]
      : [
          ...(relCopCol ? [relCopCol] : []),
          relKeyCol,
          relValueCol,
          ...(relModalidadeCol ? [relModalidadeCol] : []),
          ...(relOrgaoCol ? [relOrgaoCol] : []),
        ],
  );

  const inMonth = (d: Date) =>
    d.getFullYear() === year && d.getMonth() + 1 === month;

  type Agg = {
    extratoCents: number;
    relatorioCents: number;
    extratoCount: number;
    relatorioCount: number;
  };
  const agg = new Map<string, Agg>();

  let extratoTotal = 0;
  let relatorioTotal = 0;
  let extratoRowsUsed = 0;
  let relatorioRowsUsed = 0;

  for (const r of extratoRows) {
    const rowMonthKey = extratoCopCol
      ? parseCopetenciaToMonthKey(r[extratoCopCol])
      : (() => {
          const d = parseDateValue(r[extratoDateCol]);
          return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : null;
        })();
    if (!rowMonthKey || rowMonthKey !== wantedMonthKey) continue;

    if (orgaoFilterActive && extratoOrgaoCol) {
      const org =
        normalizeExtratosOrgaoForMatch(r[extratoOrgaoCol]) ??
        (extratoOrgaoFallbackCol
          ? normalizeExtratosOrgaoForMatch(r[extratoOrgaoFallbackCol])
          : null);
      if (!org) continue;
      if (!orgaoDePara.extratos.has(org)) continue;
    }

    const key = normalizeKey(r[extratoKeyCol]);
    if (!key) continue;
    const cents = parseMoneyToCents(r[extratoValueCol]);
    if (cents === null) continue;
    extratoTotal += cents;
    extratoRowsUsed += 1;
    const cur = agg.get(key) ?? {
      extratoCents: 0,
      relatorioCents: 0,
      extratoCount: 0,
      relatorioCount: 0,
    };
    cur.extratoCents += cents;
    cur.extratoCount += 1;
    agg.set(key, cur);
  }

  for (const r of relRows) {
    const rowMonthKey = relCopCol
      ? parseCopetenciaToMonthKey(r[relCopCol])
      : relDateCol
        ? (() => {
            const d0 = parseDateValue(r[relDateCol]);
            if (!d0) return null;
            const d = new Date(d0.getTime());
            d.setMonth(d.getMonth() - 1);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          })()
        : wantedMonthKey;
    if (!rowMonthKey || rowMonthKey !== wantedMonthKey) continue;

    if (relModalidadeCol && modalidadesAceitas.size > 0) {
      const raw =
        typeof r[relModalidadeCol] === 'string'
          ? r[relModalidadeCol].trim().toUpperCase()
          : '';
      if (raw && !modalidadesAceitas.has(raw)) continue;
    }

    if (orgaoFilterActive && relOrgaoCol) {
      const org = normalizeRelatorioOrgaoForMatch(r[relOrgaoCol]);
      if (!org) continue;
      if (!orgaoDePara.relatorio.has(org)) continue;
    }

    const key = normalizeKey(r[relKeyCol]);
    if (!key) continue;
    const cents = parseMoneyToCents(r[relValueCol]);
    if (cents === null) continue;
    relatorioTotal += cents;
    relatorioRowsUsed += 1;
    const cur = agg.get(key) ?? {
      extratoCents: 0,
      relatorioCents: 0,
      extratoCount: 0,
      relatorioCount: 0,
    };
    cur.relatorioCents += cents;
    cur.relatorioCount += 1;
    agg.set(key, cur);
  }

  const items = Array.from(agg.entries())
    .map(([key, v]) => {
      const diff = v.extratoCents - v.relatorioCents;
      return {
        key,
        extratoCents: v.extratoCents,
        relatorioCents: v.relatorioCents,
        diffCents: diff,
        extratoCount: v.extratoCount,
        relatorioCount: v.relatorioCount,
        conciliated: v.extratoCount > 0 && v.relatorioCount > 0 && diff === 0,
      };
    })
    .sort((a, b) => Math.abs(b.diffCents) - Math.abs(a.diffCents));

  const message =
    typeof opts.orgao === 'string' && opts.orgao.trim()
      ? (() => {
          if (extratoRowsUsed === 0 && relatorioRowsUsed === 0) {
            return `Nenhum lançamento encontrado para o órgão "${opts.orgao.trim()}" na competência ${wantedMonthKey}.`;
          }
          if (extratoRowsUsed === 0) {
            return `Nenhum lançamento do Extrato encontrado para o órgão "${opts.orgao.trim()}" na competência ${wantedMonthKey}.`;
          }
          if (relatorioRowsUsed === 0) {
            return `Nenhum lançamento do Relatório encontrado para o órgão "${opts.orgao.trim()}" na competência ${wantedMonthKey} (verifique o De/Para e Modalidade aceita).`;
          }
          return undefined;
        })()
      : undefined;

  return {
    month: `${year}-${String(month).padStart(2, '0')}`,
    columns: {
      extratos: {
        date: extratoDateCol,
        key: extratoKeyCol,
        value: extratoValueCol,
      },
      relatorio: { date: relDateCol, key: relKeyCol, value: relValueCol },
    },
    totals: {
      extrato: { cents: extratoTotal, text: centsToPtBr(extratoTotal) },
      relatorio: { cents: relatorioTotal, text: centsToPtBr(relatorioTotal) },
      diff: {
        cents: extratoTotal - relatorioTotal,
        text: centsToPtBr(extratoTotal - relatorioTotal),
      },
    },
    items: items.map((i) => ({
      ...i,
      extratoText: centsToPtBr(i.extratoCents),
      relatorioText: centsToPtBr(i.relatorioCents),
      diffText: centsToPtBr(i.diffCents),
    })),
    ...(message ? { message } : {}),
    dbFilePath,
  };
}

export async function listarMesesConcilicacaoDisponiveis() {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);

  if (!tableExists(db, 'extratos'))
    throw new Error('Tabela extratos não encontrada.');
  if (!tableExists(db, 'relatorio_consignado'))
    throw new Error('Tabela relatorio_consignado não encontrada.');

  const extratoCols = getTableColumns(db, 'extratos');
  const relCols = getTableColumns(db, 'relatorio_consignado');

  const extratoDateCol = pickFirstExistingColumn(extratoCols, ['DATA', 'Data']);
  const extratoCopCol = pickFirstExistingColumn(extratoCols, [
    'Copetencia',
    'Competencia',
    'COMPETENCIA',
  ]);
  const relDateCol =
    pickFirstExistingColumn(relCols, [
      'Vencimento',
      'Vencto. Operação',
      'Vencto. Operacao',
    ]) ?? pickFirstColumnContaining(relCols, ['vencto', 'vencim']);
  const relCopCol = pickFirstExistingColumn(relCols, [
    'Copetencia',
    'Competencia',
    'COMPETENCIA',
  ]);

  if (!extratoDateCol && !extratoCopCol)
    throw new Error('Tabela extratos não possui coluna DATA/Copetencia.');
  if (!relDateCol && !relCopCol)
    throw new Error(
      'Tabela relatorio_consignado não possui coluna Vencimento/Copetencia.',
    );

  const extratoRows = readTableRows(db, 'extratos', [
    ...(extratoCopCol ? [extratoCopCol] : []),
    ...(extratoDateCol ? [extratoDateCol] : []),
  ]);
  const relRows = readTableRows(db, 'relatorio_consignado', [
    ...(relCopCol ? [relCopCol] : []),
    ...(relDateCol ? [relDateCol] : []),
  ]);

  const toMonth = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const extratoMonths = new Set<string>();
  for (const r of extratoRows) {
    const m = extratoCopCol ? parseCopetenciaToMonthKey(r[extratoCopCol]) : null;
    if (m) {
      extratoMonths.add(m);
      continue;
    }
    if (!extratoDateCol) continue;
    const d = parseDateValue(r[extratoDateCol]);
    if (!d) continue;
    extratoMonths.add(toMonth(d));
  }

  const relMonths = new Set<string>();
  for (const r of relRows) {
    const m = relCopCol ? parseCopetenciaToMonthKey(r[relCopCol]) : null;
    if (m) {
      relMonths.add(m);
      continue;
    }
    if (!relDateCol) continue;
    const d = parseDateValue(r[relDateCol]);
    if (!d) continue;
    relMonths.add(toMonth(d));
  }

  const intersection = Array.from(extratoMonths)
    .filter((m) => relMonths.has(m))
    .sort((a, b) => b.localeCompare(a));

  const union = Array.from(new Set([...extratoMonths, ...relMonths])).sort(
    (a, b) => b.localeCompare(a),
  );

  const months = intersection.length > 0 ? intersection : union;

  return { months, dbFilePath };
}

function formatDatePtBr(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function formatDateLocalIso(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${yy}-${mm}-${dd}`;
}

export async function conciliarExtratoRelatorioDetalhe(opts: {
  month: string;
  key: string;
  orgao?: string;
}) {
  dotenv.config();
  const { year, month } = parseMonthInput(opts.month);
  const wantedMonthKey = `${year}-${String(month).padStart(2, '0')}`;
  const rawKey = opts.key.trim();
  const isMonthAggregate =
    rawKey === '__MONTH__' || rawKey === '__TOTAL__' || rawKey === '__ALL__';
  const wantedKey = isMonthAggregate ? null : normalizeKey(opts.key);
  if (!isMonthAggregate && !wantedKey) throw new Error('Chave inválida.');

  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);

  if (!tableExists(db, 'extratos'))
    throw new Error('Tabela extratos não encontrada.');
  if (!tableExists(db, 'relatorio_consignado'))
    throw new Error('Tabela relatorio_consignado não encontrada.');

  const extratoCols = getTableColumns(db, 'extratos');
  const relCols = getTableColumns(db, 'relatorio_consignado');
  const orgaoConfig = getOrgaoColumnsConfigFromDb(db);
  const orgaoDePara = getOrgaoDeParaSets(db, { onlyExtratos: opts.orgao ?? null });
  const orgaoDeParaMaps = getOrgaoDeParaMaps(db, { onlyExtratos: opts.orgao ?? null });
  const orgaoFilterActive =
    orgaoDePara.extratos.size > 0 && orgaoDePara.relatorio.size > 0;

  const extratoKeyCol = pickFirstExistingColumn(extratoCols, [
    'DOCUMENTO',
    'Documento',
  ]);
  const extratoValueCol = pickFirstExistingColumn(extratoCols, [
    'VALOR',
    'Valor',
  ]);
  const extratoDateCol = pickFirstExistingColumn(extratoCols, ['DATA', 'Data']);
  const extratoCopCol = pickFirstExistingColumn(extratoCols, [
    'Copetencia',
    'Competencia',
    'COMPETENCIA',
  ]);
  const extratoHist1 = pickFirstExistingColumn(extratoCols, [
    'HISTÓRICO',
    'HISTORICO',
  ]);
  const extratoHist2 = pickFirstExistingColumn(extratoCols, [
    'HISTÓRICO_1',
    'HISTORICO_1',
  ]);
  const extratoOrgaoCol =
    (orgaoConfig.extratos &&
    extratoCols.includes(orgaoConfig.extratos)
      ? orgaoConfig.extratos
      : null) ??
    pickFirstExistingColumn(extratoCols, [
      'HISTÓRICO_1',
      'HISTORICO_1',
      'ÓRGÃO',
      'ORGAO',
      'Órgão',
      'Orgao',
    ]);
  if (!extratoKeyCol || !extratoValueCol || !extratoDateCol) {
    throw new Error(
      'Tabela extratos não possui colunas obrigatórias (DATA, DOCUMENTO, VALOR).',
    );
  }

  const relKeyCol = pickFirstExistingColumn(relCols, [
    'Operação',
    'OPERACAO',
    'Operacao',
  ]);
  const relValueCol = pickFirstExistingColumn(relCols, [
    'Valor Parcela',
    'VALOR PARCELA',
  ]);
  const relDateCol =
    pickFirstExistingColumn(relCols, [
      'Vencimento',
      'Vencto. Operação',
      'Vencto. Operacao',
    ]) ?? pickFirstColumnContaining(relCols, ['vencto', 'vencim']);
  const relCopCol = pickFirstExistingColumn(relCols, [
    'Copetencia',
    'Competencia',
    'COMPETENCIA',
  ]);
  const relModalidadeCol = pickFirstExistingColumn(relCols, ['Modalidade']);
  const modalidadesAceitas = getModalidadesAceitasSet(db);
  const relEmpresaCol =
    (orgaoConfig.relatorio &&
    relCols.includes(orgaoConfig.relatorio)
      ? orgaoConfig.relatorio
      : null) ??
    pickFirstExistingColumn(relCols, [
      'EMPRESA',
      'Empresa',
      'ÓRGÃO',
      'ORGAO',
      'Órgão',
      'Orgao',
    ]);
  if (!relKeyCol || !relValueCol) {
    throw new Error(
      'Tabela relatorio_consignado não possui colunas obrigatórias (Operação e Valor Parcela).',
    );
  }

  const extratoSelectCols = [
    extratoDateCol,
    ...(extratoCopCol ? [extratoCopCol] : []),
    extratoKeyCol,
    extratoValueCol,
  ].concat(
    Array.from(
      new Set([extratoOrgaoCol, extratoHist2, extratoHist1].filter(Boolean)),
    ) as string[],
  );
  const extratoRows = readTableRows(db, 'extratos', extratoSelectCols);
  const extratoItems: Array<{
    iso: string;
    competencia: string;
    date: string;
    cents: number;
    orgaoMatchKey: string | null;
    orgao: string | null;
    historico: string | null;
  }> = [];
  for (const r of extratoRows) {
    const rowMonthKey = extratoCopCol
      ? parseCopetenciaToMonthKey(r[extratoCopCol])
      : (() => {
          const d = parseDateValue(r[extratoDateCol]);
          return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : null;
        })();
    if (!rowMonthKey || rowMonthKey !== wantedMonthKey) continue;

    const orgaoMatchKey =
      (extratoOrgaoCol ? normalizeExtratosOrgaoForMatch(r[extratoOrgaoCol]) : null) ??
      (extratoHist2 ? normalizeExtratosOrgaoForMatch(r[extratoHist2]) : null) ??
      (extratoHist1 ? normalizeExtratosOrgaoForMatch(r[extratoHist1]) : null);
    if (orgaoFilterActive && extratoOrgaoCol) {
      if (!orgaoMatchKey) continue;
      if (!orgaoDePara.extratos.has(orgaoMatchKey)) continue;
    }

    const d = parseDateValue(r[extratoDateCol]);
    if (!d) continue;
    const key = normalizeKey(r[extratoKeyCol]);
    if (wantedKey && key !== wantedKey) continue;
    const cents = parseMoneyToCents(r[extratoValueCol]);
    if (cents === null) continue;

    const competencia =
      typeof (extratoCopCol ? r[extratoCopCol] : null) === 'string'
        ? String(r[extratoCopCol!]).trim()
        : (() => {
            const yy = String(d.getFullYear() % 100).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            return `${mm}/${yy}`;
          })();

    const histParts = [
      extratoHist2 ? r[extratoHist2] : null,
    ]
      .filter((v) => typeof v === 'string' && v.trim().length > 0)
      .map((v) => String(v));
    const historico = histParts.length > 0 ? histParts.join(' | ') : null;
    const orgao =
      extratoOrgaoCol && typeof r[extratoOrgaoCol] === 'string'
        ? r[extratoOrgaoCol].trim() || null
        : historico;

    extratoItems.push({
      iso: formatDateLocalIso(d),
      competencia,
      date: formatDatePtBr(d),
      cents,
      orgaoMatchKey,
      orgao,
      historico,
    });
  }
  const extratoSorted = extratoItems.sort((a, b) => a.iso.localeCompare(b.iso));

  const relSelectCols = [relKeyCol, relValueCol].concat(
    [relDateCol, relCopCol, relModalidadeCol, relEmpresaCol].filter(
      Boolean,
    ) as string[],
  );
  const relRows = readTableRows(db, 'relatorio_consignado', relSelectCols);
  const relItems: Array<{
    iso: string;
    competencia: string | null;
    vencimento: string | null;
    cents: number;
    orgaoMatchKey: string | null;
    orgao: string | null;
    modalidade: string | null;
  }> = [];
  for (const r of relRows) {
    const key = normalizeKey(r[relKeyCol]);
    if (wantedKey && key !== wantedKey) continue;

    const rowMonthKey = relCopCol
      ? parseCopetenciaToMonthKey(r[relCopCol])
      : relDateCol
        ? (() => {
            const d0 = parseDateValue(r[relDateCol]);
            if (!d0) return null;
            const d = new Date(d0.getTime());
            d.setMonth(d.getMonth() - 1);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          })()
        : wantedMonthKey;
    if (!rowMonthKey || rowMonthKey !== wantedMonthKey) continue;

    const d = relDateCol ? parseDateValue(r[relDateCol]) : null;

    const cents = parseMoneyToCents(r[relValueCol]);
    if (cents === null) continue;

    const iso = d ? formatDateLocalIso(d) : 'NO_DATE';
    const competencia =
      typeof (relCopCol ? r[relCopCol] : null) === 'string'
        ? String(r[relCopCol!]).trim()
        : d
          ? (() => {
              const d2 = new Date(d.getTime());
              d2.setMonth(d2.getMonth() - 1);
              const mm = String(d2.getMonth() + 1).padStart(2, '0');
              const yyyy = String(d2.getFullYear());
              return `${mm}/${yyyy}`;
            })()
          : null;
    const modalidade =
      relModalidadeCol && typeof r[relModalidadeCol] === 'string'
        ? r[relModalidadeCol].trim().toUpperCase() || null
        : null;
    const orgao =
      relEmpresaCol && typeof r[relEmpresaCol] === 'string'
        ? r[relEmpresaCol].trim() || null
        : null;

    if (orgaoFilterActive && relEmpresaCol) {
      const orgKey = normalizeRelatorioOrgaoForMatch(r[relEmpresaCol]);
      if (!orgKey) continue;
      if (!orgaoDePara.relatorio.has(orgKey)) continue;
    }

    if (!modalidade) continue;
    if (modalidadesAceitas.size === 0) continue;
    if (!modalidadesAceitas.has(modalidade)) continue;

    const relOrgaoKey = relEmpresaCol ? normalizeRelatorioOrgaoForMatch(r[relEmpresaCol]) : null;
    const orgaoMatchKey = orgaoFilterActive
      ? (relOrgaoKey ? orgaoDeParaMaps.relatorioToExtratos.get(relOrgaoKey) ?? null : null)
      : relOrgaoKey;
    if (orgaoFilterActive && relEmpresaCol && !orgaoMatchKey) continue;

    relItems.push({
      iso,
      competencia,
      vencimento: d ? formatDatePtBr(d) : null,
      cents,
      orgaoMatchKey,
      orgao,
      modalidade,
    });
  }
  const relSorted = relItems.sort((a, b) => a.iso.localeCompare(b.iso));

  const resolveGroupKey = (value: string | null) =>
    value && value.trim() ? value : '__ALL__';
  const extratoGroupKeys = extratoSorted.map((v) => resolveGroupKey(v.orgaoMatchKey));
  const relatorioGroupKeys = relSorted.map((v) => resolveGroupKey(v.orgaoMatchKey));

  const extratoPairIdByIndex: Array<string | null> = new Array(extratoSorted.length).fill(null);
  const relPairIdByIndex: Array<string | null> = new Array(relSorted.length).fill(null);

  let pairSeq = 1;
  const allocPairId = () => `P${pairSeq++}`;

  const relByGroupAndCents = new Map<string, number[]>();

  for (let i = 0; i < relSorted.length; i++) {
    const r = relSorted[i];
    const key = `${relatorioGroupKeys[i]}\u0000${r.cents}`;
    const byC = relByGroupAndCents.get(key);
    if (byC) byC.push(i);
    else relByGroupAndCents.set(key, [i]);
  }

  const tryClaimRelIndex = (idx: number, pairId: string) => {
    if (idx < 0 || idx >= relPairIdByIndex.length) return false;
    if (relPairIdByIndex[idx]) return false;
    relPairIdByIndex[idx] = pairId;
    return true;
  };

  const tryClaimRelGroup = (indices: number[], pairId: string) => {
    for (const idx of indices) {
      if (!tryClaimRelIndex(idx, pairId)) return false;
    }
    return true;
  };

  for (let i = 0; i < extratoSorted.length; i++) {
    if (extratoPairIdByIndex[i]) continue;
    const e = extratoSorted[i];
    const groupKey = extratoGroupKeys[i];
    const arr = relByGroupAndCents.get(`${groupKey}\u0000${e.cents}`);
    if (!arr || arr.length === 0) continue;
    const relIdx = arr.find((x) => !relPairIdByIndex[x]);
    if (typeof relIdx !== 'number') continue;
    const pairId = allocPairId();
    extratoPairIdByIndex[i] = pairId;
    tryClaimRelIndex(relIdx, pairId);
  }

  const findRelGroupAnyDateBySum = (
    targetCents: number,
    groupKey: string,
    maxGroupSize: number,
    candidateLimit: number,
    nodeLimit: number,
  ): number[] | null => {
    if (targetCents === 0) return null;
    const targetAbs = Math.abs(targetCents);
    const sign = Math.sign(targetCents);

    const candidates: number[] = [];
    for (let i = 0; i < relSorted.length; i++) {
      if (relPairIdByIndex[i]) continue;
      if (relatorioGroupKeys[i] !== groupKey) continue;
      const c = relSorted[i].cents;
      if (c === 0) continue;
      if (Math.sign(c) !== sign) continue;
      if (Math.abs(c) > targetAbs) continue;
      candidates.push(i);
    }

    candidates.sort(
      (a, b) => Math.abs(relSorted[b].cents) - Math.abs(relSorted[a].cents),
    );
    const limited = candidates.slice(0, Math.max(0, candidateLimit));
    if (limited.length < 2) return null;

    let nodes = 0;
    const chosen: number[] = [];

    const dfs = (start: number, sum: number): boolean => {
      nodes += 1;
      if (nodes > nodeLimit) return false;
      if (sum === targetCents) return true;
      if (chosen.length >= maxGroupSize) return false;

      if (sign > 0 && sum > targetCents) return false;
      if (sign < 0 && sum < targetCents) return false;

      for (let j = start; j < limited.length; j++) {
        const idx = limited[j];
        if (relPairIdByIndex[idx]) continue;
        const nextSum = sum + relSorted[idx].cents;
        if (sign > 0 && nextSum > targetCents) continue;
        if (sign < 0 && nextSum < targetCents) continue;
        chosen.push(idx);
        if (dfs(j + 1, nextSum)) return true;
        chosen.pop();
      }

      return false;
    };

    if (!dfs(0, 0)) return null;
    return chosen.slice();
  };

  for (let i = 0; i < extratoSorted.length; i++) {
    if (extratoPairIdByIndex[i]) continue;
    const e = extratoSorted[i];
    const group = findRelGroupAnyDateBySum(e.cents, extratoGroupKeys[i], 12, 70, 25000);
    if (!group || group.length < 2) continue;
    const pairId = allocPairId();
    extratoPairIdByIndex[i] = pairId;
    if (!tryClaimRelGroup(group, pairId)) {
      extratoPairIdByIndex[i] = null;
    }
  }

  const parsePairNum = (pairId: string | null): number | null => {
    if (!pairId) return null;
    const m = /^P(\d+)$/.exec(pairId);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };

  const extrato = extratoSorted
    .map((v, idx) => {
      const pairId = extratoPairIdByIndex[idx];
      return {
        competencia: v.competencia,
        date: v.date,
        value: centsToPtBr(v.cents),
        orgao: v.orgao,
        historico: v.historico,
        status: pairId ? 'conciliado' : 'pendencia',
        pairId,
        __order: idx,
      };
    })
    .sort((a, b) => {
      const pa = parsePairNum(a.pairId);
      const pb = parsePairNum(b.pairId);
      if (pa === null && pb === null) return a.__order - b.__order;
      if (pa === null) return 1;
      if (pb === null) return -1;
      if (pa !== pb) return pa - pb;
      return a.__order - b.__order;
    })
    .map(({ __order, ...rest }) => rest);

  const relatorio = relSorted
    .map((v, idx) => {
    const pairId = relPairIdByIndex[idx];
    return {
      competencia: v.competencia,
      vencimento: v.vencimento,
      value: centsToPtBr(v.cents),
      orgao: v.orgao,
      modalidade: v.modalidade,
      status: pairId ? 'conciliado' : 'pendencia',
      pairId,
      __order: idx,
    };
    })
    .sort((a, b) => {
      const pa = parsePairNum(a.pairId);
      const pb = parsePairNum(b.pairId);
      if (pa === null && pb === null) return a.__order - b.__order;
      if (pa === null) return 1;
      if (pb === null) return -1;
      if (pa !== pb) return pa - pb;
      return a.__order - b.__order;
    })
    .map(({ __order, ...rest }) => rest);

  const message =
    typeof opts.orgao === 'string' && opts.orgao.trim()
      ? (() => {
          if (extratoItems.length === 0 && relItems.length === 0) {
            return `Nenhum lançamento encontrado para o órgão "${opts.orgao.trim()}" na competência ${wantedMonthKey}.`;
          }
          if (extratoItems.length === 0) {
            return `Nenhum lançamento do Extrato encontrado para o órgão "${opts.orgao.trim()}" na competência ${wantedMonthKey}.`;
          }
          if (relItems.length === 0) {
            return `Nenhum lançamento do Relatório encontrado para o órgão "${opts.orgao.trim()}" na competência ${wantedMonthKey} (verifique o De/Para e Modalidade aceita).`;
          }
          return undefined;
        })()
      : undefined;

  return {
    month: `${year}-${String(month).padStart(2, '0')}`,
    key: wantedKey ?? '__MONTH__',
    extrato,
    relatorio,
    ...(message ? { message } : {}),
  };
}

function resolveRecursoTableForOrgao(
  db: Database,
  orgaoInput: string,
  requested?: string,
): string {
  const wanted = typeof requested === 'string' ? requested.trim() : '';
  if (wanted) return wanted;

  const orgaoKey =
    normalizeExtratosOrgaoForMatch(orgaoInput) ??
    normalizeRelatorioOrgaoForMatch(orgaoInput) ??
    '';

  const alegoTable = 'Recurso ALEGO';
  const mpgoTable = 'Recurso MPGO';
  const hasAlego = tableExists(db, alegoTable);
  const hasMpgo = tableExists(db, mpgoTable);

  const isMpgo =
    Boolean(orgaoKey) &&
    (orgaoKey.includes('PROCURADORIA GERAL DE JUSTICA') ||
      orgaoKey.includes('MINISTERIO PUBLICO') ||
      orgaoKey.includes('MPGO'));

  if (isMpgo && hasMpgo) return mpgoTable;
  if (!isMpgo && hasAlego) return alegoTable;
  if (hasAlego) return alegoTable;
  if (hasMpgo) return mpgoTable;
  return alegoTable;
}

export async function conciliarRecursoOrgaoRelatorio(opts: {
  month: string;
  orgao: string;
  recursoTable?: string;
}) {
  dotenv.config();
  const { year, month } = parseMonthInput(opts.month);
  const wantedMonthKey = `${year}-${String(month).padStart(2, '0')}`;
  const wantedCopetencia = `${String(month).padStart(2, '0')}/${String(year % 100).padStart(2, '0')}`;

  const orgaoInput = opts.orgao.trim();
  if (!orgaoInput) throw new Error('Informe o órgão.');

  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);

  const recursoTable = resolveRecursoTableForOrgao(db, orgaoInput, opts.recursoTable);

  if (!tableExists(db, 'extratos'))
    throw new Error('Tabela extratos não encontrada.');
  if (!tableExists(db, 'relatorio_consignado'))
    throw new Error('Tabela relatorio_consignado não encontrada.');
  if (!tableExists(db, recursoTable))
    throw new Error(`Tabela não encontrada: ${recursoTable}`);

  const normalizeCpfDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
  const normalizeCpfDisplay = (v: unknown) => normalizeCpfValue(v);

  const extratoCols = getTableColumns(db, 'extratos');
  const relCols = getTableColumns(db, 'relatorio_consignado');
  const recursoCols = getTableColumns(db, recursoTable);

  const orgaoConfig = getOrgaoColumnsConfigFromDb(db);
  const orgaoDePara = getOrgaoDeParaSets(db, { onlyExtratos: orgaoInput });
  const orgaoDeParaMaps = getOrgaoDeParaMaps(db, { onlyExtratos: orgaoInput });
  const orgaoFilterActive =
    orgaoDePara.extratos.size > 0 && orgaoDePara.relatorio.size > 0;

  const extratoDateCol = pickFirstExistingColumn(extratoCols, ['DATA', 'Data']);
  const extratoCopCol = pickFirstExistingColumn(extratoCols, [
    'Copetencia',
    'Competencia',
    'COMPETENCIA',
  ]);
  const extratoKeyCol = pickFirstExistingColumn(extratoCols, [
    'DOCUMENTO',
    'Documento',
  ]);
  const extratoValueCol = pickFirstExistingColumn(extratoCols, ['VALOR', 'Valor']);
  const extratoHist1 = pickFirstExistingColumn(extratoCols, ['HISTÓRICO', 'HISTORICO']);
  const extratoHist2 = pickFirstExistingColumn(extratoCols, ['HISTÓRICO_1', 'HISTORICO_1']);
  const extratoOrgaoCol =
    (orgaoConfig.extratos && extratoCols.includes(orgaoConfig.extratos)
      ? orgaoConfig.extratos
      : null) ??
    pickFirstExistingColumn(extratoCols, [
      'HISTÓRICO_1',
      'HISTORICO_1',
      'ÓRGÃO',
      'ORGAO',
      'Órgão',
      'Orgao',
    ]);
  if (!extratoDateCol || !extratoKeyCol || !extratoValueCol) {
    throw new Error(
      'Tabela extratos não possui colunas obrigatórias (DATA, DOCUMENTO, VALOR).',
    );
  }

  const relCpfCol =
    pickFirstExistingColumn(relCols, ['CPF', 'Cpf']) ??
    pickFirstColumnContaining(relCols, ['cpf']);
  const relNomeCol =
    pickFirstExistingColumn(relCols, ['NOME', 'Nome']) ??
    pickFirstColumnContaining(relCols, ['nome']);
  const relValueCol = pickFirstExistingColumn(relCols, [
    'Valor Parcela',
    'VALOR PARCELA',
  ]);
  const relDateCol =
    pickFirstExistingColumn(relCols, [
      'Vencimento',
      'Vencto. Operação',
      'Vencto. Operacao',
    ]) ?? pickFirstColumnContaining(relCols, ['vencto', 'vencim']);
  const relCopCol = pickFirstExistingColumn(relCols, [
    'Copetencia',
    'Competencia',
    'COMPETENCIA',
  ]);
  const relModalidadeCol = pickFirstExistingColumn(relCols, ['Modalidade']);
  const modalidadesAceitas = getModalidadesAceitasSet(db);
  const relEmpresaCol =
    (orgaoConfig.relatorio && relCols.includes(orgaoConfig.relatorio)
      ? orgaoConfig.relatorio
      : null) ??
    pickFirstExistingColumn(relCols, [
      'EMPRESA',
      'Empresa',
      'ÓRGÃO',
      'ORGAO',
      'Órgão',
      'Orgao',
    ]);
  if (!relCpfCol || !relValueCol) {
    throw new Error(
      'Tabela relatorio_consignado não possui colunas obrigatórias (CPF e Valor Parcela).',
    );
  }

  const recursoCpfCol =
    recursoCols.find((c) => normalizeHeaderKey(c) === 'CPF') ?? null;
  const recursoNomeCol =
    recursoCols.find((c) => {
      const key = normalizeHeaderKey(c);
      return key === 'NOME' || key.startsWith('NOME ');
    }) ??
    pickFirstColumnContaining(recursoCols, ['nome']) ??
    null;
  const recursoValorCol =
    recursoCols.find((c) => {
      const key = normalizeHeaderKey(c).replace(/\s/g, '');
      return key === 'VALORPARCELA' || key === 'VALOR';
    }) ?? null;
  const recursoCompCol =
    recursoCols.find((c) =>
      ['COMPETENCIA', 'COPETENCIA'].includes(normalizeHeaderKey(c).replace(/\s/g, '')),
    ) ?? null;
  if (!recursoCpfCol || !recursoValorCol) {
    throw new Error(
      `Tabela ${recursoTable} não possui colunas obrigatórias (CPF e Valor Parcela).`,
    );
  }

  const extratoSelectCols = [
    extratoDateCol,
    ...(extratoCopCol ? [extratoCopCol] : []),
    extratoKeyCol,
    extratoValueCol,
  ].concat(
    Array.from(new Set([extratoOrgaoCol, extratoHist2, extratoHist1].filter(Boolean))) as string[],
  );
  const extratoRows = readTableRows(db, 'extratos', extratoSelectCols);
  const consolidacaoKeys = getExtratosConsolidacaoHistoricoKeys(db, { orgaoExtratosRaw: orgaoInput });
  let extratosTotal = 0;
  for (const r of extratoRows) {
    const rowMonthKey = extratoCopCol
      ? parseCopetenciaToMonthKey(r[extratoCopCol])
      : (() => {
          const d = parseDateValue(r[extratoDateCol]);
          return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : null;
        })();
    if (!rowMonthKey || rowMonthKey !== wantedMonthKey) continue;

    const orgaoMatchKey =
      (extratoOrgaoCol ? normalizeExtratosOrgaoForMatch(r[extratoOrgaoCol]) : null) ??
      (extratoHist2 ? normalizeExtratosOrgaoForMatch(r[extratoHist2]) : null) ??
      (extratoHist1 ? normalizeExtratosOrgaoForMatch(r[extratoHist1]) : null);
    const historicoMatchKey = extratoHist2 ? normalizeExtratosHistoricoForMatch(r[extratoHist2]) : null;
    const isConsolidated =
      Boolean(orgaoMatchKey && consolidacaoKeys.has(orgaoMatchKey)) ||
      Boolean(historicoMatchKey && consolidacaoKeys.has(historicoMatchKey));
    if (orgaoFilterActive) {
      if (!orgaoMatchKey) continue;
      if (!orgaoDePara.extratos.has(orgaoMatchKey) && !isConsolidated) continue;
    } else {
      const rawOrgao =
        (extratoOrgaoCol && typeof r[extratoOrgaoCol] === 'string'
          ? r[extratoOrgaoCol]
          : '') || '';
      const altOrgao =
        (extratoHist2 && typeof r[extratoHist2] === 'string' ? r[extratoHist2] : '') || '';
      const compare = (rawOrgao || altOrgao || '').trim();
      if (compare && compare !== orgaoInput) {
        if (!isConsolidated && !altOrgao.includes(orgaoInput) && !rawOrgao.includes(orgaoInput)) continue;
      }
    }

    const d = parseDateValue(r[extratoDateCol]);
    if (!d) continue;
    const cents = parseMoneyToCents(r[extratoValueCol]);
    if (cents === null) continue;
    extratosTotal += cents;
  }

  const recursoSelectCols = [
    recursoCpfCol,
    ...(recursoNomeCol ? [recursoNomeCol] : []),
    recursoValorCol,
    ...(recursoCompCol ? [recursoCompCol] : []),
  ];
  const recursoRows = readTableRows(db, recursoTable, recursoSelectCols);
  const recursoItems: Array<{
    cpfDigits: string;
    cpf: string;
    nome: string;
    cents: number;
    pairId: string | null;
  }> = [];
  for (const r of recursoRows) {
    if (recursoCompCol) {
      const compRaw = String(r[recursoCompCol] ?? '').trim();
      if (compRaw) {
        const m = parseCopetenciaToMonthKey(compRaw);
        if (m && m !== wantedMonthKey) continue;
        if (!m && compRaw !== wantedCopetencia) continue;
      }
    }

    const cpfDigits = normalizeCpfDigits(r[recursoCpfCol]);
    if (cpfDigits.length !== 11) continue;
    const cents = parseMoneyToCents(r[recursoValorCol]);
    if (cents === null) continue;
    const nome =
      recursoNomeCol && typeof r[recursoNomeCol] === 'string'
        ? String(r[recursoNomeCol]).trim()
        : '';
    recursoItems.push({
      cpfDigits,
      cpf: normalizeCpfDisplay(r[recursoCpfCol]),
      nome,
      cents,
      pairId: null,
    });
  }

  const relSelectCols = [
    relCpfCol,
    ...(relNomeCol ? [relNomeCol] : []),
    relValueCol,
    ...(relCopCol ? [relCopCol] : []),
    ...(relDateCol ? [relDateCol] : []),
    ...(relModalidadeCol ? [relModalidadeCol] : []),
    ...(relEmpresaCol ? [relEmpresaCol] : []),
  ];
  const relRows = readTableRows(db, 'relatorio_consignado', relSelectCols);
  const relItems: Array<{
    cpfDigits: string;
    cpf: string;
    nome: string;
    cents: number;
    competencia: string | null;
    vencimento: string | null;
    modalidade: string | null;
    empresa: string | null;
    pairId: string | null;
  }> = [];
  for (const r of relRows) {
    const rowMonthKey = relCopCol
      ? parseCopetenciaToMonthKey(r[relCopCol])
      : relDateCol
        ? (() => {
            const d0 = parseDateValue(r[relDateCol]);
            if (!d0) return null;
            const d = new Date(d0.getTime());
            d.setMonth(d.getMonth() - 1);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          })()
        : null;
    if (!rowMonthKey || rowMonthKey !== wantedMonthKey) continue;

    if (relModalidadeCol && modalidadesAceitas.size > 0) {
      const raw =
        typeof r[relModalidadeCol] === 'string'
          ? r[relModalidadeCol].trim().toUpperCase()
          : '';
      if (raw && !modalidadesAceitas.has(raw)) continue;
    }

    if (orgaoFilterActive && relEmpresaCol) {
      const orgKey = normalizeRelatorioOrgaoForMatch(r[relEmpresaCol]);
      if (!orgKey) continue;
      if (!orgaoDePara.relatorio.has(orgKey)) continue;
    }

    const cpfDigits = normalizeCpfDigits(r[relCpfCol]);
    if (cpfDigits.length !== 11) continue;
    const cents = parseMoneyToCents(r[relValueCol]);
    if (cents === null) continue;
    const nome =
      relNomeCol && typeof r[relNomeCol] === 'string'
        ? String(r[relNomeCol]).trim()
        : '';
    const d = relDateCol ? parseDateValue(r[relDateCol]) : null;
    const vencimento = d ? formatDatePtBr(d) : null;
    const competencia =
      relCopCol && typeof r[relCopCol] === 'string'
        ? String(r[relCopCol]).trim()
        : null;
    const modalidade =
      relModalidadeCol && typeof r[relModalidadeCol] === 'string'
        ? r[relModalidadeCol].trim().toUpperCase() || null
        : null;
    const empresa =
      relEmpresaCol && typeof r[relEmpresaCol] === 'string'
        ? String(r[relEmpresaCol]).trim() || null
        : null;

    const relOrgaoKey = relEmpresaCol ? normalizeRelatorioOrgaoForMatch(r[relEmpresaCol]) : null;
    const mapped = orgaoFilterActive
      ? (relOrgaoKey ? orgaoDeParaMaps.relatorioToExtratos.get(relOrgaoKey) ?? null : null)
      : null;
    if (orgaoFilterActive && relEmpresaCol) {
      if (!mapped) continue;
    }

    relItems.push({
      cpfDigits,
      cpf: normalizeCpfDisplay(r[relCpfCol]),
      nome,
      cents,
      competencia,
      vencimento,
      modalidade,
      empresa,
      pairId: null,
    });
  }

  const relByCpfAndCents = new Map<string, number[]>();
  for (let i = 0; i < relItems.length; i++) {
    const r = relItems[i];
    const k = `${r.cpfDigits}\u0000${r.cents}`;
    const arr = relByCpfAndCents.get(k);
    if (arr) arr.push(i);
    else relByCpfAndCents.set(k, [i]);
  }

  let pairSeq = 1;
  const allocPairId = () => `P${pairSeq++}`;
  const claimedRel = new Array(relItems.length).fill(false);
  for (const r of recursoItems) {
    const arr = relByCpfAndCents.get(`${r.cpfDigits}\u0000${r.cents}`);
    if (!arr) continue;
    const idx = arr.find((x) => !claimedRel[x]);
    if (typeof idx !== 'number') continue;
    const pid = allocPairId();
    r.pairId = pid;
    relItems[idx].pairId = pid;
    claimedRel[idx] = true;
  }

  const recursoTotal = recursoItems.reduce((acc, v) => acc + v.cents, 0);
  const relatorioTotal = relItems.reduce((acc, v) => acc + v.cents, 0);
  const conciliadoTotal = recursoItems
    .filter((v) => Boolean(v.pairId))
    .reduce((acc, v) => acc + v.cents, 0);
  const diff = extratosTotal - conciliadoTotal;

  const tarifaLinha = getConciliacaoTarifaCentsSoft(db, {
    monthKey: wantedMonthKey,
    orgaoRaw: orgaoInput,
    type: 'linha',
  });
  const tarifaTed = getConciliacaoTarifaCentsSoft(db, {
    monthKey: wantedMonthKey,
    orgaoRaw: orgaoInput,
    type: 'ted',
  });

  const orgaoKeyForOcc = normalizeExtratosOrgaoForMatch(orgaoInput);
  const occByKey = new Map<
    string,
    { id: number; createdAt: string; action: string; justification: string }
  >();
  if (orgaoKeyForOcc && tableExists(db, 'conciliacao_pendencia_actions')) {
    const rows = readTableRows(db, 'conciliacao_pendencia_actions', [
      'id',
      'created_at',
      'month',
      'orgao',
      'cpf',
      'value',
      'action',
      'justification',
      'undone_at',
      'error',
    ]);
    for (const r of rows) {
      const month = typeof r.month === 'string' ? r.month.trim() : '';
      if (month !== wantedMonthKey) continue;
      const orgao = typeof r.orgao === 'string' ? r.orgao.trim() : '';
      if (!orgao) continue;
      const okOrgao = normalizeExtratosOrgaoForMatch(orgao);
      if (!okOrgao || okOrgao !== orgaoKeyForOcc) continue;
      const undoneAt =
        typeof (r as any).undone_at === 'string' ? String((r as any).undone_at).trim() : '';
      if (undoneAt) continue;
      const cpfDigits = normalizeCpfDigits(r.cpf);
      if (cpfDigits.length !== 11) continue;
      const cents = parseMoneyToCents(r.value);
      if (cents === null) continue;
      const id = Number((r as any).id);
      if (!Number.isFinite(id)) continue;
      const createdAt =
        typeof (r as any).created_at === 'string'
          ? String((r as any).created_at).trim()
          : '';
      const action =
        typeof (r as any).action === 'string' ? String((r as any).action).trim() : '';
      const justification =
        typeof (r as any).justification === 'string'
          ? String((r as any).justification).trim()
          : '';
      if (!action || !justification) continue;
      const error = typeof (r as any).error === 'string' ? String((r as any).error).trim() : '';
      if (error) continue;
      const key = `${cpfDigits}|${cents}`;
      const existing = occByKey.get(key);
      if (!existing || id > existing.id) {
        occByKey.set(key, { id, createdAt, action, justification });
      }
    }
  }

  const canonicalNomeByCpfAndCents = (() => {
    const cleanNome = (v: unknown) =>
      String(v ?? '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const nomeKey = (nome: string) =>
      nome
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const scoreNome = (nome: string) => nome.replace(/\s+/g, '').length;

    const stats = new Map<
      string,
      Map<string, { count: number; raw: string; score: number }>
    >();

    const add = (key: string, nomeRaw: unknown) => {
      const raw = cleanNome(nomeRaw);
      if (!raw) return;
      const nk = nomeKey(raw);
      if (!nk) return;
      const byNome = stats.get(key) ?? new Map();
      const cur = byNome.get(nk);
      const sc = scoreNome(raw);
      if (cur) {
        cur.count += 1;
        if (sc > cur.score || (sc === cur.score && raw.localeCompare(cur.raw, 'pt-BR') < 0)) {
          cur.raw = raw;
          cur.score = sc;
        }
      } else {
        byNome.set(nk, { count: 1, raw, score: sc });
      }
      stats.set(key, byNome);
    };

    const keyOf = (cpfDigits: string, cents: number) => `${cpfDigits}|${cents}`;

    for (const v of recursoItems) add(keyOf(v.cpfDigits, v.cents), v.nome);
    for (const v of relItems) add(keyOf(v.cpfDigits, v.cents), v.nome);

    const out = new Map<string, string>();
    for (const [key, byNome] of stats.entries()) {
      let best: { count: number; raw: string; score: number } | null = null;
      for (const v of byNome.values()) {
        if (
          !best ||
          v.count > best.count ||
          (v.count === best.count && v.score > best.score) ||
          (v.count === best.count && v.score === best.score && v.raw.localeCompare(best.raw, 'pt-BR') < 0)
        ) {
          best = v;
        }
      }
      if (best) out.set(key, best.raw);
    }
    return out;
  })();

  const recurso = recursoItems
    .map((v) => ({
      cpf: v.cpf,
      nome: canonicalNomeByCpfAndCents.get(`${v.cpfDigits}|${v.cents}`) ?? v.nome,
      value: centsToPtBr(v.cents),
      status: v.pairId ? 'conciliado' : 'pendencia',
      pairId: v.pairId,
    }))
    .sort((a, b) => {
      if (a.pairId && b.pairId) return a.pairId.localeCompare(b.pairId);
      if (a.pairId) return -1;
      if (b.pairId) return 1;
      return a.cpf.localeCompare(b.cpf) || a.value.localeCompare(b.value);
    });

  const relatorio = relItems
    .map((v) => ({
      cpf: v.cpf,
      nome: canonicalNomeByCpfAndCents.get(`${v.cpfDigits}|${v.cents}`) ?? v.nome,
      value: centsToPtBr(v.cents),
      competencia: v.competencia,
      vencimento: v.vencimento,
      modalidade: v.modalidade,
      empresa: v.empresa,
      status: v.pairId ? 'conciliado' : 'pendencia',
      pairId: v.pairId,
      ocorrencia: (() => {
        const key = `${v.cpfDigits}|${v.cents}`;
        const occ = occByKey.get(key);
        return occ
          ? {
              id: occ.id,
              createdAt: occ.createdAt,
              action: occ.action,
              justification: occ.justification,
            }
          : null;
      })(),
    }))
    .sort((a, b) => {
      if (a.pairId && b.pairId) return a.pairId.localeCompare(b.pairId);
      if (a.pairId) return -1;
      if (b.pairId) return 1;
      return a.cpf.localeCompare(b.cpf) || a.value.localeCompare(b.value);
    });

  const message =
    recurso.length === 0 && relatorio.length === 0
      ? `Nenhum lançamento encontrado para o órgão "${orgaoInput}" na competência ${wantedMonthKey}.`
      : recurso.length === 0
        ? `Nenhum lançamento de recurso encontrado para o órgão "${orgaoInput}" na competência ${wantedMonthKey}.`
        : relatorio.length === 0
          ? `Nenhum lançamento do Relatório SISBR encontrado para o órgão "${orgaoInput}" na competência ${wantedMonthKey} (verifique o De/Para e Modalidade aceita).`
          : undefined;

  return {
    month: wantedMonthKey,
    orgao: orgaoInput,
    recursoTable,
    totals: {
      extratos: { cents: extratosTotal, text: centsToPtBr(extratosTotal) },
      recurso: { cents: recursoTotal, text: centsToPtBr(recursoTotal) },
      relatorio: { cents: relatorioTotal, text: centsToPtBr(relatorioTotal) },
      tarifaLinha: { cents: tarifaLinha.cents, text: centsToPtBr(tarifaLinha.cents) },
      tarifaTed: { cents: tarifaTed.cents, text: centsToPtBr(tarifaTed.cents) },
      diff: { cents: diff, text: centsToPtBr(diff) },
    },
    tarifaApplied: tarifaLinha.applied,
    tarifaTedApplied: tarifaTed.applied,
    recurso,
    relatorio,
    ...(message ? { message } : {}),
    dbFilePath,
  };
}

export async function clonarParaRelatorioSisbrFromExtratos(opts: {
  month: string;
  orgao: string;
  cpf: string;
  nome: string;
  value: string;
  recursoTable?: string;
  action?: string;
  justification: string;
}) {
  dotenv.config();
  const { year, month } = parseMonthInput(opts.month);
  const wantedMonthKey = `${year}-${String(month).padStart(2, '0')}`;
  const wantedCopetenciaFull = `${String(month).padStart(2, '0')}/${String(year)}`;
  const wantedCopetenciaShort = `${String(month).padStart(2, '0')}/${String(year % 100).padStart(2, '0')}`;
  const orgaoInput = opts.orgao.trim();
  if (!orgaoInput) throw new Error('Informe o órgão.');

  const cpfDigits = String(opts.cpf ?? '').replace(/\D/g, '');
  if (cpfDigits.length !== 11) throw new Error('CPF inválido.');
  const cpf = normalizeCpfValue(opts.cpf);

  const valueCents = parseMoneyToCents(opts.value);
  if (valueCents === null) throw new Error('Valor inválido.');

  const nome = String(opts.nome ?? '').trim();
  if (!nome) throw new Error('Informe o nome.');

  const requestedRecursoTable =
    typeof opts.recursoTable === 'string' ? opts.recursoTable.trim() : '';

  const action =
    typeof opts.action === 'string' && opts.action.trim()
      ? opts.action.trim()
      : 'clonar_para_relatorio_sisbr';
  const justification = String(opts.justification ?? '').trim();
  if (!justification) throw new Error('Informe a justificativa.');

  const due = (() => {
    let m = month + 1;
    let y = year;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    return `15/${String(m).padStart(2, '0')}/${String(y)}`;
  })();

  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  if (tableExists(db, 'conciliacao_pendencia_actions')) {
    const check = db.prepare(
      `SELECT id FROM conciliacao_pendencia_actions
       WHERE month=?
         AND TRIM(COALESCE(orgao,''))=?
         AND TRIM(COALESCE(cpf,''))=?
         AND TRIM(COALESCE(value,''))=?
         AND COALESCE(error,'')=''
         AND (COALESCE(undone_at,'')='' OR undone_at IS NULL)
         AND TRIM(COALESCE(action,'')) LIKE 'clonar_para_relatorio_sisbr%'
       ORDER BY id DESC
       LIMIT 1;`,
    );
    try {
      check.bind([wantedMonthKey, orgaoInput, cpf, centsToPtBr(valueCents)] as unknown as any[]);
      if (check.step()) {
        const row = check.getAsObject() as { id?: unknown };
        const id = Number(row.id);
        if (Number.isFinite(id)) {
          throw new Error(
            'Esta linha já possui ocorrência. Desfaça a ocorrência antes de criar outra.',
          );
        }
      }
    } finally {
      check.free();
    }
  }

  const recursoTable = resolveRecursoTableForOrgao(
    db,
    orgaoInput,
    requestedRecursoTable,
  );

  if (!tableExists(db, 'relatorio_consignado'))
    throw new Error('Tabela relatorio_consignado não encontrada.');
  if (!tableExists(db, recursoTable)) throw new Error(`Tabela não encontrada: ${recursoTable}`);

  const normalizeCpfDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

  const recursoCols = getTableColumns(db, recursoTable);
  const recursoCpfCol =
    recursoCols.find((c) => normalizeHeaderKey(c) === 'CPF') ?? null;
  const recursoNomeCol =
    recursoCols.find((c) => {
      const key = normalizeHeaderKey(c);
      return key === 'NOME' || key.startsWith('NOME ');
    }) ??
    pickFirstColumnContaining(recursoCols, ['nome']) ??
    null;
  const recursoValorCol =
    recursoCols.find((c) => {
      const key = normalizeHeaderKey(c).replace(/\s/g, '');
      return key === 'VALORPARCELA' || key === 'VALOR';
    }) ?? null;
  const recursoCompCol =
    recursoCols.find((c) =>
      ['COMPETENCIA', 'COPETENCIA'].includes(normalizeHeaderKey(c).replace(/\s/g, '')),
    ) ?? null;
  if (!recursoCpfCol || !recursoValorCol) {
    throw new Error(
      `Tabela ${recursoTable} não possui colunas obrigatórias (CPF e Valor Parcela).`,
    );
  }

  const recursoSelectCols = [
    recursoCpfCol,
    ...(recursoNomeCol ? [recursoNomeCol] : []),
    recursoValorCol,
    ...(recursoCompCol ? [recursoCompCol] : []),
  ];
  const recursoRows = readTableRows(db, recursoTable, recursoSelectCols);
  const matchedRecursoRows: Array<{ cpf: string; nome: string; cents: number }> = [];
  for (const r of recursoRows) {
    if (recursoCompCol) {
      const compRaw = String(r[recursoCompCol] ?? '').trim();
      if (compRaw) {
        const m = parseCopetenciaToMonthKey(compRaw);
        if (m && m !== wantedMonthKey) continue;
        if (!m && compRaw !== wantedCopetenciaFull && compRaw !== wantedCopetenciaShort) continue;
      }
    }
    const rowCpfDigits = normalizeCpfDigits(r[recursoCpfCol]);
    if (rowCpfDigits.length !== 11 || rowCpfDigits !== cpfDigits) continue;
    const cents = parseMoneyToCents(r[recursoValorCol]);
    if (cents === null || cents !== valueCents) continue;
    const rowNome =
      recursoNomeCol && typeof r[recursoNomeCol] === 'string'
        ? String(r[recursoNomeCol]).trim()
        : '';
    matchedRecursoRows.push({
      cpf: normalizeCpfValue(r[recursoCpfCol]),
      nome: rowNome || nome,
      cents,
    });
  }

  if (matchedRecursoRows.length === 0) {
    throw new Error(
      'Nenhum registro do Recurso do Órgão encontrado para esse CPF e valor na competência selecionada.',
    );
  }

  const resolveRelatorioEmpresaRaw = (): string => {
    const wantedKey = normalizeExtratosOrgaoForMatch(orgaoInput);
    if (!wantedKey) return orgaoInput;
    if (!tableExists(db, 'orgao_depara')) return orgaoInput;
    const rows = readTableRows(db, 'orgao_depara', ['extratos_value', 'relatorio_value']);
    for (const r of rows) {
      const ex = normalizeExtratosOrgaoForMatch((r as any).extratos_value);
      if (!ex || ex !== wantedKey) continue;
      const raw = typeof (r as any).relatorio_value === 'string' ? (r as any).relatorio_value : '';
      const cleaned = String(raw ?? '').trim();
      if (cleaned) return cleaned;
    }
    return orgaoInput;
  };
  const relEmpresa = resolveRelatorioEmpresaRaw();

  const fileColumns = [
    'EMPRESA',
    'Copetencia',
    'CPF',
    'Nome',
    'Valor Parcela',
    'Vencimento',
  ];

  db.run('BEGIN;');
  try {
    ensureRelatorioConsignadoTable(db, fileColumns);
    normalizeRelatorioCopetenciaToFullYear(db);
    const relCpfText = cpf;
    const relValorText = centsToPtBr(valueCents);
    const desiredEmpresaKey = normalizeRelatorioOrgaoForMatch(relEmpresa);
    const selectExisting = db.prepare(
      `SELECT rowid as __rowid, ${escapeSqlIdentifier('EMPRESA')} as EMPRESA, ${escapeSqlIdentifier('Copetencia')} as Copetencia
       FROM relatorio_consignado
       WHERE TRIM(COALESCE(${escapeSqlIdentifier('CPF')}, '')) = ?
         AND TRIM(COALESCE(${escapeSqlIdentifier('Valor Parcela')}, '')) = ?;`,
    );
    const existingEmpresas = new Map<string, { count: number; raw: string }>();
    try {
      selectExisting.bind([relCpfText, relValorText] as unknown as any[]);
      while (selectExisting.step()) {
        const row = selectExisting.getAsObject() as Record<string, unknown>;
        const cop = typeof row.Copetencia === 'string' ? row.Copetencia.trim() : '';
        const rowMonthKey = parseCopetenciaToMonthKey(cop);
        if (!rowMonthKey || rowMonthKey !== wantedMonthKey) continue;
        const emp = typeof row.EMPRESA === 'string' ? row.EMPRESA.trim() : '';
        const empKey = normalizeRelatorioOrgaoForMatch(emp) ?? '';
        if (!empKey) continue;
        const cur = existingEmpresas.get(empKey);
        if (cur) cur.count += 1;
        else existingEmpresas.set(empKey, { count: 1, raw: emp });
      }
    } finally {
      selectExisting.free();
    }

    if (desiredEmpresaKey && existingEmpresas.size > 0) {
      if (existingEmpresas.has(desiredEmpresaKey)) {
        throw new Error('Este CPF e valor já existem no Relatório SISBR para este órgão.');
      }
      const tops = Array.from(existingEmpresas.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map((v) => v.raw)
        .filter(Boolean);
      const hint = tops.length > 0 ? ` (Encontrado em: ${tops.join(' | ')})` : '';
      throw new Error(
        `Este CPF e valor já existem no Relatório SISBR em outro órgão. Use "Alterar Órgão no Relatório SISBR".${hint}`,
      );
    }

    const colsSql = fileColumns.map(escapeSqlIdentifier).join(', ');
    const placeholders = fileColumns.map(() => '?').join(', ');
    const insertStmt = db.prepare(
      `INSERT INTO relatorio_consignado (${colsSql}) VALUES (${placeholders});`,
    );
    const existsStmt = db.prepare(
      `SELECT COUNT(1) as c FROM relatorio_consignado
       WHERE TRIM(COALESCE(${escapeSqlIdentifier('CPF')}, '')) = ?
         AND TRIM(COALESCE(${escapeSqlIdentifier('Valor Parcela')}, '')) = ?
         AND TRIM(COALESCE(${escapeSqlIdentifier('Copetencia')}, '')) = ?
         AND TRIM(COALESCE(${escapeSqlIdentifier('EMPRESA')}, '')) = ?
         AND TRIM(COALESCE(${escapeSqlIdentifier('Vencimento')}, '')) = ?
       LIMIT 1;`,
    );
    const lastRowIdStmt = db.prepare(`SELECT last_insert_rowid() as id;`);
    let inserted = { insertedRows: 0, skippedRows: 0 };
    let metaJson: string | null = null;
    let previousValue: string | null = null;
    let nextValue: string | null = relEmpresa;
    const insertedRowIds: number[] = [];
    try {
      for (const row of matchedRecursoRows) {
        const cpfText = row.cpf || cpf;
        const valorText = centsToPtBr(row.cents);
        const nomeText = row.nome || nome;
        existsStmt.bind([cpfText, valorText, wantedCopetenciaFull, relEmpresa, due] as unknown as any[]);
        let exists = false;
        if (existsStmt.step()) {
          const obj = existsStmt.getAsObject() as { c?: unknown };
          const c = Number((obj as any).c);
          exists = Number.isFinite(c) && c > 0;
        }
        existsStmt.reset();
        if (exists) {
          inserted.skippedRows += 1;
          continue;
        }
        insertStmt.run([
          relEmpresa,
          wantedCopetenciaFull,
          cpfText,
          nomeText,
          valorText,
          due,
        ] as unknown as any[]);
        inserted.insertedRows += 1;
        if (lastRowIdStmt.step()) {
          const obj = lastRowIdStmt.getAsObject() as { id?: unknown };
          const id = Number((obj as any).id);
          if (Number.isFinite(id) && id > 0) insertedRowIds.push(id);
        }
        lastRowIdStmt.reset();
      }
    } finally {
      insertStmt.free();
      existsStmt.free();
      lastRowIdStmt.free();
    }

    if (inserted.insertedRows === 0) {
      throw new Error('Nenhuma linha foi inserida no Relatório SISBR (já existe ou não foi possível inserir).');
    }

    metaJson = JSON.stringify({
      kind: 'relatorio_stub_insert',
      rowIds: insertedRowIds,
      empresa: relEmpresa,
      copetencia: wantedCopetenciaFull,
    });
    normalizeRelatorioConsignadoFillDown(db);
    const logStmt = db.prepare(`
      INSERT INTO conciliacao_pendencia_actions
      (created_at, month, orgao, cpf, nome, value, action, justification, inserted_rows, skipped_rows, error, previous_value, next_value, meta_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);
    try {
      logStmt.run([
        new Date().toISOString(),
        wantedMonthKey,
        orgaoInput,
        cpf,
        nome,
        centsToPtBr(valueCents),
        action,
        justification,
        inserted.insertedRows,
        inserted.skippedRows,
        null,
        previousValue,
        nextValue,
        metaJson,
      ]);
    } finally {
      logStmt.free();
    }
    db.run('COMMIT;');
    persistDatabase(db, dbFilePath);
    return {
      insertedRows: inserted.insertedRows,
      skippedRows: inserted.skippedRows,
      dbFilePath,
    };
  } catch (e: unknown) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    try {
      db.run('BEGIN;');
      const logStmt = db.prepare(`
        INSERT INTO conciliacao_pendencia_actions
        (created_at, month, orgao, cpf, nome, value, action, justification, inserted_rows, skipped_rows, error, previous_value, next_value, meta_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `);
      try {
        logStmt.run([
          new Date().toISOString(),
          wantedMonthKey,
          orgaoInput,
          cpf,
          nome,
          centsToPtBr(valueCents),
          action,
          justification,
          0,
          0,
          e instanceof Error ? e.message : String(e ?? 'Erro desconhecido'),
          null,
          null,
          null,
        ]);
      } finally {
        logStmt.free();
      }
      db.run('COMMIT;');
      persistDatabase(db, dbFilePath);
    } catch {
      void 0;
    }
    throw e;
  }
}

export async function getOcorrenciaCloneParaSisbrContext(opts: {
  month: string;
  orgao: string;
  cpf: string;
  value: string;
}) {
  dotenv.config();
  const { year, month } = parseMonthInput(opts.month);
  const wantedMonthKey = `${year}-${String(month).padStart(2, '0')}`;
  const wantedCopetenciaFull = `${String(month).padStart(2, '0')}/${String(year)}`;
  const orgaoInput = opts.orgao.trim();
  if (!orgaoInput) throw new Error('Informe o órgão.');

  const cpfDigits = String(opts.cpf ?? '').replace(/\D/g, '');
  if (cpfDigits.length !== 11) throw new Error('CPF inválido.');
  const cpf = normalizeCpfValue(opts.cpf);

  const valueCents = parseMoneyToCents(opts.value);
  if (valueCents === null) throw new Error('Valor inválido.');
  const valorParcela = centsToPtBr(valueCents);

  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  if (!tableExists(db, 'relatorio_consignado'))
    throw new Error('Tabela relatorio_consignado não encontrada.');

  const resolveRelatorioEmpresaRaw = (): string => {
    const wantedKey = normalizeExtratosOrgaoForMatch(orgaoInput);
    if (!wantedKey) return orgaoInput;
    if (!tableExists(db, 'orgao_depara')) return orgaoInput;
    const rows = readTableRows(db, 'orgao_depara', ['extratos_value', 'relatorio_value']);
    for (const r of rows) {
      const ex = normalizeExtratosOrgaoForMatch((r as any).extratos_value);
      if (!ex || ex !== wantedKey) continue;
      const raw =
        typeof (r as any).relatorio_value === 'string' ? (r as any).relatorio_value : '';
      const cleaned = String(raw ?? '').trim();
      if (cleaned) return cleaned;
    }
    return orgaoInput;
  };
  const targetEmpresa = resolveRelatorioEmpresaRaw();
  const targetEmpresaKey = normalizeRelatorioOrgaoForMatch(targetEmpresa);

  const existingCols = new Set(getTableColumns(db, 'relatorio_consignado'));
  const hasEmpresa = existingCols.has('EMPRESA');
  const hasCop = existingCols.has('Copetencia');
  if (!hasEmpresa || !hasCop) {
    return {
      month: wantedMonthKey,
      cpf,
      value: valorParcela,
      targetEmpresa,
      sourceEmpresas: [],
      totalMatches: 0,
      willUpdateCount: 0,
      dbFilePath,
    };
  }

  const selectExisting = db.prepare(
    `SELECT ${escapeSqlIdentifier('EMPRESA')} as EMPRESA, ${escapeSqlIdentifier('Copetencia')} as Copetencia
     FROM relatorio_consignado
     WHERE TRIM(COALESCE(${escapeSqlIdentifier('CPF')}, '')) = ?
       AND TRIM(COALESCE(${escapeSqlIdentifier('Valor Parcela')}, '')) = ?;`,
  );
  const sourceEmpresasSet = new Set<string>();
  let totalMatches = 0;
  let willUpdateCount = 0;
  try {
    selectExisting.bind([cpf, valorParcela] as unknown as any[]);
    while (selectExisting.step()) {
      const row = selectExisting.getAsObject() as Record<string, unknown>;
      const cop = typeof row.Copetencia === 'string' ? row.Copetencia.trim() : '';
      const rowMonthKey = parseCopetenciaToMonthKey(cop);
      if (!rowMonthKey || rowMonthKey !== wantedMonthKey) continue;
      totalMatches += 1;
      const emp = typeof row.EMPRESA === 'string' ? row.EMPRESA.trim() : '';
      if (emp) sourceEmpresasSet.add(emp);
      const empKey = normalizeRelatorioOrgaoForMatch(emp);
      if (targetEmpresaKey && empKey && empKey !== targetEmpresaKey) {
        willUpdateCount += 1;
      }
    }
  } finally {
    selectExisting.free();
  }

  return {
    month: wantedMonthKey,
    cpf,
    value: valorParcela,
    targetEmpresa,
    sourceEmpresas: Array.from(sourceEmpresasSet).sort((a, b) => a.localeCompare(b)),
    totalMatches,
    willUpdateCount,
    wantedCopetenciaFull,
    dbFilePath,
  };
}

function resolveRelatorioEmpresaFromExtratosOrgao(db: Database, orgaoExtratosRaw: string): string {
  const wantedKey = normalizeExtratosOrgaoForMatch(orgaoExtratosRaw);
  if (!wantedKey) throw new Error('Órgão inválido.');
  if (!tableExists(db, 'orgao_depara')) throw new Error('De/Para não configurado.');
  const rows = readTableRows(db, 'orgao_depara', ['extratos_value', 'relatorio_value']);
  for (const r of rows) {
    const ex = normalizeExtratosOrgaoForMatch((r as any).extratos_value);
    if (!ex || ex !== wantedKey) continue;
    const raw =
      typeof (r as any).relatorio_value === 'string' ? (r as any).relatorio_value : '';
    const cleaned = String(raw ?? '').trim();
    if (cleaned) return cleaned;
  }
  throw new Error('Órgão não encontrado no De/Para.');
}

export async function alterarOrgaoRelatorioSisbr(opts: {
  month: string;
  cpf: string;
  nome: string;
  value: string;
  fromEmpresa: string;
  toOrgao: string;
  action?: string;
  justification: string;
}) {
  dotenv.config();
  const { year, month } = parseMonthInput(opts.month);
  const wantedMonthKey = `${year}-${String(month).padStart(2, '0')}`;
  const wantedCopetenciaFull = `${String(month).padStart(2, '0')}/${String(year)}`;

  const cpfDigits = String(opts.cpf ?? '').replace(/\D/g, '');
  if (cpfDigits.length !== 11) throw new Error('CPF inválido.');
  const cpf = normalizeCpfValue(opts.cpf);

  const valueCents = parseMoneyToCents(opts.value);
  if (valueCents === null) throw new Error('Valor inválido.');
  const valorParcela = centsToPtBr(valueCents);

  const nome = String(opts.nome ?? '').trim();
  if (!nome) throw new Error('Informe o nome.');

  const fromEmpresa = String(opts.fromEmpresa ?? '').trim();
  if (!fromEmpresa) throw new Error('Empresa atual não informada.');

  const toOrgao = String(opts.toOrgao ?? '').trim();
  if (!toOrgao) throw new Error('Informe o órgão de destino.');

  const action =
    typeof opts.action === 'string' && opts.action.trim()
      ? opts.action.trim()
      : 'alterar_orgao_relatorio_sisbr';
  const justification = String(opts.justification ?? '').trim();
  if (!justification) throw new Error('Informe a justificativa.');

  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  if (!tableExists(db, 'relatorio_consignado'))
    throw new Error('Tabela relatorio_consignado não encontrada.');

  const targetEmpresa = resolveRelatorioEmpresaFromExtratosOrgao(db, toOrgao);
  const targetEmpresaKey = normalizeRelatorioOrgaoForMatch(targetEmpresa);
  const fromEmpresaKey = normalizeRelatorioOrgaoForMatch(fromEmpresa);
  if (!targetEmpresaKey || !fromEmpresaKey) throw new Error('Empresa inválida.');

  const updatedRowIds: number[] = [];
  if (tableExists(db, 'conciliacao_pendencia_actions')) {
    const stmt = db.prepare(
      `SELECT id FROM conciliacao_pendencia_actions
       WHERE month=?
         AND TRIM(COALESCE(orgao,''))=?
         AND TRIM(COALESCE(cpf,''))=?
         AND TRIM(COALESCE(value,''))=?
         AND COALESCE(error,'')=''
         AND (COALESCE(undone_at,'')='' OR undone_at IS NULL)
         AND TRIM(COALESCE(action,'')) LIKE 'alterar_orgao_relatorio%'
       ORDER BY id DESC
       LIMIT 1;`,
    );
    try {
      stmt.bind([wantedMonthKey, toOrgao, cpf, valorParcela] as unknown as any[]);
      if (stmt.step()) {
        const row = stmt.getAsObject() as { id?: unknown };
        const id = Number(row.id);
        if (Number.isFinite(id)) {
          throw new Error('Esta linha já possui ocorrência. Desfaça a ocorrência antes de criar outra.');
        }
      }
    } finally {
      stmt.free();
    }
  }
  db.run('BEGIN;');
  try {
    normalizeRelatorioCopetenciaToFullYear(db);
    const select = db.prepare(
      `SELECT rowid as __rowid,
              ${escapeSqlIdentifier('EMPRESA')} as EMPRESA,
              ${escapeSqlIdentifier('Copetencia')} as Copetencia
       FROM relatorio_consignado
       WHERE TRIM(COALESCE(${escapeSqlIdentifier('CPF')}, '')) = ?
         AND TRIM(COALESCE(${escapeSqlIdentifier('Valor Parcela')}, '')) = ?;`,
    );
    try {
      select.bind([cpf, valorParcela] as unknown as any[]);
      while (select.step()) {
        const row = select.getAsObject() as Record<string, unknown>;
        const rowid = Number((row as any).__rowid);
        if (!Number.isFinite(rowid)) continue;
        const cop = typeof row.Copetencia === 'string' ? row.Copetencia.trim() : '';
        const rowMonthKey = parseCopetenciaToMonthKey(cop);
        if (!rowMonthKey || rowMonthKey !== wantedMonthKey) continue;
        const emp = typeof row.EMPRESA === 'string' ? row.EMPRESA.trim() : '';
        const empKey = normalizeRelatorioOrgaoForMatch(emp);
        if (empKey && empKey === targetEmpresaKey) continue;
        if (!empKey || empKey !== fromEmpresaKey) continue;
        updatedRowIds.push(rowid);
      }
    } finally {
      select.free();
    }

    if (updatedRowIds.length === 0) {
      const selectLoose = db.prepare(
        `SELECT rowid as __rowid,
                ${escapeSqlIdentifier('EMPRESA')} as EMPRESA,
                ${escapeSqlIdentifier('Copetencia')} as Copetencia
         FROM relatorio_consignado
         WHERE TRIM(COALESCE(${escapeSqlIdentifier('CPF')}, '')) = ?
           AND TRIM(COALESCE(${escapeSqlIdentifier('Valor Parcela')}, '')) = ?;`,
      );
      try {
        selectLoose.bind([cpf, valorParcela] as unknown as any[]);
        while (selectLoose.step()) {
          const row = selectLoose.getAsObject() as Record<string, unknown>;
          const rowid = Number((row as any).__rowid);
          if (!Number.isFinite(rowid)) continue;
          const cop = typeof row.Copetencia === 'string' ? row.Copetencia.trim() : '';
          const rowMonthKey = parseCopetenciaToMonthKey(cop);
          if (!rowMonthKey || rowMonthKey !== wantedMonthKey) continue;
          const emp = typeof row.EMPRESA === 'string' ? row.EMPRESA.trim() : '';
          const empKey = normalizeRelatorioOrgaoForMatch(emp);
          if (empKey && empKey === targetEmpresaKey) continue;
          updatedRowIds.push(rowid);
        }
      } finally {
        selectLoose.free();
      }
    }

    if (updatedRowIds.length === 0) {
      throw new Error('Nenhum registro do Relatório SISBR encontrado para alterar o órgão.');
    }

    const update = db.prepare(
      `UPDATE relatorio_consignado SET ${escapeSqlIdentifier('EMPRESA')}=? WHERE rowid=?;`,
    );
    try {
      for (const rowid of updatedRowIds) {
        update.run([targetEmpresa, rowid] as unknown as any[]);
      }
    } finally {
      update.free();
    }

    const logStmt = db.prepare(`
      INSERT INTO conciliacao_pendencia_actions
      (created_at, month, orgao, cpf, nome, value, action, justification, inserted_rows, skipped_rows, error, previous_value, next_value, meta_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);
    try {
      logStmt.run([
        new Date().toISOString(),
        wantedMonthKey,
        toOrgao,
        cpf,
        nome,
        valorParcela,
        action,
        justification,
        updatedRowIds.length,
        0,
        null,
        fromEmpresa,
        targetEmpresa,
        JSON.stringify({
          kind: 'relatorio_empresa',
          rowIds: updatedRowIds,
          previousEmpresa: fromEmpresa,
          nextEmpresa: targetEmpresa,
        }),
      ]);
    } finally {
      logStmt.free();
    }

    db.run('COMMIT;');
  } catch (e) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    try {
      db.run('BEGIN;');
      const logStmt = db.prepare(`
        INSERT INTO conciliacao_pendencia_actions
        (created_at, month, orgao, cpf, nome, value, action, justification, inserted_rows, skipped_rows, error, previous_value, next_value, meta_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `);
      try {
        logStmt.run([
          new Date().toISOString(),
          wantedMonthKey,
          toOrgao,
          cpf,
          nome,
          valorParcela,
          action,
          justification,
          0,
          0,
          e instanceof Error ? e.message : String(e ?? 'Erro desconhecido'),
          fromEmpresa,
          targetEmpresa,
          JSON.stringify({
            kind: 'relatorio_empresa',
            rowIds: updatedRowIds,
            previousEmpresa: fromEmpresa,
            nextEmpresa: targetEmpresa,
          }),
        ]);
      } finally {
        logStmt.free();
      }
      db.run('COMMIT;');
      persistDatabase(db, dbFilePath);
    } catch {
      void 0;
    }
    throw e;
  }

  persistDatabase(db, dbFilePath);
  return {
    month: wantedMonthKey,
    cpf,
    value: valorParcela,
    fromEmpresa,
    toEmpresa: targetEmpresa,
    updatedRows: updatedRowIds.length,
    dbFilePath,
  };
}

export async function desfazerOcorrenciaRelatorioSisbr(opts: {
  id: number;
  undoJustification?: string;
}) {
  dotenv.config();
  const id = Number(opts.id);
  if (!Number.isFinite(id) || id <= 0) throw new Error('Informe o ID da ocorrência.');

  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  if (!tableExists(db, 'conciliacao_pendencia_actions')) {
    throw new Error('Tabela conciliacao_pendencia_actions não encontrada.');
  }
  if (!tableExists(db, 'relatorio_consignado')) {
    throw new Error('Tabela relatorio_consignado não encontrada.');
  }

  const select = db.prepare(
    `SELECT id, created_at, month, orgao, cpf, nome, value, action, error, previous_value, next_value, meta_json, undone_at
     FROM conciliacao_pendencia_actions
     WHERE id = ?;`,
  );
  let row: Record<string, unknown> | null = null;
  try {
    select.bind([id] as unknown as any[]);
    if (select.step()) row = select.getAsObject() as Record<string, unknown>;
  } finally {
    select.free();
  }
  if (!row) throw new Error('Ocorrência não encontrada.');

  const action = typeof row.action === 'string' ? row.action.trim() : '';
  const isAlterarOrgao = Boolean(action) && action.startsWith('alterar_orgao_relatorio');
  const isClone = Boolean(action) && action.startsWith('clonar_para_relatorio_sisbr');
  if (!isAlterarOrgao && !isClone) {
    throw new Error('Esta ocorrência não pode ser desfeita.');
  }

  const error = typeof row.error === 'string' ? row.error.trim() : '';
  if (error) throw new Error('Não é possível desfazer uma ocorrência com erro.');

  const undoneAt = typeof row.undone_at === 'string' ? row.undone_at.trim() : '';
  if (undoneAt) throw new Error('Ocorrência já foi desfeita.');

  const monthKey = typeof row.month === 'string' ? row.month.trim() : '';
  const cpf = typeof row.cpf === 'string' ? row.cpf.trim() : '';
  const value = typeof row.value === 'string' ? row.value.trim() : '';
  if (!monthKey || !cpf || !value) throw new Error('Ocorrência inválida.');

  const previousEmpresa =
    typeof row.previous_value === 'string' ? row.previous_value.trim() : '';
  const nextEmpresa = typeof row.next_value === 'string' ? row.next_value.trim() : '';

  const metaRaw = typeof row.meta_json === 'string' ? row.meta_json.trim() : '';
  let rowIds: number[] = [];
  let metaKind = '';
  let metaRowsForUpdate: Array<{ rowId: number; previousEmpresa: string }> = [];
  let metaEmpresa = '';
  let metaCopetencia = '';
  if (metaRaw) {
    try {
      const parsed = JSON.parse(metaRaw) as {
        rowIds?: unknown;
        kind?: unknown;
        rows?: unknown;
        empresa?: unknown;
        copetencia?: unknown;
      };
      metaKind = typeof parsed?.kind === 'string' ? parsed.kind.trim() : '';
      metaEmpresa = typeof parsed?.empresa === 'string' ? parsed.empresa.trim() : '';
      metaCopetencia = typeof parsed?.copetencia === 'string' ? parsed.copetencia.trim() : '';
      const arr = Array.isArray(parsed?.rowIds) ? parsed.rowIds : [];
      rowIds = arr.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
      const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
      metaRowsForUpdate = rows
        .map((r) => {
          const rowId = Number((r as any)?.rowId);
          const previousEmpresa =
            typeof (r as any)?.previousEmpresa === 'string' ? String((r as any).previousEmpresa).trim() : '';
          return { rowId, previousEmpresa };
        })
        .filter((r) => Number.isFinite(r.rowId) && r.rowId > 0 && Boolean(r.previousEmpresa));
    } catch {
      rowIds = [];
    }
  }
  const kind =
    metaKind ||
    (isAlterarOrgao ? 'relatorio_empresa' : isClone ? 'relatorio_stub_insert' : '');
  if (isAlterarOrgao && kind !== 'relatorio_empresa') {
    throw new Error('Esta ocorrência não pode ser desfeita.');
  }

  if (isAlterarOrgao) {
    if (!previousEmpresa || !nextEmpresa) {
      throw new Error('Ocorrência não possui valor anterior para restaurar.');
    }
  }

  const orgaoInput = typeof row.orgao === 'string' ? row.orgao.trim() : '';
  const resolveEmpresaFromOrgao = (): string => {
    if (nextEmpresa) return nextEmpresa;
    if (metaEmpresa) return metaEmpresa;
    if (!orgaoInput) return '';
    const wantedKey = normalizeExtratosOrgaoForMatch(orgaoInput);
    if (!wantedKey) return orgaoInput;
    if (!tableExists(db, 'orgao_depara')) return orgaoInput;
    const rows = readTableRows(db, 'orgao_depara', ['extratos_value', 'relatorio_value']);
    for (const r of rows) {
      const ex = normalizeExtratosOrgaoForMatch((r as any).extratos_value);
      if (!ex || ex !== wantedKey) continue;
      const raw =
        typeof (r as any).relatorio_value === 'string' ? (r as any).relatorio_value : '';
      const cleaned = String(raw ?? '').trim();
      if (cleaned) return cleaned;
    }
    return orgaoInput;
  };

  const resolveRowIdsIfMissing = (): number[] => {
    const valueCents = parseMoneyToCents(value);
    if (valueCents === null) return [];
    const valorParcela = centsToPtBr(valueCents);
    const rows: number[] = [];
    normalizeRelatorioCopetenciaToFullYear(db);
    const stmt = db.prepare(
      `SELECT rowid as __rowid,
              ${escapeSqlIdentifier('EMPRESA')} as EMPRESA,
              ${escapeSqlIdentifier('Copetencia')} as Copetencia
       FROM relatorio_consignado
       WHERE TRIM(COALESCE(${escapeSqlIdentifier('CPF')}, '')) = ?
         AND TRIM(COALESCE(${escapeSqlIdentifier('Valor Parcela')}, '')) = ?;`,
    );
    try {
      stmt.bind([cpf, valorParcela] as unknown as any[]);
      while (stmt.step()) {
        const r = stmt.getAsObject() as Record<string, unknown>;
        const rowid = Number((r as any).__rowid);
        if (!Number.isFinite(rowid) || rowid <= 0) continue;
        const cop = typeof r.Copetencia === 'string' ? r.Copetencia.trim() : '';
        const rowMonthKey = parseCopetenciaToMonthKey(cop);
        if (!rowMonthKey || rowMonthKey !== monthKey) continue;
        const emp = typeof r.EMPRESA === 'string' ? r.EMPRESA.trim() : '';
        if (normalizeRelatorioOrgaoForMatch(emp) !== normalizeRelatorioOrgaoForMatch(nextEmpresa))
          continue;
        rows.push(rowid);
      }
    } finally {
      stmt.free();
    }
    return rows;
  };
  const resolveCloneStubRowIdsIfMissing = (): number[] => {
    const valueCents = parseMoneyToCents(value);
    if (valueCents === null) return [];
    const valorParcela = centsToPtBr(valueCents);
    const empresa = resolveEmpresaFromOrgao();
    if (!empresa) return [];
    const copetencia =
      metaCopetencia ||
      (() => {
        const parts = monthKey.split('-');
        if (parts.length !== 2) return '';
        return `${parts[1]}/${parts[0]}`;
      })();
    if (!copetencia) return [];

    const cols = new Set(getTableColumns(db, 'relatorio_consignado'));
    const conditions: string[] = [];
    if (cols.has('Operação')) {
      conditions.push(`TRIM(COALESCE(${escapeSqlIdentifier('Operação')}, '')) = ''`);
    }
    if (cols.has('Cliente')) {
      conditions.push(`TRIM(COALESCE(${escapeSqlIdentifier('Cliente')}, '')) = ''`);
    }
    if (cols.has('Modalidade')) {
      conditions.push(`TRIM(COALESCE(${escapeSqlIdentifier('Modalidade')}, '')) = ''`);
    }
    if (conditions.length === 0) return [];

    const limit =
      typeof (row as any).inserted_rows === 'number' && Number.isFinite((row as any).inserted_rows)
        ? Math.max(1, Number((row as any).inserted_rows))
        : 20;

    const rows: number[] = [];
    const stmt = db.prepare(
      `SELECT rowid as __rowid
       FROM relatorio_consignado
       WHERE TRIM(COALESCE(${escapeSqlIdentifier('CPF')}, '')) = ?
         AND TRIM(COALESCE(${escapeSqlIdentifier('Valor Parcela')}, '')) = ?
         AND TRIM(COALESCE(${escapeSqlIdentifier('Copetencia')}, '')) = ?
         AND TRIM(COALESCE(${escapeSqlIdentifier('EMPRESA')}, '')) = ?
         AND ${conditions.join(' AND ')}
       ORDER BY rowid DESC
       LIMIT ${limit};`,
    );
    try {
      stmt.bind([cpf, valorParcela, copetencia, empresa] as unknown as any[]);
      while (stmt.step()) {
        const r = stmt.getAsObject() as Record<string, unknown>;
        const rowid = Number((r as any).__rowid);
        if (Number.isFinite(rowid) && rowid > 0) rows.push(rowid);
      }
    } finally {
      stmt.free();
    }
    return rows;
  };

  const undoJustification = String(opts.undoJustification ?? '').trim();
  const now = new Date().toISOString();

  db.run('BEGIN;');
  try {
    if (isAlterarOrgao) {
      if (rowIds.length === 0) rowIds = resolveRowIdsIfMissing();
      if (rowIds.length === 0) {
        throw new Error('Não foi possível localizar os registros para desfazer a ocorrência.');
      }
      const update = db.prepare(
        `UPDATE relatorio_consignado SET ${escapeSqlIdentifier('EMPRESA')}=? WHERE rowid=?;`,
      );
      try {
        for (const rowid of rowIds) {
          update.run([previousEmpresa, rowid] as unknown as any[]);
        }
      } finally {
        update.free();
      }
    } else if (isClone) {
      if (kind === 'relatorio_empresa_update') {
        const pairs = metaRowsForUpdate.filter((r) => Boolean(r.previousEmpresa));
        if (pairs.length === 0) {
          throw new Error('Não foi possível localizar os registros para desfazer a ocorrência.');
        }
        const update = db.prepare(
          `UPDATE relatorio_consignado SET ${escapeSqlIdentifier('EMPRESA')}=? WHERE rowid=?;`,
        );
        try {
          for (const p of pairs) {
            update.run([p.previousEmpresa, p.rowId] as unknown as any[]);
          }
        } finally {
          update.free();
        }
        rowIds = pairs.map((p) => p.rowId);
      } else {
        if (rowIds.length === 0) rowIds = resolveCloneStubRowIdsIfMissing();
        if (rowIds.length === 0) {
          throw new Error('Não foi possível localizar os registros para desfazer a ocorrência.');
        }
        const del = db.prepare(`DELETE FROM relatorio_consignado WHERE rowid=?;`);
        try {
          for (const rowid of rowIds) {
            del.run([rowid] as unknown as any[]);
          }
        } finally {
          del.free();
        }
      }
    }

    const updOcc = db.prepare(
      `UPDATE conciliacao_pendencia_actions
       SET undone_at=?, undo_justification=?
       WHERE id=?;`,
    );
    try {
      updOcc.run([now, undoJustification || null, id] as unknown as any[]);
    } finally {
      updOcc.free();
    }

    db.run('COMMIT;');
  } catch (e) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  }

  persistDatabase(db, dbFilePath);
  return { id, undoneAt: now, restoredRows: rowIds.length, dbFilePath };
}

export async function saveModalidades(opts?: { modalidades?: string[] }) {
  dotenv.config();
  const modalidadesAceitasRaw = process.env.MODALIDADES_ACCEPTAS ?? '';
  const modalidades =
    opts?.modalidades ??
    modalidadesAceitasRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const dbFilePath = getSqlitePath();

  const db = await openDatabase(dbFilePath);
  ensureSchema(db);
  db.run('BEGIN;');
  try {
    replaceModalidades(db, modalidades);
    db.run('COMMIT;');
  } catch (e: unknown) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  }
  persistDatabase(db, dbFilePath);
  return { modalidades: normalizeModalidades(modalidades), dbFilePath };
}

export async function getModalidades() {
  dotenv.config();
  const modalidadesAceitasRaw = process.env.MODALIDADES_ACCEPTAS ?? '';
  const envModalidades = normalizeModalidades(
    modalidadesAceitasRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  if (!tableExists(db, 'modalidade_consignados')) {
    return { modalidades: envModalidades, dbFilePath };
  }

  const rows = readTableRows(db, 'modalidade_consignados', ['codigo']);
  const fromDb = normalizeModalidades(
    rows
      .map((r) => (typeof (r as any).codigo === 'string' ? (r as any).codigo : ''))
      .filter(Boolean),
  );

  return { modalidades: fromDb.length > 0 ? fromDb : envModalidades, dbFilePath };
}

const CONFIG_KEY_SHAREPOINT_FOLDER_URL = 'sharePointFolderUrl';
const CONFIG_KEY_RECURSO_ALEGO_URL = 'recursoAlegoUrl';
const CONFIG_KEY_RECURSO_MPGO_URL = 'recursoMpgoUrl';

export async function getConsignadoAutomationConfig() {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const sharePointFolderUrl = getConsignadoAppConfigValue(
    db,
    CONFIG_KEY_SHAREPOINT_FOLDER_URL,
  );
  const recursoAlegoUrl = getConsignadoAppConfigValue(
    db,
    CONFIG_KEY_RECURSO_ALEGO_URL,
  );
  const recursoMpgoUrl = getConsignadoAppConfigValue(
    db,
    CONFIG_KEY_RECURSO_MPGO_URL,
  );
  return { sharePointFolderUrl, recursoAlegoUrl, recursoMpgoUrl, dbFilePath };
}

export async function saveConsignadoAutomationConfig(opts: {
  sharePointFolderUrl?: string | null;
  recursoAlegoUrl?: string | null;
  recursoMpgoUrl?: string | null;
}) {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  db.run('BEGIN;');
  try {
    setConsignadoAppConfigValue(
      db,
      CONFIG_KEY_SHAREPOINT_FOLDER_URL,
      opts.sharePointFolderUrl ?? null,
    );
    setConsignadoAppConfigValue(
      db,
      CONFIG_KEY_RECURSO_ALEGO_URL,
      opts.recursoAlegoUrl ?? null,
    );
    setConsignadoAppConfigValue(
      db,
      CONFIG_KEY_RECURSO_MPGO_URL,
      opts.recursoMpgoUrl ?? null,
    );
    db.run('COMMIT;');
  } catch (e: unknown) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  }
  persistDatabase(db, dbFilePath);
  return await getConsignadoAutomationConfig();
}

export async function getOrgaoColumnsConfig() {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const config = getOrgaoColumnsConfigFromDb(db);
  const tables = {
    extratos: tableExists(db, 'extratos'),
    relatorio: tableExists(db, 'relatorio_consignado'),
  };
  const columns = {
    extratos: tables.extratos ? getTableColumns(db, 'extratos') : [],
    relatorio: tables.relatorio ? getTableColumns(db, 'relatorio_consignado') : [],
  };
  const resolvedOrgaoColumns = {
    extratos:
      (config.extratos && columns.extratos.includes(config.extratos)
        ? config.extratos
        : null) ??
      (columns.extratos.includes('HISTÓRICO_1')
        ? 'HISTÓRICO_1'
        : columns.extratos.includes('HISTORICO_1')
          ? 'HISTORICO_1'
          : columns.extratos.includes('HISTÓRICO')
            ? 'HISTÓRICO'
            : columns.extratos.includes('HISTORICO')
              ? 'HISTORICO'
              : columns.extratos.includes('ÓRGÃO')
                ? 'ÓRGÃO'
                : columns.extratos.includes('ORGAO')
                  ? 'ORGAO'
                  : columns.extratos.includes('Órgão')
                    ? 'Órgão'
                    : columns.extratos.includes('Orgao')
                      ? 'Orgao'
                      : null),
    relatorio:
      (config.relatorio && columns.relatorio.includes(config.relatorio)
        ? config.relatorio
        : null) ??
      (columns.relatorio.includes('EMPRESA')
        ? 'EMPRESA'
        : columns.relatorio.includes('Empresa')
          ? 'Empresa'
          : null),
  };
  const values = {
    extratos: resolvedOrgaoColumns.extratos
      ? listDistinctColumnValues({
          db,
          table: 'extratos',
          column: resolvedOrgaoColumns.extratos,
          limit: 400,
          valueTransform: (v) => v.replace(/^\d+\s+/, ''),
        })
      : [],
    relatorio: resolvedOrgaoColumns.relatorio
      ? listDistinctColumnValues({
          db,
          table: 'relatorio_consignado',
          column: resolvedOrgaoColumns.relatorio,
          limit: 400,
        })
      : [],
  };

  return { config, tables, columns, resolvedOrgaoColumns, values, dbFilePath };
}

export async function saveOrgaoColumnsConfig(opts: {
  extratos?: string | null;
  relatorio?: string | null;
}) {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);
  db.run('BEGIN;');
  try {
    saveOrgaoColumnsConfigToDb(db, opts);
    db.run('COMMIT;');
  } catch (e: unknown) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  }
  persistDatabase(db, dbFilePath);
  return await getOrgaoColumnsConfig();
}

export async function importExtratosTemporario(opts: {
  filePath: string;
  tableName?: string;
}) {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const tableName = (opts.tableName ?? 'extratos_temporario').trim();
  if (!tableName) throw new Error('Informe o nome da tabela.');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
    throw new Error('Nome de tabela inválido. Use apenas letras, números e _.');
  }

  const resolvedPath = path.isAbsolute(opts.filePath)
    ? opts.filePath
    : path.resolve(process.cwd(), opts.filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Arquivo não encontrado: ${resolvedPath}`);
  }

  const buffer = fs.readFileSync(resolvedPath);
  const { rows, fileColumns } = await (async () => {
    const name = path.basename(resolvedPath);
    const looksLikePdf =
      buffer.indexOf(Buffer.from('%PDF')) !== -1 &&
      buffer.indexOf(Buffer.from('%PDF')) < 1024;
    if (isPdfFile(name) || looksLikePdf) {
      const pdfTable = await readExtratoPdfTable(name, buffer);
      return { rows: pdfTable.rows, fileColumns: pdfTable.headers };
    }
    const table = readSheetTable(buffer);
    return { rows: table.rows, fileColumns: table.headers };
  })();
  if (fileColumns.length === 0) {
    throw new Error('Não foi possível identificar as colunas do arquivo.');
  }

  const refCol =
    fileColumns.find((c) => c.trim().toUpperCase() === 'REF_ANOMES') ?? null;
  const computeCompetencia = (refAnoMes: unknown): string => {
    const digits = toStableValue(refAnoMes).replace(/\D/g, '');
    if (digits.length !== 6) return '';
    const year = Number(digits.slice(0, 4));
    const month = Number(digits.slice(4, 6));
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12)
      return '';
    const yy = String(year % 100).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return `${mm}/${yy}`;
  };
  const effectiveColumns = (() => {
    if (!refCol) return fileColumns;
    if (fileColumns.includes('Competencia')) return fileColumns;
    const idx = fileColumns.indexOf(refCol);
    if (idx < 0) return fileColumns;
    return fileColumns.slice(0, idx).concat('Competencia', fileColumns.slice(idx));
  })();

  db.run('BEGIN;');
  try {
    ensureTableWithColumns(db, tableName, effectiveColumns);
    const colsSql = effectiveColumns.map(escapeSqlIdentifier).join(', ');
    const placeholders = effectiveColumns.map(() => '?').join(', ');
    const stmt = db.prepare(
      `INSERT INTO ${escapeSqlIdentifier(tableName)} (${colsSql}) VALUES (${placeholders});`,
    );
    try {
      for (const row of rows) {
        const values = effectiveColumns.map((col) => {
          if (col === 'Competencia' && refCol) return computeCompetencia(row[refCol]);
          return col in row ? toStableValue(row[col]) : '';
        });
        stmt.run(values as unknown as any[]);
      }
    } finally {
      stmt.free();
    }
    db.run('COMMIT;');
  } catch (e: unknown) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  }

  persistDatabase(db, dbFilePath);
  return {
    tableName,
    filePath: resolvedPath,
    columns: effectiveColumns.length,
    rows: rows.length,
    dbFilePath,
  };
}

export async function importExtratosTemporarioFromBuffer(opts: {
  fileName: string;
  file: Buffer;
  tableName?: string;
}) {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const tableName = (opts.tableName ?? 'extratos_temporario').trim();
  if (!tableName) throw new Error('Informe o nome da tabela.');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
    throw new Error('Nome de tabela inválido. Use apenas letras, números e _.');
  }

  const { rows, fileColumns } = await (async () => {
    const looksLikePdf =
      opts.file.indexOf(Buffer.from('%PDF')) !== -1 &&
      opts.file.indexOf(Buffer.from('%PDF')) < 1024;
    if (isPdfFile(opts.fileName) || looksLikePdf) {
      const pdfTable = await readExtratoPdfTable(opts.fileName, opts.file);
      return { rows: pdfTable.rows, fileColumns: pdfTable.headers };
    }
    const table = readSheetTable(opts.file);
    return { rows: table.rows, fileColumns: table.headers };
  })();
  if (fileColumns.length === 0) {
    throw new Error('Não foi possível identificar as colunas do arquivo.');
  }

  const refCol =
    fileColumns.find((c) => c.trim().toUpperCase() === 'REF_ANOMES') ?? null;
  const computeCompetencia = (refAnoMes: unknown): string => {
    const digits = toStableValue(refAnoMes).replace(/\D/g, '');
    if (digits.length !== 6) return '';
    const year = Number(digits.slice(0, 4));
    const month = Number(digits.slice(4, 6));
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12)
      return '';
    const yy = String(year % 100).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return `${mm}/${yy}`;
  };
  const effectiveColumns = (() => {
    if (!refCol) return fileColumns;
    if (fileColumns.includes('Competencia')) return fileColumns;
    const idx = fileColumns.indexOf(refCol);
    if (idx < 0) return fileColumns;
    return fileColumns.slice(0, idx).concat('Competencia', fileColumns.slice(idx));
  })();

  db.run('BEGIN;');
  try {
    ensureTableWithColumns(db, tableName, effectiveColumns);
    const colsSql = effectiveColumns.map(escapeSqlIdentifier).join(', ');
    const placeholders = effectiveColumns.map(() => '?').join(', ');
    const stmt = db.prepare(
      `INSERT INTO ${escapeSqlIdentifier(tableName)} (${colsSql}) VALUES (${placeholders});`,
    );
    try {
      for (const row of rows) {
        const values = effectiveColumns.map((col) => {
          if (col === 'Competencia' && refCol) return computeCompetencia(row[refCol]);
          return col in row ? toStableValue(row[col]) : '';
        });
        stmt.run(values as unknown as any[]);
      }
    } finally {
      stmt.free();
    }
    db.run('COMMIT;');
  } catch (e: unknown) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  }

  persistDatabase(db, dbFilePath);
  return {
    tableName,
    fileName: opts.fileName,
    columns: effectiveColumns.length,
    rows: rows.length,
    dbFilePath,
  };
}

export async function conciliarTemporario(opts?: {
  competencia?: string | null;
  orgao?: string | null;
  status?: string | null;
  extratosTable?: string;
  relatoriosTable?: string;
}) {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const extratosTable = (opts?.extratosTable ?? 'extratos_temporario').trim();
  const relatoriosTable = (opts?.relatoriosTable ?? 'relatorios_temporario').trim();
  const competenciaInput = String(opts?.competencia ?? '').trim();
  const orgaoInput = String(opts?.orgao ?? '').trim();
  const statusInput = String(opts?.status ?? '').trim();

  const parseCompetencia = (raw: string): string => {
    const t = raw.trim();
    if (!t) return '';
    const yyyymm = /^\d{6}$/.test(t) ? t : t.replace(/\D/g, '');
    if (yyyymm.length === 6) {
      const year = Number(yyyymm.slice(0, 4));
      const month = Number(yyyymm.slice(4, 6));
      if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12)
        return '';
      return `${String(month).padStart(2, '0')}/${String(year % 100).padStart(2, '0')}`;
    }
    const m = /^(\d{2})\/(\d{2})$/.exec(t);
    if (m) return `${m[1]}/${m[2]}`;
    const m2 = /^(\d{2})\/(\d{4})$/.exec(t);
    if (m2) return `${m2[1]}/${String(Number(m2[2]) % 100).padStart(2, '0')}`;
    return '';
  };

  const competencia = parseCompetencia(competenciaInput);

  const parseCpf = (v: unknown) => String(v ?? '').replace(/\D/g, '');
  const moneyToCents = (v: unknown): bigint | null => {
    const raw = String(v ?? '').trim();
    if (!raw) return null;
    const s = raw.includes(',')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw;
    const m = /^-?\d+(?:\.\d+)?$/.exec(s);
    if (!m) return null;
    const neg = s.startsWith('-');
    const s2 = neg ? s.slice(1) : s;
    const [intPart, fracPart = ''] = s2.split('.');
    const frac2 = (fracPart + '00').slice(0, 2);
    const cents = BigInt(intPart || '0') * 100n + BigInt(frac2 || '0');
    return neg ? -cents : cents;
  };

  const tableExistsLocal = (t: string) =>
    tableExists(db, t);
  if (!tableExistsLocal(extratosTable)) {
    throw new Error(`Tabela não encontrada: ${extratosTable}`);
  }
  if (!tableExistsLocal(relatoriosTable)) {
    throw new Error(`Tabela não encontrada: ${relatoriosTable}`);
  }

  const extratoCols = getTableColumns(db, extratosTable);
  const relCols = getTableColumns(db, relatoriosTable);

  const pickCol = (cols: string[], candidates: string[]) => {
    const map = new Map(cols.map((c) => [c.trim().toUpperCase(), c]));
    for (const cand of candidates) {
      const hit = map.get(cand.trim().toUpperCase());
      if (hit) return hit;
    }
    return '';
  };

  const exCpfCol = pickCol(extratoCols, ['NMR_CPF', 'CPF']);
  const exValorCol = pickCol(extratoCols, ['VALOR']);
  const exNomeCol = pickCol(extratoCols, ['NOME']);
  const exOrgaoCol = pickCol(extratoCols, ['CDG_ORGAO', 'ORGAO', 'ÓRGÃO']);
  const exCompCol = pickCol(extratoCols, ['COMPETENCIA', 'Competencia', 'COMPETÊNCIA']);

  const relCpfCol = pickCol(relCols, ['CPF']);
  const relNomeCol = pickCol(relCols, ['NOME', 'Nome']);
  const relValorParcelaCol = pickCol(relCols, ['VALOR PARCELA', 'Valor Parcela']);
  const relCompCol = pickCol(relCols, ['COPETENCIA', 'Copetencia', 'COMPETENCIA', 'Competencia']);
  const relOrgaoCol = pickCol(relCols, ['EMPRESA', 'ORGÃO', 'ORGAO']);

  if (!exCpfCol || !exValorCol) {
    throw new Error('Não foi possível identificar CPF/VALOR em extratos_temporario.');
  }
  if (!relCpfCol || !relValorParcelaCol) {
    throw new Error('Não foi possível identificar CPF/Valor Parcela em relatorios_temporario.');
  }

  const exWhere: string[] = [];
  const exParams: any[] = [];
  if (competencia && exCompCol) {
    exWhere.push(`${escapeSqlIdentifier(exCompCol)} = ?`);
    exParams.push(competencia);
  }
  const orgaoDigits = orgaoInput.replace(/\D/g, '');
  const orgaoLooksLikeCode =
    Boolean(orgaoInput) && Boolean(orgaoDigits) && orgaoDigits === orgaoInput;

  const relWhere: string[] = [];
  const relParams: any[] = [];
  if (competencia && relCompCol) {
    relWhere.push(`${escapeSqlIdentifier(relCompCol)} = ?`);
    relParams.push(competencia);
  }
  if (orgaoInput && relOrgaoCol) {
    if (orgaoLooksLikeCode) {
      relWhere.push(`${escapeSqlIdentifier(relOrgaoCol)} LIKE ?`);
      relParams.push(`${orgaoDigits}%`);
    } else {
      relWhere.push(`${escapeSqlIdentifier(relOrgaoCol)} LIKE ?`);
      relParams.push(`%${orgaoInput}%`);
    }
  }

  const extratoSelectCols = [
    `${escapeSqlIdentifier(exCpfCol)} as cpf`,
    `${escapeSqlIdentifier(exValorCol)} as valor`,
    exNomeCol ? `${escapeSqlIdentifier(exNomeCol)} as nome` : `'' as nome`,
    exOrgaoCol ? `${escapeSqlIdentifier(exOrgaoCol)} as orgao` : `'' as orgao`,
  ].join(', ');
  const relSelectCols = [
    `${escapeSqlIdentifier(relCpfCol)} as cpf`,
    `${escapeSqlIdentifier(relValorParcelaCol)} as valorParcela`,
    relNomeCol ? `${escapeSqlIdentifier(relNomeCol)} as nome` : `'' as nome`,
    relOrgaoCol ? `${escapeSqlIdentifier(relOrgaoCol)} as orgao` : `'' as orgao`,
  ].join(', ');

  const exSql =
    `SELECT ${extratoSelectCols} FROM ${escapeSqlIdentifier(extratosTable)}` +
    (exWhere.length ? ` WHERE ${exWhere.join(' AND ')}` : '') +
    ';';
  const relSql =
    `SELECT ${relSelectCols} FROM ${escapeSqlIdentifier(relatoriosTable)}` +
    (relWhere.length ? ` WHERE ${relWhere.join(' AND ')}` : '') +
    ';';

  const extratosByCpf = new Map<string, Array<{ valorCents: bigint; valorRaw: string; nome: string }>>();
  {
    const stmt = db.prepare(exSql);
    try {
      stmt.bind(exParams as unknown as any[]);
      while (stmt.step()) {
        const r = stmt.getAsObject() as any;
        const cpf = parseCpf(r.cpf);
        if (!cpf) continue;
        const cents = moneyToCents(r.valor);
        if (cents === null) continue;
        const arr = extratosByCpf.get(cpf) ?? [];
        arr.push({ valorCents: cents, valorRaw: String(r.valor ?? ''), nome: String(r.nome ?? '') });
        extratosByCpf.set(cpf, arr);
      }
    } finally {
      stmt.free();
    }
  }

  const rows: Array<{
    Nome: string;
    CPF: string;
    Orgao: string;
    ValorRelatorio: string;
    ValorExtrato: string;
    StatusKey: string;
    Status: string;
  }> = [];
  let conciliados = 0;
  let naoConciliados = 0;

  {
    const stmt = db.prepare(relSql);
    try {
      stmt.bind(relParams as unknown as any[]);
      while (stmt.step()) {
        const r = stmt.getAsObject() as any;
        const cpf = parseCpf(r.cpf);
        if (!cpf) continue;
        const relCents = moneyToCents(r.valorParcela);
        if (relCents === null) continue;
        const ex = extratosByCpf.get(cpf) ?? [];
        const match = ex.find((e) => e.valorCents === relCents) ?? null;
        const statusKey = match ? 'conciliado' : 'nao_conciliado';
        const status = match ? 'conciliado' : 'não conciliado';
        rows.push({
          Nome: String(r.nome ?? '') || (match?.nome ?? ''),
          CPF: String(r.cpf ?? ''),
          Orgao: String(r.orgao ?? ''),
          ValorRelatorio: String(r.valorParcela ?? ''),
          ValorExtrato: match ? match.valorRaw : (ex[0]?.valorRaw ?? ''),
          StatusKey: statusKey,
          Status: status,
        });
      }
    } finally {
      stmt.free();
    }
  }

  const normalizeStatusKey = (v: string) =>
    v
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');

  const statusFilterKey = normalizeStatusKey(statusInput);
  const filteredRows =
    statusFilterKey === '' || statusFilterKey === 'todos'
      ? rows
      : rows.filter((r) => normalizeStatusKey(r.StatusKey) === statusFilterKey);

  conciliados = filteredRows.reduce(
    (acc, r) => acc + (r.StatusKey === 'conciliado' ? 1 : 0),
    0,
  );
  naoConciliados = filteredRows.reduce(
    (acc, r) => acc + (r.StatusKey === 'nao_conciliado' ? 1 : 0),
    0,
  );

  return {
    competencia,
    orgao: orgaoInput,
    status: statusFilterKey,
    extratosTable,
    relatoriosTable,
    total: filteredRows.length,
    conciliados,
    naoConciliados,
    rows: filteredRows,
    dbFilePath,
  };
}

export async function listarFiltrosTemporario(opts?: {
  extratosTable?: string;
  relatoriosTable?: string;
}) {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const extratosTable = (opts?.extratosTable ?? 'extratos_temporario').trim();
  const relatoriosTable = (opts?.relatoriosTable ?? 'relatorios_temporario').trim();

  const competencias = new Map<string, number>();
  const add = (value: string, count: number) => {
    const v = value.trim();
    if (!v) return;
    const key = v.replace(/\s+/g, ' ');
    competencias.set(key, (competencias.get(key) ?? 0) + (count || 1));
  };

  const exCompetencias = listDistinctColumnValues({
    db,
    table: extratosTable,
    column: 'Competencia',
    limit: 200,
  });
  for (const e of exCompetencias) add(e.value, e.count);

  const relCompetencias = listDistinctColumnValues({
    db,
    table: relatoriosTable,
    column: 'Copetencia',
    limit: 200,
  });
  for (const e of relCompetencias) add(e.value, e.count);

  const orgaos = listDistinctColumnValues({
    db,
    table: relatoriosTable,
    column: 'EMPRESA',
    limit: 400,
  });

  const competenciasList = Array.from(competencias.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value]) => value);

  return {
    competencias: competenciasList,
    orgaos: orgaos.map((o) => o.value),
    dbFilePath,
    extratosTable,
    relatoriosTable,
  };
}

export async function exportConcilicacaoTemporarioXlsx(opts?: {
  competencia?: string | null;
  orgao?: string | null;
  status?: string | null;
  extratosTable?: string;
  relatoriosTable?: string;
}) {
  const result = await conciliarTemporario(opts);

  const sanitizeText = (v: unknown) =>
    String(v ?? '')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const parseMoneyNumber = (v: unknown): number | null => {
    const raw = String(v ?? '').trim();
    if (!raw) return null;
    const s = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const rows = result.rows.map((r) => ({
    Nome: sanitizeText(r.Nome),
    CPF: sanitizeText(r.CPF),
    Orgao: sanitizeText(r.Orgao),
    ValorRelatorio: parseMoneyNumber(r.ValorRelatorio),
    ValorExtrato: parseMoneyNumber(r.ValorExtrato),
    Status: sanitizeText(r.Status),
  }));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Conciliacao');

  sheet.columns = [
    { header: 'Nome', key: 'Nome', width: 44 },
    { header: 'CPF', key: 'CPF', width: 18 },
    { header: 'Órgão', key: 'Orgao', width: 44 },
    { header: 'ValorRelatorio', key: 'ValorRelatorio', width: 16 },
    { header: 'ValorExtrato', key: 'ValorExtrato', width: 16 },
    { header: 'Status', key: 'Status', width: 16 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: 'A1', to: 'F1' };

  for (const r of rows) {
    const row = sheet.addRow({
      Nome: r.Nome,
      CPF: r.CPF,
      Orgao: r.Orgao,
      ValorRelatorio: r.ValorRelatorio,
      ValorExtrato: r.ValorExtrato,
      Status: r.Status,
    });

    const cpfCell = row.getCell(2);
    cpfCell.value = r.CPF;
    cpfCell.numFmt = '@';

    const vr = row.getCell(4);
    const ve = row.getCell(5);
    vr.numFmt = '#,##0.00';
    ve.numFmt = '#,##0.00';

    const statusCell = row.getCell(6);
    const statusLower = String(r.Status || '').toLowerCase();
    const ok = statusLower === 'conciliado';
    statusCell.font = {
      bold: true,
      color: { argb: ok ? 'FF16A34A' : 'FFDC2626' },
    };
  }

  sheet.addTable({
    name: 'Conciliacao',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: [
      { name: 'Nome' },
      { name: 'CPF' },
      { name: 'Órgão' },
      { name: 'ValorRelatorio' },
      { name: 'ValorExtrato' },
      { name: 'Status' },
    ],
    rows: rows.map((r) => [
      r.Nome,
      r.CPF,
      r.Orgao,
      r.ValorRelatorio ?? null,
      r.ValorExtrato ?? null,
      r.Status,
    ]),
  });

  const buf = Buffer.from(await workbook.xlsx.writeBuffer());

  const safePart = (s: string) =>
    sanitizeText(s)
      .replace(/[^\w.-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);

  const competenciaPart = safePart(result.competencia || 'todos');
  const orgaoPart = safePart(result.orgao || 'todos');
  const statusPart =
    result.status && result.status !== 'todos' ? safePart(result.status) : '';
  const fileName = `conciliacao_${competenciaPart}_${orgaoPart}${statusPart ? `_${statusPart}` : ''}.xlsx`;

  return {
    fileName,
    buffer: buf,
    meta: {
      competencia: result.competencia,
      orgao: result.orgao,
      total: result.total,
      conciliados: result.conciliados,
      naoConciliados: result.naoConciliados,
    },
  };
}

export async function importRelatoriosTemporario(opts: {
  filePath: string;
  tableName?: string;
}) {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const tableName = (opts.tableName ?? 'relatorios_temporario').trim();
  if (!tableName) throw new Error('Informe o nome da tabela.');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
    throw new Error('Nome de tabela inválido. Use apenas letras, números e _.');
  }

  const resolvedPath = path.isAbsolute(opts.filePath)
    ? opts.filePath
    : path.resolve(process.cwd(), opts.filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Arquivo não encontrado: ${resolvedPath}`);
  }
  const fileName = path.basename(resolvedPath);
  if (!isPdfFile(fileName)) {
    throw new Error('Relatório deve ser importado a partir de PDF.');
  }

  const buffer = fs.readFileSync(resolvedPath);
  return await importRelatoriosTemporarioFromBuffer({
    fileName,
    file: buffer,
    tableName,
  });
}

export async function importRelatoriosTemporarioFromBuffer(opts: {
  fileName: string;
  file: Buffer;
  tableName?: string;
}) {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const tableName = (opts.tableName ?? 'relatorios_temporario').trim();
  if (!tableName) throw new Error('Informe o nome da tabela.');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
    throw new Error('Nome de tabela inválido. Use apenas letras, números e _.');
  }

  const table = await readRelatorioPdfTable(opts.fileName, opts.file);
  const rows = table.rows;
  const fileColumns = table.headers;
  if (fileColumns.length === 0) {
    throw new Error('Não foi possível identificar as colunas do relatório.');
  }

  db.run('BEGIN;');
  try {
    ensureTableWithColumns(db, tableName, fileColumns);
    const colsSql = fileColumns.map(escapeSqlIdentifier).join(', ');
    const placeholders = fileColumns.map(() => '?').join(', ');
    const stmt = db.prepare(
      `INSERT INTO ${escapeSqlIdentifier(tableName)} (${colsSql}) VALUES (${placeholders});`,
    );
    try {
      for (const row of rows) {
        const values = fileColumns.map((col) =>
          col in row ? toStableValue(row[col]) : '',
        );
        stmt.run(values as unknown as any[]);
      }
    } finally {
      stmt.free();
    }
    db.run('COMMIT;');
  } catch (e: unknown) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  }

  persistDatabase(db, dbFilePath);
  return {
    tableName,
    fileName: opts.fileName,
    columns: fileColumns.length,
    rows: rows.length,
    dbFilePath,
  };
}

export async function getOrgaoDePara() {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const rows = readTableRows(db, 'orgao_depara', [
    'extratos_value',
    'relatorio_value',
    'created_at',
  ]);

  const items = rows
    .map((r) => ({
      extratos: typeof r.extratos_value === 'string' ? r.extratos_value : '',
      relatorio: typeof r.relatorio_value === 'string' ? r.relatorio_value : '',
      createdAt: typeof r.created_at === 'string' ? r.created_at : '',
    }))
    .filter((i) => Boolean(i.extratos) && Boolean(i.relatorio))
    .sort((a, b) => a.extratos.localeCompare(b.extratos));

  return { items, dbFilePath };
}

export async function upsertOrgaoDePara(opts: {
  extratos: string;
  relatorio: string;
}) {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const extratos = opts.extratos.trim();
  const relatorio = opts.relatorio.trim();
  if (!extratos) throw new Error('Informe o órgão dos extratos.');
  if (!relatorio) throw new Error('Informe o órgão do relatório.');

  const createdAt = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO orgao_depara (extratos_value, relatorio_value, created_at) VALUES (?, ?, ?);`,
  );
  db.run('BEGIN;');
  try {
    stmt.run([extratos, relatorio, createdAt]);
    db.run('COMMIT;');
  } catch (e: unknown) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  } finally {
    stmt.free();
  }

  persistDatabase(db, dbFilePath);
  return await getOrgaoDePara();
}

export async function deleteOrgaoDePara(opts: { extratos: string }) {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const extratos = opts.extratos.trim();
  if (!extratos) throw new Error('Informe o órgão dos extratos.');

  const stmt = db.prepare(`DELETE FROM orgao_depara WHERE extratos_value=?;`);
  db.run('BEGIN;');
  try {
    stmt.run([extratos]);
    db.run('COMMIT;');
  } catch (e: unknown) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  } finally {
    stmt.free();
  }

  persistDatabase(db, dbFilePath);
  return await getOrgaoDePara();
}

export async function getExtratosConsolidacaoRecurso() {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  if (!tableExists(db, 'extratos_consolidacao_recurso')) {
    return { items: [] as Array<{ orgao: string; historico1: string; createdAt: string }>, dbFilePath };
  }

  const rows = readTableRows(db, 'extratos_consolidacao_recurso', [
    'orgao_extratos_raw',
    'historico1_raw',
    'created_at',
  ]);

  const items = rows
    .map((r) => ({
      orgao: typeof (r as any).orgao_extratos_raw === 'string' ? String((r as any).orgao_extratos_raw).trim() : '',
      historico1: typeof (r as any).historico1_raw === 'string' ? String((r as any).historico1_raw).trim() : '',
      createdAt: typeof (r as any).created_at === 'string' ? String((r as any).created_at).trim() : '',
    }))
    .filter((i) => Boolean(i.orgao) && Boolean(i.historico1))
    .sort((a, b) => a.orgao.localeCompare(b.orgao) || a.historico1.localeCompare(b.historico1));

  return { items, dbFilePath };
}

export async function upsertExtratosConsolidacaoRecurso(opts: { orgao: string; historico1: string }) {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const orgao = String(opts.orgao ?? '').trim();
  const historico1 = String(opts.historico1 ?? '').trim();
  if (!orgao) throw new Error('Informe o órgão.');
  if (!historico1) throw new Error('Informe o HISTÓRICO_1.');

  const orgaoKey = normalizeExtratosOrgaoForMatch(orgao);
  const historicoKey = normalizeExtratosHistoricoForMatch(historico1);
  if (!orgaoKey) throw new Error('Órgão inválido.');
  if (!historicoKey) throw new Error('HISTÓRICO_1 inválido.');

  const createdAt = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO extratos_consolidacao_recurso
     (orgao_extratos_key, orgao_extratos_raw, historico1_key, historico1_raw, created_at)
     VALUES (?, ?, ?, ?, ?);`,
  );
  db.run('BEGIN;');
  try {
    stmt.run([orgaoKey, orgao, historicoKey, historico1, createdAt] as unknown as any[]);
    db.run('COMMIT;');
  } catch (e: unknown) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  } finally {
    stmt.free();
  }

  persistDatabase(db, dbFilePath);
  return await getExtratosConsolidacaoRecurso();
}

export async function deleteExtratosConsolidacaoRecurso(opts: { orgao: string; historico1: string }) {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const orgao = String(opts.orgao ?? '').trim();
  const historico1 = String(opts.historico1 ?? '').trim();
  if (!orgao) throw new Error('Informe o órgão.');
  if (!historico1) throw new Error('Informe o HISTÓRICO_1.');

  const orgaoKey = normalizeExtratosOrgaoForMatch(orgao);
  const historicoKey = normalizeExtratosHistoricoForMatch(historico1);
  if (!orgaoKey) throw new Error('Órgão inválido.');
  if (!historicoKey) throw new Error('HISTÓRICO_1 inválido.');

  const stmt = db.prepare(
    `DELETE FROM extratos_consolidacao_recurso WHERE orgao_extratos_key=? AND historico1_key=?;`,
  );
  db.run('BEGIN;');
  try {
    stmt.run([orgaoKey, historicoKey] as unknown as any[]);
    db.run('COMMIT;');
  } catch (e: unknown) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  } finally {
    stmt.free();
  }

  persistDatabase(db, dbFilePath);
  return await getExtratosConsolidacaoRecurso();
}

export async function getExtratosHistorico1Values() {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  if (!tableExists(db, 'extratos')) {
    return { values: [] as Array<{ value: string; count: number }>, dbFilePath };
  }

  const cols = getTableColumns(db, 'extratos');
  const historicoCol =
    pickFirstExistingColumn(cols, ['HISTÓRICO_1', 'HISTORICO_1']) ??
    pickFirstExistingColumn(cols, ['HISTÓRICO', 'HISTORICO']);
  if (!historicoCol) {
    return { values: [] as Array<{ value: string; count: number }>, dbFilePath };
  }

  const values = listDistinctColumnValues({
    db,
    table: 'extratos',
    column: historicoCol,
    limit: 600,
  });

  return { values, dbFilePath };
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeEmails(emails: string[]): string[] {
  return emails
    .map(normalizeEmail)
    .filter(Boolean)
    .filter((e, i, arr) => arr.indexOf(e) === i);
}

const FIXED_ACCESS_EMAIL = 'mario.junior@sicoobjuriscred.com.br';

type ConsignadoAccessRole = 'admin' | 'usuario';

function normalizeAccessRole(value: unknown): ConsignadoAccessRole {
  if (typeof value !== 'string') return 'usuario';
  return value.trim().toLowerCase() === 'admin' ? 'admin' : 'usuario';
}

export async function getConsignadoAccessEmails() {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const rows = readTableRows(db, 'consignado_access_emails', ['email', 'role']);
  const fromDb = rows
    .map((r) => ({
      email: typeof r.email === 'string' ? normalizeEmail(r.email) : '',
      role: normalizeAccessRole((r as any).role),
    }))
    .filter((r) => Boolean(r.email))
    .filter((r, i, arr) => arr.findIndex((x) => x.email === r.email) === i);

  const fixed = FIXED_ACCESS_EMAIL;
  const fixedEntry = { email: fixed, role: 'admin' as const };
  const hasFixed = fromDb.some((e) => e.email === fixed);
  const entries = hasFixed
    ? fromDb.map((e) => (e.email === fixed ? fixedEntry : e))
    : [fixedEntry, ...fromDb];

  if (rows.length === 0 || !hasFixed) {
    const createdAt = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO consignado_access_emails (email, role, created_at) VALUES (?, ?, ?);`,
    );
    try {
      for (const e of entries) stmt.run([e.email, e.role, createdAt]);
    } finally {
      stmt.free();
    }
    persistDatabase(db, dbFilePath);
  }

  return {
    entries,
    emails: entries.map((e) => e.email),
    fixedEmail: FIXED_ACCESS_EMAIL,
    dbFilePath,
  };
}

export async function setConsignadoAccessEmails(opts: {
  entries?: Array<{ email: string; role?: ConsignadoAccessRole }>;
  emails?: string[];
}) {
  dotenv.config();
  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const incomingEntries = Array.isArray(opts.entries)
    ? opts.entries
    : (opts.emails ?? []).map((email) => ({ email, role: 'usuario' as const }));

  const normalized = incomingEntries
    .map((e) => ({
      email: normalizeEmail(e.email),
      role: normalizeAccessRole(e.role),
    }))
    .filter((e) => Boolean(e.email))
    .filter((e, i, arr) => arr.findIndex((x) => x.email === e.email) === i);

  const fixedEntry = { email: FIXED_ACCESS_EMAIL, role: 'admin' as const };
  const entries = normalized.some((e) => e.email === FIXED_ACCESS_EMAIL)
    ? normalized.map((e) => (e.email === FIXED_ACCESS_EMAIL ? fixedEntry : e))
    : [fixedEntry, ...normalized];

  db.run('BEGIN;');
  try {
    db.run('DELETE FROM consignado_access_emails;');
    const createdAt = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO consignado_access_emails (email, role, created_at) VALUES (?, ?, ?);`,
    );
    try {
      for (const e of entries) stmt.run([e.email, e.role, createdAt]);
    } finally {
      stmt.free();
    }
    db.run('COMMIT;');
  } catch (e) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  }

  persistDatabase(db, dbFilePath);
  return {
    entries,
    emails: entries.map((e) => e.email),
    fixedEmail: FIXED_ACCESS_EMAIL,
    dbFilePath,
  };
}

async function ensureChildFolder(opts: {
  token: string;
  driveId: string;
  parentId: string;
  folderName: string;
}): Promise<string> {
  const children = await listDriveItemChildren(
    opts.token,
    opts.driveId,
    opts.parentId,
  );
  const found = children.find(
    (c) => c.folder && c.name.trim() === opts.folderName,
  );
  if (found?.id) return found.id;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
      opts.driveId,
    )}/items/${encodeURIComponent(opts.parentId)}/children`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${opts.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: opts.folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      text || `Falha ao criar pasta Importados (HTTP ${res.status})`,
    );
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error('Falha ao criar pasta Importados');
  return data.id;
}

async function moveDriveItem(opts: {
  token: string;
  driveId: string;
  itemId: string;
  newParentId: string;
}) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
      opts.driveId,
    )}/items/${encodeURIComponent(opts.itemId)}`,
    {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${opts.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        parentReference: { id: opts.newParentId },
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Falha ao mover arquivo (HTTP ${res.status})`);
  }
}

function parseGraphErrorText(text: string): {
  code: string | null;
  innerCode: string | null;
  message: string | null;
} {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return { code: null, innerCode: null, message: null };
  try {
    const parsed = JSON.parse(trimmed) as {
      error?: {
        code?: unknown;
        message?: unknown;
        innerError?: { code?: unknown };
      };
    };
    const code = typeof parsed?.error?.code === 'string' ? parsed.error.code : null;
    const innerCode =
      typeof parsed?.error?.innerError?.code === 'string'
        ? parsed.error.innerError.code
        : null;
    const message =
      typeof parsed?.error?.message === 'string' ? parsed.error.message : null;
    return { code, innerCode, message };
  } catch {
    return { code: null, innerCode: null, message: null };
  }
}

function isGraphResourceLocked(text: string): boolean {
  const t = String(text ?? '');
  if (!t) return false;
  const parsed = parseGraphErrorText(t);
  const code = (parsed.code ?? '').toLowerCase();
  const inner = (parsed.innerCode ?? '').toLowerCase();
  return (
    code === 'notallowed' ||
    code === 'resourcelocked' ||
    inner === 'resourcelocked' ||
    /resourceLocked/i.test(t)
  );
}

async function sleepMs(ms: number) {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getDriveItemParentId(opts: {
  token: string;
  driveId: string;
  itemId: string;
}): Promise<string | null> {
  const data = await graphGet<{ parentReference?: { id?: string } }>(
    opts.token,
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
      opts.driveId,
    )}/items/${encodeURIComponent(opts.itemId)}?$select=parentReference`,
  );
  const id = data.parentReference?.id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

async function moveDriveItemWithRetry(opts: {
  token: string;
  driveId: string;
  itemId: string;
  newParentId: string;
  attempts?: number;
}) {
  const attempts = Math.max(1, Math.min(5, opts.attempts ?? 3));
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      await moveDriveItem({
        token: opts.token,
        driveId: opts.driveId,
        itemId: opts.itemId,
        newParentId: opts.newParentId,
      });
      return;
    } catch (e: unknown) {
      lastErr = e;
      const message = e instanceof Error ? e.message : String(e);
      if (!isGraphResourceLocked(message)) throw e;
      if (i < attempts - 1) {
        const wait = i === 0 ? 800 : i === 1 ? 2000 : 4000;
        await sleepMs(wait);
        continue;
      }
      throw lastErr instanceof Error
        ? lastErr
        : new Error(message || 'Falha ao mover arquivo.');
    }
  }
}

async function sendGraphMail(opts: {
  token: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
      opts.from,
    )}/sendMail`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${opts.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: opts.subject,
          body: { contentType: 'HTML', content: opts.html },
          toRecipients: [{ emailAddress: { address: opts.to } }],
        },
        saveToSentItems: false,
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Falha ao enviar e-mail (HTTP ${res.status})`);
  }
}

export async function runImportConsignado(opts?: {
  folderUrl?: string;
  notificationTo?: string;
  modalidades?: string[];
  mode?: 'append' | 'replace';
  target?: 'both' | 'extratos' | 'relatorio';
}) {
  dotenv.config();

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const sharePointFolderUrlCandidate =
    opts?.folderUrl ?? process.env.SHAREPOINT_FOLDER_URL ?? process.argv[2];

  if (!tenantId) throw new Error('AZURE_TENANT_ID não configurado');
  if (!clientId) throw new Error('AZURE_CLIENT_ID não configurado');
  if (!clientSecret) throw new Error('AZURE_CLIENT_SECRET não configurado');

  const extratosFolderName =
    process.env.SHAREPOINT_EXTRATOS_SUBFOLDER ?? 'extrato';
  const relatorioFolderName =
    process.env.SHAREPOINT_RELATORIO_SUBFOLDER ?? 'Relatório';
  const importedFolderName =
    process.env.SHAREPOINT_IMPORTED_FOLDER ?? 'Importados';
  const notificationTo =
    opts?.notificationTo ?? process.env.NOTIFICATION_EMAIL_TO ?? '';
  const notificationFrom = process.env.NOTIFICATION_EMAIL_FROM ?? '';
  const modalidadesAceitasRaw = process.env.MODALIDADES_ACCEPTAS ?? '';
  const mode: 'append' | 'replace' =
    opts?.mode ??
    (process.env.IMPORT_MODE?.trim().toLowerCase() === 'replace' ? 'replace' : 'append');
  const targetEnv =
    process.env.IMPORT_TARGET === 'extratos' ||
    process.env.IMPORT_TARGET === 'relatorio' ||
    process.env.IMPORT_TARGET === 'both'
      ? process.env.IMPORT_TARGET
      : undefined;
  const target = opts?.target ?? targetEnv ?? 'both';

  const dbFilePath = getSqlitePath();

  const db = await openDatabase(dbFilePath);
  ensureSchema(db);
  const sharePointFolderUrl =
    (typeof sharePointFolderUrlCandidate === 'string'
      ? sharePointFolderUrlCandidate.trim()
      : '') ||
    getConsignadoAppConfigValue(db, CONFIG_KEY_SHAREPOINT_FOLDER_URL) ||
    '';
  if (!sharePointFolderUrl) {
    throw new Error('Pasta do SharePoint não configurada.');
  }
  const modalidadesAceitas =
    opts?.modalidades ??
    modalidadesAceitasRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  if (opts?.modalidades) {
    db.run('BEGIN;');
    try {
      replaceModalidades(db, modalidadesAceitas);
      db.run('COMMIT;');
    } catch (e: unknown) {
      try {
        db.run('ROLLBACK;');
      } catch {
        void 0;
      }
      throw e;
    }
  }
  persistDatabase(db, dbFilePath);

  if (mode === 'replace') {
    db.run('BEGIN;');
    try {
      const hasHashes = tableExists(db, 'imported_row_hashes');
      if (target !== 'relatorio' && tableExists(db, 'extratos')) {
        db.run('DELETE FROM extratos;');
        if (hasHashes) clearImportedHashes(db, 'extratos');
      }
      if (target !== 'extratos' && tableExists(db, 'relatorio_consignado')) {
        db.run('DELETE FROM relatorio_consignado;');
        if (hasHashes) clearImportedHashes(db, 'relatorio_consignado');
      }
      db.run('COMMIT;');
    } catch (e: unknown) {
      try {
        db.run('ROLLBACK;');
      } catch {
        void 0;
      }
      throw e;
    }
    persistDatabase(db, dbFilePath);
  }

  const token = await getGraphToken({ tenantId, clientId, clientSecret });
  const normalizedFolderUrl = normalizeUrl(sharePointFolderUrl);
  const baseFolder = await resolveDriveItemFromShareUrl(
    token,
    normalizedFolderUrl,
  );

  const extratoCandidates = Array.from(
    new Set([
      ...folderNameVariants(extratosFolderName),
      ...folderNameVariants('Extrato Recurso'),
      ...folderNameVariants('Extratos Recurso'),
    ]),
  );
  const relatorioCandidates = Array.from(
    new Set([
      ...folderNameVariants(relatorioFolderName),
      ...folderNameVariants('Relatorio SISBR'),
      ...folderNameVariants('Relatório SISBR'),
    ]),
  );

  const importingSingleFile = Boolean(baseFolder.specificFile) && target !== 'both';

  const baseChildren = importingSingleFile
    ? []
    : await listDriveItemChildren(token, baseFolder.driveId, baseFolder.itemId);

  const container = importingSingleFile
    ? {
        containerName: baseFolder.itemName || 'base',
        extratoFolderId: target === 'extratos' ? baseFolder.itemId : null,
        relatorioFolderId: target === 'relatorio' ? baseFolder.itemId : null,
      }
    : await resolveContainerForTarget({
        token,
        driveId: baseFolder.driveId,
        baseItemId: baseFolder.itemId,
        baseItemName: baseFolder.itemName,
        baseChildren,
        extratoCandidates,
        relatorioCandidates,
        target,
      });

  const extratosAllBase =
    target === 'relatorio'
      ? []
      : baseFolder.specificFile
        ? [
            {
              id: baseFolder.specificFile.id,
              name: baseFolder.specificFile.name,
              lastModifiedDateTime: '',
            },
          ]
        : await listSpreadsheetFilesRecursive({
            token,
            driveId: baseFolder.driveId,
            rootFolderId: container.extratoFolderId as string,
            excludeFolderNames: [importedFolderName],
          });
  const extratosAllOutsideImportados = extratosAllBase.sort((a, b) =>
    b.lastModifiedDateTime.localeCompare(a.lastModifiedDateTime),
  );
  const extratosAllIncludingImportados =
    target === 'relatorio'
      ? []
      : (
          await listSpreadsheetFilesRecursive({
            token,
            driveId: baseFolder.driveId,
            rootFolderId: container.extratoFolderId as string,
          })
        ).sort((a, b) =>
          b.lastModifiedDateTime.localeCompare(a.lastModifiedDateTime),
        );

  let extratosAll = extratosAllOutsideImportados;
  let extratosFallbackImportados = false;
  if (
    !baseFolder.specificFile &&
    target !== 'relatorio' &&
    extratosAllOutsideImportados.length === 0 &&
    extratosAllIncludingImportados.length > 0
  ) {
    extratosAll = extratosAllIncludingImportados;
    extratosFallbackImportados = true;
  }

  const relatoriosAllBaseRaw =
    target === 'extratos'
      ? []
      : baseFolder.specificFile
        ? isPdfFile(baseFolder.specificFile.name)
          ? [
              {
                id: baseFolder.specificFile.id,
                name: baseFolder.specificFile.name,
                lastModifiedDateTime: '',
              },
            ]
          : []
        : await listSpreadsheetFilesRecursive({
            token,
            driveId: baseFolder.driveId,
            rootFolderId: container.relatorioFolderId as string,
            excludeFolderNames: [importedFolderName],
            fileFilter: (name) => isPdfFile(name),
          });
  const relatoriosAllBase = (
    baseFolder.specificFile
      ? relatoriosAllBaseRaw.filter((f) => f.id === baseFolder.specificFile!.id)
      : relatoriosAllBaseRaw
  ).sort((a, b) => b.lastModifiedDateTime.localeCompare(a.lastModifiedDateTime));

  const relatoriosAllIncludingImportadosRaw =
    target === 'extratos'
      ? []
      : await listSpreadsheetFilesRecursive({
          token,
          driveId: baseFolder.driveId,
          rootFolderId: container.relatorioFolderId as string,
          fileFilter: (name) => isPdfFile(name),
        });
  const relatoriosAllIncludingImportados = (
    baseFolder.specificFile
      ? relatoriosAllIncludingImportadosRaw.filter(
          (f) => f.id === baseFolder.specificFile!.id,
        )
      : relatoriosAllIncludingImportadosRaw
  ).sort((a, b) => b.lastModifiedDateTime.localeCompare(a.lastModifiedDateTime));

  let relatoriosAll = relatoriosAllBase;
  let relatoriosFallbackImportados = false;
  if (
    !baseFolder.specificFile &&
    target !== 'extratos' &&
    relatoriosAllBase.length === 0 &&
    relatoriosAllIncludingImportados.length > 0
  ) {
    relatoriosAll = relatoriosAllIncludingImportados;
    relatoriosFallbackImportados = true;
  }

  const extratos =
    target === 'relatorio'
      ? []
      : extratosAll;
  const relatorios =
    target === 'extratos'
      ? []
      : relatoriosAll;

  const extratosFoundOutsideImportados = extratosAllBase.map((f) => ({
    name: f.name,
    lastModifiedDateTime: f.lastModifiedDateTime,
  }));
  const relatoriosFoundOutsideImportados = relatoriosAllBase.map((f) => ({
    name: f.name,
    lastModifiedDateTime: f.lastModifiedDateTime,
  }));
  const extratosFoundIncludingImportados = extratosAllIncludingImportados.map((f) => ({
    name: f.name,
    lastModifiedDateTime: f.lastModifiedDateTime,
  }));
  const relatoriosFoundIncludingImportados = relatoriosAllIncludingImportados.map((f) => ({
    name: f.name,
    lastModifiedDateTime: f.lastModifiedDateTime,
  }));
  const extratosSelected = extratos.map((f) => ({
    name: f.name,
    lastModifiedDateTime: f.lastModifiedDateTime,
  }));
  const relatoriosSelected = relatorios.map((f) => ({
    name: f.name,
    lastModifiedDateTime: f.lastModifiedDateTime,
  }));

  const messageParts: string[] = [];
  if (target !== 'relatorio' && extratosAllOutsideImportados.length === 0) {
    const inImported = extratosAllIncludingImportados.length;
    if (extratosFallbackImportados && inImported > 0) {
      messageParts.push(
        `Extratos: usando ${inImported} arquivo(s) de "${importedFolderName}" (reimportação).`,
      );
    } else {
      messageParts.push(
        `Extratos: nenhum arquivo encontrado fora de "${importedFolderName}".`,
      );
    }
  }
  if (target !== 'extratos' && relatoriosAllBase.length === 0) {
    const inImported = relatoriosAllIncludingImportados.length;
    if (relatoriosFallbackImportados && inImported > 0) {
      messageParts.push(
        `Relatórios: usando ${inImported} PDF(s) de "${importedFolderName}" (reimportação).`,
      );
    } else if (inImported > 0) {
      messageParts.push(
        `Relatórios: nenhum PDF encontrado fora de "${importedFolderName}". Há ${inImported} PDF(s) dentro de "${importedFolderName}" (não serão importados).`,
      );
    } else {
      messageParts.push(
        baseFolder.specificFile?.name
          ? `Relatórios: arquivo não encontrado na pasta configurada: ${baseFolder.specificFile.name}`
          : 'Relatórios: nenhum PDF encontrado na pasta configurada.',
      );
    }
  }
  const importMessage = messageParts.length > 0 ? messageParts.join(' ') : undefined;

  const alreadyInImportados =
    Boolean(baseFolder.specificFile) &&
    baseFolder.itemName.trim().toLowerCase() === importedFolderName.trim().toLowerCase();
  const skipMoveForSpecificFile = Boolean(baseFolder.specificFile);
  const skipMoveExtratos =
    alreadyInImportados || extratosFallbackImportados || skipMoveForSpecificFile;
  const skipMoveRelatorios =
    alreadyInImportados || relatoriosFallbackImportados || skipMoveForSpecificFile;

  const importedFolderId =
    target === 'relatorio'
      ? null
      : skipMoveExtratos
        ? (container.extratoFolderId as string)
        : await ensureChildFolder({
            token,
            driveId: baseFolder.driveId,
            parentId: container.extratoFolderId as string,
            folderName: importedFolderName,
          });

  let importedExtratosCount = 0;
  let movedExtratosCount = 0;
  let importedRelatoriosCount = 0;
  let movedRelatoriosCount = 0;
  let insertedExtratosRows = 0;
  let skippedExtratosRows = 0;
  let insertedRelatoriosRows = 0;
  let skippedRelatoriosRows = 0;
  const extratosFiles: Array<{
    name: string;
    rowsTotal: number;
    insertedRows: number;
    skippedRows: number;
  }> = [];
  const relatoriosFiles: Array<{
    name: string;
    rowsTotal: number;
    insertedRows: number;
    skippedRows: number;
    ignoredReason?: string;
    error?: string;
    debug?: {
      fileBytes?: number;
      extracted?: {
        pages: number;
        textChars: number;
        tables: number;
        tableRows: number;
      };
    };
  }> = [];

  try {
    for (let idx = 0; idx < extratos.length; idx += 1) {
      const file = extratos[idx];
      const buffer = await graphDownload(
        token,
        `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
          baseFolder.driveId,
        )}/items/${encodeURIComponent(file.id)}/content`,
      );
      const table = await readRelatorioTable(file.name, buffer);
      const rows = table.rows;
      const fileColumns = table.headers;

      db.run('BEGIN;');
      try {
        if (fileColumns.length > 0) {
          ensureExtratosTable(db, fileColumns);
        }
        if (fileColumns.length > 0 && rows.length > 0) {
          const inserted = insertExtratosRows({
            db,
            sourceFile: file.name,
            fileColumns,
            rows,
          });
          insertedExtratosRows += inserted.insertedRows;
          skippedExtratosRows += inserted.skippedRows;
          extratosFiles.push({
            name: file.name,
            rowsTotal: rows.length,
            insertedRows: inserted.insertedRows,
            skippedRows: inserted.skippedRows,
          });
        } else {
          extratosFiles.push({
            name: file.name,
            rowsTotal: rows.length,
            insertedRows: 0,
            skippedRows: 0,
          });
        }
        computeExtratosCopetenciaFromData(db);

        if (!skipMoveExtratos) {
          await moveDriveItemWithRetry({
            token,
            driveId: baseFolder.driveId,
            itemId: file.id,
            newParentId: importedFolderId as string,
            attempts: 3,
          });
        }

        db.run('COMMIT;');
      } catch (e: unknown) {
        try {
          db.run('ROLLBACK;');
        } catch {
          void 0;
        }
        throw e;
      }

      importedExtratosCount += 1;
      if (!skipMoveExtratos) movedExtratosCount += 1;
      persistDatabase(db, dbFilePath);
      process.stdout.write(`Extratos: ${file.name} (${rows.length} linhas)\n`);
    }

    const importedRelatorioFolderId =
      target === 'extratos'
        ? null
        : skipMoveRelatorios
          ? (container.relatorioFolderId as string)
          : await ensureChildFolder({
              token,
              driveId: baseFolder.driveId,
              parentId: container.relatorioFolderId as string,
              folderName: importedFolderName,
            });

    for (let idx = 0; idx < relatorios.length; idx += 1) {
      const file = relatorios[idx];
      let buffer: Buffer | null = null;
      try {
        buffer = await graphDownload(
          token,
          `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
            baseFolder.driveId,
          )}/items/${encodeURIComponent(file.id)}/content`,
        );
        const table = await readRelatorioPdfTable(file.name, buffer);
        const rows = table.rows;
        const fileColumns = table.headers;

        if (rows.length === 0) {
          relatoriosFiles.push({
            name: file.name,
            rowsTotal: 0,
            insertedRows: 0,
            skippedRows: 0,
            ignoredReason:
              'PDF sem registros (provável arquivo de totais/resumo).',
          });
          process.stdout.write(
            `Relatório: ${file.name} ignorado (sem registros)\n`,
          );
          continue;
        }

        db.run('BEGIN;');
        try {
          if (fileColumns.length > 0) {
            ensureRelatorioConsignadoTable(db, fileColumns);
          }
          if (fileColumns.length > 0 && rows.length > 0) {
            const inserted = insertRelatorioConsignadoRows({
              db,
              fileColumns,
              rows,
            });
            insertedRelatoriosRows += inserted.insertedRows;
            skippedRelatoriosRows += inserted.skippedRows;
            relatoriosFiles.push({
              name: file.name,
              rowsTotal: rows.length,
              insertedRows: inserted.insertedRows,
              skippedRows: inserted.skippedRows,
            });
          }
          normalizeRelatorioConsignadoFillDown(db);

          if (process.env.RELATORIO_PDF_DEBUG === '1') {
            const keys = new Set<string>();
            for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
            process.stdout.write(
              `Relatório PDF debug: chaves_encontradas=${Array.from(keys).sort().join(' | ')}\n`,
            );
          }

          if (!skipMoveRelatorios) {
            await moveDriveItemWithRetry({
              token,
              driveId: baseFolder.driveId,
              itemId: file.id,
              newParentId: importedRelatorioFolderId as string,
              attempts: 3,
            });
          }

          db.run('COMMIT;');
        } catch (e: unknown) {
          try {
            db.run('ROLLBACK;');
          } catch {
            void 0;
          }
          throw e;
        }

        importedRelatoriosCount += 1;
        if (!skipMoveRelatorios) movedRelatoriosCount += 1;
        persistDatabase(db, dbFilePath);
        process.stdout.write(`Relatório: ${file.name} (${rows.length} linhas)\n`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        let debug: { fileBytes?: number; extracted?: { pages: number; textChars: number; tables: number; tableRows: number } } | undefined;
        if (buffer) {
          try {
            const extracted = await extractPdf(buffer);
            const tables = extracted.pages.reduce(
              (acc, p) => acc + (Array.isArray((p as any).tables) ? (p as any).tables.length : 0),
              0,
            );
            const tableRows = extracted.pages.reduce((acc, p) => {
              const t = Array.isArray((p as any).tables) ? (p as any).tables : [];
              return acc + t.reduce((acc2, tbl) => acc2 + (Array.isArray(tbl) ? tbl.length : 0), 0);
            }, 0);
            debug = {
              fileBytes: buffer.length,
              extracted: {
                pages: extracted.pages.length,
                textChars: extracted.text.length,
                tables,
                tableRows,
              },
            };
          } catch {
            debug = { fileBytes: buffer.length };
          }
        }
        relatoriosFiles.push({
          name: file.name,
          rowsTotal: 0,
          insertedRows: 0,
          skippedRows: 0,
          error: message,
          ...(debug ? { debug } : {}),
        });
        process.stdout.write(`Relatório: ${file.name} erro=${message}\n`);
        continue;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (notificationTo && notificationFrom) {
      await sendGraphMail({
        token,
        from: notificationFrom,
        to: notificationTo,
        subject: 'Importação de consignados - erro',
        html: `<p>Erro na importação.</p><p>${message}</p>`,
      });
    }
    throw err;
  }

  persistDatabase(db, dbFilePath);
  process.stdout.write(`SQLite: ${dbFilePath}\n`);

  if (notificationTo && notificationFrom) {
    await sendGraphMail({
      token,
      from: notificationFrom,
      to: notificationTo,
      subject: 'Importação de consignados - sucesso',
      html: `<p>Importação concluída.</p>
<ul>
<li>Extratos importados: ${importedExtratosCount}</li>
<li>Extratos movidos para "${importedFolderName}": ${movedExtratosCount}</li>
<li>Extratos inseridos (sem duplicar): ${insertedExtratosRows}</li>
<li>Extratos ignorados (duplicados): ${skippedExtratosRows}</li>
<li>Relatórios importados: ${importedRelatoriosCount}</li>
<li>Relatórios movidos para "${importedFolderName}": ${movedRelatoriosCount}</li>
<li>Relatórios inseridos (sem duplicar): ${insertedRelatoriosRows}</li>
<li>Relatórios ignorados (duplicados): ${skippedRelatoriosRows}</li>
</ul>`,
    });
  }

  const totalsInDb = {
    extratos: countTableRows(db, 'extratos'),
    relatorio: countTableRows(db, 'relatorio_consignado'),
  };

  return {
    importedExtratosCount,
    movedExtratosCount,
    importedRelatoriosCount,
    movedRelatoriosCount,
    insertedExtratosRows,
    skippedExtratosRows,
    insertedRelatoriosRows,
    skippedRelatoriosRows,
    extratosFoundOutsideImportados,
    relatoriosFoundOutsideImportados,
    extratosFoundIncludingImportados,
    relatoriosFoundIncludingImportados,
    extratosSelected,
    relatoriosSelected,
    extratosFiles,
    relatoriosFiles,
    ...(importMessage ? { message: importMessage } : {}),
    dbFilePath,
    totalsInDb,
    mode,
    target,
  };
}

function getLearningProfilesFromDb(db: Database) {
  if (!tableExists(db, 'import_learning_profiles')) return [];
  const rows = readTableRows(db, 'import_learning_profiles', [
    'id',
    'kind',
    'match_url_contains',
    'file_name_regex',
    'target_table',
    'options_json',
  ]) as ImportLearningProfileRow[];

  const out: Array<{
    id: string;
    kind: string;
    matchUrlContains: string;
    fileNameRegex: string;
    targetTable: string;
    optionsJson: string;
  }> = [];

  for (const r of rows) {
    const id = typeof r.id === 'string' ? r.id.trim() : '';
    const kind = typeof r.kind === 'string' ? r.kind.trim() : '';
    const matchUrlContains =
      typeof r.match_url_contains === 'string' ? r.match_url_contains.trim() : '';
    const fileNameRegex =
      typeof r.file_name_regex === 'string' ? r.file_name_regex.trim() : '';
    const targetTable =
      typeof r.target_table === 'string' ? r.target_table.trim() : '';
    const optionsJson =
      typeof r.options_json === 'string' ? r.options_json.trim() : '{}';
    if (!id || !kind || !matchUrlContains || !fileNameRegex || !targetTable) continue;
    out.push({ id, kind, matchUrlContains, fileNameRegex, targetTable, optionsJson });
  }
  return out;
}

function parseLearningProfileOptions(value: string): { mode: 'append' | 'replace' } {
  try {
    const parsed = JSON.parse(value) as { mode?: unknown };
    const mode = parsed?.mode === 'replace' ? 'replace' : 'append';
    return { mode };
  } catch {
    return { mode: 'append' };
  }
}

function normalizeUrlForMatch(value: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw.replace(/%20/gi, ' ');
  }
  return decoded
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function selectLearningProfileForFile(
  profiles: Array<{
    id: string;
    kind: string;
    matchUrlContains: string;
    fileNameRegex: string;
    targetTable: string;
    optionsJson: string;
  }>,
  opts: { fileUrl: string; fileName: string },
) {
  const url = opts.fileUrl.trim();
  const fileName = opts.fileName.trim();
  if (!url || !fileName) return null;

  const urlKey = normalizeUrlForMatch(url);
  let best: (typeof profiles)[number] | null = null;
  let bestScore = -1;
  for (const p of profiles) {
    const matchKey = normalizeUrlForMatch(p.matchUrlContains);
    if (!matchKey || !urlKey.includes(matchKey)) continue;
    let re: RegExp;
    try {
      re = new RegExp(p.fileNameRegex, 'i');
    } catch {
      continue;
    }
    if (!re.test(fileName)) continue;
    const score = p.matchUrlContains.length * 1000 + p.fileNameRegex.length;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

function selectLearningProfileForFolderUrl(
  profiles: Array<{
    id: string;
    kind: string;
    matchUrlContains: string;
    fileNameRegex: string;
    targetTable: string;
    optionsJson: string;
  }>,
  opts: { folderUrl: string },
) {
  const url = opts.folderUrl.trim();
  if (!url) return null;

  const urlKey = normalizeUrlForMatch(url);
  let best: (typeof profiles)[number] | null = null;
  let bestScore = -1;
  for (const p of profiles) {
    const matchKey = normalizeUrlForMatch(p.matchUrlContains);
    if (!matchKey || !urlKey.includes(matchKey)) continue;
    const score = p.matchUrlContains.length * 1000 + p.fileNameRegex.length;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

function importXlsxIntoTable(opts: {
  db: Database;
  tableName: string;
  fileName: string;
  file: Buffer;
  mode: 'append' | 'replace';
}) {
  const table = readSheetTable(opts.file);
  const fileColumns = table.headers;
  const rows = table.rows;
  if (fileColumns.length === 0) {
    throw new Error('Não foi possível identificar as colunas do arquivo.');
  }

  if (opts.mode === 'replace') {
    dropAndCreateTable(opts.db, opts.tableName, fileColumns);
  } else {
    ensureTableWithColumns(opts.db, opts.tableName, fileColumns);
  }

  if (rows.length === 0) {
    return {
      tableName: opts.tableName,
      fileName: opts.fileName,
      columns: fileColumns.length,
      rows: 0,
    };
  }

  const colsSql = fileColumns.map(escapeSqlIdentifier).join(', ');
  const placeholders = fileColumns.map(() => '?').join(', ');
  const stmt = opts.db.prepare(
    `INSERT INTO ${escapeSqlIdentifier(opts.tableName)} (${colsSql}) VALUES (${placeholders});`,
  );
  try {
    for (const row of rows) {
      const values = fileColumns.map((col) =>
        col in row ? toStableValue(row[col]) : '',
      );
      stmt.run(values as unknown as any[]);
    }
  } finally {
    stmt.free();
  }

  return {
    tableName: opts.tableName,
    fileName: opts.fileName,
    columns: fileColumns.length,
    rows: rows.length,
  };
}

function normalizeHeaderKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCpfValue(value: unknown): string {
  const raw = toStableValue(value);
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }
  return raw.trim();
}

function migrateRecursoAlegoTableColumns(db: Database, tableName: string) {
  if (!tableExists(db, tableName)) return;
  const existingCols = getTableColumns(db, tableName);
  if (existingCols.length === 0) return;

  const docCol =
    existingCols.find((c) => normalizeHeaderKey(c) === 'DOCUMENTO') ?? null;
  if (!docCol) return;
  const cpfCol =
    existingCols.find((c) => normalizeHeaderKey(c) === 'CPF') ?? null;

  const desiredColumns: string[] = [];
  const normalized = new Set<string>();
  for (const col of existingCols) {
    const key = normalizeHeaderKey(col);
    if (!key) continue;
    if (key === 'DOCUMENTO') {
      if (!normalized.has('CPF')) {
        desiredColumns.push('CPF');
        normalized.add('CPF');
      }
      continue;
    }
    if (key === 'CPF') {
      if (normalized.has('CPF')) continue;
      desiredColumns.push('CPF');
      normalized.add('CPF');
      continue;
    }
    if (normalized.has(key)) continue;
    desiredColumns.push(col);
    normalized.add(key);
  }
  if (!normalized.has('CPF')) {
    desiredColumns.unshift('CPF');
    normalized.add('CPF');
  }

  const suffix = new Date()
    .toISOString()
    .replaceAll(':', '')
    .replaceAll('-', '')
    .replaceAll('.', '');
  const tmpName = `${tableName}_tmp_${suffix}`;
  const tmpEscaped = escapeSqlIdentifier(tmpName);
  const tableEscaped = escapeSqlIdentifier(tableName);

  const columnsSql = desiredColumns
    .map((c) => `${escapeSqlIdentifier(c)} TEXT`)
    .join(', ');
  db.run(`DROP TABLE IF EXISTS ${tmpEscaped};`);
  db.run(`CREATE TABLE IF NOT EXISTS ${tmpEscaped} (${columnsSql});`);

  const insertColsSql = desiredColumns.map(escapeSqlIdentifier).join(', ');
  const selectExprs: string[] = [];
  for (const col of desiredColumns) {
    if (col === 'CPF') {
      const cpfExpr = cpfCol
        ? `NULLIF(TRIM(${escapeSqlIdentifier(cpfCol)}), '')`
        : "NULL";
      const docExpr = docCol
        ? `NULLIF(TRIM(${escapeSqlIdentifier(docCol)}), '')`
        : "NULL";
      selectExprs.push(`COALESCE(${cpfExpr}, ${docExpr}, '') AS ${escapeSqlIdentifier('CPF')}`);
      continue;
    }
    selectExprs.push(`${escapeSqlIdentifier(col)} AS ${escapeSqlIdentifier(col)}`);
  }
  db.run(
    `INSERT INTO ${tmpEscaped} (${insertColsSql}) SELECT ${selectExprs.join(
      ', ',
    )} FROM ${tableEscaped};`,
  );

  db.run(`DROP TABLE IF EXISTS ${tableEscaped};`);
  db.run(`ALTER TABLE ${tmpEscaped} RENAME TO ${tableEscaped};`);
}

function importRecursoAlegoXlsxIntoTable(opts: {
  db: Database;
  tableName: string;
  fileName: string;
  file: Buffer;
  mode: 'append' | 'replace';
}) {
  if (tableExists(opts.db, 'imported_row_hashes') && tableExists(opts.db, opts.tableName)) {
    const targetCount = countTableRows(opts.db, opts.tableName);
    if (targetCount === 0) {
      const kind = `recurso_alego:${opts.tableName}`;
      const check = opts.db.prepare(
        `SELECT COUNT(1) as c FROM imported_row_hashes WHERE kind=?;`,
      );
      try {
        check.bind([kind] as unknown as any[]);
        if (check.step()) {
          const row = check.getAsObject() as { c?: unknown };
          const c = Number((row as any).c);
          if (Number.isFinite(c) && c > 0) {
            const del = opts.db.prepare(`DELETE FROM imported_row_hashes WHERE kind=?;`);
            try {
              del.run([kind] as unknown as any[]);
            } finally {
              del.free();
            }
          }
        }
      } finally {
        check.free();
      }
    }
  }

  const table = readSheetTable(opts.file);
  const fileColumns = table.headers;
  const rows = table.rows;
  if (fileColumns.length === 0) {
    throw new Error('Não foi possível identificar as colunas do arquivo.');
  }

  const docCol =
    fileColumns.find((c) => normalizeHeaderKey(c) === 'DOCUMENTO') ?? null;
  const cpfCol =
    fileColumns.find((c) => normalizeHeaderKey(c) === 'CPF') ?? null;

  const finalColumns = (() => {
    const base = fileColumns.filter((c) => c !== docCol);
    const hasCpf = base.some((c) => normalizeHeaderKey(c) === 'CPF');
    const out = hasCpf ? base : ['CPF', ...base];
    const normalized = new Set<string>();
    const deduped: string[] = [];
    for (const c of out) {
      const key = normalizeHeaderKey(c);
      if (!key) continue;
      if (normalized.has(key)) continue;
      normalized.add(key);
      deduped.push(key === 'CPF' ? 'CPF' : c);
    }
    return deduped;
  })();

  if (finalColumns.length === 0) {
    throw new Error('Não foi possível identificar as colunas do arquivo.');
  }

  migrateRecursoAlegoTableColumns(opts.db, opts.tableName);
  ensureTableWithColumns(opts.db, opts.tableName, finalColumns);

  const colsSql = finalColumns.map(escapeSqlIdentifier).join(', ');
  const placeholders = finalColumns.map(() => '?').join(', ');
  const importedAt = new Date().toISOString();
  const kind = `recurso_alego:${opts.tableName}`;
  const hashStmt = opts.db.prepare(
    `INSERT OR IGNORE INTO imported_row_hashes (kind, row_hash, imported_at) VALUES (?, ?, ?);`,
  );
  const stmt = opts.db.prepare(
    `INSERT INTO ${escapeSqlIdentifier(opts.tableName)} (${colsSql}) VALUES (${placeholders});`,
  );

  let insertedRows = 0;
  let skippedNoCpf = 0;
  let skippedDuplicates = 0;
  try {
    for (const row of rows) {
      const cpfFromCpf = cpfCol ? normalizeCpfValue((row as any)[cpfCol]) : '';
      const cpfFromDoc = docCol ? normalizeCpfValue((row as any)[docCol]) : '';
      const cpf = cpfFromCpf || cpfFromDoc;
      if (!cpf) {
        skippedNoCpf += 1;
        continue;
      }
      const rowForHash: Record<string, unknown> = {};
      const values = finalColumns.map((col) => {
        if (col === 'CPF') {
          rowForHash.CPF = cpf;
          return cpf;
        }
        const v = col in row ? toStableValue((row as any)[col]) : '';
        rowForHash[col] = v;
        return v;
      });
      const rowHash = hashRow(kind, finalColumns, rowForHash);
      hashStmt.run([kind, rowHash, importedAt]);
      if (opts.db.getRowsModified() === 0) {
        skippedDuplicates += 1;
        continue;
      }
      stmt.run(values as unknown as any[]);
      insertedRows += 1;
    }
  } finally {
    hashStmt.free();
    stmt.free();
  }

  return {
    tableName: opts.tableName,
    fileName: opts.fileName,
    columns: finalColumns.length,
    insertedRows,
    skippedNoCpf,
    skippedDuplicates,
  };
}

async function readRecursoMpgoPdfTable(fileName: string, file: Buffer): Promise<{
  headers: string[];
  rows: Array<Record<string, string>>;
}> {
  const idx = file.indexOf(Buffer.from('%PDF'));
  if (idx === -1 || idx > 1024) {
    throw new Error('Recurso MPGO deve ser importado a partir de PDF.');
  }
  const extracted = await extractPdf(file);
  const rawText = extracted.pages.map((p) => p.text || '').join('\n');

  const competencia =
    (rawText.match(/per[ií]odo:\s*(\d{2}\/\d{4})/i)?.[1] ?? '').trim() || null;
  const orgao =
    (rawText.match(/ÓRGÃO:\s*([^\r\n]+)/i)?.[1] ?? '').trim() || null;

  const cpfRe = /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/;
  const moneyRe = /(-?\d{1,3}(?:\.\d{3})*,\d{2})/g;

  const cleanCell = (v: unknown) =>
    String(v ?? '')
      .replace(/\s+/g, ' ')
      .trim();

  const pickHeaderIndex = (headers: string[], opts: { equals?: string[]; includes?: string[] }) => {
    const equals = (opts.equals ?? []).map((s) => s.replace(/\s/g, ''));
    const includes = (opts.includes ?? []).map((s) => s.replace(/\s/g, ''));
    for (let i = 0; i < headers.length; i++) {
      const key = normalizeHeaderKey(headers[i] ?? '').replace(/\s/g, '');
      if (!key) continue;
      if (equals.includes(key)) return i;
      if (includes.some((needle) => key.includes(needle))) return i;
    }
    return -1;
  };

  const getRowCell = (row: unknown[], idx: number): string => {
    if (!Array.isArray(row)) return '';
    if (idx < 0 || idx >= row.length) return '';
    return cleanCell(row[idx]);
  };

  const toPtBrMoneyOrEmpty = (value: string): string => {
    const cents = parseMoneyToCents(value);
    return cents === null ? '' : centsToPtBr(cents);
  };

  const parseServidorCell = (raw: string) => {
    const value0 = cleanCell(raw);
    const value = value0.replace(/^\s*SERVIDOR\s*:?\s*/i, '').trim();
    const cpfMatch = value.match(cpfRe);
    const cpf = cpfMatch ? normalizeCpfValue(cpfMatch[1]) : '';

    const beforeCpf =
      cpfMatch && cpfMatch.index !== undefined ? value.slice(0, cpfMatch.index).trim() : value;

    const matriculaDashMatch = beforeCpf.match(/^\s*(\d{1,10})\s*[-–—]\s*(.+)$/);
    const matriculaSpaceMatch = beforeCpf.match(/^\s*(\d{1,10})\s+(.+)$/);
    const matricula = matriculaDashMatch
      ? String(matriculaDashMatch[1]).trim()
      : matriculaSpaceMatch
        ? String(matriculaSpaceMatch[1]).trim()
        : '';
    const afterMatricula = matriculaDashMatch
      ? String(matriculaDashMatch[2] ?? '').trim()
      : matriculaSpaceMatch
        ? String(matriculaSpaceMatch[2] ?? '').trim()
        : beforeCpf;

    let nome = afterMatricula.replace(/^\s*SERVIDOR\s*:?\s*/i, '').trim();
    nome = nome.replace(/[-–—|]/g, ' ');
    nome = nome.replace(/\s+/g, ' ').trim();
    return { cpf, matricula, nome };
  };

  const tryParseFromTables = (): Array<Record<string, string>> => {
    const out: Array<Record<string, string>> = [];
    let lastIndexes:
      | null
      | {
          idxServidor: number;
          idxCorresp: number;
          idxServico: number;
          idxNAde: number;
          idxDataInc: number;
          idxDataIni: number;
          idxDataFim: number;
          idxVlrAde: number;
          idxVlrParc: number;
          idxPrz: number;
          idxPgt: number;
          idxNParc: number;
          idxSitContrato: number;
          idxSitParcela: number;
          idxCatServidor: number;
        } = null;
    for (const p of extracted.pages) {
      for (const t of p.tables) {
        if (!Array.isArray(t) || t.length === 0) continue;
        const headerIndex = t.findIndex((row) =>
          Array.isArray(row) && row.some((c) => normalizeHeaderKey(cleanCell(c)) === 'SERVIDOR'),
        );
        const indexes = (() => {
          if (headerIndex === -1) {
            if (lastIndexes) return lastIndexes;
            const sampleRows = t
              .filter((r) => Array.isArray(r))
              .slice(0, 80) as unknown[][];
            const maxCols = sampleRows.reduce((acc, r) => Math.max(acc, r.length), 0);
            if (maxCols <= 0) return null;
            const cpfCounts = new Array<number>(maxCols).fill(0);
            const moneyCounts = new Array<number>(maxCols).fill(0);
            const cpfCellRe = /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/;
            const moneyCellRe = /-?\d{1,3}(?:\.\d{3})*,\d{1,2}/;
            for (const row of sampleRows) {
              for (let i = 0; i < maxCols; i++) {
                const cell = cleanCell(row[i]);
                if (!cell) continue;
                if (cpfCellRe.test(cell)) cpfCounts[i] += 1;
                if (moneyCellRe.test(cell)) moneyCounts[i] += 1;
              }
            }
            const bestCpfIdx = cpfCounts.indexOf(Math.max(...cpfCounts));
            const bestCpfCount = cpfCounts[bestCpfIdx] ?? 0;
            const bestMoneyIdx = moneyCounts
              .map((c, i) => (i === bestCpfIdx ? -1 : c))
              .indexOf(Math.max(...moneyCounts.map((c, i) => (i === bestCpfIdx ? -1 : c))));
            const bestMoneyCount = moneyCounts[bestMoneyIdx] ?? 0;
            if (bestCpfCount <= 0 || bestMoneyCount <= 0) return null;
            const guessed = {
              idxServidor: bestCpfIdx,
              idxCorresp: -1,
              idxServico: -1,
              idxNAde: -1,
              idxDataInc: -1,
              idxDataIni: -1,
              idxDataFim: -1,
              idxVlrAde: -1,
              idxVlrParc: bestMoneyIdx,
              idxPrz: -1,
              idxPgt: -1,
              idxNParc: -1,
              idxSitContrato: -1,
              idxSitParcela: -1,
              idxCatServidor: -1,
            };
            lastIndexes = guessed;
            return guessed;
          }
          const headerRow = t[headerIndex] ?? [];
          const headers = (Array.isArray(headerRow) ? headerRow : []).map((c) => cleanCell(c));
          const computed = {
            idxServidor: pickHeaderIndex(headers, { equals: ['SERVIDOR'] }),
            idxCorresp: pickHeaderIndex(headers, { includes: ['CORRESP'] }),
            idxServico: pickHeaderIndex(headers, { includes: ['SERVICO', 'SERVIÇO'] }),
            idxNAde: pickHeaderIndex(headers, { includes: ['NADE', 'NOADE', 'NºADE', 'NUMEROADE', 'NDE'] }),
            idxDataInc: pickHeaderIndex(headers, { includes: ['DATAINC'] }),
            idxDataIni: pickHeaderIndex(headers, { includes: ['DATAINI'] }),
            idxDataFim: pickHeaderIndex(headers, { includes: ['DATAFIM'] }),
            idxVlrAde: pickHeaderIndex(headers, { includes: ['VLRADE', 'VALORADE'] }),
            idxVlrParc: pickHeaderIndex(headers, { includes: ['VLRPARC', 'VALORPARC'] }),
            idxPrz: pickHeaderIndex(headers, { equals: ['PRZ'] }),
            idxPgt: pickHeaderIndex(headers, { equals: ['PGT'] }),
            idxNParc: pickHeaderIndex(headers, { includes: ['NPARC', 'NOPARC', 'NºPARC', 'NUMEROPARC'] }),
            idxSitContrato: pickHeaderIndex(headers, { includes: ['SITDOCONTRATO', 'SITCONTRATO'] }),
            idxSitParcela: pickHeaderIndex(headers, { includes: ['SITDAPARCELA', 'SITPARCELA'] }),
            idxCatServidor: pickHeaderIndex(headers, { includes: ['CATDOSERVIDOR', 'CATSERVIDOR'] }),
          };
          if (computed.idxServidor === -1 || computed.idxVlrParc === -1) return null;
          lastIndexes = computed;
          return computed;
        })();
        if (!indexes) continue;
        const {
          idxServidor,
          idxCorresp,
          idxServico,
          idxNAde,
          idxDataInc,
          idxDataIni,
          idxDataFim,
          idxVlrAde,
          idxVlrParc,
          idxPrz,
          idxPgt,
          idxNParc,
          idxSitContrato,
          idxSitParcela,
          idxCatServidor,
        } = indexes;

        const valueIndexes = [
          idxCorresp,
          idxServico,
          idxNAde,
          idxDataInc,
          idxDataIni,
          idxDataFim,
          idxVlrAde,
          idxVlrParc,
          idxPrz,
          idxPgt,
          idxNParc,
          idxSitContrato,
          idxSitParcela,
          idxCatServidor,
        ].filter((i) => i !== -1);

        const nonServidorIndexes = valueIndexes.filter((i) => i !== idxServidor);

        type Pending = { servidorText: string; cells: Record<number, string> };
        let pending: Pending | null = null;

        const pickFromRow = (dst: Pending, row: unknown[]) => {
          for (const i of valueIndexes) {
            const v = getRowCell(row, i);
            if (!v) continue;
            if (!dst.cells[i]) dst.cells[i] = v;
          }
        };

        const hasAnyNonServidorValue = (row: unknown[]) =>
          nonServidorIndexes.some((i) => getRowCell(row, i));

        const flushPending = () => {
          if (!pending) return;
          const { cpf, matricula, nome } = parseServidorCell(pending.servidorText);
          if (!cpf) return;
          const vlrParcCell = pending.cells[idxVlrParc] ?? '';
          let cents = parseMoneyToCents(vlrParcCell);
          if (cents === null) {
            const candidates = Object.values(pending.cells)
              .flatMap((v) => String(v ?? '').match(moneyRe) ?? [])
              .map((v) => parseMoneyToCents(v))
              .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
            if (candidates.length > 0) cents = candidates[candidates.length - 1]!;
          }
          if (cents === null) return;

          out.push({
            CPF: cpf,
            Nome: nome,
            Matricula: matricula,
            Copetencia: competencia ?? '',
            'Valor Parcela': centsToPtBr(cents),
            ...(orgao ? { Orgao: orgao } : {}),
            ...(idxCorresp !== -1 ? { Corresp: pending.cells[idxCorresp] ?? '' } : {}),
            ...(idxServico !== -1 ? { Servico: pending.cells[idxServico] ?? '' } : {}),
            ...(idxNAde !== -1 ? { 'Nº ADE': pending.cells[idxNAde] ?? '' } : {}),
            ...(idxDataInc !== -1 ? { 'Data Inc': pending.cells[idxDataInc] ?? '' } : {}),
            ...(idxDataIni !== -1 ? { 'Data Ini': pending.cells[idxDataIni] ?? '' } : {}),
            ...(idxDataFim !== -1 ? { 'Data Fim': pending.cells[idxDataFim] ?? '' } : {}),
            ...(idxVlrAde !== -1 ? { 'Vlr. ADE': toPtBrMoneyOrEmpty(pending.cells[idxVlrAde] ?? '') } : {}),
            ...(idxPrz !== -1 ? { PRZ: pending.cells[idxPrz] ?? '' } : {}),
            ...(idxPgt !== -1 ? { PGT: pending.cells[idxPgt] ?? '' } : {}),
            ...(idxNParc !== -1 ? { 'Nº Parc': pending.cells[idxNParc] ?? '' } : {}),
            ...(idxSitContrato !== -1 ? { 'Sit. Contrato': pending.cells[idxSitContrato] ?? '' } : {}),
            ...(idxSitParcela !== -1 ? { 'Sit. Parcela': pending.cells[idxSitParcela] ?? '' } : {}),
            ...(idxCatServidor !== -1 ? { 'Cat. Servidor': pending.cells[idxCatServidor] ?? '' } : {}),
            Arquivo: fileName,
          });
        };

        const startRow = headerIndex === -1 ? 0 : headerIndex + 1;
        for (let r = startRow; r < t.length; r++) {
          const row = t[r];
          if (!Array.isArray(row) || row.length === 0) continue;
          const servidorCell = getRowCell(row, idxServidor);
          const anyNonServidor = hasAnyNonServidorValue(row);

          if (pending) {
            if (servidorCell && !anyNonServidor) {
              pending.servidorText = `${pending.servidorText} ${servidorCell}`.replace(/\s+/g, ' ').trim();
              pickFromRow(pending, row);
              continue;
            }
            if (!servidorCell && anyNonServidor) {
              pickFromRow(pending, row);
              continue;
            }
            flushPending();
            pending = null;
          }

          if (!servidorCell) continue;
          pending = { servidorText: servidorCell, cells: {} };
          pickFromRow(pending, row);
        }
        flushPending();
      }
    }
    return out;
  };

  const out: Array<Record<string, string>> = [];
  const byTable = tryParseFromTables();
  out.push(...byTable);

  {
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const startRe = /^\d{1,10}\s*[-–—]/;
    const records: string[] = [];
    let current: string[] = [];
    const flush = () => {
      if (current.length === 0) return;
      const joined = current.join(' ').replace(/\s+/g, ' ').trim();
      if (joined) records.push(joined);
      current = [];
    };

    for (const line of lines) {
      const upper = line.toUpperCase();
      if (upper.includes('RELATÓRIO DE MOVIMENTO FINANCEIRO')) continue;
      if (upper.startsWith('ÓRGÃO:')) continue;
      if (upper.includes('CONSIGNATARIA:')) continue;
      const headerHitCount =
        (upper.includes('SERVIDOR') ? 1 : 0) +
        (upper.includes('CORRESP') ? 1 : 0) +
        (upper.includes('SERVIÇO') || upper.includes('SERVICO') ? 1 : 0) +
        (upper.includes('Nº ADE') || upper.includes('N ADE') || upper.includes('ADE') ? 1 : 0) +
        (upper.includes('DATA INC') || upper.includes('DATA INI') || upper.includes('DATA FIM') ? 1 : 0) +
        (upper.includes('VLR. ADE') || upper.includes('VLR. PARC') || upper.includes('VLR ADE') || upper.includes('VLR PARC') ? 1 : 0) +
        (upper.includes('PRZ') ? 1 : 0) +
        (upper.includes('PGT') ? 1 : 0) +
        (upper.includes('SIT. DO CONTRATO') || upper.includes('SIT. DA PARCELA') ? 1 : 0) +
        (upper.includes('CAT. DO SERVIDOR') ? 1 : 0);
      if (headerHitCount >= 5) continue;
      if (upper.startsWith('TOTAL')) continue;
      if (startRe.test(line)) {
        flush();
        current.push(line);
      } else if (current.length > 0) {
        current.push(line);
      }
    }
    flush();

    const takeNextMatch = (s: string, re: RegExp) => {
      const m = s.match(re);
      if (!m || m.index === undefined) return null;
      const matched = m[0];
      const rest = (s.slice(0, m.index) + ' ' + s.slice(m.index + matched.length))
        .replace(/\s+/g, ' ')
        .trim();
      return { matched, rest };
    };

    const takeNextNumber = (s: string) => takeNextMatch(s, /\b\d+\b/);
    const takeNextDate = (s: string) => takeNextMatch(s, /\b\d{2}\/\d{2}\/\d{4}\b/);
    const takeNextMonthYear = (s: string) => takeNextMatch(s, /\b\d{2}\/\d{4}\b/);
    const takeNextMoney = (s: string) => takeNextMatch(s, /-?\d{1,3}(?:\.\d{3})*,\d{2}/);

    const normalizeHead = (s: string) =>
      s
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');

    const parsedFromText: Array<Record<string, string>> = [];
    for (const rec of records) {
      const cpfMatch = rec.match(cpfRe);
      if (!cpfMatch) continue;
      const cpf = normalizeCpfValue(cpfMatch[1]);
      if (!cpf) continue;
      const { matricula, nome } = parseServidorCell(rec);

      let rest = rec;
      rest = rest.replace(cpfRe, ' ').replace(/\s+/g, ' ').trim();
      if (matricula) {
        rest = rest.replace(new RegExp(`^\\s*${matricula}\\s*[-–—]\\s*`, 'i'), '');
      }
      if (nome) {
        const ix = rest.toUpperCase().indexOf(nome.toUpperCase());
        if (ix >= 0) rest = (rest.slice(0, ix) + ' ' + rest.slice(ix + nome.length)).trim();
      }

      const n1 = takeNextNumber(rest);
      if (!n1) continue;
      const corresp = n1.matched;
      rest = n1.rest;

      const n2 = takeNextNumber(rest);
      if (!n2) continue;
      const servico = n2.matched;
      rest = n2.rest;

      const n3 = takeNextNumber(rest);
      if (!n3) continue;
      const nAde = n3.matched;
      rest = n3.rest;

      const dInc = takeNextDate(rest);
      const dataInc = dInc ? dInc.matched : '';
      rest = dInc ? dInc.rest : rest;

      const dIni = takeNextMonthYear(rest);
      const dataIni = dIni ? dIni.matched : '';
      rest = dIni ? dIni.rest : rest;

      const dFim = takeNextMonthYear(rest);
      const dataFim = dFim ? dFim.matched : '';
      rest = dFim ? dFim.rest : rest;

      const mAde = takeNextMoney(rest);
      const vlrAde = mAde ? toPtBrMoneyOrEmpty(mAde.matched) : '';
      rest = mAde ? mAde.rest : rest;

      const mParc = takeNextMoney(rest);
      const vlrParc = mParc ? toPtBrMoneyOrEmpty(mParc.matched) : '';
      rest = mParc ? mParc.rest : rest;
      if (!vlrParc) continue;

      const przM = takeNextNumber(rest);
      const prz = przM ? przM.matched : '';
      rest = przM ? przM.rest : rest;

      const pgtM = takeNextNumber(rest);
      const pgt = pgtM ? pgtM.matched : '';
      rest = pgtM ? pgtM.rest : rest;

      const nParcM = takeNextNumber(rest);
      const nParc = nParcM ? nParcM.matched : '';
      rest = nParcM ? nParcM.rest : rest;

      const restHead = normalizeHead(rest);
      const sitContrato = restHead.startsWith('EM ANDAMENTO')
        ? 'Em Andamento'
        : restHead.startsWith('ENCERRADO')
          ? 'Encerrado'
          : restHead.startsWith('CANCELADO')
            ? 'Cancelado'
            : rest.split(' ').slice(0, 2).join(' ').trim();
      rest = rest.trim();
      if (sitContrato) {
        const rx = new RegExp(`^\\s*${sitContrato.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i');
        rest = rest.replace(rx, '').trim();
      }

      const restHead2 = normalizeHead(rest);
      const sitParcela = restHead2.startsWith('LIQUIDADA FOLHA')
        ? 'Liquidada Folha'
        : restHead2.startsWith('LIQUIDADA')
          ? 'Liquidada'
          : restHead2.startsWith('EM ABERTO')
            ? 'Em Aberto'
            : rest.split(' ').slice(0, 2).join(' ').trim();
      if (sitParcela) {
        const rx = new RegExp(`^\\s*${sitParcela.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i');
        rest = rest.replace(rx, '').trim();
      }

      const catServidor = rest.trim();

      parsedFromText.push({
        CPF: cpf,
        Nome: nome,
        Matricula: matricula,
        Copetencia: competencia ?? '',
        ...(orgao ? { Orgao: orgao } : {}),
        Corresp: corresp,
        Servico: servico,
        'Nº ADE': nAde,
        'Data Inc': dataInc,
        'Data Ini': dataIni,
        'Data Fim': dataFim,
        'Vlr. ADE': vlrAde,
        'Valor Parcela': vlrParc,
        PRZ: prz,
        PGT: pgt,
        'Nº Parc': nParc,
        'Sit. Contrato': sitContrato,
        'Sit. Parcela': sitParcela,
        'Cat. Servidor': catServidor,
        Arquivo: fileName,
      });
    }

    const makeKey = (r: Record<string, string>) =>
      `${String(r.CPF ?? '').replace(/\D/g, '')}|${String(r.Matricula ?? '').trim()}|${String(
        r['Nº ADE'] ?? '',
      ).trim()}|${String(r['Valor Parcela'] ?? '').trim()}`;
    const seen = new Set(out.map(makeKey));
    for (const r of parsedFromText) {
      const k = makeKey(r);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  }

  if (out.length === 0) {
    throw new Error(
      `Recurso MPGO (PDF): não foi possível extrair registros (layout do arquivo pode ter mudado).`,
    );
  }

  return {
    headers: [
      'CPF',
      'Nome',
      'Matricula',
      'Copetencia',
      'Valor Parcela',
      'Orgao',
      'Corresp',
      'Servico',
      'Nº ADE',
      'Data Inc',
      'Data Ini',
      'Data Fim',
      'Vlr. ADE',
      'PRZ',
      'PGT',
      'Nº Parc',
      'Sit. Contrato',
      'Sit. Parcela',
      'Cat. Servidor',
      'Arquivo',
    ],
    rows: out,
  };
}

export async function debugRecursoMpgoPdfLocal(opts: { filePath: string }) {
  const filePath = String(opts.filePath ?? '').trim();
  if (!filePath) throw new Error('Informe filePath.');
  const buf = fs.readFileSync(filePath);
  const extracted = await extractPdf(buf);
  const rawText = extracted.pages.map((p) => p.text || '').join('\n');
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const startRe = /^\d{1,10}\s*[-–—]/;
  const startLines = lines.filter((l) => startRe.test(l)).length;

  const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
  const pageTableStats = extracted.pages.map((p, pageIndex) => {
    const tables = Array.isArray(p.tables) ? p.tables : [];
    const foundHeaders: string[][] = [];
    let dataRows = 0;
    for (const t of tables) {
      if (!Array.isArray(t) || t.length === 0) continue;
      const headerIndex = t.findIndex(
        (row) =>
          Array.isArray(row) &&
          row.some((c) => normalizeHeaderKey(clean(c)) === 'SERVIDOR'),
      );
      if (headerIndex === -1) continue;
      const headerRow = t[headerIndex] ?? [];
      foundHeaders.push((Array.isArray(headerRow) ? headerRow : []).map((c) => normalizeHeaderKey(clean(c))));
      dataRows += Math.max(0, t.length - headerIndex - 1);
    }
    return {
      page: pageIndex + 1,
      tables: tables.length,
      headersFound: foundHeaders.length,
      dataRows,
      headerPreview: foundHeaders[0]?.filter(Boolean).slice(0, 8) ?? [],
    };
  });
  const pagesWithHeader = pageTableStats.filter((p) => p.headersFound > 0).length;
  const pagesWithoutHeader = pageTableStats.filter((p) => p.headersFound === 0).length;

  const parsed = await readRecursoMpgoPdfTable(path.basename(filePath), buf);
  const sumCents = parsed.rows.reduce((acc, r) => acc + (parseMoneyToCents(r['Valor Parcela']) ?? 0), 0);
  const totalRows = parsed.rows.length;
  const filledCpf = parsed.rows.filter((r) => normalizeCpfValue(r.CPF)).length;
  const filledNome = parsed.rows.filter((r) => String(r.Nome ?? '').trim().length > 0).length;
  const filledMat = parsed.rows.filter((r) => String(r.Matricula ?? '').trim().length > 0).length;
  const filledComp = parsed.rows.filter((r) => String(r.Copetencia ?? '').trim().length > 0).length;
  const tableRowCount = extracted.pages.reduce((acc, p) => {
    const t = Array.isArray(p.tables) ? p.tables : [];
    return (
      acc +
      t.reduce((acc2, tbl) => acc2 + (Array.isArray(tbl) ? tbl.length : 0), 0)
    );
  }, 0);
  const tableCount = extracted.pages.reduce((acc, p) => acc + (Array.isArray(p.tables) ? p.tables.length : 0), 0);

  return {
    filePath,
    headers: parsed.headers,
    extracted: {
      pages: extracted.pages.length,
      textChars: extracted.text.length,
      lines: lines.length,
      startLines,
      tables: tableCount,
      tableRows: tableRowCount,
      pagesWithHeader,
      pagesWithoutHeader,
    },
    pageTableStats,
    totalRows,
    totals: {
      valorParcelaCents: sumCents,
      valorParcelaText: centsToPtBr(sumCents),
    },
    filled: { cpf: filledCpf, nome: filledNome, matricula: filledMat, copetencia: filledComp },
  };
}

export async function debugRelatorioSisbrPdfLocal(opts: { filePath: string }) {
  const filePath = String(opts.filePath ?? '').trim();
  if (!filePath) throw new Error('Informe filePath.');
  const buf = fs.readFileSync(filePath);
  const extracted = await extractPdf(buf);
  const parsed = await readRelatorioPdfTable(path.basename(filePath), buf);
  const rows = parsed.rows;

  const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
  const cpfFilled = rows.filter((r) => normalizeCpfValue((r as any).CPF)).length;
  const nomeFilled = rows.filter((r) => clean((r as any).Nome).length > 0).length;
  const nomeMissingWithCpf = rows.filter(
    (r) => normalizeCpfValue((r as any).CPF) && clean((r as any).Nome).length === 0,
  );

  const sample = nomeMissingWithCpf.slice(0, 25).map((r) => ({
    EMPRESA: clean((r as any).EMPRESA),
    Cliente: clean((r as any).Cliente),
    'Matrícula': clean((r as any)['Matrícula']),
    CPF: clean((r as any).CPF),
    Nome: clean((r as any).Nome),
    Operação: clean((r as any)['Operação']),
    Modalidade: clean((r as any).Modalidade),
    Vencimento: clean((r as any).Vencimento),
    'Valor Parcela': clean((r as any)['Valor Parcela']),
  }));

  const tables = extracted.pages.reduce(
    (acc, p) => acc + (Array.isArray((p as any).tables) ? (p as any).tables.length : 0),
    0,
  );
  const tableRows = extracted.pages.reduce((acc, p) => {
    const t = Array.isArray((p as any).tables) ? (p as any).tables : [];
    return acc + t.reduce((acc2, tbl) => acc2 + (Array.isArray(tbl) ? tbl.length : 0), 0);
  }, 0);

  return {
    filePath,
    headers: parsed.headers,
    extracted: {
      pages: extracted.pages.length,
      textChars: extracted.text.length,
      tables,
      tableRows,
    },
    parsed: {
      rows: rows.length,
      filled: { cpf: cpfFilled, nome: nomeFilled },
      nomeMissingWithCpf: nomeMissingWithCpf.length,
      sample,
    },
  };
}

export async function importRelatorioSisbrPdfLocalIntoDb(opts: {
  filePath: string;
  mode?: 'append' | 'replace';
}) {
  const filePath = String(opts.filePath ?? '').trim();
  if (!filePath) throw new Error('Informe filePath.');
  const mode: 'append' | 'replace' = opts.mode === 'replace' ? 'replace' : 'append';

  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const buf = fs.readFileSync(filePath);
  const table = await readRelatorioPdfTable(path.basename(filePath), buf);
  const rows = table.rows;
  const fileColumns = table.headers;
  if (fileColumns.length === 0) {
    throw new Error('Não foi possível identificar as colunas do PDF.');
  }

  db.run('BEGIN;');
  try {
    if (mode === 'replace') {
      if (tableExists(db, 'relatorio_consignado')) db.run('DELETE FROM relatorio_consignado;');
      if (tableExists(db, 'imported_row_hashes')) clearImportedHashes(db, 'relatorio_consignado');
    }
    ensureRelatorioConsignadoTable(db, fileColumns);
    const inserted =
      rows.length > 0
        ? insertRelatorioConsignadoRows({ db, fileColumns, rows })
        : { insertedRows: 0, skippedRows: 0 };
    normalizeRelatorioConsignadoFillDown(db);
    db.run('COMMIT;');
    persistDatabase(db, dbFilePath);
    return {
      dbFilePath,
      fileName: path.basename(filePath),
      mode,
      rowsParsed: rows.length,
      insertedRows: inserted.insertedRows,
      skippedRows: inserted.skippedRows,
      totalsInDb: {
        relatorio: countTableRows(db, 'relatorio_consignado'),
      },
    };
  } catch (e: unknown) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  }
}

async function importRecursoMpgoPdfIntoTable(opts: {
  db: Database;
  tableName: string;
  fileName: string;
  file: Buffer;
  mode: 'append' | 'replace';
}) {
  if (opts.mode === 'replace' && tableExists(opts.db, 'imported_row_hashes')) {
    const kind = `recurso_mpgo:${opts.tableName}`;
    const del = opts.db.prepare(`DELETE FROM imported_row_hashes WHERE kind=?;`);
    try {
      del.run([kind] as unknown as any[]);
    } finally {
      del.free();
    }
  }
  if (tableExists(opts.db, 'imported_row_hashes') && tableExists(opts.db, opts.tableName)) {
    const targetCount = countTableRows(opts.db, opts.tableName);
    if (targetCount === 0) {
      const kind = `recurso_mpgo:${opts.tableName}`;
      const check = opts.db.prepare(
        `SELECT COUNT(1) as c FROM imported_row_hashes WHERE kind=?;`,
      );
      try {
        check.bind([kind] as unknown as any[]);
        if (check.step()) {
          const row = check.getAsObject() as { c?: unknown };
          const c = Number((row as any).c);
          if (Number.isFinite(c) && c > 0) {
            const del = opts.db.prepare(`DELETE FROM imported_row_hashes WHERE kind=?;`);
            try {
              del.run([kind] as unknown as any[]);
            } finally {
              del.free();
            }
          }
        }
      } finally {
        check.free();
      }
    }
  }

  const table = await readRecursoMpgoPdfTable(opts.fileName, opts.file);
  const fileColumns = table.headers;
  const rows = table.rows;
  if (fileColumns.length === 0) {
    throw new Error('Não foi possível identificar as colunas do PDF.');
  }

  if (opts.mode === 'replace') {
    dropAndCreateTable(opts.db, opts.tableName, fileColumns);
  } else {
    ensureTableWithColumns(opts.db, opts.tableName, fileColumns);
  }

  const colsSql = fileColumns.map(escapeSqlIdentifier).join(', ');
  const placeholders = fileColumns.map(() => '?').join(', ');
  const importedAt = new Date().toISOString();
  const kind = `recurso_mpgo:${opts.tableName}`;
  const hashStmt = opts.db.prepare(
    `INSERT OR IGNORE INTO imported_row_hashes (kind, row_hash, imported_at) VALUES (?, ?, ?);`,
  );
  const stmt = opts.db.prepare(
    `INSERT INTO ${escapeSqlIdentifier(opts.tableName)} (${colsSql}) VALUES (${placeholders});`,
  );

  let insertedRows = 0;
  let skippedNoCpf = 0;
  let skippedDuplicates = 0;
  try {
    for (const row of rows) {
      const cpf = normalizeCpfValue((row as any).CPF);
      if (!cpf) {
        skippedNoCpf += 1;
        continue;
      }
      const rowForHash: Record<string, unknown> = {};
      const values = fileColumns.map((col) => {
        if (col === 'CPF') {
          rowForHash.CPF = cpf;
          return cpf;
        }
        const v = col in row ? toStableValue((row as any)[col]) : '';
        rowForHash[col] = v;
        return v;
      });
      const rowHash = hashRow(kind, fileColumns, rowForHash);
      hashStmt.run([kind, rowHash, importedAt]);
      if (opts.db.getRowsModified() === 0) {
        skippedDuplicates += 1;
        continue;
      }
      stmt.run(values as unknown as any[]);
      insertedRows += 1;
    }
  } finally {
    hashStmt.free();
    stmt.free();
  }

  return {
    tableName: opts.tableName,
    fileName: opts.fileName,
    columns: fileColumns.length,
    insertedRows,
    skippedNoCpf,
    skippedDuplicates,
  };
}

async function importByLearningProfileFromResolvedFile(opts: {
  token: string;
  fileName: string;
  matchUrl: string;
  downloadUrl: string;
  driveId: string;
  fileId: string;
  parentFolderId: string;
}) {
  dotenv.config();
  const file = await graphDownload(opts.token, opts.downloadUrl);

  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);

  const profiles = getLearningProfilesFromDb(db);
  const profile = selectLearningProfileForFile(profiles, {
    fileUrl: opts.matchUrl,
    fileName: opts.fileName,
  });
  if (!profile) {
    throw new Error(
      `Nenhum perfil de aprendizado encontrado para: ${opts.fileName}.`,
    );
  }

  const options = parseLearningProfileOptions(profile.optionsJson);

  db.run('BEGIN;');
  try {
    if (profile.kind === 'recurso_alego') {
      const lower = opts.fileName.toLowerCase();
      if (!(lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.xlsm'))) {
        throw new Error('Perfil recurso_alego aceita apenas Excel (.xls/.xlsx/.xlsm).');
      }
      const result = importRecursoAlegoXlsxIntoTable({
        db,
        tableName: profile.targetTable,
        fileName: opts.fileName,
        file,
        mode: options.mode,
      });
      db.run('COMMIT;');
      persistDatabase(db, dbFilePath);

      const base = {
        profileId: profile.id,
        kind: profile.kind,
        fileName: result.fileName,
        tableName: result.tableName,
        columns: result.columns,
        rows: result.insertedRows,
        skippedNoCpf: result.skippedNoCpf,
        skippedDuplicates: result.skippedDuplicates,
        mode: options.mode,
        dbFilePath,
      };

      const importedFolderName = process.env.SHAREPOINT_IMPORTED_FOLDER ?? 'Importados';
      let movedToImportados = false;
      let moveError: string | null = null;
      try {
        const parentId =
          (await getDriveItemParentId({
            token: opts.token,
            driveId: opts.driveId,
            itemId: opts.fileId,
          })) ?? opts.parentFolderId;
        const importedFolderId = await ensureChildFolder({
          token: opts.token,
          driveId: opts.driveId,
          parentId,
          folderName: importedFolderName,
        });
        if (parentId === importedFolderId) {
          movedToImportados = true;
        } else {
          await moveDriveItemWithRetry({
            token: opts.token,
            driveId: opts.driveId,
            itemId: opts.fileId,
            newParentId: importedFolderId,
            attempts: 3,
          });
          movedToImportados = true;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        moveError = msg || 'Falha ao mover para Importados.';
      }

      return {
        ...base,
        movedToImportados,
        ...(moveError ? { moveError } : {}),
      };
    }

    if (profile.kind === 'recurso_mpgo') {
      const lower = opts.fileName.toLowerCase();
      if (!lower.endsWith('.pdf')) {
        throw new Error('Perfil recurso_mpgo aceita apenas PDF (.pdf).');
      }
      const result = await importRecursoMpgoPdfIntoTable({
        db,
        tableName: profile.targetTable,
        fileName: opts.fileName,
        file,
        mode: options.mode,
      });
      db.run('COMMIT;');
      persistDatabase(db, dbFilePath);

      const base = {
        profileId: profile.id,
        kind: profile.kind,
        fileName: result.fileName,
        tableName: result.tableName,
        columns: result.columns,
        rows: result.insertedRows,
        skippedNoCpf: result.skippedNoCpf,
        skippedDuplicates: result.skippedDuplicates,
        mode: options.mode,
        dbFilePath,
      };

      const importedFolderName = process.env.SHAREPOINT_IMPORTED_FOLDER ?? 'Importados';
      let movedToImportados = false;
      let moveError: string | null = null;
      try {
        const parentId =
          (await getDriveItemParentId({
            token: opts.token,
            driveId: opts.driveId,
            itemId: opts.fileId,
          })) ?? opts.parentFolderId;
        const importedFolderId = await ensureChildFolder({
          token: opts.token,
          driveId: opts.driveId,
          parentId,
          folderName: importedFolderName,
        });
        if (parentId === importedFolderId) {
          movedToImportados = true;
        } else {
          await moveDriveItemWithRetry({
            token: opts.token,
            driveId: opts.driveId,
            itemId: opts.fileId,
            newParentId: importedFolderId,
            attempts: 3,
          });
          movedToImportados = true;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        moveError = msg || 'Falha ao mover para Importados.';
      }

      return {
        ...base,
        movedToImportados,
        ...(moveError ? { moveError } : {}),
      };
    }

    throw new Error(`Perfil de aprendizado não suportado: ${profile.kind}`);
  } catch (e: unknown) {
    try {
      db.run('ROLLBACK;');
    } catch {
      void 0;
    }
    throw e;
  }
}

export async function importByLearningProfileFromShareUrl(opts: { fileUrl: string }) {
  dotenv.config();

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!tenantId) throw new Error('AZURE_TENANT_ID não configurado');
  if (!clientId) throw new Error('AZURE_CLIENT_ID não configurado');
  if (!clientSecret) throw new Error('AZURE_CLIENT_SECRET não configurado');

  const fileUrl = String(opts.fileUrl ?? '').trim();
  if (!fileUrl) throw new Error('Informe a URL do arquivo do SharePoint.');

  const token = await getGraphToken({ tenantId, clientId, clientSecret });
  const normalizedFileUrl = normalizeUrl(fileUrl);
  const resolved = await resolveDriveItemFromShareUrl(token, normalizedFileUrl);
  if (!resolved.specificFile) {
    throw new Error('A URL informada precisa apontar para um arquivo (não uma pasta).');
  }

  const fileId = resolved.specificFile.id;
  const fileName = resolved.specificFile.name;
  const graphContentUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
    resolved.driveId,
  )}/items/${encodeURIComponent(fileId)}/content`;

  return await importByLearningProfileFromResolvedFile({
    token,
    fileName,
    matchUrl: normalizedFileUrl,
    downloadUrl: graphContentUrl,
    driveId: resolved.driveId,
    fileId,
    parentFolderId: resolved.itemId,
  });
}

export async function importByLearningProfileFromFolderUrl(opts: { folderUrl: string }) {
  dotenv.config();

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!tenantId) throw new Error('AZURE_TENANT_ID não configurado');
  if (!clientId) throw new Error('AZURE_CLIENT_ID não configurado');
  if (!clientSecret) throw new Error('AZURE_CLIENT_SECRET não configurado');

  const folderUrl = String(opts.folderUrl ?? '').trim();
  if (!folderUrl) throw new Error('Informe a URL da pasta do SharePoint.');

  const token = await getGraphToken({ tenantId, clientId, clientSecret });
  const normalizedFolderUrl = normalizeUrl(folderUrl);
  const resolved = await resolveDriveItemFromShareUrl(token, normalizedFolderUrl);
  if (resolved.specificFile) {
    return await importByLearningProfileFromShareUrl({ fileUrl: normalizedFolderUrl });
  }

  const dbFilePath = getSqlitePath();
  const db = await openDatabase(dbFilePath);
  ensureSchema(db);
  const profiles = getLearningProfilesFromDb(db);
  const profile = selectLearningProfileForFolderUrl(profiles, {
    folderUrl: normalizedFolderUrl,
  });
  if (!profile) {
    throw new Error('Nenhum perfil de aprendizado compatível com esta pasta.');
  }

  let fileRe: RegExp;
  try {
    fileRe = new RegExp(profile.fileNameRegex, 'i');
  } catch {
    throw new Error('Regex do perfil de aprendizado inválida.');
  }

  const importedFolderName = process.env.SHAREPOINT_IMPORTED_FOLDER ?? 'Importados';
  const filesOutsideImportados = await listSpreadsheetFilesRecursive({
    token,
    driveId: resolved.driveId,
    rootFolderId: resolved.itemId,
    excludeFolderNames: [importedFolderName],
    fileFilter: (name) => {
      const lower = name.trim().toLowerCase();
      if (profile.kind === 'recurso_mpgo') {
        return lower.endsWith('.pdf') && fileRe.test(name);
      }
      return (
        (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.xlsm')) &&
        fileRe.test(name)
      );
    },
  });
  const files =
    filesOutsideImportados.length > 0
      ? filesOutsideImportados
      : await listSpreadsheetFilesRecursive({
          token,
          driveId: resolved.driveId,
          rootFolderId: resolved.itemId,
          fileFilter: (name) => {
            const lower = name.trim().toLowerCase();
            if (profile.kind === 'recurso_mpgo') {
              return lower.endsWith('.pdf') && fileRe.test(name);
            }
            return (
              (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.xlsm')) &&
              fileRe.test(name)
            );
          },
        });
  if (files.length === 0) {
    throw new Error('Nenhum arquivo encontrado na pasta para o perfil selecionado.');
  }

  const picked = files.sort((a, b) => b.lastModifiedDateTime.localeCompare(a.lastModifiedDateTime))[0]!;
  const graphContentUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
    resolved.driveId,
  )}/items/${encodeURIComponent(picked.id)}/content`;

  return await importByLearningProfileFromResolvedFile({
    token,
    fileName: picked.name,
    matchUrl: normalizedFolderUrl,
    downloadUrl: graphContentUrl,
    driveId: resolved.driveId,
    fileId: picked.id,
    parentFolderId: resolved.itemId,
  });
}

const runningAsScript =
  Boolean(process.argv[1]) &&
  /import-consignado\.(ts|js)$/i.test(
    String(process.argv[1]).replaceAll('\\', '/'),
  );
if (runningAsScript) {
  runImportConsignado().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
