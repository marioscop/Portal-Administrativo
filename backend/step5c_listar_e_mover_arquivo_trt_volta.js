const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const SQLITE_PATH = path.join(__dirname, 'data', 'consignado.sqlite');
const folderUrlBase = 'https://sicoobjuriscredcelgbr.sharepoint.com/sites/PortaldeDocumentosSicoobJuriscred/Documents/Diretoria%20Administrativo/Tecnologia%20da%20Informa%C3%A7%C3%A3o/99-Automa%C3%A7%C3%B5es_TI/9.Recupera%C3%A7%C3%A3o%20de%20Cr%C3%A9dito';

async function main() {
  console.log('=== [1/4] Carregando módulo dist para usar funções Graph do import-consignado ===');
  const mod = require('./dist/consignado/import-consignado.js');
  console.log('  Módulo carregado. Exportando debugExpandRecursoExtratos...');
  const debugExpandFn = mod.debugExpandRecursoExtratos || (mod.default && mod.default.debugExpandRecursoExtratos);
  if (!debugExpandFn) {
    console.log('  Procurando exports do módulo para achar expand...');
    console.log('  Keys topo:', Object.keys(mod).slice(0, 30));
    // Tentar pegar de __debugHelpers_tre_import_wrong_columns ou função anônima
  }
  console.log('  debugExpandRecursoExtratos:', typeof debugExpandFn);

  // Como alternativa, vamos usar o debugOneshotTreImportSync ou usar a função via
  // o importByLearningProfileFromFolderUrl mas primeiro fazer um HTTP call para o endpoint
  // debug-expand-extratos (se backend estiver no ar). Mas backend pode NÃO estar no ar agora.
  //
  // Melhor: verificar se está rodando backend porta 3000. Se SIM, usar HTTP.
  const http = require('http');
  function backendHealth() {
    return new Promise((resolve) => {
      const req = http.request({ host:'127.0.0.1', port:3000, path:'/', method:'GET', timeout:3000 }, (res) => {
        resolve({ on:true, status: res.statusCode });
        res.resume();
      });
      req.on('timeout', () => { req.destroy(); resolve({ on:false, reason:'timeout' }); });
      req.on('error', () => resolve({ on:false, reason:'error' }));
      req.end();
    });
  }
  const health = await backendHealth();
  console.log(`\n=== [2/4] Backend HTTP 127.0.0.1:3000 status: ${health.on ? 'ON (status=' + health.status + ')' : 'OFF (' + (health.reason||'?') + ')'}`);

  if (!health.on) {
    console.log('\n  ⚠️ Backend OFF. Vamos tentar iniciar backend via HTTP import sync de qualquer forma primeiro não é possível.');
    console.log('  Melhor: vamos verificar pelo SHAREPOINT GRAPH usando o mesmo fluxo do módulo (expandir extratos).');
    console.log('  → Chamando __debugHelpers_tre_import_wrong_columns ou lista direta...');
    // Tentar chamar a função runImportConsignado com debug mode?
    // Alternativa: chamar importByLearningProfileFromFolderUrl COM UM CALLBACK de onProgress e ver
    // se consta arquivo. Mas step5 anterior já rodou e retornou importedFiles=0.
  }

  // Vamos fazer HTTP se backend estiver ligado, senão usar abordagem alternativa: debug direto via módulo
  function httpRequestJson(method, path, body) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request({
        host: '127.0.0.1',
        port: 3000,
        path: '/api/consignado' + path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      }, (res) => {
        let chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const str = buf.toString('utf8');
          try { resolve({ status: res.statusCode, body: JSON.parse(str) }); }
          catch { resolve({ status: res.statusCode, raw: str }); }
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  if (health.on) {
    console.log('\n=== [3/4] Backend ON. Chamando POST /debug-expand-extratos forceKind=recurso_trt ===');
    try {
      const res = await httpRequestJson('POST', '/debug-expand-extratos', {
        folderUrl: folderUrlBase,
        forceKind: 'recurso_trt',
        debugVerbose: false,
      });
      console.log(`  HTTP status: ${res.status}`);
      if (res.body && res.body.candidates) {
        const arr = Array.isArray(res.body.candidates) ? res.body.candidates : [];
        console.log(`  Candidates retornados: ${arr.length}`);
        arr.forEach((c, i) => {
          console.log(`    [${i+1}] ${c.name} | path: ${c.folderPath} | id: ${String(c.id||'').slice(0,16)}...`);
        });
        // Procurar por TRT-JULHO
        const trt = arr.find(c => String(c.name||'').toLowerCase().includes('trt') && String(c.name||'').toLowerCase().includes('julho'));
        if (trt) {
          console.log(`\n  ✅ Arquivo TRT-JULHO-2026.xlsx ENCONTRADO:`);
          console.log(`     name      = ${trt.name}`);
          console.log(`     folderPath= ${trt.folderPath}`);
          console.log(`     id        = ${trt.id}`);
          console.log(`     parentId  = ${trt.parentId}`);
          const emImportados = /[\/\\]Importados[\/\\]?/i.test(String(trt.folderPath||''));
          console.log(`     em Importados? ${emImportados ? 'SIM (→ precisa mover para pasta pai)' : 'NÃO (ok)'}`);

          // Se está em Importados, mover de volta para pasta pai
          if (emImportados) {
            console.log(`\n  ⚙️ Arquivo está em Importados. CHAMANDO moverViaGraphSharepointFileParaPastaPai...`);
            try {
              // Vamos usar a função mover do próprio módulo (está exportada?)
              // Como mover não é exportada diretamente, vamos usar HTTP endpoint de mover (se existir)
              // Alternativa: deletar o registro __source_file e hash para permitir reimportar
              // Mas é melhor mover via API Graph. Vamos procurar export função moveFolderFile...
              let moveFn = null;
              for (const k of Object.keys(mod)) {
                if (typeof mod[k] === 'function' && (k.toLowerCase().includes('move') || k.toLowerCase().includes('moveto') || k.toLowerCase().includes('mover'))) {
                  console.log(`     → encontrada função: mod.${k} (move candidate)`);
                }
              }
              // Melhor: Vamos chamar o endpoint HTTP mover existente: POST /move-imported-to-importados?
              // Ou procurar no módulo exportação moveGraphFileToImportadosSubfolder
              console.log(`\n  ⚙️ TENTATIVA HTTP: POST /move-graph-file-to-parent-folder (se existir)`);
              try {
                const moveRes = await httpRequestJson('POST', '/debug-move-graph-file-to-parent', {
                  fileId: trt.id,
                  parentId: trt.parentId,
                  folderUrl: folderUrlBase,
                });
                console.log(`     HTTP move status: ${moveRes.status}`);
                console.log(`     HTTP move body:`, JSON.stringify(moveRes.body || moveRes.raw || {}).slice(0, 400));
              } catch (e) {
                console.log(`     ❌ Erro no HTTP move: ${e.message}`);
              }
            } catch (e2) {
              console.log(`     ❌ Erro ao tentar mover: ${e2.message}`);
            }
          }
        } else {
          console.log(`\n  ❌ Arquivo TRT-JULHO NÃO encontrado nos candidates!`);
        }
      } else {
        console.log('  Body:', JSON.stringify(res.body || res.raw || {}).slice(0, 600));
      }
    } catch (e) {
      console.log(`  ❌ ERRO HTTP expand: ${e.message}`);
    }
  } else {
    // Backend OFF: usar o módulo import-consignado diretamente para expandir
    console.log('\n=== [3/4] Backend OFF. Chamando debugExpandRecursoExtratos DIRETO do módulo ===');
    // A função está exportada no módulo principal? Vamos procurar
    let fn = null;
    const keys = Object.keys(mod);
    // Tentar nome comum
    for (const k of keys) {
      if (k.toLowerCase().includes('expand') && k.toLowerCase().includes('extrato')) {
        fn = mod[k];
        console.log(`  → encontrada em mod.${k}`);
        break;
      }
    }
    // Se não achar, tentar __debugHelpers_tre_import_wrong_columns
    if (!fn && mod.__debugHelpers_tre_import_wrong_columns) {
      console.log('  → Usando __debugHelpers_tre_import_wrong_columns...');
      try {
        const helpers = await mod.__debugHelpers_tre_import_wrong_columns();
        console.log('    helpers keys:', Object.keys(helpers || {}).slice(0, 30));
        if (helpers && helpers.debugExpandRecursoExtratos) fn = helpers.debugExpandRecursoExtratos;
      } catch (e) { console.log('    Erro helpers:', e.message); }
    }
    if (!fn) {
      console.log('  ❌ Não achei função expand. Resultado step5 importedFiles=0 significa: arquivo está em pasta não varrida ou Importados.');
      console.log('  → Resposta manual: suponho que está em Importados. Vou proceder para rebuild e restart do backend HTTP.');
    } else {
      try {
        const result = await fn({ folderUrl: folderUrlBase, forceKind: 'recurso_trt' });
        const arr = Array.isArray(result?.candidates) ? result.candidates : (Array.isArray(result) ? result : []);
        console.log(`  Expand direto candidatos: ${arr.length}`);
        arr.slice(0, 15).forEach((c, i) => {
          console.log(`    [${i+1}] ${c.name} | ${c.folderPath} | ${String(c.id||'').slice(0,16)}`);
        });
        const trt = arr.find(c => String(c.name||'').toLowerCase().includes('trt') && String(c.name||'').toLowerCase().includes('julho'));
        if (trt) {
          const emImportados = /[\/\\]Importados[\/\\]?/i.test(String(trt.folderPath||''));
          console.log(`\n  Arquivo TRT-JULHO está em Importados? ${emImportados ? 'SIM' : 'NÃO'}`);
          console.log(`  path: ${trt.folderPath}`);
        }
      } catch (e) {
        console.log(`  ❌ Erro expand direto: ${e.message}`);
      }
    }
  }

  // [4/4] Confirmar hash L1/L2 apagados e linha referência intacta
  console.log(`\n=== [4/4] Confirmação estado SQLite ===`);
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(SQLITE_PATH);
  const db = new SQL.Database(buf);
  const c1 = db.exec('SELECT COUNT(*) FROM "Recurso TRT"')[0].values[0][0];
  const c2 = db.exec("SELECT COUNT(*) FROM imported_row_hashes WHERE kind = 'recurso_trt'")[0].values[0][0];
  const c3 = db.exec("SELECT COUNT(*) FROM consignado_app_config WHERE key LIKE 'imported_file_sha256::v1::%' AND (value LIKE '%TRT%' OR value LIKE '%JULHO%' OR value LIKE '%recurso_trt%')")[0].values[0][0];
  console.log(`  Total linhas Recurso TRT: ${c1}`);
  console.log(`  Hashes L1 recurso_trt: ${c2} (esperado 0)`);
  console.log(`  Hashes L2 TRT/JULHO: ${c3} (esperado 0)`);
  // Listar rowid=1
  const r1 = db.exec(`SELECT rowid, "Nome","Copetencia","Contrato","Vencimento" FROM "Recurso TRT" WHERE rowid=1`)[0];
  if (r1 && r1.values[0]) console.log(`  rowid=1: Nome=${r1.values[0][1]}, Cop=${r1.values[0][2]}, Contrato=${r1.values[0][3]}, Venc=${r1.values[0][4]}`);
  db.close();
  console.log(`\n✅ Diagnóstico concluído.`);
}

main().catch(e => { console.error('\n❌ ERRO FATAL:', e); process.exit(1); });
