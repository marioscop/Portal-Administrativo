const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

(async () => {
  const SQL = await initSqlJs();
  const sqlitePath = path.resolve(__dirname, 'data', 'consignado.sqlite');
  const ts = new Date().toISOString().replace(/[:.]/g, '_');
  const backupPre = sqlitePath + '.pre_revert_sisbr_job3_' + ts;
  fs.copyFileSync(sqlitePath, backupPre);
  console.log('✅ [RB1] Backup prévio pós-job3 salvo:', backupPre);

  const buf = fs.readFileSync(sqlitePath);
  const db = new SQL.Database(buf);

  const CUTOFF_JOB3_UTC = '2026-08-25T23:45:00';

  console.log('\n=== [RB2] ANTES: relatorio_consignado rowid 4507-4513 (7 linhas do job3) ===');
  const stmtPreD = db.prepare(`SELECT rowid, EMPRESA, Cliente, "Operação", "Parcela", "Copetencia", "__source_file" FROM relatorio_consignado WHERE rowid BETWEEN 4507 AND 4513 ORDER BY rowid ASC;`);
  const preRows = [];
  while (stmtPreD.step()) preRows.push(stmtPreD.getAsObject());
  stmtPreD.free();
  for (const r of preRows) {
    console.log('  rowid=%s EMPRESA=%s Cliente=%s Op=%s Parc=%s Cop=%s src=%s', r.rowid, r.EMPRESA, r.Cliente, r['Operação'], r['Parcela'], r['Copetencia'], String(r['__source_file'] || '').slice(-50));
  }
  console.log('  COUNT rowid 4507-4513 =', preRows.length, '(esperado 7)');

  console.log('\n=== [RB2] DELETE relatorio_consignado rowid 4507-4513 ===');
  const delData = db.prepare(`DELETE FROM relatorio_consignado WHERE rowid BETWEEN 4507 AND 4513;`);
  delData.run();
  delData.free();
  console.log('  DELETE OK.');

  console.log('\n=== [RB3] Listar imported_row_hashes (camada-1) com at >= CUTOFF_JOB3 E kind LIKE learning_profile:%relatorio% ===');
  const PREFIX_HASH = 'learning_profile:';
  const stmtPreH = db.prepare(`SELECT rowid, kind, SUBSTR(kind, 1, 60) AS kind_short, imported_at, SUBSTR(CAST(row_hash AS TEXT), 1, 20) AS rh_prefix FROM imported_row_hashes WHERE (kind LIKE 'learning_profile:%relatorio_consignado%' OR kind LIKE 'learning_profile:%relatorios%' OR kind LIKE '%relatorio%') AND imported_at >= ? ORDER BY imported_at ASC;`);
  stmtPreH.bind([CUTOFF_JOB3_UTC]);
  const preH = [];
  while (stmtPreH.step()) preH.push(stmtPreH.getAsObject());
  stmtPreH.free();
  console.log('  Total camada-1 a apagar =', preH.length, '(esperado ~14/21 = 35? Ou 7 linhas relatorio_consignado)');
  for (const r of preH.slice(0, 10)) console.log('  rowid=%s kind=%s imported_at=%s rh=%s', r.rowid, r.kind_short, r.imported_at, r.rh_prefix);
  if (preH.length > 0) {
    const rids = preH.map((r) => Number(r.rowid));
    const placeholders = rids.map(() => '?').join(',');
    const delH = db.prepare(`DELETE FROM imported_row_hashes WHERE rowid IN (${placeholders});`);
    delH.run(rids);
    delH.free();
    console.log('  DELETE imported_row_hashes OK:', rids.length, 'linhas apagadas.');
  }

  console.log('\n=== [RB4] Listar consignado_app_config imported_file_sha256 (camada-2) com at >= CUTOFF_JOB3 ===');
  const APP_PREFIX = 'imported_file_sha256::v1::';
  const stmtPreF = db.prepare(`SELECT key, value, updated_at FROM consignado_app_config WHERE key LIKE ? ORDER BY updated_at ASC;`);
  stmtPreF.bind([APP_PREFIX + '%']);
  const preF = [];
  while (stmtPreF.step()) {
    const r = stmtPreF.getAsObject();
    let parsed = null;
    try { parsed = JSON.parse(String(r.value || '')); } catch {}
    const at = parsed?.at ?? '';
    if (at >= CUTOFF_JOB3_UTC) {
      preF.push({ key: String(r.key), at, fileName: (parsed?.meta?.fileName) ?? '?' });
    }
  }
  stmtPreF.free();
  console.log('  Total camada-2 a apagar =', preF.length, '(esperado 2: TRT.pdf + TRE-GO.pdf)');
  for (const r of preF) console.log('  key prefix=%s... at=%s file=%s', String(r.key).slice(0, 55), r.at, r.fileName);
  if (preF.length > 0) {
    let cnt = 0;
    for (const r of preF) {
      const delF = db.prepare(`DELETE FROM consignado_app_config WHERE key=?;`);
      delF.run([r.key]);
      delF.free();
      cnt++;
    }
    console.log('  DELETE consignado_app_config OK:', cnt, 'chaves apagadas.');
  }

  console.log('\n=== [RB5] Salvando SQLite em disco ===');
  const finalBuf = db.export();
  fs.writeFileSync(sqlitePath, Buffer.from(finalBuf));
  console.log('✅ SQLite salvo em disco:', sqlitePath, '=', finalBuf.byteLength, 'bytes');
  db.close();

  console.log('\n==========================================');
  console.log('  REVERSÃO JOB3 EXECUTADA (SQL).');
  console.log('  Backup prévio =', backupPre);
  console.log('  Próximo passo: rodar qualidade final para validar números.');
  console.log('==========================================');
})();
