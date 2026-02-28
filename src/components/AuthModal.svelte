<script lang="ts">
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
import { fade, fly } from 'svelte/transition';
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

// Astra: Sincronizar estado del body con el modal para ocultar el header
$effect(() => {
  if (authModal.isOpen) {
    document.body.setAttribute('data-reader-modal', 'open');
    document.documentElement.style.overflow = 'hidden';
  } else {
    document.body.removeAttribute('data-reader-modal');
    document.documentElement.style.overflow = '';
  }
});
</script>

{#if authModal.isOpen}
  <div class="modal-overlay" 
    onclick={(e) => e.target === e.currentTarget && authModal.close()} 
    onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && authModal.close()}
    role="button" 
    aria-label="Cerrar modal" 
    tabindex="-1"
    transition:fade={{ duration: 200 }}>
    
    <div class="modal-panel auth-card" transition:fly={{ y: 20, duration: 300 }}>
      <button class="close-btn" onclick={() => authModal.close()} aria-label="Cerrar">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>

      <div class="auth-content">
        {#if authModal.view === 'login'}
          <div in:fly={{ x: -20, duration: 300, delay: 150 }}>
            <div class="auth-header">
              <h2>Bienvenido</h2>
              <p class="subtitle">Ingresa tus credenciales para continuar</p>
            </div>
            
            <div class="message-container">
              {#if authModal.successMessage}
                <p class="alert alert-success" transition:fade>{authModal.successMessage}</p>
              {/if}
              {#if loginErrorMessage}
                <p class="alert alert-danger" transition:fade>{loginErrorMessage}</p>
              {/if}
            </div>

            <form onsubmit={(e) => { e.preventDefault(); handleLogin(); }} class="auth-form">
              <div class="form-group">
                <label class="form-label" for="login-email">Email</label>
                <div class="input-wrapper">
                  <input class="form-control" type="email" id="login-email" placeholder="nombre@ejemplo.com" required bind:value={loginEmail} autocomplete="username" />
                </div>
              </div>
              
              <div class="form-group">
                <div class="label-row">
                  <label class="form-label" for="login-password">Contraseña</label>
                  <span class="forgot-password" role="button" tabindex="0" onclick={() => toast.info('Funcionalidad de recuperación en desarrollo')} onkeydown={(e) => e.key === 'Enter' && toast.info('Funcionalidad de recuperación en desarrollo')}>¿Olvidaste tu contraseña?</span>
                </div>
                <div class="input-wrapper">
                  <input class="form-control" type={showPassword ? "text" : "password"} id="login-password" placeholder="••••••••" required bind:value={loginPassword} autocomplete="current-password" />
                  <button type="button" class="password-toggle" onclick={togglePassword}>
                    {#if showPassword}
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    {:else}
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    {/if}
                  </button>
                </div>
              </div>

              <button type="submit" class="btn btn-primary btn-submit" disabled={isLoading}>
                {#if isLoading}
                  <div class="button-loader"></div>
                {:else}
                  <span class="button-text">Iniciar Sesión</span>
                {/if}
              </button>
            </form>

            <div class="divider"></div>

            <button class="btn btn-google" onclick={handleGoogleSignIn} disabled={isLoading}>
              <img src="https://static.cdnlogo.com/logos/g/35/google-icon.svg" alt="Google" class="google-icon" />
              Iniciar sesión con Google
            </button>

            <div class="form-footer">
              <p>¿No tienes una cuenta? <button class="btn-link" onclick={() => authModal.switchTo('register')} disabled={isLoading}>Regístrate gratis</button></p>
            </div>
          </div>
        {/if}

        {#if authModal.view === 'register'}
          <div in:fly={{ x: 20, duration: 300, delay: 150 }}>
            <div class="auth-header">
              <h2>Crear Cuenta</h2>
              <p class="subtitle">Únete a nuestra comunidad hoy mismo</p>
            </div>

            <div class="message-container">
              {#if registerErrorMessage}
                <p class="alert alert-danger" transition:fade>{registerErrorMessage}</p>
              {/if}
            </div>

            <form onsubmit={(e) => { e.preventDefault(); handleRegister(); }} class="auth-form">
              <div class="form-group">
                <label class="form-label" for="reg-email">Email</label>
                <div class="input-wrapper">
                  <input class="form-control" type="email" id="reg-email" placeholder="nombre@ejemplo.com" required bind:value={regEmail} autocomplete="username" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="reg-password">Contraseña</label>
                <div class="input-wrapper">
                  <input class="form-control" type={showPassword ? "text" : "password"} id="reg-password" placeholder="Mínimo 6 caracteres" required minlength="6" bind:value={regPassword} autocomplete="new-password" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="reg-confirm-password">Confirmar Contraseña</label>
                <div class="input-wrapper">
                  <input class="form-control" type={showPassword ? "text" : "password"} id="reg-confirm-password" placeholder="Repite tu contraseña" required minlength="6" bind:value={regConfirmPassword} autocomplete="new-password" />
                </div>
              </div>

              <button type="submit" class="btn btn-primary btn-submit" disabled={isLoading}>
                {#if isLoading}
                  <div class="button-loader"></div>
                {:else}
                  <span class="button-text">Crear Cuenta</span>
                {/if}
              </button>
            </form>

            <div class="divider"></div>

            <button class="btn btn-google" onclick={handleGoogleSignIn} disabled={isLoading}>
              <img src="https://static.cdnlogo.com/logos/g/35/google-icon.svg" alt="Google" class="google-icon" />
              Iniciar sesión con Google
            </button>

            <div class="form-footer">
              <p>¿Ya tienes una cuenta? <button class="btn-link" onclick={() => authModal.switchTo('login')} disabled={isLoading}>Inicia sesión</button></p>
            </div>
          </div>
        {/if}

        {#if authModal.view === 'link'}
          <div in:fly={{ y: 20, duration: 300, delay: 150 }}>
            <div class="auth-header">
              <h2>Vincular Cuenta</h2>
              <p class="subtitle">Tu correo ya está registrado. Ingresa tu contraseña para vincular con Google.</p>
            </div>

            <div class="message-container">
              {#if linkErrorMessage}
                <p class="alert alert-danger" transition:fade>{linkErrorMessage}</p>
              {/if}
            </div>

            <form onsubmit={(e) => { e.preventDefault(); handleLinkAccount(); }} class="auth-form">
              <div class="form-group">
                <label class="form-label" for="link-email">Email</label>
                <div class="input-wrapper">
                  <input class="form-control disabled-input" type="email" id="link-email" readonly value={authModal.linkAccountInfo.email} />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="link-password">Contraseña</label>
                <div class="input-wrapper">
                  <input class="form-control" type={showPassword ? "text" : "password"} id="link-password" placeholder="••••••••" required bind:value={linkPassword} autocomplete="current-password" />
                </div>
              </div>

              <button type="submit" class="btn btn-primary btn-submit" disabled={isLoading}>
                {#if isLoading}
                  <div class="button-loader"></div>
                {:else}
                  <span class="button-text">Vincular y Continuar</span>
                {/if}
              </button>
            </form>

            <div class="form-footer">
              <button class="btn-link" onclick={authModal.close} disabled={isLoading}>Cancelar</button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: #020205;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 1rem;
  }

  .auth-card {
    position: relative;
    padding: 2.5rem 2.5rem;
    width: 100%;
    max-width: 450px;
    margin: auto;
    background: rgba(20, 20, 25, 0.85);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 28px;
    box-shadow: 
      0 25px 60px -15px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset;
    overflow: hidden;
  }

  .close-btn {
    position: absolute;
    top: 1.25rem;
    right: 1.25rem;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    color: #999;
    padding: 0.4rem;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    transform: rotate(90deg);
  }

  .auth-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .auth-header h2 {
    font-size: 1.8rem;
    font-weight: 900;
    margin: 0 0 0.4rem 0;
    background: linear-gradient(135deg, #fff 0%, #aaa 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.02em;
  }

  .subtitle {
    color: #888;
    font-size: 0.85rem;
    margin: 0;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .forgot-password {
    font-size: 0.7rem;
    color: var(--accent-color);
    cursor: pointer;
    font-weight: 500;
  }

  .forgot-password:hover {
    text-decoration: underline;
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .form-control {
    width: 100%;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    color: #fff;
    font-size: 0.95rem;
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  }

  .form-control:focus {
    outline: none;
    border-color: var(--accent-color);
    background: rgba(255, 255, 255, 0.06);
    box-shadow: 0 0 0 4px rgba(0, 191, 255, 0.15);
    transform: translateY(-1px);
  }

  .disabled-input {
    background: rgba(255, 255, 255, 0.05);
    color: #666;
    cursor: not-allowed;
  }

  .password-toggle {
    position: absolute;
    right: 1rem;
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    transition: color 0.2s;
  }

  .password-toggle:hover {
    color: #aaa;
  }

  .btn-submit {
    width: 100%;
    margin-top: 0.5rem;
    padding: 1.1rem;
    border-radius: 16px;
    font-size: 1rem;
    font-weight: 800;
    background: var(--accent-color);
    box-shadow: 0 10px 25px -5px rgba(0, 162, 255, 0.4);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    border: none;
    color: #000;
    cursor: pointer;
  }

  .btn-submit:hover:not(:disabled) {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 15px 35px -5px rgba(0, 162, 255, 0.5);
  }

  .btn-submit:active:not(:disabled) {
    transform: translateY(0);
  }

  .divider {
    margin: 1.5rem 0;
    text-align: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    line-height: 0.1em;
  }

  .btn-google {
    width: 100%;
    background: rgba(255, 255, 255, 0.03);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 1.1rem;
    border-radius: 18px;
    font-weight: 700;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .btn-google:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(0,0,0,0.4);
  }

  .google-icon {
    width: 22px;
    height: 22px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
  }

  .form-footer {
    margin-top: 2rem;
    text-align: center;
    color: #888;
    font-size: 0.9rem;
  }

  .btn-link {
    color: var(--accent-color);
    font-weight: 600;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    transition: color 0.2s;
  }

  .btn-link:hover {
    color: #33b5ff;
    text-decoration: underline;
  }

  .button-loader {
    width: 20px;
    height: 20px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .message-container {
    min-height: 0;
    margin-bottom: 1rem;
  }

  .alert {
    padding: 0.75rem 1rem;
    border-radius: 12px;
    font-size: 0.85rem;
    text-align: center;
  }

  .alert-danger {
    background: rgba(255, 107, 107, 0.15);
    color: #ff8e8e;
    border: 1px solid rgba(255, 107, 107, 0.2);
  }

  .alert-success {
    background: rgba(46, 204, 113, 0.15);
    color: #72f1a6;
    border: 1px solid rgba(46, 204, 113, 0.2);
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
