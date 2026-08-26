const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'consignado.sqlite');
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  console.log('=== [1] ANTES: Total linhas Recurso TRT por Copetencia ===');
  let q = db.exec(`SELECT rowid, "Copetencia", "Nome", "CPF" FROM "Recurso TRT" ORDER BY rowid`);
  if (q.length) for (const r of q[0].values) console.log('  rowid', r[0], 'Cop=', r[1], 'Nome=', r[2] ? String(r[2]).slice(0,20) : null);

  console.log('\n=== [2] Apagar rowid=2 (referencia 07/2026 para reimportar limpo) — manter rowid=1 (06/2026) ===');
  db.run(`DELETE FROM "Recurso TRT" WHERE rowid IN (2)`);
  console.log('  changes:', db.getRowsModified());

  console.log('\n=== [3] Apagar hashes imported_row_hashes kind=recurso_trt ===');
  try { db.run(`DELETE FROM imported_row_hashes WHERE kind = ?`, ['recurso_trt']); console.log('  changes:', db.getRowsModified()); } catch(e) { console.log('  erro:', e.message); }
  try { db.run(`DELETE FROM imported_row_hashes WHERE kind = ?`, ['recurso_tre']); console.log('  tre changes:', db.getRowsModified()); } catch(e) {}

  console.log('\n=== [4] Apagar batches file_name contem TRT-JULHO OU kind=recurso_trt/recurso_tre ===');
  try {
    db.run(`DELETE FROM import_batch_rows WHERE kind IN ('recurso_trt','recurso_tre')`);
    console.log('  import_batch_rows changes:', db.getRowsModified());
    db.run(`DELETE FROM import_batches WHERE kind IN ('recurso_trt','recurso_tre') OR file_name LIKE ?`, ['%TRT-JULHO%']);
    console.log('  import_batches changes:', db.getRowsModified());
  } catch(e) { console.log('  erro:', e.message); }

  console.log('\n=== [5] DEPOIS: Tudo da Recurso TRT (deve ter 1 linha: rowid=1 06/2026) ===');
  q = db.exec(`SELECT rowid, "Nome", "CPF", "Copetencia", "Contrato", "Vencimento", "Valor Parcela", "__source_file" FROM "Recurso TRT" ORDER BY rowid`);
  if (q.length) for (const r of q[0].values) console.log('  rowid', r[0], '| Nome=', r[1] ? String(r[1]).slice(0,25) : null, '| Cop=', r[3], '| Contr=', r[4], '| Venc=', r[5], '| Valor=', r[6]);
  else console.log('  (VAZIA)');

  console.log('\n=== [6] Contagem hashes ===');
  for (const t of ['imported_row_hashes','import_batches','import_batch_rows']) {
    try {
      const rr = db.exec(`SELECT COUNT(*) FROM "${t}"`);
      if (rr.length) console.log(' ', t, '=', rr[0].values[0][0]);
    } catch(e) {}
  }

  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  db.close();
  console.log('\nSalvo em', dbPath, ' tamanho=', fs.statSync(dbPath).size);
})();
