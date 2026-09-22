import type { APIRoute } from 'astro';
import robotsTxt from '../data/robots.txt?raw';

export const GET: APIRoute = () =>
  new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
