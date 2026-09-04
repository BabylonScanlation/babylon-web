export const siteConfig = {
  name: 'My Scanlation Group',
  shortName: 'MyScan',
  description:
    'Tu destino definitivo para leer manga, manhwa y manhua con la mejor calidad y velocidad.',
  url: 'https://myscanlation.pages.dev',
  author: 'Your Name',

  // SEO & Social
  links: {
    telegram: 'https://t.me/your_channel',
    discord: 'https://discord.gg/your_server',
    facebook: 'https://facebook.com/YourPage',
    twitter: 'https://x.com/YourTwitter',
  },

  // Branding Assets (Usar URLs relativas o absolutas de R2 si es necesario)
  assets: {
    logo: '/favicon.png',
    logoHeader: '/iconpage/logo.webp',
    logoHeaderNsfw: '/iconpage/logo-nsfw.webp',
    logoEmpty: '/iconpage/logo-empty.webp',
    ogImage: '/og-image.webp',
    favicon: '/favicon.png',
    placeholderCover: '/covers/comic/placeholder-cover.jpg',
    placeholderChapter: '/covers/comic/placeholder-chapter.jpg',
  },

  // Tema Visual
  theme: {
    accent: '#00bfff', // Color principal (ej: botones, links)
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
    watermark: 'My Scanlation Group',
    predictivePrefetch: 1200, // px para rootMargin de IntersectionObserver
  },

  // App Links
  app: {
    androidUrl: '/api/assets/proxy/app/app-release.apk',
  },

  // Persistencia y Prefijos
  storage: {
    prefix: 'myscan_', // Prefijo para localStorage y Cookies
    cacheName: 'myscan-v1', // Nombre de la caché del Service Worker
  },

  // Estructura de Archivos (R2)
  folders: {
    coversComic: 'covers/comic',
    coversAnime: 'covers/anime',
    chapters: 'chapters',
    news: 'news',
    app: 'app-releases',
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

  // Publicidad (Integraciones con Ads)
  ads: {
    enabled: false,
    adsterra: {
      domain: import.meta.env.PUBLIC_ADSTERRA_DOMAIN,
      banner: import.meta.env.PUBLIC_ADSTERRA_BANNER_ID,
      bannerLarge: import.meta.env.PUBLIC_ADSTERRA_BANNER_LARGE_ID,
      bannerSmall: import.meta.env.PUBLIC_ADSTERRA_BANNER_SMALL_ID,
      square: import.meta.env.PUBLIC_ADSTERRA_SQUARE_ID,
      native: import.meta.env.PUBLIC_ADSTERRA_NATIVE_ID,
      socialBarUrl: import.meta.env.PUBLIC_ADSTERRA_SOCIAL_BAR_URL,
      popunderUrl: import.meta.env.PUBLIC_ADSTERRA_POPUNDER_URL,
      extraSmartlink: import.meta.env.ADSTERRA_SMARTLINK_EXTRA,
    },
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
