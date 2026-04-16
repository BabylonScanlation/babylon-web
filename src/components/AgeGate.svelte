<script lang="ts">
import { onMount } from 'svelte';
import { actions } from 'astro:actions';
import Turnstile from './Turnstile.svelte';

// --- Runes Svelte 5 ---
let isVerified = $state(false);
let isAdult = $state(false);
let acceptedTerms = $state(false);
let captchaToken = $state('');

let { isVerificationPage = false } = $props();

const BRAND_NAME = 'Babylon';
const ACCENT_COLOR = '#00bfff';

onMount(() => {
  if (isVerificationPage) {
    isVerified = false;
    document.body.classList.add('no-scroll');
    document.documentElement.classList.add('age-gate-active');
  } else {
    const sessionVerified = sessionStorage.getItem('site_access_granted');
    if (sessionVerified === 'true') {
      isVerified = true;
      document.body.classList.remove('no-scroll');
      document.documentElement.classList.remove('age-gate-active');
    } else {
      isVerified = false;
      document.body.classList.add('no-scroll');
      document.documentElement.classList.add('age-gate-active');
    }
  }

  return () => {
    document.body.classList.remove('no-scroll');
  };
});

function handleCaptchaVerify(token: string) {
  captchaToken = token;
}

async function enterSite() {
  if (isAdult && acceptedTerms && captchaToken) {
    try {
      const { error } = await actions.auth.verifyAge({
        token: captchaToken,
      });

      if (!error) {
        sessionStorage.setItem('site_access_granted', 'true');
        if (isVerificationPage) {
          window.location.href = '/';
        } else {
          isVerified = true;
          document.body.classList.remove('no-scroll');
          document.documentElement.classList.remove('age-gate-active');
          window.dispatchEvent(new CustomEvent('age-gate-passed'));
        }
      } else {
        console.error('Error en verificación:', error.message);
      }
    } catch (e) {
      console.error('Error inesperado en verificación:', e);
    }
  }
}
</script>

{#if !isVerified}
  <div class="age-gate-overlay">
    <div class="gate-card">
      <div class="logo-area">
        <div class="logo-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: {ACCENT_COLOR}">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M2 12h20"></path>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        </div>
      </div>

      <div class="content-area">
        <h1>Bienvenido a {BRAND_NAME}</h1>
        <p class="subtitle">Confirma que eres mayor de edad y aceptas nuestros términos y condiciones para continuar.</p>

        <div class="checks-area">
          <label class="checkbox-container">
            <input type="checkbox" bind:checked={isAdult} />
            <div class="custom-checkbox">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <span class="label-text">Soy mayor de 18 años</span>
          </label>

          <label class="checkbox-container">
            <input type="checkbox" bind:checked={acceptedTerms} />
            <div class="custom-checkbox">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <span class="label-text">Acepto los <a href="/terms" onclick={(e) => e.stopPropagation()}>Términos y Condiciones</a> y la Política de Privacidad</span>
          </label>
        </div>

        <div class="captcha-area">
          <Turnstile onVerify={handleCaptchaVerify} theme="dark" />
        </div>

        <button
          class="enter-btn"
          disabled={!isAdult || !acceptedTerms || !captchaToken}
          onclick={enterSite}
        >
          <span class="btn-shine"></span>
          Entrar al Sitio
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* --- Age Gate --- */
  .age-gate-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.95);
    background-image:
      radial-gradient(
        circle at 50% -20%,
        rgba(0, 191, 255, 0.15) 0%,
        transparent 50%
      ),
      radial-gradient(
        circle at 0% 100%,
        rgba(0, 191, 255, 0.05) 0%,
        transparent 40%
      );
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 1.5rem;
    backdrop-filter: blur(8px);
  }

  .gate-card {
    background: rgba(30, 30, 30, 0.8);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 3rem 2.5rem;
    border-radius: 32px;
    width: 100%;
    max-width: 520px;
    text-align: center;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  }

  .logo-wrapper {
    background: rgba(255, 255, 255, 0.03);
    width: 120px;
    height: 120px;
    margin: 0 auto 2rem;
    border-radius: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transform: rotate(-5deg);
  }

  .gate-card h1 {
    font-size: 2.2rem;
    font-weight: 800;
    color: #fff;
    margin-bottom: 0.75rem;
    background: linear-gradient(to bottom, #fff, #999);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    color: #888;
    margin-bottom: 2.5rem;
    font-size: 1rem;
  }

  .checks-area {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    text-align: left;
    margin-bottom: 2rem;
  }

  .checkbox-container {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: flex-start;
    gap: 1rem;
    cursor: pointer;
    color: #ccc;
  }

  .custom-checkbox {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .checkbox-container input:checked + .custom-checkbox {
    background-color: var(--accent-color);
    border-color: var(--accent-color);
  }

  .enter-btn {
    background: linear-gradient(135deg, var(--accent-color) 0%, #0077ff 100%);
    color: #fff;
    border: none;
    padding: 1.1rem;
    width: 100%;
    border-radius: 16px;
    font-weight: 700;
    cursor: pointer;
  }

  .enter-btn:disabled {
    background: rgba(255, 255, 255, 0.05);
    color: #555;
  }
</style>


