// ==MiruExtension==
// @name         ToonKor
// @version      1.1.0
// @author       Linxurs
// @lang         ko
// @type         manga
// @webSite      https://tkor.dog
// @description  ToonKor Extension - Robust DOM Scraping
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://tkor.dog";

  getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/",
    };
  }

  async getPopular(page) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/%EC%9B%B9%ED%88%B0`, this.getHeaders());
    const doc = new Document(res.body);

    const list = [];
    const elements = doc.select(".section-item-inner");
    for (const el of elements) {
        const linkEl = el.selectFirst("a");
        const imgEl = el.selectFirst("img");
        const titleEl = el.selectFirst("h3");
        if (linkEl && titleEl) {
            let imageUrl = imgEl ? imgEl.attr("src") : "";
            if (imageUrl && !imageUrl.startsWith("http")) imageUrl = this.baseUrl + imageUrl;
            list.push({
                name: titleEl.text.trim(),
                imageUrl: imageUrl,
                link: linkEl.attr("href")
            });
        }
    }

    return {
      list: list,
      hasNextPage: false
    };
  }

  async getLatestUpdates(page) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/%EC%9B%B9%ED%88%B0?fil=%EC%B5%9C%EC%8B%A0`, this.getHeaders());
    const doc = new Document(res.body);

    const list = [];
    const elements = doc.select(".section-item-inner");
    for (const el of elements) {
        const linkEl = el.selectFirst("a");
        const imgEl = el.selectFirst("img");
        const titleEl = el.selectFirst("h3");
        if (linkEl && titleEl) {
            let imageUrl = imgEl ? imgEl.attr("src") : "";
            if (imageUrl && !imageUrl.startsWith("http")) imageUrl = this.baseUrl + imageUrl;
            list.push({
                name: titleEl.text.trim(),
                imageUrl: imageUrl,
                link: linkEl.attr("href")
            });
        }
    }

    return {
      list: list,
      hasNextPage: false
    };
  }

  async search(query, page, filters) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/bbs/search.php?sfl=wr_subject%7C%7Cwr_content&stx=${encodeURIComponent(query)}`, this.getHeaders());
    const doc = new Document(res.body);

    const list = [];
    const elements = doc.select(".section-item-inner");
    for (const el of elements) {
        const linkEl = el.selectFirst("a");
        const imgEl = el.selectFirst("img");
        const titleEl = el.selectFirst("h3");
        if (linkEl && titleEl) {
            let imageUrl = imgEl ? imgEl.attr("src") : "";
            if (imageUrl && !imageUrl.startsWith("http")) imageUrl = this.baseUrl + imageUrl;
            list.push({
                name: titleEl.text.trim(),
                imageUrl: imageUrl,
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
    const elements = doc.select("td.content__title");
    for (const el of elements) {
        chapters.push({
            name: el.text.trim(),
            url: el.attr("data-role")
        });
    }

    const nameEl = doc.selectFirst("td.bt_title");
    const imgEl = doc.selectFirst("td.bt_thumb img");
    const descEl = doc.selectFirst("td.bt_over");

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
    const body = res.body;

    const encodedMatch = body.match(/toon_img\s*=\s*'([^']+)'/);
    if (!encodedMatch) return [];

    const decoded = this.base64Decode(encodedMatch[1]);
    const doc = new Document(decoded);
    const pages = [];
    const images = doc.select("img");
    
    for (const img of images) {
        let imgUrl = img.attr("src");
        if (imgUrl && !imgUrl.startsWith('http')) {
            imgUrl = this.baseUrl + (imgUrl.startsWith('/') ? '' : '/') + imgUrl;
        }
        if (imgUrl && !imgUrl.includes("blank.gif")) {
            pages.push(imgUrl);
        }
    }

    return pages;
  }

  base64Decode(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    str = str.replace(/[^A-Za-z0-9+/=]/g, '');
    for (let i = 0; i < str.length; i += 4) {
      const enc1 = chars.indexOf(str[i]);
      const enc2 = chars.indexOf(str[i + 1]);
      const enc3 = chars.indexOf(str[i + 2]);
      const enc4 = chars.indexOf(str[i + 3]);
      output += String.fromCharCode((enc1 << 2) | (enc2 >> 4));
      if (enc3 !== 64) output += String.fromCharCode(((enc2 & 15) << 4) | (enc3 >> 2));
      if (enc4 !== 64) output += String.fromCharCode(((enc3 & 3) << 6) | enc4);
    }
    return output;
  }
}
