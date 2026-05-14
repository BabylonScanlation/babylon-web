import { createApiRoute } from '../../../../lib/api';

/**
 * Orion: Endpoint para obtener ingresos de publicidad (Adsterra, Monetag).
 * Implementa caché en KV para no saturar las APIs de reportes.
 */
interface PlatformStats {
  name: string;
  today: number;
  month: number;
  cpm: number;
}

export const GET = createApiRoute({ auth: 'admin' }, async ({ locals, url }) => {
  const env = locals.runtime.env;
  const kv = env.KV_VIEWS;
  const forceRefresh = url.searchParams.get('refresh') === 'true';
  const cacheKey = 'admin_revenue_stats';

  // 1. Intentar obtener del caché de KV (Salto si es forceRefresh)
  if (kv && !forceRefresh) {
    const cached = await kv.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });
    }
  }

  // Orion: Detección directa desde el Runtime de Cloudflare
  const ADSTERRA_API_KEY = env.ADSTERRA_API_KEY;
  const MONETAG_API_TOKEN = env.MONETAG_API_TOKEN;

  const stats = {
    today: 0.0,
    month: 0.0,
    cpm: 0.0,
    platforms: [] as PlatformStats[],
  };

  try {
    const [adsterra, monetag] = await Promise.all([
      fetchAdsterraStats(ADSTERRA_API_KEY).catch(() => null),
      fetchMonetagStats(MONETAG_API_TOKEN).catch(() => null),
    ]);

    if (adsterra) {
      stats.today += adsterra.today;
      stats.month += adsterra.month;
      stats.platforms.push({ name: 'Adsterra', ...adsterra });
    }

    if (monetag) {
      stats.today += monetag.today;
      stats.month += monetag.month;
      stats.platforms.push({ name: 'Monetag', ...monetag });
    }

    if (stats.platforms.length > 0) {
      const totalCpm = stats.platforms.reduce((acc, p) => acc + p.cpm, 0);
      stats.cpm = totalCpm / stats.platforms.length;
    }

    // Orion: Cálculo de TTL dinámico para actualizar a las 10, 16 y 22 ART (UTC-3)
    const now = new Date();
    // Convertimos a hora de Argentina (UTC-3)
    const artTime = new Date(now.getTime() + now.getTimezoneOffset() * 60000 - 3 * 3600000);
    const currentHour = artTime.getHours();

    let nextUpdateHour = 10;
    if (currentHour >= 10 && currentHour < 16) nextUpdateHour = 16;
    else if (currentHour >= 16 && currentHour < 22) nextUpdateHour = 22;
    else if (currentHour >= 22 || currentHour < 10) nextUpdateHour = 10;

    const nextUpdateDate = new Date(artTime);
    if (currentHour >= 22) nextUpdateDate.setDate(nextUpdateDate.getDate() + 1);
    nextUpdateDate.setHours(nextUpdateHour, 0, 0, 0);

    // Calculamos segundos hasta la próxima ventana (mínimo 60s por seguridad)
    const diffMs = nextUpdateDate.getTime() - artTime.getTime();
    const expirationTtl = Math.max(60, Math.floor(diffMs / 1000));

    const responseBody = JSON.stringify(stats);
    if (kv) await kv.put(cacheKey, responseBody, { expirationTtl });

    return new Response(responseBody, {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'X-Next-Update': nextUpdateDate.toISOString(),
      },
    });
  } catch {
    return new Response(JSON.stringify(stats), { status: 200 });
  }
});

interface AdsterraItem {
  date: string;
  revenue: string | number;
  impression?: string | number;
}

async function fetchAdsterraStats(apiKey?: string) {
  if (!apiKey) return null;
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    // Primer día del mes actual
    const startOfMonthStr = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];

    const url = `https://api3.adsterratools.com/publisher/stats.json?start_date=${startOfMonthStr}&finish_date=${todayStr}&group_by[]=date`;

    const res = await fetch(url, {
      headers: {
        'X-API-Key': apiKey.trim(),
        Accept: 'application/json',
        'User-Agent': 'Babylon/2.5',
      },
    });

    if (!res.ok) {
      console.error(`DEBUG [Adsterra]: HTTP Error ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { items?: AdsterraItem[] };
    const items = data.items || [];

    let today = 0,
      month = 0,
      totalImpressions = 0;

    items.forEach((i) => {
      const revenue =
        typeof i.revenue === 'string' ? parseFloat(i.revenue) : Number(i.revenue || 0);
      month += revenue;
      // Orion: Corregido de 'impressions' a 'impression' según log real
      totalImpressions += parseInt(String(i.impression || 0), 10);
      if (i.date === todayStr) today = revenue;
    });

    return {
      today,
      month,
      cpm: totalImpressions > 0 ? (month / totalImpressions) * 1000 : 0,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('DEBUG [Adsterra]: Connection Error', message);
    return null;
  }
}

interface MonetagItem {
  date: string;
  money: string | number;
  impr?: string | number;
}

async function fetchMonetagStats(token?: string) {
  if (!token) return null;
  try {
    // Orion: Monetag usa Bearer Token en el header
    const res = await fetch(`https://api.monetag.com/api/v1/stats/daily`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { rows?: MonetagItem[] };

    const items = data.rows || [];
    const todayStr = new Date().toISOString().split('T')[0];

    let today = 0,
      month = 0,
      totalImpressions = 0;
    items.forEach((i) => {
      const revenue = typeof i.money === 'string' ? parseFloat(i.money) : Number(i.money || 0);
      month += revenue;
      totalImpressions += parseInt(String(i.impr || 0), 10);
      if (i.date === todayStr) today = revenue;
    });

    return {
      today,
      month,
      cpm: totalImpressions > 0 ? (month / totalImpressions) * 1000 : 0,
    };
  } catch {
    return null;
  }
}
