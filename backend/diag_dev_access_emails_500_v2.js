const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const BACKEND_DIR = __dirname;
const DB_PATH = path.join(BACKEND_DIR, 'data', 'consignado.sqlite');

console.log('=== DIAG DEV /access/emails 500 v2 ===');
console.log('BACKEND_DIR =', BACKEND_DIR);
console.log('DB_PATH     =', DB_PATH);
console.log('DB exists   =', fs.existsSync(DB_PATH), 'size=', fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0);
console.log('');

(async () => {
  try {
    const SQL = await initSqlJs();
    const buf = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(buf);
    console.log('[OK] sql.js abriu o DB.');

    const t = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='consignado_access_emails';");
    const temTabela = Boolean(t[0] && t[0].values.length);
    console.log('[1] Tabela consignado_access_emails existe?', temTabela ? 'SIM' : 'NAO');

    if (!temTabela) {
      console.log('[FAIL] tabela inexistente -> 500.');
      process.exit(1);
    }

    const cnt = db.exec('SELECT COUNT(*) AS c FROM consignado_access_emails;');
    console.log('[2] Qtd emails cadastrados =', cnt[0].values[0][0]);

    const rows = db.exec('SELECT email, role FROM consignado_access_emails ORDER BY email LIMIT 15;');
    if (rows[0]) {
      console.log('[3] Emails (primeiros 15):');
      for (const r of rows[0].values) console.log('    - ', r[0], '|', r[1]);
    }

    console.log('\n✅ SQL LAYER 100% OK. O 500 NAO VEM DO sql.js.');
    console.log('   Proxima hipotese: Nest middleware, all-exceptions-filter,');
    console.log('   ou consignado.service.ts / controller lancando algo a mais.');
    console.log('   Vamos checar FIXED_ACCESS_EMAIL e CONSTANTES no build dist.');

    // Verificar se build dist existe (indica backend rodando é build antigo vs novo)
    const distMain = path.join(BACKEND_DIR, 'dist', 'main.js');
    console.log('\n[4] dist/main.js existe?', fs.existsSync(distMain), 'mtime=', fs.existsSync(distMain) ? fs.statSync(distMain).mtime : 'N/A');

    db.close();
  } catch (e) {
    console.log('\n🚨 EXCECAO REAL:');
    console.log('   NAME :', e.constructor.name);
    console.log('   MSG  :', e.message);
    console.log('   STACK:\n', e.stack);
    process.exit(2);
  }
})();
