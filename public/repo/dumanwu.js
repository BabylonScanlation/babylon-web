// ==MangayomiExtension==
// @name         Dumanwu
// @version      1.0.0
// @author       Babylon
// @lang         zh
// @type         manga
// @baseUrl      https://www.dumanwu1.com
// @description  Extension para Dumanwu (JS Nativo)
// ==/MangayomiExtension==

async function getPopular(page) {
    const res = await client.get(`${source.baseUrl}/rank/1/${page}`);
    const list = [];
    const items = dom.select(res.body, "div.book-list li, div.item-list div.item");
    
    for (const item of items) {
        list.push({
            name: dom.select(item, "h3, a.title").text().trim(),
            imageUrl: dom.select(item, "img").attr("src"),
            link: dom.select(item, "a").attr("href")
        });
    }
    return { list, hasNextPage: list.length > 0 };
}

async function getLatestUpdates(page) {
    return await getPopular(page); 
}

async function search(query, page, filters) {
    const res = await client.get(`${source.baseUrl}/search?key=${encodeURIComponent(query)}`);
    const list = [];
    const items = dom.select(res.body, "div.book-list li");
    for (const item of items) {
        list.push({
            name: dom.select(item, "h3").text().trim(),
            imageUrl: dom.select(item, "img").attr("src"),
            link: dom.select(item, "a").attr("href")
        });
    }
    return { list, hasNextPage: false };
}

async function getDetail(url) {
    const res = await client.get(source.baseUrl + url);
    const body = res.body;
    
    const chapters = [];
    const chElements = dom.select(body, "div.chapter-list li a");
    for (const ch of chElements) {
        chapters.push({
            name: dom.select(ch, "span").text() || ch.text(),
            url: ch.attr("href")
        });
    }

    return {
        name: dom.select(body, "h1.book-title").text(),
        description: dom.select(body, "div.book-intro").text(),
        author: dom.select(body, "p.book-author").text(),
        imageUrl: dom.select(body, "div.book-cover img").attr("src"),
        chapters: chapters.reverse()
    };
}

async function getPageList(url) {
    const res = await client.get(source.baseUrl + url);
    const images = [];
    const imgElements = dom.select(res.body, "div.comic-list img");
    for (const img of imgElements) {
        images.push(img.attr("src"));
    }
    return images;
}
