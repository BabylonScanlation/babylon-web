import type { APIRoute } from 'astro';
import { siteConfig } from '../../site.config';

export const GET: APIRoute = async ({ locals }) => {
  const siteUrl = siteConfig.url;
  const name = siteConfig.name;
  const shortName = siteConfig.shortName;
  const authSecret = locals.runtime.env.AUTH_SECRET || 'YOUR_SECRET';

  const content = `/* eslint-disable */
// ==MiruExtension==
// @name         ${name}
// @version      0.2.1
// @author       ${siteConfig.author}
// @lang         es
// @license      MIT
// @icon         https://wsrv.nl/?url=${siteUrl}${siteConfig.assets.favicon}&output=png
// @package      com.${shortName.toLowerCase().replace(/[^a-z0-9]/g, '')}.scanlation
// @type         manga
// @webSite      ${siteUrl}
// @description  Official ${name} Extension
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "${siteUrl}";
  authSecret = "${authSecret}";
  nuclearSalt = "${shortName.replace(/[^a-z0-9]/gi, '')}_V2_Nucl3ar_S3cur1ty_";

  getHeaders(url) {
    return {
      "User-Agent": "Mangayomi/1.0",
      "Cookie": "site_verified=true"
    };
  }

  async req(path) {
    try {
        const client = new Client();
        const res = await client.get(this.baseUrl + path, this.getHeaders());
        let body = res.body;
        
        if (typeof body === 'string') {
            const trimmed = body.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                body = JSON.parse(trimmed);
            } else {
                return this.deobfuscate(trimmed) || {};
            }
        }
        
        if (body && body.payload) {
            const decrypted = this.deobfuscate(body.payload);
            return decrypted || body;
        }
        
        return body || {};
    } catch (e) {
        return {};
    }
  }

  deobfuscate(encryptedStr) {
    try {
      if (!encryptedStr || encryptedStr.length < 10) return null;
      const decoded = this.base64Decode(encryptedStr);
      if (!decoded || !decoded.startsWith(this.nuclearSalt)) return null;
      return JSON.parse(decoded.slice(this.nuclearSalt.length));
    } catch (e) { return null; }
  }

  base64Decode(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let bytes = [];
    str = str.replace(/[^A-Za-z0-9+/=]/g, '');
    for (let i = 0; i < str.length; i += 4) {
      const enc1 = chars.indexOf(str[i]);
      const enc2 = chars.indexOf(str[i + 1]);
      const enc3 = chars.indexOf(str[i + 2]);
      const enc4 = chars.indexOf(str[i + 3]);
      bytes.push((enc1 << 2) | (enc2 >> 4));
      if (enc3 !== 64) bytes.push(((enc2 & 15) << 4) | (enc3 >> 2));
      if (enc4 !== 64) bytes.push(((enc3 & 3) << 6) | enc4);
    }
    
    let out = "", i = 0;
    while (i < bytes.length) {
        let c = bytes[i++];
        if (c < 128) out += String.fromCharCode(c);
        else if (c > 191 && c < 224) out += String.fromCharCode(((c & 31) << 6) | (bytes[i++] & 63));
        else if (c > 239 && c < 248) {
            let val = ((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
            val -= 0x10000;
            out += String.fromCharCode(0xD800 | (val >> 10)) + String.fromCharCode(0xDC00 | (val & 0x3FF));
        }
        else out += String.fromCharCode(((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
    }
    return out;
  }

  get supportsLatest() { return true; }

  async getPopular(page) {
    const res = await this.req(\`/api/series/recent?page=\${page}\`);
    const list = Array.isArray(res) ? res : (res.results || []);
    return {
      list: list.map((item) => ({
        name: item.title || "Sin título",
        link: item.slug ? \`/api/series/\${item.slug}\` : "",
        imageUrl: item.coverImageUrl || "",
        description: "Cap. " + (item.lastChapter || "Nuevo")
      })),
      hasNextPage: list.length > 0
    };
  }

  async getLatestUpdates(page) { return await this.getPopular(page); }

  async search(query, page, filters) {
    const res = await this.req(\`/api/search?q=\${encodeURIComponent(query)}&page=\${page}\`);
    const results = res.results || [];
    return {
      list: results.map((item) => ({
        name: item.title || "Sin título",
        link: item.slug ? \`/api/series/\${item.slug}\` : "",
        imageUrl: item.coverImageUrl || "",
        description: "Cap. " + (item.lastChapter || "?")
      })),
      hasNextPage: results.length > 0
    };
  }

  async getDetail(url) {
    const res = await this.req(url);
    if (!res || !res.title) return { name: "Error", imageUrl: "", description: "", genre: [], chapters: [] };
    const chapters = [];
    if (res.chapters) {
        res.chapters.forEach(ch => {
            chapters.push({
                name: "Capítulo " + (ch.chapterNumber ?? "?") + (ch.title ? ": " + ch.title : ""),
                url: res.slug ? \`/api/series/\${res.slug}/chapters/\${ch.chapterNumber}\` : ""
            });
        });
    }
    let status = 0;
    if (res.status) {
        const s = res.status.toLowerCase();
        if (s.includes('complet')) status = 1;
        else if (s.includes('hiatus')) status = 2;
    }
    return {
      name: res.title,
      imageUrl: res.coverImageUrl,
      description: res.description,
      author: res.author,
      artist: res.artist,
      status: status,
      genre: res.genres ? res.genres.split(',').map(g => g.trim()) : [],
      chapters: chapters.reverse()
    };
  }

  async getPageList(url) {
    let res = await this.req(url);
    if (!res || !res.pages) return [];
    return res.pages.map(p => {
        let u = p.imageUrl || p.url;
        return u.startsWith('http') ? u : this.baseUrl + (u.startsWith('/') ? '' : '/') + u;
    });
  }

  getFilterList() { return []; }
  getSourcePreferences() { return []; }
}
  `;

  return new Response(content, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
