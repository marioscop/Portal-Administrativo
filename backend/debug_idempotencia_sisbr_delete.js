const fs = require("fs");
const initSqlJs = require("sql.js");
const path = require("path");
(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.resolve(__dirname, "data/consignado.sqlite");
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);
  console.log("=== 6b-1) ANTES DO DELETE ===");
  const r1 = db.exec(`SELECT kind, COUNT(*) as cnt, MAX(imported_at) as max_at FROM imported_row_hashes WHERE kind LIKE 'learning_profile:%relatorio%' GROUP BY kind`);
  if (r1.length) for (const row of r1[0].values) console.log("  kind=" + row[0] + "  cnt=" + row[1] + "  max_at=" + row[2]);
  const totalAntes = db.exec("SELECT COUNT(*) as c FROM imported_row_hashes")[0].values[0][0];
  console.log("  imported_row_hashes TOTAL ANTES=" + totalAntes);

  console.log("\n=== 6b-2) EXECUTANDO DELETE seguro: learning_profile:%relatorio% APENAS dia 25/08 20h+ ===");
  const del = db.prepare(`DELETE FROM imported_row_hashes WHERE kind LIKE 'learning_profile:%relatorio%' AND imported_at >= '2026-08-25 20:00:00.000Z'`);
  const res = del.step();
  const changes = db.getRowsModified();
  del.free();
  console.log("  -> " + changes + " hashes de idempotência relatorio REMOVIDOS (travamento)");

  console.log("\n=== 6b-3) DEPOIS DO DELETE ===");
  const r2 = db.exec(`SELECT kind, COUNT(*) as cnt, MAX(imported_at) as max_at FROM imported_row_hashes WHERE kind LIKE 'learning_profile:%relatorio%' GROUP BY kind`);
  if (r2.length) for (const row of r2[0].values) console.log("  kind=" + row[0] + "  cnt=" + row[1] + "  max_at=" + row[2]);
  const totalDepois = db.exec("SELECT COUNT(*) as c FROM imported_row_hashes")[0].values[0][0];
  console.log("  imported_row_hashes TOTAL DEPOIS=" + totalDepois + " (diferença=" + (totalAntes - totalDepois) + ")");

  // Salva SQLite de volta em disco!
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log("\n  -> SQLite salvo em disco no caminho: " + dbPath);
  db.close();
  console.log("\n=== 6b) DELETE CONCLUÍDO. changes=" + changes + " rows modified ===");
  process.exit(0);
})().catch(e => { console.error(e); process.exit(2); });
