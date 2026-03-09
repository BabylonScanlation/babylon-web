import type { APIRoute } from 'astro';
import { siteConfig } from '../site.config';

export const GET: APIRoute = async () => {
  const siteUrl = siteConfig.url;

  const repoData = {
    name: siteConfig.name,
    author: siteConfig.author,
    description: `Repositorio oficial de ${siteConfig.name}`,
    version: "1.1.0",
    website: siteUrl,
    extensions: [
      {
        name: siteConfig.name,
        pkgName: `com.${siteConfig.shortName.toLowerCase()}.scanlation`,
        version: "0.2.1",
        lang: "es",
        type: "manga",
        sourceUrl: `${siteUrl}/repo/extension.js`,
        apiUrl: siteUrl,
        iconUrl: `${siteUrl}${siteConfig.assets.favicon}`,
        nsfw: false
      },
      {
        name: "Hitomi.la",
        pkgName: "com.hitomi.la.extension",
        version: "1.0.1",
        lang: "es",
        type: "manga",
        sourceUrl: `${siteUrl}/repo/hitomi.js`,
        apiUrl: "",
        iconUrl: "https://hitomi.la/favicon.ico",
        nsfw: true
      }
    ]
  };

  return new Response(JSON.stringify(repoData), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
