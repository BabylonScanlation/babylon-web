<script lang="ts">
import { fade, fly } from 'svelte/transition';
import { actions } from 'astro:actions';
import {
  type AuthCredential,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { onMount } from 'svelte';
import { auth } from '../lib/firebase/client';
import { logError } from '../lib/logError';
import { authModal } from '../lib/modalStore.svelte';
import { toast } from '../lib/toastStore.svelte';

let loginEmail = $state('');
let loginPassword = $state('');
let regEmail = $state('');
let regPassword = $state('');
let regConfirmPassword = $state('');
let linkPassword = $state('');

let isLoading = $state(false);
let loginErrorMessage = $state('');
let registerErrorMessage = $state('');
let linkErrorMessage = $state('');

let showPassword = $state(false);

onMount(() => {
  const handleOpenModal = (event: Event) => {
    const customEvent = event as CustomEvent;
    const { view, message } = customEvent.detail || {};
    authModal.open(view || 'login', message);
  };

  window.addEventListener('open-auth-modal', handleOpenModal);

  // Global helper for non-Svelte components
  (
    window as Window & typeof globalThis & { openAuthModal: (view?: 'login' | 'register') => void }
  ).openAuthModal = (view: 'login' | 'register' = 'login') => {
    authModal.open(view);
  };

  return () => {
    window.removeEventListener('open-auth-modal', handleOpenModal);
  };
});

async function handleLogin() {
  isLoading = true;
  loginErrorMessage = '';

  if (!loginEmail || !loginPassword) {
    loginErrorMessage = 'Por favor, completa todos los campos.';
    isLoading = false;
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    const idToken = await userCredential.user.getIdToken();

    const { error } = await actions.auth.login({ idToken });

    if (!error) {
      document.dispatchEvent(new CustomEvent('auth-success'));
      toast.success('¡Bienvenido de nuevo!');
      authModal.close();
      // Orion: Forzar recarga para que el servidor genere el HTML sin anuncios (Admin privilege)
      setTimeout(() => window.location.reload(), 500);
    } else {
      throw new Error(error.message || 'Error del servidor al crear la sesión.');
    }
  } catch (error: any) {
    logError(error, 'Error durante el inicio de sesión con email/contraseña');
    loginErrorMessage = 'Credenciales incorrectas o usuario no encontrado.';
    toast.error(loginErrorMessage);
  } finally {
    isLoading = false;
  }
}

async function handleRegister() {
  isLoading = true;
  registerErrorMessage = '';

  if (!regEmail || !regPassword || !regConfirmPassword) {
    registerErrorMessage = 'Por favor, completa todos los campos.';
    isLoading = false;
    return;
  }
  if (regPassword !== regConfirmPassword) {
    registerErrorMessage = 'Las contraseñas no coinciden.';
    isLoading = false;
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, regEmail, regPassword);
    toast.success('¡Cuenta creada exitosamente! Por favor, inicia sesión.');
    authModal.open('login');
  } catch (error) {
    const err = error as { code?: string };
    logError(error, 'Error durante el registro de cuenta');
    let msg = '';
    if (err.code === 'auth/email-already-in-use') {
      msg = 'Este email ya está registrado.';
    } else if (err.code === 'auth/weak-password') {
      msg = 'La contraseña debe tener al menos 6 caracteres.';
    } else {
      msg = 'Error al registrar la cuenta.';
    }
    registerErrorMessage = msg;
    toast.error(msg);
  } finally {
    isLoading = false;
  }
}

function handleGoogleSignIn() {
  isLoading = true;
  const googleProvider = new GoogleAuthProvider();

  signInWithPopup(auth, googleProvider)
    .then(async (result) => {
      const idToken = await result.user.getIdToken();
      const { error } = await actions.auth.login({ idToken });

      if (!error) {
        document.dispatchEvent(new CustomEvent('auth-success'));
        toast.success('¡Sesión iniciada con Google!');
        authModal.close();
        // Orion: Sincronización instantánea del estado de administrador con el servidor
        setTimeout(() => window.location.reload(), 500);
      } else {
        throw new Error(error.message || 'Error del servidor al crear sesión.');
      }
    })
    .catch((error) => {
      logError(error, 'Error durante el inicio de sesión con Google');
      if (error.code === 'auth/account-exists-with-different-credential') {
        const email = error.customData?.email;
        const pendingCredential = error.credential as AuthCredential;
        toast.info(`Ya existe una cuenta para ${email}. Vinculala para continuar.`);
        authModal.openForLinking(email, pendingCredential);
      } else if (error.code !== 'auth/cancelled-popup-request') {
        console.error('Google Sign-In Error:', error);
        loginErrorMessage = `Error al iniciar sesión con Google: ${error.code} - ${error.message}`;
        toast.error(loginErrorMessage);
      }
    })
    .finally(() => {
      isLoading = false;
    });
}

