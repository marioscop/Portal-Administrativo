const http = require('http');

function req(method, urlPath, bodyJson = undefined) {
  return new Promise((resolve, reject) => {
    const data = bodyJson ? Buffer.from(JSON.stringify(bodyJson), 'utf8') : null;
    const opts = {
      host: '127.0.0.1', port: 3000, path: urlPath, method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': data.length, Accept: 'application/json' }
                     : { Accept: 'application/json' },
      timeout: 60000,
    };
    const rq = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = raw;
        try { if (raw.trim()) json = JSON.parse(raw); } catch {}
        resolve({ statusCode: res.statusCode, body: json, raw });
      });
    });
    rq.on('error', reject);
    if (data) rq.write(data);
    rq.end();
  });
}

(async () => {
  const folderUrl =
    'https://sicoobjuriscredcelgbr.sharepoint.com/sites/PortaldeDocumentosSicoobJuriscred/Documents/Diretoria%20Administrativo/Tecnologia%20da%20Informa%C3%A7%C3%A3o/99-Automa%C3%A7%C3%B5es_TI/9.Recupera%C3%A7%C3%A3o%20de%20Cr%C3%A9dito';
  console.log('=== POST debug-expand-extratos forceKind=recurso_trt ===');
  const r = await req('POST', '/api/consignado/debug-expand-extratos', { folderUrl, forceKind: 'recurso_trt' });
  console.log('HTTP =', r.statusCode);
  if (r.statusCode !== 200) { console.log('RAW:', (r.raw||'').slice(0,800)); process.exit(1); }
  const b = r.body || {};
  console.log('ok =', b.ok, 'error =', b.error || 'null');
  console.log('setup =', JSON.stringify(b.setup || {}));
  console.log('Total candidates =', b.len, ' | candidates array length =', Array.isArray(b.candidates) ? b.candidates.length : 'not-array');
  if (Array.isArray(b.candidates)) {
    console.log('\n--- TODOS OS ARQUIVOS CANDIDATOS A RECURSO TRT ---');
    for (const c of b.candidates) {
      const isTRTJulho = String(c.name || '').toUpperCase().includes('TRT-JULHO');
      const mark = isTRTJulho ? ' ⭐⭐⭐ ' : '  ';
      console.log(mark + c.name + ' | folderPath: ' + String(c.folderPath||'').slice(0, 100) + ' | id: ' + String(c.id||'').slice(0, 12) + ' | parentId: ' + String(c.parentId||'').slice(0, 10));
    }
    const trtFiles = b.candidates.filter(c => String(c.name||'').toUpperCase().includes('TRT'));
    console.log('\n--- Apenas arquivos com nome TRT --- total:', trtFiles.length);
    for (const c of trtFiles) console.log('  ', c.name, '| path:', c.folderPath, '| id:', c.id, '| parent:', c.parentId);
  } else {
    console.log('RAW candidates:', JSON.stringify(b.candidates).slice(0, 1000));
  }
})();
