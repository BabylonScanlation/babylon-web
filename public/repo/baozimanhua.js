// ==MiruExtension==
// @name         BaoziManhua
// @version      1.0.0
// @author       Linxurs
// @lang         zh
// @type         manga
// @webSite      https://cn.baozimh.com
// @description  BaoziManhua Extension - Multi-mirror support with AMP image extraction
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://cn.baozimh.com";

  getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/",
    };
  }

  async getPopular(page) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/classify?page=${page}`, this.getHeaders());
    const body = res.body;

    const list = [];
    const regex = /<a[^>]+href="([^"]+)"[^>]+title="([^"]+)"[^>]*>[\s\S]*?<amp-img[^>]+src="([^"]+)"/g;
    let match;
    while ((match = regex.exec(body)) !== null) {
        list.push({
            name: match[2].trim(),
            imageUrl: match[3],
            link: match[1]
        });
    }

    return {
      list: list,
      hasNextPage: list.length >= 36
    };
  }

  async getLatestUpdates(page) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/list/new?page=${page}`, this.getHeaders());
    const body = res.body;

    const list = [];
    const regex = /<a[^>]+href="([^"]+)"[^>]+title="([^"]+)"[^>]*>[\s\S]*?<amp-img[^>]+src="([^"]+)"/g;
    let match;
    while ((match = regex.exec(body)) !== null) {
        list.push({
            name: match[2].trim(),
            imageUrl: match[3],
            link: match[1]
        });
    }

    return {
      list: list,
      hasNextPage: list.length >= 36
    };
  }

  async search(query, page, filters) {
    const client = new Client();
    // La búsqueda en Baozi a veces requiere redirección al dominio principal
    const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
    const res = await client.get(searchUrl, this.getHeaders());
    const body = res.body;

    const list = [];
    const regex = /<a[^>]+href="([^"]+)"[^>]+title="([^"]+)"[^>]*>[\s\S]*?<amp-img[^>]+src="([^"]+)"/g;
    let match;
    while ((match = regex.exec(body)) !== null) {
        list.push({
            name: match[2].trim(),
            imageUrl: match[3],
            link: match[1]
        });
    }

    return {
      list: list,
      hasNextPage: false
    };
  }

  async getDetail(url) {
    const client = new Client();
    const res = await client.get(this.baseUrl + url, this.getHeaders());
    const body = res.body;

    const chapters = [];
    const chapRegex = /<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<div[^>]*>([\s\S]+?)<\/div>/g;
    
    // Baozi tiene secciones para capítulos. Buscamos el bloque de capítulos.
    const chapBlockMatch = body.match(/<div class="comics-chapters">([\s\S]+?)<\/div>\s*<\/div>/g);
    if (chapBlockMatch) {
        // En Baozi los capítulos suelen estar en orden cronológico, los invertimos para Mangayomi
        const allChapters = [];
        chapBlockMatch.forEach(block => {
            let m;
            while ((m = chapRegex.exec(block)) !== null) {
                allChapters.push({
                    name: m[2].replace(/<[^>]+>/g, '').trim(),
                    url: m[1]
                });
            }
        });
        chapters.push(...allChapters.reverse());
    }

    return {
      name: body.match(/<h1[^>]+class="comics-detail__title"[^>]*>([^<]+)<\/h1>/)?.[1]?.trim() || "",
      imageUrl: body.match(/<div class="pure-g">[\s\S]*?<amp-img[^>]+src="([^"]+)"/)?.[1] || "",
      description: body.match(/<p class="comics-detail__desc">([^<]+)<\/p>/)?.[1]?.trim() || "",
      author: body.match(/<h2 class="comics-detail__author">([^<]+)<\/h2>/)?.[1]?.trim() || "Unknown",
      chapters: chapters
    };
  }

  async getPageList(url) {
    const client = new Client();
    const pages = [];
    let currentUrl = this.baseUrl + url;
    
    // Bucle para manejar capítulos de múltiples páginas (Next Page)
    while (currentUrl) {
        const res = await client.get(currentUrl, this.getHeaders());
        const body = res.body;
        
        // Extraer imágenes AMP
        const imgRegex = /<amp-img[^>]+src="([^"]+)"/g;
        let match;
        while ((match = imgRegex.exec(body)) !== null) {
            let imgUrl = match[1];
            // Fix para CDN de Baozi
            imgUrl = imgUrl.replace(".baozicdn.com", ".baozimh.com");
            if (!pages.includes(imgUrl)) pages.push(imgUrl);
        }
        
        // Buscar botón de siguiente página dentro del capítulo
        const nextMatch = body.match(/<a[^>]+id="next-chapter"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/);
        if (nextMatch && (nextMatch[2].includes("下一页") || nextMatch[2].includes("下一頁"))) {
            currentUrl = this.baseUrl + nextMatch[1];
        } else {
            currentUrl = null;
        }
    }

    return pages;
  }
}
