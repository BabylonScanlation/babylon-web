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
    facebook: 'https://facebook.com/BabylonScanlation',
    twitter: 'https://x.com/babylonscan',
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
    blacklistedCountries: ['JP', 'KR', 'CN'],
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

  // Publicidad
  ads: {
    enabled: true,
    // IDs de Adsterra
    adsterra: {
      domain: import.meta.env.PUBLIC_ADSTERRA_DOMAIN || 'levitydinerdowny.com',
      banner: import.meta.env.PUBLIC_ADSTERRA_BANNER_ID,
      bannerLarge: import.meta.env.PUBLIC_ADSTERRA_BANNER_LARGE_ID,
      bannerSmall: import.meta.env.PUBLIC_ADSTERRA_BANNER_SMALL_ID,
      square: import.meta.env.PUBLIC_ADSTERRA_SQUARE_ID,
      native: import.meta.env.PUBLIC_ADSTERRA_NATIVE_ID,
      socialBarUrl: import.meta.env.PUBLIC_ADSTERRA_SOCIAL_BAR_URL,
      popunderUrl: import.meta.env.PUBLIC_ADSTERRA_POPUNDER_URL,
      extraSmartlink: import.meta.env.ADSTERRA_SMARTLINK_EXTRA,
    },
    // IDs de Monetag
    monetag: {
      vignetteId: import.meta.env.PUBLIC_MONETAG_VIGNETTE_ID,
      vignetteUrl: import.meta.env.PUBLIC_MONETAG_VIGNETTE_URL,
      multitagId: import.meta.env.PUBLIC_MONETAG_MULTITAG_ID,
      multitagUrl: import.meta.env.PUBLIC_MONETAG_MULTITAG_URL,
      multitag2Id: import.meta.env.PUBLIC_MONETAG_MULTITAG_2_ID,
      multitag2Url: import.meta.env.PUBLIC_MONETAG_MULTITAG_2_URL,
      smartlinkUrl: import.meta.env.PUBLIC_MONETAG_SMARTLINK_URL,
      smartlink2Url: import.meta.env.PUBLIC_MONETAG_SMARTLINK_2_URL,
      smartlink3Url: import.meta.env.PUBLIC_MONETAG_SMARTLINK_3_URL,
    },
  },
};

export type SiteConfig = typeof siteConfig;
