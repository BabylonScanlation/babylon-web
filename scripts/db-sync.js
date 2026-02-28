import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DUMP_PATH = path.join('db_snapshots', 'dump.sql');

async function main() {
  console.log('🔄 Iniciando sincronización inteligente de DB...');

  // 1. Descargar (Pull) - Usando nuestro exportador custom
  console.log('⬇️  Descargando backup de producción...');
  try {
    execSync('npm run db:pull', { stdio: 'inherit' });
  } catch (e) {
    console.error('❌ Error en db:pull');
    process.exit(1);
  }

  // 2. Resetear Local
  console.log('🧹 Reseteando base de datos local...');
  try {
    execSync('npm run db:reset:local', { stdio: 'inherit' });
  } catch (e) {
    console.warn('⚠️  No se pudo resetear la DB local. Continuando...');
  }

  // 3. Aplicar Migraciones (Estructura Base)
  console.log('🏗️  Aplicando estructura (migraciones)...');
  execSync('npm run db:migrate', { stdio: 'inherit' });

  // 4. Importar Datos
  console.log('📥 Importando datos...');
  if (!fs.existsSync(DUMP_PATH)) {
    console.error('❌ Error: No se encontró db_snapshots/dump.sql');
    process.exit(1);
  }

  // Orion: Desactivar FKs para evitar errores de restricción durante la importación local
  const originalSql = fs.readFileSync(DUMP_PATH, 'utf8');
  // Eliminamos los PRAGMA anteriores si los hay
  const cleanSql = originalSql.replace(/PRAGMA foreign_keys = (ON|OFF);/g, '');
  const safeSql = `PRAGMA defer_foreign_keys = ON;\nBEGIN TRANSACTION;\n${cleanSql}\nCOMMIT;`;
  fs.writeFileSync(DUMP_PATH, safeSql);

  try {
    execSync(`npx wrangler d1 execute babylon-scanlation-prod --local --file=${DUMP_PATH}`, {
      stdio: 'inherit',
    });
    console.log('✅ Base de datos sincronizada correctamente.');
  } catch (e) {
    console.error('❌ Error importando datos a D1 Local:', e.message);
    process.exit(1);
  }

  // 5. Iniciar Servidor
  console.log('🚀 Iniciando servidor de desarrollo...');
  execSync('npm run dev:cf', { stdio: 'inherit' });
}

main().catch((err) => {
  console.error('\n💥 Error inesperado:', err);
  process.exit(1);
});
