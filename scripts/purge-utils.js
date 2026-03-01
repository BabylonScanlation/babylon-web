import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 🪐 Babylon Web - Herramienta Unificada de Limpieza (Purge Tools)
 *
 * Uso: node scripts/purge-utils.js [target] [--remote]
 * Targets:
 *   --users     Limpia usuarios anónimos inactivos (> 3 meses)
 *   --chapters  Limpia la tabla de capítulos (D1)
 *   --r2        Limpia físicamente el almacenamiento R2 local
 *   --all       Ejecuta todas las limpiezas anteriores
 */

const args = process.argv.slice(2);
const isRemote = args.includes('--remote');
const targetLocal = isRemote ? '--remote' : '--local';
const R2_PATH = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'r2');

async function purgeInactiveUsers() {
  console.log('🚀 Limpiando usuarios anónimos inactivos...');
  const InactivityPeriod = '-3 months';
  const query = `DELETE FROM AnonymousUsers WHERE updated_at < datetime('now', '${InactivityPeriod}'); DELETE FROM ChapterViews WHERE guest_id IS NOT NULL AND guest_id NOT IN (SELECT guest_id FROM AnonymousUsers);`;

  try {
    const command = `npx wrangler d1 execute babylon-scanlation-prod ${targetLocal} --command "${query}"`;
    execSync(command, { stdio: 'inherit' });
    console.log('✅ Usuarios purgados.');
  } catch (e) {
    console.error('❌ Error purgando usuarios:', e.message);
  }
}

async function purgeChapters() {
  console.log('🚀 Eliminando registros de capítulos (D1)...');
  const query = 'DELETE FROM Chapters;';
  try {
    const command = `npx wrangler d1 execute babylon-scanlation-prod ${targetLocal} --command "${query}"`;
    execSync(command, { stdio: 'inherit' });
    console.log('✅ Registros de capítulos eliminados.');
  } catch (e) {
    console.error('❌ Error purgando capítulos:', e.message);
  }
}

function purgeR2() {
  console.log('🚀 Limpiando almacenamiento R2 local...');
  if (!fs.existsSync(R2_PATH)) {
    console.log('ℹ️ No se encontró R2 local.');
    return;
  }
  try {
    fs.rmSync(R2_PATH, { recursive: true, force: true });
    fs.mkdirSync(R2_PATH, { recursive: true });
    console.log('✅ Almacenamiento R2 local vaciado.');
  } catch (e) {
    console.error('❌ Error limpiando R2:', e.message);
  }
}

async function main() {
  if (args.length === 0 || args.includes('--help')) {
    console.log(
      'Uso: node scripts/purge-utils.js [--users] [--chapters] [--r2] [--all] [--remote]'
    );
    return;
  }

  if (args.includes('--all') || args.includes('--users')) await purgeInactiveUsers();
  if (args.includes('--all') || args.includes('--chapters')) await purgeChapters();
  if (args.includes('--all') || args.includes('--r2')) purgeR2();

  console.log(`
✨ Proceso de limpieza finalizado.`);
}

main();
