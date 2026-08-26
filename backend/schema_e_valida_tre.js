// Validador SQL TRE: PRAGMA table_info + SELECT * FROM "Recurso TRE" ORDER DESC LIMIT 6 + validação 10 cols vs esperado BENEDITO
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const SQLITE_PATH = path.join(__dirname, 'data', 'consignado.sqlite');

(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(SQLITE_PATH);
  const db = new SQL.Database(buf);

  // 1) PRAGMA info e COUNT
  console.log('=== PRAGMA table_info("Recurso TRE") ===');
  try {
    const pragma = db.exec('PRAGMA table_info("Recurso TRE")');
    if (pragma.length > 0) {
      pragma[0].values.forEach((r, i) => {
        console.log(`CID${String(i).padStart(2,'0')} [${r[5] ? 'PK ' : '  '}] ${String(r[1]).padEnd(20)} ${String(r[2]).padEnd(10)} default=${JSON.stringify(r[4])}`);
      });
    } else {
      console.log('Tabela Recurso TRE ainda NÃO EXISTE. (Será criada no primeiro addMissingColumnsAndImportRows).');
    }
  } catch (e) { console.log('Pragma erro (tabela ainda não criada?):', e.message.split('\n')[0]); }
  try {
    const cnt = db.exec('SELECT COUNT(*) as c, MIN(rowid), MAX(rowid) FROM "Recurso TRE"');
    console.log('\n=== TOTAL LINHAS "Recurso TRE":', cnt[0].values[0][0], '| min rowid:', cnt[0].values[0][1], '| max rowid:', cnt[0].values[0][2]);
  } catch (e) { console.log('COUNT N/A:', e.message.split('\n')[0]); }

  // 2) Todas as linhas existentes ordenadas por rowid
  console.log('\n=== SELECT rowid,* FROM "Recurso TRE" ORDER BY rowid DESC LIMIT 6 ===');
  let rows = [];
  try {
    const sel = db.exec('SELECT rowid,* FROM "Recurso TRE" ORDER BY rowid DESC LIMIT 6');
    if (sel.length > 0) rows = sel[0].values.map(vals => { const o = {}; sel[0].columns.forEach((c,i) => o[c] = vals[i]); return o; });
  } catch (e) { console.log('SELECT vazio:', e.message.split('\n')[0]); }

  // 3) Validação 10 cols principais 1ª linha (BENEDITO)
  const expected = {
    rowidOrdem01: 'BENEDITO (1ª linha útil do Excel)',
    Nome: 'BENEDITO DA COSTA VELOSO FILHO',
    CPF: '222.101.051-53',
    Copetencia: '08/2026',
    'Desc Finalidade': 'CREDITO CONSIGNADO',
    Contrato: '6.191,00', // ou '6191' ou '6.191,00'
    'N Parcela': 59, // Prazo 059
    'Qtd Parcelas': 59, // duplicado (TRE só tem 1 coluna Prazo)
    Vencimento: '26/08/2001',
    'Critério de Débito': 'Folha Pagto',
    'Valor Parcela': 'R$ 3944.41',
  };
  console.log('\n=== VALIDAÇÃO 10 COLS PRINCIPAIS vs ESPERADO (BENEDITO / Cop=08/2026 / Venc=26/08/2001) ===');
  const main10 = ['Nome','CPF','Copetencia','Desc Finalidade','Contrato','N Parcela','Qtd Parcelas','Vencimento','Critério de Débito','Valor Parcela'];
  const norm = (s) => String(s ?? '').trim().toUpperCase().replace(/\s+/g,' ').replace(/[\.\-]/g,'');
  let hits = 0;
  if (rows.length === 0) {
    console.log('❌ NÃO HÁ LINHAS no Recurso TRE (oneshot não disparou ainda ou insert com 0 linhas).');
  } else {
    // Percorrer as linhas (DESC rowid, então primeiro é a mais nova = oneshot)
    for (let idx = 0; idx < Math.min(rows.length, 3); idx++) {
      const r = rows[idx];
      console.log(`\n--- Rowid=${r.rowid} (${idx === 0 ? 'mais nova' : 'mais antiga ' + idx}) ---`);
      let subtotal = 0;
      main10.forEach((k) => {
        const real = r[k];
        const exp = expected[k];
        let ok = false;
        if (k === 'Contrato') {
          const realN = norm(String(real||'')).replace(/,/g,'.').replace(/^0+/,'');
          const expN  = norm(String(exp||'')).replace(/,/g,'.').replace(/^0+/,'');
          ok = (realN && expN && (realN.includes(expN) || expN.includes(realN))) ||
               Number(String(real||'').replace(/[^\d]/g,'')) === 6191;
        } else if (k === 'N Parcela' || k === 'Qtd Parcelas') {
          ok = Number(String(real||'').replace(/[^\d]/g,'')) === Number(exp);
        } else if (k === 'Valor Parcela') {
          const realD = Number(String(real||'').replace(/[^\d.]/g,''));
          ok = Math.abs(realD - 3944.41) < 0.02;
        } else if (k === 'Nome' || k === 'CPF' || k === 'Copetencia' || k === 'Vencimento') {
          ok = norm(real) === norm(exp);
        } else if (k === 'Desc Finalidade' || k === 'Critério de Débito') {
          ok = String(real||'').trim().toUpperCase() === String(exp||'').trim().toUpperCase();
        }
        if (ok) { subtotal++; hits++; }
        const prefix = ok ? '✅' : '❌';
        console.log(`   ${prefix} ${k.padEnd(20)}: real=${JSON.stringify(real)} ${ok ? '' : '(ESPERADO: '+JSON.stringify(exp)+')'}`);
      });
      console.log(`   📊 SUBTOTAL Rowid=${r.rowid}: ${subtotal}/10 cols principais`);
    }
  }
  console.log('\nFIM validação TRE.');
  db.close();
})();
