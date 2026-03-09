import type { APIRoute } from 'astro';
import { siteConfig } from '../../site.config';

export const GET: APIRoute = async () => {
  // Aquí usamos siteUrl correctamente
  const siteUrl = siteConfig.url;

  const content = `/* eslint-disable */
// ==MangayomiExtension==
// @name         Hitomi.la
// @version      1.0.5
// @author       Lucas Goldteins
// @lang         es
// @license      MIT
// @type         manga
// @icon         https://hitomi.la/favicon.ico
// @webSite      ${siteUrl}
// ==/MangayomiExtension==

// Variables globales para la lógica de gg.js
let m_default = 0;
let m_map = {};
let b_val = "";

class HitomiExtension extends MProvider {

    // ---------------------------------------------------
    // PASO 1: LÓGICA DE ENRUTAMIENTO (gg.js)
    // ---------------------------------------------------
    async load_gg() {
        try {
            const res = await new Client().get("https://ltn.gold-usergeneratedcontent.net/gg.js");
            const body = typeof res.body === 'string' ? res.body : res.body.toString();

            const m_o = body.match(/var o = (\\d)/);
            m_default = m_o ? parseInt(m_o[1]) : 0;

            const o_match = body.match(/o = (\\d); break;/);
            const o_val = o_match ? parseInt(o_match[1]) : m_default;

            const caseRegex = /case (\\d+):/g;
            let match;
            while ((match = caseRegex.exec(body)) !== null) {
                m_map[parseInt(match[1])] = o_val;
            }

            const m_b = body.match(/b: '(.+)'/);
            b_val = m_b ? m_b[1] : "";

            if (b_val && !b_val.endsWith("/")) {
                b_val += "/";
            }
        } catch (error) {
            console.log("Error cargando gg.js: " + error);
        }
    }

    get_url(h, ext) {
        let g = 0;
        if (h) {
            const hexStr = h.slice(-1) + h.slice(-3, -1);
            g = parseInt(hexStr, 16);
        }

        const m = m_map[g] !== undefined ? m_map[g] : m_default;
        const sub = (ext === 'avif' ? 'a' : 'w') + (1 + m);

        return "https://" + sub + ".gold-usergeneratedcontent.net/" + b_val + g + "/" + h + "." + ext;
    }

    // ---------------------------------------------------
    // PASO 2: DETALLES DE LA GALERÍA Y LISTA DE IMÁGENES
    // ---------------------------------------------------
    async getDetail(url) {
        const gid = url.replace(/[^0-9]/g, '');
        const res = await new Client().get("https://ltn.gold-usergeneratedcontent.net/galleries/" + gid + ".js");
        const body = typeof res.body === 'string' ? res.body : res.body.toString();

        const jsonString = body.split("var galleryinfo = ")[1];
        const data = JSON.parse(jsonString);

        return {
            title: data.title,
            imageUrl: "",
            desc: data.tags ? data.tags.map(t => t.tag).join(", ") : "Sin descripción",
            episodes: [{
                name: "Galería Completa",
                url: gid
            }]
        };
    }

    async getPageList(url) {
        const gid = url;
        const res = await new Client().get("https://ltn.gold-usergeneratedcontent.net/galleries/" + gid + ".js");
        const body = typeof res.body === 'string' ? res.body : res.body.toString();

        const jsonString = body.split("var galleryinfo = ")[1];
        const data = JSON.parse(jsonString);

        await this.load_gg();

        const pages = data.files.map(file => {
            const ext = file.hasavif ? 'avif' : 'webp';
            return this.get_url(file.hash, ext);
        });

        return pages;
    }

    // ---------------------------------------------------
    // PASO 3: BUSCADOR Y LECTURA DE ARCHIVOS .NOZOMI
    // ---------------------------------------------------
    async fetch_nozomi_ids(term) {
        term = term.replace(/_/g, " ").trim();
        let url = "";

        if (term.includes(":")) {
            let parts = term.split(":");
            let ns = parts[0];
            let v = parts[1];
            if (ns === "female" || ns === "male") {
                url = "https://ltn.gold-usergeneratedcontent.net/n/tag/" + term + "-all.nozomi";
            } else if (ns === "language") {
                url = "https://ltn.gold-usergeneratedcontent.net/n/index-" + v + ".nozomi";
            } else {
                url = "https://ltn.gold-usergeneratedcontent.net/n/" + ns + "/" + v + "-all.nozomi";
            }
        } else {
            url = "https://ltn.gold-usergeneratedcontent.net/n/tag/" + term + "-all.nozomi";
        }

        try {
            const res = await new Client().get(url);
            const body = typeof res.body === 'string' ? res.body : res.body.toString();
            let ids = new Set();

            for (let i = 0; i < body.length; i += 4) {
                let id = ((body.charCodeAt(i) & 0xff) << 24) |
                         ((body.charCodeAt(i+1) & 0xff) << 16) |
                         ((body.charCodeAt(i+2) & 0xff) << 8) |
                         (body.charCodeAt(i+3) & 0xff);
                ids.add(id);
            }
            return ids;
        } catch (error) {
            console.log("Error leyendo .nozomi: " + error);
            return new Set();
        }
    }

    intersectSets(setA, setB) {
        let intersection = new Set();
        for (let elem of setB) {
            if (setA.has(elem)) {
                intersection.add(elem);
            }
        }
        return intersection;
    }

    async getPopular(page) {
        const pageIndex = page - 1;
        const maxResults = 20;

        const idsSet = await this.fetch_nozomi_ids("language:spanish");
        const idsArray = Array.from(idsSet).sort((a, b) => b - a);

        const start = pageIndex * maxResults;
        const end = start + maxResults;
        const batchIds = idsArray.slice(start, end);

        const list = await Promise.all(batchIds.map(async (gid) => {
            try {
                const res = await new Client().get("https://ltn.gold-usergeneratedcontent.net/galleries/" + gid + ".js");
                const body = typeof res.body === 'string' ? res.body : res.body.toString();
                const jsonString = body.split("var galleryinfo = ")[1];
                const data = JSON.parse(jsonString);
                return {
                    name: data.title,
                    link: gid.toString(),
                    imageUrl: ""
                };
            } catch (e) {
                return { name: "ID: " + gid, link: gid.toString(), imageUrl: "" };
            }
        }));

        return {
            list: list,
            hasNextPage: end < idsArray.length
        };
    }

    async search(query, page, filters) {
        const parts = query.split(" ").filter(p => p.trim() !== "");
        if (parts.length === 0) return { list: [], hasNextPage: false };

        let results = await this.fetch_nozomi_ids(parts[0]);

        for (let i = 1; i < parts.length; i++) {
            if (results.size === 0) break;
            const nextResults = await this.fetch_nozomi_ids(parts[i]);
            results = this.intersectSets(results, nextResults);
        }

        const idsArray = Array.from(results).sort((a, b) => b - a);
        const pageIndex = page - 1;
        const maxResults = 20;
        const start = pageIndex * maxResults;
        const end = start + maxResults;
        const batchIds = idsArray.slice(start, end);

        const list = await Promise.all(batchIds.map(async (gid) => {
            try {
                const res = await new Client().get("https://ltn.gold-usergeneratedcontent.net/galleries/" + gid + ".js");
                const body = typeof res.body === 'string' ? res.body : res.body.toString();
                const jsonString = body.split("var galleryinfo = ")[1];
                const data = JSON.parse(jsonString);
                return {
                    name: data.title,
                    link: gid.toString(),
                    imageUrl: ""
                };
            } catch (e) {
                return { name: "ID: " + gid, link: gid.toString(), imageUrl: "" };
            }
        }));

        return {
            list: list,
            hasNextPage: end < idsArray.length
        };
    }
}
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'application/javascript',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
