// ==MiruExtension==
// @name         Manhuagui
// @version      1.0.0
// @author       Linxurs
// @lang         zh
// @type         manga
// @webSite      https://www.manhuagui.com
// @description  Manhuagui Extension - LZString & Packer decryption
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://www.manhuagui.com";

  getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/",
    };
  }

  async getPopular(page) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/list/view_p${page}.html`, this.getHeaders());
    const body = res.body;

    const list = [];
    const regex = /<a[^>]+class="bcover"[^>]+href="([^"]+)"[^>]+title="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/g;
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
      hasNextPage: list.length >= 40
    };
  }

  async getLatestUpdates(page) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/list/update_p${page}.html`, this.getHeaders());
    const body = res.body;

    const list = [];
    const regex = /<a[^>]+class="bcover"[^>]+href="([^"]+)"[^>]+title="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/g;
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
      hasNextPage: list.length >= 40
    };
  }

  async search(query, page, filters) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/s/${encodeURIComponent(query)}_p${page}.html`, this.getHeaders());
    const body = res.body;

    const list = [];
    const regex = /<div class="book-cover">[\s\S]*?<a[^>]+href="([^"]+)"[^>]+title="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/g;
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
      hasNextPage: list.length >= 20
    };
  }

  async getDetail(url) {
    const client = new Client();
    const res = await client.get(this.baseUrl + url, this.getHeaders());
    const body = res.body;

    const chapters = [];
    const chapRegex = /<a[^>]+href="([^"]+)"[^>]+title="([^"]+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g;
    
    const chapBlock = body.match(/<div class="chapter-list">([\s\S]+?)<\/div>/g);
    if (chapBlock) {
        chapBlock.forEach(block => {
            let m;
            while ((m = chapRegex.exec(block)) !== null) {
                chapters.push({
                    name: m[3].trim(),
                    url: m[1]
                });
            }
        });
    }

    return {
      name: body.match(/<div class="book-title">[\s\S]*?<h1>([^<]+)<\/h1>/)?.[1]?.trim() || "",
      imageUrl: body.match(/<p class="hcover">[\s\S]*?src="([^"]+)"/)?.[1] || "",
      description: body.match(/<div id="intro-all">([\s\S]+?)<\/div>/)?.[1]?.replace(/<[^>]+>/g, '').trim() || "",
      author: body.match(/<span>漫画作者：<\/span>[\s\S]*?<a[^>]*>([^<]+)<\/a>/)?.[1] || "Unknown",
      chapters: chapters.reverse()
    };
  }

  async getPageList(url) {
    const client = new Client();
    const res = await client.get(this.baseUrl + url, this.getHeaders());
    const body = res.body;

    // Manhuagui usa un script empaquetado (Packer)
    const packedMatch = body.match(/window\["\x65\x76\x61\x6c"\]\(([\s\S]+?)\)\s*<\/script>/);
    if (!packedMatch) return [];

    try {
        // En Mangayomi JS podemos intentar usar eval si el entorno lo permite,
        // pero es más seguro extraer el JSON de la configuración.
        // El script contiene una llamada a una función con un objeto JSON.
        const jsonMatch = body.match(/SMH\.reader\(([\s\S]+?)\)\.preInit\(\)/);
        if (jsonMatch) {
            const config = JSON.parse(jsonMatch[1]);
            const server = "https://i.hamreus.com";
            return config.files.map(f => `${server}${config.path}${f}?e=${config.sl.e}&m=${config.sl.m}`);
        }
    } catch(e) {}

    return [];
  }
}
