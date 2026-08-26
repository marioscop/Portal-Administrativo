/* =============================================================
 * Diagnóstico 3: todos vhosts Apache / ProxyPass / curl porta 3000 vs 3002 vs 8081 vs 8444
 * ============================================================= */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const ROOT_LOCAL = path.resolve(__dirname);
const HOST = '172.30.0.9';
const USER = 'juriscred';
const ENV_FILE_LOCAL = path.join(ROOT_LOCAL, 'backend', '.env');
const TS = new Date().toISOString().replace(/[^0-9T]/g, '').slice(0, 15);
const OUT = path.join(ROOT_LOCAL, 'diag_vhosts_curl_' + TS + '.out.log');
const ERR = path.join(ROOT_LOCAL, 'diag_vhosts_curl_' + TS + '.err.log');

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
function wOut(s) { try { fs.appendFileSync(OUT, String(s) + '\n', 'utf8'); } catch (e) { } process.stdout.write(String(s) + '\n'); }
function wErr(s) { try { fs.appendFileSync(ERR, String(s) + '\n', 'utf8'); } catch (e) { } process.stderr.write(String(s) + '\n'); }
fs.writeFileSync(OUT, '[' + now() + '] ==== DIAG VHOSTS APACHE + CURL ACESSO EMAIL ====\n', 'utf8');
fs.writeFileSync(ERR, '[' + now() + '] ==== DIAG VHOSTS ERR ====\n', 'utf8');

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

