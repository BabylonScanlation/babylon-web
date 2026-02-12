// ==MiruExtension==
// @name         Dumanwu
// @version      1.5.1
// @author       Babylon
// @lang         zh
// @type         manga
// @webSite      https://dumanwu.com
// @description  Extension para Dumanwu con carga de capitulos completa y firmado de imagenes.
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://dumanwu.com";

  getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/"
    };
  }

  async getPopular(page) {
    const client = new Client();
    const res = await client.post(this.baseUrl + "/data/sort", {
      "Content-Type": "application/x-www-form-urlencoded",
      ...this.getHeaders()
    }, `s=1&p=${page}`);
    const data = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    return {
      list: (data.data || []).map(i => ({ name: i.bookName || i.name, imageUrl: i.imgurl, link: `/${i.id}/` })),
      hasNextPage: (data.data || []).length > 0
    };
  }

  async getLatestUpdates(page) {
    const client = new Client();
    const res = await client.post(this.baseUrl + "/data/sort", {
      "Content-Type": "application/x-www-form-urlencoded",
      ...this.getHeaders()
    }, `s=15&p=${page}`);
    const data = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    return {
      list: (data.data || []).map(i => ({ name: i.bookName || i.name, imageUrl: i.imgurl, link: `/${i.id}/` })),
      hasNextPage: (data.data || []).length > 0
    };
  }

  async search(query, page, filters) {
    const client = new Client();
    const res = await client.post(this.baseUrl + "/s", {
      "Content-Type": "application/x-www-form-urlencoded",
      ...this.getHeaders()
    }, `k=${encodeURIComponent(query)}`);
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
    
    // Obtener capítulos iniciales del HTML
    const chapterRegex = /<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g;
    let match;
    const chapBox = body.match(/<div class="chaplist-box">([\s\S]+?)<\/div>/)?.[1] || body;
    while ((match = chapterRegex.exec(chapBox)) !== null) {
        if (!match[1].includes("javascript")) {
            chapters.push({ name: match[2].replace(/<[^>]+>/g, '').trim(), url: match[1] });
        }
    }

    // Cargar el resto vía API y fusionar
    try {
        const moreRes = await client.post(this.baseUrl + "/morechapter", {
            "Content-Type": "application/x-www-form-urlencoded",
            ...this.getHeaders()
        }, `id=${id}`);
        const moreData = JSON.parse(moreRes.body);
        if (moreData.code === "200" && moreData.data) {
            moreData.data.forEach(ch => {
                const chUrl = `/${id}/${ch.chapterid}.html`;
                if (!chapters.find(c => c.url === chUrl)) {
                    chapters.push({ name: ch.chaptername, url: chUrl });
                }
            });
        }
    } catch(e) {}

    return {
      name: body.match(/<h1 class="book-title">([^<]+)<\/h1>/)?.[1] || "",
      imageUrl: body.match(/<div class="book-cover">[\s\S]*?src="([^"]+)"/)?.[1] || "",
      description: body.match(/<div class="book-intro">([^<]+)<\/div>/)?.[1] || "",
      author: body.match(/<p class="book-author">([^<]+)<\/p>/)?.[1] || "",
      chapters: chapters.sort((a, b) => b.url.localeCompare(a.url))
    };
  }

  async getPageList(url) {
    const client = new Client();
    const res = await client.get(this.baseUrl + url, this.getHeaders());
    const body = res.body;
    
    const idMatch = url.match(/\/([^\/]+)\/([^\/]+)\.html/);
    const signMatch = body.match(/class="signkey"[\s\S]+?value="([^"]+)"/);
    const dataSignMatch = body.match(/data-sign="([^"]+)"/);
    const dataUrlMatch = body.match(/var data_url = "([^"]+)"/);
    
    if (idMatch && signMatch) {
        const id = idMatch[1];
        const vid = idMatch[2];
        const time = signMatch[1];
        const sign = dataSignMatch ? dataSignMatch[1] : "";
        const dataUrl = dataUrlMatch ? dataUrlMatch[1] : "http://readshow.uslook.top";

        const imgRes = await client.post(dataUrl + "/read_s", {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": this.baseUrl + url
        }, `id=${id}&vid=${vid}&signkey=${sign}&time=${time}&iua=Mozilla/5.0&ref=`);
        
        try {
            const bodyStr = typeof imgRes.body === 'string' ? imgRes.body : JSON.stringify(imgRes.body);
            const imgData = JSON.parse(bodyStr);
            if (imgData && imgData.data) {
                return imgData.data
                    .map(i => i.imgurl || i)
                    .filter(src => src && (src.includes("shimolife.com") || src.includes("ecombdimg.com") || src.includes("byteimg.com")));
            }
        } catch(e) {}
    }
    return [];
  }
}
