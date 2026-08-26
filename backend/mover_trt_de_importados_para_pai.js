const path = require('path');
const root = path.resolve(__dirname);
process.chdir(root);
const distDir = path.join(root, 'dist');

(async () => {
  try {
    const mod = require(path.join(distDir, 'consignado', 'import-consignado.js'));

    const funcsNecessarias = [
      'openDatabase', 'ensureSchema', 'getSqlitePath',
      'getSharePointAndTeamsDelegatedTokenForAutomation',
      'listDriveItemChildren', 'graphGet', 'graphPatch',
      'resolveDriveItemFromShareUrl'
    ];
    for (const f of funcsNecessarias) {
      if (typeof mod[f] !== 'function') {
        console.log(`FUNCAO FALTANTE: ${f} (exports.keys = ${Object.keys(mod).slice(0, 30).join(', ')})`);
      }
    }

    const dbFilePath = mod.getSqlitePath();
    console.log('DB PATH =', dbFilePath);
    const db = await mod.openDatabase(dbFilePath);
    mod.ensureSchema(db);
    try { mod.ensureDefaultLearningProfiles(db); } catch (_) {}

    const tokenPair = await mod.getSharePointAndTeamsDelegatedTokenForAutomation(db);
    const accessToken = tokenPair.accessToken;
    console.log('TOKEN LEN =', (accessToken || '').length);
    if (!accessToken) { console.log('ERRO: Sem token Graph'); return; }

    // ==== Pasta TRT pai (folderUrl do summary, Resumo item 0.2):
    // parentId TRT = 017U2I3T7JVLMHSBF2TNALR33C34GM2BCG
    // folderUrl base TRT (SharePoint): a pasta que contém TRT como subfilho.
    const folderUrlTrtPaiSharepoint = String.raw`https://sicoobjuriscredcelgbr.sharepoint.com/sites/PortaldeDocumentosSicoobJuriscred/Documents/Diretoria%20Administrativo/Tecnologia%20da%20Informa%C3%A7%C3%A3o/99-Automa%C3%A7%C3%B5es_TI/9.Recupera%C3%A7%C3%A3o%20de%20Cr%C3%A9dito/2026/Julho/Relat%C3%B3rio%20Org%C3%A3o/TRT`;

    let resolvedTrtPai;
    try {
      resolvedTrtPai = await mod.resolveDriveItemFromShareUrl(accessToken, folderUrlTrtPaiSharepoint);
    } catch (e) {
      console.log('resolveDirect TRT falhou:', String(e && e.message || e).slice(0, 200));
      resolvedTrtPai = null;
    }
    if (!resolvedTrtPai) {
      console.log('ERRO: Não resolveu pasta TRT pai');
      return;
    }
    console.log('RESOLVIDO TRT PAI: driveId=', resolvedTrtPai.driveId, 'itemId=', resolvedTrtPai.itemId, 'name=', resolvedTrtPai.itemName);
    const driveId = resolvedTrtPai.driveId;
    const trtPaiId = resolvedTrtPai.itemId;

    // === Passo 1: Listar children da pasta TRT pai → encontrar subpasta "Importados"
    const kidsTrtPai = await mod.listDriveItemChildren(accessToken, driveId, trtPaiId);
    console.log('\n== CHILDREN pasta TRT pai (qtde =', kidsTrtPai.length, ')');
    kidsTrtPai.slice(0, 20).forEach((c, i) => {
      console.log(`  [${i}] name=${c.name} folder=${Boolean(c.folder)} id=${String(c.id).slice(0, 12)}...`);
    });
    const importadosFolder = kidsTrtPai.find((c) => {
      const n = String(c.name || '').trim();
      const nNorm = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return c.folder && (nNorm === 'importados' || nNorm.endsWith(' importados') || nNorm.startsWith('importados '));
    });
    if (!importadosFolder) {
      console.log('\n== AVISO: subpasta Importados NÃO existe em TRT (provavelmente arquivo já está no pai). Kids acima.');
      process.exit(0);
    }
    console.log('\n== Subpasta Importados ENCONTRADA: id =', importadosFolder.id, 'nome=', importadosFolder.name);

    // === Passo 2: Listar children de TRT/Importados → encontrar arquivo TRT-JULHO-2026.xlsx
    const kidsImportados = await mod.listDriveItemChildren(accessToken, driveId, String(importadosFolder.id));
    console.log('\n== CHILDREN da subpasta Importados (qtde =', kidsImportados.length, ')');
    kidsImportados.forEach((c, i) => {
      console.log(`  [${i}] name=${c.name} file=${Boolean(c.file)} id=${String(c.id).slice(0, 16)}... size=${c.size || 'n/a'}`);
    });
    const arqTrt = kidsImportados.find((c) => {
      const n = String(c.name || '').trim().toLowerCase();
      return c.file && /trt.*julho.*2026.*\.xlsx?$/.test(n) || /^trt-julho-2026\.xlsx?$/.test(n);
    }) || kidsImportados.find((c) => c.file && /trt/i.test(String(c.name)));
    if (!arqTrt) {
      console.log('\nERRO: Não encontrei arquivo TRT dentro de Importados.');
      return;
    }
    console.log('\n== Arquivo TRT ENCONTRADO em Importados: name=', arqTrt.name, 'id=', arqTrt.id);

    // === Passo 3: Mover de volta para TRT pai (PATCH Graph)
    console.log('\n== MOVENDO arquivo de Importados -> TRT pai (parentId =', trtPaiId, ')...');
    const movePayload = {
      parentReference: { id: String(trtPaiId) },
      name: String(arqTrt.name)
    };
    const moveUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(String(arqTrt.id))}`;
    const moveRes = await mod.graphPatch(accessToken, moveUrl, movePayload);
    console.log('MOVE RES POST status ok?', moveRes && typeof moveRes === 'object' ? Object.keys(moveRes) : typeof moveRes);
    console.log('MOVE parentReference new =', moveRes && moveRes.parentReference);

    // === Passo 4: Confirmar movido (verificar children TRT pai de novo)
    const kidsTrtPaiDepois = await mod.listDriveItemChildren(accessToken, driveId, trtPaiId);
    const temArquivo = kidsTrtPaiDepois.find((c) => c.file && String(c.name) === String(arqTrt.name));
    console.log('\n== CONFIRMAÇÃO: children pasta TRT pai agora tem arquivo TRT?', Boolean(temArquivo));
    kidsTrtPaiDepois.forEach((c, i) => {
      if (c.file) console.log(`  ARQUIVO: ${c.name} id=${String(c.id).slice(0, 16)}`);
    });

    try { await db.close && db.close(); } catch (_) {}
    console.log('\n=== SUCESSO ===');
  } catch (e) {
    console.log('\nERRO FATAL:', e && e.stack || e);
    process.exit(1);
  }
})();
