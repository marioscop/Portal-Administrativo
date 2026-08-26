const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async () => {
  const SQL = await initSqlJs();
  const sqlitePath = path.resolve(__dirname, 'data', 'consignado.sqlite');
  const bak = sqlitePath + '.pre_fix_rowid3_trt_' + Date.now() + '.sqlite';
  fs.copyFileSync(sqlitePath, bak);
  console.log('✅ Backup prévio salvo:', bak);

  const db = new SQL.Database(fs.readFileSync(sqlitePath));
  console.log('\n=== ANTES: rowid=3 tabela Recurso TRT ===');
  let s = db.prepare(`SELECT rowid,Nome,CPF,Copetencia,Contrato FROM "Recurso TRT" WHERE rowid IN (2,3) ORDER BY rowid;`);
  while (s.step()) {
    const r = s.getAsObject();
    console.log('  rowid=' + r.rowid + ' Nome=' + r.Nome + ' CPF=' + r.CPF + ' Cop=' + r.Copetencia + ' Cont=' + r.Contrato);
  }
  s.free();
  console.log('\n=== DELETE rowid=3 (linha errada) ===');
  const d = db.prepare(`DELETE FROM "Recurso TRT" WHERE rowid=3;`);
  d.step();
  const deletedRows = d.getAsObject?.()?.changes ?? (function (){ const rs = db.exec('SELECT changes() AS c'); return rs[0]?.values?.[0]?.[0] ?? 0; })();
  d.free();
  console.log('  DELETE COUNT =', deletedRows);

  console.log('\n=== limpar hash do arquivo TRT-JULHO de imported_row_hashes / consignado_app_config (permitir reimport idempotente) ===');
  const del1 = db.prepare(`DELETE FROM imported_row_hashes WHERE kind LIKE ? OR row_content LIKE '%TRT-JULHO%' OR row_content LIKE '%LUIZ EDUARDO DA SILVA PARAGUASSU%';`);
  del1.bind(['learning_profile:Recurso TRT']);
  del1.step(); del1.free();
  const del2 = db.prepare(`DELETE FROM consignado_app_config WHERE key LIKE '%Recurso TRT%' OR key LIKE '%hash%' OR value LIKE '%TRT-JULHO%';`);
  del2.step(); del2.free();
  console.log('  limpo.');

  console.log('\n=== DEPOIS: COUNT linhas Recurso TRT + rowid MAX ===');
  const c1 = db.exec('SELECT COUNT(*) AS c FROM "Recurso TRT";')[0].values[0][0];
  const c2 = db.exec('SELECT MAX(rowid) FROM "Recurso TRT";')[0].values[0][0];
  console.log('  COUNT=', c1, ' MAX_rowid=', c2, '(esperado COUNT=2 MAX_rowid=2)');

  const fb = db.export();
  fs.writeFileSync(sqlitePath, Buffer.from(fb));
  db.close();
  console.log('\n✅ SQLite salvo em disco:', sqlitePath, '=', fb.byteLength, 'bytes.');
})();
