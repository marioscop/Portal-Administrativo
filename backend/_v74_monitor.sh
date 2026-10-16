#!/bin/bash
cd "/var/www/html/Portal-Administrativo/backend"
SNAPSHOT_SCRIPT='const initSqlJs = require("/var/www/html/Portal-Administrativo/backend/node_modules/sql.js/dist/sql-wasm.js");
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
});'
echo "$SNAPSHOT_SCRIPT" > "/var/www/html/Portal-Administrativo/backend/_v74_snap.cjs"
export DB_COPY=/tmp/v74_snap.sqlite
echo "sync_done_exist=$([ -f /tmp/v74_sync_done ] && echo 1 || echo 0)"
if [ -f /tmp/v74_sync_done ]; then
  echo "--- ultima resposta sync ---"
  tail -200 /tmp/v74_sync.stdout
fi
echo "--- pm2 status ---"
/usr/bin/pm2 status portal-administrativo-backend 2>&1 | head -6
echo "--- pm2 ultima linha logs erro ---"
/usr/bin/pm2 logs portal-administrativo-backend --nostream --lines 5 2>&1 | grep -E "DEAD|Database|insertedRows|scanner|Graph|rowsInserted|sucesso|erro|ERR" | tail -15
echo "--- SNAPSHOT cp (safe, nunca toca original) ---"
cp -f "/var/www/html/Portal-Administrativo/backend/data/consignado.sqlite" /tmp/v74_snap.sqlite
ls -la /tmp/v74_snap.sqlite
/usr/bin/node "/var/www/html/Portal-Administrativo/backend/_v74_snap.cjs"
