import { execSync } from 'child_process';

/**
 * Script de mantenimiento para limpiar usuarios anónimos inactivos.
 * Definición de inactividad: No han visitado el sitio en los últimos 3 meses.
 */

const INACTIVITY_PERIOD = '-3 months'; // Formato SQLite (e.g., '-30 days', '-6 months')

async function purgeInactiveUsers() {
  console.log('🚀 Iniciando purga de usuarios anónimos inactivos...');

  // Query para borrar usuarios de AnonymousUsers
  const queryUsers = `DELETE FROM AnonymousUsers WHERE updated_at < datetime('now', '${INACTIVITY_PERIOD}');`;

  // Query para borrar vistas huérfanas (opcional, para ahorrar espacio máximo)
  const queryViews = `DELETE FROM ChapterViews WHERE guest_id IS NOT NULL AND guest_id NOT IN (SELECT guest_id FROM AnonymousUsers);`;

  try {
    console.log(
      `--- Ejecutando limpieza (Usuarios inactivos > ${INACTIVITY_PERIOD.replace('-', '')}) ---`
    );

    // Ejecutamos vía Wrangler D1 para que funcione tanto local como remoto según los parámetros
    const command = `npx wrangler d1 execute babylon-scanlation-prod --local --command "${queryUsers} ${queryViews}"`;

    const output = execSync(command, { encoding: 'utf-8' });
    console.log(output);

    console.log('✅ Mantenimiento completado con éxito.');
    console.log(
      '💡 Nota: Si quieres limpiar la base de datos de PRODUCCIÓN, añade "--remote" manualmente al comando de wrangler.'
    );
  } catch (error) {
    console.error('❌ Error durante la purga:', error.message);
  }
}

purgeInactiveUsers();
