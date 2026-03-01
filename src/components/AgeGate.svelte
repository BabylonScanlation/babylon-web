<script lang="ts">
import { fade, fly } from 'svelte/transition';
import { actions } from 'astro:actions';
import { onMount } from 'svelte';
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
      <div class="header-glow"></div>
      
      <div class="logo-area">
        <div class="logo-circle">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
        </div>
      </div>

      <div class="content-area">
        <h1>Bienvenido a {siteConfig.shortName}</h1>
        <p class="subtitle">Confirma que eres mayor de edad y aceptas nuestros términos y condiciones para acceder.</p>

        <div class="verification-steps">
          <div class="check-box-wrapper" class:active={isAdult}>
            <input type="checkbox" id="adult-check" bind:checked={isAdult} />
            <label for="adult-check">
              <span class="custom-check"></span>
              Soy mayor de 18 años
            </label>
          </div>

          <div class="check-box-wrapper" class:active={acceptedTerms}>
            <input type="checkbox" id="terms-check" bind:checked={acceptedTerms} />
            <label for="terms-check">
              <span class="custom-check"></span>
              Acepto los <a href="/terms" target="_blank">términos de uso</a> y la <a href="/privacy" target="_blank">política de privacidad</a>
            </label>
          </div>
        </div>

        <div class="captcha-container">
          <Turnstile onVerify={handleCaptchaVerify} theme="dark" />
        </div>

        <button 
          class="enter-btn" 
          disabled={!isAdult || !acceptedTerms || !captchaToken}
          onclick={enterSite}
        >
          <span class="btn-text">Entrar al sitio</span>
          <span class="btn-shine"></span>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .age-gate-overlay {
    position: fixed;
    inset: 0;
    background: #000;
    z-index: 100000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .gate-card {
    position: relative;
    background: #0a0a0f;
    border: 1px solid rgba(255, 255, 255, 0.08);
    width: 100%;
    max-width: 480px;
    border-radius: 32px;
    overflow: hidden;
    padding: 3rem 2.5rem;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8);
  }

  .header-glow {
    position: absolute;
    top: -100px;
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    height: 200px;
    background: radial-gradient(circle, rgba(0, 191, 255, 0.15) 0%, transparent 70%);
    pointer-events: none;
  }

  .logo-area {
    display: flex;
    justify-content: center;
    margin-bottom: 2rem;
  }

  .logo-circle {
    width: 90px;
    height: 90px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-color);
    box-shadow: 0 0 20px rgba(0, 191, 255, 0.1);
  }

  .content-area {
    text-align: center;
  }

  h1 {
    font-size: 2.2rem;
    font-weight: 900;
    margin-bottom: 0.75rem;
    letter-spacing: -0.04em;
    color: #fff;
  }

  .subtitle {
    color: #666;
    font-size: 0.95rem;
    line-height: 1.5;
    margin-bottom: 2.5rem;
    font-weight: 500;
  }

  .verification-steps {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
    text-align: left;
  }

  .check-box-wrapper {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 16px;
    padding: 1rem 1.25rem;
    display: flex;
    align-items: center;
    transition: all 0.2s;
    cursor: pointer;
  }

  .check-box-wrapper:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .check-box-wrapper.active {
    background: rgba(0, 191, 255, 0.05);
    border-color: rgba(0, 191, 255, 0.2);
  }

  input[type="checkbox"] {
    display: none;
  }

  label {
    display: flex;
    align-items: center;
    gap: 1rem;
    color: #aaa;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
  }

  .check-box-wrapper.active label {
    color: #fff;
  }

  .custom-check {
    width: 22px;
    height: 22px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    position: relative;
    flex-shrink: 0;
    transition: all 0.2s;
  }

  .check-box-wrapper.active .custom-check {
    background: var(--accent-color);
    border-color: var(--accent-color);
  }

  .custom-check::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 7px;
    width: 5px;
    height: 10px;
    border: solid #000;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    opacity: 0;
  }

  .check-box-wrapper.active .custom-check::after {
    opacity: 1;
  }

  a {
    color: var(--accent-color);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  .captcha-container {
    margin-bottom: 2.5rem;
    display: flex;
    justify-content: center;
  }

  .enter-btn {
    width: 100%;
    background: var(--accent-color);
    color: #000;
    border: none;
    padding: 1.25rem;
    border-radius: 18px;
    font-size: 1.1rem;
    font-weight: 900;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .enter-btn:disabled {
    background: #222;
    color: #444;
    cursor: not-allowed;
  }

  .enter-btn:not(:disabled):hover {
    transform: scale(1.02);
    box-shadow: 0 10px 25px rgba(0, 191, 255, 0.3);
  }

  .btn-shine {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
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
