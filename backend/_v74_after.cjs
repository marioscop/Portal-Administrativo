
const initSqlJs = require('/var/www/html/Portal-Administrativo/backend/node_modules/sql.js/dist/sql-wasm.js');
const fs = require('fs');
initSqlJs().then(SQL => {
  const buf = fs.readFileSync('/var/www/html/Portal-Administrativo/backend/data/consignado.sqlite');
  const db = new SQL.Database(buf);
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Recurso%' ORDER BY name")[0].values;
  let totalRec = 0;
  for (const [t] of tables) {
    const c = db.exec('SELECT COUNT(*) FROM "' + t + '"')[0].values[0][0];
    console.log(t + ' = ' + c);
    totalRec += c;
  }
  console.log('TOTAL_Recurso_DEPOIS = ' + totalRec);
  console.log('relatorio_consignado = ' + db.exec('SELECT COUNT(*) FROM relatorio_consignado')[0].values[0][0]);
  console.log('L2_neoconsig_DEPOIS = ' + db.exec("SELECT COUNT(*) FROM imported_row_hashes WHERE kind='recurso_neoconsig_demais'")[0].values[0][0]);
  console.log('batches_neoconsig_DEPOIS = ' + db.exec("SELECT COUNT(*) FROM import_batches WHERE kind='recurso_neoconsig_demais'")[0].values[0][0]);
  const batches = db.exec("SELECT batch_id, substr(target_table,1,40), substr(file_name,1,60), substr(mode,1,10), created_at FROM import_batches ORDER BY created_at DESC LIMIT 3")[0]?.values || [];
  console.log('ULTIMOS_BATCHES = ' + JSON.stringify(batches));
  const shalist = db.exec("SELECT key, substr(value,1,120) FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%' ORDER BY key DESC LIMIT 5")[0]?.values || [];
  console.log('SHA256_cfg_SAMPLE = ' + JSON.stringify(shalist));
  console.log('DEPOIS_OK=1');
});
