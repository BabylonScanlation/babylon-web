import fs from 'fs';
import path from 'path';

/**
 * Script de Orion: Purga física del almacenamiento R2 local.
 * Borra las imágenes descargadas pero mantiene la base de datos intacta.
 */

const R2_LOCAL_PATH = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'r2');

function purgeR2Cache() {
  console.log('🚀 Iniciando purga de imágenes en R2 local...');

  if (!fs.existsSync(R2_LOCAL_PATH)) {
    console.log('ℹ️ No se encontró la carpeta de R2 local. Nada que borrar.');
    return;
  }

  try {
    // Borramos el contenido de la carpeta r2
    fs.rmSync(R2_LOCAL_PATH, { recursive: true, force: true });
    // Recreamos la carpeta vacía para que Wrangler no se confunda
    fs.mkdirSync(R2_LOCAL_PATH, { recursive: true });

    console.log('✅ Almacenamiento R2 limpiado con éxito.');
    console.log(
      '⚠️ ADVERTENCIA: La base de datos aún tiene los registros. Al intentar leer, verás errores 404 hasta que resincronices.'
    );
  } catch (error) {
    console.error('❌ Error al limpiar R2:', error.message);
  }
}

purgeR2Cache();
