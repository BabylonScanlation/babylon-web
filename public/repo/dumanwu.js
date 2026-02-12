// ==MiruExtension==
// @name         Dumanwu
// @version      1.3.0
// @author       Babylon
// @lang         zh
// @type         manga
// @webSite      https://dumanwu.com
// @description  Extension para Dumanwu (JS Nativo - Fix Imagenes)
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
    
    const name = body.match(/<h1 class="book-title">([^<]+)<\/h1>/)?.[1] || "";
    const description = body.match(/<div class="book-intro">([^<]+)<\/div>/)?.[1] || "";
    const author = body.match(/<p class="book-author">([^<]+)<\/p>/)?.[1] || "";
    const imageUrl = body.match(/<div class="book-cover">[\s\S]*?src="([^"]+)"/)?.[1] || "";
    
    const chapters = [];
    // Capturamos solo la sección de capítulos real
    const chapListMatch = body.match(/<div class="chaplist-box">([\s\S]+?)<\/div>/);
    const chapContent = chapListMatch ? chapListMatch[1] : body;
    
    const chapterRegex = /<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g;
    let match;
    while ((match = chapterRegex.exec(chapContent)) !== null) {
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
    
    // El sitio nuevo usa un packer. Intentamos extraer el string de imágenes.
    // Buscamos la variable que empieza por "H j=" o similar dentro del eval
    const images = [];
    
    // Método 1: Buscar el string largo del packer y extraer las URLs
    // Las URLs de Dumanwu suelen estar en un formato de servidor p6 o similar
    const imgRegex = /https?:\/\/[\w\.-]+?\/tos-cn-i-[\w\.-]+?\/[\w\.-]+?~tplv-[\w\.-]+?-image\.jpeg/g;
    const allMatches = body.match(imgRegex) || [];
    
    // Eliminamos duplicados
    const uniqueMatches = [...new Set(allMatches)];
    
    // IMPORTANTE: En la nueva web, las imágenes del manga NO aparecen en el HTML estático.
    // Si uniqueMatches tiene solo 6 imágenes, son las recomendaciones.
    // Si tiene más de 10, las primeras suelen ser del manga.
    
    if (uniqueMatches.length > 8) {
        // Filtrar las que NO pertenecen a la lista de recomendaciones
        // Las recomendaciones están en un <ul> con clase "view-ul"
        const recSection = body.match(/<ul class="view-ul">([\s\S]+?)<\/ul>/);
        const recBody = recSection ? recSection[1] : "";
        
        for (const imgUrl of uniqueMatches) {
            if (!recBody.includes(imgUrl)) {
                images.push(imgUrl);
            }
        }
    }

    // Si fallamos al extraer del HTML, intentamos el endpoint read_s
    if (images.length === 0) {
        const idMatch = url.match(/\/([^\/]+)\/([^\/]+)\.html/);
        const signMatch = body.match(/class="signkey"[\s\S]+?value="([^"]+)"/);
        const dataSignMatch = body.match(/data-sign="([^"]+)"/);
        
        if (idMatch && signMatch) {
            const id = idMatch[1];
            const vid = idMatch[2];
            const time = signMatch[1];
            const sign = dataSignMatch ? dataSignMatch[1] : "";
            
            // Nota: Este endpoint puede requerir referer
            const imgRes = await client.post("http://readshow.uslook.top/read_s", {
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": this.baseUrl + url
            }, `id=${id}&vid=${vid}&signkey=${sign}&time=${time}`);
            
            try {
                const imgData = typeof imgRes.body === 'string' ? JSON.parse(imgRes.body) : imgRes.body;
                if (imgData && imgData.data) {
                    return imgData.data.map(i => i.imgurl || i);
                }
            } catch(e) {}
        }
    }
    
    return images;
  }
}
