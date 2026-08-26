// Client HTTP oneshot LOCAL TRE: chama POST /api/consignado/debug-oneshot-tre-local (endpoint novo com função oneshot TRE LOCAL
const https = require('http');

const postData = JSON.stringify({
  fileNameInModelos: 'TRE-JULHO-2026.xlsx',
  resetHashesFirst: true,
  deleteLixoRowidsGte2: false,
  mode: 'append',
});

const req = https.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/consignado/debug-oneshot-tre-local',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
  timeout: 5 * 60 * 1000,
}, (res) => {
  let d = '';
  res.on('data', (c) => d += c);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    try {
      const j = JSON.parse(d);
      console.log(JSON.stringify({
        ok: j.ok,
        phase: j.phase,
        sha256: j.sha256 ? j.sha256.slice(0,16)+'...' : null,
        bufferBytes: j.bufferBytes,
        deletedLixoRowidsGte2: j.deletedLixoRowidsGte2,
        strictMatches: j.strictMatches,
        insertedRowsFinal: j.insertedRowsFinal,
        skippedRowsFinal: j.skippedRowsFinal,
        importedFilesLen: Array.isArray(j.importedFiles) ? j.importedFiles.length : null,
        firstFile: Array.isArray(j.importedFiles) && j.importedFiles.length > 0 ? {
          fileName: j.importedFiles[0].fileName,
          targetTable: j.importedFiles[0].targetTable,
          kind: j.importedFiles[0].kind,
          insertedRows: j.importedFiles[0].insertedRows,
          skippedRows: j.importedFiles[0].skippedRows,
          headers: j.importedFiles[0].headers,
        } : null,
        insertResult: j.insertResult ? {
          insertedRows: j.insertResult.insertedRows,
          skippedRows: j.insertResult.skippedRows,
          batchId: j.insertResult.batchId || null,
          duplicates: j.insertResult.duplicatesDetected || null,
        } : null,
        persistDb: j.persistDb,
        hint: j.hint || null,
      }, null, 2));
      if (j.error) console.log('\n=== ERROR STACK (últimas 40 linhas):\n', String(j.error).split('\n').slice(0, 40).join('\n'));
      if (j.pipelineError) console.log('\n=== PIPELINE ERROR:\n', String(j.pipelineError).split('\n').slice(0, 30).join('\n'));
    } catch (e) {
      console.log('RAW (len=' + d.length + '):', d.slice(0, 2000));
    }
  });
});
req.on('timeout', () => { console.error('TIMEOUT HTTP 5min'); req.destroy(); process.exit(2); });
req.on('error', (e) => { console.error('HTTP ERROR:', e.message); process.exit(1); });
req.write(postData);
req.end();
