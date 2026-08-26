const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const IMPORTED_PREFIX = 'imported_file_sha256::v1::';

async function apagarRowid2EHashL2() {
  console.log('=== [PREP] Apagar rowid=2 (se existir) e apagar hash L2 idempotencia ===');
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'consignado.sqlite');
  const db = new SQL.Database(fs.readFileSync(dbPath));
  db.run(`DELETE FROM "Recurso TRT" WHERE rowid >= 2`);
  console.log('  Apagados rowid >= 2:', db.getRowsModified());
  // Apagar hash L2 SHA256 TRT
  const shaFile = crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '..', 'Modelos', 'TRT-JULHO-2026.xlsx'))).digest('hex');
  const key1 = IMPORTED_PREFIX + shaFile;
  const key2 = 'imported_file_sha256:' + shaFile;
  db.run(`DELETE FROM consignado_app_config WHERE key IN (?, ?) OR value LIKE ? OR key LIKE '${IMPORTED_PREFIX}%' AND (value LIKE '%TRT%' OR value LIKE '%recurso_trt%')`, [key1, key2, '%TRT-JULHO%']);
  console.log('  Apagados hash L2 LIKE:', db.getRowsModified());
  const dat = db.export();
  fs.writeFileSync(dbPath, Buffer.from(dat));
  db.close();
  console.log('  SQLite salvo. SHA256 arquivo =', shaFile);
}

(async () => {
  await apagarRowid2EHashL2();

  console.log('\n=== [1/2] Carregando módulo dist/consignado/import-consignado.js (CÓDIGO COMPILADO BACKEND) ===');
  const dist = require('./dist/consignado/import-consignado.js');
  console.log('  Export keys principais:', Object.keys(dist).filter(k => /import|runImport|learn|folderUrl/i.test(k)).slice(0, 15));

  const folderUrl = 'https://sicoobjuriscredcelgbr.sharepoint.com/sites/PortaldeDocumentosSicoobJuriscred/Documents/Diretoria%20Administrativo/Tecnologia%20da%20Informa%C3%A7%C3%A3o/99-Automa%C3%A7%C3%B5es_TI/9.Recupera%C3%A7%C3%A3o%20de%20Cr%C3%A9dito';
  console.log('\n=== [2/2] Chamando importByLearningProfileFromFolderUrl (forceKind=recurso_trt) ===');
  console.log('  folderUrl:', folderUrl.slice(0, 80) + '...');
  const t0 = Date.now();

  const result = await dist.importByLearningProfileFromFolderUrl({
    folderUrl,
    forceKind: 'recurso_trt',
    forceMode: 'append',
  }, {
    onProgressHook: (p) => {
      const dt = ((Date.now() - t0) / 1000).toFixed(0);
      const fi = Array.isArray(p.importedFiles) ? p.importedFiles.map(f => f.fileName + ':' + f.insertedRows + '/' + f.skippedRows + (f.skippedReason ? '('+f.skippedReason.slice(0,80)+')' : '')).join(' | ') : '';
      console.log(`  [PROGRESS ${dt}s] scanned=${p.totalFilesScanned ?? '?'} matched=${p.totalFilesMatched ?? '?'} inserted=${p.totalRowsInserted ?? '?'} skipped=${p.totalRowsSkipped ?? '?'} files=[${fi}]`);
    }
  });
  const dt = ((Date.now() - t0)/1000).toFixed(1);
  console.log('\n=== RESULTADO FINAL (tempo=' + dt + 's) ===');
  console.log('  importedFiles count:', result.importedFiles?.length ?? 0);
  for (const f of (result.importedFiles || [])) {
    console.log('  →', f.fileName);
    console.log('    insertedRows=', f.insertedRows, 'skippedRows=', f.skippedRows, 'profileId=', f.profileId);
    console.log('    skippedReason=', f.skippedReason || '(nenhum)');
    if (f.headers && f.headers.length) console.log('    headers primeiras 10:', f.headers.slice(0, 10).join(' | '));
  }
  console.log('  totalRowsInserted=', result.totalRowsInserted, ' | totalRowsSkipped=', result.totalRowsSkipped);

  console.log('\n=== VALIDAÇÃO SQL Final Recurso TRT rowid >= 2 ===');
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(path.join(__dirname, 'data', 'consignado.sqlite')));
  const cols = db.exec("PRAGMA table_info('Recurso TRT')")[0].values.map(c => c[1]);
  const cnt = db.exec('SELECT COUNT(*) FROM "Recurso TRT"')[0].values[0][0];
  const maxId = db.exec('SELECT MAX(rowid) FROM "Recurso TRT"')[0].values[0][0];
  console.log('  COUNT:', cnt, ' | MAX rowid:', maxId);
  if (maxId >= 2) {
    const rows = db.exec(`SELECT rowid, "${cols.join('","')}" FROM "Recurso TRT" WHERE rowid >= 2 ORDER BY rowid`);
    if (rows.length) for (const raw of rows[0].values) {
      const rowid = raw[0];
      const vals = raw.slice(1);
      console.log('\n  ▬▬▬ LINHA rowid=' + rowid + ' ▬▬▬');
      let ok10=0, okEx=0, totEx=0;
      for (let i = 0; i < cols.length; i++) {
        const v = vals[i];
        const empty = (v === null || v === undefined || v === '');
        const tag = i >= 15 ? ' [CID'+i+' EXTRA]' : '';
        const sv = empty ? '⚠️ NULL' : String(v);
        if (i < 10 && !empty) ok10++;
        if (i >= 15) { totEx++; if (!empty) okEx++; }
        const marker = (!empty && i < 10) ? '✅' : (empty && i < 10 ? '❌' : (!empty && i>=15 ? '✅' : (empty && i>=15 ? '⚠️' : '  ')));
        console.log('  ' + marker + ' CID' + String(i).padStart(2,'0') + ' ' + cols[i].padEnd(30) + tag + ' → ' + (sv.length > 90 ? sv.slice(0,90) : sv));
      }
      console.log('\n  🏁 RESUMO FINAL: 10 cols base = ' + ok10 + '/10 (esperado 10/10) | 16 extras CID15-29 = '+okEx+'/'+totEx+' preenchidas.');
    }
  } else {
    console.log('  ⚠️  Nenhuma linha nova (max rowid < 2)');
  }
  db.close();
})();
