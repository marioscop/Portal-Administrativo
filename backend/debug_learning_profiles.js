const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async () => {
  const SQL = await initSqlJs();
  const sqlitePath = path.resolve(__dirname, 'data', 'consignado.sqlite');
  const buf = fs.readFileSync(sqlitePath);
  const db = new SQL.Database(buf);
  console.log('=== PF2: TABELA import_learning_profiles ===');
  const colunas = db.exec("PRAGMA table_info(import_learning_profiles)");
  console.log('Colunas:');
  for (const c of (colunas[0]?.values || [])) {
    console.log('  cid=%s name=%s type=%s notnull=%s pk=%s', c[0], c[1], c[2], c[3], c[5]);
  }
  const all = db.exec(`SELECT id, kind, match_url_contains, file_name_regex, target_table, substr(options_json, 1, 500) AS opt, created_at, updated_at FROM import_learning_profiles ORDER BY created_at ASC;`);
  if (!all[0]) { console.log('  NENHUM perfil oficial cadastrado! (apenas virtuais runtime)'); process.exit(0); }
  const rows = all[0].values.map((r) => {
    const o = {};
    all[0].columns.forEach((cn, i) => o[cn] = r[i]);
    return o;
  });
  console.log('Total perfis OFICIAIS em tabela =', rows.length);
  for (const r of rows) {
    console.log('\n--- id=' + r.id + ' | kind=' + r.kind + ' | created=' + r.created_at);
    console.log('  match_url_contains =', r.match_url_contains);
    console.log('  file_name_regex   =', r.file_name_regex);
    console.log('  target_table      =', r.target_table);
    console.log('  options_json (500ch) =', r.opt);
  }
  db.close();
})();
