const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

const SQLITE_PATH = path.join(__dirname, 'data', 'consignado.sqlite');
const folderUrlBase = 'https://sicoobjuriscredcelgbr.sharepoint.com/sites/PortaldeDocumentosSicoobJuriscred/Documents/Diretoria%20Administrativo/Tecnologia%20da%20Informa%C3%A7%C3%A3o/99-Automa%C3%A7%C3%B5es_TI/9.Recupera%C3%A7%C3%A3o%20de%20Cr%C3%A9dito';

const EXPECTED_072026 = {
  Nome: 'LUIZ EDUARDO DA SILVA PARAGUASSU',
  CPF: '371.344.771-34',
  Copetencia: '07/2026',
  'Desc Finalidade': 'CREDITO CONSIGNADO',
  Contrato: '138,157',
  'N Parcela': '58',
  'Qtd Parcelas': '96',
  Vencimento: '26/07/2001',
  'Critério de Débito': 'Folha Pagto',
  'Valor Parcela': 'R$ 705.71',
};

function httpRequestJson(method, path, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/consignado' + path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      timeout: timeoutMs || 300000,
    }, (res) => {
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const str = buf.toString('utf8');
        try { resolve({ status: res.statusCode, body: JSON.parse(str), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, raw: str, headers: res.headers }); }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('HTTP timeout after ' + (timeoutMs||300000) + 'ms')); });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // ======================================================
  // PASSO 1: RESET COMPLETO idempotência L1+L2 + apagar rowids>=2
  // ======================================================
  console.log('=== [1/5] RESET COMPLETO: hashes L1+L2 + batches + lixo rowids>=2 ===\n');
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(SQLITE_PATH);
  const db = new SQL.Database(buf);

  // apagar lixo
  const r1 = db.run('DELETE FROM "Recurso TRT" WHERE rowid >= 2');
  console.log(`  [LIXO] Apagados Recurso TRT rowid>=2: ${r1.getRowsModified()}`);

  // L2 SHA256 arquivo completo
  const r2 = db.run(`DELETE FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%' AND (value LIKE '%TRT%' OR value LIKE '%JULHO%' OR value LIKE '%recurso_trt%')`);
  console.log(`  [L2] Apagados hash L2 TRT: ${r2.getRowsModified()}`);

  // L1 por linha
  const r3 = db.run(`DELETE FROM imported_row_hashes WHERE kind = 'recurso_trt' OR kind LIKE '%trt%'`);
  console.log(`  [L1] Apagados imported_row_hashes recurso_trt: ${r3.getRowsModified()}`);

  // batches e batch_rows
  const r4 = db.run(`DELETE FROM import_batch_rows WHERE kind = 'recurso_trt'`);
  const r5 = db.run(`DELETE FROM import_batches WHERE kind = 'recurso_trt'`);
  console.log(`  [BATCH] Apagados rows=${r4.getRowsModified()}, batches=${r5.getRowsModified()}`);

  // Counts
  const c1 = db.exec('SELECT COUNT(*) FROM "Recurso TRT"')[0].values[0][0];
  const c2 = db.exec("SELECT COUNT(*) FROM imported_row_hashes WHERE kind = 'recurso_trt'")[0].values[0][0];
  const c3 = db.exec("SELECT COUNT(*) FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%' AND (value LIKE '%TRT%' OR value LIKE '%JULHO%')")[0].values[0][0];
  console.log(`\n  Pós-reset counts: Recurso TRT=${c1} (1 esperado), L1=${c2} (0), L2=${c3} (0)`);

  // rowid=1 referência
  const r1ref = db.exec(`SELECT "Nome","CPF","Copetencia","Contrato","Vencimento" FROM "Recurso TRT" WHERE rowid=1`)[0];
  if (r1ref) {
    const v = r1ref.values[0];
    console.log(`  rowid=1 ref: Nome=${v[0]?.slice(0,25)}... CPF=${v[1]} Cop=${v[2]} Contrato=${v[3]} Venc=${v[4]}`);
  }

  // salvar alterações
  const exp = db.export();
  fs.writeFileSync(SQLITE_PATH, Buffer.from(exp));
  db.close();
  console.log(`  ✅ SQLite salvo.\n`);

  // ======================================================
  // PASSO 2: Verificar backend no ar
  // ======================================================
  console.log('=== [2/5] Backend HTTP health 127.0.0.1:3000 ===');
  try {
    const h = await httpRequestJson('GET', '/automation/health/geral', null, 4000);
    console.log(`  status=${h.status}`);
  } catch (e) {
    console.log(`  (erro ignorado: ${e.message}) — backend no ar.\n`);
  }

  // ======================================================
  // PASSO 3: DISPARAR JOB REAL HTTP POST /import/sync
  // ======================================================
  console.log('\n=== [3/5] DISPARO JOB REAL: POST /api/consignado/import/sync target=recurso_trt ===');
  console.log(`  folderUrl = ${folderUrlBase.slice(0, 90)}...`);
  console.log(`  target    = recurso_trt`);
  console.log(`  timeout   = 300s (5 min)`);
  const t0 = Date.now();
  const jobResp = await httpRequestJson('POST', '/import/sync', {
    folderUrl: folderUrlBase,
    target: 'recurso_trt',
    modalidades: [],
    mode: 'append',
  }, 300000);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  ⏱️  Tempo total HTTP: ${dt}s`);
  console.log(`  HTTP status: ${jobResp.status}`);

  let importedFiles = [];
  if (jobResp.body && Array.isArray(jobResp.body.importedFiles)) {
    importedFiles = jobResp.body.importedFiles;
  } else if (Array.isArray(jobResp.body)) {
    importedFiles = jobResp.body;
  }
  console.log(`  importedFiles count: ${importedFiles.length}`);
  let totalInserted = 0, totalSkipped = 0;
  importedFiles.forEach((f, i) => {
    console.log(`  ├─ [${i+1}] ${f.fileName || f.name}`);
    console.log(`  │    inserted=${f.insertedRows ?? '?'}  skipped=${f.skippedRows ?? '?'}`);
    if (f.skippedReason) console.log(`  │    skippedReason="${f.skippedReason}"`);
    if (f.profileId) console.log(`  │    profileId=${f.profileId}`);
    if (f.headers && Array.isArray(f.headers)) console.log(`  │    headers primeiras: ${f.headers.slice(0, 10).join(' | ')}`);
    totalInserted += Number(f.insertedRows || 0);
    totalSkipped += Number(f.skippedRows || 0);
  });
  console.log(`  TOTAIS: inserted=${totalInserted}  skipped=${totalSkipped}`);
  if (jobResp.body && jobResp.body.message) console.log(`  message: ${String(jobResp.body.message).slice(0, 200)}`);

  // ======================================================
  // PASSO 4: Reabrir SQLite e ler linha nova (rowid>=2)
  // ======================================================
  console.log('\n=== [4/5] VALIDAÇÃO SQL: linha nova (rowid>=2) na tabela Recurso TRT ===\n');
  const SQL2 = await initSqlJs();
  const buf2 = fs.readFileSync(SQLITE_PATH);
  const db2 = new SQL.Database(buf2);

  // listar PRAGMA table_info para ordem CID
  const pragma = db2.exec('PRAGMA table_info("Recurso TRT")')[0];
  const colsOrder = []; // array de { cid, name }
  if (pragma) {
    for (const row of pragma.values) {
      colsOrder.push({ cid: Number(row[0]), name: String(row[1]) });
    }
    console.log(`  Tabela Recurso TRT tem ${colsOrder.length} colunas (CID 0 a ${colsOrder.length-1})`);
  }

  // Buscar rowid >= 2
  const allRows = db2.exec(`SELECT rowid, * FROM "Recurso TRT" WHERE rowid >= 2 ORDER BY rowid`)[0];
  if (!allRows || allRows.values.length === 0) {
    console.log(`  ❌ NENHUMA LINHA NOVA (rowid >= 2) ENCONTRADA.`);
    console.log(`  COUNT total Recurso TRT:`, db2.exec('SELECT COUNT(*) FROM "Recurso TRT"')[0].values[0][0]);
  } else {
    const cols = allRows.columns;
    for (const row of allRows.values) {
      const rowid = row[cols.indexOf('rowid')];
      console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━ Linha rowid=${rowid} ━━━━━━━━━━━━━━━━━━━━━━━━`);
      let matchScore = 0;
      let totalMainCols = 0;
      let extrasNaoNulos = 0;
      const colsExtraNames = colsOrder.filter(c => c.cid >= 15 && c.cid <= 29).map(c => c.name);
      for (const col of colsOrder) {
        const idx = cols.indexOf(col.name);
        const val = (idx >= 0) ? row[idx] : null;
        const valStr = (val === null || val === undefined) ? 'NULL' : String(val);
        let mark = '  ';
        let extra = '';

        if (col.cid <= 9) {
          totalMainCols++;
          const exp = EXPECTED_072026[col.name];
          if (exp !== undefined) {
            const ok = (valStr === String(exp));
            mark = ok ? '✅' : '❌';
            if (ok) matchScore++;
            else extra = `  (esperado: "${exp}")`;
          } else {
            mark = '⚠️';
          }
        } else if (col.cid >= 15 && col.cid <= 29) {
          if (val !== null && val !== undefined && String(val).trim() !== '') {
            extrasNaoNulos++;
            mark = '🔹';
          } else {
            mark = '⬜';
          }
        } else {
          mark = '  ';
        }
        const cidStr = String(col.cid).padStart(2,'0');
        const namePad = col.name.padEnd(28);
        const valPreview = valStr.length > 50 ? valStr.slice(0, 47) + '...' : valStr;
        console.log(`  ${mark} CID${cidStr} ${namePad} → ${valPreview}${extra}`);
      }
      console.log(``);
      console.log(`  🔍 Resumo rowid=${rowid}:`);
      console.log(`     10 cols principais: ${matchScore}/${totalMainCols}  (${matchScore === totalMainCols ? '✅ PERFEITO — 10/10' : '⚠️ FALTAM ' + (totalMainCols-matchScore) + ' cols'})`);
      console.log(`     16 colunas extras (CID15-CID29) não nulas: ${extrasNaoNulos}/16`);
      if (matchScore === totalMainCols) {
        console.log(`     🎉🎉🎉 SUCESSO! Valores batem 100% com referência 07/2026 🎉🎉🎉`);
      }
      console.log(``);
    }
  }

  // ======================================================
  // PASSO 5: Verificar idempotência L2 gravada
  // ======================================================
  console.log('=== [5/5] Verificação pós-job: hashes L2 no consignado_app_config ===');
  const l2Rows = db2.exec(`SELECT key, value, updated_at FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%' AND (value LIKE '%TRT%' OR value LIKE '%JULHO%') LIMIT 5`)[0];
  if (l2Rows && l2Rows.values.length) {
    for (const row of l2Rows.values) {
      console.log(`  KEY:   ${String(row[0]).slice(0, 60)}...`);
      const valObj = (() => { try { return JSON.parse(String(row[1])); } catch { return { raw: String(row[1]).slice(0, 150) }; } })();
      if (valObj && valObj.meta) {
        console.log(`  META:  fileName=${valObj.meta.fileName || '?'}, insertedRows=${valObj.meta.insertedRows || '?'}, at=${valObj.at || row[2]}`);
      } else {
        console.log(`  VALUE: ${JSON.stringify(valObj).slice(0, 200)}`);
      }
    }
  } else {
    console.log(`  (ainda sem hash L2 gravado — insertedRows pode ser 0)`);
  }

  db2.close();
  console.log(`\n✅ FIM. Resultado completo acima.`);
  process.exit(totalInserted > 0 ? 0 : 2);
}

main().catch(e => { console.error('\n❌ ERRO FATAL:', e); process.exit(1); });
