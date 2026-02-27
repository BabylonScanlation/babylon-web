import { $state } from 'svelte/runes';

class NsfwStore {
  isEnabled = $state(false);

  constructor() {
    if (typeof window !== 'undefined') {
      const cookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith('nsfw='));
      this.isEnabled = cookie ? cookie.split('=')[1] === 'true' : false;
    }
  }

  toggle() {
    this.isEnabled = !this.isEnabled;
    if (typeof window !== 'undefined') {
      document.cookie = `nsfw=${this.isEnabled}; path=/; max-age=31536000`; // 1 year
      // Astra: Feedback visual inmediato y recarga para refrescar contenido SSR
      window.location.reload();
    }
  }
}

export const nsfwStore = new NsfwStore();
