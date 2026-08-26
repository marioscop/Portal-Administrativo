/* =============================================================
 * Diagnóstico Falha Acesso Email (Tela "Acesso Restrito")
 * ============================================================= */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const ROOT_LOCAL = path.resolve(__dirname);
const HOST = '172.30.0.9';
const USER = 'juriscred';
const ENV_FILE_LOCAL = path.join(ROOT_LOCAL, 'backend', '.env');
const TS = new Date().toISOString().replace(/[^0-9T]/g, '').slice(0, 15);
const OUT = path.join(ROOT_LOCAL, 'diag_acesso_email_' + TS + '.out.log');
const ERR = path.join(ROOT_LOCAL, 'diag_acesso_email_' + TS + '.err.log');

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
function wOut(s) { try { fs.appendFileSync(OUT, String(s) + '\n', 'utf8'); } catch (e) { } process.stdout.write(String(s) + '\n'); }
function wErr(s) { try { fs.appendFileSync(ERR, String(s) + '\n', 'utf8'); } catch (e) { } process.stderr.write(String(s) + '\n'); }
fs.writeFileSync(OUT, '[' + now() + '] ==== DIAG FALHA ACESSO EMAIL PROD ====\n', 'utf8');
fs.writeFileSync(ERR, '[' + now() + '] ==== DIAG FALHA ACESSO EMAIL ERR ====\n', 'utf8');

let PASSWORD = null;
try {
  const envLines = fs.readFileSync(ENV_FILE_LOCAL, 'utf8').split(/\r?\n/);
  for (const line of envLines) {
    const m = /^Linux\s*=\s*(.*)$/.exec(line);
    if (m) {
      PASSWORD = m[1].trim();
      if (PASSWORD.length >= 2 && PASSWORD.startsWith('"') && PASSWORD.endsWith('"')) {
        PASSWORD = PASSWORD.slice(1, -1);
      }
      break;
    }
  }
} catch (e) { wErr('LER .env falhou: ' + e.message); process.exit(99); }
if (!PASSWORD || PASSWORD.length < 6) { wErr('Senha Linux= nao encontrada'); process.exit(99); }
wOut('[' + now() + '] Senha .env OK (' + PASSWORD.length + ' chars)');

