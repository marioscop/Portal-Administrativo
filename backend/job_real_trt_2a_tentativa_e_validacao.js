const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

function req(method, urlPath, bodyJson) {
  return new Promise((resolve, reject) => {
    const data = bodyJson ? Buffer.from(JSON.stringify(bodyJson), 'utf8') : null;
    const opts = {
      host: '127.0.0.1', port: 3000, path: urlPath, method: method, timeout: 120000,
      headers: data ? { 'Content-Type':'application/json', 'Content-Length': data.length, 'Accept':'application/json,text/event-stream' } : { 'Accept':'application/json' },
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = raw; try { if (raw.trim()) json = JSON.parse(raw); } catch {}
        resolve({ statusCode: res.statusCode, body: json, raw });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const SQL = await initSqlJs();
  const sqlitePath = path.resolve(__dirname, 'data', 'consignado.sqlite');
  const db = new SQL.Database(fs.readFileSync(sqlitePath));

  console.log('=== [1/3] RESET HASH imported_row_hashes e consignado_app_config para permitir reimport ===');
  // descobrir colunas reais da tabela
  const colsIRH = db.exec("PRAGMA table_info(imported_row_hashes);")[0]?.values ?? [];
  console.log('  imported_row_hashes cols =', JSON.stringify(colsIRH.map(c=>({CID:c[0],name:c[1]}))));
  const irhKeyMatch = colsIRH.map(c=>String(c[1])).find(n => /kind/i.test(n));
  const irhContentMatch = colsIRH.map(c=>String(c[1])).find(n => /content|hash|row/i.test(n)) || 'hash_val';
  console.log('  usar kind col:', irhKeyMatch, '| content/hash col:', irhContentMatch);
  const dels = [
    `DELETE FROM imported_row_hashes WHERE ${irhKeyMatch} LIKE '%Recurso TRT%' OR ${irhKeyMatch} LIKE '%learning_profile%TRT%';`,
    `DELETE FROM consignado_app_config WHERE "key" LIKE '%sha256%' OR "key" LIKE '%hash%' OR CAST(value AS TEXT) LIKE '%Recurso TRT%' OR CAST(value AS TEXT) LIKE '%TRT-JULHO%';`,
  ];
  for (const d of dels) { try { const s = db.prepare(d); s.step(); s.free(); console.log('  OK:', d.slice(0,120)); } catch(e) { console.log('  WARN (ignorar):', String(e.message||e).slice(0,200)); } }
  const fb = db.export();
  fs.writeFileSync(sqlitePath, Buffer.from(fb));
  db.close();
  console.log('  SQLite salvo=', sqlitePath, '=', fb.byteLength,'bytes.');

  console.log('\n=== [2/3] DISPARAR JOB REAL 2A TENTATIVA target=recurso_trt ===');
  const folderUrl =
    'https://sicoobjuriscredcelgbr.sharepoint.com/sites/PortaldeDocumentosSicoobJuriscred/Documents/Diretoria%20Administrativo/Tecnologia%20da%20Informa%C3%A7%C3%A3o/99-Automa%C3%A7%C3%B5es_TI/9.Recupera%C3%A7%C3%A3o%20de%20Cr%C3%A9dito';
  const r = await req('POST', '/api/consignado/import', { folderUrl, target: 'recurso_trt', mode: 'append', modalidades: [] });
  console.log('HTTP STATUS=', r.statusCode, '(esperado 202)');
  console.log('body=', JSON.stringify(r.body, null, 2).slice(0, 1500));
  if (!r.body || !r.body.jobId) { console.log('❌ Sem jobId. FIM.'); process.exit(1); }
  const jobId = r.body.jobId;
  const statusUrl = r.body.statusUrl;
  const maxSec = 120;
  for (let i = 0; i < maxSec; i += 2) {
    await new Promise((res) => setTimeout(res, 2000));
    const s = await req('GET', statusUrl);
    const b = s.body || {};
    const prog = b.progress || {};
    const sum = b.summary || {};
    const st = b.status || 'UNKNOWN';
    const evts = Array.isArray(b.events) ? b.events.slice(-2) : [];
    console.log(`[poll ${i+2}s/${maxSec}s] st=${st} prog=${JSON.stringify(prog)} ins=${sum.insertedRows ?? 0} skp=${sum.skippedRows ?? 0} err=${sum.error ?? 'null'}`);
    for (const ev of evts) {
      const t = typeof ev === 'string' ? ev : JSON.stringify(ev);
      console.log('  EVT:', t.length > 500 ? t.slice(0,500)+'…' : t);
    }
    if (['done','failed','cancelled','completed','succeeded'].includes(st)) break;
  }
  const jobFinal = await req('GET', statusUrl);
  console.log('\n=== JOB DETALHES FINAIS ===');
  console.log(JSON.stringify(jobFinal.body, null, 2).slice(0, 14000));

  console.log('\n=== [3/3] VALIDAR SQLITE Recurso TRT: rowid MAX + comparar rowid=2 referência ===');
  const SQL2 = await initSqlJs();
  const db2 = new SQL2.Database(fs.readFileSync(sqlitePath));
  const cnt = db2.exec('SELECT COUNT(*) AS c FROM "Recurso TRT";')[0].values[0][0];
  const maxR = db2.exec('SELECT MAX(rowid) FROM "Recurso TRT";')[0].values[0][0];
  console.log('Total linhas Recurso TRT =', cnt, '(esperado 3 → 2 originais + 1 nova hoje)');
  console.log('MAX rowid =', maxR, '(esperado 4 ou 5).');
  const cols = db2.exec("PRAGMA table_info('Recurso TRT');")[0].values;
  const colNames = cols.map(c => c[1]);
  const dezCols = ['Nome','CPF','Copetencia','Desc Finalidade','Contrato','N Parcela','Qtd Parcelas','Vencimento','Critério de Débito','Valor Parcela'];
  const rowRef2 = db2.exec(`SELECT "${dezCols.join('","')}" FROM "Recurso TRT" WHERE rowid=2 LIMIT 1;`)[0]?.values?.[0];
  const rowMax  = db2.exec(`SELECT rowid,"${colNames.join('","')}" FROM "Recurso TRT" WHERE rowid=${maxR} LIMIT 1;`)[0]?.values?.[0];
  console.log('\n--- Referência rowid=2 (10 principais) ---');
  const refMap = {};
  for (let i = 0; i < dezCols.length; i++) { refMap[dezCols[i]] = String(rowRef2?.[i] ?? 'NULL'); console.log('  REF ' + dezCols[i] + ' = ' + refMap[dezCols[i]]); }
  console.log('\n--- LINHA NOVA (rowid=' + maxR + ') todas colunas ---');
  let matches10 = 0;
  let extrasNaoNulos = 0;
  for (let i = 0; i < colNames.length; i++) {
    const nm = colNames[i];
    const val = rowMax?.[i];
    const isExtra = i >= 15 && i <= 29;
    const tag = isExtra ? ' [EXTRA CID'+i+']' : (i <= 9 ? ' [10 PRIN CID'+i+']' : ' [LEG COL_'+i+']');
    if (val === null || val === undefined || String(val) === '') {
      console.log('  ' + (isExtra ? '⚠️' : '⚠️') + ' ' + nm + tag + ' = NULL/VAZIO');
    } else {
      if (isExtra) extrasNaoNulos++;
      const sv = String(val);
      console.log('  ✅ ' + nm + tag + ' = ' + (sv.length>100?sv.slice(0,100)+'…':sv));
    }
    if (i <= 9) {
      const canon = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu,'').replace(/\s+/g,' ').trim().toUpperCase();
      if (canon(refMap[nm] ?? 'NULL') === canon(val ?? 'NULL_NOVO')) matches10++;
    }
  }
  console.log('\n🎯 RESUMO FINAL 10 colunas principais IGUAIS a ref rowid=2 = ' + matches10 + ' / 10 (esperado 10/10).');
  console.log('🎯 16 colunas extras (CID 15-29) NÃO NULL = ' + extrasNaoNulos + ' / 16 (esperado 14+/16).');
  db2.close();
})();
