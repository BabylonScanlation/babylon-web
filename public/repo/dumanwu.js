// ==MiruExtension==
// @name         Dumanwu
// @version      1.2.1
// @author       Babylon
// @lang         zh
// @type         manga
// @webSite      https://dumanwu.com
// @description  Extension para Dumanwu (JS Nativo)
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://dumanwu.com";

  async getPopular(page) {
    const client = new Client();
    const res = await client.post(this.baseUrl + "/data/sort", {
      "Content-Type": "application/x-www-form-urlencoded"
    }, `s=1&p=${page}`);
    
    const data = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    const list = [];
    if (data && data.data) {
      for (const item of data.data) {
        list.push({
          name: item.bookName || item.name,
          imageUrl: item.imgurl,
          link: `/${item.id}/`
        });
      }
    }
    return {
      list: list,
      hasNextPage: list.length > 0
    };
  }

  async getLatestUpdates(page) {
    const client = new Client();
    const res = await client.post(this.baseUrl + "/data/sort", {
      "Content-Type": "application/x-www-form-urlencoded"
    }, `s=15&p=${page}`);
    
    const data = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    const list = [];
    if (data && data.data) {
      for (const item of data.data) {
        list.push({
          name: item.bookName || item.name,
          imageUrl: item.imgurl,
          link: `/${item.id}/`
        });
      }
    }
    return {
      list: list,
      hasNextPage: list.length > 0
    };
  }

  async search(query, page, filters) {
    const client = new Client();
    const res = await client.post(this.baseUrl + "/s", {
      "Content-Type": "application/x-www-form-urlencoded"
    }, `k=${encodeURIComponent(query)}`);
    
    const data = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    const list = [];
    if (data && data.data) {
      for (const item of data.data) {
        list.push({
          name: item.name || item.bookName,
          imageUrl: item.imgurl,
          link: `/${item.id}/`
        });
      }
    }
    return {
      list: list,
      hasNextPage: false
    };
  }

  async getDetail(url) {
    const client = new Client();
    const res = await client.get(this.baseUrl + url);
    const body = res.body;
    
    // Usamos selectores simples para evitar dependencias
    const name = body.match(/<h1 class="book-title">([^<]+)<\/h1>/)?.[1] || "";
    const description = body.match(/<div class="book-intro">([^<]+)<\/div>/)?.[1] || "";
    const author = body.match(/<p class="book-author">([^<]+)<\/p>/)?.[1] || "";
    const imageUrl = body.match(/<div class="book-cover">[\s\S]*?src="([^"]+)"/)?.[1] || "";
    
    const chapters = [];
    const chapBox = body.match(/<div class="chaplist-box">([\s\S]*?)<\/div>/)?.[1] || body;
    const chapterRegex = /<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g;
    let match;
    while ((match = chapterRegex.exec(chapBox)) !== null) {
        if (!match[1].includes("javascript")) {
            chapters.push({
                name: match[2].replace(/<[^>]+>/g, '').trim(),
                url: match[1]
            });
        }
    }

    return {
      name: name,
      imageUrl: imageUrl,
      description: description,
      author: author,
      chapters: chapters.reverse()
    };
  }

  async getPageList(url) {
    const client = new Client();
    const res = await client.get(this.baseUrl + url);
    const body = res.body;
    
    const images = [];
    const imgBox = body.match(/<div class="chapter-img-box">([\s\S]*?)<\/div>/)?.[1] || "";
    const imgRegex = /data-src="([^"]+)"/g;
    let match;
    while ((match = imgRegex.exec(imgBox)) !== null) {
        if (match[1] && !match[1].includes("load.gif")) {
            images.push(match[1]);
        }
    }
    return images;
  }
}
