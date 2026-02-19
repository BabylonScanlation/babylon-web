/**
 * 🚀 Cloudflare Pages Deployment Cleaner
 *
 * Uso:
 * CLOUDFLARE_API_TOKEN=tu_token node scripts/cleanup-deployments.js
 */

const ACCOUNT_ID = '8260ce74732f4b2f0219fea0cfa44119';
const PROJECT_NAME = 'babylon-scanlation';
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!API_TOKEN) {
  console.error('\n❌ Error: No se encontró la variable de entorno CLOUDFLARE_API_TOKEN');
  console.log('Uso: $env:CLOUDFLARE_API_TOKEN="tu_token"; node scripts/cleanup-deployments.js\n');
  process.exit(1);
}

async function fetchDeployments() {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`,
    {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const data = await res.json();
  if (!data.success) throw new Error(JSON.stringify(data.errors));
  return data.result;
}

async function run() {
  console.log(`🚀 [Cloudflare Cleaner] Iniciando limpieza de: ${PROJECT_NAME}`);

  try {
    let deployments = await fetchDeployments();

    // El primero suele ser el actual de producción
    const activeProd = deployments.find((d) => d.environment === 'production');
    const activeId = activeProd?.id;

    if (!activeId) {
      console.log('⚠️ No se detectó un despliegue activo. Por seguridad, abortando.');
      return;
    }

    console.log(`🏠 Manteniendo activo: ${activeId} [Production]`);

    let totalDeleted = 0;

    while (deployments.length > 0) {
      const toDelete = deployments.filter((d) => d.id !== activeId);

      if (toDelete.length === 0) break;

      for (const dep of toDelete) {
        process.stdout.write(`   ➤ Borrando ${dep.id} [${dep.environment}]... `);

        const delRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments/${dep.id}?force=true`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${API_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const delData = await delRes.json();
        if (delData.success) {
          console.log('✅');
          totalDeleted++;
        } else {
          console.log(`❌ (${delData.errors[0]?.message || 'Error'})`);
        }
      }

      console.log('🔄 Buscando más...');
      deployments = await fetchDeployments();
      if (deployments.length <= 1) break;
    }

    console.log(`\n✨ Limpieza terminada. ${totalDeleted} despliegues eliminados.`);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

run();
