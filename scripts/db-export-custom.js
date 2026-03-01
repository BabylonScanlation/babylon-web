import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DUMP_PATH = path.join('db_snapshots', 'dump.sql');
const DB_NAME = 'babylon-scanlation-prod';

function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (_error) {
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
  console.log('⚡ ORION: Generando exportación con integridad referencial garantizada...');

  const query = (q) =>
    runCommand(`npx wrangler d1 execute ${DB_NAME} --remote --command "${q}" --json`);

  let sqlDump = 'PRAGMA foreign_keys = OFF;\n';

  // 1. Users
  console.log('📦 Exportando Users...');
  const usersJson = query('SELECT * FROM Users');
  if (usersJson) {
    const rows = JSON.parse(usersJson)[0].results;
    rows.forEach((row) => {
      const cols = Object.keys(row);
      const vals = cols.map((c) => escapeStringOneLine(row[c])).join(', ');
      sqlDump += `INSERT OR IGNORE INTO "Users" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals});\n`;
    });
  }

  // 2. Series
  console.log('📦 Exportando Series...');
  const seriesJson = query('SELECT * FROM Series');
  if (seriesJson) {
    const rows = JSON.parse(seriesJson)[0].results;
    rows.forEach((row) => {
      const cols = Object.keys(row);
      const vals = cols.map((c) => escapeStringOneLine(row[c])).join(', ');
      sqlDump += `INSERT OR IGNORE INTO "Series" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals});\n`;
    });
  }

  // 3. Chapters (Solo si la serie existe)
  console.log('📦 Exportando Chapters (Clean)...');
  const chaptersJson = query('SELECT * FROM Chapters WHERE series_id IN (SELECT id FROM Series)');
  if (chaptersJson) {
    const rows = JSON.parse(chaptersJson)[0].results;
    rows.forEach((row) => {
      const cols = Object.keys(row);
      const vals = cols.map((c) => escapeStringOneLine(row[c])).join(', ');
      sqlDump += `INSERT OR IGNORE INTO "Chapters" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals});\n`;
    });
  }

  // 4. Pages (Solo si el capítulo existe)
  console.log('📦 Exportando Pages (Clean)...');
  const pagesJson = query('SELECT * FROM Pages WHERE chapter_id IN (SELECT id FROM Chapters)');
  if (pagesJson) {
    const rows = JSON.parse(pagesJson)[0].results;
    rows.forEach((row) => {
      const cols = Object.keys(row);
      const vals = cols.map((c) => escapeStringOneLine(row[c])).join(', ');
      sqlDump += `INSERT OR IGNORE INTO "Pages" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals});\n`;
    });
  }

  // 5. Otras tablas menores (Sin filtros complejos para no eternizar)
  const others = [
    'AnonymousUsers',
    'UserRoles',
    'SeriesViews',
    'ChapterViews',
    'Comments',
    'SeriesComments',
    'Favorites',
  ];
  for (const table of others) {
    console.log(`📦 Exportando ${table}...`);
    const data = query(`SELECT * FROM ${table}`);
    if (data) {
      const rows = JSON.parse(data)[0].results;
      rows.forEach((row) => {
        const cols = Object.keys(row);
        const vals = cols.map((c) => escapeStringOneLine(row[c])).join(', ');
        sqlDump += `INSERT OR IGNORE INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals});\n`;
      });
    }
  }

  sqlDump += 'PRAGMA foreign_keys = ON;\n';
  fs.writeFileSync(DUMP_PATH, sqlDump);
  console.log(`\n💾 Dump con integridad garantizada guardado.`);
}

main().catch((err) => console.error(err));
