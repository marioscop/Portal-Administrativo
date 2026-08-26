const fs = require("fs");
const initSqlJs = require("sql.js");
const path = require("path");
(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.resolve(__dirname, "data/consignado.sqlite");
  if (!fs.existsSync(dbPath)) { console.log("ERRO: SQLite nao existe em " + dbPath); process.exit(1); }
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);
  // COUNT
  const rCount = db.exec("SELECT COUNT(*) AS cnt FROM relatorio_consignado");
  console.log("COUNT(relatorio_consignado) = " + (rCount[0]?.values[0]?.[0] ?? 0));
  // rowid DESC ultimas 5
  const r5 = db.exec("SELECT rowid, EMPRESA, Cliente, Matrícula, CPF, Nome, Operação, Parcela, Vencimento, [Valor Operação], [Valor Parcela], Copetencia, __source_file FROM relatorio_consignado ORDER BY rowid DESC LIMIT 5");
  if (r5.length && r5[0].values.length) {
    console.log("\n=== Ultimas 5 linhas (rowid DESC): ===");
    const cols = r5[0].columns;
    for (const row of r5[0].values) {
      const obj = {};
      cols.forEach((c,i) => obj[c] = row[i] === null ? null : String(row[i]));
      console.log(JSON.stringify(obj, null, 2));
      console.log("---");
    }
  }
  // COUNT Ultimas 24h
  const r24 = db.exec("SELECT COUNT(*) FROM relatorio_consignado WHERE Copetencia IS NOT NULL AND Copetencia != ''");
  console.log("\nCOUNT linhas COM Copetencia preenchida (parser novo): " + (r24[0]?.values[0]?.[0] ?? 0));
  // Operacao com hifen vs sem
  const rHy = db.exec("SELECT SUM(CASE WHEN Operação GLOB '%-%' THEN 1 ELSE 0 END) AS c_hifen, SUM(CASE WHEN Operação NOT GLOB '%-%' AND Operação != '' THEN 1 ELSE 0 END) AS c_sem FROM relatorio_consignado WHERE Operação IS NOT NULL AND Operação != ''");
  if (rHy.length) console.log("Operação COM hífen (parser correto)=" + rHy[0].values[0][0] + " | SEM hífen (antigo errado)=" + rHy[0].values[0][1]);
  // Parcela não-monetário vs monetário
  const rPa = db.exec("SELECT SUM(CASE WHEN Parcela GLOB '*.*' OR Parcela GLOB '*,*' THEN 1 ELSE 0 END) AS p_monet, SUM(CASE WHEN Parcela NOT GLOB '*.*' AND Parcela NOT GLOB '*,*' AND Parcela != '' THEN 1 ELSE 0 END) AS p_int FROM relatorio_consignado WHERE Parcela IS NOT NULL AND Parcela != ''");
  if (rPa.length) console.log("Parcela tipo INTEIRO (parser correto)=" + rPa[0].values[0][1] + " | MONETÁRIO (antigo errado)=" + rPa[0].values[0][0]);
  db.close();
})().catch(e => { console.error(e); process.exit(2); });
