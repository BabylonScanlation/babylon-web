
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
    const client = new Client();
    const res = await client.get(this.baseUrl + path, this.getHeaders());
    const body = res.body;
    if (typeof body === 'string') {
        const trimmed = body.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed);
        return this.deobfuscate(trimmed);
    }
    return body;
  }

  deobfuscate(encryptedStr) {
    try {
      if (!encryptedStr || encryptedStr.length < 10) return null;
      // Simple base64 decode and JSON parse for deobfuscation
      const decoded = this.base64Decode(encryptedStr);
      if (!decoded.startsWith(this.nuclearSalt)) return null;
      return JSON.parse(decoded.slice(this.nuclearSalt.length));
    } catch (e) { return null; }
  }

  base64Decode(str) {
    // QuickJS doesn't have atob, so we use a simple implementation
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
    
    // Note: HMAC-SHA256 is missing here. 
    // If the server requires it, this might fail unless we add a JS implementation.
    // For now, we'll try without it or just return the path.
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
    
    // Simplified: we skip the signature for now as Mangayomi doesn't provide HMAC easily
    const separator = pathToSign.includes('?') ? '&' : '?';
    return `${this.baseUrl}${pathToSign}${separator}expires=${expires}`;
  }

  get supportsLatest() {
    return true;
  }

  async getPopular(page) {
    const res = await this.req(`/api/series/recent?page=${page}`);
    const list = Array.isArray(res) ? res : (res.results || []);
    return {
      list: await Promise.all(list.map(async (item) => ({
        name: item.title,
        link: `/api/series/${item.slug}`,
        imageUrl: (await this.signUrl(item.coverImageUrl)) || "",
        description: "Cap. " + (item.lastChapter || "Nuevo")
      }))),
      hasNextPage: list.length > 0
    };
  }

  async getLatestUpdates(page) {
    return await this.getPopular(page);
  }

  async search(query, page, filters) {
    const res = await this.req(`/api/search?q=${encodeURIComponent(query)}&page=${page}`);
    const results = res.results || [];
    return {
      list: await Promise.all(results.map(async (item) => ({
        name: item.title,
        link: `/api/series/${item.slug}`,
        imageUrl: (await this.signUrl(item.coverImageUrl)) || "",
        description: "Cap. " + (item.lastChapter || "?")
      }))),
      hasNextPage: results.length > 0
    };
  }

  async getDetail(url) {
    const res = await this.req(url);
    const chapters = (res.chapters || []).map(chapter => ({
      name: "Capítulo " + chapter.number + (chapter.title ? ": " + chapter.title : ""),
      link: `/api/series/${res.slug}/chapters/${chapter.number}`
    }));
    
    return {
      name: res.title,
      imageUrl: (await this.signUrl(res.coverImageUrl)) || "",
      description: res.description,
      episodes: chapters.reverse()
    };
  }

  async getPageList(url) {
    const res = await this.req(url);
    const pages = res.pages || [];
    return await Promise.all(pages.map(async (page) => await this.signUrl(page.url)));
  }

  getFilterList() {
    return [];
  }

  getSourcePreferences() {
    return [];
  }
}
