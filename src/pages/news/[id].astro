---
import Layout from '../../layouts/Layout.astro';
import { SITE_TITLE } from '../../consts';

const { id } = Astro.params;

const response = await fetch(`${Astro.url.origin}/api/news/${id}`);
const newsItem = response.ok ? await response.json() : null;

if (!newsItem) {
  return Astro.redirect('/news'); // Redirect to news list if not found
}
---

<Layout title={`${newsItem.title} - Noticias - ${SITE_TITLE}`}>
  <main class="container mx-auto p-4">
    <article class="bg-white shadow-md rounded-lg p-6">
      <h1 class="text-4xl font-bold mb-4 text-gray-900">{newsItem.title}</h1>
      <p class="text-sm text-gray-600 mb-6">
        Publicado por {newsItem.publishedBy} el {new Date(newsItem.createdAt).toLocaleDateString()}
      </p>

      {newsItem.imageUrls && newsItem.imageUrls.length > 0 && (
        <div class="mb-6">
          <img src={newsItem.imageUrls[0]} alt={newsItem.title} class="w-full h-96 object-cover rounded-lg" />
        </div>
      )}

      <div class="prose prose-lg max-w-none text-gray-800">
        <p>{newsItem.content}</p>
      </div>

      <div class="mt-8">
        <a href="/news" class="inline-flex items-center text-indigo-600 hover:text-indigo-800">
          Volver a Noticias
        </a>
      </div>
    </article>
  </main>
</Layout>