const BASH = `
set +e
echo "============================================================"
echo "== [1/7] TODOS ARQUIVOS VHOSTS APACHE - CONTEÚDO COMPLETO ProxyPass =="
echo "============================================================"
for f in /etc/apache2/sites-enabled/*.conf /etc/apache2/sites-available/*.conf /etc/httpd/conf.d/*.conf /etc/httpd/conf/httpd.conf; do
  if [ -f "$f" ]; then
    echo "------------------------------------------------------------"
    echo " ARQUIVO: $f"
    echo "------------------------------------------------------------"
    grep -nE "VirtualHost|ProxyPass|ProxyPassReverse|Listen|ServerName|ServerAlias" "$f"
    echo ""
  fi
done 2>/dev/null
echo ""

echo "============================================================"
echo "== [2/7] CURLS DE TESTE PARA TODAS AS PORTAS /access/emails =="
echo "============================================================"
echo ""
for PORTA in 3000 3002 8081 8444; do
  if [ "$PORTA" = "8444" ] || [ "$PORTA" = "443" ]; then
    SCHEME=https; FLAGS="--insecure --max-time 25"
  else
    SCHEME=http; FLAGS="--max-time 25"
  fi
  echo "---- $SCHEME://127.0.0.1:$PORTA/api/consignado/access/emails ----"
  BODY=$(mktemp); HDRS=$(mktemp)
  STATUS=$(curl -sS $FLAGS -o "$BODY" -D "$HDRS" -w '%{http_code}' $SCHEME://127.0.0.1:$PORTA/api/consignado/access/emails 2>/dev/null || echo "000")
  echo "  HTTP_CODE = $STATUS"
  echo "  HEADERS (15 primeiras):"
  head -15 "$HDRS" | sed 's/^/  > /'
  echo "  BODY (500 chars):"
  head -c 500 "$BODY" | sed 's/^/  | /' ; echo ""
  rm -f "$BODY" "$HDRS"
  echo ""
done

echo "============================================================"
echo "== [3/7] PROCESSOS PORTA 3000 vs 3002 (qual build? cmd+args+pm2_id) =="
echo "============================================================"
for PORT in 3000 3002; do
  echo "---- PORTA $PORT ----"
  PID=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
  if [ -z "$PID" ]; then
    echo "  (nenhum processo escutando)"
  else
    echo "  PID = $PID"
    ps -o pid,ppid,user,cmd,etime --pid "$PID" 2>/dev/null | sed 's/^/  | /'
    echo "  Tem arquivo PM2? (ecosystem / proc env):"
    cat /proc/$PID/cmdline 2>/dev/null | tr '\\0' ' ' | sed 's/^/  CMDLINE: /' ; echo ""
    cat /proc/$PID/environ 2>/dev/null | tr '\\0' '\\n' | grep -iE "PORT=|NODE_ENV=|PM2|PM_ID|name=" | sed 's/^/  ENV: /' | head -10
  fi
  echo ""
done

echo "============================================================"
echo "== [4/7] PM2 JLIST COMPLETA (apps, portas, pids, restart count, status) =="
echo "============================================================"
pm2 jlist 2>&1
echo ""

echo "============================================================"
echo "== [5/7] MATAR PROCESSO ÓRFÃO DA PORTA 3000? (só se NÃO for PM2) =="
echo "============================================================"
PID_3000=$(ss -tlnp 2>/dev/null | grep ":3000 " | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
PM2_LISTA_PIDS=$(pm2 jlist 2>/dev/null | grep -oE '"pid":[0-9]+|'"pm_id" | head -60)
echo "PID_3000=$PID_3000"
echo "Lista PM2 PIDs (bruta): $(echo $PM2_LISTA_PIDS | tr -d '\\n' | head -c 300)"
if [ -n "$PID_3000" ]; then
  EH_PM2=$(pm2 describe 8 2>/dev/null | grep -E "pid.*$PID_3000|pid.*$PID_3000" | wc -l)
  EH_PM2_GERAL=$(pm2 jlist 2>/dev/null | grep -c "\"pid\":$PID_3000" || echo 0)
  echo "  → PID $PID_3000 aparece no pm2 id=8? [$EH_PM2]"
  echo "  → PID $PID_3000 aparece no jlist geral? [$EH_PM2_GERAL]"
  if [ "$EH_PM2_GERAL" = "0" ]; then
    echo "  🎯 PROCESSO ÓRFÃO DETECTADO (não está no PM2). Comando p/ matar manualmente:"
    echo "     kill -9 $PID_3000"
  else
    echo "  → Build da porta 3000 está sendo gerenciada pelo PM2 (não matar)"
  fi
fi
echo ""

echo "============================================================"
echo "== [6/7] APACHE STATUS + ports.conf (Listen 8081 8444?) =="
echo "============================================================"
ss -tlnp 2>/dev/null | grep -E ":80|:443|:8080|:8081|:8443|:8444"
echo ""
echo "--- ports.conf ---"
cat /etc/apache2/ports.conf 2>/dev/null | head -30 || echo "(sem ports.conf)"
echo ""

echo "============================================================"
echo "== [7/7] ULTIMOS 15 ERROS PM2 id=8 (depois do deploy) =="
echo "============================================================"
pm2 logs 8 --nostream --lines 15 --raw --err 2>&1 | tail -17
echo ""
echo "=== FIM ==="
`;

const conn = new Client();
let done = false;
function finish(code) {
  if (done) return; done = true;
  wOut('\n==== DIAG VHOSTS FIM em ' + now() + '  EXIT=' + code + ' ====');
  try { conn.end(); } catch (e) { }
  process.exit(code || 0);
}
conn.on('ready', function () {
  wOut('[' + now() + '] SSH conectado. Disparando...');
  conn.exec('bash -s', function (errExec, stream) {
    if (errExec) { wErr('exec err: ' + errExec.message); return finish(21); }
    stream.on('close', function (code) { wOut('bash close code=' + code); finish(typeof code === 'number' ? code : 0); });
    stream.on('data', function (d) { wOut(d.toString('utf8').replace(/\n$/, '')); });
    stream.stderr.on('data', function (d) { wErr(d.toString('utf8').replace(/\n$/, '')); });
    try { stream.end(BASH); } catch (e) { wErr('stream.end err: ' + e.message); finish(22); }
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
