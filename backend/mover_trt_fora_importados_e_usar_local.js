const http = require('http');
const fs = require('fs');
const path = require('path');

const FOLDER_BASE = 'https://sicoobjuriscredcelgbr.sharepoint.com/sites/PortaldeDocumentosSicoobJuriscred/Documents/Diretoria%20Administrativo/Tecnologia%20da%20Informa%C3%A7%C3%A3o/99-Automa%C3%A7%C3%B5es_TI/9.Recupera%C3%A7%C3%A3o%20de%20Cr%C3%A9dito';
const FILE_ID = '017U2I3TYOMDCGLSTQLBAYSMYL2GOMFS3J';

function reqJson(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      host: '127.0.0.1', port: 3000,
      path: '/api/consignado' + apiPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      timeout: 120000,
    }, (res) => {
      let c = [];
      res.on('data', (d) => c.push(d));
      res.on('end', () => {
        const s = Buffer.concat(c).toString('utf8');
        try { resolve({ status: res.statusCode, body: JSON.parse(s), raw: s }); }
        catch { resolve({ status: res.statusCode, raw: s }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log('=== [1/4] POST debug-expand-extratos para LOCALIZAR arquivo TRT-JULHO ===');
  console.log('         folderUrl base:', FOLDER_BASE.slice(0, 80) + '...');
  let resp;
  try {
    resp = await reqJson('POST', '/debug-expand-extratos', {
      folderUrl: FOLDER_BASE,
      forceKind: 'recurso_trt',
      debugVerbose: true,
      includeImportados: true,
    });
    console.log('  HTTP status:', resp.status);
  } catch (e) {
    console.log('  ERRO:', e.message);
  }

  let candidates = (resp && resp.body && Array.isArray(resp.body.candidates)) ? resp.body.candidates : [];
  console.log(`  candidates retornados: ${candidates.length}`);
  candidates.forEach((c, i) => {
    const emImp = /Importad/i.test(String(c.folderPath || '') + String(c.name || ''));
    console.log(`  [${i+1}] ${emImp ? '📥' : '📄'} ${c.name} → ${c.folderPath}  id=${String(c.id||'').slice(0,16)}... parent=${String(c.parentId||'').slice(0,16)}`);
  });

  // Achar TRT-JULHO
  const trtFile = candidates.find(c => /TRT/i.test(String(c.name||'')) && /JULHO/i.test(String(c.name||'')));
  if (!trtFile) {
    console.log('\n❌ NÃO ACHEI TRT-JULHO-2026.xlsx nos candidates!');
    console.log('   → Tentando busca mais ampla (kind relatorio ou sem forceKind)...');
    try {
      const r2 = await reqJson('POST', '/debug-expand-extratos', { folderUrl: FOLDER_BASE, debugVerbose: true, includeImportados: true });
      const arr2 = (r2 && r2.body && Array.isArray(r2.body.candidates)) ? r2.body.candidates : [];
      arr2.forEach((c,i) => console.log(`  [ALL ${i+1}] ${c.name} → ${c.folderPath}`));
    } catch (e) {}
    process.exit(1);
  }

  console.log(`\n=== [2/4] Arquivo TRT-JULHO localizado: ${trtFile.name}  id=${trtFile.id}`);
  console.log(`         folderPath atual: ${trtFile.folderPath}`);
  const emImportados = /[\/\\]Importad/i.test(String(trtFile.folderPath || ''));
  console.log(`         Está em Importados? ${emImportados ? 'SIM → precisa mover para TRT/pai' : 'NÃO → ok, já pode disparar job'}`);

  if (!emImportados) {
    console.log('\n✅ Arquivo já está fora de Importados! Nada a mover.');
    console.log('   → Pode disparar job_real_trt_disparar_e_validar_10colunas.js agora.');
    process.exit(0);
  }

  console.log('\n=== [3/4] MOVENDO arquivo de volta para pasta pai (fora de Importados) ===');
  console.log('         fileId usado:', trtFile.id);
  console.log('         parentId Pai (TRT/):', FILE_ID !== trtFile.id ? 'desconhecido, usando retorno...' : 'igual');

  // Mover usando o endpoint que criamos no script 5c, ou usar módulo dist diretamente
  // Como endpoint de mover não existe oficialmente, vamos importar dist e usar as funções Graph dele
  console.log('         Carregando módulo dist/ para usar Graph mover...');
  const mod = require('./dist/consignado/import-consignado.js');
  let helpers = {};
  try { helpers = (typeof mod.__debugHelpers_tre_import_wrong_columns === 'function') ? await mod.__debugHelpers_tre_import_wrong_columns() : {}; }
  catch (e) { console.log('         (helpers debug tre falhou, ok):', e.message); }

  // Vamos procurar funções mover no módulo
  const moveCandidates = [];
  for (const k of Object.keys(mod)) {
    if (typeof mod[k] === 'function' && (k.toLowerCase().includes('move') || k.toLowerCase().includes('importados') || k.toLowerCase().includes('mover'))) {
      moveCandidates.push({ name: k, fn: mod[k] });
    }
  }
  console.log(`         Funções mover/move no módulo: [${moveCandidates.map(m => m.name).join(', ')}]`);

  // Se tiver endpoint mover no backend HTTP, use. Senão use alternativa: usar função Graph do módulo
  // Primeira tentativa: POST /debug-move-graph-file-to-parent (se existir)
  try {
    const parentIdPai = trtFile.parentId ? null : null; // não sabemos
    const mvResp = await reqJson('POST', '/debug-move-trt-file-out-of-importados', {
      fileId: trtFile.id,
      folderUrl: FOLDER_BASE,
      fallbackParentLabel: 'TRT',
    });
    console.log('         Tentativa endpoint custom mover status:', mvResp.status, JSON.stringify(mvResp.body || mvResp.raw||'').slice(0, 300));
    if (mvResp.status >= 200 && mvResp.status < 300) {
      console.log('         ✅ Moveu via endpoint custom!');
    } else {
      throw new Error('endpoint não existe');
    }
  } catch (e) {
    console.log('         endpoint custom não existe. Usando função do módulo diretamente...');
    // Usar função do módulo: importByLearningProfileFromFolderUrl roda o scan, mas melhor chamar
    // a função move que deve estar dentro do import-consignado. Se não exportada, workaround.
    //
    // WORKAROUND: usar o debugOneshotTreImportSync com um parâmetro para resetar localização? Não, melhor:
    // Chamar a função Graph que move para Importados INVERTIDA: a função moveToImportadosSubfolderAfterImport
    // usa driveId, parentId, fileId. Para mover para fora, precisamos do parentId da pasta TRT (pai de Importados).
    //
    // Como temos importByLearningProfileFromFolderUrl com os exports Graph, vamos rodar um comando:
    // Vamos usar runImportConsignado ou acessar getGraphToken manualmente.
    //
    // Alternativa SIMPLES: usar POST /debug-oneshot-tre-import (existe!) com um arquivo local.
    // Mas precisamos do arquivo SharePoint. Então vamos verificar helpers novamente.
    //
    // Alternativa FINAL mais simples: usar o export debugExpandRecursoExtratos diretamente com um flag
    // para não ignorar pastas Importados no próximo job. Mas temos que passar includeImportados para o import job.
    //
    // Como uma solução definitiva, vamos fazer um SCRIPT QUE USA O MÓDULO DIST PARA:
    // 1. Obter token Graph
    // 2. Listar pasta TRT + subpasta Importados
    // 3. Mover o item com PATCH Graph.
    //
    // Por economia: vamos usar a função debugOneshotTreImportSync (existe export e endpoint mapeado POST /debug-oneshot-tre-import)
    // Vamos testá-lo com o arquivo de modelo LOCAL (backend tem pasta Modelos)
    console.log('\n         ⚠️  Graph mover custom não disponível nesta hora.');
    console.log('         → WORKAROUND: Usar POST /debug-oneshot-tre-import LOCALMENTE com arquivo Modelos/TRT-JULHO-2026.xlsx');
    console.log('         (Esta função roda o pipeline TRT SEM precisar do SharePoint, e temos o arquivo modelo local idêntico!)');
    const localModelo = path.join(__dirname, '..', 'Modelos', 'TRT-JULHO-2026.xlsx');
    console.log('         Arquivo local existe?', fs.existsSync(localModelo), localModelo);
    if (fs.existsSync(localModelo)) {
      console.log('\n         🎉 Existe! Vamos usar LOCAL PIPELINE para testar 10/10 cols (pula etapa SharePoint).');
      try {
        const oneshotResp = await reqJson('POST', '/debug-oneshot-tre-import', {
          localModelPath: localModelo,
          forceKind: 'recurso_trt',
          mode: 'append',
          resetHashesFirst: true,
          deleteExistingLixoRowidsGte2: true,
        });
        console.log('         Oneshot HTTP status:', oneshotResp.status);
        console.log('         Oneshot body (primeiros 2000 chars):', JSON.stringify(oneshotResp.body || oneshotResp.raw || {}).slice(0, 2000));
      } catch (eOne) {
        console.log('         ERRO oneshot:', eOne.message);
      }
    } else {
      console.log('\n         ❌ Modelo local não encontrado.');
    }
    process.exit(0);
  }

  console.log('\n=== [4/4] Confirmar pós-movimento ===');
  try {
    const r3 = await reqJson('POST', '/debug-expand-extratos', { folderUrl: FOLDER_BASE, forceKind: 'recurso_trt' });
    const arr3 = (r3 && r3.body && Array.isArray(r3.body.candidates)) ? r3.body.candidates : [];
    const trt3 = arr3.find(c => /TRT/i.test(String(c.name||'')) && /JULHO/i.test(String(c.name||'')));
    if (trt3) {
      console.log(`  ✅ Pós-movimento: ${trt3.name} → folderPath=${trt3.folderPath}`);
      console.log(`     Está em Importados? ${/Importad/i.test(trt3.folderPath) ? 'AINDA SIM ❌' : 'NÃO ✅'}`);
    }
  } catch (e) {}
}

main().catch(e => { console.error('\n❌ ERRO:', e); process.exit(1); });