async function handleLinkAccount() {
  isLoading = true;
  linkErrorMessage = '';

  const { email, pendingCredential } = authModal.linkAccountInfo;

  if (!pendingCredential || !email || !linkPassword) {
    linkErrorMessage = 'Faltan datos para vincular la cuenta.';
    isLoading = false;
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, linkPassword);
    await linkWithCredential(userCredential.user, pendingCredential);
    const idToken = await userCredential.user.getIdToken();
    const { error } = await actions.auth.login({ idToken });

    if (!error) {
      document.dispatchEvent(new CustomEvent('auth-success'));
      toast.success('¡Cuentas vinculadas exitosamente!');
      authModal.close();
      // Orion: Refresco total para aplicar el modo Admin sin publicidad
      setTimeout(() => window.location.reload(), 500);
    } else {
      throw new Error(error.message || 'Error al crear sesión después de vincular.');
    }
  } catch (error) {
    logError(error, 'Error durante la vinculación de cuenta');
    linkErrorMessage = 'Error al vincular: credenciales incorrectas o problema de red.';
    toast.error(linkErrorMessage);
  } finally {
    isLoading = false;
  }
}

function togglePassword() {
  showPassword = !showPassword;
}
</script>

{#if authModal.isOpen}
  <div class="modal-overlay" transition:fade={{ duration: 200 }} 
       onclick={() => authModal.close()} onkeydown={(e) => e.key === 'Escape' && authModal.close()} role="button" tabindex="-1">
    
    <div class="modal-panel auth-card" transition:fly={{ y: 20, duration: 300 }}>
      <button class="close-btn" onclick={() => authModal.close()} aria-label="Cerrar">×</button>

      {#if authModal.view === 'login'}
        <div class="auth-header">
          <h2>¡Bienvenido!</h2>
          <p>Inicia sesión para continuar con tu lectura.</p>
        </div>

        <div class="auth-body">
          <div class="social-auth">
            <button class="btn btn-google" onclick={handleGoogleSignIn} disabled={isLoading}>
              <img src="https://static.cdnlogo.com/logos/g/35/google-icon.svg" alt="Google" class="google-icon" />
              <span>Continuar con Google</span>
            </button>
          </div>

          <div class="divider">
            <span>o usa tu correo</span>
          </div>

          <form onsubmit={(e) => { e.preventDefault(); handleLogin(); }} class="auth-form">
            <div class="form-group">
              <label for="login-email">Email</label>
              <input id="login-email" type="email" bind:value={loginEmail} placeholder="tu@email.com" required />
            </div>
            
            <div class="form-group">
              <label for="login-pass">Contraseña</label>
              <div class="password-input-wrapper">
                <input id="login-pass" type={showPassword ? 'text' : 'password'} bind:value={loginPassword} placeholder="••••••••" required />
                <button type="button" class="toggle-pass" onclick={togglePassword}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {#if loginErrorMessage}
              <p class="error-msg" in:fade>{loginErrorMessage}</p>
            {/if}

            <button type="submit" class="btn btn-primary btn-submit" disabled={isLoading}>
              {#if isLoading}
                <span class="spinner"></span>
              {:else}
                Entrar
              {/if}
            </button>
          </form>
        </div>

        <div class="auth-footer">
          ¿No tienes cuenta? 
          <button class="link-btn" onclick={() => authModal.open('register')}>Regístrate</button>
        </div>

      {:else if authModal.view === 'register'}
        <div class="auth-header">
          <h2>Crear Cuenta</h2>
          <p>Únete a nuestra comunidad de lectores.</p>
        </div>

        <div class="auth-body">
          <form onsubmit={(e) => { e.preventDefault(); handleRegister(); }} class="auth-form">
            <div class="form-group">
              <label for="reg-email">Email</label>
              <input id="reg-email" type="email" bind:value={regEmail} placeholder="tu@email.com" required />
            </div>
            
            <div class="form-group">
              <label for="reg-pass">Contraseña</label>
              <input id="reg-pass" type="password" bind:value={regPassword} placeholder="Mínimo 6 caracteres" required />
            </div>

            <div class="form-group">
              <label for="reg-pass-conf">Confirmar Contraseña</label>
              <input id="reg-pass-conf" type="password" bind:value={regConfirmPassword} placeholder="Repite tu contraseña" required />
            </div>

            {#if registerErrorMessage}
              <p class="error-msg" in:fade>{registerErrorMessage}</p>
            {/if}

            <button type="submit" class="btn btn-primary btn-submit" disabled={isLoading}>
              {#if isLoading}
                <span class="spinner"></span>
              {:else}
                Crear Cuenta
              {/if}
            </button>
          </form>
        </div>

        <div class="auth-footer">
          ¿Ya tienes cuenta? 
          <button class="link-btn" onclick={() => authModal.open('login')}>Inicia Sesión</button>
        </div>

      {:else if authModal.view === 'link-account'}
        <div class="auth-header">
          <h2>Vincular Cuentas</h2>
          <p>Ingresa tu contraseña para vincular <strong>{authModal.linkAccountInfo.email}</strong>.</p>
        </div>

        <div class="auth-body">
          <form onsubmit={(e) => { e.preventDefault(); handleLinkAccount(); }} class="auth-form">
            <div class="form-group">
              <label for="link-pass">Contraseña</label>
              <input id="link-pass" type="password" bind:value={linkPassword} placeholder="Tu contraseña actual" required />
            </div>

            {#if linkErrorMessage}
              <p class="error-msg" in:fade>{linkErrorMessage}</p>
            {/if}

            <button type="submit" class="btn btn-primary btn-submit" disabled={isLoading}>
              {#if isLoading}
                <span class="spinner"></span>
              {:else}
                Vincular y Continuar
              {/if}
            </button>
          </form>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .auth-card {
    background: #15151a;
    width: 100%;
    max-width: 420px;
    padding: 2.5rem;
    border-radius: 32px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    position: relative;
  }

  .close-btn {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    color: #888;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .auth-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .auth-header h2 {
    font-size: 1.8rem;
    font-weight: 900;
    margin-bottom: 0.5rem;
    letter-spacing: -0.02em;
  }

  .auth-header p {
    color: #888;
    font-size: 0.95rem;
  }

  .btn {
    width: 100%;
    padding: 0.8rem;
    border-radius: 14px;
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    border: none;
  }

  .btn-google {
    background: white;
    color: #000;
  }

  .btn-google:hover {
    background: #f0f0f0;
    transform: translateY(-2px);
  }

  .google-icon {
    width: 20px;
    height: 20px;
  }

  .divider {
    display: flex;
    align-items: center;
    margin: 1.5rem 0;
    color: #444;
    font-size: 0.8rem;
    text-transform: uppercase;
    font-weight: 800;
    letter-spacing: 0.05em;
  }

  .divider::before, .divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: #222;
  }

  .divider span {
    padding: 0 1rem;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    font-size: 0.85rem;
    font-weight: 700;
    color: #aaa;
    margin-bottom: 0.5rem;
    margin-left: 0.25rem;
  }

  input {
    width: 100%;
    background: #000;
    border: 1px solid #222;
    padding: 0.9rem 1.2rem;
    border-radius: 14px;
    color: white;
    font-family: inherit;
    outline: none;
    transition: all 0.2s;
  }

  input:focus {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 4px rgba(0, 191, 255, 0.1);
  }

  .password-input-wrapper {
    position: relative;
  }

  .toggle-pass {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .toggle-pass:hover {
    opacity: 1;
  }

  .btn-primary {
    background: var(--accent-color);
    color: #000;
    margin-top: 1rem;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(0, 191, 255, 0.2);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-msg {
    color: #ff4757;
    font-size: 0.85rem;
    font-weight: 600;
    margin-top: 0.75rem;
    text-align: center;
  }

  .auth-footer {
    text-align: center;
    margin-top: 2rem;
    color: #666;
    font-size: 0.9rem;
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--accent-color);
    font-weight: 800;
    cursor: pointer;
    padding: 0.25rem;
  }

  .link-btn:hover {
    text-decoration: underline;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-top-color: #000;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 480px) {
    .modal-overlay {
      padding: 1rem;
      align-items: center; 
    }
    .auth-card {
      padding: 2rem 1.5rem;
      border-radius: 24px;
      height: auto;
      max-height: 90vh;
      overflow-y: auto;
    }
  }
</style>
