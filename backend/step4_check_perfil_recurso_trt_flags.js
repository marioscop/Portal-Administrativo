const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'consignado.sqlite');
  const db = new SQL.Database(fs.readFileSync(dbPath));

  console.log('=== (1) PRAGMA import_learning_profiles ===');
  const info = db.exec("PRAGMA table_info(import_learning_profiles)");
  if (info.length) for (const c of info[0].values) console.log('  col:', c[1], c[2]);

  console.log('\n=== (2) TODAS as linhas da tabela ===');
  try {
    const rows = db.exec("SELECT id, kind, target_table, file_name_regex, options_json, updated_at FROM import_learning_profiles ORDER BY id");
    if (rows.length) for (const r of rows[0].values) {
      const id = r[0], kind = r[1], tt = r[2], fn = r[3], opt = r[4], upd = r[5];
      console.log('\n▓▓ PERFIL id=' + id + ' kind=' + kind + ' tt=' + tt + ' upd=' + upd + ' ▓▓');
      console.log('  fileNameRegex=', fn);
      try {
        const j = JSON.parse(opt || '{}');
        console.log('  options_json PARSED keys =', Object.keys(j).sort());
        console.log('  JSON PRETTY:');
        const sorted = {};
        for (const k of Object.keys(j).sort()) sorted[k] = j[k];
        console.log(JSON.stringify(sorted, null, 2));
      } catch(e) { console.log('  options_json ERRO parse:', e.message, ' raw=', String(opt||'').slice(0,400)); }
    }
  } catch(e) { console.log('ERRO:', e.message); }

  console.log('\n=== (3) FLAGS ESPERADAS OFFICIAL GRAVADAS 25/08 (hardcode): ===');
  console.log('  profileId = recurso_trt');
  console.log('  kind = recurso_trt');
  console.log('  flags obrigatórias pipeline 10 cols TRT:');
  console.log('    - extractCompetenciaFromFileName = true');
  console.log('    - competenciaMesArquivoSemIncremento = true');
  console.log('    - strictColumnWhitelistEnabled = true');
  console.log('    - strictColumnMinMatches = 5');
  console.log('    - descFinalidadeDefaultCreditoConsignado = true (R3/R10)');
  console.log('    - criterioDebitoPadraoFolhaPagto = true (R8)');
  console.log('    - vencimentoPadraoDia26MesCopetenciaAno2001 = true (R7)');
  console.log('    - contratoNormalizadoBrMilhar = true (R6)');
  console.log('    - ignoreImportados = true');
  console.log('    - checkDuplicateContent = true');
  console.log('    - moveToImportadosSubfolderAfterImport = true');

  db.close();
})();
