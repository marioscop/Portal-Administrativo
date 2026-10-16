const initSqlJs = require("/var/www/html/Portal-Administrativo/backend/node_modules/sql.js/dist/sql-wasm.js");
const fs = require("fs");
initSqlJs().then(SQL => {
  const buf = fs.readFileSync(process.env.DB_COPY);
  const db = new SQL.Database(buf);
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type=\x27table\x27 AND name LIKE \x27Recurso%\x27 ORDER BY name")[0].values;
  let totalRec = 0;
  for (const [t] of tables) {
    totalRec += db.exec("SELECT COUNT(*) FROM \"" + t + "\"")[0].values[0][0];
  }
  console.log("TOTAL_Recurso = " + totalRec);
  console.log("L2_neoconsig = " + db.exec("SELECT COUNT(*) FROM imported_row_hashes WHERE kind=\x27recurso_neoconsig_demais\x27")[0].values[0][0]);
  console.log("batches_neoconsig = " + db.exec("SELECT COUNT(*) FROM import_batches WHERE kind=\x27recurso_neoconsig_demais\x27")[0].values[0][0]);
  console.log("SHA256_cfg_total = " + (db.exec("SELECT key FROM consignado_app_config WHERE key LIKE \x27imported_file_sha256::v1::%\x27")[0]?.values.length || 0));
});
