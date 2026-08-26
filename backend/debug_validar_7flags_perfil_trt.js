const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(path.resolve(__dirname, 'data', 'consignado.sqlite')));
  const s = db.prepare(`SELECT options_json,updated_at FROM import_learning_profiles WHERE id=? LIMIT 1;`);
  s.bind(['recurso_trt']);
  while (s.step()) {
    const r = s.getAsObject();
    const opt = JSON.parse(String(r.options_json));
    const whitelist = Array.isArray(opt.strictColumnWhitelist) ? opt.strictColumnWhitelist.length : 0;
    const checks = [
      ['[1/7] isRecursoTrtDefinitiveProfile', !!opt.isRecursoTrtDefinitiveProfile],
      ['[2/7] profileVersion', opt.profileVersion === '2026-08-25_RCAs1-21_RecursoTRT'],
      ['[3/7] competenciaMesArquivoSemIncremento', !!opt.competenciaMesArquivoSemIncremento],
      ['[4/7] keep16ExcelExtrasColumnas', !!opt.keep16ExcelExtrasColumnas],
      ['[5/7] strictColumnWhitelist 9 colunas', whitelist === 9],
      ['[6/7] extractCompetenciaFromFileName', !!opt.extractCompetenciaFromFileName],
      ['[7/7] moveToImportadosSubfolderAfterImport', !!opt.moveToImportadosSubfolderAfterImport],
    ];
    let ok = 0;
    for (const [nome, passou] of checks) {
      if (passou) ok++;
      console.log((passou ? '✅ ' : '❌ ') + nome);
    }
    console.log('\n🎯 Validação DEFINITIVA flags perfil recurso_trt =', ok, '/ 7 (esperado 7/7).');
    console.log('   strictColumnWhitelist (' + whitelist + ' colunas) =', JSON.stringify(opt.strictColumnWhitelist));
    console.log('   updated_at perfil =', r.updated_at);
  }
  s.free();
  db.close();
})();
