// ==MiruExtension==
// @name         Dumanwu
// @version      1.5.0
// @author       Babylon
// @lang         zh
// @type         manga
// @webSite      https://dumanwu.com
// @description  Extension para Dumanwu (Soporte para carga completa y firmas temporales)
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://dumanwu.com";

  async getPopular(page) {
    const client = new Client();
    const res = await client.post(this.baseUrl + "/data/sort", {
      "Content-Type": "application/x-www-form-urlencoded"
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
      "Content-Type": "application/x-www-form-urlencoded"
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
      "Content-Type": "application/x-www-form-urlencoded"
    }, `k=${encodeURIComponent(query)}`);
    const data = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    return {
      list: (data.data || []).map(i => ({ name: i.name, imageUrl: i.imgurl, link: `/${i.id}/` })),
      hasNextPage: false
    };
  }

  async getDetail(url) {
    const client = new Client();
    const res = await client.get(this.baseUrl + url);
    const body = res.body;
    const id = url.replace(/\//g, '');
    
    let chapters = [];
    
    // 1. Obtener todos los capítulos vía API
    try {
        const moreRes = await client.post(this.baseUrl + "/morechapter", {
            "Content-Type": "application/x-www-form-urlencoded"
        }, `id=${id}`);
        const moreData = JSON.parse(moreRes.body);
        if (moreData.code === "200" && moreData.data) {
            chapters = moreData.data.map(ch => ({
                name: ch.chaptername,
                url: `/${id}/${ch.chapterid}.html`
            }));
        }
    } catch(e) {}

    // 2. Si el API falla, usar el HTML como respaldo
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
    const res = await client.get(this.baseUrl + url);
    const body = res.body;
    
    const idMatch = url.match(/\/([^\/]+)\/([^\/]+)\.html/);
    const signMatch = body.match(/class="signkey"[\s\S]+?value="([^"]+)"/);
    const dataSignMatch = body.match(/data-sign="([^"]+)"/);
    
    if (idMatch && signMatch) {
        const id = idMatch[1];
        const vid = idMatch[2];
        const time = signMatch[1];
        const sign = dataSignMatch ? dataSignMatch[1] : "";

        // Consultar el servidor de imágenes con los tokens del HTML
        const imgRes = await client.post("http://readshow.uslook.top/read_s", {
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": this.baseUrl + url
        }, `id=${id}&vid=${vid}&signkey=${sign}&time=${time}&iua=Mangayomi/1.0&ref=`);
        
        try {
            const imgData = JSON.parse(imgRes.body);
            if (imgData && imgData.data) {
                // Filtramos para asegurar que solo devolvemos imágenes de shimolife o ecombdimg
                return imgData.data
                    .map(i => i.imgurl || i)
                    .filter(src => src.includes("shimolife.com") || src.includes("ecombdimg.com"));
            }
        } catch(e) {}
    }
    return [];
  }
}
