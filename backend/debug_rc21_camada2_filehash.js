const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

(async () => {
  const SQL = await initSqlJs();
  const sqlitePath = path.resolve(__dirname, 'data', 'consignado.sqlite');
  const backupPath = sqlitePath + '.pre_rc21_delete_filehash_' + new Date().toISOString().replace(/[:.]/g, '_');
  fs.copyFileSync(sqlitePath, backupPath);
  console.log('Backup prévio SQLite DEV:', backupPath);

  const buf = fs.readFileSync(sqlitePath);
  const db = new SQL.Database(buf);
  const PREFIX = 'imported_file_sha256::v1::';
  const CUTOFF = '2026-08-25T20:00:00';

  console.log('\n=== 1) Listando chaves imported_file_sha256::v1:: com at >= 25/08 20h ===');
  const stmtSel = db.prepare(`SELECT key, value, updated_at FROM consignado_app_config WHERE key LIKE ? ORDER BY updated_at ASC;`);
  stmtSel.bind([PREFIX + '%']);
  const rows = [];
  while (stmtSel.step()) {
    const r = stmtSel.getAsObject();
    let parsed = null;
    try { parsed = JSON.parse(String(r.value || '')); } catch {}
    const at = parsed?.at ?? '';
    if (at >= CUTOFF) {
      console.log('  MATCH (apagar):', r.key.slice(0, 60) + '...');
      console.log('    at =', at, '| meta.fileName =', parsed?.meta?.fileName ?? '?');
      rows.push({ key: String(r.key), at, fileName: parsed?.meta?.fileName ?? null });
    } else {
      console.log('  keep (anterior):', at, (parsed?.meta?.fileName ?? ''));
    }
  }
  stmtSel.free();

  console.log('\n=== 2) Total de chaves a apagar (camada-2 filehash):', rows.length);

  if (rows.length > 0) {
    console.log('\n=== 3) Apagando... ===');
    let delCount = 0;
    for (const r of rows) {
      const d = db.prepare(`DELETE FROM consignado_app_config WHERE key=?;`);
      d.run([r.key]);
      d.free();
      delCount++;
      console.log('  DELETE key prefix:', r.key.slice(0, 50) + '...', '| file:', r.fileName, '| at:', r.at);
    }
    console.log('  DELETE count =', delCount);

    const final = db.export();
    fs.writeFileSync(sqlitePath, Buffer.from(final));
    console.log('\n=== 4) SQLite salvo em disco:', sqlitePath, '=', final.byteLength, 'bytes ===');
  } else {
    console.log('\nNenhuma chave a apagar (talvez já tenha sido removida).');
  }
  db.close();
})();