const BASH_DIAG = `
set +e
BASE=/var/www/html/Portal-Administrativo
echo "============================================================"
echo "== [1/8] PERMISSÕES ARQUIVO SQLite PRODUÇÃO (escrita?) =="
echo "============================================================"
SQL="$BASE/backend/data/consignado.sqlite"
ls -la "$SQL"
stat -c '%U:%G perms=%a size=%s' "$SQL"
touch "$SQL.write_test" 2>&1 && echo "✅ ESCRITA PERMITIDA em $SQL" && rm -f "$SQL.write_test" || echo "❌ ESCRITA NÃO PERMITIDA em $SQL (PROVÁVEL CAUSA RAIZ!)"
echo ""

echo "============================================================"
echo "== [2/8] SCHEMA TABELA consignado_access_emails (existe?) =="
echo "============================================================"
cd "$BASE/backend"
node -e "
const fs=require('fs');
const initSqlJs=require('sql.js');
(async function(){
  const SQL = await initSqlJs({locateFile: f => './node_modules/sql.js/dist/'+f});
  const buf = fs.readFileSync('./data/consignado.sqlite');
  const db = new SQL.Database(buf);
  const res = db.exec(\\\"SELECT sql FROM sqlite_master WHERE type='table' AND name='consignado_access_emails'\\\");
  if (res.length === 0) { console.log('❌ TABELA NÃO EXISTE — ensureSchema() não rodou?'); }
  else { console.log('✅ Tabela existe:\\n' + res[0].values[0][0]); }
  const cnt = db.exec('SELECT COUNT(*) AS c FROM consignado_access_emails');
  console.log('Qtd emails cadastrados:', (cnt && cnt[0] && cnt[0].values && cnt[0].values[0] && cnt[0].values[0][0]) || 0);
  const lista = db.exec('SELECT email, role, created_at FROM consignado_access_emails ORDER BY created_at DESC LIMIT 20');
  if (lista && lista[0]) console.log('Lista emails: \\n' + lista[0].values.map(r => '  · ' + r.join(' | ')).join('\\n'));
})().catch(e => { console.error('ERRO NODE SQL.JS:', e.message); process.exit(1); });
" 2>&1 | head -60
echo ""

echo "============================================================"
echo "== [3/8] PM2 LOGS — últimas 80 linhas id=8 (acesso/emails? erros?) =="
echo "============================================================"
pm2 logs 8 --nostream --lines 80 --raw 2>&1 | tail -85
echo ""

echo "============================================================"
echo "== [4/8] CURL TESTE DIRETO: GET /api/consignado/access/emails (porta 3002, Nest real) =="
echo "============================================================"
TMP=$(mktemp)
HTTP=$(curl -sS -o "$TMP" -w '%{http_code}' --max-time 20 http://127.0.0.1:3002/api/consignado/access/emails 2>&1 || echo "000")
echo "HTTP GET access/emails = $HTTP"
echo "BODY (primeiras 30 linhas):"
head -30 "$TMP"
rm -f "$TMP"
echo ""

echo "============================================================"
echo "== [5/8] FIXED_ACCESS_EMAIL — qual é o email fixo? (codigo hardcoded) =="
echo "============================================================"
grep -n "FIXED_ACCESS_EMAIL\s*=" "$BASE/backend/src/consignado/import-consignado.ts" 2>/dev/null | head -3
grep -n "FIXED_ACCESS_EMAIL" "$BASE/backend/dist/main.js" 2>/dev/null | head -3 | cut -c1-200
echo ""

echo "============================================================"
echo "== [6/8] Permissão pasta data/ (SQLite pode escrever WAL?) =="
echo "============================================================"
DADOS="$BASE/backend/data"
ls -la "$DADOS" | head -15
stat -c '%U:%G perms=%a' "$DADOS"
echo ""
test -w "$DADOS" && echo "✅ Pasta data/ tem permissão de escrita" || echo "❌ Pasta data/ SEM permissão de escrita (WAL/SHV não cria → erro)"

echo ""
echo "============================================================"
echo "== [7/8] DISCO CHEIO? (causa frequente erro escrita SQLite) =="
echo "============================================================"
df -h "$BASE" 2>&1 | head -5
echo ""

echo "============================================================"
echo "== [8/8] CHECK .env produção tem todas chaves OTP? (GRAPH/SMTP para envio email) =="
echo "============================================================"
echo "(Valores ocultos por segurança, só nomes das chaves):"
grep -E "^[A-Za-z0-9_]+\s*=" "$BASE/backend/.env" 2>/dev/null | sed -E 's/=.+$/<OCULTO>/' | sort
echo ""
echo "============================================================"
echo "=== FIM DIAG FALHA ACESSO EMAIL ==="
echo "============================================================"
`;

const conn = new Client();
let done = false;
function finish(code) {
  if (done) return; done = true;
  wOut('\n==== DIAG FIM em ' + now() + '  EXIT=' + code + ' ====');
  try { conn.end(); } catch (e) { }
  process.exit(code || 0);
}
conn.on('ready', function () {
  wOut('[' + now() + '] SSH conectado. Disparando diag...');
  conn.exec('bash -s', function (errExec, stream) {
    if (errExec) { wErr('exec err: ' + errExec.message); return finish(21); }
    stream.on('close', function (code) { wOut('bash close code=' + code); finish(typeof code === 'number' ? code : 0); });
    stream.on('data', function (d) { wOut(d.toString('utf8').replace(/\n$/, '')); });
    stream.stderr.on('data', function (d) { wErr(d.toString('utf8').replace(/\n$/, '')); });
    try { stream.end(BASH_DIAG); } catch (e) { wErr('stream.end err: ' + e.message); finish(22); }
  });
});
conn.on('error', function (e) { wErr('SSH ERROR: ' + e.message); });
conn.on('close', function (hadErr) { wOut('SSH CLOSE hadErr=' + hadErr); });

try {
  conn.connect({
    host: HOST, port: 22, username: USER, password: PASSWORD,
    readyTimeout: 30000, keepaliveInterval: 45000, keepaliveCountMax: 40,
    algorithms: { serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-ed25519'] }
  });
} catch (e) { wErr('connect throw: ' + e.message); finish(98); }

setTimeout(function () { wErr('TIMEOUT'); finish(99); }, 12 * 60 * 1000);
