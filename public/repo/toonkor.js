// ==MiruExtension==
// @name         ToonKor
// @version      1.0.0
// @author       Linxurs
// @lang         ko
// @type         manga
// @webSite      https://tkor.dog
// @description  ToonKor Extension - Base64 Image Decryption
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://tkor.dog";

  getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/",
    };
  }

  async getPopular(page) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/%EC%9B%B9%ED%88%B0`, this.getHeaders());
    const body = res.body;

    const list = [];
    const regex = /<div class="section-item-inner">[\s\S]*?<a href="([^"]+)"[^>]*>[\s\S]*?<img src="([^"]+)"[\s\S]*?<h3>([^<]+)<\/h3>/g;
    let match;
    while ((match = regex.exec(body)) !== null) {
        list.push({
            name: match[3].trim(),
            imageUrl: match[2].startsWith('http') ? match[2] : this.baseUrl + match[2],
            link: match[1]
        });
    }

    return {
      list: list,
      hasNextPage: false // ToonKor lista casi todo en una página o usa scroll infinito difícil de predecir sin API
    };
  }

  async getLatestUpdates(page) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/%EC%9B%B9%ED%88%B0?fil=%EC%B5%9C%EC%8B%A0`, this.getHeaders());
    const body = res.body;

    const list = [];
    const regex = /<div class="section-item-inner">[\s\S]*?<a href="([^"]+)"[^>]*>[\s\S]*?<img src="([^"]+)"[\s\S]*?<h3>([^<]+)<\/h3>/g;
    let match;
    while ((match = regex.exec(body)) !== null) {
        list.push({
            name: match[3].trim(),
            imageUrl: match[2].startsWith('http') ? match[2] : this.baseUrl + match[2],
            link: match[1]
        });
    }

    return {
      list: list,
      hasNextPage: false
    };
  }

  async search(query, page, filters) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/bbs/search.php?sfl=wr_subject%7C%7Cwr_content&stx=${encodeURIComponent(query)}`, this.getHeaders());
    const body = res.body;

    const list = [];
    const regex = /<div class="section-item-inner">[\s\S]*?<a href="([^"]+)"[^>]*>[\s\S]*?<img src="([^"]+)"[\s\S]*?<h3>([^<]+)<\/h3>/g;
    let match;
    while ((match = regex.exec(body)) !== null) {
        list.push({
            name: match[3].trim(),
            imageUrl: match[2].startsWith('http') ? match[2] : this.baseUrl + match[2],
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
    const chapRegex = /<td class="content__title" data-role="([^"]+)">([^<]+)<\/td>/g;
    let match;
    while ((match = chapRegex.exec(body)) !== null) {
        chapters.push({
            name: match[2].trim(),
            url: match[1]
        });
    }

    return {
      name: body.match(/<td class="bt_title">([^<]+)<\/td>/)?.[1]?.trim() || "",
      imageUrl: body.match(/<td class="bt_thumb">[\s\S]*?src="([^"]+)"/)?.[1] || "",
      description: body.match(/<td class="bt_over">([\s\S]+?)<\/td>/)?.[1]?.replace(/<[^>]+>/g, '').trim() || "",
      author: body.match(/<td class="bt_label">[\s\S]*?<span class="bt_data">([^<]+)<\/span>/)?.[1] || "Unknown",
      chapters: chapters
    };
  }

  async getPageList(url) {
    const client = new Client();
    const res = await client.get(this.baseUrl + url, this.getHeaders());
    const body = res.body;

    // Extraer la cadena Base64 del script toon_img
    const encodedMatch = body.match(/toon_img\s*=\s*'([^']+)'/);
    if (!encodedMatch) return [];

    const encoded = encodedMatch[1];
    
    // Decodificar Base64
    const decoded = this.base64Decode(encoded);
    
    // Extraer URLs de imágenes del HTML decodificado
    const pages = [];
    const imgRegex = /src="([^"]+)"/g;
    let match;
    while ((match = imgRegex.exec(decoded)) !== null) {
        let imgUrl = match[1];
        if (imgUrl && !imgUrl.startsWith('http')) {
            imgUrl = this.baseUrl + (imgUrl.startsWith('/') ? '' : '/') + imgUrl;
        }
        if (imgUrl && !imgUrl.includes("blank.gif")) {
            pages.push(imgUrl);
        }
    }

    return pages;
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
      output += String.fromCharCode((enc1 << 2) | (enc2 >> 4));
      if (enc3 !== 64) output += String.fromCharCode(((enc2 & 15) << 4) | (enc3 >> 2));
      if (enc4 !== 64) output += String.fromCharCode(((enc3 & 3) << 6) | enc4);
    }
    return output;
  }
}
