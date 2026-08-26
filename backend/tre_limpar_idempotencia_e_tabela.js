const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const ROOT = path.join(__dirname);
const SQLITE_PATH = path.join(ROOT, "data", "consignado.sqlite");
const TRE_SHA = "965b2a12abd159c2b7053bdee8103d9888b0420f3534a602b4215ec4ae513993";

(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(SQLITE_PATH);
  const backup = Buffer.from(buf);
  const backupPath = path.join(ROOT, "data", `consignado.sqlite.pre_tre_local_${Date.now()}.sqlite`);
  fs.writeFileSync(backupPath, backup);
  console.log("Backup prévio:", backupPath, "bytes=", backup.length);

  const db = new SQL.Database(buf);

  // Limpar L2 SHA TRE
  console.log("\n=== LIMPEZA IDEMPOTÊNCIA L2 (SHA TRE) ===");
  const L2_KEY_TRE = `imported_file_sha256::v1::${TRE_SHA}`;
  const delL2 = db.run(`DELETE FROM consignado_app_config WHERE key='${L2_KEY_TRE}'`);
  console.log("Delete L2 TRE SHA:", delL2.getRowsModified());

  // Limpar L1 row hashes TRE
  console.log("\n=== LIMPEZA L1 ROW HASHES TRE ===");
  const delL1 = db.run(`DELETE FROM imported_row_hashes WHERE kind LIKE '%TRE%'`);
  console.log("Delete L1 Recurso TRE rows:", delL1.getRowsModified());

  // Limpar import_batch_rows TRE (quando existir)
  try {
    const delBatch = db.run(`DELETE FROM import_batch_rows WHERE table_name='Recurso TRE'`);
    console.log("Delete import_batch_rows TRE:", delBatch.getRowsModified());
    const delBatchMaster = db.run(`DELETE FROM import_batches WHERE target_table='Recurso TRE' OR kind='recurso_tre'`);
    console.log("Delete import_batches TRE:", delBatchMaster.getRowsModified());
  } catch (e) {
    console.log("Sem tabela import_batch (ok):", e.message.split("\n")[0]);
  }

  // Apagar TODAS as linhas de Recurso TRE (inicializar tabela limpa — se existir)
  console.log("\n=== APAGAR LINHAS RECURSO TRE ===");
  try {
    const countPrev = db.exec("SELECT COUNT(*) AS c FROM \"Recurso TRE\"")[0].values[0][0];
    console.log("Recurso TRE linhas ANTES do delete:", countPrev);
    const del = db.run("DELETE FROM \"Recurso TRE\"");
    console.log("Recurso TRE DELETADAS:", del.getRowsModified());
  } catch (e) {
    console.log("Tabela Recurso TRE ainda não existe (será criada no primeiro insert). Ok.");
  }

  // Persistir SQLite
  const newBuf = db.export();
  fs.writeFileSync(SQLITE_PATH, newBuf);
  console.log("\nSQLite persistido em", SQLITE_PATH);
  db.close();
})();
