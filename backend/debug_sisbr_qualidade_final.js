const fs = require("fs");
const initSqlJs = require("sql.js");
const path = require("path");
(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.resolve(__dirname, "data/consignado.sqlite");
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);
  const cnt = db.exec("SELECT COUNT(*) as c FROM relatorio_consignado")[0].values[0][0];
  console.log("COUNT total relatorio_consignado = " + cnt);
  const rComHifen = db.exec(`SELECT COUNT(*) as c FROM relatorio_consignado WHERE Operação GLOB '%-%' AND Operação IS NOT NULL AND Operação != ''`)[0].values[0][0];
  const rSemHifen = db.exec(`SELECT COUNT(*) as c FROM relatorio_consignado WHERE Operação NOT GLOB '%-%' AND Operação IS NOT NULL AND Operação != ''`)[0].values[0][0];
  const pInt = db.exec(`SELECT COUNT(*) as c FROM relatorio_consignado WHERE Parcela IS NOT NULL AND Parcela != '' AND Parcela NOT GLOB '*,*' AND Parcela NOT GLOB '*.*'`)[0].values[0][0];
  const pMon = db.exec(`SELECT COUNT(*) as c FROM relatorio_consignado WHERE Parcela IS NOT NULL AND Parcela != '' AND (Parcela GLOB '*,*' OR Parcela GLOB '*.*')`)[0].values[0][0];
  const c19Ok = db.exec(`SELECT COUNT(*) as c FROM relatorio_consignado WHERE
    EMPRESA IS NOT NULL AND EMPRESA != '' AND Cliente IS NOT NULL AND Cliente != '' AND Matrícula IS NOT NULL AND Matrícula != '' AND
    CPF IS NOT NULL AND CPF != '' AND Nome IS NOT NULL AND Nome != '' AND Operação IS NOT NULL AND Operação != '' AND
    Parcela IS NOT NULL AND Parcela != '' AND Copetencia IS NOT NULL AND Copetencia != ''`)[0].values[0][0];
  console.log("\n=== MÉTRICAS DE QUALIDADE (parser novo vs antigo): ===");
  console.log("  Operação C/ hífen (CORRETO parser D5) = " + rComHifen);
  console.log("  Operação S/ hífen (ANTIGO ERRADO)     = " + rSemHifen);
  console.log("  Parcela INTEIRO (CORRETO parser D5)  = " + pInt);
  console.log("  Parcela MONETÁRIO (ANTIGO ERRADO)    = " + pMon);
  console.log("  19 colunas TODAS preenchidas (D5)    = " + c19Ok);
  const r10 = db.exec(`SELECT rowid, EMPRESA, Cliente, Matrícula, CPF, Nome, Operação, Modalidade, Parcela, Vencimento, [Valor Operação], [Valor Parcela], Copetencia FROM relatorio_consignado ORDER BY rowid DESC LIMIT 10`);
  if (r10.length && r10[0].values.length) {
    console.log("\n=== ÚLTIMAS 10 LINHAS INSERIDAS (rowid DESC — para inspeção manual): ===");
    for (const row of r10[0].values) {
      const o = {};
      r10[0].columns.forEach((c,i) => o[c] = row[i] === null ? "(NULL)" : String(row[i]));
      console.log(JSON.stringify(o));
    }
  }
  db.close();
})().catch(e => { console.error(e); process.exit(2); });
