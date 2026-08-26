const http = require("http");

const FOLDER_URL_BASE = "https://sicoobjuriscredcelgbr.sharepoint.com/sites/PortaldeDocumentosSicoobJuriscred/Documents/Diretoria%20Administrativo/Tecnologia%20da%20Informa%C3%A7%C3%A3o/99-Automa%C3%A7%C3%B5es_TI/9.Recupera%C3%A7%C3%A3o%20de%20Cr%C3%A9dito";

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
        timeout: 600000,
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
  console.log("========================================================");
  console.log("  JOB REAL HTTP — RECURSO TRT (SÍNCRONO /import/sync)");
  console.log("========================================================");
  console.log(" folderUrl =", FOLDER_URL_BASE);
  console.log(" target    = recurso_trt");
  console.log(" mode      = append");
  console.log(" sync      = true (forçado via endpoint sync)");
  console.log("");

  const started = Date.now();
  const resp = await doHttp("POST", "/api/consignado/import/sync", {
    folderUrl: FOLDER_URL_BASE,
    learningUrl: FOLDER_URL_BASE,
    target: "recurso_trt",
    mode: "append",
    sync: true,
    resetHashesFirst: true,
  });

  const dt = (Date.now() - started) / 1000;
  console.log("HTTP status =", resp.status, "| duration =", dt.toFixed(2), "s");
  console.log("raw length  =", resp.raw ? resp.raw.length : 0);
  console.log("");
  if (resp.raw) {
    const preview = String(resp.raw).slice(0, 8000);
    console.log("----- RAW RESPONSE (first 8000 chars) -----");
    console.log(preview);
    console.log("----- END RAW -----");
  }
  console.log("");
  if (resp.data) {
    const d = resp.data;
    console.log("Result parseado:");
    console.log("  ok        =", d.ok);
    console.log("  insertedRows =", typeof d.insertedRows !== "undefined" ? d.insertedRows : (d.importedFiles && d.importedFiles[0] ? d.importedFiles[0].insertedRows : "n/a"));
    console.log("  skippedRows  =", typeof d.skippedRows !== "undefined" ? d.skippedRows : (d.importedFiles && d.importedFiles[0] ? d.importedFiles[0].skippedRows : "n/a"));
    if (Array.isArray(d.importedFiles)) {
      console.log("  importedFiles[] =", d.importedFiles.length);
      d.importedFiles.forEach((f, idx) => {
        console.log("    [" + idx + "]", {
          fileName: f.fileName,
          insertedRows: f.insertedRows,
          skippedRows: f.skippedRows,
          skippedReason: f.skippedReason ? String(f.skippedReason).slice(0, 200) : null,
          targetTable: f.targetTable,
          profileId: f.profileId,
          kind: f.kind,
        });
      });
    }
    if (typeof d.movedToImportados !== "undefined") {
      console.log("  movedToImportados       =", d.movedToImportados);
      console.log("  movedToImportadosCount  =", d.movedToImportadosCount);
      console.log("  moveError               =", d.moveError);
    }
    if (d.insertResult) {
      console.log("  insertResult =", JSON.stringify(d.insertResult).slice(0, 300));
    }
  } else {
    console.log("⚠️  NÃO FOI POSSÍVEL FAZER PARSE DO JSON. Ver raw acima.");
    process.exit(2);
  }
}

main().catch((e) => {
  console.error("\nFATAL:", e.stack || e);
  process.exit(99);
});
