<script lang="ts">
  import { authModal } from '../lib/modalStore';
  import { auth } from '../lib/firebase/client';
  import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    linkWithCredential,
    type AuthCredential,
  } from 'firebase/auth';
  import { logError } from '../lib/logError';

  // --- Svelte Component State ---
  let loginEmail = '';
  let loginPassword = '';
  let regEmail = '';
  let regPassword = '';
  let regConfirmPassword = '';
  let linkPassword = '';

  let isLoading = false;
  let loginErrorMessage = '';
  let registerErrorMessage = '';
  let linkErrorMessage = '';
  
  // --- Firebase Logic translated to Svelte functions ---
  
  // This function is called when the form is submitted
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
      
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (response.ok) {
        document.dispatchEvent(new CustomEvent('auth-success'));
        authModal.close();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error del servidor al crear la sesión.');
      }
    } catch (error) {
      logError(error, 'Error durante el inicio de sesión con email/contraseña');
      loginErrorMessage = 'Credenciales incorrectas o usuario no encontrado.';
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
      authModal.open('login', '¡Registro exitoso! Ahora puedes iniciar sesión.');
    } catch (error: any) {
      logError(error, 'Error durante el registro de cuenta');
      if (error.code === 'auth/email-already-in-use') {
        registerErrorMessage = 'Este email ya está registrado.';
      } else if (error.code === 'auth/weak-password') {
        registerErrorMessage = 'La contraseña debe tener al menos 6 caracteres.';
      } else {
        registerErrorMessage = 'Error al registrar la cuenta.';
      }
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
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });

        if (response.ok) {
          document.dispatchEvent(new CustomEvent('auth-success'));
          authModal.close();
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error del servidor al crear sesión.');
        }
      })
      .catch((error) => {
        logError(error, 'Error durante el inicio de sesión con Google');
        if (error.code === 'auth/account-exists-with-different-credential') {
          const email = error.customData?.email;
          const pendingCredential = error.credential as AuthCredential;
          authModal.openForLinking(email, pendingCredential);
        } else if (error.code !== 'auth/cancelled-popup-request') {
           // For other errors, show a generic message
           loginErrorMessage = 'Ha ocurrido un error al iniciar sesión con Google.';
        }
      })
      .finally(() => {
        isLoading = false;
      });
  }

  async function handleLinkAccount() {
    isLoading = true;
    linkErrorMessage = '';
    
    const { email, pendingCredential } = $authModal.linkAccountInfo;

    if (!pendingCredential || !email || !linkPassword) {
      linkErrorMessage = 'Faltan datos para vincular la cuenta.';
      isLoading = false;
      return;
    }
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, linkPassword);
      await linkWithCredential(userCredential.user, pendingCredential);
      const idToken = await userCredential.user.getIdToken();
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (response.ok) {
        document.dispatchEvent(new CustomEvent('auth-success'));
        authModal.close();
      } else {
        throw new Error('Error al crear sesión después de vincular.');
      }
    } catch (error) {
      logError(error, 'Error durante la vinculación de cuenta');
      linkErrorMessage = 'Error al vincular: credenciales incorrectas o problema de red.';
    } finally {
      isLoading = false;
    }
  }
</script>

