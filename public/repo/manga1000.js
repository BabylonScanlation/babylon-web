// ==MiruExtension==
// @name         Manga1000
// @version      1.0.0
// @author       Linxurs
// @lang         ja
// @type         manga
// @webSite      https://manga1000.top
// @description  Manga1000 Extension - Native JS
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://manga1000.top";

  getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/",
    };
  }

  async getPopular(page) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/manga-list.html?page=${page}&sort=views`, this.getHeaders());
    const doc = new Document(res.body);

    const list = [];
    const elements = doc.select(".manga-item");
    for (const el of elements) {
        const linkEl = el.selectFirst("a");
        const imgEl = el.selectFirst("img");
        if (linkEl && imgEl) {
            list.push({
                name: linkEl.attr("title") || "",
                imageUrl: imgEl.attr("src"),
                link: linkEl.attr("href")
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
    const res = await client.get(`${this.baseUrl}/manga-list.html?page=${page}&sort=last_update`, this.getHeaders());
    const doc = new Document(res.body);

    const list = [];
    const elements = doc.select(".manga-item");
    for (const el of elements) {
        const linkEl = el.selectFirst("a");
        const imgEl = el.selectFirst("img");
        if (linkEl && imgEl) {
            list.push({
                name: linkEl.attr("title") || "",
                imageUrl: imgEl.attr("src"),
                link: linkEl.attr("href")
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
    const res = await client.get(`${this.baseUrl}/search?q=${encodeURIComponent(query)}&page=${page}`, this.getHeaders());
    const doc = new Document(res.body);

    const list = [];
    const elements = doc.select(".manga-item");
    for (const el of elements) {
        const linkEl = el.selectFirst("a");
        const imgEl = el.selectFirst("img");
        if (linkEl && imgEl) {
            list.push({
                name: linkEl.attr("title") || "",
                imageUrl: imgEl.attr("src"),
                link: linkEl.attr("href")
            });
        }
    }

    return {
      list: list,
      hasNextPage: list.length > 0
    };
  }

  async getDetail(url) {
    const client = new Client();
    const res = await client.get(this.baseUrl + url, this.getHeaders());
    const doc = new Document(res.body);

    const chapters = [];
    const elements = doc.select(".chapter-list a");
    for (const el of elements) {
        chapters.push({
            name: el.text.trim(),
            url: el.attr("href")
        });
    }

    const nameEl = doc.selectFirst(".manga-title");
    const imgEl = doc.selectFirst(".manga-cover img");
    const descEl = doc.selectFirst(".manga-description");

    return {
      name: nameEl ? nameEl.text.trim() : "",
      imageUrl: imgEl ? imgEl.attr("src") : "",
      description: descEl ? descEl.text.trim() : "",
      author: "Unknown",
      chapters: chapters
    };
  }

  async getPageList(url) {
    const client = new Client();
    const res = await client.get(this.baseUrl + url, this.getHeaders());
    const doc = new Document(res.body);
    const pages = [];
    
    const images = doc.select(".reader-area img");
    for (const img of images) {
        const src = img.attr("src");
        if (src && !src.includes("data:image")) {
            pages.push(src);
        }
    }

    return pages;
  }
}
