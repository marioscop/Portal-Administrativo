const http = require('http');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

function req(method, urlPath, bodyJson = undefined) {
  return new Promise((resolve, reject) => {
    const data = bodyJson ? Buffer.from(JSON.stringify(bodyJson), 'utf8') : null;
    const opts = {
      host: '127.0.0.1',
      port: 3000,
      path: urlPath,
      method: method,
      headers: data
        ? {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            Accept: 'application/json,text/event-stream',
          }
        : { Accept: 'application/json' },
      timeout: 90000,
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = raw;
        try { if (raw.trim()) json = JSON.parse(raw); } catch { /* keep string */ }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: json, raw });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const folderUrl =
    'https://sicoobjuriscredcelgbr.sharepoint.com/sites/PortaldeDocumentosSicoobJuriscred/Documents/Diretoria%20Administrativo/Tecnologia%20da%20Informa%C3%A7%C3%A3o/99-Automa%C3%A7%C3%B5es_TI/9.Recupera%C3%A7%C3%A3o%20de%20Cr%C3%A9dito';
  console.log('=== TRT6A: POST /api/consignado/import target=recurso_trt ===');
  const r = await req('POST', '/api/consignado/import', {
    folderUrl,
    target: 'recurso_trt',
    mode: 'append',
    modalidades: [],
  });
  console.log('HTTP STATUS =', r.statusCode, '(esperado 202)');
  console.log('BODY =', JSON.stringify(r.body, null, 2));
  if (!r.body || !r.body.jobId) {
    console.log('❌ Sem jobId. Finalizar.');
    process.exit(1);
  }
  const jobId = r.body.jobId;
  const statusUrl = r.body.statusUrl;
  console.log('jobId =', jobId);
  fs.writeFileSync(
    path.resolve(__dirname, 'data', 'job_recurso_trt_definitivo_id.txt'),
    jobId + '\n' + (statusUrl || ''),
  );

  const maxSec = 90;
  for (let i = 0; i < maxSec; i += 2) {
    await new Promise((res) => setTimeout(res, 2000));
    const s = await req('GET', statusUrl);
    const b = s.body || {};
    const progress = b.progress || {};
    const summary = b.summary || {};
    const status = b.status || 'UNKNOWN';
    const lastEvents = Array.isArray(b.events) ? b.events.slice(-3) : [];
    console.log(
      `[poll ${i + 2}s/${maxSec}s] status=${status} progress=${JSON.stringify(progress)} inserted=${
        summary.insertedRows ?? 0
      } skipped=${summary.skippedRows ?? 0} error=${summary.error ?? 'null'}`,
    );
    for (const ev of lastEvents) {
      const t = typeof ev === 'string' ? ev : JSON.stringify(ev);
      if (t.length > 500) console.log('  EVT: ' + t.slice(0, 500) + '…');
      else console.log('  EVT: ' + t);
    }
    if (['done', 'failed', 'cancelled', 'completed'].includes(status)) {
      console.log('\n=== Job finalizado. DETALHES COMPLETOS ===');
      console.log(JSON.stringify(b, null, 2).slice(0, 12000));
      break;
    }
  }
  console.log('\n=== TRT6C: VERIFICAR SQLITE Tabela "Recurso TRT" rowid MAX ===');
  const SQL = await initSqlJs();
  const sqlitePath = path.resolve(__dirname, 'data', 'consignado.sqlite');
  const db = new SQL.Database(fs.readFileSync(sqlitePath));
  const cnt = db.exec('SELECT COUNT(*) AS c FROM "Recurso TRT";')[0]?.values?.[0]?.[0] ?? 0;
  console.log('Total linhas tabela "Recurso TRT" =', cnt);
  const maxRowid = db.exec('SELECT MAX(rowid) FROM "Recurso TRT";')[0]?.values?.[0]?.[0] ?? null;
  console.log('MAX rowid inserido hoje =', maxRowid);
  const cols = db.exec("PRAGMA table_info('Recurso TRT');")[0]?.values ?? [];
  const colNames = cols.map((c) => c[1]);
  console.log('Colunas (CID 0..' + (cols.length - 1) + ') =', JSON.stringify(colNames));
  const rowNovo = db.exec(
    `SELECT rowid,"${colNames.join('","')}" FROM "Recurso TRT" WHERE rowid=? LIMIT 1;`.replace('?', String(maxRowid || 0)),
  );
  console.log('\nLINHA NOVA (rowid=' + maxRowid + ') valores brutos:');
  if (rowNovo[0]?.values?.length) {
    const vals = rowNovo[0].values[0];
    for (let i = 0; i < colNames.length; i++) {
      const v = vals[i];
      const extraTag = i >= 15 ? ' [EXTRA CID' + i + ']' : '';
      if (v === null || v === undefined || v === '') {
        console.log('  CID' + String(i).padStart(2, '0') + ' ' + colNames[i] + extraTag + ' = ⚠️ NULL/VAZIO');
      } else {
        const sv = String(v);
        console.log(
          '  CID' + String(i).padStart(2, '0') + ' ' + colNames[i] + extraTag + ' = ' +
            (sv.length > 80 ? sv.slice(0, 80) + '…' : sv),
        );
      }
    }
  } else {
    console.log('  (nenhuma nova linha inserida — arquivo pode já ter sido importado / já movedo para Importados.)');
  }
  console.log('\n=== Referência rowid=2 (antiga Julho 2026) 10 principais para comparar: ===');
  const dezCols = ['Nome','CPF','Copetencia','Desc Finalidade','Contrato','N Parcela','Qtd Parcelas','Vencimento','Critério de Débito','Valor Parcela'];
  const rowRef = db.exec(`SELECT "${dezCols.join('","')}" FROM "Recurso TRT" WHERE rowid=2 LIMIT 1;`);
  if (rowRef[0]?.values?.[0]) {
    const vr = rowRef[0].values[0];
    for (let i = 0; i < dezCols.length; i++) {
      console.log('  REF2 ' + dezCols[i] + ' = ' + (vr[i] === null ? 'NULL' : String(vr[i])));
    }
  }
  db.close();
})();
