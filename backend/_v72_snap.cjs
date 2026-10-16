/* sql.js APENAS sobre CÓPIA do DB em /tmp (nunca DB original com PM2 rodando). */
const fs=require('fs');
const initSqlJs = require('/var/www/html/Portal-Administrativo/backend/node_modules/sql.js/dist/sql-wasm.js');
const SRC=process.env.DB_COPY||'/tmp/v72_snap.sqlite';
(async()=>{
  const SQL=await initSqlJs();
  const buf=fs.readFileSync(SRC);const db=new SQL.Database(buf);
  const q=s=>{try{return (db.exec(s)||[])[0]?.values||[];}catch(e){return [];}};
  const tabs=q("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Recurso %'");let t=0;
  tabs.flat().forEach(n=>{try{t+=Number((q('SELECT COUNT(1) FROM "'+n.replace(/"/g,'""')+'"')[0]||[0])[0]);}catch{}});
  const l2=Number((q("SELECT COUNT(1) c FROM imported_row_hashes WHERE kind='recurso_neoconsig_demais'")[0]||[0])[0]);
  const sh=Number((q("SELECT COUNT(1) c FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%' AND (value LIKE '%NEOCONSIG%' OR value LIKE '%Demais%')")[0]||[0])[0]);
  const rc=Number((q("SELECT COUNT(1) c FROM relatorio_consignado")[0]||[0])[0]);
  console.log('[SNAP '+new Date().toISOString()+'] TOTAL_Recurso='+t+' | L2_neoconsig='+l2+' | SHA256_cfg_neoconsig='+sh+' | relatorio_consignado='+rc);
  db.close();
})();