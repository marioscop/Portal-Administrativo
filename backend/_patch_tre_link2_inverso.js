const fs = require('fs');
const p = 'c:\\Users\\mario.junior\\OneDrive - Sicoob Juriscred\\1.Projetos\\33.Portal Administrativo\\Portal-Administrativo\\backend\\src\\consignado\\import-consignado.ts';
let c = fs.readFileSync(p, 'utf8');
const anchor = `if (nP && !qP) r['Qtd Parcelas'] = nP;`;
const idx = c.indexOf(anchor);
console.log('idx anchor TRE-LINK2 oneshot TRE:', idx);
if (idx < 0) { console.error('ANCHOR NAO ENCONTRADO'); process.exit(2); }
const snippet = c.slice(idx, idx + 400);
console.log('==== SNIPPET 400chars ANTES ====');
console.log(snippet);
console.log('==== FIM SNIPPET ====');
const insert = "\n              if (qP && !nP) r['N Parcela'] = qP;";
const c2 = c.slice(0, idx + anchor.length) + insert + c.slice(idx + anchor.length);
fs.writeFileSync(p, c2);
console.log('EDITADO OK. Novo length:', c2.length);
process.exit(0);
