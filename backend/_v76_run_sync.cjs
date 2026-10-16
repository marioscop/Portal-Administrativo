
require('dotenv').config({ path: '/var/www/html/Portal-Administrativo/backend/.env' });
process.on('unhandledRejection', (r) => { console.error('UNHANDLED_REJECTION', r instanceof Error ? r.stack : r); process.exit(2); });
process.on('uncaughtException', (e) => { console.error('UNCAUGHT_EXCEPTION', e.stack); process.exit(3); });
const ts0 = Date.now();
const log = (s) => console.log('[' + new Date().toISOString() + ' t+' + Math.round((Date.now()-ts0)/1000) + 's] ' + s);
log('CARREGANDO módulo import-consignado dist...');
const mod = require('/var/www/html/Portal-Administrativo/backend/dist/consignado/import-consignado.js');
log('MÓDULO carregado. runImportConsignado existe? ' + (typeof mod.runImportConsignado));
if (typeof mod.runImportConsignado !== 'function') { console.error('runImportConsignado NAO EXPORTADO! keys=', Object.keys(mod).slice(0,30)); process.exit(4); }
const opts = { target: 'recurso_neoconsig_demais', mode: 'append' };
log('CHAMANDO runImportConsignado com opts=' + JSON.stringify(opts));
mod.runImportConsignado(opts, {
  onProgressHook: (p) => {
    log('PROGRESSO: totalFilesScanned=' + (p.totalFilesScanned ?? '?') +
        ' totalFilesMatched=' + (p.totalFilesMatched ?? '?') +
        ' totalRowsInserted=' + (p.totalRowsInserted ?? '?') +
        ' totalRowsSkipped=' + (p.totalRowsSkipped ?? '?') +
        ' importedFiles=' + (p.importedFiles?.length || 0));
  }
}).then(result => {
  log('SUCESSO runImportConsignado finalizado! executed=' + result.executed);
  try {
    console.log('SUMMARY_JSON_START');
    console.log(JSON.stringify(result.summary, null, 2));
    console.log('SUMMARY_JSON_END');
    console.log('resultsPerKind_keys=' + Object.keys(result.resultsPerKind || {}).join(','));
    for (const k of Object.keys(result.resultsPerKind || {})) {
      const r = result.resultsPerKind[k];
      console.log('KIND_' + k + ': totalRowsInserted=' + (r.totalRowsInserted ?? r.rowsInserted ?? '?') + ' totalRowsSkipped=' + (r.totalRowsSkipped ?? r.rowsSkipped ?? '?') + ' filesImported=' + (r.filesImported?.length ?? r.importedFiles?.length ?? '?') + ' error=' + (r.error ? String(r.error).slice(0, 200) : 'null'));
    }
  } catch (e) { console.error('RESULT_SERIALIZE_ERR', e); }
  log('FIM total ' + Math.round((Date.now()-ts0)/1000) + 's. EXIT_OK=1');
  process.exit(0);
}).catch(e => {
  console.error('RUN_IMPORT_CONSIGNADO_ERR stack:', e instanceof Error ? (e.stack || e.message) : String(e));
  process.exit(5);
});
