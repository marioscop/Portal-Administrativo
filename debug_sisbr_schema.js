const initSqlJs = require('sql.js');
const fs = require('fs');
(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('backend/data/consignado.sqlite');
  const db = new SQL.Database(buf);
  console.log('=== PRAGMA table_info(relatorio_consignado) ===');
  const cols = db.exec('PRAGMA table_info(relatorio_consignado)');
  if (cols && cols[0]) {
    cols[0].values.forEach((r) => {
      const pk = r[5];
      console.log('  cid='+r[0]+'  name="'+r[1]+'"  type="'+r[2]+'"  notnull='+r[3]+'  default='+JSON.stringify(r[4])+'  pk='+pk);
    });
    console.log('Total colunas: '+cols[0].values.length);
  } else {
    console.log('Tabela NAO EXISTE no schema.');
  }
  console.log('');
  console.log('=== TOP 2 linhas existentes (valores exemplo) ===');
  const rows = db.exec('SELECT * FROM relatorio_consignado LIMIT 2');
  if (rows && rows[0]) {
    console.log('Columns (ordem SQL): '+JSON.stringify(rows[0].columns));
    rows[0].values.forEach((r, i) => {
      console.log('--- linha '+(i+1)+' ---');
      rows[0].columns.forEach((c, idx) => {
        const v = r[idx];
        if (typeof v === 'string' && v.length > 40) {
          console.log('  '+c+' = "'+v.slice(0,40)+'... ('+v.length+' chars)');
        } else {
          console.log('  '+c+' = '+JSON.stringify(v));
        }
      });
    });
  } else {
    console.log('Sem linhas na tabela.');
  }
  console.log('');
  console.log('=== Contagem total linhas ===');
  const cnt = db.exec('SELECT COUNT(*) AS c FROM relatorio_consignado');
  if (cnt && cnt[0] && cnt[0].values && cnt[0].values[0]) {
    console.log('COUNT = '+cnt[0].values[0][0]);
  }
  console.log('');
  console.log('=== Últimas 2 linhas (por rowid DESC) ===');
  const last = db.exec('SELECT rowid, * FROM relatorio_consignado ORDER BY rowid DESC LIMIT 2');
  if (last && last[0]) {
    console.log('Columns: '+JSON.stringify(last[0].columns));
    last[0].values.forEach((r, i) => {
      console.log('--- ultimas linha '+(i+1)+' rowid='+r[0]+' ---');
      last[0].columns.forEach((c, idx) => {
        if (idx === 0) return;
        const v = r[idx];
        const short = typeof v === 'string' && v.length > 36 ? v.slice(0, 36)+'...' : v;
        console.log('  '+c+' = '+JSON.stringify(short));
      });
    });
  }
  console.log('');
  console.log('=== Tabelas que existem no banco ===');
  const tbls = db.exec("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name");
  if (tbls && tbls[0]) {
    tbls[0].values.forEach((r) => console.log('  '+r[1]+' = '+r[0]));
  }
  db.close();
})().catch(e=>{console.error(e);process.exit(1);});
