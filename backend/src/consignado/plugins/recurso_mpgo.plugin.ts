import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  ConsignadoImportPlugin,
  ConsignadoImportPluginContext,
  ConsignadoImportPluginParseResult,
} from './import-plugin.interface';

const EXTRACT_MPGO_REGEX_CPF = /(\d{3}\.\d{3}\.\d{3}\-\d{2})/;
const EXTRACT_MPGO_REGEX_MAT_INI = /^\s*(\d+)\s*\-\s*/;
const EXTRACT_MPGO_REGEX_VALOR = /^\d{1,3}(?:\.\d{3})*(?:,\d{2})$/;
const MPGO_BLACKLIST_RODAPE =
  /(SISTEMA DIGITAL DE CONSIGNAÇÕES|ESTE RELATÓRIO NÃO É VÁLIDO|Relatório de Movimento Financeiro|Consignatária:|Órgão:|Sub-órgão:|Unidade:|Natureza|Estabelecimento|ÓRGÃO:\s|CORRESP\.|SERVIÇO|Nº ADE|DATA INC\.|SIT\. DO CONTRATO|CAT\. DO|Subtotal\s+de\s+registros|Subtotal\s+vlr|Sub\s*total|SOMA\s*TOTAL|Total\s+geral|Totais\s+gerais|Página\s+\d+\s+de\s+\d+|Relatório\s+emitido\s+em|Sistema\s+de\s+Consignações)/i;
const MPGO_BLACKLIST_TOTAL =
  /^\s*(total|totais|somatório|sumário|resumo|observação|observa[çc][õo]es|legenda|subtotal|sub\s*total|soma\s+total|total\s+geral|totais\s+gerais)\b/i;

const CANONICAL_MPGO_HEADER = [
  'CPF',
  'Nome',
  'Matricula',
  'Copetencia',
  'Valor Parcela',
  'Orgao',
  'Corresp',
  'Servico',
  'No ADE',
  'Data Inc',
  'Data Ini',
  'Data Fim',
  'Vlr. ADE',
  'PRZ',
  'PGT',
  'No Parc',
  'Sit. Contrato',
  'Sit. Parcela',
  'Cat. Servidor',
];

const DEFAULT_ORGAO_FIXO = 'MPGO - Ministério Público do Estado de Goiás';
const DEFAULT_PARSER_VERSION = 'v2-posicional-12-offsets';

function _extrairCPF(t: string): string {
  const m = EXTRACT_MPGO_REGEX_CPF.exec(t || '');
  return m ? m[1] : '';
}
function _extrairMat(t: string): string {
  const m = EXTRACT_MPGO_REGEX_MAT_INI.exec(t || '');
  return m ? m[1] : '';
}
function _extrairNomeLinha1(t: string): string {
  const m = /^\s*\d+\s*\-\s*(.*)$/.exec(t || '');
  return (m ? m[1] : (t || '')).trim().replace(/\s*\-\s*$/, '');
}
function _extrairNomeLinha2AntesCPF(t: string): string {
  const cpf = _extrairCPF(t);
  if (!cpf) return (t || '').trim().replace(/\s*\-\s*$/, '');
  const idx = t.indexOf(cpf);
  return t.slice(0, idx).replace(/\s*\-\s*$/, '').trim();
}
function _splitDataIncIni(s: string): [string, string] {
  const str = String(s || '').trim();
  const m = /^(\d{2}\/\d{2}\/\d{4})\s*(.*)$/.exec(str);
  if (!m) return [str, ''];
  const inc = m[1];
  const resto = m[2].trim();
  const mini = /^(\d{2}\/\d{4})/.exec(resto);
  return [inc, mini ? mini[1] : resto];
}
function _splitValorPrz(s: string): [string, string] {
  const str = String(s || '').trim();
  const m = /^(\d{1,3}(?:\.\d{3})*(?:,\d{2}))\s*(.*)$/.exec(str);
  if (!m) return [str, ''];
  const v = m[1];
  const prz = (m[2].trim().split(/\s+/)[0] || '');
  return [v, prz];
}
function _colSlice(ln: string, off: number, nxt: number, ml: number): string {
  const nxtF = typeof nxt === 'number' && !isNaN(nxt) ? nxt : typeof ml === 'number' ? ml : (ln || '').length;
  return ((ln || '').slice(typeof off === 'number' && !isNaN(off) ? off : 0, nxtF)).trim();
}
function _isLinhaDadosPrincipal(ln: string): boolean {
  if (!ln || !ln.trim()) return false;
  if (MPGO_BLACKLIST_TOTAL.test(ln)) return false;
  if (!EXTRACT_MPGO_REGEX_MAT_INI.test(ln)) return false;
  if (!/\d{2}\/\d{2}\/\d{4}/.test(ln)) return false;
  if (!/\d{1,3}(?:\.\d{3})*(?:,\d{2})/.test(ln)) return false;
  return true;
}

