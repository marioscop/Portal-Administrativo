const path=require('path'); const fs=require('fs'); const initSqlJs=require('sql.js');
const dbp = path.join(__dirname,'data','consignado.sqlite');
const JOB='import_mt8wiqbq6048409514316aa6';
(async () => {
 const SQL=await initSqlJs();
 const fb=fs.readFileSync(dbp); const db=new SQL.Database(fb);
 const q=(sql,p=[])=>{const s=db.prepare(sql);try{s.bind(p);const o=[];while(s.step())o.push(s.getAsObject());return o;}finally{s.free();}};

 console.log('\n=== import_learning_profiles ===');
 const ps=q('SELECT * FROM import_learning_profiles ORDER BY kind, id;');
 console.log('count=',ps.length);
 for(const p of ps) console.log(JSON.stringify(p,null,2));

 console.log('\n=== import_batches ULTIMOS 15 ===');
 const bs=q('SELECT batch_id, kind, target_table, file_name, source_url, mode, substr(created_at,1,19) as created_at FROM import_batches ORDER BY rowid DESC LIMIT 15;');
 for(const b of bs) console.log(JSON.stringify(b,null,2));

 console.log('\n=== Tabelas job/batch ===');
 const tbls=q("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%job%' OR name LIKE '%event%' OR name LIKE '%import%' OR name LIKE '%batch%' OR name LIKE '%log%') ORDER BY name;");
 for(const t of tbls){const nm=t.name;
 try{const cnt=q('SELECT COUNT(*) AS c FROM "'+nm+'"');console.log(nm,'rows=',cnt[0].c);}catch(e){console.log(nm,'err',e.message);}
 }

 console.log('\n=== JOBS tabela principal (import_jobs) OU schedules ===');
 try {
   const jobs=q('SELECT name FROM sqlite_master WHERE type="table" AND name LIKE "%job%" ORDER BY name;');
   console.log('job tables:', JSON.stringify(jobs));
   for (const jt of jobs) {
     try { const rows = q('SELECT * FROM "'+jt.name+'" ORDER BY rowid DESC LIMIT 3;');
       console.log(jt.name+':', JSON.stringify(rows,null,2)); } catch(e) { console.log(jt.name+' err:', e.message); }
   }
 } catch(e){console.log('err',e.message);}

 console.log('\n=== job events/progress buscar job_id ===');
 try {
   const evtTables = q("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%event%' OR name LIKE '%progress%' OR name LIKE '%scheduler%');");
   for (const t of evtTables) {
     try { const rows = q('SELECT * FROM "'+t.name+'" ORDER BY rowid DESC LIMIT 3;');
       console.log(t.name+':', JSON.stringify(rows,null,2)); } catch(e) { console.log(t.name+' err:', e.message); }
   }
 } catch(e){console.log('err',e.message);}
})();
