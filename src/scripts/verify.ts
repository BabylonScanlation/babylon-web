import { actions } from 'astro:actions';

// Orion: Definición inmediata del estado local
let captchaToken: string | null = null;

const ageCheck = document.getElementById('check-age') as HTMLInputElement | null;
const termsCheck = document.getElementById('check-terms') as HTMLInputElement | null;
const enterBtn = document.getElementById('enter-btn') as HTMLButtonElement | null;

// Astra: Función de validación centralizada
const validateCaptcha = () => {
  if (enterBtn && ageCheck && termsCheck) {
    enterBtn.disabled = !(ageCheck.checked && termsCheck.checked && captchaToken);
  }
};

// Callback para Turnstile
const onTurnstileVerify = (token: string) => {
  captchaToken = token;
  validateCaptcha();
};

ageCheck?.addEventListener('change', validateCaptcha);
termsCheck?.addEventListener('change', validateCaptcha);

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  const turnstileData = document.getElementById('turnstile-data');
  const sitekey = turnstileData?.dataset.sitekey;

  if (!sitekey || sitekey === 'undefined') {
    console.error('[Cloudflare Turnstile] Sitekey is missing or undefined.');
    return;
  }

  let renderAttempts = 0;
  const render = () => {
    // @ts-expect-error Turnstile is loaded via external script
    if (window.turnstile) {
      // @ts-expect-error Turnstile is loaded via external script
      window.turnstile.render('#turnstile-container', {
        sitekey: sitekey,
        theme: 'dark',
        callback: onTurnstileVerify,
        'expired-callback': () => {
          captchaToken = null;
          validateCaptcha();
          // @ts-expect-error Turnstile is loaded via external script
          window.turnstile.reset();
        },
        'error-callback': () => {
          console.warn('Turnstile error, retrying...');
          // @ts-expect-error Turnstile is loaded via external script
          window.turnstile.reset();
        },
      });
    } else if (renderAttempts < 50) {
      renderAttempts++;
      setTimeout(render, 100);
    }
  };

  // Esperar un poco a que el script de CF se cargue si no está listo
  if (document.readyState === 'complete') render();
  else window.addEventListener('load', render);
});

if (enterBtn) {
  enterBtn.onclick = async () => {
    if (!captchaToken) return;

    try {
      const { error } = await actions.auth.verifyAge({
        token: captchaToken,
      });

      if (!error) {
        sessionStorage.setItem('site_access_granted', 'true');
        window.location.href = '/';
      } else {
        alert(error?.message || 'Error de verificación. Inténtalo de nuevo.');
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    }
  };
}
