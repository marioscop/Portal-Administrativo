/**
 * Debug pipeline completo Recurso TRT (Modelos\TRT-JULHO-2026.xlsx)
 * x LINHA REFERENCIA tabela SQLite Recurso TRT rowid=2 (Cop 07/2026)
 *
 * Mapeamento esperado Excel coluna → Banco coluna:
 * Excel: Funcionário          → Banco: Nome (UPPER, trim)
 * Excel: CPF                  → Banco: CPF (máscara 000.000.000-00)
 * Excel: (cabeçalho Produto)  → Banco: Desc Finalidade ("CREDITO CONSIGNADO" se Produto=EMPRESTIMO; else valor)
 * Excel: Contrato CGA         → Banco: Contrato (NORMALIZADO BR 138157 → 138,157)
 * Excel: Parcela Atual        → Banco: N Parcela
 * Excel: Quantidade Parcelas  → Banco: Qtd Parcelas
 * Excel: (não tem no Excel, fallback) → Banco: Vencimento (se mês 07 → 26/07/2001 igual ref)
 * Excel: (não tem no Excel, fallback) → Banco: Critério de Débito ("Folha Pagto" se Situação=DE else valor)
 * Excel: Valor da parcela     → Banco: Valor Parcela ("R$ XX.XX" decimal PONTO)
 * Excel: Competência MÊS DO ARQUIVO (JULHO → 07/2026) → Banco: Copetencia
 * Excel: TODAS as 16 colunas  → Banco: 16 colunas EXTRAS (mesmos nomes) preenchidas AGORA
 */
const xlsx = require('xlsx');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

function maskCpf(cpf) {
  const dig = String(cpf || '').replace(/\D/g, '').padStart(11, '0');
  if (dig.length !== 11) return String(cpf || '').trim();
  return dig.slice(0,3)+'.'+dig.slice(3,6)+'.'+dig.slice(6,9)+'-'+dig.slice(9,11);
}
function normalizeContratoBr(c) {
  // 138157 → 138,157 (formato milhar BR com virgula, estilo 141,132)
  if (c === null || c === undefined || c === '') return '';
  const s = String(c).trim().replace(/[^\d,.-]/g,'');
  const dig = s.replace(/[^\d]/g,'');
  if (!dig) return '';
  const intPart = BigInt(dig).toString();
  // separador de milhar a cada 3 da direita
  let out = '';
  let cnt = 0;
  for (let i=intPart.length-1;i>=0;i--) {
    if (cnt && cnt%3===0) out=','+out;
    out=intPart[i]+out; cnt++;
  }
  return out;
}
function formatValorParcela(v) {
  if (v===null||v===undefined||v==='') return '';
  let s = String(v).trim().replace(/[^\d,.-]/g,'');
  if (!s) return '';
  const hasComma = s.includes(',');
  if (hasComma) s = s.replace(/\./g,'').replace(',','.'); // 705,71 → 705.71
  const n = Number(s);
  if (!isFinite(n)) return 'R$ ' + s;
  return 'R$ ' + n.toFixed(2);
}
function extraiCopetenciaDeNomeArquivo(fileName, tipo) {
  // MES DO ARQUIVO (igual referência TRT rowid=2 → mês julho = 07/2026. NÃO SISBR, NÃO +1!)
  const s = String(fileName || '');
  const months = [
    ['janeiro','01'],['fevereiro','02'],['marco','03'],['março','03'],['abril','04'],['maio','05'],['junho','06'],['julho','07'],['agosto','08'],['setembro','09'],['outubro','10'],['novembro','11'],['dezembro','12'],
    ['jan','01'],['fev','02'],['abr','04'],['mai','05'],['jun','06'],['jul','07'],['ago','08'],['set','09'],['out','10'],['nov','11'],['dez','12']
  ];
  const low = s.toLowerCase();
  let mm = null, yy = null;
  for (const m of months) if (low.includes(m[0])) { mm = m[1]; break; }
  const mY = s.match(/(20\d{2})/);
  if (mY) yy = mY[1];
  if (!mm) { // fallback: numerico no nome
    const m = s.match(/(?:^|[^\d])(0[1-9]|1[0-2])(?:[-_\s])(20\d{2})(?:[^\d]|$)/);
    if (m) { mm = m[1]; yy = m[2]; }
  }
  if (mm && yy) return mm+'/'+yy;
  return '';
}
function extraiVencimentoPadrao(copetenciaMMYYYY) {
  // da linha de referencia: Cop 06/2026 → 26/06/2001. Cop 07/2026 → 26/07/2001.
  // sempre dia 26 + MÊS da Copetencia + ANO 2001 (fixo histórico)
  if (!copetenciaMMYYYY) return '';
  const p = copetenciaMMYYYY.split('/'); if (p.length!==2) return '';
  const mm = p[0]; const yy = '2001'; // fixo 2001 por referencia
  return '26/'+mm+'/'+yy;
}

