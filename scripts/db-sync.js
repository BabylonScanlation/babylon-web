import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DUMP_PATH = path.join('db_snapshots', 'dump.sql');

async function main() {
  console.log('🔄 Iniciando sincronización inteligente de DB...');

  // 1. Descargar (Pull)
  console.log('⬇️  Descargando backup de producción...');
  execSync('npm run db:pull', { stdio: 'inherit' });

  // 2. Resetear Local
  console.log('cw  Reseteando base de datos local...');
  execSync('npm run db:reset:local', { stdio: 'inherit' });

  // 3. Aplicar Migraciones (Estructura Base)
  // Esto crea todas las tablas vacías correctamente
  console.log('🏗️  Aplicando estructura (migraciones)...');
  execSync('npm run db:migrate', { stdio: 'inherit' });

  // 4. Leer y Limpiar Dump
  console.log('🧹 Procesando dump.sql para evitar conflictos...');
  if (!fs.existsSync(DUMP_PATH)) {
    console.error('❌ Error: No se encontró db_snapshots/dump.sql');
    process.exit(1);
  }

  let sqlContent = fs.readFileSync(DUMP_PATH, 'utf-8');

  // --- FILTRADO AGRESIVO: SOLO DATOS ---
  
  // 1. Eliminar transacciones y pragmas conflictivos al inicio si es necesario, 
  // aunque 'defer_foreign_keys' es útil, a veces estorba si la sintaxis no es perfecta.
  // Vamos a limpiar todo lo que NO sea INSERT.
  
  // Estrategia: Vamos a iterar línea por línea para ser más seguros que una regex gigante.
  const lines = sqlContent.split('\n');
  const dataLines = lines.filter(line => {
    const trimmed = line.trim().toUpperCase();
    // Mantener solo líneas que empiezan con INSERT
    // OJO: Los dumps a veces tienen INSERT multi-línea. 
    // Pero en SQLite dumps estándar de Wrangler suelen ser una línea por INSERT.
    // Si fuera multi-línea, esto rompería. Asumimos formato estándar de Wrangler (una línea por comando).
    
    // Wrangler export suele generar:
    // PRAGMA ...
    // CREATE TABLE ...
    // INSERT INTO ... VALUES (...);
    // INSERT INTO ... VALUES (...);
    
    // Filtramos para quedarnos con los INSERT y quizás PRAGMA de foreign keys.
    if (trimmed.startsWith('INSERT INTO')) return true;
    if (trimmed.startsWith('PRAGMA')) return true; // Defer foreign keys es útil
    if (trimmed.startsWith('BEGIN TRANSACTION')) return true;
    if (trimmed.startsWith('COMMIT')) return true;
    
    return false;
  });
  
  // Reconstruir el SQL
  sqlContent = dataLines.join('\n');

  // Adicionalmente, remover INSERTs a d1_migrations para que no falle si ya existen por el migrate
  // (Aunque si hicimos reset, el migrate creó la tabla limpia, así que insertar el historial de prod está bien... 
  // PERO, si el migrate insertó un registro de "init", podría chocar.
  // Mejor NO importar d1_migrations de prod y dejar que el local tenga su propio estado limpio o sincronizado).
  sqlContent = sqlContent.replace(/INSERT INTO "?d1_migrations"? VALUES[\s\S]*?;/g, '');

  // Guardar versión limpia temporal
  const TEMP_DUMP = path.join('db_snapshots', 'dump_clean.sql');
  fs.writeFileSync(TEMP_DUMP, sqlContent);

  // 5. Importar Datos Limpios
  console.log('hz  Importando datos limpios...');
  try {
    execSync(`wrangler d1 execute babylon-scanlation-prod --local --file=${TEMP_DUMP}`, { stdio: 'inherit' });
    console.log('✅ Base de datos sincronizada correctamente.');
  } catch (error) {
    console.error('❌ Error importando los datos.');
    process.exit(1);
  } finally {
    // Limpieza
    if (fs.existsSync(TEMP_DUMP)) fs.unlinkSync(TEMP_DUMP);
  }

  // 6. Iniciar Dev
  console.log('🚀 Iniciando servidor de desarrollo...');
  execSync('npm run dev:cf', { stdio: 'inherit' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
