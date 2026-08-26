const http = require('http');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

function req(method, urlPath, bodyJson = undefined) {
  return new Promise((resolve, reject) => {
    const data = bodyJson ? Buffer.from(JSON.stringify(bodyJson), 'utf8') : null;
    const opts = {
      host: '127.0.0.1', port: 3000, path: urlPath, method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': data.length, Accept: 'application/json' }
                     : { Accept: 'application/json' },
      timeout: 180000,
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
  console.log('=== POST import/sync target=recurso_trt mode=append ===');
  console.log('  Timeout 180s...');
  const t0 = Date.now();
  const r = await req('POST', '/api/consignado/import/sync', {
    folderUrl,
    target: 'recurso_trt',
    mode: 'append',
    modalidades: [],
  });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('HTTP STATUS =', r.statusCode, ' | tempo =', dt, 's');
  console.log('TIPO body =', typeof r.body);
  if (r.body && typeof r.body === 'object') {
    console.log('KEYS:', Object.keys(r.body));
    // Se tiver detalhes imprimir tudo
    if (r.body.error) console.log('ERROR:', JSON.stringify(r.body.error, null, 2).slice(0, 3000));
    if (r.body.results) {
      console.log('results count:', r.body.results.length);
      for (const res of r.body.results) {
        console.log('  RESULT file:', res.file || res.fileName || res.sourceFile);
        console.log('    insertedRows=', res.insertedRows, 'skippedRows=', res.skippedRows);
        if (res.error) console.log('    ERROR:', String(res.error).slice(0, 1000));
        if (res.warnings && res.warnings.length) for (const w of res.warnings.slice(0, 8)) console.log('    WARN:', String(w).slice(0, 300));
      }
    } else {
      console.log('RAW body completo (12000 chars):', JSON.stringify(r.body, null, 2).slice(0, 12000));
    }
  } else {
    console.log('RAW (12000 chars):', (r.raw||'').slice(0, 12000));
  }

  console.log('\n=== SQLITE Final: Total Recurso TRT + MAX rowid ===');
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(path.join(__dirname, 'data', 'consignado.sqlite')));
  const cnt = db.exec('SELECT COUNT(*) FROM "Recurso TRT"')[0].values[0][0];
  const maxId = db.exec('SELECT MAX(rowid) FROM "Recurso TRT"')[0].values[0][0];
  console.log('  COUNT=', cnt, ' | MAX rowid=', maxId);
  if (maxId > 1) {
    const cols = db.exec("PRAGMA table_info('Recurso TRT')")[0].values.map(c=>c[1]);
    const row = db.exec(`SELECT rowid, "${cols.join('","')} FROM "Recurso TRT" WHERE rowid=${maxId}`)[0].values[0];
    console.log('\n  NOVA LINHA rowid=' + row[0]);
    for (let i = 1; i < cols.length; i++) {
      const v = row[i];
      const extra = i >= 15 ? ' [EXTRA]' : '';
      const empty = (v === null || v === undefined || v === '');
      console.log('    CID' + String(i-1).padStart(2,'0') + ' ' + cols[i-1] + extra + ' = ' + (empty ? '⚠️ NULL' : (String(v).length > 90 ? String(v).slice(0,90) : String(v))));
    }
  } else {
    console.log('  Nenhuma linha nova inserida (max rowid=1).');
  }
  db.close();
})();
