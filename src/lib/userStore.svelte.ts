import { actions } from 'astro:actions';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/client';

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
      this.loading = true;
      if (fbUser) {
        // Orion: Restaurado el Fallback Visual.
        // Asignamos datos básicos inmediatamente para que la UI no parpadee a "desconectado"
        // mientras esperamos la confirmación de la sesión en D1.
        if (!this.user) {
          this.user = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
            // avatarUrl queda undefined intencionalmente hasta el sync
          };
        }
        await this.sync(fbUser);
      } else {
        this.user = null;
        this.loading = false;
      }
      this.initialized = true;
    });
  }

  async sync(fbUser?: any): Promise<void> {
    const currentUser = fbUser || auth.currentUser;
    if (!currentUser) {
      this.user = null;
      this.loading = false;
      return;
    }

    try {
      const res = await fetch(`/api/auth/status?t=${Date.now()}`);

      if (res.ok) {
        const dbUser = await res.json();

        // Orion: Auto-Session Recovery (Solo si el servidor no tiene sesión pero Firebase sí)
        if (!dbUser && currentUser) {
          console.log('[UserStore] Session missing. Attempting auto-recovery...');
          const idToken = await currentUser.getIdToken();
          const { error } = await actions.auth.login({ idToken });

          if (!error) {
            // Reintento silencioso
            return this.sync(currentUser);
          }
        }

        if (dbUser) {
          this.user = {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: dbUser.displayName || currentUser.displayName,
            ...dbUser,
            avatarUrl: dbUser.avatarUrl || null,
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
