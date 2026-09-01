import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DUMP_DIR = 'db_snapshots';
const DUMP_PATH = path.join(DUMP_DIR, 'dump.sql');
const DB_NAME = 'babylon-scanlation-prod';

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19);
}

function runCommand(commandStr) {
  try {
    const result = spawnSync(`npx.cmd ${commandStr}`, { 
      encoding: 'utf-8', 
      maxBuffer: 100 * 1024 * 1024,
      shell: true
    });
    
    if (result.error) {
       console.error(`❌ Spawn Error:`, result.error);
       return null;
    }
    
    // Ignore the Assertion crash on Windows if we got valid JSON
    if (result.status !== 0 && !result.stdout) {
       console.error(`❌ Error Code ${result.status}:`);
       console.error(result.stderr);
       return null;
    }
    
    return result.stdout;
  } catch (error) {
    console.error(`❌ Error ejecutando comando:`, error);
    return null;
  }
}

function escapeStringOneLine(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

function query(q) {
  // Pass the query as a single string to let shell handle quoting on Windows
  return runCommand(`wrangler d1 execute ${DB_NAME} --remote --command "${q}" --json`);
}

function exportTable(table) {
  let tableSql = '';
  console.log(`📦 Exportando ${table}...`);
  const data = query(`SELECT * FROM "${table}"`);

  if (data) {
    const parsed = JSON.parse(data);
    const results = parsed[0]?.results;
    if (results) {
      for (const row of results) {
        const cols = Object.keys(row);
        const vals = cols.map((c) => escapeStringOneLine(row[c])).join(', ');
        tableSql += `INSERT OR IGNORE INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals});\n`;
      }
    }
  }
  return tableSql;
}

function main() {
  console.log('⚡ ORION: Generando exportación completa de todas las tablas...');

  const timestamp = getTimestamp();
  const timestampedPath = path.join(DUMP_DIR, `dump_${timestamp}.sql`);

  console.log('🔍 Listando tablas disponibles en D1 Remote...');
  const tablesJson = query("SELECT name FROM sqlite_master WHERE type='table'");

  if (!tablesJson) {
    console.error('❌ No se pudieron obtener las tablas de la base de datos remota.');
    process.exit(1);
  }

  const parsed = JSON.parse(tablesJson);
  
  if (parsed.error) {
    console.error('❌ Error de Cloudflare/Wrangler:');
    console.error(parsed.error.text);
    if (parsed.error.notes) {
      parsed.error.notes.forEach(n => console.error('   -', n.text));
    }
    console.error('\n⚠️ Por favor, revisa tu autenticación (ej: npx wrangler login) o tus tokens de API.');
    process.exit(1);
  }

  const results = parsed[0]?.results;
  
  if (!results) {
    console.error('❌ La respuesta JSON no tiene el formato esperado:', parsed);
    process.exit(1);
  }
  
  const allTables = results
    .map((r) => r.name)
    .filter(
      (n) =>
        !n.startsWith('sqlite_') &&
        !n.startsWith('drizzle_') &&
        !n.startsWith('_cf_') &&
        !n.includes('_fts_')
    );
  console.log(`📑 Encontradas ${allTables.length} tablas de usuario.`);

  let sqlDump = 'PRAGMA foreign_keys = OFF;\n';

  const priority = ['Users', 'Series', 'Chapters', 'Pages'];
  const skip = new Set(['d1_migrations', '_cf_KV']);
  const processed = new Set();

  for (const table of priority) {
    if (allTables.includes(table)) {
      sqlDump += exportTable(table);
      processed.add(table);
    }
  }

  for (const table of allTables) {
    if (!processed.has(table) && !skip.has(table)) {
      sqlDump += exportTable(table);
      processed.add(table);
    }
  }

  sqlDump += 'PRAGMA foreign_keys = ON;\n';

  if (!fs.existsSync(DUMP_DIR)) {
    fs.mkdirSync(DUMP_DIR, { recursive: true });
  }

  fs.writeFileSync(timestampedPath, sqlDump);
  console.log(`\n💾 Backup histórico guardado en ${timestampedPath}`);

  fs.writeFileSync(DUMP_PATH, sqlDump);
  console.log(`🔄 Archivo de sincronización actualizado en ${DUMP_PATH}`);

  console.log(`✅ Exportación completada para ${processed.size} tablas.`);
}

main();
