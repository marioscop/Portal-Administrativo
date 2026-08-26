const crypto = require('crypto');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

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

const IMPORTED_FILE_HASH_CONFIG_PREFIX = 'imported_file_sha256:';
function _computeImportedFileHashConfigKey(sha256Hex) {
  return IMPORTED_FILE_HASH_CONFIG_PREFIX + sha256Hex;
}

(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'consignado.sqlite');
  const db = new SQL.Database(fs.readFileSync(dbPath));

  console.log('=== PASSO 1: Schema consignado_app_config ===');
  const info = db.exec("PRAGMA table_info(consignado_app_config)");
  let colKey = null, colVal = null;
  if (info.length) for (const c of info[0].values) {
    console.log('  coluna:', c[1], 'tipo:', c[2]);
    if (String(c[1]).toLowerCase().includes('key')) colKey = c[1];
    if (String(c[1]).toLowerCase().includes('val') || String(c[1]).toLowerCase().includes('data')) colVal = c[1];
  }
  console.log('  colKey =', colKey, ' | colVal =', colVal);
  if (!colKey || !colVal) { console.log('❌ Não achou colunas key/val'); process.exit(1); }

  console.log('\n=== PASSO 2: Procurar entrada SHA256 TRT-JULHO ===');
  const buf = fs.readFileSync(path.resolve(__dirname, '..', 'Modelos', 'TRT-JULHO-2026.xlsx'));
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const key = _computeImportedFileHashConfigKey(sha);
  console.log('  SHA256 =', sha);
  console.log('  key =', key);

  const q = db.exec(`SELECT "${colKey}", "${colVal}" FROM consignado_app_config WHERE "${colKey}" = ?`, [key]);
  let rowsChanged = 0;
  if (q.length && q[0].values.length) {
    console.log('  ✅ ENCONTRADA! Valor:', String(q[0].values[0][1]).slice(0, 300));
    db.run(`DELETE FROM consignado_app_config WHERE "${colKey}" = ?`, [key]);
    rowsChanged = db.getRowsModified();
    console.log('  Apagada key exata. rows changed:', rowsChanged);
  } else {
    console.log('  ⚠️  SHA256 local não bate. Vamos listar TODAS as keys imported:');
    const all = db.exec(`SELECT "${colKey}", "${colVal}" FROM consignado_app_config WHERE "${colKey}" LIKE ? ORDER BY "${colKey}" DESC LIMIT 20`, [IMPORTED_FILE_HASH_CONFIG_PREFIX + '%']);
    let targetKey = null;
    if (all.length) for (const row of all[0].values) {
      const k = row[0];
      const v = String(row[1] || '');
      const isTRT = v.toUpperCase().includes('TRT') || v.toUpperCase().includes('RECUPERA') || k.includes(sha.slice(0, 8));
      if (isTRT) { console.log('⭐ ', k, '→', v.slice(0, 250)); targetKey = k; }
      else console.log('   ', k, '→', v.slice(0, 120));
    } else console.log('  (nenhuma chave imported)');
    if (targetKey) {
      db.run(`DELETE FROM consignado_app_config WHERE "${colKey}" = ?`, [targetKey]);
      rowsChanged = db.getRowsModified();
      console.log('  Apagada por LIKE TRT. changed:', rowsChanged);
    } else {
      // Apagar TODAS as chaves de imported_file_sha256: que tem meta recurso_trt ou nome TRT
      const d = db.run(`DELETE FROM consignado_app_config WHERE "${colKey}" LIKE ? AND ("${colVal}" LIKE ? OR "${colVal}" LIKE ?)`, [IMPORTED_FILE_HASH_CONFIG_PREFIX + '%', '%recurso_trt%', '%TRT%']);
      rowsChanged = db.getRowsModified();
      console.log('  Apagadas por LIKE RECURSO_TRT/TOTAL. changed:', rowsChanged);
    }
  }

  const dbData = db.export();
  fs.writeFileSync(dbPath, Buffer.from(dbData));
  db.close();
  console.log('\nSQLite salvo. rowsChanged total apagar hash =', rowsChanged);

  console.log('\n=== PASSO 3: Importar SYNC target=recurso_trt (180s timeout) ===');
  const folderUrl = 'https://sicoobjuriscredcelgbr.sharepoint.com/sites/PortaldeDocumentosSicoobJuriscred/Documents/Diretoria%20Administrativo/Tecnologia%20da%20Informa%C3%A7%C3%A3o/99-Automa%C3%A7%C3%B5es_TI/9.Recupera%C3%A7%C3%A3o%20de%20Cr%C3%A9dito';
  const t0 = Date.now();
  const r = await req('POST', '/api/consignado/import/sync', { folderUrl, target: 'recurso_trt', mode: 'append', modalidades: [] });
  const dt = ((Date.now() - t0)/1000).toFixed(1);
  console.log('HTTP =', r.statusCode, ' | tempo =', dt, 's');
  if (r.body?.importedFiles) {
    for (const f of r.body.importedFiles) {
      console.log('  Arquivo:', f.fileName);
      console.log('    kind =', f.kind, ' | profileId =', f.profileId, ' | targetTable =', f.targetTable);
      console.log('    insertedRows =', f.insertedRows, ' | skippedRows =', f.skippedRows);
      console.log('    skippedReason =', f.skippedReason || '(nenhum)');
      if (f.headers && f.headers.length) console.log('    headers (10 primeiras):', f.headers.slice(0, 10).join(' | '));
    }
  } else {
    console.log('keys body =', Object.keys(r.body || {}));
    console.log('body preview =', JSON.stringify(r.body).slice(0, 6000));
  }

  console.log('\n=== PASSO 4: VALIDAÇÃO FINAL SQL Recurso TRT rowid >= 2 ===');
  const SQL2 = await initSqlJs();
  const db2 = new SQL2.Database(fs.readFileSync(dbPath));
  const cols = db2.exec("PRAGMA table_info('Recurso TRT')")[0].values.map(c => c[1]);
  const cnt = db2.exec('SELECT COUNT(*) FROM "Recurso TRT"')[0].values[0][0];
  const maxId = db2.exec('SELECT MAX(rowid) FROM "Recurso TRT"')[0].values[0][0];
  console.log('  Total linhas:', cnt, ' | max rowid:', maxId);
  if (maxId >= 2) {
    const rows = db2.exec(`SELECT rowid, "${cols.join('","')}" FROM "Recurso TRT" WHERE rowid >= 2 ORDER BY rowid`);
    if (rows.length) for (const raw of rows[0].values) {
      const rowid = raw[0];
      const vals = raw.slice(1);
      console.log('\n  ▬▬▬▬ LINHA rowid=' + rowid + ' ▬▬▬▬');
      let ok10 = 0, okExtras = 0, totalExtras = 0;
      for (let i = 0; i < cols.length; i++) {
        const v = vals[i];
        const empty = (v === null || v === undefined || v === '');
        const tagExtra = i >= 15 ? ' [CID'+i+' EXTRA]' : '';
        if (i >= 15) totalExtras++;
        const sv = empty ? '⚠️ NULL' : String(v);
        if (i < 10 && !empty) ok10++;
        if (i >= 15 && !empty) okExtras++;
        const colName = cols[i];
        const marker = (!empty && i < 10) ? '✅' : (empty && i < 10 ? '❌' : (!empty && i>=15 ? '✅' : (empty && i>=15 ? '⚠️' : '  ')));
        console.log('  ' + marker + ' CID' + String(i).padStart(2,'0') + ' ' + colName.padEnd(30) + tagExtra + ' → ' + (sv.length > 90 ? sv.slice(0,90) : sv));
      }
      console.log('\n  🏁 RESUMO: 10 cols base = ' + ok10 + '/10 (esperado 10) | Colunas extras CID15-29 = ' + okExtras + '/' + totalExtras + ' preenchidas (esperado ~16/16)');
    }
  } else {
    console.log('  ⚠️  Nenhuma linha nova (max rowid < 2)');
  }
  db2.close();
})();
