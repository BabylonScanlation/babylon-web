import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DUMP_PATH = path.join('db_snapshots', 'dump.sql');
const DB_NAME = 'babylon-scanlation-prod';

function runCommand(command) {
  try {
    // Orion: Aumentamos el buffer para dumps grandes
    return execSync(command, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });
  } catch (error) {
    console.error(`❌ Error ejecutando comando: ${command}`);
    if (error.stderr) console.error(error.stderr);
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

async function main() {
  console.log('⚡ ORION: Generando exportación completa de todas las tablas...');

  const query = (q) =>
    runCommand(`npx wrangler d1 execute ${DB_NAME} --remote --command "${q}" --json`);

  // Obtener lista de todas las tablas de usuario
  console.log('🔍 Listando tablas disponibles en D1 Remote...');
  const tablesJson = query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'drizzle_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE '%_fts_%'"
  );

  if (!tablesJson) {
    console.error('❌ No se pudieron obtener las tablas de la base de datos remota.');
    process.exit(1);
  }

  const results = JSON.parse(tablesJson)[0].results;
  const allTables = results.map((r) => r.name);
  console.log(`📑 Encontradas ${allTables.length} tablas de usuario.`);

  let sqlDump = 'PRAGMA foreign_keys = OFF;\n';

  // Orden prioritario para mitigar problemas de FK (aunque usemos FK OFF)
  const priority = ['Users', 'Series', 'Chapters', 'Pages'];
  const skip = new Set(['d1_migrations', '_cf_KV']);
  const processed = new Set();

  // 1. Exportar tablas prioritarias primero
  for (const table of priority) {
    if (allTables.includes(table)) {
      console.log(`📦 Exportando ${table} (Prioridad)...`);
      const data = query(`SELECT * FROM "${table}"`);
      if (data) {
        const rows = JSON.parse(data)[0].results;
        rows.forEach((row) => {
          const cols = Object.keys(row);
          const vals = cols.map((c) => escapeStringOneLine(row[c])).join(', ');
          sqlDump += `INSERT OR IGNORE INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals});\n`;
        });
      }
      processed.add(table);
    }
  }

  // 2. Exportar el resto de tablas
  for (const table of allTables) {
    if (!processed.has(table) && !skip.has(table)) {
      console.log(`📦 Exportando ${table}...`);
      const data = query(`SELECT * FROM "${table}"`);
      if (data) {
        const result = JSON.parse(data)[0];
        if (result?.results) {
          result.results.forEach((row) => {
            const cols = Object.keys(row);
            const vals = cols.map((c) => escapeStringOneLine(row[c])).join(', ');
            sqlDump += `INSERT OR IGNORE INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals});\n`;
          });
        }
      }
      processed.add(table);
    }
  }

  sqlDump += 'PRAGMA foreign_keys = ON;\n';

  if (!fs.existsSync(path.dirname(DUMP_PATH))) {
    fs.mkdirSync(path.dirname(DUMP_PATH), { recursive: true });
  }

  fs.writeFileSync(DUMP_PATH, sqlDump);
  console.log(`\n💾 Dump completo guardado en ${DUMP_PATH}`);
  console.log(`✅ Sincronización preparada para ${processed.size} tablas.`);
}

main().catch((err) => console.error(err));
