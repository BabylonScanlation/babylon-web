// ==MiruExtension==
// @name         RawKuma
// @version      1.1.0
// @author       Linxurs
// @lang         ja
// @type         manga
// @webSite      https://rawkuma.net
// @description  RawKuma Extension - Robust DOM Scraping
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://rawkuma.net";
  nonce = null;

  getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/",
    };
  }

  async getNonce() {
    if (this.nonce) return this.nonce;
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/wp-admin/admin-ajax.php?type=search_form&action=get_nonce`, this.getHeaders());
    const match = res.body.match(/value="([^"]+)"/);
    if (match) {
        this.nonce = match[1];
        return this.nonce;
    }
    return null;
  }

  async getPopular(page) {
    return await this.search("", page, []);
  }

  async getLatestUpdates(page) {
    return await this.search("", page, [{ key: "orderby", value: "latest" }]);
  }

  async search(query, page, filters) {
    const client = new Client();
    const nonce = await this.getNonce();
    
    const body = `action=advanced_search&nonce=${nonce}&page=${page}&query=${encodeURIComponent(query)}&order=desc&orderby=latest`;
    
    const res = await client.post(`${this.baseUrl}/wp-admin/admin-ajax.php?action=advanced_search`, {
        ...this.getHeaders(),
        "Content-Type": "application/x-www-form-urlencoded"
    }, body);

    const doc = new Document(res.body);
    const list = [];
    const elements = doc.select("a[href*='/manga/']");
    
    for (const el of elements) {
        const imgEl = el.selectFirst("img");
        const href = el.attr("href");
        if (imgEl && href) {
            const slugMatch = href.match(/\/manga\/([^/]+)\//);
            if (slugMatch) {
                list.push({
                    name: slugMatch[1].replace(/-/g, ' '),
                    imageUrl: imgEl.attr("src"),
                    link: slugMatch[1]
                });
            }
        }
    }

    if (list.length > 0) {
        const slugs = list.map(i => `slug[]=${i.link}`).join('&');
        const detailsRes = await client.get(`${this.baseUrl}/wp-json/wp/v2/manga?${slugs}&_embed`, this.getHeaders());
        try {
            const details = JSON.parse(detailsRes.body);
            return {
                list: details.map(d => ({
                    name: d.title?.rendered || d.slug,
                    imageUrl: d._embedded?.['wp:featuredmedia']?.[0]?.source_url || list.find(i => i.link === d.slug)?.imageUrl,
                    link: d.slug
                })),
                hasNextPage: list.length >= 10
            };
        } catch(e) {}
    }

    return {
      list: list,
      hasNextPage: list.length > 0
    };
  }

  async getDetail(slug) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/wp-json/wp/v2/manga?slug=${slug}&_embed`, this.getHeaders());
    const dataList = JSON.parse(res.body);
    if (!dataList || dataList.length === 0) return null;
    const data = dataList[0];

    const chapRes = await client.get(`${this.baseUrl}/wp-admin/admin-ajax.php?manga_id=${data.id}&action=chapter_list`, this.getHeaders());
    const doc = new Document(chapRes.body);
    const chapters = [];
    const elements = doc.select("a");
    
    for (const el of elements) {
        const span = el.selectFirst("span");
        if (span) {
            chapters.push({
                name: span.text.trim(),
                url: el.attr("href")
            });
        }
    }

    return {
      name: data.title?.rendered || slug,
      imageUrl: data._embedded?.['wp:featuredmedia']?.[0]?.source_url || "",
      description: data.content?.rendered?.replace(/<[^>]+>/g, '') || "",
      author: "Unknown",
      chapters: chapters
    };
  }

  async getPageList(url) {
    const client = new Client();
    const res = await client.get(url, this.getHeaders());
    const doc = new Document(res.body);
    const pages = [];
    
    const images = doc.select("main img, #readerarea img");
    for (const img of images) {
        const src = img.attr("src");
        if (src && (src.includes("rawkuma.net") || src.includes("wp-content")) && !src.includes("avatar")) {
            if (src.endsWith(".jpg") || src.endsWith(".png") || src.endsWith(".webp")) {
                pages.push(src);
            }
        }
    }

    return pages;
  }
}
