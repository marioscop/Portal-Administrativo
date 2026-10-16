const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async () => {
  const SQL = await initSqlJs();
  const cwd = process.cwd();
  const dbPath = path.join(cwd, 'data', 'consignado.sqlite');
  if (!fs.existsSync(dbPath)) { console.log('❌ DB não existe em '+dbPath); process.exit(1); }
  const before = fs.statSync(dbPath);
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);
  db.exec("PRAGMA journal_mode=OFF;");
  console.log('=== Passo 1/4: Remover perfis antigos (extratos_tre_go, extratos_tre_trt_go) se existirem ===');
  const del = db.run("DELETE FROM import_learning_profiles WHERE id IN ($id1, $id2);", {
    $id1: 'extratos_tre_go',
    $id2: 'extratos_tre_trt_go',
  });
  console.log('  DELETE afetou ' + (del.getRowsModified ? del.getRowsModified() : '?') + ' linha(s)');

  console.log('=== Passo 2/4: UPSERT perfil novo extratos_tre_trt_go (atende TRE e TRT) ===');
  const opts = JSON.stringify({
    isTreExtratoProfile: true,
    isJusticaEleitoralTrabalhoProfile: true,
    mode: 'append',
    checkDuplicateContent: true,
    match_priority: 'high',
    __source: 'deploy_20260825_tre_trt_perfil',
  });
  const nowUnix = Math.floor(Date.now() / 1000);
  const url = '/99-Automações_TI/9.Recuperação de Crédito/';
  const ins = db.run(
    "INSERT INTO import_learning_profiles (id, kind, match_url_contains, file_name_regex, target_table, options_json, created_at, updated_at) VALUES ($id, $kind, $url, $regex, $target, $opts, $ca, $ua);",
    {
      $id: 'extratos_tre_trt_go',
      $kind: 'extratos',
      $url: url,
      $regex: '.*(TRE|TRT).*\\.(xlsx|xlsm|xls)$',
      $target: 'extratos',
      $opts: opts,
      $ca: nowUnix,
      $ua: nowUnix,
    }
  );
  console.log('  INSERT OK (afetou ' + (ins.getRowsModified ? ins.getRowsModified() : '?') + ' linha)');

  console.log('=== Passo 3/4: Persistir SQLite arquivo de volta (SALVAR NO DISCO) ===');
  const newData = db.export();
  const newBuf = Buffer.from(newData);
  fs.writeFileSync(dbPath, newBuf);
  const after = fs.statSync(dbPath);
  console.log('  SQLite persistido em disco: antes=' + before.size + ' bytes → depois=' + after.size + ' bytes');

  console.log('=== Passo 4/4: SELECT confirmar perfis finais ===');
  const rows = db.exec("SELECT id, kind, file_name_regex, target_table, options_json FROM import_learning_profiles WHERE id IN ('extratos_tre_trt_go','extratos_tre_go','extratos_recurso') ORDER BY id ASC;");
  if (!rows[0] || rows[0].values.length === 0) { console.log('  ❌ NENHUM perfil encontrado.'); process.exit(2); }
  const cols = rows[0].columns;
  for (const r of rows[0].values) {
    const id = String(r[cols.indexOf('id')]);
    const kind = String(r[cols.indexOf('kind')]);
    const regex = String(r[cols.indexOf('file_name_regex')]);
    const target = String(r[cols.indexOf('target_table')]);
    let optsStr = '';
    try { const raw = JSON.parse(String(r[cols.indexOf('options_json')]||'{}')); optsStr = Object.entries(raw).filter(([k])=>['isTreExtratoProfile','isJusticaEleitoralTrabalhoProfile','mode','checkDuplicateContent','match_priority'].includes(k)).map(([k,v])=>k+'='+JSON.stringify(v)).join(' '); } catch {}
    console.log('  [OK] id='+id.padEnd(30)+' kind='+kind.padEnd(15)+' target='+target.padEnd(15)+' regex='+regex.padEnd(42)+' '+optsStr);
  }
  const achou = rows[0].values.find(r => String(r[cols.indexOf('id')]) === 'extratos_tre_trt_go');
  if (!achou) { console.log('\n  ❌ FALHA: extratos_tre_trt_go não encontrado após INSERT (UPSERT falhou).'); process.exit(3); }
  console.log('\n  ✅ ✅ ✅ PERFIL PERMANENTE extratos_tre_trt_go (TRE + TRT) UPSERTADO NO SQLITE PRODUÇÃO COM SUCESSO ✅ ✅ ✅');
  process.exit(0);
})();
