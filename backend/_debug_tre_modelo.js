const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");

const MODELOS_DIR = path.join(__dirname, "..", "Modelos");
const FNAME = "TRE-JULHO-2026.xlsx";
const FP = path.join(MODELOS_DIR, FNAME);

console.log("=== TRE-0a: ARQUIVO MODELO TRE ===");
console.log("exists:", fs.existsSync(FP));
if (fs.existsSync(FP)) {
  const stat = fs.statSync(FP);
  console.log("size bytes:", stat.size);
  const buf = fs.readFileSync(FP);
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  console.log("SHA256:", sha);

  console.log("\n=== TRE-0b: CABECALHOS E PRIMEIRA LINHA UTIL ===");
  try {
    const wb = XLSX.read(buf, { type: "buffer" });
    console.log("sheets:", wb.SheetNames);
    for (const sn of wb.SheetNames) {
      console.log("\n--- sheet:", sn, "---");
      const ws = wb.Sheets[sn];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
      console.log("total rows (raw header array):", rows.length);
      // Imprimir primeiras 5 linhas para encontrar a linha de cabeçalhos
      const max = Math.min(rows.length, 6);
      for (let i = 0; i < max; i++) {
        console.log("[" + String(i).padStart(2, "0") + "]", JSON.stringify(rows[i].slice(0, 30)));
      }
    }
  } catch (e) {
    console.error("XLSX ERROR:", e.stack || e);
  }
} else {
  console.log("ARQUIVO NÃO EXISTE. Conteúdo de Modelos/:");
  try { console.log(fs.readdirSync(MODELOS_DIR)); } catch (e2) { console.error(e2.message); }
}
