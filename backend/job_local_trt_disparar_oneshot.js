const http = require('http');

const payload = JSON.stringify({
  fileNameInModelos: 'TRT-JULHO-2026.xlsx',
  resetHashesFirst: true,
  deleteLixoRowidsGte2: true,
  mode: 'append'
});
const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/consignado/debug-oneshot-trt-local',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  },
  timeout: 240000
}, (res) => {
  let d = '';
  res.on('data', (c) => { d = d + c; });
  res.on('end', () => {
    console.log('STATUS HTTP =', res.statusCode);
    let j = null;
    try {
      j = JSON.parse(d);
      console.log('ok =', j.ok, 'phase =', j.phase);
      if (j.error) { console.log('ERROR =', String(j.error).slice(0, 600)); }
      if (j.pipelineError) { console.log('PIPELINE ERROR =\n', String(j.pipelineError).slice(0, 1500)); }
      console.log('insertedRowsFinal =', j.insertedRowsFinal, 'skippedRowsFinal =', j.skippedRowsFinal);
      if (j.importedFiles && j.importedFiles.length > 0) {
        for (let i = 0; i < j.importedFiles.length; i++) {
          console.log('  importedFiles[' + i + ']: insertedRows=' + j.importedFiles[i].insertedRows + ' skippedRows=' + j.importedFiles[i].skippedRows + ' skippedReason=' + j.importedFiles[i].skippedReason);
        }
      }
      console.log('profileId=', j.profileId, 'profileKind=', j.profileKind, 'targetTable=', j.profileTargetTable);
      if (j.profileOptionsKeys) { console.log('resolvedOptions keys:', j.profileOptionsKeys); }
      if (j.insertResult) { console.log('insertResult raw:', JSON.stringify(j.insertResult).slice(0, 300)); }
    } catch (e) {
      console.log('RAW RESPOSTA:\n', d.slice(0, 4000));
    }
    process.exit((res.statusCode === 201 || res.statusCode === 200) ? 0 : 2);
  });
});
req.on('error', (e) => { console.log('ERR HTTP:', e.message); process.exit(1); });
req.on('timeout', () => { console.log('TIMEOUT 240s'); req.destroy(); process.exit(3); });
req.write(payload);
req.end();
