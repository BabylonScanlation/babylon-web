// ==MiruExtension==
// @name         Babylon
// @version      v0.0.2
// @author       Linxurs
// @lang         es
// @license      MIT
// @icon         https://babylon-scanlation.com/favicon.svg
// @package      com.babylon.scanlation
// @type         manga
// @webSite      https://babylon-scanlation.pages.dev
// @description  Babylon Scanlation Extension with Nuclear V3 Security Bypass
// ==/MiruExtension==

export default class extends Extension {
  // Config
  baseUrl = "https://babylon-scanlation.pages.dev";
  authSecret = "lsnoKZ7P1g8Uxjr2qG3TvOFeU5joWsG2mFLdV9DiSyOkTkXzGo";
  nuclearSalt = "B4byl0n_V2_Nucl3ar_S3cur1ty_"; // From obfuscator.ts

  async req(path) {
    const res = await this.request(path, {
      headers: {
        "User-Agent": "MiruApp/1.0",
        "Cookie": "site_verified=true"
      }
    });
    
    // Check if the response is obfuscated (Base64 string)
    if (typeof res === 'string' && !res.startsWith('{') && !res.startsWith('[')) {
        return this.deobfuscate(res);
    }
    
    return JSON.parse(res);
  }

  deobfuscate(encryptedStr) {
    try {
      // Miru environment usually has atob
      const decoded = decodeURIComponent(escape(atob(encryptedStr)));
      if (!decoded.startsWith(this.nuclearSalt)) {
        return null;
      }
      const jsonStr = decoded.slice(this.nuclearSalt.length);
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Deobfuscate error:', e);
      return null;
    }
  }

  async signUrl(path) {
    const ttlMs = 1000 * 60 * 60 * 2;
    const expires = Date.now() + ttlMs;
    
    let pathToSign = path.split('?')[0]; 
    if (pathToSign.startsWith('http')) {
       try {
         const url = new URL(path);
         pathToSign = url.pathname;
       } catch(e) {}
    }

    const dataToSign = `${pathToSign}:${expires}`;
    
    const signature = CryptoJS.HmacSHA256(dataToSign, this.authSecret)
      .toString(CryptoJS.enc.Base64)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}expires=${expires}&signature=${signature}`;
  }

  async latest(page) {
    const res = await this.req(`/api/series/recent?page=${page}`);
    return res.map(item => ({
      title: item.title,
      url: `/api/series/${item.slug}`,
      cover: item.cover,
      update: item.lastChapter
    }));
  }

  async search(kw, page) {
    const res = await this.req(`/api/search?q=${encodeURIComponent(kw)}&page=${page}`);
    return res.map(item => ({
      title: item.title,
      url: `/api/series/${item.slug}`,
      cover: item.cover,
      update: "Chapter " + (item.lastChapter || "?")
    }));
  }

  async detail(url) {
    const res = await this.req(url);
    return {
      title: res.title,
      cover: res.cover,
      desc: res.description,
      episodes: [
        {
          title: "Chapters",
          urls: res.chapters.map(ch => ({
            name: `Chapter ${ch.number} - ${ch.title || ''}`,
            url: `/api/chapters/${ch.id}` // Adjusted to likely endpoint
          }))
        }
      ]
    };
  }

  async watch(url) {
    const res = await this.req(url);
    
    // Support both modern (pages) and legacy (imageUrls) formats found in crypto.ts
    const rawPages = res.pages || res.imageUrls || [];
    
    const urls = await Promise.all(rawPages.map(async (page) => {
        let imgUrl = typeof page === 'string' ? page : (page.imageUrl || page.url);
        
        if (!imgUrl.startsWith('http')) {
             if (!imgUrl.startsWith('/')) imgUrl = '/' + imgUrl;
             if (!imgUrl.includes('api/r2-cache') && !imgUrl.includes('api/assets')) {
                 imgUrl = `/api/r2-cache${imgUrl}`;
             }
        }
        return await this.signUrl(imgUrl);
    }));
    
    return {
      urls: urls
    };
  }
}