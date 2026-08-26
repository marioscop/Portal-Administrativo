const http = require("http");

const FOLDER_URL_BASE = "https://sicoobjuriscredcelgbr.sharepoint.com/sites/PortaldeDocumentosSicoobJuriscred/Documents/Diretoria%20Administrativo/Tecnologia%20da%20Informa%C3%A7%C3%A3o/99-Automa%C3%A7%C3%B5es_TI/9.Recupera%C3%A7%C3%A3o%20de%20Cr%C3%A9dito";

const TRT_PARENT_ID = "017U2I3T7JVLMHSBF2TNALR33C34GM2BCG";
const TARGET_FILENAME = "TRT-JULHO-2026.xlsx";
const BACKEND_HOST = "127.0.0.1";
const BACKEND_PORT = 3000;

function doHttp(method, path, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = bodyObj ? Buffer.from(JSON.stringify(bodyObj), "utf8") : null;
    const req = http.request(
      {
        host: BACKEND_HOST,
        port: BACKEND_PORT,
        method: method,
        path: path,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": body ? body.length : 0,
        },
        timeout: 240000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let data = null;
          try {
            data = JSON.parse(raw);
          } catch (e) {
            data = null;
          }
          resolve({ status: res.statusCode, data, raw });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("HTTP timeout"));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log("=== PASSO 1: Listar arquivos SharePoint pasta Recuperação de Crédito forceKind=recurso_trt ===");
  console.log("folderUrl =", FOLDER_URL_BASE);
  const list = await doHttp("POST", "/api/consignado/debug-expand-extratos", {
    folderUrl: FOLDER_URL_BASE,
    forceKind: "recurso_trt",
  });
  console.log("status HTTP listagem =", list.status);
  console.log("raw length =", list.raw ? list.raw.length : 0);
  if (list.raw) {
    console.log("--- RAW PRIMEIROS 3000 chars ---");
    console.log(String(list.raw).slice(0, 3000));
    console.log("--- FIM RAW ---");
  }
  if (!list.data) {
    console.log("\n❌ JSON.parse falhou. Saindo.");
    process.exit(1);
  }
  const candidates = list.data.candidates || [];
  console.log("\nTotal candidates retornados =", candidates.length);
  console.log("--- TOP 30 CANDIDATES (name, folderPath, id, parentId) ---");
  candidates.slice(0, 30).forEach((c, i) => {
    console.log(`  [${String(i).padStart(2, "0")}] name=${JSON.stringify(c.name)} folderPath=${JSON.stringify(c.folderPath)} id=${JSON.stringify(c.id)} parentId=${JSON.stringify(c.parentId)}`);
  });
  console.log("");

  const matches = candidates.filter((c) => String(c.name || "").toLowerCase().includes("trt-julho-2026"));
  console.log("=== Matchs para TRT-JULHO-2026.xlsx =", matches.length);
  matches.forEach((c, idx) => {
    console.log(`  [${idx}] name=${c.name} | id=${c.id} | folderPath=${c.folderPath} | parentId=${c.parentId}`);
  });
  console.log("");

  if (matches.length === 0) {
    console.log("Nenhum match exato para TRT-JULHO-2026. Tentando encontrar qualquer TRT*.xlsx (top 10):");
    const alt = candidates.filter((c) => /TRT/i.test(String(c.name || "")) && /\.(xlsx|xlsm|xls)$/i.test(String(c.name || ""))).slice(0, 10);
    alt.forEach((c, i) => console.log(`  alt[${i}] name=${c.name} folderPath=${c.folderPath} id=${c.id}`));
    console.log("");
    console.log("SALVANDO candidates em backend/trt_candidates.json para análise.");
    require("fs").writeFileSync(
      process.cwd() + "/backend/trt_candidates.json",
      JSON.stringify({ status: list.status, data: list.data, at: new Date().toISOString() }, null, 2),
      "utf8"
    );
    process.exit(matches.length === 0 ? 2 : 0);
  }

  const target = matches[0];
  console.log("=== Arquivo alvo selecionado ===");
  console.log("  name        =", target.name);
  console.log("  id          =", target.id);
  console.log("  folderPath  =", target.folderPath);
  console.log("  parentId    =", target.parentId);
  const emImportados = String(target.folderPath || "").toLowerCase().includes("importados");
  console.log("  current está em Importados? =", emImportados);
  console.log("  TRT_PARENT_ID desejado     =", TRT_PARENT_ID);
  console.log("");

  require("fs").writeFileSync(
    process.cwd() + "/backend/trt_target_file.json",
    JSON.stringify(
      {
        targetFile: target,
        desiredParentId: TRT_PARENT_ID,
        currentlyInImportados: emImportados,
        at: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );
  console.log("Dados salvos em backend/trt_target_file.json ✅");
}

main().catch((e) => {
  console.error("FATAL:", e.stack || e);
  process.exit(99);
});
