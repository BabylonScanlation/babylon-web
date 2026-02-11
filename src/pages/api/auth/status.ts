import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  // Nos aseguramos de que siempre devuelva un objeto válido para evitar SyntaxError: JSON.parse
  const userData = locals.user || null;
  
  return new Response(JSON.stringify(userData), {
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0'
    },
    status: 200
  });
};