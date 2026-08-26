const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async () => {
  const SQL = await initSqlJs();
  const cwd = process.cwd();
  const dbPath = path.join(cwd, 'data', 'consignado.sqlite');
  if (!fs.existsSync(dbPath)) { console.log('❌ DB não encontrado em '+dbPath); process.exit(12); }
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);
  const rows = db.exec("SELECT id, kind, file_name_regex, target_table, options_json FROM import_learning_profiles WHERE id IN ('extratos_tre_trt_go','extratos_tre_go','extratos_recurso') ORDER BY id ASC;");
  if (!rows[0] || rows[0].values.length === 0) { console.log('❌ NENHUM perfil encontrado.'); process.exit(10); }
  const cols = rows[0].columns;
  for (const r of rows[0].values) {
    const id = String(r[cols.indexOf('id')]);
    const kind = String(r[cols.indexOf('kind')]);
    const regex = String(r[cols.indexOf('file_name_regex')]);
    const target = String(r[cols.indexOf('target_table')]);
    let opts = '';
    try { const raw = JSON.parse(String(r[cols.indexOf('options_json')]||'{}')); opts = Object.entries(raw).filter(([k])=>['isTreExtratoProfile','isJusticaEleitoralTrabalhoProfile','mode','checkDuplicateContent'].includes(k)).map(([k,v])=>k+'='+JSON.stringify(v)).join(' '); } catch {}
    console.log('  [OK] id='+id.padEnd(30)+' kind='+kind.padEnd(15)+' target='+target.padEnd(15)+' regex='+regex.padEnd(42)+' '+opts);
  }
  const found = rows[0].values.find(r => String(r[cols.indexOf('id')]) === 'extratos_tre_trt_go');
  const foundAntigo = rows[0].values.find(r => String(r[cols.indexOf('id')]) === 'extratos_tre_go');
  if (foundAntigo) { console.log('  ⚠️  perfil antigo extratos_tre_go ainda existe (proximo reload PM2 remove). Sem problema.'); }
  if (found) { console.log('  ✅ PERFIL NOVO TRE+TRT SALVO NO SQLITE PRODUÇÃO: extratos_tre_trt_go'); process.exit(0); }
  console.log('  ❌ PERFIL FALTANDO: extratos_tre_trt_go não encontrado');
  process.exit(11);
})();
