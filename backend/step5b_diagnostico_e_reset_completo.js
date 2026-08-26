const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const SQLITE_PATH = path.join(__dirname, 'data', 'consignado.sqlite');

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(SQLITE_PATH);
  const db = new SQL.Database(buf);

  console.log('=== [1/3] Reset COMPLETO idempotência L1 + L2 + apagar rowids>=2 ===\n');

  // 1. Apagar linhas da Recurso TRT rowid >= 2
  const r1 = db.run('DELETE FROM "Recurso TRT" WHERE rowid >= 2');
  console.log(`  [LIXO] Apagados Recurso TRT rowid>=2: ${r1.getRowsModified()}`);

  // 2. Apagar hash L2 (SHA256 arquivo completo)
  const r2 = db.run(`DELETE FROM consignado_app_config
    WHERE key LIKE 'imported_file_sha256::v1::%'
      AND (value LIKE '%TRT%' OR value LIKE '%recurso_trt%' OR value LIKE '%JULHO%')`);
  console.log(`  [L2] Apagados hash L2 TRT: ${r2.getRowsModified()}`);
  // Também apagar TUDO L2 TRT para garantir
  const r2b = db.run(`DELETE FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::92eb501eea1c50566017aa7dae8565c504b5d71fe4ea5fb5eeee5a7294b42bce'`);
  console.log(`  [L2 SHA256 exato] Apagados: ${r2b.getRowsModified()}`);

  // 3. Apagar hashes L1 (por linha individual) kind recurso_trt
  const r3 = db.run(`DELETE FROM imported_row_hashes WHERE kind = 'recurso_trt'`);
  console.log(`  [L1] Apagados imported_row_hashes kind=recurso_trt: ${r3.getRowsModified()}`);

  // 4. Apagar batch_rows e batches recurso_trt
  const r4 = db.run(`DELETE FROM import_batch_rows WHERE kind = 'recurso_trt'`);
  console.log(`  [BATCH_ROWS] Apagados import_batch_rows recurso_trt: ${r4.getRowsModified()}`);
  const r5 = db.run(`DELETE FROM import_batches WHERE kind = 'recurso_trt'`);
  console.log(`  [BATCHES] Apagados import_batches recurso_trt: ${r5.getRowsModified()}`);

  // 5. Verificar counts finais
  const c1 = db.exec('SELECT COUNT(*) as c FROM "Recurso TRT"')[0].values[0][0];
  const c2 = db.exec("SELECT COUNT(*) as c FROM imported_row_hashes WHERE kind = 'recurso_trt'")[0].values[0][0];
  const c3 = db.exec("SELECT COUNT(*) as c FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%' AND value LIKE '%TRT%'")[0].values[0][0];
  console.log(`\n  Counts pós-reset:`);
  console.log(`    Recurso TRT linhas totais: ${c1} (esperado 1, só rowid=1 referência)`);
  console.log(`    imported_row_hashes recurso_trt: ${c2} (esperado 0)`);
  console.log(`    hash L2 TRT no app_config: ${c3} (esperado 0)`);

  // 6. Listar rowid=1 referência para confirmar intacta
  console.log(`\n=== [2/3] Linha referência rowid=1 (deve estar intacta 06/2026) ===`);
  const refRow = db.exec(`SELECT rowid, "Nome","CPF","Copetencia","Desc Finalidade","Contrato","N Parcela","Qtd Parcelas","Vencimento","Critério de Débito","Valor Parcela" FROM "Recurso TRT" WHERE rowid = 1`)[0];
  if (refRow && refRow.values.length) {
    const cols = refRow.columns;
    const v = refRow.values[0];
    cols.forEach((c, i) => {
      const mark = (v[i] !== null && v[i] !== undefined && v[i] !== '') ? '✅' : '⚠️';
      console.log(`  ${mark} ${c.padEnd(22)} → ${v[i]}`);
    });
  }

  // 7. Verificação crítica: o dist tem o RCA23 (alias mapping) e RCA24 (ordem canônica)?
  // Vamos procurar strings-chave no arquivo dist compilado
  console.log(`\n=== [3/3] Verificando se dist/ tem os edits RCA23 e RCA24 ===`);
  const distPath = path.join(__dirname, 'dist', 'consignado', 'import-consignado.js');
  if (fs.existsSync(distPath)) {
    const distContent = fs.readFileSync(distPath, 'utf8');
    console.log(`  dist/ existe, tamanho: ${(distContent.length/1024).toFixed(0)} KB`);

    // RCA23: alias mapping strings
    const rca23Markers = [
      'Funcionário',            // alias Nome
      'Parcela Atual',          // alias N Parcela
      'Contrato CGA',           // alias Contrato
      'headersToImportAlias',   // variável
      'aliasHeaderToCanonical', // função ou mapa
    ];
    console.log(`  RCA23 (alias mapping TRT) markers no dist:`);
    rca23Markers.forEach(m => {
      const found = distContent.includes(m);
      console.log(`    ${found ? '✅' : '❌'} "${m}" ${found ? 'presente' : 'AUSENTE'}`);
    });

    // RCA24: ordem canônica 10 cols
    const rca24Markers = [
      "'Nome','CPF','Copetencia'",
      'canonical10ColsOrder',
      'CID0 Nome',
      'canonicalBasePresent',
    ];
    console.log(`  RCA24 (reordenação canônica headers) markers no dist:`);
    rca24Markers.forEach(m => {
      const found = distContent.includes(m);
      console.log(`    ${found ? '✅' : '❌'} "${m}" ${found ? 'presente' : 'AUSENTE'}`);
    });

    // Regras R6/R7: Contrato vírgula BR, Vencimento 2001
    const ruleMarkers = [
      'normContratoBR',         // R6 vírgula contrato
      '2001',                   // R7 ano vencimento
      'competenciaMesArquivoSemIncremento', // perfil flag
      'vencimentoPadraoDia26',  // R7 nome regra
    ];
    console.log(`  Regras R6/R7/R8 markers no dist:`);
    ruleMarkers.forEach(m => {
      const found = distContent.includes(m);
      console.log(`    ${found ? '✅' : '❌'} "${m}" ${found ? 'presente' : 'AUSENTE'}`);
    });
  } else {
    console.log(`  ❌ dist/ NÃO EXISTE em ${distPath} → precisa rodar npm run build`);
  }

  // Salvar alterações
  const data = db.export();
  fs.writeFileSync(SQLITE_PATH, Buffer.from(data));
  db.close();
  console.log(`\n✅ SQLite salvo com sucesso.`);
}

main().catch(e => { console.error('ERRO FATAL:', e); process.exit(1); });
