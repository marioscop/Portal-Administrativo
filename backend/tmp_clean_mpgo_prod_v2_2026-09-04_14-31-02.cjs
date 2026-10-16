
const fs = require('fs');
const initSqlJs = require('/var/www/html/Portal-Administrativo/backend/node_modules/sql.js');
const DB_PATH = '/var/www/html/Portal-Administrativo/backend/data/consignado.sqlite';
(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);
  const log = console.log.bind(console);
  const TBL = 'Recurso MPGO';

  const getCols = () => db.exec(`PRAGMA table_info("${TBL}")`)[0].values.map(r => ({cid:r[0], name:r[1], type:r[2]}));
  const countWhere = (where) => Number(db.exec(`SELECT COUNT(*) c FROM "${TBL}"${where?' WHERE '+where:''}`)[0].values[0][0]);

  log('=== RECURSO MPGO LIMPEZA v2 (sem REGEXP) ===');
  const cols = getCols();
  log('Colunas count = '+cols.length+': '+cols.map(c=>c.cid+':'+c.name).join(', '));
  const totalAntes = countWhere('');
  const nulosNomeCpf = countWhere("Nome IS NULL OR TRIM(Nome)='' OR CPF IS NULL OR TRIM(CPF)=''");
  const nomeServ = countWhere("Nome='Nome do Servidor'");
  const cpfPdfObj = countWhere("CPF LIKE '%/Type /Pages%' OR CPF LIKE '%endobj%' OR CPF LIKE '%xref%' OR CPF LIKE '%<< /Type%' OR CPF LIKE '%obj%<<%'");
  log('Total ANTES = '+totalAntes);
  log('Garbage Nome/CPF NULL = '+nulosNomeCpf);
  log('Nome = Nome do Servidor = '+nomeServ);
  log('CPF contem PDF object = '+cpfPdfObj);

  if ((nulosNomeCpf + nomeServ + cpfPdfObj) > 0) {
    const r1 = db.run(`DELETE FROM "${TBL}" WHERE Nome IS NULL OR TRIM(Nome)='' OR CPF IS NULL OR TRIM(CPF)='' OR Nome='Nome do Servidor' OR CPF LIKE '%/Type /Pages%' OR CPF LIKE '%endobj%' OR CPF LIKE '%xref%' OR CPF LIKE '%<< /Type%' OR CPF LIKE '%obj%<<%'`);
    log('DELETE garbage rows = '+db.getRowsModified());
  } else {
    log('SKIP delete — sem garbage detectado.');
  }

  // Competência: 08/2026 → 09/2026 (REGRA NOVA recurso_mpgo mês+1 nome arquivo)
  const antes08 = countWhere("Copetencia='08/2026'");
  const antes09 = countWhere("Copetencia='09/2026'");
  if (antes08 > 0) {
    const r2 = db.run(`UPDATE "${TBL}" SET Copetencia='09/2026' WHERE Copetencia='08/2026' AND CPF IS NOT NULL AND TRIM(CPF)<>'' AND "No Parc" IS NOT NULL AND TRIM("No Parc")<>'' AND "Valor Parcela" IS NOT NULL AND TRIM("Valor Parcela")<>''`);
    log('UPDATE 08/2026 → 09/2026 = '+db.getRowsModified()+' linhas (antes: 08='+antes08+' 09='+antes09+')');
  } else {
    log('SKIP update competência — zero linhas 08/2026.');
  }
  const depois08 = countWhere("Copetencia='08/2026'");
  const depois09 = countWhere("Copetencia='09/2026'");
  log('Depois: 08/2026 = '+depois08+' ; 09/2026 = '+depois09);

  log('Distribuição Competência final:');
  const dist = db.exec(`SELECT Copetencia, COUNT(*) c FROM "${TBL}" GROUP BY Copetencia ORDER BY c DESC LIMIT 8`);
  for (const x of (dist[0]?.values||[])) log('  Cop='+(x[0]||'NULL').padStart(8)+' count='+x[1]);
  log('09/2026 Nome+CPF OK = '+countWhere(`Copetencia='09/2026' AND Nome IS NOT NULL AND TRIM(Nome)<>'' AND CPF IS NOT NULL AND TRIM(CPF)<>''`));
  log('09/2026 DataFim OK = '+countWhere(`Copetencia='09/2026' AND "Data Fim" IS NOT NULL AND TRIM("Data Fim")<>''`));

  const totalFinal = countWhere('');
  log('Total FINAL = '+totalFinal);

  const saved = Buffer.from(db.export());
  fs.writeFileSync(DB_PATH, saved);
  db.close();
  log('\nLIMPEZA DB OK. DB bytes = '+saved.length);
})().catch(e => { console.error('ERRO LIMPEZA DB:', e.message, e.stack ? e.stack.split('\n').slice(0,4).join(' | ') : ''); process.exit(1); });

