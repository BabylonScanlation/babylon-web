// ==MiruExtension==
// @name         RawKuma
// @version      1.0.0
// @author       Linxurs
// @lang         ja
// @type         manga
// @webSite      https://rawkuma.net
// @description  RawKuma Extension - WP-API based scraping
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
    const body = res.body;
    const match = body.match(/value="([^"]+)"/);
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
    // Para RawKuma, el latest se puede obtener por la misma via de búsqueda cambiando el orden
    return await this.search("", page, [{ key: "orderby", value: "latest" }]);
  }

  async search(query, page, filters) {
    const client = new Client();
    const nonce = await this.getNonce();
    
    // NatsuId usa Multipart para la búsqueda avanzada
    const body = `action=advanced_search&nonce=${nonce}&page=${page}&query=${encodeURIComponent(query)}&order=desc&orderby=latest`;
    
    const res = await client.post(`${this.baseUrl}/wp-admin/admin-ajax.php?action=advanced_search`, {
        ...this.getHeaders(),
        "Content-Type": "application/x-www-form-urlencoded"
    }, body);

    const list = [];
    const html = res.body;
    // Extraer slugs de los enlaces
    const regex = /<div[^>]*>[\s\S]*?<a href="https:\/\/rawkuma\.net\/manga\/([^/]+)\/"[^>]*>[\s\S]*?<img src="([^"]+)"/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
        list.push({
            name: match[1].replace(/-/g, ' '), // Título aproximado desde el slug
            imageUrl: match[2],
            link: match[1]
        });
    }

    // Si tenemos slugs, podemos pedir los detalles reales por WP-API para mejorar los títulos
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
    // Primero obtenemos el ID del manga mediante el slug
    const res = await client.get(`${this.baseUrl}/wp-json/wp/v2/manga?slug=${slug}&_embed`, this.getHeaders());
    const data = JSON.parse(res.body)[0];
    if (!data) return null;

    const id = data.id;
    
    // Obtener lista de capítulos vía AJAX
    const chapRes = await client.get(`${this.baseUrl}/wp-admin/admin-ajax.php?manga_id=${id}&action=chapter_list`, this.getHeaders());
    const chapHtml = chapRes.body;
    const chapters = [];
    const chapRegex = /<a href="([^"]+)">[\s\S]*?<span>([^<]+)<\/span>/g;
    let match;
    while ((match = chapRegex.exec(chapHtml)) !== null) {
        chapters.push({
            name: match[2].trim(),
            url: match[1]
        });
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
    const body = res.body;

    const pages = [];
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
    // En RawKuma las imágenes están dentro de un contenedor específico
    const readerMatch = body.match(/<main[^>]*>([\s\S]+?)<\/main>/);
    const htmlToSearch = readerMatch ? readerMatch[1] : body;

    let match;
    while ((match = imgRegex.exec(htmlToSearch)) !== null) {
        const src = match[1];
        if (src.includes("rawkuma.net") && (src.endsWith(".jpg") || src.endsWith(".png") || src.endsWith(".webp") || src.includes("wp-content"))) {
            pages.push(src);
        }
    }

    return pages;
  }
}
