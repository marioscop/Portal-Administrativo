const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const dbFilePath = path.join(__dirname, 'data', 'consignado.sqlite');
console.log('DB path:', dbFilePath, 'exists=', fs.existsSync(dbFilePath));
if (!fs.existsSync(dbFilePath)) { process.exit(1); }

(async () => {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbFilePath);
  const db = new SQL.Database(fileBuffer);

  const q = (sql, params=[]) => {
    const s = db.prepare(sql); try { s.bind(params); const out=[]; while(s.step()) { out.push(s.getAsObject()); } return out; } finally { s.free(); }
  };

  const JOB = 'import_mt8wiqbq6048409514316aa6';

  console.log('\n=== 1) import_batches WHERE source_url LIKE ? ou batch_id = ? ===');
  try {
    const rows = q(`SELECT * FROM import_batches ORDER BY created_at DESC LIMIT 10;`);
    for (const r of rows) {
      const match = (String(r.source_url||'').includes('Julho') || String(r.source_url||'').includes('TRE') || String(r.batch_id||'')===JOB);
      console.log(JSON.stringify({...r, match}, null, 2));
    }
  } catch (e) { console.log('ERR', e.message); }

  console.log('\n=== 2) Tabelas de jobs existentes ===');
  try {
    const tables = q(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`);
    for (const t of tables) {
      const nm = String(t.name||'').toLowerCase();
      if (nm.includes('job') || nm.includes('batch') || nm.includes('event') || nm.includes('log') || nm.includes('import')) {
        try { const cnt = q(`SELECT COUNT(*) as c FROM "${t.name}"`); console.log(t.name, '→ rows=', cnt[0]?.c ?? '?'); } catch(e) { console.log(t.name, 'err', e.message); }
      }
    }
  } catch(e){console.log('ERR',e.message)}

  console.log('\n=== 3) import_learning_profiles (todos) ===');
  try {
    const ps = q(`SELECT id, kind, match_url_contains, file_name_regex, target_table FROM import_learning_profiles ORDER BY kind, id;`);
    for (const p of ps) console.log(JSON.stringify(p, null, 2));
    console.log('Total profiles:', ps.length);
  } catch (e) { console.log('ERR', e.message); }

  console.log('\n=== 4) colunas da tabela EXTRATOS ===');
  try { console.log(JSON.stringify(q(`PRAGMA table_info(extratos);`), null, 2)); } catch(e){console.log(e.message)}

  console.log('\n=== 5) contagem extratos por source_file LIKE TRE ===');
  try {
    const r = q(`SELECT COUNT(*) as c FROM extratos WHERE __source_file LIKE '%TRE%';`);
    console.log(r[0]);
    const r2 = q(`SELECT DATA, DOCUMENTO, HISTÓRICO, HISTÓRICO_1, VALOR, Copetencia, CompetenciaArquivo, __source_file FROM extratos WHERE __source_file LIKE '%TRE%' ORDER BY rowid DESC LIMIT 5;`);
    for (const x of r2) console.log(JSON.stringify(x, null, 2));
  } catch(e){console.log(e.message)}
})();
