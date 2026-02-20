// src/lib/newsStore.svelte.ts

// Astra + Orion: Store global usando Runes de Svelte 5
class NewsStore {
  #count = $state(0);
  #isLoading = $state(false);

  constructor() {
    // Inicializar desde localStorage si existe (para evitar parpadeos)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('babylon_news_count');
      if (saved) this.#count = parseInt(saved) || 0;
    }
  }

  get count() {
    return this.#count;
  }
  get isLoading() {
    return this.#isLoading;
  }

  setCount(val: number) {
    this.#count = val;
    if (typeof window !== 'undefined') {
      localStorage.setItem('babylon_news_count', val.toString());
      // Notificar a otros sistemas (como el BottomNav)
      window.dispatchEvent(new CustomEvent('news-count-updated', { detail: { count: val } }));
    }
  }

  async refreshCount(fetchFn: typeof fetch) {
    // Orion: Si hay un bloqueo activo (acabamos de ver las noticias), ignorar refresco
    if (typeof window !== 'undefined' && (window as any).news_lock && Date.now() < (window as any).news_lock) {
      this.setCount(0);
      return;
    }

    this.#isLoading = true;
    try {
      const res = await fetchFn('/api/news/count');
      if (res.ok) {
        const data = await res.json();
        // Orion: Conversión robusta a número (maneja strings o numbers del JSON)
        const countValue = Number(data.count);
        if (!isNaN(countValue)) {
          this.setCount(countValue);
        }
      }
    } catch (err) {
      console.error('Error refreshing news count:', err);
    } finally {
      this.#isLoading = false;
    }
  }
}

export const newsStore = new NewsStore();
