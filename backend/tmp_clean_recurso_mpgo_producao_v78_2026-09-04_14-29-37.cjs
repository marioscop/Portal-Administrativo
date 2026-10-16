
const fs = require('fs');
const path = require('path');
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

  log('=== RECURSO MPGO LIMPEZA PRODUCAO v78 ===');
  const cols = getCols();
  log('Colunas ANTES ('+cols.length+'): '+cols.map(c=>c.cid+':'+c.name+'['+c.type+']').join(' | '));
  const totalAntes = countWhere('');
  const nulosNomeCpf = countWhere('Nome IS NULL OR Nome = \'\' OR CPF IS NULL OR CPF = \'\'');
  const nomeServ = countWhere('Nome = \'Nome do Servidor\'');
  const cpfPdfObj = countWhere('CPF LIKE \'%/Type /Pages%\' OR CPF LIKE \'%obj%<<%\' OR CPF LIKE \'%xref%\' OR CPF REGEXP \'^[0-9]+$\'');
  log('Total ANTES = '+totalAntes);
  log('Garbage Nome/CPF NULL = '+nulosNomeCpf);
  log('Nome = "Nome do Servidor" = '+nomeServ);
  log('CPF parece objeto PDF SheetJS = '+cpfPdfObj);

  // Delete garbage
  const r1 = db.run(`DELETE FROM "${TBL}" WHERE Nome IS NULL OR Nome = '' OR CPF IS NULL OR CPF = '' OR Nome = 'Nome do Servidor' OR CPF LIKE '%/Type /Pages%' OR CPF LIKE '%endobj%' OR CPF LIKE '%xref%' OR CPF LIKE '%<< /Type%'`);
  log('DELETE garbage - rows affected = '+db.getRowsModified());
  const totalDepoisDel = countWhere('');
  log('Total DEPOIS DELETE garbage = '+totalDepoisDel);

  // Drop colunas garbage UTF-8 / sem nome canônico (não estejam em CANONICOS)
  const CANONICOS = ['Nome do Servidor','Nome','CPF','Órgão','Entidade','Matricula','No ADE','Valor Parcela','No Parc','Data Inc','Data Fim','Vlr. ADE','Sit. Contrato','Sit. Parcela','Correspondente','Serviço','PGT','PRZ','Arquivo','DataIni','Data Início','Copetencia','Competencia','No. ADE','NoADE','Nº ADE'];
  let dropCount = 0;
  // Em SQLite não há DROP COLUMN em velhas versões sql.js? PRAGMA table_info retorna; então tentamos um por um com ALTER TABLE DROP COLUMN e toleramos erro
  for (const c of getCols()) {
    if (!CANONICOS.includes(c.name)) {
      try {
        db.run(`ALTER TABLE "${TBL}" DROP COLUMN "${c.name.replace(/"/g,'""')}"`);
        log('  DROP col OK: cid='+c.cid+' name='+c.name);
        dropCount++;
      } catch (e) {
        log('  DROP col SKIP/ERR: cid='+c.cid+' name='+c.name+' msg='+e.message);
      }
    }
  }
  log('Colunas dropadas = '+dropCount);
  const colsDepois = getCols();
  log('Colunas DEPOIS ('+colsDepois.length+'): '+colsDepois.map(c=>c.cid+':'+c.name).join(' | '));

  // 6. UPDATE competência 08/2026 → 09/2026 (REGRA NOVA recurso_mpgo mês+1 nome arquivo; aplica nas linhas CPF+NoParc+Valor não NULL que estavam 08/2026)
  const antes08 = countWhere(`Copetencia = '08/2026'`);
  const antes09 = countWhere(`Copetencia = '09/2026'`);
  const r2 = db.run(`UPDATE "${TBL}" SET Copetencia='09/2026' WHERE Copetencia='08/2026' AND CPF IS NOT NULL AND TRIM(CPF)<>'' AND "No Parc" IS NOT NULL AND TRIM("No Parc")<>'' AND "Valor Parcela" IS NOT NULL AND TRIM("Valor Parcela")<>''`);
  const atualizadas = db.getRowsModified();
  const depois08 = countWhere(`Copetencia = '08/2026'`);
  const depois09 = countWhere(`Copetencia = '09/2026'`);
  log('UPDATE competência 08→09 = '+atualizadas+' linhas (08/2026 antes='+antes08+' depois='+depois08+') (09/2026 antes='+antes09+' depois='+depois09+')');

  const nNome = countWhere('Nome IS NOT NULL AND TRIM(Nome)<>\'\'');
  const nCpf = countWhere('CPF IS NOT NULL AND TRIM(CPF)<>\'\'');
  const nDataFim = countWhere('"Data Fim" IS NOT NULL AND TRIM("Data Fim")<>\'\'');
  const nValor = countWhere('"Valor Parcela" IS NOT NULL AND TRIM("Valor Parcela")<>\'\'');
  log('Total FINAL = '+countWhere(''));
  log('09/2026 Nome OK = '+countWhere(`Copetencia='09/2026' AND Nome IS NOT NULL AND TRIM(Nome)<>''`));
  log('09/2026 CPF OK = '+countWhere(`Copetencia='09/2026' AND CPF IS NOT NULL AND TRIM(CPF)<>''`));
  log('09/2026 DataFim OK = '+countWhere(`Copetencia='09/2026' AND "Data Fim" IS NOT NULL AND TRIM("Data Fim")<>''`));
  log('Distribuição Competencia:');
  const dist = db.exec(`SELECT Copetencia, COUNT(*) c FROM "${TBL}" GROUP BY Copetencia ORDER BY c DESC LIMIT 6`);
  for (const x of (dist[0]?.values||[])) log('  Cop='+(x[0]||'NULL').padStart(8)+' count='+x[1]);

  const saved = Buffer.from(db.export());
  fs.writeFileSync(DB_PATH, saved);
  db.close();
  log('\nLIMPEZA DB FINALIZADA SUCESSO. Bytes DB = '+saved.length);
})().catch(e => { console.error('ERRO LIMPEZA DB:', e.message, e.stack ? e.stack.split('\n').slice(0,4).join(' | ') : ''); process.exit(1); });

