import { auth } from './firebase/client';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';

// Declare a custom event map for the Document to include 'open-auth-modal'
declare global {
  interface DocumentEventMap {
    'open-auth-modal': CustomEvent<{ view?: string; successMessage?: string }>;
  }
}

export function initializeAuthModal() {
  function setupAuthModal() {
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

    // Link Account View elements
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

    if (
      !modalOverlay ||
      !modalCloseBtn ||
      !loginView ||
      !registerView ||
      !showRegisterLink ||
      !showLoginLink ||
      !googleSignInButton ||
      !googleSignInButtonRegister ||
      !linkAccountView ||
      !linkAccountMessage ||
      !linkAccountErrorMessage ||
      !linkAccountEmailInput ||
      !linkAccountPasswordInput ||
      !linkAccountSubmitButton ||
      !cancelLinkAccountButton
    ) {
      // Si algún elemento no se encuentra, la función termina.
      console.error(
        'AuthModal: No se encontraron todos los elementos necesarios.'
      );
      return;
    }

    // Assert non-null after the check
    const _modalOverlay = modalOverlay!;
    const _loginView = loginView!;
    const _registerView = registerView!;
    const _linkAccountView = linkAccountView!;

    let pendingCredential: AuthCredential | null = null;

    function openModal(view: string = 'login', successMessage: string = '') {
      const loginErrorMsg = document.getElementById(
        'login-error-message'
      ) as HTMLParagraphElement | null;
      const loginSuccessMsg = document.getElementById(
        'login-success-message'
      ) as HTMLParagraphElement | null;

      if (loginErrorMsg) loginErrorMsg.style.display = 'none';
      if (loginSuccessMsg) loginSuccessMsg.style.display = 'none';
      if (successMessage && loginSuccessMsg) {
        loginSuccessMsg.textContent = successMessage;
        loginSuccessMsg.style.display = 'block';
      }

      _loginView.style.display = view === 'login' ? 'block' : 'none';
      _registerView.style.display = view === 'register' ? 'block' : 'none';
      _linkAccountView.style.display = view === 'link' ? 'block' : 'none';
      _modalOverlay.classList.remove('is-hidden');
      document.body.style.overflow = '';
    }

    function closeModal() {
      _modalOverlay.classList.add('is-hidden');
      document.body.style.overflow = '';
    }

    // Evento personalizado para abrir el modal
    document.addEventListener('open-auth-modal', (e: CustomEvent) => {
      const detail = e.detail;
      const view =
        detail && typeof detail === 'object' && 'view' in detail
          ? (detail.view as string)
          : undefined;
      const successMessage =
        detail && typeof detail === 'object' && 'successMessage' in detail
          ? (detail.successMessage as string)
          : undefined;
      openModal(view, successMessage);
    });

    // Eventos de los controles del modal
    modalCloseBtn.addEventListener('click', closeModal);
    _modalOverlay.addEventListener('click', (e) => {
      if (e.target === _modalOverlay) closeModal();
    });
    showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('register');
    });
    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('login');
    });

    // Google Sign-In
    const googleProvider = new GoogleAuthProvider();

    const handleGoogleSignIn = async () => {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const idToken = await result.user.getIdToken();
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });

        if (response.ok) {
          window.location.reload();
        } else {
          const errorData = await response.json();
          console.error('Error en la sesión de Google:', errorData);
          // Handle error display for Google Sign-In if needed
        }
      } catch (error: unknown) {
        console.error('Error al iniciar sesión con Google:', error);
        if (error && typeof error === 'object' && 'code' in error) {
          const firebaseError = error as { code: string; credential?: AuthCredential };
          if (firebaseError.code === 'auth/account-exists-with-different-credential') {
            pendingCredential = firebaseError.credential || null;
            const email = firebaseError.customData?.email as string;
            if (email && linkAccountEmailInput) {
              linkAccountEmailInput.value = email;
            }
            if (linkAccountMessage) {
              linkAccountMessage.textContent = `Ya existe una cuenta con el correo ${email}. Por favor, inicia sesión con tu método existente para vincularla.`;
              linkAccountMessage.style.display = 'block';
            }
            openModal('link');
          } else {
            // Handle other Firebase errors
            alert('Error al iniciar sesión con Google: ' + firebaseError.code);
          }
        } else {
          alert('Error desconocido al iniciar sesión con Google.');
        }
      }
    };

    googleSignInButton.addEventListener('click', handleGoogleSignIn);
    googleSignInButtonRegister.addEventListener('click', handleGoogleSignIn);

    // Link Account Form Submission
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
        // Re-authenticate the user with their existing credentials
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // Link the pending Google credential to the re-authenticated user
        await userCredential.user.linkWithCredential(pendingCredential);

        // If linking is successful, proceed to create session
        const idToken = await userCredential.user.getIdToken();
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });

        if (response.ok) {
          window.location.reload();
        } else {
          const errorData = await response.json();
          console.error('Error al crear sesión después de vincular:', errorData);
          if (linkAccountErrorMessage) {
            linkAccountErrorMessage.textContent = 'Error al vincular la cuenta y crear sesión.';
            linkAccountErrorMessage.style.display = 'block';
          }
        }
      } catch (error: unknown) {
        console.error('Error durante la vinculación de cuenta:', error);
        if (linkAccountErrorMessage) {
          let errorMessage = 'Error al vincular la cuenta. Credenciales incorrectas o problema de red.';
          if (error && typeof error === 'object' && 'code' in error) {
            const firebaseError = error as { code: string };
            if (firebaseError.code === 'auth/invalid-credential') {
              errorMessage = 'Credenciales incorrectas para la cuenta existente.';
            } else if (firebaseError.code === 'auth/wrong-password') {
              errorMessage = 'Contraseña incorrecta para la cuenta existente.';
            }
          }
          linkAccountErrorMessage.textContent = errorMessage;
          linkAccountErrorMessage.style.display = 'block';
        }
      }
    });

    // Cancel Link Account Button
    cancelLinkAccountButton.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal();
    });
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAuthModal);
  } else {
    setupAuthModal();
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Configuración del formulario de login
    const loginForm = document.getElementById('login-form');
    const loginErrorMsg = document.getElementById(
      'login-error-message'
    ) as HTMLParagraphElement | null;
    const loginSubmitBtn = document.getElementById(
      'login-submit-button'
    ) as HTMLButtonElement | null;

    if (
      loginForm instanceof HTMLFormElement &&
      loginErrorMsg &&
      loginSubmitBtn
    ) {
      const btnText = loginSubmitBtn.querySelector('.button-text');
      const btnLoader = loginSubmitBtn.querySelector('.button-loader');
      const showLoginError = (message: string) => {
        if (loginErrorMsg) {
          loginErrorMsg.textContent = message;
          loginErrorMsg.style.display = 'block';
        }
        if (btnText instanceof HTMLElement) btnText.style.display = 'inline';
        if (btnLoader instanceof HTMLElement) btnLoader.style.display = 'none';
        if (loginSubmitBtn) loginSubmitBtn.disabled = false;
      };

      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (loginSubmitBtn) loginSubmitBtn.disabled = true;
        if (btnText instanceof HTMLElement) btnText.style.display = 'none';
        if (btnLoader instanceof HTMLElement) btnLoader.style.display = 'block';
        if (loginErrorMsg) loginErrorMsg.style.display = 'none';

        const formData = new FormData(loginForm);
        const email = formData.get('email')?.toString().trim();
        const password = formData.get('password')?.toString();

        if (!email || !password) {
          showLoginError('Por favor, completa todos los campos.');
          return;
        }

        try {
          const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password
          );
          const idToken = await userCredential.user.getIdToken();
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });

          if (response.ok) {
            window.location.reload();
          } else {
            const errorData = await response.json();
            const errorMessage =
              errorData && typeof errorData === 'object' && 'error' in errorData
                ? (errorData.error as string)
                : 'Error del servidor al iniciar sesión.';
            showLoginError(errorMessage);
          }
        } catch (error: unknown) {
          // Changed to unknown
          let errorMessage = 'Credenciales incorrectas.';
          if (error && typeof error === 'object' && 'code' in error) {
            const firebaseError = error as { code: string }; // Type assertion for Firebase error
            if (firebaseError.code === 'auth/invalid-credential') {
              errorMessage = 'Credenciales incorrectas.';
            } else if (firebaseError.code === 'auth/user-not-found') {
              errorMessage = 'Usuario no encontrado.';
            } else if (firebaseError.code === 'auth/wrong-password') {
              errorMessage = 'Contraseña incorrecta.';
            }
          }
          showLoginError(errorMessage);
        }
      });
    }

    // Configuración del formulario de registro
    const registerForm = document.getElementById('register-form');
    const registerErrorMsg = document.getElementById(
      'register-error-message'
    ) as HTMLParagraphElement | null;
    const registerSubmitBtn = document.getElementById(
      'register-submit-button'
    ) as HTMLButtonElement | null;

    if (
      registerForm instanceof HTMLFormElement &&
      registerErrorMsg &&
      registerSubmitBtn
    ) {
      const btnText = registerSubmitBtn.querySelector('.button-text');
      const btnLoader = registerSubmitBtn.querySelector('.button-loader');
      const showRegisterError = (message: string) => {
        if (registerErrorMsg) {
          registerErrorMsg.textContent = message;
          registerErrorMsg.style.display = 'block';
        }
        if (btnText instanceof HTMLElement) btnText.style.display = 'inline';
        if (btnLoader instanceof HTMLElement) btnLoader.style.display = 'none';
        if (registerSubmitBtn) registerSubmitBtn.disabled = false;
      };

      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (registerSubmitBtn) registerSubmitBtn.disabled = true;
        if (btnText instanceof HTMLElement) btnText.style.display = 'none';
        if (btnLoader instanceof HTMLElement) btnLoader.style.display = 'block';
        if (registerErrorMsg) registerErrorMsg.style.display = 'none';

        const formData = new FormData(registerForm);
        const email = formData.get('email')?.toString().trim();
        const password = formData.get('password')?.toString();
        const confirmPassword = formData.get('confirmPassword')?.toString();

        if (!email || !password || !confirmPassword) {
          showRegisterError('Por favor, completa todos los campos.');
          return;
        }
        if (password !== confirmPassword) {
          showRegisterError('Las contraseñas no coinciden.');
          return;
        }

        try {
          await createUserWithEmailAndPassword(auth, email, password);
          document.dispatchEvent(
            new CustomEvent('open-auth-modal', {
              detail: {
                view: 'login',
                successMessage:
                  '¡Registro exitoso! Ahora puedes iniciar sesión.',
              },
            })
          );
        } catch (error: unknown) {
          // Changed to unknown
          if (error && typeof error === 'object' && 'code' in error) {
            const firebaseError = error as { code: string }; // Type assertion for Firebase error
            if (firebaseError.code === 'auth/email-already-in-use') {
              showRegisterError('Este email ya está registrado.');
            } else if (firebaseError.code === 'auth/weak-password') {
              showRegisterError(
                'La contraseña debe tener al menos 6 caracteres.'
              );
            } else {
              showRegisterError('Error al registrar la cuenta.');
            }
          } else {
            showRegisterError('Error al registrar la cuenta.');
          }
        }
      });
    }
  });
}
