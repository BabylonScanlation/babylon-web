// src/lib/newsStore.svelte.ts

// Astra + Orion: Store global usando Runes de Svelte 5
class NewsStore {
  #count = $state(0);
  #isLoading = $state(false);

  get count() {
    return this.#count;
  }
  get isLoading() {
    return this.#isLoading;
  }

  setCount(val: number) {
    this.#count = val;
  }

  async refreshCount(fetchFn: typeof fetch) {
    this.#isLoading = true;
    try {
      const res = await fetchFn('/api/news/count');
      if (res.ok) {
        const data = await res.json();
        // Validamos con Zod para seguridad extra
        if (typeof data.count === 'number') {
          this.#count = data.count;
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
