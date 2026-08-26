/* Diagnostic standalone: reproduz getConsignadoAccessEmails DEV 500 FORA do Nest all-exceptions-filter
   para obter stack trace real. Usa sql.js igual ao app.
*/
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const ROOT = path.resolve(__dirname);
const ENV_PATH = path.join(ROOT, 'backend', '.env');
const DB_PATH = path.join(ROOT, 'backend', 'data', 'consignado.sqlite');

console.log('=== DIAG DEV /access/emails HTTP 500 ===');
console.log('ROOT   =', ROOT);
console.log('.env   =', ENV_PATH, 'exists?', fs.existsSync(ENV_PATH));
console.log('SQLite =', DB_PATH, 'exists?', fs.existsSync(DB_PATH), 'size=', fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 'N/A');
console.log('');

// Load .env minimal (DB_PATH / FIXED_ACCESS_EMAIL etc)
try {
  if (fs.existsSync(ENV_PATH)) {
    const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
    for (const l of lines) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
    }
    console.log('[OK] .env carregado. PORT=', process.env.PORT, 'DB_PATH override?', process.env.DB_PATH);
  }
} catch (e) {
  console.log('[WARN] .env parse:', e.message);
}

const FINAL_DB = process.env.DB_PATH || DB_PATH;
console.log('FINAL SQLite path usado =', FINAL_DB);
console.log('');

(async () => {
  try {
    const SQL = await initSqlJs();
    const buf = fs.readFileSync(FINAL_DB);
    const db = new SQL.Database(buf);
    console.log('[OK] openDatabase & parse SQL.Schema concluido.');

    // 1) Verifica se tabela existe
    const t = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='consignado_access_emails';"
    );
    const tableExiste = t && t[0] && t[0].values && t[0].values.length > 0;
    console.log('[1] Tabela consignado_access_emails existe?', tableExiste);

    if (!tableExiste) {
      console.log('[FAIL] Tabela NAO existe. Rode ensureSchema ou o Nest boot para criar.');
      process.exit(1);
    }

    // 2) Lista colunas
    const cols = db.exec("PRAGMA table_info(consignado_access_emails);");
    console.log('[2] Colunas tabela:');
    if (cols[0]) for (const r of cols[0].values) console.log('    - ', r[1], '|', r[2]);

    // 3) Conta + lista emails
    const cnt = db.exec("SELECT COUNT(*) AS c FROM consignado_access_emails;");
    console.log('[3] Total emails tabela =', cnt[0].values[0][0]);

    const rows = db.exec("SELECT email, role FROM consignado_access_emails LIMIT 20;");
    if (rows[0]) {
      console.log('[4] Primeiros emails:');
      for (const r of rows[0].values) console.log('    - ', r[0], '| role=', r[1]);
    }

    // 4) Tenta ler com as colunas EXATAS do getConsignadoAccessEmails
    console.log('');
    console.log('[5] ReadTableRows EXATO (mesmas colunas do service)...');
    const rowsExact = db.exec(
      "SELECT email, role, menu_permissions_json, flow_stage_permissions_json FROM consignado_access_emails;"
    );
    console.log('    OK, rowsExact.length =', rowsExact[0] ? rowsExact[0].values.length : 0);

    // 5) Testa INSERT OR IGNORE (mesma logica do fixed email)
    const FIXED_ACCESS_EMAIL = process.env.FIXED_ACCESS_EMAIL || 'mario.junior@sicoobjuriscred.com.br';
    console.log('[6] FIXED_ACCESS_EMAIL =', FIXED_ACCESS_EMAIL);
    const hasFixed = db.exec(
      "SELECT 1 FROM consignado_access_emails WHERE email = ? LIMIT 1;",
      [FIXED_ACCESS_EMAIL]
    );
    console.log('    Fixed existe no DB?', (hasFixed[0] && hasFixed[0].values.length > 0) ? 'SIM' : 'NAO');

    console.log('');
    console.log('✅ NENHUM ERRO ENCONTRADO NA LOGICA. O 500 pode ser:');
    console.log('   a) Exception no próprio all-exceptions.filter (ciclo anterior injetou algo)?');
    console.log('   b) ensureSchema() chamando algo que falha no boot?');
    console.log('   c) FIXED_ACCESS_EMAIL undefined ou outra constante faltando?');
    console.log('   d) openDatabase() com DB_PATH env apontando caminho errado.');

    db.close();
  } catch (e) {
    console.log('\n🚨 EXCECAO REAL CAPTURADA (fora do Nest filter):');
    console.log('   NAME :', e.constructor.name);
    console.log('   MSG  :', e.message);
    console.log('   STACK:\n', e.stack);
    process.exit(2);
  }
})();
