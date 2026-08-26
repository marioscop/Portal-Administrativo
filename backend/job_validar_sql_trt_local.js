const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const SQLITE_PATH = path.join(__dirname, "data", "consignado.sqlite");

const EXPECTED = {
  Nome: "LUIZ EDUARDO DA SILVA PARAGUASSU",
  CPF: "371.344.771-34",
  Copetencia: "07/2026",
  "Desc Finalidade": "CREDITO CONSIGNADO",
  Contrato: "138,157",
  "N Parcela": "58",
  "Qtd Parcelas": "96",
  Vencimento: "26/07/2001",
  "Criterio de Debito": "Folha Pagto",
  "Valor Parcela": "R$ 705.71",
};

const normStr = (s) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .normalize("NFC");

async function main() {
  const SQL = await initSqlJs({
    locateFile: (f) => path.join(__dirname, "node_modules", "sql.js", "dist", f),
  });
  const buf = fs.readFileSync(SQLITE_PATH);
  const db = new SQL.Database(buf);

  console.log("=".repeat(110));
  console.log("VALIDACAO SQL Recurso TRT 10/10 cols match referencia 07/2026");
  console.log("DB:", SQLITE_PATH, "size=", buf.length, "bytes");
  console.log("=".repeat(110));

  const countStmt = db.prepare('SELECT COUNT(*) AS c FROM "Recurso TRT"');
  countStmt.step();
  const c = countStmt.getAsObject().c;
  countStmt.free();
  console.log("TOTAL rows na tabela [Recurso TRT]:", c);

  const stmt = db.prepare(
    'SELECT rowid, ' +
    'CID00 AS Nome, CID01 AS CPF, CID02 AS Copetencia, CID03 AS "Desc Finalidade", CID04 AS Contrato, ' +
    'CID05 AS "N Parcela", CID06 AS "Qtd Parcelas", CID07 AS Vencimento, CID08 AS "Criterio de Debito", CID09 AS "Valor Parcela", ' +
    'CID15 AS "Identificacao Desconto", CID22 AS Funcionario, CID27 AS "Codigo Verba" ' +
    'FROM "Recurso TRT" WHERE rowid >= 1 ORDER BY rowid DESC LIMIT 3'
  );

  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  db.close();

  console.log("Últimas 3 linhas (rowid >= 1, DESC):");
  console.log("-".repeat(110));

  let ok10Count = 0;
  for (const r of rows) {
    console.log("");
    console.log("rowid =", r.rowid);
    const cols = [
      ["Nome", r.Nome, EXPECTED.Nome],
      ["CPF", r.CPF, EXPECTED.CPF],
      ["Copetencia", r.Copetencia, EXPECTED.Copetencia],
      ["Desc Finalidade", r["Desc Finalidade"], EXPECTED["Desc Finalidade"]],
      ["Contrato", r.Contrato, EXPECTED.Contrato],
      ["N Parcela", r["N Parcela"], EXPECTED["N Parcela"]],
      ["Qtd Parcelas", r["Qtd Parcelas"], EXPECTED["Qtd Parcelas"]],
      ["Vencimento", r.Vencimento, EXPECTED.Vencimento],
      ["Criterio de Debito", r["Criterio de Debito"], EXPECTED["Criterio de Debito"]],
      ["Valor Parcela", r["Valor Parcela"], EXPECTED["Valor Parcela"]],
    ];
    let ok10 = 0;
    for (const [col, real, exp] of cols) {
      const rn = normStr(real);
      const en = normStr(exp);
      const match = rn === en;
      if (match) ok10++;
      const tag = match ? "\u2705" : "\u274c";
      const realStr = JSON.stringify(real ?? null);
      const expStr = JSON.stringify(exp ?? null);
      console.log("  " + tag + " " + col.padEnd(22, " ") + " REAL=" + realStr.padEnd(52, " ") + " ESPERADO=" + expStr);
    }
    console.log("  --- EXTRAS ---");
    console.log("    CID15 Identificacao =", JSON.stringify(r["Identificacao Desconto"] ?? null));
    console.log("    CID22 Funcionario   =", JSON.stringify(r.Funcionario ?? null));
    console.log("    CID27 Codigo Verba  =", JSON.stringify(r["Codigo Verba"] ?? null));
    console.log("  *** SUBTOTAL: " + ok10 + "/10 cols principais ***");
    if (ok10 === 10) ok10Count++;
  }

  console.log("");
  console.log("=".repeat(110));
  if (ok10Count > 0) {
    console.log("\uD83C\uDF89\uD83C\uDF89\uD83C\uDF89  VALIDACAO 10/10 COLS PERFEITO ENCONTRADA EM " + ok10Count + " LINHA(S)! \uD83C\uDF89\uD83C\uDF89\uD83C\uDF89");
    process.exit(0);
  } else {
    console.log("\u274c Ainda nao 10/10. Ajustar pipeline e rodar de novo.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("ERROR:", e && e.stack ? e.stack : e);
  process.exit(1);
});
