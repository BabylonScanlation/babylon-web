// src/lib/stores.svelte.ts
import { generateUUID } from './utils';

interface AuthModalState {
  isOpen: boolean;
  view: string;
  successMessage: string;
  linkAccountInfo: { email: string | null; pendingCredential: any };
}

// 1. AUTH MODAL STORE
class AuthModalStore {
  state: AuthModalState = $state({
    isOpen: false,
    view: 'login',
    successMessage: '',
    linkAccountInfo: { email: null, pendingCredential: undefined },
  });

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('open-auth-modal', (e: any) => {
        this.open(e.detail?.view || 'login', e.detail?.message || '');
      });
    }
  }

  get isOpen() {
    return this.state.isOpen;
  }
  get view() {
    return this.state.view;
  }
  get successMessage() {
    return this.state.successMessage;
  }
  get linkAccountInfo() {
    return this.state.linkAccountInfo;
  }
  open(view: any = 'login', msg = '') {
    this.state.isOpen = true;
    this.state.view = view;
    this.state.successMessage = msg;
  }
  close() {
    this.state.isOpen = false;
  }
  switchTo(v: any) {
    this.state.view = v;
  }
  openForLinking(email: string, pendingCredential: any) {
    this.state.isOpen = true;
    this.state.view = 'link';
    this.state.linkAccountInfo = { email, pendingCredential };
  }
}
export const authModal = new AuthModalStore();

// 2. TOAST STORE
class ToastStore {
  #toasts = $state<any[]>([]);
  get messages() {
    return this.#toasts;
  }
  add(type: string, message: string, duration = 4000) {
    const id = generateUUID();
    this.#toasts.push({ id, type, message });
    if (duration > 0) setTimeout(() => this.remove(id), duration);
  }
  remove(id: string) {
    this.#toasts = this.#toasts.filter((t) => t.id !== id);
  }
  success(m: string) {
    this.add('success', m);
  }
  info(m: string) {
    this.add('info', m);
  }
  error(m: string) {
    this.add('error', m);
  }
  warning(m: string) {
    this.add('warning', m);
  }
}
export const toast = new ToastStore();

// 3. USER STORE (Strictly Reactive - No automatic Firebase init)
class UserStore {
  user = $state<any>(null);
  loading = $state(true);

  constructor() {
    if (typeof window !== 'undefined') {
      // Sincronizar estado inicial desde el servidor (inyectado en el body)
      const serverState = document.body.getAttribute('data-user-state');
      if (serverState && serverState !== 'null') {
        try {
          this.user = JSON.parse(serverState);
        } catch {
          console.error('Error parsing server user state');
        }
      }
      this.loading = false;
    }
  }

  // Orion: Solo llamamos a esto después de un login exitoso o acción explícita
  async initFirebaseListener() {
    try {
      const { getClientAuth } = await import('./firebase/client');
      const auth = await getClientAuth();
      const { onAuthStateChanged } = await import('firebase/auth');

      onAuthStateChanged(auth, async (fb) => {
        if (fb) {
          this.user = { uid: fb.uid, email: fb.email };
          await this.sync();
        } else {
          this.user = null;
        }
      });
    } catch (e) {
      console.error('Firebase lazy init error:', e);
    }
  }

  async sync() {
    try {
      const res = await fetch(`/api/auth/status?t=${Date.now()}`);
      if (res.ok) {
        this.user = await res.json();
      }
    } catch (e) {
      console.error(e);
    }
  }
}
export const userStore = new UserStore();

// 4. NEWS STORE
class NewsStore {
  #count = $state(0);
  #lastUpdated = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('babylon_news_count');
      if (s) this.#count = parseInt(s, 10);
      const lu = localStorage.getItem('babylon_news_last_updated');
      if (lu) this.#lastUpdated = parseInt(lu, 10);
    }
  }
  get count() {
    return this.#count;
  }
  setCount(v: number) {
    this.#count = v;
    this.#lastUpdated = Date.now();
    localStorage.setItem('babylon_news_count', v.toString());
    localStorage.setItem('babylon_news_last_updated', this.#lastUpdated.toString());
    window.dispatchEvent(new CustomEvent('news-count-updated', { detail: { count: v } }));
  }
  async refreshCount(f: any, force = false) {
    // Orion: Solo refrescar si han pasado más de 5 minutos o si se fuerza
    const now = Date.now();
    if (!force && now - this.#lastUpdated < 300000) {
      return;
    }

    try {
      const res = await f('/api/news/count');
      if (res.ok) {
        const d = await res.json();
        this.setCount(Number(d.count));
      }
    } catch {
      // Ignoramos errores de red silenciosamente
    }
  }
}
export const newsStore = new NewsStore();
