const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'consignado.sqlite');
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  console.log('=== [1] ANTES: Tudo da Recurso TRT ===');
  let q = db.exec(`SELECT rowid, "Nome", "CPF", "Copetencia", "Desc Finalidade", "Contrato", "N Parcela", "Qtd Parcelas", "Vencimento", "Critério de Débito", "Valor Parcela", "__source_file" FROM "Recurso TRT" ORDER BY rowid`);
  if (q.length) {
    for (const r of q[0].values) {
      console.log('  rowid', r[0], '| Nome=', r[1], '| CPF=', r[2], '| Cop=', r[3], '| Contr=', r[5], '| Venc=', r[8], '| Valor=', r[10]);
    }
  }

  console.log('\n=== [2] Apagar rowid=3 (tentativa deslocada anterior) ===');
  db.run(`DELETE FROM "Recurso TRT" WHERE rowid = 3`);
  console.log('  changes:', db.getRowsModified());

  console.log('\n=== [3] DELETAR hashes idempotentes (imported_row_hashes e import_batches) para arquivos TRT-JULHO ===');
  const sourceFilePattern = '%TRT-JULHO-2026%';
  db.run(`DELETE FROM imported_row_hashes WHERE source_file LIKE ?`, [sourceFilePattern]);
  console.log('  imported_row_hashes changes:', db.getRowsModified());
  db.run(`DELETE FROM import_batch_rows WHERE source_file LIKE ?`, [sourceFilePattern]);
  console.log('  import_batch_rows changes:', db.getRowsModified());
  db.run(`DELETE FROM import_batches WHERE source_file LIKE ?`, [sourceFilePattern]);
  console.log('  import_batches changes:', db.getRowsModified());

  // Também deletar SHA256 de camada-2 (content_hash) se existirem
  const fileBaseName = 'TRT-JULHO-2026.xlsx';
  const sha256L2 = crypto.createHash('sha256').update(fileBaseName).digest('hex');
  console.log('  SHA256(fileBaseName) L2 (RC21):', sha256L2);
  try {
    db.run(`DELETE FROM imported_row_hashes WHERE row_hash = ? OR content_hash = ?`, [sha256L2, sha256L2]);
    console.log('  L2 hash changes:', db.getRowsModified());
  } catch(e) {
    console.log('  (sem coluna content_hash ou erro, ignora):', e.message);
  }

  console.log('\n=== [4] DEPOIS: Tudo da Recurso TRT (deve só ter a linha ref rowid=2) ===');
  q = db.exec(`SELECT rowid, "Nome", "CPF", "Copetencia", "Desc Finalidade", "Contrato", "N Parcela", "Qtd Parcelas", "Vencimento", "Critério de Débito", "Valor Parcela", "__source_file" FROM "Recurso TRT" ORDER BY rowid`);
  if (q.length) {
    for (const r of q[0].values) {
      console.log('  rowid', r[0], '| Nome=', r[1], '| CPF=', r[2], '| Cop=', r[3], '| Contr=', r[5], '| Venc=', r[8], '| Valor=', r[10], '| src=', r[11] ? String(r[11]).slice(0,40) : null);
    }
  } else {
    console.log('  (VAZIA)');
  }

  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  db.close();
  console.log('\nSalvo em', dbPath);
})();
