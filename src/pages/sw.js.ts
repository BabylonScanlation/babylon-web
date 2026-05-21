import type { APIRoute } from 'astro';
import { siteConfig } from '../site.config';

export const GET: APIRoute = async () => {
  const swContent = `
const CACHE_NAME = '${siteConfig.storage.cacheName}';
const STATIC_ASSETS = [
  '${siteConfig.assets.favicon}',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Ignorar peticiones a la API o de otras extensiones/orígenes no HTTP
  if (request.url.includes('/api/') || !request.url.startsWith('http')) return;

  // Ignorar explícitamente recursos de terceros (CORS) para evitar bloquear anuncios o analíticas
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }
  
  if (['image', 'style', 'script'].includes(request.destination)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((response) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            // Solo guardar en caché si es una respuesta válida y no opaca
            if (networkResponse.ok && networkResponse.type === 'basic') {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
          return response || fetchPromise;
        });
      })
    );
  }
});
  `;

  return new Response(swContent, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
