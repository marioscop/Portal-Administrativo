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
  console.log('=== PASSO 1: Calcular SHA256 do arquivo Modelos/TRT-JULHO-2026.xlsx ===');
  const projRoot = path.resolve(__dirname, '..');
  const filePath = path.join(projRoot, 'Modelos', 'TRT-JULHO-2026.xlsx');
  console.log('  path =', filePath);
  if (!fs.existsSync(filePath)) { console.log('  ❌ Arquivo não existe!'); process.exit(1); }
  const buf = fs.readFileSync(filePath);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const size = buf.length;
  console.log('  size =', size, 'bytes');
  console.log('  SHA256 =', sha);

  console.log('\n=== PASSO 2: Procurar e apagar entrada no consignado_app_config ===');
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'consignado.sqlite');
  const db = new SQL.Database(fs.readFileSync(dbPath));
  const key = _computeImportedFileHashConfigKey(sha);
  console.log('  key =', key);

  // Verificar se tabela e chave existem
  let q;
  try {
    q = db.exec(`SELECT config_value FROM consignado_app_config WHERE config_key = ?`, [key]);
  } catch (e) {
    console.log('  Tabela consignado_app_config não existe? Erro:', e.message);
    // Tentar outra estrutura: verificar se existe tabela
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%config%' OR name LIKE '%app%'");
    if (tables.length) for (const t of tables[0].values) console.log('  tabela candidata:', t[0]);
    process.exit(1);
  }
  if (q.length && q[0].values.length) {
    console.log('  ✅ CHAVE ENCONTRADA! Valor:', q[0].values[0][0]?.slice(0, 200) || '(vazio)');
    db.run(`DELETE FROM consignado_app_config WHERE config_key = ?`, [key]);
    console.log('  APAGADA. rows changed:', db.getRowsModified());
  } else {
    console.log('  ⚠️  Chave NÃO encontrada com esse SHA256. Vamos listar TODAS as chaves imported_file_sha256: para encontrar a correta:');
    try {
      const all = db.exec(`SELECT config_key, config_value FROM consignado_app_config WHERE config_key LIKE '${IMPORTED_FILE_HASH_CONFIG_PREFIX}%' ORDER BY config_key DESC LIMIT 20`);
      if (all.length) for (const row of all[0].values) {
        const k = row[0];
        const v = String(row[1]||'').slice(0, 150);
        const isTRT = v.toUpperCase().includes('TRT') || k.includes('TRT');
        console.log('    ' + (isTRT ? '⭐ ' : '   ') + k + ' → ' + v);
      } else console.log('  (nenhuma)');
    } catch(e) { console.log('  erro listando:', e.message); }
    // Tentar apagar todas as que tem meta contendo TRT
    try {
      const del = db.run(`DELETE FROM consignado_app_config WHERE config_key LIKE '${IMPORTED_FILE_HASH_CONFIG_PREFIX}%' AND (config_value LIKE '%TRT-JULHO%' OR config_value LIKE '%recurso_trt%')`);
      console.log('  Apagadas por LIKE:', db.getRowsModified());
    } catch(e) {}
  }

  // Salvar banco
  const dbData = db.export();
  fs.writeFileSync(dbPath, Buffer.from(dbData));
  db.close();
  console.log('  SQLite salvo.');

  console.log('\n=== PASSO 3: REINICIAR BACKEND é OPCIONAL (pois é update direto, mas melhor por causa cache? — vamos reimportar direto) ===');

  console.log('\n=== PASSO 4: Reimportar SYNC target=recurso_trt (timeout 180s) ===');
  const folderUrl = 'https://sicoobjuriscredcelgbr.sharepoint.com/sites/PortaldeDocumentosSicoobJuriscred/Documents/Diretoria%20Administrativo/Tecnologia%20da%20Informa%C3%A7%C3%A3o/99-Automa%C3%A7%C3%B5es_TI/9.Recupera%C3%A7%C3%A3o%20de%20Cr%C3%A9dito';
  const t0 = Date.now();
  const r = await req('POST', '/api/consignado/import/sync', { folderUrl, target: 'recurso_trt', mode: 'append', modalidades: [] });
  const dt = ((Date.now() - t0)/1000).toFixed(1);
  console.log('HTTP STATUS =', r.statusCode, ' | tempo =', dt, 's');
  if (r.body?.importedFiles && r.body.importedFiles.length) {
    for (const f of r.body.importedFiles) {
      console.log('  Arquivo:', f.fileName);
      console.log('    insertedRows =', f.insertedRows, ' | skippedRows =', f.skippedRows, ' | skippedReason =', f.skippedReason || '(nenhum)');
    }
  } else {
    console.log('  body keys =', Object.keys(r.body||{}));
    console.log('  LOG:', JSON.stringify(r.body, null, 2).slice(0, 6000));
  }

  console.log('\n=== PASSO 5: Validar linha NOVA no SQL (deve ser rowid >= 2) ===');
  const SQL2 = await initSqlJs();
  const db2 = new SQL2.Database(fs.readFileSync(dbPath));
  const cols = db2.exec("PRAGMA table_info('Recurso TRT')")[0].values.map(c => c[1]);
  const cnt = db2.exec('SELECT COUNT(*) FROM "Recurso TRT"')[0].values[0][0];
  const maxId = db2.exec('SELECT MAX(rowid) FROM "Recurso TRT"')[0].values[0][0];
  console.log('  Total linhas tabela:', cnt, ' | Max rowid:', maxId);
  if (maxId >= 2) {
    const rows = db2.exec(`SELECT rowid, "${cols.join('","')}" FROM "Recurso TRT" WHERE rowid >= 2 ORDER BY rowid`);
    if (rows.length) for (const raw of rows[0].values) {
      const rowid = raw[0];
      const vals = raw.slice(1);
      console.log('\n  LINHA rowid=' + rowid + ':');
      let ok10 = 0;
      for (let i = 0; i < cols.length; i++) {
        const v = vals[i];
        const empty = (v === null || v === undefined || v === '');
        const tagExtra = i >= 15 ? ' [CID'+i+' EXTRA]' : '';
        const sv = empty ? '⚠️ NULL' : String(v);
        if (i < 10 && !empty) ok10++;
        console.log('    CID' + String(i).padStart(2,'0') + ' ' + cols[i] + tagExtra + ' = ' + (sv.length > 90 ? sv.slice(0,90) : sv));
      }
      console.log('\n  ✅ 10 cols base preenchidas =', ok10, '/10 (esperado 10/10)');
    }
  } else {
    console.log('  ⚠️  Nenhuma linha nova (max rowid < 2). importedFiles detalhados:');
    for (const f of (r.body?.importedFiles || [])) console.log('    ', JSON.stringify(f));
  }
  db2.close();
})();
