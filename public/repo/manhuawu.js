// ==MiruExtension==
// @name         Manhuawu
// @version      1.0.0
// @author       Babylon
// @lang         zh
// @type         manga
// @webSite      https://www.mhua5.com
// @description  Extension para Manhuawu (漫画屋) - Basada en MCCMS.
// ==/MiruExtension==

class DefaultExtension extends MProvider {
  baseUrl = "https://www.mhua5.com";

  getHeaders(referer) {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": referer || this.baseUrl + "/",
    };
  }

  async getPopular(page) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/api/data/comic?page=${page}&size=20&order=hits`, this.getHeaders());
    const data = JSON.parse(res.body);
    return {
      list: (data.data || []).map(i => ({
        name: i.name,
        imageUrl: i.imgurl,
        link: `/comic/${i.id}`
      })),
      hasNextPage: (data.data || []).length >= 20
    };
  }

  async getLatestUpdates(page) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/api/data/comic?page=${page}&size=20&order=addtime`, this.getHeaders());
    const data = JSON.parse(res.body);
    return {
      list: (data.data || []).map(i => ({
        name: i.name,
        imageUrl: i.imgurl,
        link: `/comic/${i.id}`
      })),
      hasNextPage: (data.data || []).length >= 20
    };
  }

  async search(query, page, filters) {
    const client = new Client();
    const res = await client.get(`${this.baseUrl}/api/data/comic?page=${page}&size=20&key=${encodeURIComponent(query)}`, this.getHeaders());
    const data = JSON.parse(res.body);
    return {
      list: (data.data || []).map(i => ({
        name: i.name,
        imageUrl: i.imgurl,
        link: `/comic/${i.id}`
      })),
      hasNextPage: (data.data || []).length >= 20
    };
  }

  async getDetail(url) {
    const client = new Client();
    const id = url.split('/').pop();
    const res = await client.get(`${this.baseUrl}/api/comic/chapter?mid=${id}`, this.getHeaders());
    const data = JSON.parse(res.body);
    
    const detailRes = await client.get(`${this.baseUrl}${url}`, this.getHeaders());
    const body = detailRes.body;

    const chapters = (data.data || []).map(ch => ({
        name: ch.name,
        url: `/chapter/${ch.id}.html`
    })).reverse();

    return {
      name: body.match(/<h1 class="comic-name">([^<]+)<\/h1>/)?.[1] || "",
      imageUrl: body.match(/<div class="comic-cover">[\s\S]*?src="([^"]+)"/)?.[1] || "",
      description: body.match(/<div class="comic-intro">([\s\S]+?)<\/div>/)?.[1]?.replace(/<[^>]+>/g, '').trim() || "",
      author: body.match(/<p class="comic-author">([^<]+)<\/p>/)?.[1] || "",
      chapters: chapters
    };
  }

  async getPageList(url) {
    const client = new Client();
    const res = await client.get(this.baseUrl + url, this.getHeaders());
    const body = res.body;
    
    const imgRegex = /<img class="lazy" data-original="([^"]+)"/g;
    const pages = [];
    let match;
    while ((match = imgRegex.exec(body)) !== null) {
        pages.push(match[1]);
    }
    return pages;
  }
}
