import { createApiRoute } from '../../../../lib/api';
import { anonymousUsers } from '../../../../db/schema';
import { sql } from 'drizzle-orm';

export const GET = createApiRoute({ auth: 'admin' }, async ({ locals, request }) => {
  const db = locals.db;
  const url = new URL(request.url);
  const range = url.searchParams.get('range') || '7';
  const days = parseInt(range, 10);

  try {
    // 1. New Users (Last N days)
    const msToSubtract = days * 24 * 60 * 60 * 1000;
    const startTime = Date.now() - msToSubtract;

    const rawUsers = await db.select({
      createdAt: anonymousUsers.createdAt
    })
    .from(anonymousUsers)
    .where(sql`${anonymousUsers.createdAt} >= ${startTime}`)
    .all();

    const usersByDate: Record<string, number> = {};
    rawUsers.forEach(u => {
      if (!u.createdAt) return;
      // Convert timestamp to YYYY-MM-DD
      const dateStr = new Date(u.createdAt).toISOString().substring(0, 10); 
      usersByDate[dateStr] = (usersByDate[dateStr] || 0) + 1;
    });

    const newUsers = Object.entries(usersByDate)
      .map(([date, count]) => ({ creationDate: date, userCount: count }))
      .sort((a, b) => a.creationDate.localeCompare(b.creationDate));

    // 2. Advanced Device & Geo Breakdown (Fetch all UAs and Countries to process in JS)
    // Fetching raw strings is cheap (bytes) vs complex SQL string parsing
    const allUserData = await db.select({ 
      ua: anonymousUsers.userAgent,
      country: anonymousUsers.country 
    })
      .from(anonymousUsers)
      .where(sql`${anonymousUsers.userAgent} IS NOT NULL`)
      .all();

    const stats = {
      os: {} as Record<string, number>,
      browser: {} as Record<string, number>,
      type: { mobile: 0, desktop: 0 },
      country: {} as Record<string, number>
    };

    allUserData.forEach(({ ua, country }) => {
      // Geo Stats
      if (country) {
        stats.country[country] = (stats.country[country] || 0) + 1;
      } else {
        stats.country['Desconocido'] = (stats.country['Desconocido'] || 0) + 1;
      }

      if (!ua) return;
      const agent = ua.toLowerCase();

      // Detect OS
      let os = 'Otros';
      if (agent.includes('windows')) os = 'Windows';
      else if (agent.includes('android')) os = 'Android';
      else if (agent.includes('iphone') || agent.includes('ipad')) os = 'iOS';
      else if (agent.includes('mac os')) os = 'macOS';
      else if (agent.includes('linux')) os = 'Linux';
      
      stats.os[os] = (stats.os[os] || 0) + 1;

      // Detect Browser
      let browser = 'Otros';
      if (agent.includes('edg/')) browser = 'Edge';
      else if (agent.includes('chrome') && !agent.includes('edg/')) browser = 'Chrome';
      else if (agent.includes('firefox')) browser = 'Firefox';
      else if (agent.includes('safari') && !agent.includes('chrome')) browser = 'Safari';
      else if (agent.includes('opr') || agent.includes('opera')) browser = 'Opera';

      stats.browser[browser] = (stats.browser[browser] || 0) + 1;

      // Detect Type
      if (agent.includes('mobile') || agent.includes('android') || agent.includes('iphone')) {
        stats.type.mobile++;
      } else {
        stats.type.desktop++;
      }
    });

    const systemStats = {
      newUsers,
      devices: {
        type: stats.type, 
        os: stats.os,
        browser: stats.browser,
        country: stats.country
      }
    };

    return new Response(JSON.stringify(systemStats), { status: 200 });
  } catch (e) {
    console.error('API Error in /admin/stats/system:', e);
    return new Response(JSON.stringify({ error: 'No se pudieron obtener las estadísticas del sistema.', details: String(e) }), { status: 500 });
  }
});
