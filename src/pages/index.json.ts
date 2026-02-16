import type { APIRoute } from 'astro';
import { siteConfig } from '../site.config';

export const GET: APIRoute = async () => {
  const siteUrl = siteConfig.url;
  const name = siteConfig.name;
  
  const extensions = [
    {
      "id": 413829,
      "name": name,
      "version": "0.2.1",
      "lang": "es",
      "baseUrl": siteUrl,
      "apiUrl": "",
      "iconUrl": `https://wsrv.nl/?url=${siteUrl}${siteConfig.assets.favicon}&output=png`,
      "sourceCodeUrl": `${siteUrl}/repo/extension.js`,
      "typeSource": "single",
      "nsfw": false,
      "itemType": 0,
      "sourceCodeLanguage": 1,
      "appMinVerReq": "0.1.0"
    },
    {
      "id": 555666,
      "name": "Dumanwu",
      "version": "1.9.1",
      "lang": "zh",
      "baseUrl": "https://dumanwu.com",
      "apiUrl": "",
      "iconUrl": "https://dumanwu.com/static/images/favicon.ico",
      "sourceCodeUrl": `${siteUrl}/repo/dumanwu.js`,
      "typeSource": "single",
      "nsfw": false,
      "itemType": 0,
      "sourceCodeLanguage": 1,
      "appMinVerReq": "0.1.0"
    },
    {
      "id": 111222,
      "name": "NewToki",
      "version": "1.1.0",
      "lang": "ko",
      "baseUrl": "https://newtoki465.com",
      "apiUrl": "",
      "iconUrl": "https://newtoki465.com/favicon.ico",
      "sourceCodeUrl": `${siteUrl}/repo/newtoki.js`,
      "typeSource": "single",
      "nsfw": true,
      "itemType": 0,
      "sourceCodeLanguage": 1,
      "appMinVerReq": "0.1.0"
    },
    {
      "id": 222333,
      "name": "ToonKor",
      "version": "1.1.0",
      "lang": "ko",
      "baseUrl": "https://tkor.dog",
      "apiUrl": "",
      "iconUrl": "https://tkor.dog/favicon.ico",
      "sourceCodeUrl": `${siteUrl}/repo/toonkor.js`,
      "typeSource": "single",
      "nsfw": true,
      "itemType": 0,
      "sourceCodeLanguage": 1,
      "appMinVerReq": "0.1.0"
    },
    {
      "id": 333444,
      "name": "RawKuma",
      "version": "1.1.0",
      "lang": "ja",
      "baseUrl": "https://rawkuma.net",
      "apiUrl": "",
      "iconUrl": "https://rawkuma.net/favicon.ico",
      "sourceCodeUrl": `${siteUrl}/repo/rawkuma.js`,
      "typeSource": "single",
      "nsfw": false,
      "itemType": 0,
      "sourceCodeLanguage": 1,
      "appMinVerReq": "0.1.0"
    },
    {
      "id": 555777,
      "name": "BaoziManhua",
      "version": "1.1.0",
      "lang": "zh",
      "baseUrl": "https://cn.baozimh.com",
      "apiUrl": "",
      "iconUrl": "https://cn.baozimh.com/favicon.ico",
      "sourceCodeUrl": `${siteUrl}/repo/baozimanhua.js`,
      "typeSource": "single",
      "nsfw": false,
      "itemType": 0,
      "sourceCodeLanguage": 1,
      "appMinVerReq": "0.1.0"
    },
    {
      "id": 666777,
      "name": "Manhuagui",
      "version": "1.1.0",
      "lang": "zh",
      "baseUrl": "https://www.manhuagui.com",
      "apiUrl": "",
      "iconUrl": "https://www.manhuagui.com/favicon.ico",
      "sourceCodeUrl": `${siteUrl}/repo/manhuagui.js`,
      "typeSource": "single",
      "nsfw": false,
      "itemType": 0,
      "sourceCodeLanguage": 1,
      "appMinVerReq": "0.1.0"
    },
    {
      "id": 777888,
      "name": "ManhwaRaw",
      "version": "1.0.0",
      "lang": "ko",
      "baseUrl": "https://manhwaraw.com",
      "apiUrl": "",
      "iconUrl": "https://manhwaraw.com/favicon.ico",
      "sourceCodeUrl": `${siteUrl}/repo/manhwaraw.js`,
      "typeSource": "single",
      "nsfw": false,
      "itemType": 0,
      "sourceCodeLanguage": 1,
      "appMinVerReq": "0.1.0"
    },
    {
      "id": 888999,
      "name": "RawDEX",
      "version": "1.0.0",
      "lang": "ko",
      "baseUrl": "https://rawdex.net",
      "apiUrl": "",
      "iconUrl": "https://rawdex.net/favicon.ico",
      "sourceCodeUrl": `${siteUrl}/repo/rawdex.js`,
      "typeSource": "single",
      "nsfw": false,
      "itemType": 0,
      "sourceCodeLanguage": 1,
      "appMinVerReq": "0.1.0"
    },
    {
      "id": 999000,
      "name": "Manga1000",
      "version": "1.0.0",
      "lang": "ja",
      "baseUrl": "https://manga1000.top",
      "apiUrl": "",
      "iconUrl": "https://manga1000.top/favicon.ico",
      "sourceCodeUrl": `${siteUrl}/repo/manga1000.js`,
      "typeSource": "single",
      "nsfw": false,
      "itemType": 0,
      "sourceCodeLanguage": 1,
      "appMinVerReq": "0.1.0"
    }
  ];

  return new Response(JSON.stringify(extensions), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
};
