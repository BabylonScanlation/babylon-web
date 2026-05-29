import fs from 'node:fs';
import path from 'node:path';

/**
 * Script para aplanar la estructura de 'dist' generada por Astro 5/6 + @astrojs/cloudflare.
 * Mueve los activos de dist/client a dist/ y crea un _worker.js que apunta a dist/server/entry.mjs.
 */

const distDir = path.resolve('dist');
const clientDir = path.join(distDir, 'client');
const serverDir = path.join(distDir, 'server');

async function run() {
  console.log('--- Iniciando post-procesamiento para Cloudflare Pages ---');

  if (!fs.existsSync(distDir)) {
    console.error('Error: Directorio dist no encontrado.');
    process.exit(1);
  }

  // 1. Mover activos estáticos de dist/client a la raíz de dist
  if (fs.existsSync(clientDir)) {
    console.log('Moviendo activos estáticos de dist/client a dist/...');
    const files = fs.readdirSync(clientDir);
    for (const file of files) {
      const src = path.join(clientDir, file);
      const dest = path.join(distDir, file);

      // Usar cpSync con recursive para directorios (_astro, js, etc.)
      fs.cpSync(src, dest, { recursive: true, force: true });
    }
    // Opcional: eliminar el directorio client para evitar redundancia
    // fs.rmSync(clientDir, { recursive: true, force: true });
    console.log('✓ Activos estáticos movidos.');
  } else {
    console.warn('Advertencia: No se encontró el directorio dist/client.');
  }

  // 2. Crear _worker.js en la raíz de dist
  // Este archivo simplemente re-exporta el worker generado por Astro en dist/server
  const workerPath = path.join(distDir, '_worker.js');

  // Verificamos si existe el archivo de entrada del servidor
  const entryPath = path.join(serverDir, 'entry.mjs');
  if (fs.existsSync(entryPath)) {
    const workerContent = "import entry from './server/entry.mjs';\nexport default entry;\n";
    fs.writeFileSync(workerPath, workerContent);
    console.log('✓ Archivo dist/_worker.js creado con éxito.');
  } else {
    console.error('Error: No se encontró dist/server/entry.mjs. El worker no funcionará.');
  }

  // 3. Eliminar wrangler.json generado por Astro para evitar conflictos con Pages
  const unwantedConfig = path.join(serverDir, 'wrangler.json');
  if (fs.existsSync(unwantedConfig)) {
    fs.unlinkSync(unwantedConfig);
    console.log('✓ Archivo dist/server/wrangler.json eliminado para evitar conflictos.');
  }

  // 4. Eliminar la carpeta .wrangler para romper cualquier redirección de configuración
  const wranglerCache = path.resolve('.wrangler');
  if (fs.existsSync(wranglerCache)) {
    try {
      fs.rmSync(wranglerCache, { recursive: true, force: true });
      console.log('✓ Carpeta .wrangler eliminada para limpiar el estado de construcción.');
    } catch (e) {
      console.warn(
        'Advertencia: No se pudo eliminar la carpeta .wrangler (puede que esté en uso):',
        e.message
      );
    }
  }

  console.log('--- Post-procesamiento completado con éxito ---');
}

run().catch((err) => {
  console.error('Fallo en el script de post-procesamiento:', err);
  process.exit(1);
});
