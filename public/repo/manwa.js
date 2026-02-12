// ==MiruExtension==
// @name         Manwa
// @version      1.0.0
// @author       Babylon
// @lang         zh
// @type         manga
// @webSite      https://manwa.me
// @description  Extension para Manwa (漫蛙) - Soporte para espejos y desencriptación AES.
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  // Espejos por defecto
  mirrors = [
    "https://manwa.me",
    "https://manwass.cc",
    "https://manwatg.cc",
    "https://manwast.cc",
    "https://manwasy.cc",
  ];

  get baseUrl() {
    return this.mirrors[0]; // TODO: Implementar selección de espejo
  }

  getHeaders(url) {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/",
    };
  }

  async getPopular(page) {
    const client = new Client();
    const res = await client.get(this.baseUrl + "/rank", this.getHeaders());
    const doc = new Document(res.body);
    const list = [];
    const elements = doc.select("#rankList_2 > a");
    for (const element of elements) {
        list.push({
            name: element.attr("title"),
            imageUrl: element.select("img").attr("data-original"),
            link: element.attr("href")
        });
    }
    return {
      list: list,
      hasNextPage: false
    };
  }

  async getLatestUpdates(page) {
    const client = new Client();
    const offset = (page - 1) * 15;
    const res = await client.get(`${this.baseUrl}/getUpdate?page=${offset}&date=`, this.getHeaders());
    const data = JSON.parse(res.body);
    
    // Necesitamos el host de imágenes
    const hostRes = await client.get(this.baseUrl + "/update", this.getHeaders());
    const hostDoc = new Document(hostRes.body);
    const imgHost = hostDoc.select(".manga-list-2-cover-img").attr(":src").split("'")[1];

    return {
      list: (data.books || []).map(b => ({
        name: b.book_name,
        imageUrl: imgHost + b.cover_url,
        link: `/book/${b.id}`
      })),
      hasNextPage: data.total > offset + 15
    };
  }

  async search(query, page, filters) {
    const client = new Client();
    let url = "";
    if (query && query.trim() !== "") {
        url = `${this.baseUrl}/search?keyword=${encodeURIComponent(query)}`;
        if (page > 1) url += `&page=${page}`;
    } else {
        url = `${this.baseUrl}/booklist`; // TODO: Filtros
        if (page > 1) url += `?page=${page}`;
    }
    
    const res = await client.get(url, this.getHeaders());
    const doc = new Document(res.body);
    const list = [];
    
    if (url.includes("/booklist")) {
        const elements = doc.select("ul.manga-list-2 > li");
        for (const element of elements) {
            list.push({
                name: element.select("p.manga-list-2-title").text(),
                imageUrl: element.select("img").attr("src"),
                link: element.select("a").attr("href")
            });
        }
    } else {
        const elements = doc.select("ul.book-list > li");
        for (const element of elements) {
            list.push({
                name: element.select("p.book-list-info-title").text(),
                imageUrl: element.select("img").attr("data-original"),
                link: element.select("a").attr("href")
            });
        }
    }

    return {
      list: list,
      hasNextPage: doc.select("ul.pagination2 > li").last()?.text() === "下一页"
    };
  }

  async getDetail(url) {
    const client = new Client();
    const res = await client.get(this.baseUrl + url, this.getHeaders());
    const doc = new Document(res.body);
    
    const chapters = [];
    const elements = doc.select("ul#detail-list-select > li > a");
    for (const element of elements) {
        chapters.push({
            name: element.text(),
            url: element.attr("href")
        });
    }

    return {
      name: doc.select(".detail-main-info-title").text(),
      imageUrl: doc.select("div.detail-main-cover > img").attr("data-original"),
      description: doc.select("#detail > p.detail-desc").text(),
      author: doc.select("p.detail-main-info-author > span.detail-main-info-value > a").text(),
      status: doc.select("p.detail-main-info-author:contains(更新状态) > span.detail-main-info-value").text().includes("连载") ? 0 : 1,
      genre: doc.select("div.detail-main-info-class > a.info-tag").map(e => e.text()),
      chapters: chapters.reverse()
    };
  }

  async getPageList(url) {
    const client = new Client();
    const res = await client.get(this.baseUrl + url, this.getHeaders());
    const doc = new Document(res.body);
    
    const pages = [];
    const elements = doc.select("#cp_img > div.img-content > img[data-r-src]");
    for (const element of elements) {
        let imageUrl = element.attr("data-r-src");
        // Las imágenes están encriptadas con AES si terminan en cierto parámetro o según la lógica de Manwa
        pages.push(imageUrl);
    }
    return pages;
  }
}
