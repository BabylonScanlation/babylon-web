import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DUMP_PATH = path.join('db_snapshots', 'dump.sql');
const DB_NAME = 'babylon-scanlation-prod';

async function patchSchema() {
  console.log('🔍 Analizando dump para detectar discrepancias de esquema...');

  if (!fs.existsSync(DUMP_PATH)) {
    console.error('❌ No se encontró el dump en:', DUMP_PATH);
    return;
  }

  const sql = fs.readFileSync(DUMP_PATH, 'utf8');

  // 1. Regex mejorada para detectar INSERT INTO en cualquier tabla
  const tablesToPatch = ['Users', 'Series', 'Chapters', 'Comments'];

  for (const tableName of tablesToPatch) {
    // Regex flexible: INSERT [OR IGNORE] INTO ["']tableName["'] (cols...)
    const insertRegex = new RegExp(
      `INSERT\\s+(?:OR\\s+IGNORE\\s+)?INTO\\s+["']?${tableName}["']?\\s*\\((.*?)\\)`,
      'i'
    );
    const match = sql.match(insertRegex);

    if (!match) {
      console.log(`ℹ️  No se encontraron inserts para la tabla '${tableName}'.`);
      continue;
    }

    const expectedColumns = match[1].split(',').map((c) => c.trim().replace(/["']/g, ''));

    // 2. Obtener esquema local
    console.log(`📋 Consultando esquema local de '${tableName}'...`);
    let tableInfo;
    try {
      tableInfo = execSync(
        `npx wrangler d1 execute ${DB_NAME} --local --command="PRAGMA table_info(${tableName});"`,
        { encoding: 'utf8' }
      );
    } catch (e) {
      console.warn(`⚠️  No se pudo consultar '${tableName}'. Es probable que aún no exista.`);
      continue;
    }

    const existingColumns = tableInfo
      .split('\n')
      .filter((line) => line.includes('│') && !line.includes('cid'))
      .map((line) => line.split('│')[2].trim());

    // 3. Parchear columnas faltantes
    const missingColumns = expectedColumns.filter((col) => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log(
        `🛠️  Detectadas ${missingColumns.length} columnas faltantes en '${tableName}': ${missingColumns.join(', ')}`
      );

      for (const col of missingColumns) {
        console.log(`➕ Añadiendo columna: ${col}...`);
        try {
          // Inferencia simple de tipos
          let type = 'TEXT';
          let defaultValue = 'NULL';

          if (
            col.endsWith('_at') ||
            col.includes('version') ||
            col.includes('count') ||
            col.startsWith('is_')
          ) {
            type = 'INTEGER';
            defaultValue = '0';
          }

          execSync(
            `npx wrangler d1 execute ${DB_NAME} --local --command="ALTER TABLE ${tableName} ADD COLUMN ${col} ${type} DEFAULT ${defaultValue};"`,
            { stdio: 'inherit' }
          );
        } catch (e) {
          console.warn(`⚠️  No se pudo añadir ${col} a ${tableName}: ${e.message}`);
        }
      }
    } else {
      console.log(`✅ El esquema de '${tableName}' ya es compatible.`);
    }
  }
}

patchSchema().catch(console.error);
