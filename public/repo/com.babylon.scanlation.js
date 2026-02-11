// ==MiruExtension==
// @name         Babylon Scanlation
// @version      0.1.4
// @author       Linxurs
// @lang         es
// @license      MIT
// @icon         https://wsrv.nl/?url=https://babylon-scanlation.pages.dev/favicon.svg&output=png
// @package      com.babylon.scanlation
// @type         manga
// @webSite      https://babylon-scanlation.pages.dev
// @description  Official Babylon Scanlation Extension
// ==/MiruExtension==

/**
 * Minimal HMAC-SHA256 implementation for signing URLs
 */
const Hashes = (function() {
    function utf8Encode(str) { return unescape(encodeURIComponent(str)); }
    function hex(s) { var s2 = ""; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); s2 += ((c >> 4) & 0xf).toString(16) + (c & 0xf).toString(16); } return s2; }
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
        const body = res.body;
        if (typeof body === 'string') {
            const trimmed = body.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed);
            return this.deobfuscate(trimmed);
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
      if (!decoded.startsWith(this.nuclearSalt)) return null;
      return JSON.parse(decoded.slice(this.nuclearSalt.length));
    } catch (e) { return null; }
  }

  base64Decode(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    str = str.replace(/[^A-Za-z0-9+/=]/g, '');
    for (let i = 0; i < str.length; i += 4) {
      const enc1 = chars.indexOf(str[i]);
      const enc2 = chars.indexOf(str[i + 1]);
      const enc3 = chars.indexOf(str[i + 2]);
      const enc4 = chars.indexOf(str[i + 3]);
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      output += String.fromCharCode(chr1);
      if (enc3 !== 64) output += String.fromCharCode(chr2);
      if (enc4 !== 64) output += String.fromCharCode(chr3);
    }
    return decodeURIComponent(escape(output));
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
            episodes: []
        };
    }
    const chapters = (res.chapters || []).map(chapter => ({
      name: "Capítulo " + (chapter.number || "?") + (chapter.title ? ": " + chapter.title : ""),
      link: res.slug ? `/api/series/${res.slug}/chapters/${chapter.number}` : ""
    }));
    return {
      name: res.title,
      imageUrl: (await this.signUrl(res.coverImageUrl)) || "",
      description: res.description || "",
      episodes: chapters.reverse()
    };
  }

  async getPageList(url) {
    if (!url) return [];
    const res = await this.req(url);
    const pages = res.pages || [];
    return await Promise.all(pages.map(async (page) => (await this.signUrl(page.url)) || ""));
  }

  getFilterList() { return []; }
  getSourcePreferences() { return []; }
}
