// ==MiruExtension==
// @name         Dumanwu
// @version      1.8.0
// @author       Babylon
// @lang         zh
// @type         manga
// @webSite      https://dumanwu.com
// @description  Extension para Dumanwu - Fix total de capitulos e imágenes usando API firmada.
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://dumanwu.com";

  getHeaders(referer) {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": referer || this.baseUrl + "/",
      "X-Requested-With": "XMLHttpRequest"
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
    
    // Extracción de parámetros de firma (El "Secreto" de Dumanwu)
    const idMatch = url.match(/\/([^\/]+)\/([^\/]+)\.html/);
    const timeMatch = body.match(/class="signkey"[\s\S]+?value="([^"]+)"/);
    const signMatch = body.match(/data-sign="([^"]+)"/);
    
    if (idMatch && timeMatch && signMatch) {
        const id = idMatch[1];
        const vid = idMatch[2];
        const time = timeMatch[1];
        const sign = signMatch[1];
        const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

        // Consultar el servidor de imágenes dinámico con la firma extraída
        const imgRes = await client.post("http://readshow.uslook.top/read_s", {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": ua,
            "Referer": pageUrl
        }, `id=${id}&vid=${vid}&signkey=${sign}&time=${time}&iua=${encodeURIComponent(ua)}&ref=`);
        
        try {
            const imgData = JSON.parse(imgRes.body);
            if (imgData && imgData.data) {
                return imgData.data.map(i => i.imgurl || i);
            }
        } catch(e) {}
    }
    
    // Fallback: Si la API falla, buscamos cualquier imagen que parezca del manga en el HTML
    const imgs = [];
    const imgRegex = /data-src="([^"]+)"/g;
    let m;
    while ((m = imgRegex.exec(body)) !== null) {
        if (m[1] && !m[1].includes("load.gif")) {
            imgs.push(m[1]);
        }
    }
    return imgs;
  }
}
