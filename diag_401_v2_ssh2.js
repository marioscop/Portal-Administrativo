/* =============================================================
 * Diagnóstico 2: confirmar PORTA 3002 vs 3000
 * ============================================================= */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const ROOT_LOCAL = path.resolve(__dirname);
const HOST = '172.30.0.9';
const USER = 'juriscred';
const ENV_FILE_LOCAL = path.join(ROOT_LOCAL, 'backend', '.env');
const TS = new Date().toISOString().replace(/[^0-9T]/g, '').slice(0, 15);
const OUT = path.join(ROOT_LOCAL, 'diag401_v2_' + TS + '.out.log');
const ERR = path.join(ROOT_LOCAL, 'diag401_v2_' + TS + '.err.log');

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
function wOut(s) { try { fs.appendFileSync(OUT, String(s) + '\n', 'utf8'); } catch (e) { } process.stdout.write(String(s) + '\n'); }
function wErr(s) { try { fs.appendFileSync(ERR, String(s) + '\n', 'utf8'); } catch (e) { } process.stderr.write(String(s) + '\n'); }
fs.writeFileSync(OUT, '[' + now() + '] ==== DIAG 401 V2 (porta 3002 vs 3000) INICIADO ====\n', 'utf8');
fs.writeFileSync(ERR, '[' + now() + '] ==== DIAG 401 V2 ERR LOG ====\n', 'utf8');

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

const BASH_DIAG2 = `
set +e
echo "============================================================"
echo "== [1/5] ss -tlnp COMPLETO (todas portas TCP listen + processo) =="
echo "============================================================"
ss -tlnp 2>/dev/null
echo ""

echo "============================================================"
echo "== [2/5] ps aux | grep node (todos processos Node c/ args) =="
echo "============================================================"
ps aux | grep -i "node" | grep -v grep
echo ""

echo "============================================================"
echo "== [3/5] LISTA PM2 COMPLETA (pm2 jlist) — portas, args, status =="
echo "============================================================"
pm2 jlist 2>&1 | head -200
echo ""

echo "============================================================"
echo "== [4/5] CURL PORTA 3002 /api/consignado/recurso-tables  (BUILD NOVA V2) =="
echo "============================================================"
echo "--- (a) headers ---"
curl -I --max-time 15 http://127.0.0.1:3002/api/consignado/recurso-tables 2>&1 | head -20
echo ""
echo "--- (b) body JSON ---"
T=$(mktemp)
HTTP_3002=$(curl -sS -o "$T" -w '%{http_code}' --max-time 20 http://127.0.0.1:3002/api/consignado/recurso-tables 2>/dev/null || echo "000")
echo "HTTP_CODE_3002=$HTTP_3002"
cat "$T" | head -50
echo ""
echo "--- Contém Recurso TRE? ---"
grep -c -i "Recurso TRE\|Recurso TRT\|recurso_tre\|recurso_trt" "$T" || echo "0 ocorrencias"
rm -f "$T"
echo ""

echo "============================================================"
echo "== [5/5] APACHE vhost configs (só arquivos, sem senhas) — ProxyPass aponta para 3000 ou 3002? =="
echo "============================================================"
ls -la /etc/apache2/sites-enabled/ 2>/dev/null || ls -la /etc/httpd/conf.d/ 2>/dev/null || echo "(nenhum dir apache encontrado)"
echo ""
for f in /etc/apache2/sites-enabled/*.conf /etc/httpd/conf.d/*.conf; do
  if [ -f "$f" ]; then
    echo "==== $f ===="
    grep -iE "ProxyPass|ProxyPassReverse|Listen|VirtualHost" "$f" | head -20
    echo ""
  fi
done
echo "============================================================"
echo "== FIM DIAG V2 =="
echo "============================================================"
`;

const conn = new Client();
let done = false;
function finish(code) {
  if (done) return; done = true;
  wOut('\n==== DIAG V2 FINALIZADO em ' + now() + '  EXIT=' + code + ' ====');
  try { conn.end(); } catch (e) { }
  process.exit(code || 0);
}
conn.on('ready', function () {
  wOut('[' + now() + '] SSH conectado. Disparando diag V2...');
  conn.exec('bash -s', function (errExec, stream) {
    if (errExec) { wErr('exec err: ' + errExec.message); return finish(21); }
    stream.on('close', function (code) { wOut('bash close code=' + code); finish(typeof code === 'number' ? code : 0); });
    stream.on('data', function (d) { wOut(d.toString('utf8').replace(/\n$/, '')); });
    stream.stderr.on('data', function (d) { wErr(d.toString('utf8').replace(/\n$/, '')); });
    try { stream.end(BASH_DIAG2); } catch (e) { wErr('stream.end err: ' + e.message); finish(22); }
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

setTimeout(function () { wErr('TIMEOUT'); finish(99); }, 15 * 60 * 1000);
