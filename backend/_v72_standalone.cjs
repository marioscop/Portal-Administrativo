/* standalone sql.js, APENAS com PM2 PARADO (regra de ouro). Limpa SHA256 cfg NEOCONSIG + L2 + batches. Perfil neoconsig. Count ANTES/DEPOIS tabelas Recurso *. */
const fs=require('fs');
const initSqlJs = require('/var/www/html/Portal-Administrativo/backend/node_modules/sql.js/dist/sql-wasm.js');
const DB='/var/www/html/Portal-Administrativo/backend/data/consignado.sqlite';
(async()=>{
  const SQL=await initSqlJs();
  const buf=fs.readFileSync(DB);
  const db=new SQL.Database(buf);
  const q=s=>{try{return (db.exec(s)||[])[0]?.values||[];}catch(e){console.log('!ERR '+s.slice(0,140)+' -> '+e.message);return [];}};
  console.log('=== perfil recurso_neoconsig_demais ===');
  q("SELECT id,kind,match_url_contains,file_name_regex,target_table,options_json FROM import_learning_profiles WHERE id='recurso_neoconsig_demais'").forEach(r=>{
    ['id','kind','match_url_contains','file_name_regex','target_table'].forEach((k,i)=>console.log('  '+k.padEnd(20)+' = '+String(r[i])));
    console.log('  options_json snippet  = '+String(r[5]).slice(0,1000));
  });
  console.log('\n=== SHAREPOINT app_config ===');
  q("SELECT key, substr(value,1,300) FROM consignado_app_config WHERE key IN ('SHAREPOINT_FOLDER_URL','SHAREPOINT_IMPORTED_FOLDER','SHAREPOINT_RELATORIO_SUBFOLDER') OR key LIKE 'SHAREPOINT_%SUBFOLDER%' OR key LIKE 'notificationTeamsDelegated%' OR key LIKE 'AZURE_%'").forEach(r=>console.log('  '+String(r[0]).padEnd(42)+' = '+String(r[1]).replace(/[\r\n\t]+/g,' ').slice(0,260)));

  // LIMPEZA
  const shaBefore=Number((q("SELECT COUNT(1) c FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%' AND (value LIKE '%NEOCONSIG%' OR value LIKE '%Demais%')")[0]||[0])[0]);
  db.run("DELETE FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%' AND (value LIKE '%NEOCONSIG%' OR value LIKE '%Demais%')");
  const l2Before=Number((q("SELECT COUNT(1) c FROM imported_row_hashes WHERE kind='recurso_neoconsig_demais'")[0]||[0])[0]);
  db.run("DELETE FROM imported_row_hashes WHERE kind='recurso_neoconsig_demais'");
  const ibBefore=Number((q("SELECT COUNT(1) c FROM import_batches WHERE kind='recurso_neoconsig_demais'")[0]||[0])[0]);
  db.run("DELETE FROM import_batch_rows WHERE batch_id IN (SELECT batch_id FROM import_batches WHERE kind='recurso_neoconsig_demais')");
  db.run("DELETE FROM import_batches WHERE kind='recurso_neoconsig_demais'");

  const tabs=q("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Recurso %' ORDER BY name");
  let total=0; tabs.flat().forEach(t=>{let c=0;try{c=Number((q('SELECT COUNT(1) c FROM "'+t.replace(/"/g,'""')+'"')[0]||[0])[0]);}catch{}total+=c;if(c>0)console.log('  '+t.padEnd(45)+' = '+String(c).padStart(5));});
  console.log('\nTOTAL Recurso * = '+total);
  console.log('relatorio_consignado = '+Number((q('SELECT COUNT(1) c FROM relatorio_consignado')[0]||[0])[0]));
  const l2After=Number((q("SELECT COUNT(1) c FROM imported_row_hashes WHERE kind='recurso_neoconsig_demais'")[0]||[0])[0]);
  const shaAfter=Number((q("SELECT COUNT(1) c FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%' AND (value LIKE '%NEOCONSIG%' OR value LIKE '%Demais%')")[0]||[0])[0]);
  const ibAfter=Number((q("SELECT COUNT(1) c FROM import_batches WHERE kind='recurso_neoconsig_demais'")[0]||[0])[0]);
  console.log('SHA256 cfg NEOCONSIG: BEFORE='+shaBefore+' AFTER='+shaAfter);
  console.log('L2 hashes recurso_neoconsig_demais: BEFORE='+l2Before+' AFTER='+l2After);
  console.log('import_batches neoconsig: BEFORE='+ibBefore+' AFTER='+ibAfter);

  const out=db.export();fs.writeFileSync(DB,Buffer.from(out));db.close();
  console.log('\nDB salvo em disco (standalone, PM2 parado, safe).');
})();