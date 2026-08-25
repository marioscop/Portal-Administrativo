// debug_job3_0linhas.js — Ler SQLite DEV: profiles, último batch import e linhas extratos TRE
const fs = require('fs');
const initSqlJs = require('sql.js');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'consignado.sqlite');
(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  console.log('=== 1. Learning Profiles (ordem original) ===');
  const profiles = db.exec(`SELECT id, kind, target_table, file_name_regex, match_url_contains FROM import_learning_profiles ORDER BY id ASC`);
  if (profiles[0]) {
    const cols = profiles[0].columns;
    profiles[0].values.forEach((r, idx) => {
      const obj = {};
      cols.forEach((c, i) => obj[c] = r[i]);
      console.log(`  [${idx+1}] id=${obj.id} kind=${obj.kind} target=${obj.target_table}`);
      console.log(`       regex=${obj.file_name_regex}`);
      console.log(`       url_contains=${obj.match_url_contains}`);
      console.log('');
    });
  }

  console.log('\n=== 2. Últimos 5 import_batches (data desc) ===');
  const batches = db.exec(`SELECT id, kind, target_table, file_name, created_at, total_rows_inserted, total_rows_skipped, batch_type, parent_id FROM import_batches ORDER BY created_at DESC LIMIT 5`);
  if (batches[0]) {
    const cols = batches[0].columns;
    batches[0].values.forEach((r, idx) => {
      const obj = {};
      cols.forEach((c, i) => obj[c] = r[i]);
      console.log(`  [${idx+1}] id=${String(obj.id).padStart(3)} kind=${String(obj.kind).padEnd(22)} target=${String(obj.target_table).padEnd(24)} file=${String(obj.file_name ?? '').padEnd(32).slice(0,32)} inserted=${obj.total_rows_inserted} skipped=${obj.total_rows_skipped} batch_type=${obj.batch_type} parent=${obj.parent_id} at=${obj.created_at}`);
    });
  }

  console.log('\n=== 3. Linhas da tabela extratos com TRE no source ou histórico ===');
  const treRows = db.exec(`SELECT "id", "DATA", "DOCUMENTO", "HISTÓRICO", "HISTÓRICO_1", "VALOR", "Copetencia", "CompetenciaArquivo", "__source_file" FROM extratos WHERE "__source_file" LIKE '%TRE%' OR HISTÓRICO_1 LIKE '%TRIBUNAL%' OR HISTÓRICO LIKE '%TRE%' ORDER BY id DESC LIMIT 10`);
  if (treRows[0]) {
    const cols = treRows[0].columns;
    console.log('  Colunas:', cols.join(' | '));
    treRows[0].values.forEach((r, idx) => {
      const vals = r.map((v, i) => {
        if (cols[i] === '__source_file' && String(v).length > 44) return '...' + String(v).slice(-44);
        return String(v ?? 'NULL').slice(0, 28);
      });
      console.log(`  [${idx+1}] ${vals.join(' | ')}`);
    });
  } else {
    console.log('  (nenhuma linha TRE na tabela extratos ainda)');
  }

  console.log('\n=== 4. Imported Row Hashes kind=extratos últimos 5 ===');
  const hashes = db.exec(`SELECT "kind", "hash", "created_at", substr(row_summary, 1, 100) AS s FROM imported_row_hashes WHERE kind='extratos' ORDER BY created_at DESC LIMIT 5`);
  if (hashes[0]) {
    const cols = hashes[0].columns;
    hashes[0].values.forEach((r, idx) => {
      const obj = {};
      cols.forEach((c, i) => obj[c] = r[i]);
      console.log(`  [${idx+1}] kind=${obj.kind} at=${obj.created_at} s=${obj.s}`);
    });
  } else {
    console.log('  (nenhum hash kind=extratos)');
  }
})();
