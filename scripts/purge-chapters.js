import { execSync } from 'child_process';

/**
 * Script de Orion: Purga total de capítulos y páginas procesadas.
 * Útil para re-testear el motor de sincronización.
 */

async function purgeChapters() {
  console.log('🚀 Eliminando capítulos descargados...');

  const query = `DELETE FROM Chapters;`;

  try {
    const command = `npx wrangler d1 execute babylon-scanlation-prod --local --command "${query}"`;
    const output = execSync(command, { encoding: 'utf-8' });
    console.log(output);
    console.log('✅ Capítulos eliminados. El sistema está listo para nuevas descargas.');
  } catch (error) {
    console.error('❌ Error durante la purga:', error.message);
  }
}

purgeChapters();
