const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Importar funcoes de import-consignado.ts compiladas (dist) ou apenas replicar ensureDefaultLearningProfiles
// para o perfil especifico (upsert hardcoded igual). Como temos o sql.js, basta rodar o mesmo INSERT ON CONFLICT
// do codigo L6879-L6916, e depois SALVAR em disco o SQLite.

(async () => {
  const SQL = await initSqlJs();
  const sqlitePath = path.resolve(__dirname, 'data', 'consignado.sqlite');
  const buf = fs.readFileSync(sqlitePath);
  const db = new SQL.Database(buf);
  console.log('✅ SQLite carregado do disco:', sqlitePath);

  const PROFILE_ID = 'relatorio_orgao_sisbr';
  const now = new Date().toISOString();

  // === EXATA REPLICA DO HARDCODE L6879-L6916 ===
  const id = PROFILE_ID;
  const kind = 'relatorio';
  const matchUrlContains = '/99-Automa%C3%A7%C3%B5es_TI/9.Recupera%C3%A7%C3%A3o%20de%20Cr%C3%A9dito/';  // mesmo resultado de normalizeUrl()
  const fileNameRegex = '.*\\.(pdf|xlsx|xlsm|xls)$';
  const targetTable = 'relatorio_consignado';
  const options = {
    isRelatorioSisbrDefinitiveProfile: true,
    profileVersion: '2026-08-25_D5_RCAs1-21',
    sisbrParser: 'posicional_D5',
    sisbrVencimentoDefaultFromTitle: true,
    sisbrKeepTabsForAtividade: true,
    sisbr2VariantsCliente: true,
    sisbr2VariantsOperacao: true,
    sisbrSkipTotalsStrict: true,
    mode: 'append',
    folderCandidates: [
      'Relatórios de Órgão', 'Relatório de Órgão',
      'Relatorios de Orgao', 'Relatorio de Orgao',
      'Relatórios Orgão', 'Relatório Orgão',
      'Relatorios Orgao', 'Relatorio Orgao',
      'Relatório Sisbr', 'Relatorios Sisbr',
      'Sisbr', 'SISBR',
    ],
    ignoreImportados: true,
    checkDuplicateContent: true,
    strictColumnWhitelist: null,
    strictColumnMinMatches: 0,
    extractCompetenciaFromTopHeader: true,
    moveToImportadosSubfolderAfterImport: true,
  };
  const options_json = JSON.stringify(options);
  // Garantir que a tabela existe (se nao existir, criamos, mas DEVE existir)
  db.run(`CREATE TABLE IF NOT EXISTS import_learning_profiles (id TEXT PRIMARY KEY, kind TEXT NOT NULL, match_url_contains TEXT NOT NULL, file_name_regex TEXT NOT NULL, target_table TEXT NOT NULL, options_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);`);

  console.log('\n=== ANTES do upsert: dados do perfil id=' + id + ' ===');
  let s = db.prepare(`SELECT id, kind, file_name_regex AS fnr, target_table AS tt, substr(options_json, 1, 400) AS opt, created_at, updated_at FROM import_learning_profiles WHERE id=? LIMIT 1;`);
  s.bind([id]);
  while (s.step()) {
    const r = s.getAsObject();
    console.log('  id=%s kind=%s FNR=%s TT=%s CREATED=%s UPDATED=%s', r.id, r.kind, r.fnr, r.tt, r.created_at, r.updated_at);
    console.log('  OPT preview=%s', String(r.opt || ''));
  }
  s.free();

  console.log('\n=== Upsert (ON CONFLICT id DO UPDATE) perfil definitivo ===');
  const stmt = db.prepare(`INSERT INTO import_learning_profiles (id,kind,match_url_contains,file_name_regex,target_table,options_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,match_url_contains=excluded.match_url_contains,file_name_regex=excluded.file_name_regex,target_table=excluded.target_table,options_json=excluded.options_json,updated_at=excluded.updated_at;`);
  stmt.run([id, kind, matchUrlContains, fileNameRegex, targetTable, options_json, now, now]);
  stmt.free();

  console.log('\n=== DEPOIS do upsert: perfil novo ===');
  s = db.prepare(`SELECT id, kind, file_name_regex AS fnr, target_table AS tt, substr(options_json, 1, 500) AS opt, created_at, updated_at FROM import_learning_profiles WHERE id=? LIMIT 1;`);
  s.bind([id]);
  while (s.step()) {
    const r = s.getAsObject();
    console.log('  id=%s kind=%s FNR=%s TT=%s CREATED=%s UPDATED=%s', r.id, r.kind, r.fnr, r.tt, r.created_at, r.updated_at);
    console.log('  OPT preview=%s', String(r.opt || ''));
    const temPdf = String(r.fnr || '').includes('pdf');
    const temFlag = String(r.opt || '').includes('isRelatorioSisbrDefinitiveProfile');
    const temV = String(r.opt || '').includes('2026-08-25_D5_RCAs1-21');
    console.log('  ✅ fileNameRegex CONTEM pdf?  = %s', temPdf);
    console.log('  ✅ OPT CONTEM flag perfil def? = %s', temFlag);
    console.log('  ✅ OPT CONTEM versao perfil?   = %s', temV);
    if (temPdf && temFlag && temV) console.log('\n🎯 PERFIL DEFINITIVO SALVO CORRETAMENTE NO SQLITE DISCO.');
    else console.log('\n❌ ALGUM CAMPO ESPERADO NAO CONFERE.');
  }
  s.free();

  console.log('\n=== Salvando SQLite em disco (flush final) ===');
  const finalBuf = db.export();
  fs.writeFileSync(sqlitePath, Buffer.from(finalBuf));
  console.log('✅ SQLite salvo:', sqlitePath, '=', finalBuf.byteLength, 'bytes.');
  db.close();
})();
