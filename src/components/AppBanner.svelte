<script lang="ts">
import { onMount } from 'svelte';
import { fade, slide } from 'svelte/transition';
import { siteConfig } from '../site.config';

let isVisible = $state(false);
let showConfirmation = $state(false);
let hasClosed = $state(false);

const appUrl = siteConfig.app.androidUrl;

onMount(() => {
  const closedStatus = localStorage.getItem('app-banner-closed');
  const lastClosedTime = localStorage.getItem('app-banner-closed-time');

  if (closedStatus === 'true') {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (lastClosedTime && Date.now() - parseInt(lastClosedTime, 10) < sevenDays) {
      hasClosed = true;
    }
  }

  if (!hasClosed && window.innerWidth < 768) {
    setTimeout(() => {
      isVisible = true;
    }, 4000);
  }
});

function closeBanner() {
  isVisible = false;
  localStorage.setItem('app-banner-closed', 'true');
  localStorage.setItem('app-banner-closed-time', Date.now().toString());
}

function handleInstallClick() {
  showConfirmation = true;
}

function confirmDownload() {
  showConfirmation = false;
  isVisible = false;
  window.location.href = appUrl;
}

function cancelDownload() {
  showConfirmation = false;
}
</script>

{#if isVisible}
  <div class="app-banner-container" in:slide={{ axis: 'y', duration: 500 }} out:fade>
    <div class="app-banner-glass"></div>
    
    <button class="close-btn" onclick={closeBanner} aria-label="Cerrar">×</button>

    <div class="app-content">
      <div class="app-icon">
        <img src="/favicon.png" alt={siteConfig.name} />
      </div>
      <div class="app-info">
        <span class="app-title">{siteConfig.shortName} App</span>
        <span class="app-desc">¡Mejor experiencia en Android!</span>
      </div>
      <button class="install-btn" onclick={handleInstallClick}>Instalar</button>
    </div>

    {#if showConfirmation}
      <div class="confirm-overlay" transition:fade>
        <div class="confirm-dialog" in:slide>
          <p>¿Quieres descargar la aplicación oficial para Android?</p>
          <div class="confirm-actions">
            <button class="btn-cancel" onclick={cancelDownload}>Luego</button>
            <button class="btn-confirm" onclick={confirmDownload}>Descargar</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* --- App Banner --- */
  .app-banner-container {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    z-index: 9999;
    padding: 0.75rem 1rem;
    color: white;
    display: flex;
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .app-banner-glass {
    position: absolute;
    inset: 0;
    background: rgba(10, 10, 15, 0.85);
    backdrop-filter: blur(15px);
    z-index: -1;
  }

  .app-banner-container .close-btn {
    background: none;
    border: none;
    color: #888;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.5rem;
    margin-right: 0.5rem;
    line-height: 1;
    position: relative;
    top: auto;
    right: auto;
  }

  .app-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  .app-icon {
    width: 42px;
    height: 42px;
    background: #222;
    border-radius: 10px;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  }

  .app-icon img {
    width: 100%;
    height: 100%;
  }

  .app-info {
    display: flex;
    flex-direction: column;
  }

  .app-title {
    font-weight: 800;
    font-size: 0.9rem;
    color: #fff;
  }

  .app-desc {
    font-size: 0.7rem;
    color: #aaa;
  }

  .install-btn {
    background: var(--accent-color);
    color: #000;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 10px;
    font-weight: 800;
    font-size: 0.85rem;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .install-btn:hover {
    transform: scale(1.05);
  }

  .confirm-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .confirm-dialog {
    text-align: center;
    padding: 0.5rem;
  }

  .confirm-dialog p {
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }
</style>


