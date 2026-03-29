<script lang="ts">
import { onMount } from 'svelte';
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
      const response = await fetch('/_actions/auth.verifyAge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        sessionStorage.setItem('site_access_granted', 'true');
        if (isVerificationPage) {
          window.location.href = '/';
        } else {
          isVerified = true;
          document.body.classList.remove('no-scroll');
          document.documentElement.classList.remove('age-gate-active');
          window.dispatchEvent(new CustomEvent('age-gate-passed'));
        }
      }
    } catch (e) {
      console.error('Error en verificación:', e);
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


