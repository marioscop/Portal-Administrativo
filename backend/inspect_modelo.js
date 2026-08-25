const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const input = path.resolve(process.cwd(), '..', 'Modelos', 'TRE-JULHO-2026.xlsx');
console.log('Arquivo:', input);
console.log('Existe?', fs.existsSync(input));
if (!fs.existsSync(input)) process.exit(2);
const buf = fs.readFileSync(input);
const wb = XLSX.read(buf, { cellDates: false, cellNF: true, cellHTML: false });
console.log('Sheets:', wb.SheetNames);
const sn = wb.SheetNames[0];
const sh = wb.Sheets[sn];
console.log('Worksheet ref:', sh['!ref']);
console.log('Total cols (AOA primeira): ');
const aoa = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: false, blankrows: false });
const header = aoa[0] || [];
console.log('\n=== HEADER LINHA 1 (colunas Excel) ===');
header.forEach((h, i) => console.log(' ', i, JSON.stringify(String(h ?? ''))));
console.log('\n=== AMOSTRA 5 LINHAS DE DADOS ===');
aoa.slice(1, 6).forEach((row, idx) => {
  console.log('\n  ---- Linha', idx + 2, '----');
  header.forEach((h, i) => {
    const raw = row[i];
    const disp = typeof raw === 'string' ? raw.slice(0, 120) : (raw === null || raw === undefined ? null : String(raw));
    console.log('   ', i, JSON.stringify(String(h ?? '')), '=>', JSON.stringify(disp));
  });
});