export const RecursoMpgoPlugin: ConsignadoImportPlugin = {
  pluginId: 'recurso_mpgo',
  pluginVersion: DEFAULT_PARSER_VERSION,

  matches(kindLower: string): boolean {
    return kindLower === 'recurso_mpgo';
  },

  async parse(
    buffer: Buffer,
    ctx: ConsignadoImportPluginContext,
  ): Promise<ConsignadoImportPluginParseResult> {
    const cfg = (ctx?.profilePluginConfig ?? {}) as Record<string, unknown>;
    const orgaoFixo =
      typeof cfg.orgaoFixo === 'string' && cfg.orgaoFixo.trim()
        ? cfg.orgaoFixo
        : DEFAULT_ORGAO_FIXO;
    const forceCliFallback = cfg.forceCliPdfToTextFallback !== false;
    const dbg = ctx?.__dbg;

    const fileNameStr = String(ctx.fileName ?? '');
    if (dbg?.report) {
      dbg.report(
        'MPGO/H1',
        'recurso_mpgo.plugin.ts:parse:init',
        'PLUGIN MPGO iniciando parse v2-posicional (arquivo isolado)',
        {
          fileName: fileNameStr,
          fileSizeBytes: buffer?.length ?? 0,
          forceCliFallback,
          orgaoFixo,
        },
      );
    }

    let pdfText = '';
    let metodoUsado = 'extractPdf-default';

    if (forceCliFallback && typeof ctx.cliPdfTextFallback === 'function') {
      try {
        const fbRes = await ctx.cliPdfTextFallback(buffer);
        if (fbRes && typeof (fbRes as { text?: string }).text === 'string') {
          const fbTxt = String((fbRes as { text: string }).text ?? '');
          if (fbTxt.replace(/\s+/g, '').length > 500) {
            pdfText = fbTxt;
            metodoUsado = 'cliPdfTextFallback-pdftotext-layout-FORCADO-PLUGIN';
          }
        }
      } catch (fbErr) {
        if (dbg?.report) {
          dbg.report(
            'MPGO/H1b',
            'recurso_mpgo.plugin.ts:parse:cli-fallback',
            'W: cliPdfTextFallback falhou, usando extractPdf original',
            {
              err:
                fbErr instanceof Error ? fbErr.message : String(fbErr ?? ''),
            },
          );
        }
      }
    }

    if (!pdfText && typeof ctx.extractPdf === 'function') {
      try {
        const def = await ctx.extractPdf(buffer);
        if (def && typeof def?.text === 'string') pdfText = def.text;
      } catch {
        pdfText = '';
      }
    }

    if (!pdfText) {
      const tmpIn = path.join(
        fs.realpathSync(os.tmpdir()),
        `mpgo-plugin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.pdf`,
      );
      const tmpOut = tmpIn.replace(/\.pdf$/, '.txt');
      try {
        fs.writeFileSync(tmpIn, buffer);
        if (typeof ctx?.runProcess === 'function') {
          const r = await ctx.runProcess(
            'pdftotext',
            ['-layout', '-enc', 'UTF-8', tmpIn, tmpOut],
            null,
            { timeoutMs: 60_000 },
          );
          if (r.exitCode === 0 && fs.existsSync(tmpOut)) {
            pdfText = fs.readFileSync(tmpOut, 'utf8');
            metodoUsado = 'pdftotext-manual-fallback-plugin';
          }
        }
      } catch {
        pdfText = '';
      } finally {
        try { fs.unlinkSync(tmpIn); } catch { /* ignore */ }
        try { fs.unlinkSync(tmpOut); } catch { /* ignore */ }
      }
    }

    const allLines = (pdfText ?? '').split(/\r?\n/g);
    const nLinhas = allLines.length;
    if (dbg?.report) {
      dbg.report(
        'MPGO/H2',
        'recurso_mpgo.plugin.ts:parse:pdf-extracted',
        'Texto PDF extraído no plugin',
        {
          totalLines: nLinhas,
          metodo: metodoUsado,
          textoChars: pdfText.length,
          sampleFirst12: allLines.slice(0, 12),
        },
      );
    }

    const linhasPrincipaisIdx: number[] = [];
    for (let i = 0; i < nLinhas; i++) {
      if (_isLinhaDadosPrincipal(allLines[i] || '')) {
        linhasPrincipaisIdx.push(i);
      }
    }
    if (dbg?.report) {
      dbg.report(
        'MPGO/H2b',
        'recurso_mpgo.plugin.ts:parse:posicional-deteccao',
        'Detecção linhas dados principais',
        { qtde: linhasPrincipaisIdx.length },
      );
    }

    let offsets: number[] = [];
    let maxLen = 0;
    if (linhasPrincipaisIdx.length >= 3) {
      const N = Math.min(30, linhasPrincipaisIdx.length);
      const sample = linhasPrincipaisIdx
        .slice(0, N)
        .map((i) => allLines[i] || '');
      maxLen = Math.max(...sample.map((l) => l.length));
      const nonEmpty = new Set<number>();
      for (let p = 0; p < maxLen; p++) {
        for (const ln of sample) {
          const c = (ln[p] || ' ');
          if (c !== ' ') {
            nonEmpty.add(p);
            break;
          }
        }
      }
      const sorted = Array.from(nonEmpty).sort((a, b) => a - b);
      for (let i = 0; i < sorted.length; i++) {
        if (i === 0) {
          offsets.push(sorted[i]);
          continue;
        }
        if (sorted[i] - sorted[i - 1] > 2) offsets.push(sorted[i]);
      }
    }

    const headersMpgo = CANONICAL_MPGO_HEADER.slice();
    const rowsOut: Array<Record<string, unknown>> = [];
    let lastOffsetsLen = offsets.length;

    for (let r = 0; r < linhasPrincipaisIdx.length; r++) {
      const iL1 = linhasPrincipaisIdx[r];
      const l1 = allLines[iL1] || '';
      const iL2 = iL1 + 1;
      const l2 = allLines[iL2] || '';
      const proxL1 =
        r + 1 < linhasPrincipaisIdx.length
          ? linhasPrincipaisIdx[r + 1]
          : nLinhas;
      const verticais: string[] = [];
      for (let k = iL2 + 1; k < proxL1; k++) {
        const lk = allLines[k] || '';
        if (!lk.trim()) continue;
        if (MPGO_BLACKLIST_RODAPE.test(lk)) continue;
        if (MPGO_BLACKLIST_TOTAL.test(lk)) continue;
        verticais.push(lk);
      }
      let colsL1: string[] = [];
      let colsL2: string[] = [];
      if (offsets.length > 0) {
        colsL1 = offsets.map((off, idx) =>
          _colSlice(l1, off, offsets[idx + 1], maxLen),
        );
        colsL2 = offsets.map((off, idx) =>
          _colSlice(l2, off, offsets[idx + 1], maxLen),
        );
      } else {
        colsL1 = l1
          .split(/\s{2,}/)
          .map((s) => String(s || '').trim())
          .filter(Boolean);
        colsL2 = l2
          .split(/\s{2,}/)
          .map((s) => String(s || '').trim())
          .filter(Boolean);
        if (colsL1.length > lastOffsetsLen) lastOffsetsLen = colsL1.length;
      }

      const colServL1 = colsL1[0] || '';
      const matricula = _extrairMat(colServL1);
      const nomeL1 = _extrairNomeLinha1(colServL1);
      let cpf = '';
      let nomeL2 = '';
      for (const c of colsL2) {
        const cc = _extrairCPF(c);
        if (cc) {
          cpf = cc;
          nomeL2 = _extrairNomeLinha2AntesCPF(c);
          break;
        }
      }
      if (!cpf) {
        cpf = _extrairCPF(l2);
        if (cpf) nomeL2 = _extrairNomeLinha2AntesCPF(l2);
      }
      const nomeCompleto =
        [nomeL1, nomeL2].filter(Boolean).join(' ').trim() || colServL1.trim();

      let colDataIdx = -1;
      for (let c = 1; c < colsL1.length; c++) {
        if (/\d{2}\/\d{2}\/\d{4}\s+\d{2}\/\d{4}/.test(colsL1[c] || '')) {
          colDataIdx = c;
          break;
        }
      }
      let colValorIdx = -1;
      for (let c = 1; c < colsL1.length; c++) {
        if (/\d{1,3}(?:\.\d{3})*,\d{2}\s+\d{1,3}$/.test(colsL1[c] || '')) {
          colValorIdx = c;
          break;
        }
      }
      const corresp = colsL1[1] || '';
      const servico = colsL1[2] || '';
      const noAde =
        colDataIdx >= 3 && colDataIdx - 1 >= 3
          ? colsL1[colDataIdx - 1] || ''
          : colsL1[3] || servico;
      const [dataInc, dataIni] =
        colDataIdx >= 0
          ? _splitDataIncIni(colsL1[colDataIdx] || '')
          : ['', ''];
      const dataFim =
        colDataIdx >= 0 ? colsL1[colDataIdx + 1] || '' : '';
      const vlrAde =
        colValorIdx >= 0 ? colsL1[colValorIdx - 1] || '' : '';
      const [valorParcela, prz] =
        colValorIdx >= 0
          ? _splitValorPrz(colsL1[colValorIdx] || '')
          : ['', ''];
      const pgt =
        colValorIdx >= 0 ? colsL1[colValorIdx + 1] || '' : '';
      const noParc =
        colValorIdx >= 0 ? colsL1[colValorIdx + 2] || '' : '';
      const sitContrato =
        colValorIdx >= 0 ? colsL1[colValorIdx + 3] || '' : '';
      const sitParcela =
        colValorIdx >= 0 ? colsL1[colValorIdx + 4] || '' : '';
      const catServL1 =
        colValorIdx >= 0
          ? colsL1[colValorIdx + 5] || colsL1[colsL1.length - 1] || ''
          : colsL1[colsL1.length - 1] || '';
      const catServL2 = colsL2
        .filter((c, idx) => {
          if (!c) return false;
          if (_extrairCPF(c)) return false;
          return true;
        })
        .join(' ')
        .trim();
      const ultimaOff = offsets.length > 0 ? offsets[offsets.length - 1] : 0;
      const vertTxt = verticais
        .map((l) =>
          (ultimaOff > 0 ? (l.slice(ultimaOff) || l) : l).trim(),
        )
        .filter((s) => s && !MPGO_BLACKLIST_RODAPE.test(s))
        .join(' ')
        .trim();
      const catServidorCompleto =
        [catServL1, catServL2, vertTxt].filter(Boolean).join(' ').trim();

      const looksOk =
        EXTRACT_MPGO_REGEX_CPF.test(cpf) &&
        EXTRACT_MPGO_REGEX_VALOR.test((valorParcela || '').replace(/\s+/g, ''));
      if (!looksOk) {
        if (dbg?.report) {
          dbg.report(
            'MPGO/SKIP-' + String(r),
            'recurso_mpgo.plugin.ts:parse:skip-row',
            'Skip looksLike=false',
            {
              i: r,
              CPF: cpf,
              VP: valorParcela,
              mat: matricula,
              nome: String(nomeCompleto || '').slice(0, 40),
              cols: colsL1.slice(0, 8),
            },
          );
        }
        continue;
      }

      const row: Record<string, unknown> = {
        CPF: cpf,
        Nome: nomeCompleto || null,
        Matricula: matricula || null,
        Copetencia: null,
        'Valor Parcela': valorParcela || null,
        Orgao: orgaoFixo || null,
        Corresp: corresp || null,
        Servico: servico || null,
        'No ADE': noAde || servico || null,
        'Data Inc': dataInc || null,
        'Data Ini': dataIni || null,
        'Data Fim': dataFim || null,
        'Vlr. ADE': vlrAde || null,
        PRZ: prz || null,
        PGT: pgt || null,
        'No Parc': noParc || null,
        'Sit. Contrato': sitContrato || null,
        'Sit. Parcela': sitParcela || null,
        'Cat. Servidor': catServidorCompleto || null,
        __pdf_source_file: fileNameStr,
      };
      rowsOut.push(row);
    }

    const topHeaderLines = allLines.slice(
      0,
      Math.max(0, linhasPrincipaisIdx[0] ?? 30),
    );
    if (dbg?.report) {
      dbg.report(
        'MPGO/H3',
        'recurso_mpgo.plugin.ts:parse:resultado',
        'Resultado parse plugin MPGO (isolado)',
        {
          offsetsCount: offsets.length,
          offsets,
          rowsCount: rowsOut.length,
          linhasPrincipais: linhasPrincipaisIdx.length,
          sampleFirst5: rowsOut.slice(0, 5).map((r) => ({
            CPF: r['CPF'],
            Mat: r['Matricula'],
            Nome: String(r['Nome'] ?? '').slice(0, 45),
            VP: r['Valor Parcela'],
            PRZ: r['PRZ'],
            DInc: r['Data Inc'],
            Orgao: String(r['Orgao'] ?? '').slice(0, 40),
          })),
        },
      );
    }

    return {
      headers: headersMpgo,
      rows: rowsOut,
      extractedCompetenciaMmAaaa: null,
      topHeaderLines,
      skipAliases: true,
      skipWhitelist: true,
      overrideCompetenciaFileNameFallbacks: false,
    };
  },
};

export default RecursoMpgoPlugin;
