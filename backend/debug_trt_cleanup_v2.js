const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'consignado.sqlite');
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  console.log('=== ANTES: Total linhas Recurso TRT ===');
  let q = db.exec(`SELECT rowid, "Copetencia", "Nome", "CPF", "__source_file" FROM "Recurso TRT" ORDER BY rowid`);
  if (q.length) for (const r of q[0].values) console.log('  rowid', r[0], 'Cop=', r[1], 'Nome=', r[2] ? String(r[2]).slice(0,20) : 'NULL', 'src=', r[4] ? String(r[4]).slice(0,40) : null);

  // APAGAR tudo exceto rowid=1
  console.log('\nApagar tudo exceto rowid=1...');
  db.run(`DELETE FROM "Recurso TRT" WHERE rowid != 1`);
  console.log('  changes:', db.getRowsModified());

  console.log('\n=== DEPOIS ===');
  q = db.exec(`SELECT rowid, "Copetencia", "Nome", "CPF" FROM "Recurso TRT" ORDER BY rowid`);
  if (q.length) for (const r of q[0].values) console.log('  rowid', r[0], 'Cop=', r[1], 'Nome=', String(r[2]||'').slice(0,20));
  else console.log('  VAZIA');

  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  db.close();
  console.log('\nSalvo. Tamanho:', fs.statSync(dbPath).size);
})();
