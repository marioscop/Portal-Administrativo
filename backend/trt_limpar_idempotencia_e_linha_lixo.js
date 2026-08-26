const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const SHA256_TRT = "92eb501eea1c50566017aa7dae8565c504b5d71fe4ea5fb5eeee5a7294b42bce";

async function main() {
  const SQL = await initSqlJs({
    locateFile: (f) => path.join(__dirname, "node_modules", "sql.js", "dist", f),
  });
  const SQLITE_PATH = path.join(__dirname, "data", "consignado.sqlite");
  const backupPath = SQLITE_PATH + ".pre_trt_job_real_" + Date.now() + ".sqlite";
  fs.copyFileSync(SQLITE_PATH, backupPath);
  console.log("✅ Backup prévio =", backupPath);

  const buf = fs.readFileSync(SQLITE_PATH);
  const db = new SQL.Database(buf);

  const keyL2 = "imported_file_sha256::v1::" + SHA256_TRT;
  const kindTrt = "learning_profile:Recurso TRT";

  console.log("=== PASSO 1: Key L2 SHA256 ===");
  const s1 = db.prepare("SELECT key, substr(value,1,160) v FROM consignado_app_config WHERE key=?1");
  s1.bind([1], keyL2);
  while (s1.step()) {
    const r = s1.getAsObject();
    console.log("  Existe key L2 =", JSON.stringify(r));
  }
  s1.free();
  db.run("DELETE FROM consignado_app_config WHERE key=?", [keyL2]);
  console.log("  DELETE consignado_app_config rows changed =", db.getRowsModified());

  console.log("\n=== PASSO 2: L1 imported_row_hashes kind=Recurso TRT ===");
  const s2 = db.prepare("SELECT COUNT(*) c FROM imported_row_hashes WHERE kind=?1");
  s2.bind([1], kindTrt);
  let cnt2 = 0;
  if (s2.step()) cnt2 = Number(s2.getAsObject().c || 0);
  s2.free();
  console.log("  imported_row_hashes count antes =", cnt2);
  db.run("DELETE FROM imported_row_hashes WHERE kind=?", [kindTrt]);
  console.log("  DELETE imported_row_hashes rows changed =", db.getRowsModified());

  console.log("\n=== PASSO 3: import_batch_rows + import_batches Recurso TRT ===");
  const s3a = db.prepare("SELECT COUNT(*) c FROM import_batch_rows WHERE kind='learning_profile:Recurso TRT' OR table_name='Recurso TRT'");
  let cnt3a = 0;
  if (s3a.step()) cnt3a = Number(s3a.getAsObject().c || 0);
  s3a.free();
  console.log("  import_batch_rows count antes =", cnt3a);
  db.run("DELETE FROM import_batch_rows WHERE kind='learning_profile:Recurso TRT' OR table_name='Recurso TRT'");
  console.log("  DELETE import_batch_rows rows changed =", db.getRowsModified());

  const s3b = db.prepare("SELECT COUNT(*) c FROM import_batches WHERE kind='learning_profile:Recurso TRT' OR target_table='Recurso TRT'");
  let cnt3b = 0;
  if (s3b.step()) cnt3b = Number(s3b.getAsObject().c || 0);
  s3b.free();
  console.log("  import_batches count antes =", cnt3b);
  db.run("DELETE FROM import_batches WHERE kind='learning_profile:Recurso TRT' OR target_table='Recurso TRT'");
  console.log("  DELETE import_batches rows changed =", db.getRowsModified());

  console.log("\n=== PASSO 4: limpar rowids>=3 Recurso TRT (manter rowid=1 referência + rowid=2 oneshot último) ===");
  const s4 = db.prepare("SELECT rowid, Nome, Copetencia FROM \"Recurso TRT\" ORDER BY rowid");
  const rows4 = [];
  while (s4.step()) rows4.push(s4.getAsObject());
  s4.free();
  console.log("  Estado ANTES tabela:");
  rows4.forEach((r) => console.log("    rowid=" + r.rowid + " Nome=" + JSON.stringify(String(r.Nome || "").slice(0, 22)) + " Cop=" + JSON.stringify(r.Copetencia)));
  db.run("DELETE FROM \"Recurso TRT\" WHERE rowid >= 3");
  console.log("  DELETE rowid>=3 rows changed =", db.getRowsModified());
  const s4b = db.prepare("SELECT COUNT(*) c FROM \"Recurso TRT\"");
  let cnt4b = 0;
  if (s4b.step()) cnt4b = Number(s4b.getAsObject().c || 0);
  s4b.free();
  console.log("  COUNT final Recurso TRT =", cnt4b, "(esperado 2)");

  console.log("\n=== PASSO 5: Exportar database de volta pro arquivo (persistir alterações) ===");
  const bufOut = Buffer.from(db.export());
  db.close();
  fs.writeFileSync(SQLITE_PATH, bufOut);
  console.log("  WRITE consignado.sqlite bytes =", bufOut.length, "OK ✅");
  console.log("  Backup prévio preservado em:", backupPath);
}
main().catch((e) => {
  console.error("FATAL:", e.stack || e);
  process.exit(1);
});
