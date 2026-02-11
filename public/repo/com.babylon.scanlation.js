// ==MiruExtension==
// @name         Babylon Scanlation
// @version      0.2.0
// @author       Linxurs
// @lang         es
// @license      MIT
// @icon         https://wsrv.nl/?url=https://babylon-scanlation.pages.dev/favicon.svg&output=png
// @package      com.babylon.scanlation
// @type         manga
// @webSite      https://babylon-scanlation.pages.dev
// @description  Official Babylon Scanlation Extension
// ==/MiruExtension==

const Hashes = (function() {
    function b64(s) { return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); }
    return {
        hmacSha256B64: function(data, key) {
            return b64(data + key).substring(0, 43);
        }
    };
})();

class DefaultExtension extends MProvider {
  baseUrl = "https://babylon-scanlation.pages.dev";
  authSecret = "lsnoKZ7P1g8Uxjr2qG3TvOFeU5joWsG2mFLdV9DiSyOkTkXzGo";
  nuclearSalt = "B4byl0n_V2_Nucl3ar_S3cur1ty_";

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
    try {
        return decodeURIComponent(bytes.map(c => '%' + ('00' + c.toString(16)).slice(-2)).join(''));
    } catch (e) {
        // Fallback to simple string if UTF-8 decode fails
        return String.fromCharCode.apply(null, bytes);
    }
  }

  async signUrl(path) {
    if (!path) return "";
    if (path.startsWith('http') && !path.includes('api/r2-cache')) return path;
    const ttlMs = 1000 * 60 * 60 * 2;
    const expires = Date.now() + ttlMs;
    let pathToSign = path;
    if (path.startsWith('http')) {
       try { pathToSign = new URL(path).pathname; } catch(e) {}
    }
    if (!pathToSign.startsWith('/')) pathToSign = '/' + pathToSign;
    if (!pathToSign.startsWith('/api/r2-cache') && !pathToSign.startsWith('/api/assets')) {
        pathToSign = '/api/r2-cache' + pathToSign;
    }
    const dataToSign = `${pathToSign}:${expires}`;
    const signature = Hashes.hmacSha256B64(dataToSign, this.authSecret);
    const separator = pathToSign.includes('?') ? '&' : '?';
    return `${this.baseUrl}${pathToSign}${separator}expires=${expires}&signature=${signature}`;
  }

  get supportsLatest() { return true; }

  async getPopular(page) {
    const res = await this.req(`/api/series/recent?page=${page}`);
    const list = Array.isArray(res) ? res : (res.results || []);
    return {
      list: await Promise.all(list.map(async (item) => ({
        name: item.title || "Sin título",
        link: item.slug ? `/api/series/${item.slug}` : "",
        imageUrl: (await this.signUrl(item.coverImageUrl)) || "",
        description: "Cap. " + (item.lastChapter || "Nuevo")
      }))),
      hasNextPage: list.length > 0
    };
  }

  async getLatestUpdates(page) { return await this.getPopular(page); }

  async search(query, page, filters) {
    const res = await this.req(`/api/search?q=${encodeURIComponent(query)}&page=${page}`);
    const results = res.results || [];
    return {
      list: await Promise.all(results.map(async (item) => ({
        name: item.title || "Sin título",
        link: item.slug ? `/api/series/${item.slug}` : "",
        imageUrl: (await this.signUrl(item.coverImageUrl)) || "",
        description: "Cap. " + (item.lastChapter || "?")
      }))),
      hasNextPage: results.length > 0
    };
  }

  async getDetail(url) {
    const res = await this.req(url);
    if (!res || !res.title) {
        return {
            name: "Error al cargar",
            imageUrl: "",
            description: "No se pudo obtener el detalle de la serie.",
            genre: [],
            chapters: []
        };
    }

    const chapters = [];
    if (res.chapters && Array.isArray(res.chapters)) {
        res.chapters.forEach(chapter => {
            if (chapter) {
                chapters.push({
                    name: "Capítulo " + (chapter.chapterNumber !== undefined ? chapter.chapterNumber : "?") + (chapter.title ? ": " + chapter.title : ""),
                    url: res.slug ? `/api/series/${res.slug}/chapters/${chapter.chapterNumber}` : ""
                });
            }
        });
    }

    let status = 0;
    if (res.status) {
        const s = res.status.toLowerCase();
        if (s.includes('complet')) status = 1;
        else if (s.includes('hiatus') || s.includes('pausa')) status = 2;
        else if (s.includes('cancel')) status = 3;
    }

    let genre = [];
    if (res.genres) {
        if (Array.isArray(res.genres)) genre = res.genres;
        else if (typeof res.genres === 'string') genre = res.genres.split(',').map(g => g.trim());
    }

    return {
      name: res.title || "Sin título",
      imageUrl: (await this.signUrl(res.coverImageUrl)) || "",
      description: res.description || "Sin descripción",
      author: res.author || "Desconocido",
      artist: res.artist || "Desconocido",
      status: status,
      genre: genre,
      chapters: chapters.reverse()
    };
  }

  async getPageList(url) {
    if (!url) return [];
    let res = null;
    let attempts = 0;
    
    // Polling logic for chapters being processed
    while (attempts < 10) {
        res = await this.req(url);
        if (res && res.pages && res.pages.length > 0) break;
        if (res && res.status !== 'processing') break;
        
        attempts++;
        // Wait 5 seconds before next poll
        const client = new Client();
        await new Promise(r => setTimeout(r, 5000));
    }
    
    if (!res || !res.pages) return [];
    
    return await Promise.all(res.pages.map(async (page) => {
        const imageUrl = page.imageUrl || page.url;
        return (await this.signUrl(imageUrl)) || "";
    }));
  }

  getFilterList() { return []; }
  getSourcePreferences() { return []; }
}
