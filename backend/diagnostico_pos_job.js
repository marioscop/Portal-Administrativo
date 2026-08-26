const http = require('http');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

function req(method, urlPath, bodyJson = undefined) {
  return new Promise((resolve, reject) => {
    const data = bodyJson ? Buffer.from(JSON.stringify(bodyJson), 'utf8') : null;
    const opts = {
      host: '127.0.0.1', port: 3000, path: urlPath, method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': data.length, Accept: 'application/json,text/event-stream' }
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
  console.log('=== [1] Status completo do job import_mt9geg1s66aea43dffcdd9e7 ===');
  const s = await req('GET', '/api/consignado/jobs/import_mt9geg1s66aea43dffcdd9e7');
  if (s.statusCode !== 200) { console.log('HTTP FAIL', s.statusCode, s.raw.slice(0, 300)); process.exit(1); }
  const b = s.body || {};
  console.log('  status =', b.status);
  console.log('  summary =', JSON.stringify(b.summary || null));
  console.log('  progress =', JSON.stringify(b.progress || null));
  console.log('  events count =', Array.isArray(b.events) ? b.events.length : 0);
  if (Array.isArray(b.events)) {
    for (let i = 0; i < Math.min(15, b.events.length); i++) {
      const ev = b.events[i];
      const line = typeof ev === 'string' ? ev : JSON.stringify(ev);
      console.log('  EVT['+i+']: ' + (line.length > 300 ? line.slice(0,300)+'…' : line));
    }
  }

  console.log('\n=== [2] Listar arquivos SharePoint pasta TRT (procurar TRT-JULHO) ===');
  const folderUrl = 'https://sicoobjuriscredcelgbr.sharepoint.com/sites/PortaldeDocumentosSicoobJuriscred/Documents/Diretoria%20Administrativo/Tecnologia%20da%20Informa%C3%A7%C3%A3o/99-Automa%C3%A7%C3%B5es_TI/9.Recupera%C3%A7%C3%A3o%20de%20Cr%C3%A9dito';
  const lr = await req('POST', '/api/consignado/list', { folderUrl, target: 'recurso_trt' });
  console.log('  HTTP status =', lr.statusCode);
  if (lr.body && Array.isArray(lr.body.files)) {
    const all = lr.body.files;
    console.log('  Total arquivos encontrados =', all.length);
    const trt = all.filter(f => String(f.name||'').toUpperCase().includes('TRT-JULHO'));
    console.log('  Arquivos TRT-JULHO =', trt.length);
    for (const f of trt.slice(0, 10)) console.log('   →', f.name, '| path:', String(f.path||'').slice(0,80), '| id:', String(f.id||'').slice(0,10));
    console.log('  Pastas/arquivos ignorados (Importados etc) =', lr.body.ignoredFolders ? lr.body.ignoredFolders.length : 0);
    if (lr.body.ignoredFolders) for (const ig of lr.body.ignoredFolders.slice(0, 10)) console.log('   IGN:', ig);
    // Mostrar todos os arquivos da pasta TRT especifica se achar
    const pastaTRT = all.filter(f => String(f.path||'').toUpperCase().includes('RELAT') && String(f.path||'').toUpperCase().includes('TRT'));
    if (pastaTRT.length) {
      console.log('  Arquivos em pasta Relatorio Orgao/TRT:');
      for (const f of pastaTRT) console.log('   →', f.name, ' | parent:', String(f.parentId||'').slice(0,8), ' path:', String(f.path||'').slice(0,100));
    }
  } else {
    console.log('  RAW (1200 chars):', (lr.raw || '').slice(0, 1200));
  }

  console.log('\n=== [3] Confirmação SQL: Recurso TRT (SEM BUG DE RELATÓRIO) ===');
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'consignado.sqlite');
  const db = new SQL.Database(fs.readFileSync(dbPath));
  const cols = db.exec("PRAGMA table_info('Recurso TRT');")[0].values.map(c => c[1]);
  console.log('  Colunas (CID0..' + (cols.length-1) + ') =', cols.join(' | '));
  const rows = db.exec(`SELECT rowid, "${cols.join('","')}" FROM "Recurso TRT" ORDER BY rowid`);
  if (rows.length) {
    for (const rawRow of rows[0].values) {
      const rowid = rawRow[0];
      const vals = rawRow.slice(1);
      console.log('\n  rowid=' + rowid + ' valores REAIS:');
      for (let i = 0; i < cols.length; i++) {
        const v = vals[i];
        const tagExtra = i >= 15 ? ' [CID'+i+' EXTRA]' : '';
        const empty = (v === null || v === undefined || v === '');
        console.log('    CID' + String(i).padStart(2,'0') + ' ' + cols[i] + tagExtra + ' = ' + (empty ? '⚠️ NULL' : (String(v).length > 90 ? String(v).slice(0,90)+'…' : String(v))));
      }
    }
  } else {
    console.log('  (VAZIA)');
  }
  db.close();
})();
