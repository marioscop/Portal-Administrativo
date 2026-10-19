import * as XLSX from 'xlsx';
import type {
  ConsignadoImportPlugin,
  ConsignadoImportPluginContext,
  ConsignadoImportPluginParseResult,
} from './import-plugin.interface';

// ============================================================
// Plugin ALEGO — planilha mensal (Recuperação de Crédito)
//
// Layout real do arquivo (.xlsx), confirmado nos arquivos de Agosto e Setembro/2026:
//   Documento | Nome Funcionário | Ano | Mês | Evento | Valor
//
// Mapeamento para as colunas canônicas da tabela "Recurso ALEGO":
//   Documento        -> CPF
//   Nome Funcionário -> Nome
//   Evento           -> Desc Finalidade
//   Valor            -> Valor Parcela
//   Copetencia       -> derivada do nome do arquivo (mês + 1)
//                       ex.: ALEGO-AGOSTO-2026.xlsx -> 09/2026
//                            ALEGO-SETEMBRO-2026.xlsx -> 10/2026
//
// As 3 últimas linhas do arquivo são totais/repasse (sem Nome e sem CPF) e são descartadas.
// Isolamento: ativado por profile.recurso_alego.pluginId — não afeta os demais órgãos.
// ============================================================

const CANONICAL_HEADERS = ['Nome', 'CPF', 'Copetencia', 'Desc Finalidade', 'Valor Parcela'];

const MESES_PT = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function normHeader(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Competência a partir do nome do arquivo, com incremento de mês (padrão ALEGO). */
function competenciaFromFileName(fileName: string): string | null {
  const name = normHeader(fileName);
  const mes = MESES_PT.find((m) => name.includes(m));
  const ano = /(20\d{2})/.exec(String(fileName ?? ''));
  if (!mes || !ano) return null;
  let mm = MESES_PT.indexOf(mes) + 2; // índice 0-based + 1 (próximo mês)
  let yy = Number(ano[1]);
  if (mm > 12) {
    mm = 1;
    yy += 1;
  }
  return `${String(mm).padStart(2, '0')}/${yy}`;
}

const RecursoAlegoPlugin: ConsignadoImportPlugin = {
  pluginId: 'recurso_alego',
  pluginVersion: '2026-10-19-v1-alias-competencia-totais',

  matches(kindLower: string, fileName: string): boolean {
    return kindLower === 'recurso_alego' && /alego/i.test(String(fileName ?? ''));
  },

  async parse(
    buffer: Buffer,
    ctx: ConsignadoImportPluginContext,
  ): Promise<ConsignadoImportPluginParseResult> {
    const empty = {
      headers: CANONICAL_HEADERS.slice(),
      rows: [] as Array<Record<string, unknown>>,
      extractedCompetenciaMmAaaa: null,
      topHeaderLines: [] as string[],
      skipAliases: true,
      skipWhitelist: true,
    };

    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    if (!wb.SheetNames?.length) return empty;

    const readAoa = (name: string): unknown[][] => {
      const ws = wb.Sheets[name];
      if (!ws || !ws['!ref']) return [];
      return XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: null,
        blankrows: false,
        raw: false,
        dateNF: 'dd/mm/yyyy',
      }) as unknown[][];
    };

    // Escolhe a aba que contém o cabeçalho do ALEGO (fallback: primeira aba).
    let aoa: unknown[][] = [];
    let sheetName = wb.SheetNames[0];
    for (const name of wb.SheetNames) {
      const candidate = readAoa(name);
      const achou = candidate
        .slice(0, 10)
        .some((r) => Array.isArray(r) && r.map((c) => normHeader(c)).includes('documento'));
      if (achou) {
        aoa = candidate;
        sheetName = name;
        break;
      }
    }
    if (!aoa.length) aoa = readAoa(sheetName);

    // Localiza a linha de cabeçalho ("Documento" / "Nome Funcionário").
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(aoa.length, 10); i += 1) {
      const cells = (aoa[i] ?? []).map((c) => normHeader(c));
      if (cells.includes('documento') || cells.includes('nome funcionario')) {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx < 0) return empty;

    const header = (aoa[headerRowIdx] ?? []).map((c) => normHeader(c));
    const idxOf = (...names: string[]): number => {
      for (const n of names) {
        const i = header.indexOf(n);
        if (i >= 0) return i;
      }
      return -1;
    };
    const iNome = idxOf('nome funcionario', 'nome do funcionario', 'funcionario', 'nome');
    const iCpf = idxOf('documento', 'cpf', 'nr cpf', 'nmr cpf');
    const iEvento = idxOf('evento', 'desc finalidade', 'finalidade');
    const iValor = idxOf('valor', 'valor parcela');

    const competencia = competenciaFromFileName(ctx.fileName);
    const rows: Array<Record<string, unknown>> = [];
    for (let i = headerRowIdx + 1; i < aoa.length; i += 1) {
      const r = (aoa[i] ?? []) as unknown[];
      const get = (idx: number): string => (idx >= 0 ? String(r[idx] ?? '').trim() : '');
      const nome = get(iNome);
      const cpf = get(iCpf);
      // Descarta linhas de total/repasse: não possuem Nome nem CPF.
      if (!nome || !cpf) continue;
      rows.push({
        Nome: nome,
        CPF: cpf,
        Copetencia: competencia,
        'Desc Finalidade': get(iEvento),
        'Valor Parcela': get(iValor),
      });
    }

    return {
      headers: CANONICAL_HEADERS.slice(),
      rows,
      extractedCompetenciaMmAaaa: competencia,
      topHeaderLines: [],
      skipAliases: true,
      skipWhitelist: true,
    };
  },
};

export default RecursoAlegoPlugin;
