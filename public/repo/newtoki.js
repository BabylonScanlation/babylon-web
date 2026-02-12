// ==MiruExtension==
// @name         NewToki
// @version      1.1.0
// @author       Linxurs
// @lang         ko
// @type         manga
// @webSite      https://newtoki465.com
// @description  NewToki Extension - Robust DOM Scraping
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://newtoki465.com";

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
    const doc = new Document(res.body);

    const list = [];
    const elements = doc.select("li.list-item");
    for (const el of elements) {
        const linkEl = el.selectFirst("a");
        const imgEl = el.selectFirst("img");
        const titleEl = el.selectFirst(".title");
        if (linkEl && titleEl) {
            list.push({
                name: titleEl.text.trim(),
                imageUrl: imgEl ? imgEl.attr("src") : "",
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
    const url = `${this.baseUrl}/page/update?hid=update&page=${page}`;
    const res = await client.get(url, this.getHeaders());
    const doc = new Document(res.body);

    const list = [];
    const elements = doc.select(".post-list");
    for (const el of elements) {
        const linkEl = el.selectFirst("a");
        const imgEl = el.selectFirst("img");
        const titleEl = el.selectFirst(".media-heading b");
        if (linkEl && titleEl) {
            list.push({
                name: titleEl.text.trim(),
                imageUrl: imgEl ? imgEl.attr("src") : "",
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
    const url = `${this.baseUrl}/webtoon?stx=${encodeURIComponent(query)}&page=${page}`;
    const res = await client.get(url, this.getHeaders());
    const doc = new Document(res.body);

    const list = [];
    const elements = doc.select("li.list-item");
    for (const el of elements) {
        const linkEl = el.selectFirst("a");
        const imgEl = el.selectFirst("img");
        const titleEl = el.selectFirst(".title");
        if (linkEl && titleEl) {
            list.push({
                name: titleEl.text.trim(),
                imageUrl: imgEl ? imgEl.attr("src") : "",
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
    const res = await client.get(url, this.getHeaders());
    const doc = new Document(res.body);

    const chapters = [];
    const elements = doc.select("a.item-subject");
    for (const el of elements) {
        chapters.push({
            name: el.text.trim(),
            url: el.attr("href")
        });
    }

    const nameEl = doc.selectFirst(".view-content b");
    const imgEl = doc.selectFirst(".view-img img");

    return {
      name: nameEl ? nameEl.text.trim() : "",
      imageUrl: imgEl ? imgEl.attr("src") : "",
      description: "NewToki Manhwa",
      author: "Unknown",
      chapters: chapters
    };
  }

  async getPageList(url) {
    const client = new Client();
    const res = await client.get(url, this.getHeaders());
    const body = res.body;

    const hexMatch = body.match(/html_data\+='([^']+)'/g);
    if (!hexMatch) return [];

    let hexStr = "";
    hexMatch.forEach(m => {
        hexStr += m.match(/'([^']+)'/)[1];
    });

    let decodedHtml = "";
    hexStr.split(".").forEach(part => {
        if (part) decodedHtml += String.fromCharCode(parseInt(part, 16));
    });

    const doc = new Document(decodedHtml);
    const pages = [];
    
    const dataAttrMatch = body.match(/data_attribute:\s*'([^']+)'/);
    const dataAttr = dataAttrMatch ? dataAttrMatch[1] : null;

    const images = doc.select("img");
    for (const img of images) {
        let src = dataAttr ? img.attr(`data-${dataAttr}`) : img.attr("src");
        if (!src || src.includes("loading-image.gif")) {
            src = img.attr("data-proxy") || img.attr("data-src") || img.attr("src");
        }
        if (src && !src.includes("loading-image.gif")) {
            pages.push(src);
        }
    }

    return pages;
  }
}
