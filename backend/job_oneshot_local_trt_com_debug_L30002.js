const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

const SQLITE_PATH = path.join(__dirname, 'data', 'consignado.sqlite');
const LOCAL_TRT = path.join(__dirname, '..', 'Modelos', 'TRT-JULHO-2026.xlsx');

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

function req(method, apiPath, body, tMs) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      host: '127.0.0.1', port: 3000,
      path: '/api/consignado' + apiPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      timeout: tMs || 180000,
    }, (res) => {
      let c = [];
      res.on('data', (d) => c.push(d));
      res.on('end', () => {
        const s = Buffer.concat(c).toString('utf8');
        try { resolve({ status: res.statusCode, body: JSON.parse(s), raw: s }); }
        catch { resolve({ status: res.statusCode, raw: s }); }
      });
    });
    r.on('error', reject);
    r.on('timeout', () => r.destroy(new Error('HTTP timeout ' + (tMs||180000) + 'ms')));
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log('=== [0/6] Pre-flight checks ===');
  const okArq = fs.existsSync(LOCAL_TRT);
  const stats = okArq ? fs.statSync(LOCAL_TRT) : null;
  console.log(`  Arquivo local TRT existe? ${okArq ? '✅ SIM' : '❌ NÃO'}  ${LOCAL_TRT}`);
  if (okArq) console.log(`    tamanho=${stats.size} bytes, mtime=${stats.mtime.toISOString()}`);

  // SHA256 do arquivo local para confirmar
  const crypto = require('crypto');
  const bufArq = fs.readFileSync(LOCAL_TRT);
  const sha = crypto.createHash('sha256').update(bufArq).digest('hex');
  console.log(`    SHA256=${sha}  (esperado 92eb501eea1c50566017aa7dae8565c504b5d71fe4ea5fb5eeee5a7294b42bce)`);
  const match = (sha === '92eb501eea1c50566017aa7dae8565c504b5d71fe4ea5fb5eeee5a7294b42bce');
  console.log(`    SHA match referência? ${match ? '✅ SIM (idêntico ao SharePoint)' : '⚠️  DIFERENTE'}`);

  console.log('\n=== [1/6] RESET COMPLETO SQLite ===');
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(SQLITE_PATH));
  const r = [
    db.run('DELETE FROM "Recurso TRT" WHERE rowid >= 2'),
    db.run(`DELETE FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%' AND (value LIKE '%TRT%' OR value LIKE '%JULHO%' OR value LIKE '%recurso_trt%')`),
    db.run(`DELETE FROM imported_row_hashes WHERE kind = 'recurso_trt' OR kind LIKE '%trt%'`),
    db.run(`DELETE FROM import_batch_rows WHERE kind = 'recurso_trt'`),
    db.run(`DELETE FROM import_batches WHERE kind = 'recurso_trt'`),
  ];
  console.log(`  Apagados: lixo=${r[0].getRowsModified()}  L2=${r[1].getRowsModified()}  L1=${r[2].getRowsModified()}  batch_rows=${r[3].getRowsModified()} batches=${r[4].getRowsModified()}`);
  // Salvar
  fs.writeFileSync(SQLITE_PATH, Buffer.from(db.export()));
  db.close();
  console.log('  ✅ SQLite salvo e resetado.\n');

  console.log('=== [2/6] Health backend HTTP ===');
  const h = await req('GET', '/automation/health/geral', null, 3000).catch(e => ({ status: 'ERR:' + e.message }));
  console.log('  status:', h.status, '\n');

  console.log('=== [3/6] DISPARO POST /debug-oneshot-tre-import LOCAL ===');
  console.log('  localPath:', LOCAL_TRT);
  console.log('  forceKind: recurso_trt  (vai cair no strictWhitelist pipeline 10 cols)');
  const t0 = Date.now();
  let oneshotResp;
  try {
    oneshotResp = await req('POST', '/debug-oneshot-tre-import', {
      localXlsxPath: LOCAL_TRQ, // typo intencional para depois corrigir
      fallbackLocalPath: LOCAL_TRT,
      fileId: 'debug-local-' + Date.now(),
      parentFolderId: 'debug-local-parent',
      forceKind: 'recurso_trt',
      fileName: 'TRT-JULHO-2026.xlsx',
      sourceFolderPath: '9.Recuperação de Crédito/2026/Julho/Relatório Orgão/TRT',
      mode: 'append',
    }, 180000);
  } catch (e) {
    console.log('  ERRO:', e.message);
  }
  // Corrigir typo LOCAL_TRQ → LOCAL_TRT e re-enviar
  const t1 = Date.now();
  console.log(`  (primeira tentativa ${((Date.now()-t0)/1000).toFixed(1)}s, corrigindo e re-enviando...)\n`);
  oneshotResp = await req('POST', '/debug-oneshot-tre-import', {
    localXlsxPath: LOCAL_TRT,
    fileId: 'debug-local-trt-oneshot-' + t1,
    parentFolderId: '017U2I3T7JVLMHSBF2TNALR33C34GM2BCG', // TRT parent real
    forceKind: 'recurso_trt',
    fileName: 'TRT-JULHO-2026.xlsx',
    folderPath: '9.Recuperação de Crédito/2026/Julho/Relatório Orgão/TRT',
    mode: 'append',
    resetStateFirst: true,
  }, 300000);
  const dt = ((Date.now() - t1) / 1000).toFixed(1);
  console.log(`  ⏱️  Tempo oneshot: ${dt}s  |  status HTTP: ${oneshotResp.status}`);
  console.log('  Response body (até 4000 chars):');
  const bodyStr = JSON.stringify(oneshotResp.body || oneshotResp.raw || {});
  console.log('  ' + bodyStr.slice(0, 4000) + (bodyStr.length > 4000 ? '... (truncado)' : ''));
  console.log();

  console.log('=== [4/6] DEBUG L30002 BACKEND: ler logs do terminal 5 para VER flags, headers, rows ===');
  console.log('  (logs devem estar no output do processo node dist/main que está rodando no terminal 5)\n');

  console.log('=== [5/6] VALIDAÇÃO SQL FINAL: rowid>=2 Recurso TRT ===');
  const SQL2 = await initSqlJs();
  const db2 = new SQL2.Database(fs.readFileSync(SQLITE_PATH));
  const pragma = db2.exec('PRAGMA table_info("Recurso TRT")')[0];
  const colsOrder = pragma ? pragma.values.map(r => ({ cid: Number(r[0]), name: String(r[1]) })) : [];
  console.log(`  Colunas tabela: ${colsOrder.length}`);

  const allRows = db2.exec(`SELECT rowid, * FROM "Recurso TRT" WHERE rowid >= 2 ORDER BY rowid`)[0];
  if (!allRows || allRows.values.length === 0) {
    console.log('  ❌ NENHUMA LINHA NOVA (rowid>=2) inserida!');
    console.log('  COUNT total Recurso TRT:', db2.exec('SELECT COUNT(*) FROM "Recurso TRT"')[0].values[0][0]);
  } else {
    const cols = allRows.columns;
    for (const row of allRows.values) {
      const rowid = row[cols.indexOf('rowid')];
      console.log(`\n  ━━━━━━━━━━━━━━━ rowid=${rowid} ━━━━━━━━━━━━━━━`);
      let score = 0, total = 0, extras = 0;
      for (const col of colsOrder) {
        const idx = cols.indexOf(col.name);
        const v = idx >= 0 ? row[idx] : null;
        const vs = v === null || v === undefined ? 'NULL' : String(v);
        let mark = '  ', extra = '';
        if (col.cid <= 9) {
          total++;
          const exp = EXPECTED_072026[col.name];
          if (exp !== undefined) {
            const ok = (vs === String(exp));
            mark = ok ? '✅' : '❌';
            if (ok) score++;
            else extra = `  ← esperado "${exp}"`;
          }
        } else if (col.cid >= 15 && col.cid <= 29) {
          if (v !== null && vs.trim() !== '') { extras++; mark = '🔹'; } else { mark = '⬜'; }
        }
        const vp = vs.length > 45 ? vs.slice(0, 42) + '...' : vs;
        console.log(`  ${mark} CID${String(col.cid).padStart(2,'0')}  ${col.name.padEnd(28)} → ${vp}${extra}`);
      }
      console.log(`\n  🎯 Resultado rowid=${rowid}: 10 cols PRINCIPAIS=${score}/${total}  |  EXTRAS CID15-29 não nulas=${extras}/16`);
      if (score === total) console.log('  🎉🎉🎉 SUCESSO 10/10 cols principais PERFEITAS! 🎉🎉🎉');
    }
  }

  // Counts hashes pós-job
  const cL1 = db2.exec("SELECT COUNT(*) FROM imported_row_hashes WHERE kind = 'recurso_trt'")[0].values[0][0];
  const cL2 = db2.exec("SELECT COUNT(*) FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%' AND (value LIKE '%TRT%' OR value LIKE '%JULHO%' OR value LIKE '%recurso_trt%')")[0].values[0][0];
  console.log(`\n  Hashes pós-job: L1=${cL1}, L2=${cL2}`);
  db2.close();

  console.log('\n=== [6/6] FIM. Lembre-se de checar os DEBUG LOGS L30002 no terminal do backend (terminal 5).');
  process.exit(0);
}

main().catch(e => { console.error('\n❌ ERRO FATAL:', e); process.exit(1); });
