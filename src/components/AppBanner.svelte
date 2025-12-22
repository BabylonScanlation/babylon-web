<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';

  let isVisible = false;
  let showConfirmation = false;
  let hasClosed = false;

  // URL de la app (puedes ajustarla según sea necesario)
  const appUrl = 'https://pub-2e7d3fdb6a36489c808eaae6d2263bc7.r2.dev/babylonweb-app/DtupScan.apk';

  onMount(() => {
    // Verificar si el usuario ya lo cerró
    const closedStatus = localStorage.getItem('app-banner-closed');
    const lastClosedTime = localStorage.getItem('app-banner-closed-time');
    
    if (closedStatus === 'true') {
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (lastClosedTime && (Date.now() - parseInt(lastClosedTime)) < sevenDays) {
        hasClosed = true;
      }
    }

    // Solo mostrar en móviles (o pantallas pequeñas) y si no ha cerrado
    if (!hasClosed && window.innerWidth < 768) {
      setTimeout(() => {
        isVisible = true;
      }, 4000); // Aparece tras 4 segundos para no ser intrusivo
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
    <div class="app-banner-content">
      <button class="close-btn" onclick={closeBanner} aria-label="Cerrar aviso">
        &times;
      </button>
      
      <div class="app-icon">
        <img src="/favicon.svg" alt="Babylon Logo" />
      </div>
      
      <div class="app-text">
        <p class="app-title">Babylon App</p>
        <p class="app-subtitle">Una mejor experiencia de lectura</p>
      </div>
      
      <button class="install-btn" onclick={handleInstallClick}>
        INSTALAR
      </button>
    </div>
  </div>
{/if}

{#if showConfirmation}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" onclick={cancelDownload} in:fade={{ duration: 200 }}>
    <div class="confirmation-modal" onclick={(e) => e.stopPropagation()}>
      <h3>¿Descargar Babylon App?</h3>
      <p>Estás a punto de descargar el archivo instalador (.APK) para Android.</p>
      
      <div class="modal-actions">
        <button class="btn-cancel" onclick={cancelDownload}>Cancelar</button>
        <button class="btn-confirm" onclick={confirmDownload}>Descargar ahora</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .app-banner-container {
    position: fixed;
    bottom: 15px;
    left: 10px;
    right: 10px;
    z-index: 9999;
    pointer-events: none;
  }

  .app-banner-content {
    pointer-events: auto;
    background: rgba(20, 20, 20, 0.9);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    position: relative;
    max-width: 500px;
    margin: 0 auto;
  }

  .close-btn {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 24px;
    height: 24px;
    background: #333;
    color: #fff;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }

  .app-icon {
    width: 44px;
    height: 44px;
    background: #000;
    border-radius: 10px;
    margin-right: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.1);
  }

  .app-icon img {
    width: 32px;
    height: 32px;
  }

  .app-text {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .app-title {
    margin: 0;
    font-weight: 700;
    font-size: 0.95rem;
    color: #fff;
  }

  .app-subtitle {
    margin: 0;
    font-size: 0.75rem;
    color: #aaa;
  }

  .install-btn {
    background-color: var(--accent-color, #00bfff);
    color: #fff;
    border: none;
    border-radius: 20px;
    padding: 8px 16px;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .install-btn:active {
    transform: scale(0.95);
  }

  /* Modal de confirmación */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
  }

  .confirmation-modal {
    background: #1e1e1e;
    border: 1px solid #333;
    border-radius: 20px;
    padding: 24px;
    width: 100%;
    max-width: 320px;
    text-align: center;
    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
  }

  .confirmation-modal h3 {
    margin-top: 0;
    margin-bottom: 12px;
    font-size: 1.25rem;
    color: #fff;
  }

  .confirmation-modal p {
    font-size: 0.9rem;
    color: #ccc;
    line-height: 1.5;
    margin-bottom: 24px;
  }

  .modal-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .modal-actions button {
    width: 100%;
    padding: 12px;
    border-radius: 12px;
    font-weight: bold;
    font-size: 1rem;
    cursor: pointer;
    border: none;
  }

  .btn-confirm {
    background-color: var(--accent-color, #00bfff);
    color: #fff;
  }

  .btn-cancel {
    background-color: transparent;
    color: #888;
  }
</style>
