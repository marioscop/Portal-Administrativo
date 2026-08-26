/* =============================================================
 * Diagnóstico HTTP 401 Produção 172.30.0.9
 *  1. Body resposta 401 salvo em /tmp
 *  2. Headers com curl -I
 *  3. .env produção (só keys, sem valores)
 *  4. Proxy reverso? nginx/apache
 *  5. Nest: quais portas estão LISTEN, pm2 logs ultimo erro
 * ============================================================= */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const ROOT_LOCAL = path.resolve(__dirname);
const HOST = '172.30.0.9';
const USER = 'juriscred';
const ENV_FILE_LOCAL = path.join(ROOT_LOCAL, 'backend', '.env');
const TS = new Date().toISOString().replace(/[^0-9T]/g, '').slice(0, 15);
const OUT = path.join(ROOT_LOCAL, 'diag401_' + TS + '.out.log');
const ERR = path.join(ROOT_LOCAL, 'diag401_' + TS + '.err.log');

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
function wOut(s) { try { fs.appendFileSync(OUT, String(s) + '\n', 'utf8'); } catch (e) { } process.stdout.write(String(s) + '\n'); }
function wErr(s) { try { fs.appendFileSync(ERR, String(s) + '\n', 'utf8'); } catch (e) { } process.stderr.write(String(s) + '\n'); }
fs.writeFileSync(OUT, '[' + now() + '] ==== DIAG 401 INICIADO ====\n', 'utf8');
fs.writeFileSync(ERR, '[' + now() + '] ==== DIAG 401 ERR LOG ====\n', 'utf8');

/* (1) Ler senha */
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

/* (2) Bash remoto - comandos de diagnóstico */
const BASH_DIAG = `
set +e
echo "============================================================"
echo "== [1/7] CAT /tmp/_deploy_v2_check_tables.json  (body 401) =="
echo "============================================================"
if [ -f /tmp/_deploy_v2_check_tables.json ]; then
  cat /tmp/_deploy_v2_check_tables.json | head -80
  echo "---(fim do arquivo)---"
  wc -c /tmp/_deploy_v2_check_tables.json
else
  echo "(arquivo não existe)"
fi
echo ""

echo "============================================================"
echo "== [2/7] CURL -I headers /api/consignado/temporario  127.0.0.1:3000 =="
echo "============================================================"
curl -I --max-time 10 http://127.0.0.1:3000/api/consignado/temporario 2>&1 | head -40
echo ""

echo "============================================================"
echo "== [3/7] CURL -v resumido /api/consignado/temporario =="
echo "============================================================"
curl -v --max-time 10 http://127.0.0.1:3000/api/consignado/temporario 2>&1 | head -60
echo ""

echo "============================================================"
echo "== [4/7] .env produção (só chaves, sem valores) =="
echo "============================================================"
ENV_FILE=/var/www/html/Portal-Administrativo/backend/.env
if [ -f "$ENV_FILE" ]; then
  wc -c "$ENV_FILE"
  cat "$ENV_FILE" | sed -E 's/(^[A-Za-z_][A-Za-z0-9_]*)=.*$/\\1=<***>/'
else
  echo "(arquivo .env não encontrado em $ENV_FILE)"
fi
echo ""

echo "============================================================"
echo "== [5/7] LISTEN portas (ss -tulpn) + nginx/apache processos =="
echo "============================================================"
ss -tulpn 2>/dev/null | head -30
echo ""
echo "--- processos web ---"
ps aux | grep -iE "nginx|apache|httpd" | grep -v grep || echo "(nenhum processo nginx/apache encontrado)"
echo ""
echo "--- iptables INPUT -n -L ---"
sudo -n iptables -nL INPUT 2>/dev/null | head -20 || echo "(iptables: sem permissão ou não instalado)"
echo ""

echo "============================================================"
echo "== [6/7] PM2 status id=8 + ultimos 50 logs stderr =="
echo "============================================================"
pm2 describe 8 2>&1 | head -30
echo ""
echo "-- ultimos 40 logs pm2 id=8 (stderr+stdout) --"
pm2 logs 8 --nostream --lines 40 --raw 2>&1 | tail -50
echo ""

echo "============================================================"
echo "== [7/7] Nest main local vs dist? (só check se existe middleware auth em main.ts local) =="
echo "   (main.ts é compilado, vamos checar se em produção NODE_ENV=production e se tem variáveis de auth)"
echo "============================================================"
MAIN_DIST=/var/www/html/Portal-Administrativo/backend/dist/main.js
if [ -f "$MAIN_DIST" ]; then
  echo "main.js existe. Buscando keywords: authMiddleware / AuthGuard / basicAuth / NODE_ENV..."
  grep -iE "authMiddleware|AuthGuard|basicAuth|NODE_ENV|useGlobalGuards|enableCors|app.use" "$MAIN_DIST" | head -30
else
  echo "(main.js não encontrado em $MAIN_DIST)"
fi
echo ""
echo "============================================================"
echo "== FIM DO DIAGNÓSTICO =="
echo "============================================================"
`;

/* (3) Conectar e executar */
const conn = new Client();
let done = false;
function finish(code) {
  if (done) return; done = true;
  wOut('\n==== DIAG 401 FINALIZADO em ' + now() + '  EXIT=' + code + ' ====');
  try { conn.end(); } catch (e) { }
  process.exit(code || 0);
}

conn.on('ready', function () {
  wOut('[' + now() + '] SSH conectado a ' + USER + '@' + HOST + '. Disparando diagnóstico...');
  conn.exec('bash -s', function (errExec, stream) {
    if (errExec) { wErr('exec bash ERROR: ' + errExec.message); return finish(21); }
    stream.on('close', function (code) { wOut('bash stream close code=' + code); finish(typeof code === 'number' ? code : 0); });
    stream.on('data', function (d) { wOut(d.toString('utf8').replace(/\n$/, '')); });
    stream.stderr.on('data', function (d) { wErr(d.toString('utf8').replace(/\n$/, '')); });
    try { stream.end(BASH_DIAG); }
    catch (e) { wErr('stream.end ERROR: ' + e.message); finish(22); }
  });
});
conn.on('error', function (e) { wErr('SSH ERROR: lvl=' + e.level + ' msg=' + e.message); });
conn.on('end', function () { wOut('SSH END'); });
conn.on('close', function (hadErr) { wOut('SSH CLOSE hadErr=' + hadErr); });

try {
  conn.connect({
    host: HOST,
    port: 22,
    username: USER,
    password: PASSWORD,
    readyTimeout: 30000,
    keepaliveInterval: 45000,
    keepaliveCountMax: 40,
    algorithms: {
      serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-ed25519']
    }
  });
} catch (e) { wErr('conn.connect THROW: ' + e.message); finish(98); }

setTimeout(function () { wErr('TIMEOUT 20 min'); finish(99); }, 20 * 60 * 1000);
