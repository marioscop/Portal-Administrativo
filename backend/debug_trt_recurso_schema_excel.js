const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx'); // ja esta no projeto? Verificamos

(async () => {
  const ROOT = path.resolve(__dirname, '..');
  const modeloPath = path.join(ROOT, 'Modelos', 'TRT-JULHO-2026.xlsx');
  const sqlitePath = path.resolve(__dirname, 'data', 'consignado.sqlite');

  console.log('=== (A) Arquivo Modelos TRT-JULHO-2026.xlsx ===');
  if (!fs.existsSync(modeloPath)) { console.log('❌ NÃO EXISTE: ' + modeloPath); console.log('Listar Modelos:'); console.log(fs.readdirSync(path.join(ROOT, 'Modelos')).join('\n')); process.exit(1); }
  console.log('✅ Existe. Tamanho =', fs.statSync(modeloPath).size, 'bytes');
  try {
    const wb = xlsx.readFile(modeloPath, { cellDates: true, dense: true });
    console.log('  Sheets:', wb.SheetNames.join(' | '));
    const first = wb.SheetNames[0];
    const sh = wb.Sheets[first];
    const rows = xlsx.utils.sheet_to_json(sh, { header: 1, defval: null, raw: false, dateNF: 'dd/mm/yyyy' });
    console.log('  Linhas totais (sheet1) =', rows.length);
    console.log('\n  Primeiras 15 linhas brutas (cabeçalhos + primeiros dados):');
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const linha = rows[i].map((c) => c === null || c === undefined ? '' : String(c).slice(0, 40));
      console.log('  [' + (i + 1) + '] | ' + linha.join(' || '));
    }
    const headRowIdx = rows.findIndex((r) => Array.isArray(r) && r.some((c) => c && /(nome|cpf|valor|vencimento|parcela|contrato)/i.test(String(c))));
    console.log('\n  Cabeçalho (idx base 0) provável em linha=', headRowIdx + 1, '=>', JSON.stringify(rows[headRowIdx]));
  } catch (e) { console.log('❌ Erro ler xlsx (pode nao ter xlsx instalado): ' + e.message); }

  console.log('\n=== (B) Schema tabela SQLite "Recurso TRT" ===');
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(sqlitePath);
  const db = new SQL.Database(buf);
  const temTabela = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='Recurso TRT';");
  if (!temTabela[0] || temTabela[0].values.length === 0) { console.log('❌ Tabela "Recurso TRT" NÃO EXISTE no SQLite. Listar tabelas com Recurso/TRT:'); db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%Recurso%' ORDER BY name;")[0]?.values.forEach((r) => console.log('  ', r[0])); process.exit(1); }
  const prag = db.exec("PRAGMA table_info('Recurso TRT');");
  console.log('  Colunas tabela Recurso TRT:');
  for (const c of prag[0].values) {
    console.log('  cid=' + c[0] + ' name="' + c[1] + '" type=' + c[2] + ' nn=' + c[3] + ' dflt=' + (c[4] ?? '') + ' pk=' + c[5]);
  }
  const cnt = db.exec("SELECT COUNT(*) FROM 'Recurso TRT';");
  console.log('  COUNT total Recurso TRT =', cnt[0].values[0][0]);
  const cols = prag[0].values.map((c) => `"${c[1]}"`).join(', ');
  const last10 = db.exec(`SELECT rowid, ${cols} FROM 'Recurso TRT' ORDER BY rowid DESC LIMIT 10;`);
  console.log('\n  10 últimas linhas da tabela Recurso TRT (formato referência colunas):');
  const head = last10[0].columns;
  for (const row of last10[0].values) {
    const obj = {};
    head.forEach((cn, i) => obj[cn] = (row[i] === null || row[i] === undefined ? 'NULL' : String(row[i]).slice(0, 50)));
    console.log('  rowid=' + obj.rowid + ' => ' + JSON.stringify(obj));
  }

  console.log('\n=== (C) Perfil já cadastrado id=recurso_trt (tabela import_learning_profiles) ===');
  const pr = db.exec(`SELECT id, kind, match_url_contains, file_name_regex, target_table, substr(options_json,1,600) AS opt, created_at, updated_at FROM import_learning_profiles WHERE id='recurso_trt';`);
  if (pr[0] && pr[0].values.length > 0) {
    const r = pr[0].values[0];
    console.log('  id=' + r[0] + ' kind=' + r[1] + ' CREATED=' + r[6] + ' UPDATED=' + r[7]);
    console.log('  match_url_contains =', r[2]);
    console.log('  file_name_regex   =', r[3]);
    console.log('  target_table      =', r[4]);
    console.log('  options_json      =', r[5]);
  } else {
    console.log('  ⚠️  Nenhum perfil recurso_trt cadastrado na tabela (esperava perfil 2026-06-25).');
  }
  db.close();
})();
