// src/lib/news-service.ts
/**
 * NewsService V4: Estándar Unificado
 */

const KEYS = {
  COUNT: `babylon_news_count`,
  ID: `last_news_id`,
};

export class NewsService {
  private static instance: NewsService;

  private constructor() {
    this.init();
  }

  public static getInstance(): NewsService {
    if (!NewsService.instance) {
      NewsService.instance = new NewsService();
    }
    return NewsService.instance;
  }

  private init() {
    if (typeof window === 'undefined') return;

    this.syncWithServer();

    window.addEventListener('new-news-created', () => {
      const current = parseInt(localStorage.getItem(KEYS.COUNT) || '0', 10);
      localStorage.setItem(KEYS.COUNT, (current + 1).toString());
      this.updateUI();
    });

    document.addEventListener('astro:page-load', () => {
      this.syncWithServer();
      this.updateUI();
    });

    window.addEventListener('news-count-updated', (e: any) => {
      localStorage.setItem(KEYS.COUNT, e.detail.count.toString());
      this.updateUI();
    });

    this.updateUI();
  }

  private async syncWithServer() {
    const serverCount = document.body.getAttribute('data-unread-count');
    if (serverCount !== null) {
      localStorage.setItem(KEYS.COUNT, serverCount);
      this.updateUI();
    } else {
      // Orion: Si no hay dato en el body, consultamos la API centralizada
      try {
        const res = await fetch('/api/news/count');
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem(KEYS.COUNT, data.count.toString());
          this.updateUI();
        }
      } catch (_e) {
        // Silencioso en producción
      }
    }
  }

  public updateUI() {
    if (typeof window === 'undefined') return;
    const isNewsPage = window.location.pathname.startsWith('/news');
    const badges = document.querySelectorAll('[data-news-badge]');

    if (isNewsPage) {
      localStorage.setItem(KEYS.COUNT, '0');
      badges.forEach((el) => el.classList.add('hidden'));
      return;
    }

    const count = parseInt(localStorage.getItem(KEYS.COUNT) || '0', 10);
    badges.forEach((el) => {
      if (count > 0) {
        el.textContent = count > 9 ? '+9' : count.toString();
        el.classList.remove('hidden');
        (el as HTMLElement).style.display = 'flex';
      } else {
        el.classList.add('hidden');
      }
    });
  }
}
