// ==MiruExtension==
// @name         ManhwaRaw
// @version      1.0.0
// @author       Linxurs
// @lang         ko
// @type         manga
// @webSite      https://manhwaraw.com
// @description  ManhwaRaw Extension - Madara based native JS
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://manhwaraw.com";

  getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/",
    };
  }

  async getPopular(page) {
    const client = new Client();
    const res = await client.post(`${this.baseUrl}/wp-admin/admin-ajax.php`, {
        ...this.getHeaders(),
        "Content-Type": "application/x-www-form-urlencoded"
    }, `action=madara_load_more&page=${page-1}&template=madara-core%2Fcontent%2Fcontent-archive&vars%5Bpaged%5D=1&vars%5Borderby%5D=meta_value_num&vars%5Btemplate%5D=archive&vars%5Bsidebar%5D=right&vars%5Bpost_type%5D=wp-manga&vars%5Bmeta_key%5D=_wp_manga_views`);
    
    const doc = new Document(res.body);
    const list = [];
    const elements = doc.select(".manga-item, .page-item-detail");
    
    for (const el of elements) {
        const linkEl = el.selectFirst("a");
        const imgEl = el.selectFirst("img");
        if (linkEl && imgEl) {
            list.push({
                name: linkEl.attr("title") || el.selectFirst(".post-title a")?.text.trim() || "",
                imageUrl: imgEl.attr("data-src") || imgEl.attr("src"),
                link: linkEl.attr("href").replace(this.baseUrl, "")
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
    const res = await client.post(`${this.baseUrl}/wp-admin/admin-ajax.php`, {
        ...this.getHeaders(),
        "Content-Type": "application/x-www-form-urlencoded"
    }, `action=madara_load_more&page=${page-1}&template=madara-core%2Fcontent%2Fcontent-archive&vars%5Bpaged%5D=1&vars%5Borderby%5D=post_date&vars%5Btemplate%5D=archive&vars%5Bsidebar%5D=right&vars%5Bpost_type%5D=wp-manga`);
    
    const doc = new Document(res.body);
    const list = [];
    const elements = doc.select(".manga-item, .page-item-detail");
    
    for (const el of elements) {
        const linkEl = el.selectFirst("a");
        const imgEl = el.selectFirst("img");
        if (linkEl && imgEl) {
            list.push({
                name: linkEl.attr("title") || el.selectFirst(".post-title a")?.text.trim() || "",
                imageUrl: imgEl.attr("data-src") || imgEl.attr("src"),
                link: linkEl.attr("href").replace(this.baseUrl, "")
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
    const res = await client.get(`${this.baseUrl}/?s=${encodeURIComponent(query)}&post_type=wp-manga`, this.getHeaders());
    const doc = new Document(res.body);

    const list = [];
    const elements = doc.select(".c-tabs-item__content");
    for (const el of elements) {
        const linkEl = el.selectFirst(".post-title a");
        const imgEl = el.selectFirst("img");
        if (linkEl && imgEl) {
            list.push({
                name: linkEl.text.trim(),
                imageUrl: imgEl.attr("data-src") || imgEl.attr("src"),
                link: linkEl.attr("href").replace(this.baseUrl, "")
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
    const elements = doc.select(".wp-manga-chapter a");
    for (const el of elements) {
        chapters.push({
            name: el.text.trim(),
            url: el.attr("href").replace(this.baseUrl, "")
        });
    }

    const nameEl = doc.selectFirst(".post-title h1");
    const imgEl = doc.selectFirst(".summary_image img");
    const descEl = doc.selectFirst(".description-summary");

    return {
      name: nameEl ? nameEl.text.trim() : "",
      imageUrl: imgEl ? (imgEl.attr("data-src") || imgEl.attr("src")) : "",
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
    
    const images = doc.select(".reading-content img");
    for (const img of images) {
        const src = (img.attr("data-src") || img.attr("src") || "").trim();
        if (src && !src.includes("data:image")) {
            pages.push(src);
        }
    }

    return pages;
  }
}
