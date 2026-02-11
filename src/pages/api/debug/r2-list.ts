import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const env = locals.runtime.env;
  
  if (!env.R2_ASSETS) {
    return new Response('R2 binding missing', { status: 500 });
  }

  try {
    const list = await env.R2_ASSETS.list();
    const keys = list.objects.map((o: any) => o.key);
    
    return new Response(JSON.stringify({ 
      count: keys.length,
      keys: keys 
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(`Error listing R2: ${e}`, { status: 500 });
  }
};
