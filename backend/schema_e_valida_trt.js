const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

async function main() {
  const SQL = await initSqlJs({
    locateFile: (f) => path.join(__dirname, "node_modules", "sql.js", "dist", f),
  });
  const SQLITE_PATH = path.join(__dirname, "data", "consignado.sqlite");
  const buf = fs.readFileSync(SQLITE_PATH);
  const db = new SQL.Database(buf);

  const pragma = db.exec("PRAGMA table_info(\"Recurso TRT\")");
  console.log("SCHEMA Recurso TRT:", pragma.length ? pragma[0].values.length : 0, "colunas");
  if (pragma.length) {
    pragma[0].values.forEach((r, i) => {
      const [cid, name, type] = r;
      console.log("  [" + String(i).padStart(2, "0") + "] cid=" + cid + " name=" + JSON.stringify(name) + " type=" + type);
    });
  }
  console.log("");
  const s2 = db.prepare("SELECT rowid, * FROM \"Recurso TRT\" ORDER BY rowid DESC LIMIT 2");
  const rr = [];
  while (s2.step()) rr.push(s2.getAsObject());
  s2.free();
  db.close();

  const EXPECTED = {
    Nome: "LUIZ EDUARDO DA SILVA PARAGUASSU",
    CPF: "371.344.771-34",
    Copetencia: "08/2026",
    "Desc Finalidade": "CREDITO CONSIGNADO",
    Contrato: "138,157",
    "N Parcela": "58",
    "Qtd Parcelas": "96",
    Vencimento: "26/08/2001",
    "Critério de Débito": "Folha Pagto",
    "Valor Parcela": "R$ 705.71",
  };
  const normStr = (s) =>
    String(s ?? "").replace(/\s+/g, " ").trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().normalize("NFC");

  console.log("Últimas 2 linhas com VALIDAÇÃO 10 cols:");
  const cols10 = ["Nome","CPF","Copetencia","Desc Finalidade","Contrato","N Parcela","Qtd Parcelas","Vencimento","Critério de Débito","Valor Parcela"];
  for (const r of rr) {
    console.log("\n" + "=".repeat(110));
    console.log("rowid =", r.rowid);
    let ok = 0;
    for (const col of cols10) {
      const real = Object.prototype.hasOwnProperty.call(r, col) ? r[col] : null;
      const exp = EXPECTED[col];
      const rn = normStr(real);
      const en = normStr(exp);
      const match = rn === en;
      if (match) ok++;
      const tag = match ? "\u2705" : "\u274c";
      console.log("  " + tag + " " + col.padEnd(22, " ") + " REAL=" + JSON.stringify(real ?? null).padEnd(52) + " ESP=" + JSON.stringify(exp));
    }
    console.log("  EXTRAS:");
    Object.entries(r).forEach(([k, v]) => {
      if (cols10.includes(k) || k === "rowid") return;
      console.log("    " + k.padEnd(30, " ") + " = " + JSON.stringify(v ?? null).slice(0, 100));
    });
    console.log("  *** SUBTOTAL " + ok + "/10 cols principais ***");
  }
}
main().catch((e) => { console.error(e.stack || e); process.exit(1); });
