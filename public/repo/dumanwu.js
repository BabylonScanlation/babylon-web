// ==MiruExtension==
// @name         Dumanwu
// @version      1.9.0
// @author       Lucas Goldstein
// @lang         zh
// @type         manga
// @webSite      https://dumanwu.com
// @description  Extension para Dumanwu - Desencriptación híbrida (API + XOR Local) para evitar imágenes falsas.
// ==/MangayomiExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://dumanwu.com";

  getHeaders(referer) {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": referer || this.baseUrl + "/",
      "X-Requested-With": "XMLHttpRequest",
      "Accept": "application/json, text/javascript, */*; q=0.01"
    };
  }

  async getPopular(page) {
    const client = new Client();
    const res = await client.post(this.baseUrl + "/data/sort", this.getHeaders(), `s=1&p=${page}`);
    const data = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    return {
      list: (data.data || []).map(i => ({ name: i.bookName || i.name, imageUrl: i.imgurl, link: `/${i.id}/` })),
      hasNextPage: (data.data || []).length > 0
    };
  }

  async getLatestUpdates(page) {
    const client = new Client();
    const res = await client.post(this.baseUrl + "/data/sort", this.getHeaders(), `s=15&p=${page}`);
    const data = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    return {
      list: (data.data || []).map(i => ({ name: i.bookName || i.name, imageUrl: i.imgurl, link: `/${i.id}/` })),
      hasNextPage: (data.data || []).length > 0
    };
  }

  async search(query, page, filters) {
    const client = new Client();
    const res = await client.post(this.baseUrl + "/s", this.getHeaders(), `k=${encodeURIComponent(query)}`);
    const data = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    return {
      list: (data.data || []).map(i => ({ name: i.name, imageUrl: i.imgurl, link: `/${i.id}/` })),
      hasNextPage: false
    };
  }

  async getDetail(url) {
    const client = new Client();
    const res = await client.get(this.baseUrl + url, this.getHeaders());
    const body = res.body;
    const id = url.replace(/\//g, '');

    let chapters = [];
    try {
        const moreRes = await client.post(this.baseUrl + "/morechapter", {
            "Content-Type": "application/x-www-form-urlencoded",
            ...this.getHeaders(this.baseUrl + url)
        }, `id=${id}`);
        const moreData = JSON.parse(moreRes.body);
        if (moreData.code === "200" && moreData.data) {
            chapters = moreData.data.map(ch => ({
                name: ch.chaptername,
                url: `/${id}/${ch.chapterid}.html`
            }));
        }
    } catch(e) {}

    if (chapters.length === 0) {
        const chapterRegex = /<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g;
        let match;
        const chapBox = body.match(/<div class="chaplist-box">([\s\S]+?)<\/div>/)?.[1] || body;
        while ((match = chapterRegex.exec(chapBox)) !== null) {
            if (!match[1].includes("javascript")) {
                chapters.push({ name: match[2].replace(/<[^>]+>/g, '').trim(), url: match[1] });
            }
        }
        chapters.reverse();
    }

    return {
      name: body.match(/<h1 class="book-title">([^<]+)<\/h1>/)?.[1] || "",
      imageUrl: body.match(/<div class="book-cover">[\s\S]*?src="([^"]+)"/)?.[1] || "",
      description: body.match(/<div class="book-intro">([^<]+)<\/div>/)?.[1] || "",
      author: body.match(/<p class="book-author">([^<]+)<\/p>/)?.[1] || "",
      chapters: chapters
    };
  }

  async getPageList(url) {
    const client = new Client();
    const pageUrl = this.baseUrl + url;
    const res = await client.get(pageUrl, this.getHeaders());
    const body = res.body;

    const idMatch = url.match(/\/([^\/]+)\/([^\/]+)\.html/);
    const timeMatch = body.match(/class="signkey"[\s\S]+?value="([^"]+)"/);
    const signMatch = body.match(/data-sign="([^"]+)"/);
    const idReaderMatch = body.match(/class="readerContainer" data-id="(\d+)"/);

    // Intento 1: API Firmada (Servidor de imágenes)
    if (idMatch && timeMatch && signMatch) {
        const id = idMatch[1];
        const vid = idMatch[2];
        const time = timeMatch[1];
        const sign = signMatch[1];
        const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

        const imgRes = await client.post("http://readshow.uslook.top/read_s", {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": ua,
            "Referer": pageUrl
        }, `id=${id}&vid=${vid}&signkey=${sign}&time=${time}&iua=${encodeURIComponent(ua)}&ref=`);

        try {
            const imgData = JSON.parse(imgRes.body);
            if (imgData && imgData.data && imgData.data.length > 0) {
                const list = imgData.data.map(i => i.imgurl || i);
                // Si la API devuelve imágenes que parecen reales (más de 5), las aceptamos
                if (list.length > 5) return list;
            }
        } catch(e) {}
    }

    // Intento 2: Desencriptación XOR Local (Si la API nos da basura o falla)
    if (idReaderMatch) {
        const readerId = parseInt(idReaderMatch[1]);
        const packedMatch = body.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]+?\}\((.*)\)\)/);
        if (packedMatch) {
            try {
                const unpacked = unpackJs(packedMatch[0]);
                // Buscamos cualquier cadena Base64 larga en el script desempaquetado
                const b64Match = unpacked.match(/"([A-Za-z0-9+/=]{100,})"/);
                if (b64Match) {
                    return this.decryptLocal(b64Match[1], readerId);
                }
            } catch(e) {}
        }
    }

    return [];
  }

  decryptLocal(data, index) {
    const keys = ["smkhy258", "smkd95fv", "md496952", "cdcsdwq", "vbfsa256", "cawf151c", "cd56cvda", "8kihnt9", "dso15tlo", "5ko6plhy"];
    const key = keys[index] || keys[0];

    // XOR logic
    const keyBytes = [];
    for(let i=0; i<key.length; i++) keyBytes.push(key.charCodeAt(i));

    const binaryData = this.atob(data);
    const decryptedBytes = [];
    for(let i=0; i<binaryData.length; i++) {
        decryptedBytes.push(binaryData.charCodeAt(i) ^ keyBytes[i % keyBytes.length]);
    }

    try {
        const decryptedStr = String.fromCharCode(...decryptedBytes);
        // El resultado es otra cadena Base64 que contiene el JSON
        const finalJson = this.atob(decryptedStr);
        return JSON.parse(finalJson);
    } catch(e) {
        return [];
    }
  }

  atob(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let out = '';
    str = str.replace(/[^A-Za-z0-9+/=]/g, '');
    for (let i = 0; i < str.length; i += 4) {
      const enc1 = chars.indexOf(str[i]);
      const enc2 = chars.indexOf(str[i + 1]);
      const enc3 = chars.indexOf(str[i + 2]);
      const enc4 = chars.indexOf(str[i + 3]);
      out += String.fromCharCode((enc1 << 2) | (enc2 >> 4));
      if (enc3 !== 64) out += String.fromCharCode(((enc2 & 15) << 4) | (enc3 >> 2));
      if (enc4 !== 64) out += String.fromCharCode(((enc3 & 3) << 6) | enc4);
    }
    return out;
  }
}
