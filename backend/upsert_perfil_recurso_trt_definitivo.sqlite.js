const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async () => {
  const SQL = await initSqlJs();
  const sqlitePath = path.resolve(__dirname, 'data', 'consignado.sqlite');
  const buf = fs.readFileSync(sqlitePath);
  const db = new SQL.Database(buf);
  console.log('✅ SQLite carregado do disco.');

  const id = 'recurso_trt';
  const now = new Date().toISOString();
  const matchUrlContains = '/99-Automa%C3%A7%C3%B5es_TI/9.Recupera%C3%A7%C3%A3o%20de%20Cr%C3%A9dito/';
  const fileNameRegex = '.*TRT.*\\.(xlsx|xlsm|xls)$';
  const targetTable = 'Recurso TRT';
  const options = {
    isRecursoTrtDefinitiveProfile: true,
    profileVersion: '2026-08-25_RCAs1-21_RecursoTRT',
    competenciaMesArquivoSemIncremento: true,
    vencimentoPadraoDia26MesCopetenciaAno2001: true,
    criterioDebitoPadraoFolhaPagto: true,
    contratoNormalizadoBrMilhar: true,
    valorParcelaPrefixoRSimbolo: true,
    nomeUpperTrimSpSimples: true,
    cpfMascara11dig: true,
    descFinalidadeDefaultCreditoConsignado: true,
    fillDown8Cols: true,
    keep16ExcelExtrasColumnas: true,
    mode: 'append',
    folderCandidates: ['Relatório Orgão/TRT', 'Relatorio Orgao/TRT', 'TRT'],
    ignoreImportados: true,
    checkDuplicateContent: true,
    strictColumnWhitelist: ['Nome','CPF','Desc Finalidade','Contrato','N Parcela','Qtd Parcelas','Vencimento','Critério de Débito','Valor Parcela'],
    strictColumnMinMatches: 5,
    extractCompetenciaFromTopHeader: true,
    extractCompetenciaFromFileName: true,
    moveToImportadosSubfolderAfterImport: true,
  };
  const options_json = JSON.stringify(options);

  console.log('\n=== ANTES: perfil id=' + id + ' ===');
  let s = db.prepare(`SELECT id,kind,file_name_regex AS fnr,target_table AS tt, substr(options_json,1,500) AS opt,created_at,updated_at FROM import_learning_profiles WHERE id=? LIMIT 1;`);
  s.bind([id]);
  let created = null;
  while (s.step()) {
    const r = s.getAsObject();
    console.log('  id=' + r.id + ' kind=' + r.kind + ' FNR=' + r.fnr + ' TT=' + r.tt + ' CREATED=' + r.created_at + ' UPDATED=' + r.updated_at);
    console.log('  opt_preview=' + String(r.opt || ''));
    created = r.created_at;
  }
  s.free();

  if (!created) created = now;
  console.log('\n=== Upsert ON CONFLICT (id) perfil definitivo recurso_trt ===');
  const stmt = db.prepare(`INSERT INTO import_learning_profiles (id,kind,match_url_contains,file_name_regex,target_table,options_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,match_url_contains=excluded.match_url_contains,file_name_regex=excluded.file_name_regex,target_table=excluded.target_table,options_json=excluded.options_json,updated_at=excluded.updated_at;`);
  stmt.run([id,'recurso_trt',matchUrlContains,fileNameRegex,targetTable,options_json,created,now]);
  stmt.free();

  console.log('\n=== DEPOIS: perfil id=' + id + ' ===');
  s = db.prepare(`SELECT id,kind,file_name_regex AS fnr,target_table AS tt, substr(options_json,1,600) AS opt,created_at,updated_at FROM import_learning_profiles WHERE id=? LIMIT 1;`);
  s.bind([id]);
  let ok = 0;
  while (s.step()) {
    const r = s.getAsObject();
    console.log('  id=' + r.id + ' kind=' + r.kind + ' FNR=' + r.fnr + ' TT=' + r.tt + ' CREATED=' + r.created_at + ' UPDATED=' + r.updated_at);
    console.log('  opt_preview=' + String(r.opt || ''));
    const opt = String(r.opt || '');
    const flags = [
      ['isRecursoTrtDefinitiveProfile', /isRecursoTrtDefinitiveProfile["':\s]*true/],
      ['profileVersion', /2026-08-25_RCAs1-21_RecursoTRT/],
      ['competenciaMesArquivoSemIncremento', /competenciaMesArquivoSemIncremento["':\s]*true/],
      ['keep16ExcelExtrasColumnas', /keep16ExcelExtrasColumnas["':\s]*true/],
      ['strictColumnWhitelist 9 colunas', /strictColumnWhitelist["':\s]*\[["'\w\u00C0-\u00FF\s,.\/\\-]{30,}\]/],
      ['extractCompetenciaFromFileName', /extractCompetenciaFromFileName["':\s]*true/],
      ['moveToImportadosSubfolderAfterImport', /moveToImportadosSubfolderAfterImport["':\s]*true/]
    ];
    for (const [nome, re] of flags) {
      const tem = re.test(opt);
      if (tem) ok++;
      console.log('  ' + (tem ? '✅' : '❌') + ' ' + nome);
    }
  }
  s.free();

  console.log('\n=== Salvando SQLite em disco ===');
  const fb = db.export();
  fs.writeFileSync(sqlitePath, Buffer.from(fb));
  db.close();
  console.log('✅ SQLite salvo em disco =', sqlitePath, '=', fb.byteLength, 'bytes.');
  console.log('\n🎯 Validação flags definitivas =', ok, '/ 7 (esperado 7/7).');
})();
