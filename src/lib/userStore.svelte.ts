import { auth } from './firebase/client';
import { onAuthStateChanged } from 'firebase/auth';

// Orion: Store de Identidad Reactivo (Estandarizado a avatarUrl)
class UserStore {
  user = $state<any>(null);
  loading = $state(true);
  initialized = $state(false);

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Orion: No sobreescribimos con avatarUrl: null inmediatamente
        // para permitir que el fallback de SSR (initialUser) siga funcionando
        // hasta que tengamos los datos reales de D1.
        if (!this.user) {
          this.user = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName
            // avatarUrl queda undefined aquí
          };
        }
        await this.sync();
      } else {
        this.user = null;
        this.loading = false;
      }
      this.initialized = true;
    });
  }

  async sync() {
    try {
      const res = await fetch(`/api/auth/status?t=${Date.now()}`);
      if (res.ok) {
        const dbUser = await res.json();
        
        // Orion: Si el servidor dice que no hay sesión, pero tenemos usuario Firebase,
        // intentamos re-crear la sesión automáticamente (Auto-Session Recovery)
        if (!dbUser && this.user && auth.currentUser) {
            console.log('[UserStore] Session expired or missing. Attempting auto-recovery...');
            const idToken = await auth.currentUser.getIdToken();
            const sessionRes = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
            });
            if (sessionRes.ok) {
                console.log('[UserStore] Session recovered successfully.');
                return this.sync(); // Re-sincronizar tras recuperar sesión
            }
        }

        if (dbUser && this.user) {
          // Reasignación total para disparar reactividad profunda
          this.user = {
            ...this.user,
            ...dbUser,
            // Solo actualizamos avatarUrl si el servidor nos da algo tangible
            avatarUrl: dbUser.avatarUrl || this.user.avatarUrl || null
          };
        }
      }
    } catch (e) {
      console.error('[UserStore] Error sync', e);
    } finally {
      this.loading = false;
    }
  }
}

export const userStore = new UserStore();
