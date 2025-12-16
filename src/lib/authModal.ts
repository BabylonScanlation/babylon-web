import { auth } from './firebase/client';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  AuthCredential,
  linkWithCredential,
} from 'firebase/auth';
import type { AuthError } from 'firebase/auth';

// Declare a custom event map for the Document to include 'open-auth-modal'
declare global {
  interface DocumentEventMap {
    'open-auth-modal': CustomEvent<{ view?: string; successMessage?: string }>;
  }
}

export function initializeAuthModal() {
  const setup = () => {
    // --- Element Queries ---
    const modalOverlay = document.getElementById('auth-modal-overlay');
    const modalCloseBtn = document.getElementById('auth-modal-close');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const googleSignInButton = document.getElementById('google-sign-in-button');
    const googleSignInButtonRegister = document.getElementById(
      'google-sign-in-button-register'
    );
    const linkAccountView = document.getElementById('link-account-view');
    const linkAccountMessage = document.getElementById(
      'link-account-message'
    ) as HTMLParagraphElement | null;
    const linkAccountErrorMessage = document.getElementById(
      'link-account-error-message'
    ) as HTMLParagraphElement | null;
    const linkAccountEmailInput = document.getElementById(
      'link-email'
    ) as HTMLInputElement | null;
    const linkAccountPasswordInput = document.getElementById(
      'link-password'
    ) as HTMLInputElement | null;
    const linkAccountSubmitButton = document.getElementById(
      'link-account-submit-button'
    ) as HTMLButtonElement | null;
    const cancelLinkAccountButton = document.getElementById(
      'cancel-link-account'
    );
    const loginForm = document.getElementById('login-form');
    const loginErrorMsg = document.getElementById(
      'login-error-message'
    ) as HTMLParagraphElement | null;
    const loginSubmitBtn = document.getElementById(
      'login-submit-button'
    ) as HTMLButtonElement | null;
    const registerForm = document.getElementById('register-form');
    const registerErrorMsg = document.getElementById(
      'register-error-message'
    ) as HTMLParagraphElement | null;
    const registerSubmitBtn = document.getElementById(
      'register-submit-button'
    ) as HTMLButtonElement | null;

    if (!modalOverlay || !modalCloseBtn || !loginView || !registerView) {
      return;
    }

    let pendingCredential: AuthCredential | null = null;
    
    function openModal(view: string = 'login', successMessage: string = '') {
        if (loginErrorMsg) loginErrorMsg.style.display = 'none';
        if (registerErrorMsg) registerErrorMsg.style.display = 'none';
        const loginSuccessMsg = document.getElementById('login-success-message') as HTMLParagraphElement | null;
        if (loginSuccessMsg) loginSuccessMsg.style.display = 'none';
  
        if (successMessage && loginSuccessMsg) {
          loginSuccessMsg.textContent = successMessage;
          loginSuccessMsg.style.display = 'block';
        }
  
        loginView.style.display = view === 'login' ? 'block' : 'none';
        registerView.style.display = view === 'register' ? 'block' : 'none';
        if (linkAccountView) linkAccountView.style.display = view === 'link' ? 'block' : 'none';
        modalOverlay.classList.remove('is-hidden');
    }

    function closeModal() {
      modalOverlay.classList.add('is-hidden');
    }

    document.addEventListener('open-auth-modal', (e: CustomEvent) => {
      openModal(e.detail?.view, e.detail?.successMessage);
    });

    modalCloseBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
    showRegisterLink?.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('register');
    });
    showLoginLink?.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('login');
    });

    // --- GOOGLE SIGN-IN (POPUP FLOW - Corrected) ---
    const googleProvider = new GoogleAuthProvider();
    const handleGoogleSignIn = () => { // NOT async
      signInWithPopup(auth, googleProvider)
        .then(async (result) => {
          // This async work happens *after* the popup is handled
          const idToken = await result.user.getIdToken();
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });

          if (response.ok) {
            window.location.reload();
          } else {
            alert('Error al crear la sesión en el servidor.');
          }
        })
        .catch((error) => {
          console.error("Error durante el inicio de sesión con Google:", error);
          if (error.code === 'auth/cancelled-popup-request') {
            // User closed the popup. This can be ignored silently.
            console.log("Popup de Google cerrado por el usuario.");
          } else if (error.code === 'auth/account-exists-with-different-credential') {
            pendingCredential = error.credential;
            const email = error.customData?.email;
            if (email && linkAccountEmailInput) linkAccountEmailInput.value = email;
            if (linkAccountMessage) {
              linkAccountMessage.textContent = `Ya existe una cuenta con el correo ${email}. Por favor, inicia sesión con tu método existente para vincularla.`;
              linkAccountMessage.style.display = 'block';
            }
            openModal('link');
          } else {
            alert('Ha ocurrido un error al iniciar sesión con Google.');
          }
        });
    };

    googleSignInButton?.addEventListener('click', handleGoogleSignIn);
    googleSignInButtonRegister?.addEventListener('click', handleGoogleSignIn);

    // --- FULL EMAIL/PASSWORD AND LINKING LOGIC ---
    if (loginForm && loginErrorMsg && loginSubmitBtn) {
      loginSubmitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        loginSubmitBtn.disabled = true;
        loginErrorMsg.style.display = 'none';
        const formData = new FormData(loginForm as HTMLFormElement);
        const email = formData.get('email')?.toString().trim();
        const password = formData.get('password')?.toString().trim();

        if (!password) {
          loginErrorMsg.textContent = 'Por favor, completa el campo de contraseña.';
          loginErrorMsg.style.display = 'block';
          loginSubmitBtn.disabled = false;
          return;
        }

        const adminCheckResponse = await fetch('/api/auth/check-admin-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        const adminCheckData = await adminCheckResponse.json();

        if (adminCheckData.isAdmin) {
          const setAdminSessionResponse = await fetch('/api/auth/set-admin-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          if (setAdminSessionResponse.ok) {
            window.location.href = '/admin';
          } else {
            loginErrorMsg.textContent = 'Error al establecer la sesión de administrador.';
            loginErrorMsg.style.display = 'block';
          }
          loginSubmitBtn.disabled = false;
          return;
        }

        if (!email) {
          loginErrorMsg.textContent = 'El email es obligatorio para el inicio de sesión normal.';
          loginErrorMsg.style.display = 'block';
          loginSubmitBtn.disabled = false;
          return;
        }

        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const idToken = await userCredential.user.getIdToken();
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
          if (response.ok) {
            window.location.reload();
          } else {
            loginErrorMsg.textContent = (await response.json()).error || 'Error del servidor.';
            loginErrorMsg.style.display = 'block';
          }
        } catch (error) {
          loginErrorMsg.textContent = 'Credenciales incorrectas o usuario no encontrado.';
          loginErrorMsg.style.display = 'block';
        }
        loginSubmitBtn.disabled = false;
      });
    }

    if (registerForm && registerErrorMsg && registerSubmitBtn) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerSubmitBtn.disabled = true;
        registerErrorMsg.style.display = 'none';

        const formData = new FormData(registerForm as HTMLFormElement);
        const email = formData.get('email')?.toString().trim();
        const password = formData.get('password')?.toString();
        const confirmPassword = formData.get('confirmPassword')?.toString();

        if (!email || !password || !confirmPassword) {
          registerErrorMsg.textContent = 'Por favor, completa todos los campos.';
          registerErrorMsg.style.display = 'block';
          registerSubmitBtn.disabled = false;
          return;
        }
        if (password !== confirmPassword) {
          registerErrorMsg.textContent = 'Las contraseñas no coinciden.';
          registerErrorMsg.style.display = 'block';
          registerSubmitBtn.disabled = false;
          return;
        }

        try {
          await createUserWithEmailAndPassword(auth, email, password);
          openModal('login', '¡Registro exitoso! Ahora puedes iniciar sesión.');
        } catch (error: any) {
          if (error.code === 'auth/email-already-in-use') {
            registerErrorMsg.textContent = 'Este email ya está registrado.';
          } else if (error.code === 'auth/weak-password') {
            registerErrorMsg.textContent = 'La contraseña debe tener al menos 6 caracteres.';
          } else {
            registerErrorMsg.textContent = 'Error al registrar la cuenta.';
          }
          registerErrorMsg.style.display = 'block';
        }
        registerSubmitBtn.disabled = false;
      });
    }

    if (linkAccountSubmitButton) {
      linkAccountSubmitButton.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!pendingCredential) {
          console.error('No pending credential to link.');
          return;
        }
        const email = linkAccountEmailInput?.value;
        const password = linkAccountPasswordInput?.value;

        if (!email || !password) {
          if (linkAccountErrorMessage) {
            linkAccountErrorMessage.textContent = 'Por favor, completa todos los campos.';
            linkAccountErrorMessage.style.display = 'block';
          }
          return;
        }
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          await linkWithCredential(userCredential.user, pendingCredential);
          const idToken = await userCredential.user.getIdToken();
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
          if (response.ok) {
            window.location.reload();
          } else {
            throw new Error('Error al crear sesión después de vincular.');
          }
        } catch (error) {
          if (linkAccountErrorMessage) {
            linkAccountErrorMessage.textContent = 'Error al vincular: credenciales incorrectas o problema de red.';
            linkAccountErrorMessage.style.display = 'block';
          }
        }
      });
    }
    
    cancelLinkAccountButton?.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
}
