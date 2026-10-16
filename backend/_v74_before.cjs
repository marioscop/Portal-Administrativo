
const initSqlJs = require('/var/www/html/Portal-Administrativo/backend/node_modules/sql.js/dist/sql-wasm.js');
const fs = require('fs');
initSqlJs().then(SQL => {
  const buf = fs.readFileSync('/var/www/html/Portal-Administrativo/backend/data/consignado.sqlite');
  const db = new SQL.Database(buf);
  // 1) Limpa SHA256 CAMADA-2 NEOCONSIG (qualquer key criada em tentativa anterior falha)
  db.run("DELETE FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%' AND (value LIKE '%NEOCONSIG%' OR value LIKE '%TODOS-AGOSTO%')");
  // 2) Limpa batches/hash recurso_neoconsig_demais (zerar de novo)
  db.run("DELETE FROM imported_row_hashes WHERE kind='recurso_neoconsig_demais'");
  db.run("DELETE FROM import_batch_rows WHERE kind='recurso_neoconsig_demais'");
  db.run("DELETE FROM import_batches WHERE kind='recurso_neoconsig_demais'");
  // 3) Perfil NEOCONSIG
  const pf = db.exec("SELECT id, match_url_contains, file_name_regex, target_table, options_json FROM import_learning_profiles WHERE id='recurso_neoconsig_demais'")[0]?.values || [];
  console.log('PERFIL_neoconsig:', JSON.stringify(pf));
  // 4) Counts
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Recurso%' ORDER BY name")[0].values;
  let totalRec = 0;
  for (const [t] of tables) {
    const c = db.exec('SELECT COUNT(*) FROM "' + t + '"')[0].values[0][0];
    console.log(t + ' = ' + c);
    totalRec += c;
  }
  console.log('TOTAL_Recurso = ' + totalRec);
  console.log('relatorio_consignado = ' + db.exec('SELECT COUNT(*) FROM relatorio_consignado')[0].values[0][0]);
  console.log('L2_hashes_neoconsig = ' + db.exec("SELECT COUNT(*) FROM imported_row_hashes WHERE kind='recurso_neoconsig_demais'")[0].values[0][0]);
  console.log('batches_neoconsig = ' + db.exec("SELECT COUNT(*) FROM import_batches WHERE kind='recurso_neoconsig_demais'")[0].values[0][0]);
  const cfgSha = db.exec("SELECT key, substr(value,1,80) FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%'");
  console.log('SHA256_cfg_total = ' + (cfgSha[0]?.values.length || 0));
  console.log('SHA256_cfg_sample = ' + JSON.stringify(cfgSha[0]?.values || []));
  // Save changes
  const data = db.export();
  fs.writeFileSync('/var/www/html/Portal-Administrativo/backend/data/consignado.sqlite', Buffer.from(data));
  console.log('DB salvo ANTES OK');
  console.log('STATUS_ANTES_OK=1');
});