{#if $authModal.isOpen}
  <div class="modal-overlay" onclick={(e) => e.target === e.currentTarget && authModal.close()}>
    <div class="modal-panel auth-card">
      <button class="close-btn" onclick={authModal.close}>&times;</button>

      <!-- Vista de Login -->
      {#if $authModal.view === 'login'}
        <div>
          <h2>Iniciar Sesión</h2>
          <div class="message-container">
            {#if $authModal.successMessage}
              <p class="alert alert-success">{$authModal.successMessage}</p>
            {/if}
            {#if loginErrorMessage}
              <p class="alert alert-danger">{loginErrorMessage}</p>
            {/if}
          </div>
          <form onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            <div class="form-group">
              <label class="form-label" for="login-email">Email</label>
              <input class="form-control" type="email" name="email" id="login-email" placeholder="tu@email.com" required bind:value={loginEmail} />
            </div>
            <div class="form-group">
              <label class="form-label" for="login-password">Contraseña</label>
              <input class="form-control" type="password" name="password" id="login-password" required bind:value={loginPassword} />
            </div>
            <button type="submit" class="btn btn-primary" disabled={isLoading}>
              <span class="button-text">Entrar</span>
              <div class="button-loader"></div>
            </button>
          </form>
          <div class="divider"><span>O</span></div>
          <button class="btn btn-google" onclick={handleGoogleSignIn}>
            <img src="https://static.cdnlogo.com/logos/g/35/google-icon.svg" alt="Google icon" class="google-icon" />
            Continuar con Google
          </button>
          <div class="form-footer">
            <p>¿No tienes una cuenta? <button class="btn-link" onclick={() => authModal.switchTo('register')}>Regístrate aquí</button></p>
          </div>
        </div>
      {/if}

      <!-- Vista de Registro -->
      {#if $authModal.view === 'register'}
        <div>
          <h2>Crear Cuenta</h2>
          <div class="message-container">
            {#if registerErrorMessage}
              <p class="alert alert-danger">{registerErrorMessage}</p>
            {/if}
          </div>
          <form onsubmit={(e) => { e.preventDefault(); handleRegister(); }}>
            <div class="form-group">
              <label class="form-label" for="reg-email">Email</label>
              <input class="form-control" type="email" name="email" id="reg-email" placeholder="nombre@ejemplo.com" required bind:value={regEmail} />
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-password">Contraseña</label>
              <input class="form-control" type="password" name="password" id="reg-password" required minlength="6" bind:value={regPassword} />
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-confirm-password">Confirmar Contraseña</label>
              <input class="form-control" type="password" name="confirmPassword" id="reg-confirm-password" required minlength="6" bind:value={regConfirmPassword} />
            </div>
            <button type="submit" class="btn btn-primary" disabled={isLoading}>
              <span class="button-text">Registrarse</span>
              <div class="button-loader"></div>
            </button>
          </form>
          <div class="divider"><span>O</span></div>
          <button class="btn btn-google" onclick={handleGoogleSignIn}>
            <img src="https://static.cdnlogo.com/logos/g/35/google-icon.svg" alt="Google icon" class="google-icon" />
            Continuar con Google
          </button>
          <div class="form-footer">
            <p>¿Ya tienes una cuenta? <button class="btn-link" onclick={() => authModal.switchTo('login')}>Inicia sesión</button></p>
          </div>
        </div>
      {/if}

      <!-- Vista de Vinculación de Cuenta -->
      {#if $authModal.view === 'link'}
        <div>
          <h2>Vincular Cuenta</h2>
          <div class="message-container">
            <p class="alert alert-info">Ya existe una cuenta con el correo {$authModal.linkAccountInfo.email}. Por favor, introduce tu contraseña para vincularla con Google.</p>
            {#if linkErrorMessage}
              <p class="alert alert-danger">{linkErrorMessage}</p>
            {/if}
          </div>
          <form onsubmit={(e) => { e.preventDefault(); handleLinkAccount(); }}>
            <div class="form-group">
              <label class="form-label" for="link-email">Email</label>
              <input class="form-control" type="email" name="email" id="link-email" required readonly value={$authModal.linkAccountInfo.email} />
            </div>
            <div class="form-group">
              <label class="form-label" for="link-password">Contraseña</label>
              <input class="form-control" type="password" name="password" id="link-password" required bind:value={linkPassword} />
            </div>
            <button type="submit" class="btn btn-primary" disabled={isLoading}>
              <span class="button-text">Vincular y Entrar</span>
              <div class="button-loader"></div>
            </button>
          </form>
          <div class="form-footer">
            <button class="btn-link" onclick={authModal.close}>Cancelar</button>
          </div>
        </div>
      {/if}

    </div>
  </div>
{/if}

<style>
  /* Specific styles for the AuthModal, global styles are in components.css */
  .auth-card {
    position: relative;
    padding: 2.5rem 2rem;
    width: 100%;
    max-width: 450px;
    margin: auto; /* Centrado dentro del panel si hay espacio extra */
    text-align: center;
  }
  .close-btn {
    position: absolute;
    top: 10px;
    right: 15px;
    background: none;
    border: none;
    color: #aaa;
    font-size: 2.5rem;
    line-height: 1;
    cursor: pointer;
    z-index: 10;
  }
  .auth-card h2 {
    font-size: 1.8rem;
    margin-bottom: 0.5rem;
  }
  .message-container {
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }
  .form-footer {
    margin-top: 1.5rem;
    font-size: 0.9rem;
    color: #aaa;
  }
  .button-loader {
    display: none;
    width: 20px;
    height: 20px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  .btn:disabled .button-text {
    display: none;
  }
  .btn:disabled .button-loader {
    display: block;
  }
  .btn-google {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
  }
  .google-icon {
    width: 20px;
    height: 20px;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
