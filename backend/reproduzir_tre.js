const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const { __debugHelpers_tre_import_wrong_columns } = require('./dist/consignado/import-consignado.js');

(async () => {
  const modelo = path.resolve(process.cwd(), '..', 'Modelos', 'TRE-JULHO-2026.xlsx');
  const dbPath = path.resolve(process.cwd(), 'data', 'consignado.sqlite');
  const dbPath2 = path.resolve(process.cwd(), 'data', 'debug-tre.sqlite');
  if (fs.existsSync(dbPath2)) fs.rmSync(dbPath2, { force: true });
  fs.copyFileSync(dbPath, dbPath2);
  const buf = fs.readFileSync(modelo);
  const parsed = __debugHelpers_tre_import_wrong_columns.readSheetTable(buf, 'extratos');
  console.log('headers =', JSON.stringify(parsed.headers));
  console.log('rows =', parsed.rows.map(r => JSON.stringify(r)).join(','));

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath2));
  const wrapDb = (sqlDb) => {
    const out = {
      _sql: sqlDb,
      run(q, bind = []) { sqlDb.run(q, bind); return { changes: sqlDb.getRowsModified() ?? 0 }; },
      prepare(query) {
        let internalStmt = null;
        const ensureStmt = () => { if (!internalStmt) internalStmt = sqlDb.prepare(query); return internalStmt; };
        return {
          run(bind = []) {
            ensureStmt();
            try {
              internalStmt.run(Array.isArray(bind) ? bind : [bind]);
            } catch (e) {
              console.error('RUN FAIL query=', query, 'bind=', JSON.stringify(bind), 'err=', e);
              throw e;
            }
            return { changes: sqlDb.getRowsModified() ?? 0 };
          },
          get(...bind) {
            ensureStmt();
            const cols = internalStmt.getColumnNames();
            const values = internalStmt.get(bind);
            if (!values) return undefined;
            const obj = {}; cols.forEach((k,i) => obj[k] = values[i]); return obj;
          },
          all(...bind) {
            ensureStmt();
            const cols = internalStmt.getColumnNames();
            const valuesArr = internalStmt.all(bind);
            if (!Array.isArray(valuesArr)) return [];
            return valuesArr.map(values => { const obj = {}; cols.forEach((k,i) => obj[k] = values[i]); return obj; });
          },
          step(...bind) { ensureStmt(); return internalStmt.step(bind); },
          bind(...bind) { ensureStmt(); internalStmt.bind(bind); return true; },
          reset() { if (internalStmt) internalStmt.reset(); },
          getAsObject() {
            ensureStmt();
            return internalStmt.getAsObject ? internalStmt.getAsObject() : (() => { const cols = internalStmt.getColumnNames(); const v = internalStmt.get(); if (!v) return undefined; const obj = {}; cols.forEach((k,i)=>obj[k]=v[i]); return obj; })();
          },
          getColumnNames() { ensureStmt(); return internalStmt.getColumnNames(); },
          free() { internalStmt = null; },
        };
      },
      exec(q) { return sqlDb.exec(q); },
      pragma(p) {
        const r = sqlDb.exec('PRAGMA ' + p);
        if (!r?.[0]) return [];
        return r[0].values.map((row) => { const obj = {}; r[0].columns.forEach((k,i)=>obj[k]=row[i]); return obj; });
      },
      getRowsModified() { return sqlDb.getRowsModified() ?? 0; },
    };
    return out;
  };
  try {
    const wrapped = wrapDb(db);
    wrapped.exec('DELETE FROM imported_row_hashes WHERE kind=\'extratos\'');
    wrapped.exec('DELETE FROM extratos WHERE __source_file LIKE \'%TRE-JULHO-2026%\'');
    console.log('Antes INSERT: extratos TRE-JULHO count =',
      wrapped.prepare('SELECT COUNT(1) c FROM extratos WHERE __source_file LIKE ?').get('%TRE-JULHO-2026%')?.c ?? '?');
    console.log('Antes INSERT: hashes extratos count =',
      wrapped.prepare('SELECT COUNT(1) c FROM imported_row_hashes WHERE kind=?').get('extratos')?.c ?? '?');
    // Debug steps
    try {
      console.log('tableExists(import_batches)=', __debugHelpers_tre_import_wrong_columns.debugEnsureExtratosRelatoriosTables ? 'via debug' : 'check via prepare');
      wrapped.exec('SELECT COUNT(1) FROM import_batches');
      console.log('import_batches EXISTS');
    } catch (e) { console.log('import_batches NOT EXISTS:', String(e).slice(0,200)); }
    try {
      wrapped.exec('SELECT COUNT(1) FROM imported_row_hashes');
      console.log('imported_row_hashes EXISTS');
    } catch (e) { console.log('imported_row_hashes NOT EXISTS:', String(e).slice(0,200)); }
    let res = null;
    try {
      res = __debugHelpers_tre_import_wrong_columns.insertExtratosRows({
        db: wrapped,
        sourceFile: 'Extrato Recurso/TRE-JULHO-2026.xlsx',
        fileColumns: parsed.headers.slice(),
        rows: parsed.rows.slice(),
        forceOrgaoFromUI: 'TRIBUNAL REGIONAL ELEITORAL DE GOIAS',
      });
    } catch (e) {
      console.error('insertExtratosRows ERROR:', e);
      console.error('stack:', e && e.stack);
      process.exit(1);
    }
    console.log('\n=== insertExtratosRows RESULT ===', JSON.stringify(res));
    console.log('count EXTRATOS total:',
      wrapped.prepare('SELECT COUNT(1) c FROM extratos').get()?.c ?? '?');
    console.log('count EXTRATOS TRE-JULHO:',
      wrapped.prepare('SELECT COUNT(1) c FROM extratos WHERE __source_file LIKE ?').get('%TRE-JULHO-2026%')?.c ?? '?');
    console.log('count hashes extratos:',
      wrapped.prepare('SELECT COUNT(1) c FROM imported_row_hashes WHERE kind=?').get('extratos')?.c ?? '?');
    const q = db.exec(`SELECT "DATA", "DOCUMENTO", "HISTÓRICO", "HISTÓRICO_1", "VALOR", "Copetencia", "CompetenciaArquivo", "__source_file", "HISTÔRICO", "HISTÔRICO_1" FROM extratos WHERE CompetenciaArquivo LIKE \'%TRE%\' OR "HISTÔRICO" LIKE \'%TED-STR%\' LIMIT 10`);
    console.log('\n=== DB RESULTADOS (inclui colunas com trema, pois a inserção usou HISTÔRICO com Ô) ===');
    if (q[0]) {
      console.log('COLUNAS:', q[0].columns);
      q[0].values.forEach((row) => {
        const obj = {}; q[0].columns.forEach((k, i) => obj[k] = row[i]);
        console.log(JSON.stringify(obj, null, 2));
      });
      console.log('COUNT:', q[0].values.length);
    }
    fs.writeFileSync(dbPath2, Buffer.from(db.export()));
    console.log('\nDB salvo em:', dbPath2);
  } finally { db.close(); process.exit(0); }
})().catch(e => { console.error(e); process.exit(1); });
