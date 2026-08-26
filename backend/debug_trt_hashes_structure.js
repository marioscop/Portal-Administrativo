const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'consignado.sqlite');
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  console.log('=== Estrutura das tabelas de hash ===');
  for (const t of ['imported_row_hashes', 'import_batches', 'import_batch_rows']) {
    try {
      const r = db.exec(`PRAGMA table_info("${t}")`);
      console.log(`\n[${t}] columns:`);
      if (r.length) for (const c of r[0].values) console.log('  ', c[1], c[2]);
      else console.log('  (tabela não existe ou vazia)');
    } catch(e) { console.log('  ', t, 'erro:', e.message); }
  }

  // Procurar entradas para TRT-JULHO nas 3 tabelas (buscar LIKE em todas as colunas text)
  console.log('\n=== Procurar referências a TRT-JULHO ===');
  const pattern = '%TRT-JULHO%';
  for (const t of ['imported_row_hashes', 'import_batches', 'import_batch_rows']) {
    try {
      // Get text columns
      let cols = [];
      const rr = db.exec(`PRAGMA table_info("${t}")`);
      if (rr.length) cols = rr[0].values.filter(c => String(c[2]||'').toUpperCase().includes('TEXT') || String(c[2]||'').toUpperCase().includes('VARCHAR')).map(c => c[1]);
      if (cols.length === 0) { console.log(`[${t}] sem colunas text`); continue; }
      const where = cols.map(c => `"${c}" LIKE '${pattern}'`).join(' OR ');
      const q = db.exec(`SELECT * FROM "${t}" WHERE ${where} LIMIT 10`);
      let count = 0;
      if (q.length) count = q[0].values.length;
      console.log(`[${t}] ${count} linhas com TRT-JULHO`);
      if (count > 0) {
        console.log('  colunas:', q[0].columns);
        for (const row of q[0].values.slice(0, 3)) {
          console.log('  →', JSON.stringify(row));
        }
      }
    } catch(e) { console.log(`[${t}] erro:`, e.message); }
  }

  // Também procurar por __source_file em Recurso TRT e obter o valor exato para apagar os hashes corretos
  console.log('\n=== __source_file valores na Recurso TRT ===');
  try {
    const q = db.exec(`SELECT DISTINCT "__source_file" FROM "Recurso TRT"`);
    if (q.length) for (const r of q[0].values) console.log('  src=', r[0]);
  } catch(e) {}

  db.close();
})();