(async () => {
  const ROOT = path.resolve(__dirname, '..');
  const modeloPath = path.join(ROOT, 'Modelos', 'TRT-JULHO-2026.xlsx');
  const sqlitePath = path.resolve(__dirname, 'data', 'consignado.sqlite');
  const fileName = 'TRT-JULHO-2026.xlsx';

  console.log('=========== [1/3] Extraindo Excel:', modeloPath, '===========');
  const wb = xlsx.readFile(modeloPath, { cellDates: true, dense: true, raw: true });
  const sh = wb.Sheets[wb.SheetNames[0]];
  const rowsHeader1 = xlsx.utils.sheet_to_json(sh, { header: 1, defval: null, raw: false, dateNF: 'dd/mm/yyyy' });
  const cabecalhos = (rowsHeader1[0] || []).map((c,i) => String(c ?? 'col_'+i).replace(/^[?\s]+|[?\s]+$/g,''));
  console.log('  Cabeçalhos Excel limpos (16 colunas):');
  cabecalhos.forEach((c,i)=>console.log('    ['+i+']', JSON.stringify(c)));

  // header de linha util (rowidx base0 = 1). Converter para array de objetos
  const objRows = xlsx.utils.sheet_to_json(sh, { defval: null, raw: false, dateNF: 'dd/mm/yyyy' });
  console.log('  Total linhas úteis (sheet_to_json objetos) =', objRows.length);

  console.log('\n=========== [2/3] Montando SAÍDA pipeline (igual linha referência rowid=2) ===========');
  // Pegar primeira linha útil (LUIZ EDUARDO)
  const r = objRows[0];
  // Normalizar chaves de r com os cabeçalhos limpos
  const rx = {};
  Object.keys(r || {}).forEach((k) => { const kLimpo = String(k).replace(/^[?\s]+|[?\s]+$/g,''); rx[kLimpo] = r[k]; });
  console.log('  Excel linha 1 raw (chaves limpas):');
  Object.entries(rx).forEach(([k,v])=>console.log('    '+k+' =', JSON.stringify(v)));

  // === 10 colunas PRINCIPAIS (alinhar com referência rowid 2) ===
  const Nome = (rx['Funcionário'] || rx['Funcionario'] || '').toString().trim().replace(/\s+/g,' ').toUpperCase();
  const CPF  = maskCpf(rx['CPF']);
  const Copetencia = extraiCopetenciaDeNomeArquivo(fileName);
  let DescFinalidade = 'CREDITO CONSIGNADO'; // default por referência
  const produto = (rx['Produto']||'').toString().toUpperCase();
  if (produto && produto !== 'EMPRESTIMO') DescFinalidade = produto.trim();
  const Contrato = normalizeContratoBr(rx['Contrato CGA']);
  const NParcela = (rx['Parcela Atual'] === null || rx['Parcela Atual'] === undefined) ? '' : String(Math.round(Number(String(rx['Parcela Atual']).replace(/[^\d]/g,'')||0)));
  const QtdParcelas = (rx['Quantidade de Parcelas'] === null || rx['Quantidade de Parcelas'] === undefined) ? '' : String(Math.round(Number(String(rx['Quantidade de Parcelas']).replace(/[^\d]/g,'')||0)));
  const Vencimento = extraiVencimentoPadrao(Copetencia);
  let CriterioDebito = 'Folha Pagto'; // default ref (Situacao = DE = Debito Efetivado)
  const sit = (rx['Situação'] || rx['Situacao'] || '').toString().toUpperCase();
  if (sit && sit !== 'DE') CriterioDebito = sit.trim();
  const ValorParcela = formatValorParcela(rx['Valor da parcela']);

  console.log('\n  === 10 COLUNAS PRINCIPAIS SAÍDA (esperado === linha referência rowid=2): ===');
  const esperado = {
    Nome: 'LUIZ EDUARDO DA SILVA PARAGUASSU',
    CPF: '371.344.771-34',
    Copetencia: '07/2026',
    'Desc Finalidade': 'CREDITO CONSIGNADO',
    Contrato: '138,157',
    'N Parcela': '58',
    'Qtd Parcelas': '96',
    Vencimento: '26/07/2001',
    'Critério de Débito': 'Folha Pagto',
    'Valor Parcela': 'R$ 705.71'
  };
  const saida = {
    Nome, CPF, Copetencia,
    'Desc Finalidade': DescFinalidade,
    Contrato,
    'N Parcela': NParcela,
    'Qtd Parcelas': QtdParcelas,
    Vencimento,
    'Critério de Débito': CriterioDebito,
    'Valor Parcela': ValorParcela
  };
  let match10 = 0;
  for (const k of Object.keys(esperado)) {
    const ok = esperado[k] === saida[k];
    if (ok) match10++;
    console.log('    ' + (ok?'✅':'❌') + ' ' + k.padEnd(20) + ' SAIDA=' + JSON.stringify(saida[k]).padEnd(40) + ' ESPERADO=' + JSON.stringify(esperado[k]));
  }
  console.log('\n  Match 10 colunas principais =', match10, '/ 10 (esperado 10/10)');

  // === 16 COLUNAS EXTRAS (nomes iguais Excel cabeçalhos → colunas adicionais Recurso TRT CID 15-29) ===
  const extras = {};
  cabecalhos.forEach((c) => { extras[c] = (rx[c] === null || rx[c] === undefined) ? '' : String(rx[c]); });
  console.log('\n  === 16 COLUNAS EXTRAS SAÍDA (agora NÃO mais NULL, preenchidas!): ===');
  // Schema do banco tem alguns com acentuação normalizada: "Identificação do Desconto", "Vínculo/No Pensionista", "Órgão", etc.
  const bancosExtrasKeys = [
    'Identificação do Desconto','Produto','TEC','Contrato CGA','Matrícula','Vínculo/No Pensionista','Órgão','Funcionário','Parcela Atual','Quantidade de Parcelas','Valor da parcela','Valor de Desconto','Código da Verba','Situação','Motivo de Não Desconto','Funcionario','Vínculo/Nº Pensionista'
  ];
  for (const k of cabecalhos) {
    console.log('    🟢 ' + k.padEnd(30) + ' = ' + JSON.stringify(extras[k]).slice(0, 80));
  }

  // === Montar objeto FINAL de insert (30 colunas, todas as colunas do schema PRAGMA) ===
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(sqlitePath);
  const db = new SQL.Database(buf);
  const prag = db.exec("PRAGMA table_info('Recurso TRT');");
  const colunasBanco = prag[0].values.map(c => c[1]);
  const final = {};
  colunasBanco.forEach((col) => final[col] = '');
  // 10 principais
  Object.keys(saida).forEach(k => { final[k] = saida[k]; });
  // 14 colunas vazias COL_10-14
  for (let i = 10; i <= 14; i++) final['COL_'+i] = '';
  // 16 extras: casar nome de cabecalho limpo com coluna tabela (fuzzy tolerancia acento)
  cabecalhos.forEach((cExcel) => {
    const v = extras[cExcel];
    // match direto?
    let found = colunasBanco.find((b) => b === cExcel);
    if (!found) {
      // normalize remover acentos / "Nº"→"No"
      const norm = (s) => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[oº]/g,'o').replace(/\s+/g,' ').trim().toLowerCase();
      found = colunasBanco.find((b) => norm(b) === norm(cExcel));
    }
    if (found) { final[found] = v; }
    else { console.log('    ⚠️  Excel cabeçalho sem match no schema Banco:', JSON.stringify(cExcel)); }
  });
  // CASO ESPECIAL: Banco tem 2 colunas com nome parecido — "Funcionário" (Banco CID 22) vs Excel "Funcionário" já = Nome.
  // Banco CID 22 = "Funcionário" (nome original) — preencher com Nome também
  if (final['Funcionário'] === undefined || final['Funcionário'] === '') final['Funcionário'] = Nome;
  if (final['Funcionario'] === undefined || final['Funcionario'] === '') final['Funcionario'] = Nome;

  console.log('\n=========== [3/3] LINHA FINAL INSERT (30 COLUNAS schema Recurso TRT) — COMPARATIVO ROWID=2 REFERENCIA ===========');
  // Carregar ref rowid=2
  const refRow = db.exec("SELECT * FROM 'Recurso TRT' WHERE rowid=2;");
  const refObj = {};
  if (refRow[0]) { refRow[0].columns.forEach((c,i)=>refObj[c]=refRow[0].values[0][i] ?? ''); }
  let totalMatch = 0, totalNaoVaziosNovos = 0;
  colunasBanco.forEach((col) => {
    const vNovo = final[col] === undefined ? '' : String(final[col]);
    const vRef  = refObj[col] === undefined || refObj[col] === null ? '' : String(refObj[col]);
    const igual = (vNovo === vRef);
    if (igual) totalMatch++;
    const colsDiff = ['COL_10','COL_11','COL_12','COL_13','COL_14','Identificação do Desconto','Produto','TEC','Contrato CGA','Matrícula','Vínculo/No Pensionista','Órgão','Funcionário','Parcela Atual','Quantidade de Parcelas','Valor da parcela','Valor de Desconto','Código da Verba','Situação','Motivo de Não Desconto'];
    const esperadoDiferente = colsDiff.includes(col);
    if (vNovo !== '' && esperadoDiferente) totalNaoVaziosNovos++;
    const marker = igual ? '✅' : (esperadoDiferente ? '🆕' : '❌');
    console.log('  ' + marker + ' ' + col.padEnd(28) + ' NOVO=' + JSON.stringify(vNovo).padEnd(45) + ' REF(rowid2)=' + JSON.stringify(vRef));
  });
  console.log('\n  Total colunas IGUAIS a ref rowid=2 (10 principais + 5 COL vazias) =', totalMatch, '/ 30');
  console.log('  Total colunas 16 extras (CID 15-29) AGORA NAO VAZIOS (antes NULL) =', totalNaoVaziosNovos, '/ 16');
  if (match10 === 10 && totalNaoVaziosNovos >= 15) {
    console.log('\n🎯 PIPELINE RECURSO TRT OK 10/10 principais + 15+ extras preenchidas.');
  } else {
    console.log('\n⚠️  Falta ajustar pipeline.');
  }
  db.close();
})();
