<script lang="ts">
import { actions } from 'astro:actions';
import { onMount } from 'svelte';
import { fade, fly } from 'svelte/transition';
import { siteConfig } from '../site.config';
import Turnstile from './Turnstile.svelte';

// --- Runes Svelte 5 ---
let isVerified = $state(false);
let isAdult = $state(false);
let acceptedTerms = $state(false);
let captchaToken = $state('');

let { isVerificationPage = false } = $props();

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
      const { error } = await actions.auth.verifyAge();
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
        console.error('Error en verificación:', error);
      }
    } catch (e) {
      console.error('Error en verificación:', e);
    }
  }
}
</script>

{#if !isVerified}
  <div class="age-gate-overlay" transition:fade={{ duration: 300 }}>
    <div class="gate-card" in:fly={{ y: 30, duration: 600, delay: 100 }}>
      <div class="logo-area">
        <div class="logo-wrapper">
          <img src={siteConfig.assets.logo} alt={`${siteConfig.name} Logo`} width="80" height="80" />
        </div>
      </div>
      
      <div class="content-area">
        <h1>Bienvenido a {siteConfig.shortName}</h1>
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
            <span class="label-text">Acepto los <a href="/terms" onclick={(e) => e.stopPropagation()}>Términos y Condiciones</a></span>
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
  .age-gate-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.95);
    background-image: 
      radial-gradient(circle at 50% -20%, rgba(0, 191, 255, 0.15) 0%, transparent 50%),
      radial-gradient(circle at 0% 100%, rgba(0, 191, 255, 0.05) 0%, transparent 40%);
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
    -webkit-backdrop-filter: blur(16px);
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
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    transform: rotate(-5deg);
    transition: transform 0.3s ease;
  }

  .gate-card:hover .logo-wrapper {
    transform: rotate(0deg) scale(1.05);
  }

  h1 {
    font-size: 2.2rem;
    font-weight: 800;
    color: #fff;
    margin-bottom: 0.75rem;
    letter-spacing: -0.02em;
    background: linear-gradient(to bottom, #fff, #999);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    color: #888;
    margin-bottom: 2.5rem;
    font-size: 1rem;
    line-height: 1.5;
  }

  .checks-area {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    text-align: left;
    margin-bottom: 2rem;
  }

  .checkbox-container {
    display: flex;
    align-items: center;
    gap: 1rem;
    cursor: pointer;
    color: #ccc;
    font-size: 1rem;
    user-select: none;
    transition: color 0.2s;
  }

  .checkbox-container:hover {
    color: #fff;
  }

  .checkbox-container input {
    display: none;
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
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
  }

  .custom-checkbox svg {
    width: 14px;
    height: 14px;
    color: #000;
    transform: scale(0);
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .checkbox-container input:checked + .custom-checkbox {
    background-color: var(--accent-color, var(--accent-color));
    border-color: var(--accent-color, var(--accent-color));
    box-shadow: 0 0 15px rgba(0, 191, 255, 0.3);
  }

  .checkbox-container input:checked + .custom-checkbox svg {
    transform: scale(1);
  }

  .label-text a {
    color: var(--accent-color, var(--accent-color));
    text-decoration: none;
    font-weight: 600;
  }

  .label-text a:hover {
    text-decoration: underline;
  }

  .captcha-area {
    margin-bottom: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .dev-badge {
    margin-top: 1rem;
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--accent-color);
    background: rgba(0, 191, 255, 0.1);
    padding: 4px 12px;
    border-radius: 100px;
    letter-spacing: 0.05em;
  }

  .enter-btn {
    position: relative;
    background: linear-gradient(135deg, var(--accent-color, var(--accent-color)) 0%, #0077ff 100%);
    color: #fff;
    border: none;
    padding: 1.1rem;
    width: 100%;
    border-radius: 16px;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
    overflow: hidden;
    box-shadow: 0 10px 20px -5px rgba(0, 162, 255, 0.4);
  }

  .enter-btn:disabled {
    background: rgba(255, 255, 255, 0.05);
    color: #555;
    cursor: not-allowed;
    box-shadow: none;
  }

  .enter-btn:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 15px 25px -5px rgba(0, 162, 255, 0.5);
  }

  .enter-btn:not(:disabled):active {
    transform: translateY(0);
  }

  .btn-shine {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      120deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
    transition: all 0.6s;
  }

  .enter-btn:not(:disabled):hover .btn-shine {
    left: 100%;
  }

  @media (max-width: 480px) {
    .gate-card {
      padding: 2.5rem 1.5rem;
      border-radius: 24px;
    }
    
    h1 {
      font-size: 1.8rem;
    }
  }
</style>