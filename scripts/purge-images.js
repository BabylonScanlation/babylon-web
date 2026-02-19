import fs from 'fs';
import path from 'path';

/**
 * Script de Orion: Purga física de R2 Local.
 * Borra todas las imágenes y manifiestos descargados pero mantiene la DB.
 */

const R2_PATH = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'r2');

function purgeImages() {
  console.log('🚀 Iniciando limpieza de almacenamiento R2 local...');
  console.log(`📂 Ruta: ${R2_PATH}`);

  if (!fs.existsSync(R2_PATH)) {
    console.log(
      '❌ Error: No se encontró la carpeta de estado de R2. Asegúrate de estar en la raíz del proyecto.'
    );
    return;
  }

  try {
    // Borramos todo el contenido de la carpeta r2 de forma recursiva
    fs.rmSync(R2_PATH, { recursive: true, force: true });
    // Recreamos la carpeta vacía para que Wrangler no tenga errores de acceso
    fs.mkdirSync(R2_PATH, { recursive: true });

    console.log('✅ Imágenes y manifiestos eliminados físicamente.');
    console.log(
      '⚠️ NOTA: La base de datos aún tiene los registros. Al intentar leer, verás "Error de Enlace" porque los archivos ya no existen en disco.'
    );
  } catch (err) {
    console.error('❌ Fallo al limpiar R2:', err.message);
  }
}

purgeImages();
