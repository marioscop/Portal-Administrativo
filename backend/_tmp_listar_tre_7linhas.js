const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
initSqlJs().then(SQL => {
  const db = new SQL.Database(fs.readFileSync(path.join(__dirname, 'data', 'consignado.sqlite')));
  console.log('=== TODAS linhas Recurso TRE (cols principais + extras cruas) ===\n');
  const stmt = db.prepare('SELECT rowid, Nome, CPF, Contrato, [N Parcela], [Qtd Parcelas], [Valor Parcela], [Matrícula], Rubrica, Prazo, Valor FROM "Recurso TRE" ORDER BY rowid');
  let idx = 0;
  while (stmt.step()) {
    const r = stmt.getAsObject();
    idx++;
    console.log(`#${idx} rowid=${r.rowid}`);
    console.log(`  Nome=${JSON.stringify(r.Nome)} | CPF=${JSON.stringify(r.CPF)}`);
    console.log(`  Contrato=${JSON.stringify(r['Contrato'])} | N=${JSON.stringify(r['N Parcela'])} | Qtd=${JSON.stringify(r['Qtd Parcelas'])} | ValorParc=${JSON.stringify(r['Valor Parcela'])}`);
    console.log(`  [Extras Excel cru] Matricula=${JSON.stringify(r['Matrícula'])} | Rubrica=${JSON.stringify(r['Rubrica'])} | Prazo=${JSON.stringify(r['Prazo'])} | Valor=${JSON.stringify(r['Valor'])}`);
    console.log('');
  }
  stmt.free();
  console.log(`Total rows listed: ${idx}`);
  db.close();
}).catch(e => { console.error(e); process.exit(1); });
