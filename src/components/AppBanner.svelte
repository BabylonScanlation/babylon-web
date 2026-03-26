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


