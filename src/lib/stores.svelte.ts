// src/lib/stores.svelte.ts
import { actions } from 'astro:actions';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/client';
import { generateUUID } from './utils';

// 1. AUTH MODAL STORE
class AuthModalStore {
  #state = $state({ isOpen: false, view: 'login' as any, successMessage: '', linkAccountInfo: { email: null, pendingCredential: undefined } });
  get isOpen() { return this.#state.isOpen; }
  get view() { return this.#state.view; }
  get successMessage() { return this.#state.successMessage; }
  get linkAccountInfo() { return this.#state.linkAccountInfo; }
  open(view: any = 'login', msg = '') { this.#state.isOpen = true; this.#state.view = view; this.#state.successMessage = msg; }
  close() { this.#state.isOpen = false; }
  switchTo(v: any) { this.#state.view = v; }
}
export const authModal = new AuthModalStore();

// 2. TOAST STORE
class ToastStore {
  #toasts = $state<any[]>([]);
  get messages() { return this.#toasts; }
  add(type: string, message: string, duration = 4000) {
    const id = generateUUID();
    this.#toasts.push({ id, type, message });
    if (duration > 0) setTimeout(() => this.remove(id), duration);
  }
  remove(id: string) { this.#toasts = this.#toasts.filter(t => t.id !== id); }
  success(m: string) { this.add('success', m); }
  error(m: string) { this.add('error', m); }
}
export const toast = new ToastStore();

// 3. USER STORE
class UserStore {
  user = $state<any>(null);
  loading = $state(true);
  constructor() { if (typeof window !== 'undefined') this.init(); }
  private init() {
    onAuthStateChanged(auth, async (fb) => {
      if (fb) { this.user = { uid: fb.uid, email: fb.email }; await this.sync(); }
      else { this.user = null; this.loading = false; }
    });
  }
  async sync() {
    try {
      const res = await fetch(`/api/auth/status?t=${Date.now()}`);
      if (res.ok) { this.user = await res.json(); }
    } catch (e) { console.error(e); }
    finally { this.loading = false; }
  }
}
export const userStore = new UserStore();

// 4. NEWS STORE
class NewsStore {
  #count = $state(0);
  constructor() { if (typeof window !== 'undefined') { const s = localStorage.getItem('babylon_news_count'); if (s) this.#count = parseInt(s, 10); } }
  get count() { return this.#count; }
  setCount(v: number) { this.#count = v; localStorage.setItem('babylon_news_count', v.toString()); window.dispatchEvent(new CustomEvent('news-count-updated', { detail: { count: v } })); }
  async refreshCount(f: any) {
    try {
      const res = await f('/api/news/count');
      if (res.ok) { const d = await res.json(); this.setCount(Number(d.count)); }
    } catch (e) {}
  }
}
export const newsStore = new NewsStore();
