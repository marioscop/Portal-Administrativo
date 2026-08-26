const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'consignado.sqlite');
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);
  // Confirmar tabela nao existe
  const t = db.exec(`SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name='Recurso TRE'`);
  console.log('Tabela Recurso TRE existe (0=dropado ok):', t[0]?.values[0][0]);
  // Limpar batches por kind apenas
  let r;
  try {
    r = db.run(`DELETE FROM import_batch_rows WHERE kind = 'recurso_tre'`);
    console.log('DELETE import_batch_rows TRE:', r.getRowsModified());
  } catch(e) { console.log('skip import_batch_rows:', e.message); }
  try {
    r = db.run(`DELETE FROM import_batches WHERE kind = 'recurso_tre'`);
    console.log('DELETE import_batches TRE:', r.getRowsModified());
  } catch(e) { console.log('skip import_batches:', e.message); }
  const outData = db.export();
  fs.writeFileSync(dbPath, Buffer.from(outData));
  console.log('SQLite persistido OK. Reexecute oneshot TRE agora: node job_local_tre_disparar_oneshot.js');
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
