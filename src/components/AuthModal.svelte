<script lang="ts">
import { fade, fly } from 'svelte/transition';
import { logError } from '../lib/logError';
import { authModal, toast } from '../lib/stores.svelte';

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

// Orion: Carga ultra-perezosa. Nada se baja hasta el clic.
async function getFullAuthStack() {
  const [{ getClientAuth }, firebaseAuth, { actions }] = await Promise.all([
    import('../lib/firebase/client'),
    import('firebase/auth'),
    import('astro:actions'),
  ]);
  const auth = await getClientAuth();
  return { auth, actions, ...firebaseAuth };
}

async function handleLogin() {
  isLoading = true;
  loginErrorMessage = '';

  if (!loginEmail || !loginPassword) {
    loginErrorMessage = 'Por favor, completa todos los campos.';
    isLoading = false;
    return;
  }

  try {
    const { auth, actions, signInWithEmailAndPassword } = await getFullAuthStack();
    const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    const idToken = await userCredential.user.getIdToken();

    const { error } = await actions.auth.login({ idToken });

    if (!error) {
      window.dispatchEvent(new CustomEvent('auth-success'));
      toast.success('¡Bienvenido de nuevo!');
      authModal.close();
      setTimeout(() => window.location.reload(), 500);
    } else {
      throw new Error(error.message || 'Error del servidor');
    }
  } catch (error: any) {
    logError(error, 'Login error');
    loginErrorMessage = 'Credenciales incorrectas.';
    toast.error(loginErrorMessage);
  } finally {
    isLoading = false;
  }
}

async function handleRegister() {
  isLoading = true;
  registerErrorMessage = '';

  try {
    const { auth, createUserWithEmailAndPassword } = await getFullAuthStack();
    await createUserWithEmailAndPassword(auth, regEmail, regPassword);
    toast.success('Cuenta creada. Inicia sesión.');
    authModal.switchTo('login');
  } catch (error: any) {
    logError(error, 'Register error');
    registerErrorMessage = 'Error al registrar.';
    toast.error(registerErrorMessage);
  } finally {
    isLoading = false;
  }
}

async function handleGoogleSignIn() {
  isLoading = true;
  try {
    const { auth, actions, GoogleAuthProvider, signInWithPopup } = await getFullAuthStack();
    const googleProvider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    const { error } = await actions.auth.login({ idToken });

    if (!error) {
      window.dispatchEvent(new CustomEvent('auth-success'));
      toast.success('¡Sesión iniciada!');
      authModal.close();
      setTimeout(() => window.location.reload(), 500);
    }
  } catch (error: any) {
    logError(error, 'Google error');
    toast.error('Error con Google');
  } finally {
    isLoading = false;
  }
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
    const { auth, actions, signInWithEmailAndPassword, linkWithCredential } =
      await getFullAuthStack();
    const userCredential = await signInWithEmailAndPassword(auth, email, linkPassword);
    await linkWithCredential(userCredential.user, pendingCredential);
    const idToken = await userCredential.user.getIdToken();
    const { error } = await actions.auth.login({ idToken });

    if (!error) {
      window.dispatchEvent(new CustomEvent('auth-success'));
      toast.success('¡Cuentas vinculadas exitosamente!');
      authModal.close();
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
  if (typeof document !== 'undefined') {
    if (authModal.isOpen) {
      document.body.setAttribute('data-reader-modal', 'open');
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.removeAttribute('data-reader-modal');
      document.documentElement.style.overflow = '';
    }
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
