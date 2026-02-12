// ==MiruExtension==
// @name         BaoziManhua
// @version      1.1.0
// @author       Linxurs
// @lang         zh
// @type         manga
// @webSite      https://cn.baozimh.com
// @description  BaoziManhua Extension - Robust DOM Scraping
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://cn.baozimh.com";

  getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/",
    };
  }

  async getPopular(page) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/classify?page=${page}`, this.getHeaders());
    const doc = new Document(res.body);

    const list = [];
    const elements = doc.select("div.pure-u-1-3, div.pure-u-sm-1-6");
    for (const el of elements) {
        const linkEl = el.selectFirst("a");
        const imgEl = el.selectFirst("amp-img");
        if (linkEl && imgEl) {
            list.push({
                name: linkEl.attr("title").trim(),
                imageUrl: imgEl.attr("src"),
                link: linkEl.attr("href")
            });
        }
    }

    return {
      list: list,
      hasNextPage: list.length >= 36
    };
  }

  async getLatestUpdates(page) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/list/new?page=${page}`, this.getHeaders());
    const doc = new Document(res.body);

    const list = [];
    const elements = doc.select("div.pure-u-1-3, div.pure-u-sm-1-6");
    for (const el of elements) {
        const linkEl = el.selectFirst("a");
        const imgEl = el.selectFirst("amp-img");
        if (linkEl && imgEl) {
            list.push({
                name: linkEl.attr("title").trim(),
                imageUrl: imgEl.attr("src"),
                link: linkEl.attr("href")
            });
        }
    }

    return {
      list: list,
      hasNextPage: list.length >= 36
    };
  }

  async search(query, page, filters) {
    const client = new Client();
    const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
    const res = await client.get(url, this.getHeaders());
    const doc = new Document(res.body);

    const list = [];
    const elements = doc.select("div.pure-u-1-3, div.pure-u-sm-1-6");
    for (const el of elements) {
        const linkEl = el.selectFirst("a");
        const imgEl = el.selectFirst("amp-img");
        if (linkEl && imgEl) {
            list.push({
                name: linkEl.attr("title").trim(),
                imageUrl: imgEl.attr("src"),
                link: linkEl.attr("href")
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
    const res = await client.get(this.baseUrl + url, this.getHeaders());
    const doc = new Document(res.body);

    const chapters = [];
    const elements = doc.select(".comics-chapters a");
    for (const el of elements) {
        chapters.push({
            name: el.text.trim(),
            url: el.attr("href")
        });
    }

    const nameEl = doc.selectFirst("h1.comics-detail__title");
    const imgEl = doc.selectFirst("amp-img");
    const descEl = doc.selectFirst("p.comics-detail__desc");
    const authorEl = doc.selectFirst("h2.comics-detail__author");

    return {
      name: nameEl ? nameEl.text.trim() : "",
      imageUrl: imgEl ? imgEl.attr("src") : "",
      description: descEl ? descEl.text.trim() : "",
      author: authorEl ? authorEl.text.trim() : "Unknown",
      chapters: chapters.reverse()
    };
  }

  async getPageList(url) {
    const client = new Client();
    const pages = [];
    let currentUrl = this.baseUrl + url;
    
    while (currentUrl) {
        const res = await client.get(currentUrl, this.getHeaders());
        const doc = new Document(res.body);
        
        const images = doc.select("amp-img");
        for (const img of images) {
            let imgUrl = img.attr("src");
            imgUrl = imgUrl.replace(".baozicdn.com", ".baozimh.com");
            if (!pages.includes(imgUrl)) pages.push(imgUrl);
        }
        
        const nextBtn = doc.selectFirst("#next-chapter");
        if (nextBtn && (nextBtn.text.includes("下一页") || nextBtn.text.includes("下一頁"))) {
            currentUrl = this.baseUrl + nextBtn.attr("href");
        } else {
            currentUrl = null;
        }
    }

    return pages;
  }
}
