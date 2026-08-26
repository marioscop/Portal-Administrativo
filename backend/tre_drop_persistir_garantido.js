const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'consignado.sqlite');
  const buf = fs.readFileSync(dbPath);
  const backup = path.join(__dirname, `data/consignado.sqlite.pre_DROP_TRE_FINAL_${Date.now()}.sqlite`);
  fs.writeFileSync(backup, buf);
  console.log('BACKUP SQLite criado:', backup, (buf.length/1024/1024).toFixed(2)+' MB');
  const db = new SQL.Database(buf);
  const shaTRE = '965b2a12abd159c2b7053bdee8103d9888b0420f3534a602b4215ec4ae513993';
  const runSafe = (label, sql) => { try { const r = db.run(sql); console.log(`OK  ${label.padEnd(36)}: rows=${r.getRowsModified()}`); } catch(e) { console.log(`SKIP ${label.padEnd(36)}: ${e.message}`); } };
  const before = db.exec(`SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name='Recurso TRE'`)[0].values[0][0];
  console.log(`Tabela "Recurso TRE" ANTES (1=existe 0=nao): ${before}`);
  runSafe('DROP Recurso TRE',              `DROP TABLE IF EXISTS "Recurso TRE";`);
  runSafe('DEL L2 SHA TRE',                `DELETE FROM consignado_app_config WHERE key = 'imported_file_sha256::v1::${shaTRE}' OR key LIKE 'imported_file_sha256::v1::%TRE%'`);
  runSafe('DEL L1 row_hashes TRE',         `DELETE FROM imported_row_hashes WHERE kind LIKE '%recurso_tre%' OR kind LIKE '%Recurso TRE%'`);
  runSafe('DEL import_batch_rows TRE',     `DELETE FROM import_batch_rows WHERE kind = 'recurso_tre'`);
  runSafe('DEL import_batches TRE',        `DELETE FROM import_batches WHERE kind = 'recurso_tre'`);
  const after = db.exec(`SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name='Recurso TRE'`)[0].values[0][0];
  console.log(`Tabela "Recurso TRE" DEPOIS (1=existe 0=DROPADO): ${after}`);
  if (after !== 0) { console.error('ERRO: TABELA AINDA EXISTE!'); process.exit(2); }
  const outData = db.export();
  fs.writeFileSync(dbPath, Buffer.from(outData));
  console.log('✅ SQLite PERSISTIDO COM SUCESSO (drop + limpeza hashes).');
  console.log('Prox passo: node job_local_tre_disparar_oneshot.js  (agora addMissing vai recriar tabela ORDEM CANONICA CID00-CID09)');
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
