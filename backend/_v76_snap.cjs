
const initSqlJs = require('/var/www/html/Portal-Administrativo/backend/node_modules/sql.js/dist/sql-wasm.js');
const fs = require('fs');
initSqlJs().then(SQL => {
  const buf = fs.readFileSync(process.env.DB_COPY);
  const db = new SQL.Database(buf);
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Recurso%' ORDER BY name")[0].values;
  let total = 0;
  for (const [t] of tables) total += db.exec('SELECT COUNT(*) FROM "' + t + '"')[0].values[0][0];
  console.log('SNAP_TOTAL_Recurso = ' + total);
  console.log('SNAP_L2_neoconsig = ' + db.exec("SELECT COUNT(*) FROM imported_row_hashes WHERE kind='recurso_neoconsig_demais'")[0].values[0][0]);
  console.log('SNAP_batches_neoconsig = ' + db.exec("SELECT COUNT(*) FROM import_batches WHERE kind='recurso_neoconsig_demais'")[0].values[0][0]);
  console.log('SNAP_SHA256_cfg_total = ' + (db.exec("SELECT COUNT(*) FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%'")[0].values[0][0]));
  const batch = db.exec("SELECT batch_id, substr(file_name,1,60), target_table, mode, created_at FROM import_batches ORDER BY created_at DESC LIMIT 1")[0]?.values[0] || null;
  console.log('SNAP_ULTIMO_BATCH = ' + JSON.stringify(batch));
});
