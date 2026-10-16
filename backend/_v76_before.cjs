
require('dotenv').config({ path: '/var/www/html/Portal-Administrativo/backend/.env' });
const initSqlJs = require('/var/www/html/Portal-Administrativo/backend/node_modules/sql.js/dist/sql-wasm.js');
const fs = require('fs');
initSqlJs().then(SQL => {
  const buf = fs.readFileSync('/var/www/html/Portal-Administrativo/backend/data/consignado.sqlite');
  const db = new SQL.Database(buf);
  db.run("DELETE FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%' AND (value LIKE '%NEOCONSIG%' OR value LIKE '%TODOS-AGOSTO%')");
  db.run("DELETE FROM imported_row_hashes WHERE kind='recurso_neoconsig_demais'");
  db.run("DELETE FROM import_batch_rows WHERE kind='recurso_neoconsig_demais'");
  db.run("DELETE FROM import_batches WHERE kind='recurso_neoconsig_demais'");
  const pf = db.exec("SELECT id, match_url_contains, file_name_regex, target_table, substr(options_json,1,200) FROM import_learning_profiles WHERE id='recurso_neoconsig_demais'")[0]?.values || [];
  console.log('PERFIL_neoconsig_demais =', JSON.stringify(pf));
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Recurso%' ORDER BY name")[0].values;
  let total = 0;
  for (const [t] of tables) { const c = db.exec('SELECT COUNT(*) FROM "' + t + '"')[0].values[0][0]; console.log(t + ' = ' + c); total += c; }
  console.log('TOTAL_Recurso_ANTES = ' + total);
  console.log('relatorio_consignado = ' + db.exec('SELECT COUNT(*) FROM relatorio_consignado')[0].values[0][0]);
  console.log('L2_neoconsig_demais = ' + db.exec("SELECT COUNT(*) FROM imported_row_hashes WHERE kind='recurso_neoconsig_demais'")[0].values[0][0]);
  console.log('batches_neoconsig_demais = ' + db.exec("SELECT COUNT(*) FROM import_batches WHERE kind='recurso_neoconsig_demais'")[0].values[0][0]);
  console.log('SHA256_cfg_total = ' + (db.exec("SELECT COUNT(*) FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%'")[0].values[0][0]));
  const data = db.export();
  fs.writeFileSync('/var/www/html/Portal-Administrativo/backend/data/consignado.sqlite', Buffer.from(data));
  console.log('DB salvo ANTES OK, STATUS_ANTES_DONE=1');
}).catch(e => { console.error('BEFORE_ERR', e); process.exit(1); });
