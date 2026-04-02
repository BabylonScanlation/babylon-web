export const siteConfig = {
  name: 'Babylon Scanlation',
  shortName: 'Babylon',
  description:
    'Tu destino definitivo para leer manga, manhwa y manhua con la mejor calidad y velocidad.',
  url: 'https://babylon-scanlation.pages.dev',
  author: 'Lucas Goldstein',

  // SEO & Social
  links: {
    telegram: 'https://t.me/babylon_scan',
    discord: 'https://discord.gg/babylon',
  },

  // Branding Assets (Usar URLs relativas o absolutas de R2 si es necesario)
  assets: {
    logo: '/favicon.png',
    logoHeader: '/iconpage/babylon-logo-2.webp',
    logoHeaderNsfw: '/iconpage/babylon-logo-4.webp',
    logoEmpty: '/iconpage/babylon-logo-3.webp',
    ogImage: '/og-image.webp',
    favicon: '/favicon.png',
    placeholderCover: '/covers/placeholder-cover.jpg',
    placeholderChapter: '/covers/placeholder-chapter.jpg',
  },

  // Tema Visual
  theme: {
    accent: '#00bfff',
    accentGlow: 'rgba(0, 191, 255, 0.4)',
    background: '#050505',
    backgroundAlt: '#020205',

    // Configuración de efectos
    cosmos: {
      enabled: true,
      physicsEnabled: true,
    },
  },

  // Configuración del Lector
  reader: {
    watermark: 'Babylon Scanlation',
    predictivePrefetch: 1200, // px para rootMargin de IntersectionObserver
  },

  // App Links
  app: {
    // Orion: Usamos el proxy de la API para no exponer el bucket de R2 en el cliente
    androidUrl: '/api/assets/proxy/babylonweb-app/DtupScan.apk',
  },

  // Persistencia y Prefijos
  storage: {
    prefix: 'babylon_', // Prefijo para localStorage y Cookies
    cacheName: 'babylon-v1', // Nombre de la caché del Service Worker
  },

  // Estructura de Archivos (R2)
  folders: {
    covers: 'covers',
    chapters: 'chapters',
    news: 'news',
    app: 'babylonweb-app',
  },

  // Seguridad y Bloqueo
  security: {
    blacklistedCountries: ['JP', 'KR', 'CN', 'US'],
    blockedBots: [
      'gptbot',
      'chatgpt',
      'openai',
      'anthropic',
      'claude',
      'google-batch',
      'bingbot',
      'ccbot',
      'bytespider',
      'megaindex',
      'dotbot',
      'mj12bot',
      'semrushbot',
      'ahrefsbot',
      'python-requests',
      'node-fetch',
      'axios',
      'go-http-client',
      'curl',
      'wget',
      'pandalytics',
      'headlesschrome',
      'selenium',
      'puppeteer',
      'playwright',
    ],
  },

  // Publicidad (Configuraciones y Placeholders de IDs)
  ads: {
    enabled: true,
    // IDs de Adsterra (leídos de .env o placeholders genéricos)
    adsterra: {
      banner: import.meta.env.PUBLIC_ADSTERRA_BANNER_ID || 'YOUR_BANNER_ID',
      bannerLarge: import.meta.env.PUBLIC_ADSTERRA_BANNER_LARGE_ID || 'YOUR_BANNER_LARGE_ID',
      bannerSmall: import.meta.env.PUBLIC_ADSTERRA_BANNER_SMALL_ID || 'YOUR_BANNER_SMALL_ID',
      square: import.meta.env.PUBLIC_ADSTERRA_SQUARE_ID || 'YOUR_SQUARE_ID',
    },
  },
};

export type SiteConfig = typeof siteConfig;
