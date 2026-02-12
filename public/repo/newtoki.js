// ==MiruExtension==
// @name         NewToki
// @version      1.0.0
// @author       Linxurs
// @lang         ko
// @type         manga
// @webSite      https://newtoki465.com
// @description  NewToki Extension - Direct image scraping without ApkBridge
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://newtoki465.com"; // Este dominio cambia frecuentemente

  getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/",
    };
  }

  async getPopular(page) {
    const client = new Client();
    const url = `${this.baseUrl}/webtoon${page > 1 ? '/p' + page : ''}`;
    const res = await client.get(url, this.getHeaders());
    const body = res.body;

    const list = [];
    const regex = /<li class="list-item">[\s\S]+?<a href="([^"]+)">[\s\S]+?<img src="([^"]+)"[\s\S]+?<span class="title">([^<]+)<\/span>/g;
    let match;
    while ((match = regex.exec(body)) !== null) {
        list.push({
            name: match[3].trim(),
            imageUrl: match[2],
            link: match[1]
        });
    }

    return {
      list: list,
      hasNextPage: list.length > 0
    };
  }

  async getLatestUpdates(page) {
    const client = new Client();
    const url = `${this.baseUrl}/page/update?hid=update&page=${page}`;
    const res = await client.get(url, this.getHeaders());
    const body = res.body;

    const list = [];
    const regex = /<div class="media post-list">[\s\S]+?<a href="([^"]+)">[\s\S]+?<img src="([^"]+)"[\s\S]+?<div class="media-heading"><b>([^<]+)<\/b>/g;
    let match;
    while ((match = regex.exec(body)) !== null) {
        list.push({
            name: match[3].trim(),
            imageUrl: match[2],
            link: match[1]
        });
    }

    return {
      list: list,
      hasNextPage: list.length > 0
    };
  }

  async search(query, page, filters) {
    const client = new Client();
    // NewToki search uses a specific format, for now let's use the simplest search
    const url = `${this.baseUrl}/webtoon?stx=${encodeURIComponent(query)}&page=${page}`;
    const res = await client.get(url, this.getHeaders());
    const body = res.body;

    const list = [];
    const regex = /<li class="list-item">[\s\S]+?<a href="([^"]+)">[\s\S]+?<img src="([^"]+)"[\s\S]+?<span class="title">([^<]+)<\/span>/g;
    let match;
    while ((match = regex.exec(body)) !== null) {
        list.push({
            name: match[3].trim(),
            imageUrl: match[2],
            link: match[1]
        });
    }

    return {
      list: list,
      hasNextPage: list.length > 0
    };
  }

  async getDetail(url) {
    const client = new Client();
    const res = await client.get(url, this.getHeaders());
    const body = res.body;

    const chapters = [];
    const chapterRegex = /<a class="item-subject" href="([^"]+)">[\s\S]+?<\/a>[\s\S]+?<div class="wr-date">([^<]+)<\/div>/g;
    let match;
    while ((match = chapterRegex.exec(body)) !== null) {
        chapters.push({
            name: match[0].match(/>([^<]+)</)?.[1]?.trim() || "Capítulo",
            url: match[1],
            date: match[2]
        });
    }

    return {
      name: body.match(/<div class="view-content">[\s\S]*?<b>([^<]+)<\/b>/)?.[1] || "",
      imageUrl: body.match(/<div class="view-img">[\s\S]*?src="([^"]+)"/)?.[1] || "",
      description: "NewToki Manhwa",
      author: "Unknown",
      chapters: chapters
    };
  }

  async getPageList(url) {
    const client = new Client();
    const res = await client.get(url, this.getHeaders());
    const body = res.body;

    // Lógica de descifrado de html_data (Basado en Kotlin)
    const htmlDataMatch = body.match(/html_data\+='([^']+)'/g);
    if (!htmlDataMatch) return [];

    let hexStr = "";
    htmlDataMatch.forEach(m => {
        hexStr += m.match(/'([^']+)'/)[1];
    });

    // Reconstruir el HTML desde hexadecimal
    let decodedHtml = "";
    const hexParts = hexStr.split(".");
    hexParts.forEach(part => {
        if (part) {
            decodedHtml += String.fromCharCode(parseInt(part, 16));
        }
    });

    // Extraer URLs de las imágenes
    // NewToki usa atributos data-dinámicos, buscamos data-src o similares
    const imgRegex = /img[^>]+src="([^"]+)"/g;
    const pages = [];
    let imgMatch;
    
    // A veces el src es el loading gif y la imagen real está en data-src, data-proxy, etc.
    const dataAttrMatch = body.match(/data_attribute:\s*'([^']+)'/);
    const dataAttr = dataAttrMatch ? dataAttrMatch[1] : null;

    if (dataAttr) {
        const dataRegex = new RegExp(`data-${dataAttr}="([^"]+)"`, 'g');
        let dMatch;
        while ((dMatch = dataRegex.exec(decodedHtml)) !== null) {
            pages.push(dMatch[1]);
        }
    }

    // Fallback si no encontramos el dataAttr
    if (pages.length === 0) {
        while ((imgMatch = imgRegex.exec(decodedHtml)) !== null) {
            if (!imgMatch[1].includes("loading-image.gif")) {
                pages.push(imgMatch[1]);
            }
        }
    }

    return pages;
  }
}
