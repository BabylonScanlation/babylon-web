import type { APIRoute } from 'astro';

// Orion: RAM Cache para lista de imágenes (Peticiones Cero)
let profileImagesMemoryCache: { data: string; expires: number } | null = null;

export const GET: APIRoute = async ({ locals }) => {
  const { env } = locals.runtime;
  const now = Date.now();

  // 1. Intentar obtener desde RAM (Peticiones Cero)
  if (profileImagesMemoryCache && profileImagesMemoryCache.expires > now) {
    return new Response(profileImagesMemoryCache.data, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Lista manual de Avatares (Animales)
  const animals = [
    'ardilla',
    'ballena',
    'caballo',
    'camaleon',
    'canguro',
    'conejo',
    'elefante',
    'flamenco',
    'gato',
    'jirafa',
    'koala',
    'leon',
    'leona',
    'loro',
    'mamut',
    'megatherium',
    'oso',
    'oveja',
    'panda',
    'pato',
    'perro',
    'plesiosaurio',
    'pterodactilo',
    'sable',
  ];

  // Lista manual de Banners
  const banners = ['moon.jpg', 'tokiri.jpg'];

  const publicUrl = env.R2_PUBLIC_URL_ASSETS;

  // Generamos las URLs completas
  const ManualAvatars: string[] = animals.map(
    (animal) => `${publicUrl}/profile_logo/${animal}.png`
  );
  const ManualBanners: string[] = banners.map((banner) => `${publicUrl}/profile_banner/${banner}`);

  if (!env.R2_ASSETS) {
    return new Response(JSON.stringify({ error: 'R2_ASSETS not configured' }), { status: 500 });
  }

  try {
    // Intentamos listar del bucket para capturar cualquier imagen nueva que subas (Prod)
    const avatarsList = await env.R2_ASSETS.list({ prefix: 'profile_logo/' });
    const bannersList = await env.R2_ASSETS.list({ prefix: 'profile_banner/' });

    // Evitamos duplicados convirtiendo a Set
    const r2Avatars = (avatarsList.objects || [])
      .filter((obj: { size: number }) => obj.size > 0)
      .map((obj: { key: string }) => `${publicUrl}/${obj.key}`);

    const r2Banners = (bannersList.objects || [])
      .filter((obj: { size: number }) => obj.size > 0)
      .map((obj: { key: string }) => `${publicUrl}/${obj.key}`);

    // Unimos la lista manual con lo que encuentre en R2 (evitando duplicados)
    const finalAvatars = [...new Set([...ManualAvatars, ...r2Avatars])];
    const finalBanners = [...new Set([...ManualBanners, ...r2Banners])];

    const responseBody = JSON.stringify({
      avatars: finalAvatars,
      banners: finalBanners,
    });

    // Guardar en RAM por 1 hora (3,600,000 ms)
    profileImagesMemoryCache = { data: responseBody, expires: now + 3600000 };

    return new Response(responseBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch {
    // Si falla el listado (común en local), devolvemos al menos la lista manual
    return new Response(
      JSON.stringify({
        avatars: ManualAvatars,
        banners: ManualBanners,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
