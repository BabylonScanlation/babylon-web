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

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const MAX_ERROR_RETRIES = 3;

function loadTurnstile(): Promise<void> {
  return new Promise((resolve, reject) => {
    // @ts-expect-error Turnstile is loaded via external script
    if (window.turnstile) return resolve();

    const existing = document.querySelector<HTMLScriptElement>('script[data-babylon-turnstile]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('turnstile load failed')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.babylonTurnstile = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('turnstile load failed'));
    document.head.appendChild(script);
  });
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  const turnstileData = document.getElementById('turnstile-data');
  const sitekey = turnstileData?.dataset.sitekey;

  if (!sitekey || sitekey === 'undefined') {
    console.error('[Cloudflare Turnstile] Sitekey is missing or undefined.');
    return;
  }

  let errorRetries = 0;
  let widgetId: string | undefined;

  const mountWidget = () => {
    // @ts-expect-error Turnstile is loaded via external script
    if (!window.turnstile) return;

    // @ts-expect-error Turnstile is loaded via external script
    widgetId = window.turnstile.render('#turnstile-container', {
      sitekey: sitekey,
      theme: 'dark',
      'refresh-expired': 'auto',
      callback: onTurnstileVerify,
      'expired-callback': () => {
        captchaToken = null;
        validateCaptcha();
      },
      'error-callback': () => {
        if (errorRetries >= MAX_ERROR_RETRIES) {
          console.error('[Cloudflare Turnstile] Widget failed after retries');
          return;
        }
        errorRetries += 1;
        console.warn(
          '[Cloudflare Turnstile] Widget error, limited retry',
          errorRetries,
          '/',
          MAX_ERROR_RETRIES
        );
        setTimeout(() => {
          // @ts-expect-error Turnstile is loaded via external script
          if (widgetId) window.turnstile.reset(widgetId);
        }, 2000 * errorRetries);
      },
    });
  };

  loadTurnstile()
    .then(mountWidget)
    .catch((err) => {
      console.error('[Cloudflare Turnstile]', err);
    });
});

if (enterBtn) {
  enterBtn.onclick = async () => {
    if (!captchaToken) return;

    enterBtn.disabled = true;
    enterBtn.textContent = 'Verificando...';

    try {
      const { error } = await actions.auth.verifyAge({
        token: captchaToken,
      });

      if (!error) {
        sessionStorage.setItem('site_access_granted', 'true');
        window.location.href = '/';
      } else {
        alert(error?.message || 'Error de verificación. Inténtalo de nuevo.');
        captchaToken = null;
        validateCaptcha();
        enterBtn.textContent = 'Entrar al Sitio';
      }
    } catch (e) {
      console.error(e);
      enterBtn.disabled = false;
      enterBtn.textContent = 'Entrar al Sitio';
    }
  };
}
