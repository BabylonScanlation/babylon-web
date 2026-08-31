<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import { cubicOut } from 'svelte/easing';
import { fade, fly, scale } from 'svelte/transition';
import { authModal } from '../lib/stores.svelte';
import { siteConfig } from '../site.config';

// Svelte 5 Runes
let isOpen = $state(false);
let activeTab = $state<'monthly' | 'onetime'>('onetime');
let customAmount = $state<string>('');

// Flujo de Checkout
let checkoutStep = $state<'tiers' | 'crypto_payment' | 'success_crypto'>('tiers');
let selectedTier = $state<any>(null);
let checkoutAmount = $state<string>('');
let isMonthlyCheckout = $state<boolean>(false);
let txHash = $state<string>('');
let cryptoCurrency = $state<string>('XMR');
let isSubmitting = $state(false);
let errorMessage = $state<string>('');

// Lista de niveles (Tiers)
const tiers = [
  {
    id: 1,
    name: 'Caballero',
    price: '0.05',
    color: '#94a3b8', // Plata/Gris
    imagePlaceholder: 'https://placehold.co/400x300/1e293b/94a3b8?text=Imagen+Caballero',
    desc: 'Solo si quieres ayudar a la página.',
    perks: [
      'Navegación **sin anuncios**.',
      'Agradecimiento en la página de "Patrones".',
      '**Insignia de nivel** propia al comentar.',
    ],
  },
  {
    id: 2,
    name: 'Barón',
    price: '0.50',
    color: '#34d399', // Esmeralda
    imagePlaceholder: 'https://placehold.co/400x300/064e3b/34d399?text=Imagen+Baron',
    desc: 'Todo lo de Caballero, más...',
    perks: [
      'Lectura **Full HD** (sin compresión extra).',
      'Acceso al **apartado personalizable** (tema, fondo, tipografía).',
      'Acceso al **servidor de Discord**.',
    ],
  },
  {
    id: 3,
    name: 'Vizconde',
    price: '1.50',
    color: '#3b82f6', // Azul
    imagePlaceholder: 'https://placehold.co/400x300/1e3a8a/3b82f6?text=Imagen+Vizconde',
    desc: 'Todo lo de Barón, más...',
    perks: [
      'Ver **capítulos exclusivos** bloqueados para VIPs.',
      '**Descarga** de hasta X capítulos al mes.',
      'Lectura sin **marca de agua**.',
      '**Rol especial** en Discord.',
    ],
  },
  {
    id: 4,
    name: 'Conde',
    price: '3.50',
    color: '#a855f7', // Púrpura
    imagePlaceholder: 'https://placehold.co/400x300/4c1d95/a855f7?text=Imagen+Conde',
    desc: 'Todo lo de Vizconde, más...',
    perks: [
      '**Descargas ilimitadas** de capítulos (sin marca de agua).',
      '**Votar** en encuestas para decidir qué manga subir primero.',
    ],
  },
  {
    id: 5,
    name: 'Rey',
    price: '5.00',
    color: '#f59e0b', // Oro
    imagePlaceholder: 'https://placehold.co/400x300/78350f/f59e0b?text=Imagen+Rey',
    desc: 'Todo lo de Conde, más...',
    perks: [
      '**Proponer** una serie para traducir.',
      'Eliminar **censura** en hasta X capítulos al mes.',
      'Acceso al **canal privado** con el progreso de scans.',
    ],
  },
  {
    id: 6,
    name: 'Emperador',
    price: '8.30',
    color: '#ef4444', // Rubí
    imagePlaceholder: 'https://placehold.co/400x300/7f1d1d/ef4444?text=Imagen+Emperador',
    desc: 'Todo lo de Rey, más...',
    perks: [
      '**Sponsorship**: tu logo/texto en la página y en cada capítulo.',
      '**Fanart personalizado** de cualquier personaje, tal como lo desees.',
    ],
  },
];

const preSetAmounts = [0.5, 1, 2, 3, 5];

function handleOpen() {
  isOpen = true;
  document.body.style.overflow = 'hidden';
}

function handleClose() {
  isOpen = false;
  document.body.style.overflow = '';
  setTimeout(() => {
    checkoutStep = 'tiers';
    txHash = '';
    isSubmitting = false;
    errorMessage = '';
  }, 300);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen) {
    handleClose();
  }
}

onMount(() => {
  window.addEventListener('open-support-modal', handleOpen);
  window.addEventListener('keydown', onKeydown);
});

onDestroy(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('open-support-modal', handleOpen);
    window.removeEventListener('keydown', onKeydown);
  }
});

function processPayment(tierOrAmount: any, isMonthly: boolean) {
  if (isMonthly) {
    const userStateStr = document.body.getAttribute('data-user-state');
    if (!userStateStr || userStateStr === 'null') {
      handleClose();
      authModal.open('login', 'Debes iniciar sesión para obtener tu nivel VIP.');
      return;
    }
  }

  selectedTier = isMonthly ? tierOrAmount : null;
  checkoutAmount = isMonthly ? tierOrAmount.price : tierOrAmount.toString();
  isMonthlyCheckout = isMonthly;
  if (isMonthly && cryptoCurrency === 'XMR') {
    cryptoCurrency = 'USDT';
  }
  checkoutStep = 'crypto_payment';
}

async function submitCryptoPayment() {
  if (!txHash) return;
  isSubmitting = true;
  try {
    const userStateStr = document.body.getAttribute('data-user-state');

    const res = await fetch('/api/payments/crypto', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-state': userStateStr || '',
      },
      body: JSON.stringify({
        type: isMonthlyCheckout ? 'subscription' : 'donation',
        tier: selectedTier?.id || 1,
        amount: parseFloat(checkoutAmount),
        currency: cryptoCurrency,
        txHash: txHash,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      checkoutStep = 'success_crypto';
      errorMessage = '';
    } else {
      errorMessage = data.error || 'Error al procesar el pago. Intenta de nuevo.';
    }
  } catch {
    errorMessage = 'Error de conexión. Verifica tu internet y vuelve a intentar.';
  } finally {
    isSubmitting = false;
  }
}

function handleMouseMove(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  target.style.setProperty('--mouse-x', `${x}px`);
  target.style.setProperty('--mouse-y', `${y}px`);

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const rotateX = ((y - centerY) / centerY) * -8;
  const rotateY = ((x - centerX) / centerX) * 8;

  target.style.setProperty('--rotate-x', `${rotateX}deg`);
  target.style.setProperty('--rotate-y', `${rotateY}deg`);
}

function handleMouseLeave(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement;
  target.style.setProperty('--rotate-x', `0deg`);
  target.style.setProperty('--rotate-y', `0deg`);
  target.style.setProperty('--mouse-x', `50%`);
  target.style.setProperty('--mouse-y', `50%`);
}
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-backdrop"
    in:fade={{ duration: 300 }}
    out:fade={{ duration: 200 }}
    onclick={handleClose}
  >
    <div
      class="modal-container"
      in:scale={{ duration: 400, start: 0.95, easing: cubicOut }}
      out:scale={{ duration: 200, start: 0.95 }}
      onclick={(e) => e.stopPropagation()}
      onmousemove={handleMouseMove}
      onmouseleave={handleMouseLeave}
    >
      <!-- Decoración de fondo premium (siempre visible) -->
      <div class="bg-glow"></div>

      <!-- Botón Cerrar -->
      <button class="close-btn" onclick={handleClose} aria-label="Cerrar modal">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><line x1="18" y1="6" x2="6" y2="18"></line><line
            x1="6"
            y1="6"
            x2="18"
            y2="18"
          ></line></svg
        >
      </button>

      {#if checkoutStep === 'tiers'}
        <!-- Header del Modal -->
        <header class="modal-header">
          <div class="heart-icon-wrapper">
            <svg
              class="heart-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              ></path></svg
            >
          </div>
          <h2>Apoya a la Comunidad</h2>
          <p>
            Tu contribución nos permite mantener los servidores encendidos,
            mejorar el contenido y traer capítulos más rápido.
          </p>

          <!-- Pestañas (Ocultas temporalmente a petición del admin) -->
          <div class="tabs-container" style="display: none;">
            <button
              class="tab-btn"
              class:active={activeTab === 'monthly'}
              onclick={() => (activeTab = 'monthly')}
            >
              Membresías
            </button>
            <button
              class="tab-btn"
              class:active={activeTab === 'onetime'}
              onclick={() => (activeTab = 'onetime')}
            >
              Aporte Único
            </button>
          </div>
        </header>

        <!-- Contenido del Modal -->
        <div class="modal-content">
          {#if activeTab === 'monthly'}
            <!-- Tiers Horizontales -->
            <div
              class="tiers-scroll-container"
              in:fly={{ y: 20, duration: 300 }}
            >
              <div class="tiers-track">
                {#each tiers as tier (tier.id)}
                  <div class="tier-card" style="--tier-color: {tier.color}">
                    <div class="tier-header-simple">
                      <!-- Las imágenes están desactivadas temporalmente a petición del usuario.
                         Cuando estén listas, restaurar la clase tier-image-wrapper y descomentar:
                    <img src={tier.imagePlaceholder} alt="Tier {tier.name}" loading="lazy" />
                    <div class="tier-image-overlay"></div>
                    -->
                      <div class="tier-badge">{tier.name}</div>
                    </div>

                    <div class="tier-body">
                      <div class="tier-price-header">
                        <span class="currency">$</span>
                        <span class="amount">{tier.price}</span>
                        <span class="period">/ mes</span>
                      </div>

                      <p class="tier-desc">{tier.desc}</p>

                      <ul class="tier-perks">
                        {#each tier.perks as perk (perk)}
                          <li>
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="3"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              ><polyline points="20 6 9 17 4 12"
                              ></polyline></svg
                            >
                            <span>
                              {#each perk.split('**') as part, index (index)}
                                {#if index % 2 === 1}
                                  <strong>{part}</strong>
                                {:else}
                                  {part}
                                {/if}
                              {/each}
                            </span>
                          </li>
                        {/each}
                      </ul>
                    </div>

                    <div class="tier-footer">
                      <button
                        class="subscribe-btn"
                        onclick={() => processPayment(tier, true)}
                      >
                        Unirse ahora
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <!-- Aporte Único -->
            <div class="onetime-container" in:fly={{ y: 20, duration: 300 }}>
              <div class="onetime-hero">
                <h3>Haz un Aporte</h3>
                <p>
                  Tu aporte nos ayuda a dedicar más tiempo a traducir nuevos capítulos y mejorar el proyecto. ¡Mil gracias por tu apoyo!
                </p>
              </div>

              <div class="preset-amounts">
                {#each preSetAmounts as amt (amt)}
                  <button
                    class="preset-btn"
                    class:active={customAmount === amt.toString()}
                    onclick={() => (customAmount = amt.toString())}
                  >
                    ${amt}
                  </button>
                {/each}
              </div>

              <div class="custom-amount-wrapper">
                <span class="currency-prefix">$</span>
                <input
                  type="number"
                  bind:value={customAmount}
                  placeholder="Otra cantidad (Ej: 15)"
                  min="1"
                  step="1"
                />
                <span class="currency-suffix">USD</span>
              </div>

              <div class="payment-actions">
                <button
                  class="donate-btn-primary crypto-btn"
                  disabled={!customAmount || parseFloat(customAmount) <= 0}
                  onclick={() => processPayment(customAmount, false)}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                  Pagar con Cripto (${customAmount || '0'})
                </button>

                <a
                  class="donate-btn-primary fiat-btn"
                  href={`https://ko-fi.com/${siteConfig.donations.kofiUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                  Pagar con Tarjeta (Ko-fi)
                </a>
              </div>
            </div>
          {/if}
        </div>
      {:else if checkoutStep === 'crypto_payment'}
        <div class="checkout-pane crypto-pane" in:fade={{ duration: 200 }}>
          <button
            class="back-btn"
            onclick={() => (checkoutStep = 'tiers')}>← Volver</button
          >


          <div class="crypto-web3-container">
            <!-- Selector de Moneda tipo Segmented Control -->
            <div class="web3-segmented-control">
              {#if !isMonthlyCheckout}
                <button
                  class="web3-segment"
                  class:active={cryptoCurrency === 'XMR'}
                  onclick={() => (cryptoCurrency = 'XMR')}
                >
                  <img src="https://cryptologos.cc/logos/monero-xmr-logo.svg" alt="XMR" class="crypto-icon-small" /> XMR
                </button>
              {/if}
              <button
                class="web3-segment"
                class:active={cryptoCurrency === 'USDT'}
                onclick={() => (cryptoCurrency = 'USDT')}
              >
                <img src="https://cryptologos.cc/logos/tether-usdt-logo.svg" alt="USDT" class="crypto-icon-small" /> USDT (TRC20)
              </button>
              <button
                class="web3-segment"
                class:active={cryptoCurrency === 'BTC'}
                onclick={() => (cryptoCurrency = 'BTC')}
              >
                <img src="https://cryptologos.cc/logos/bitcoin-btc-logo.svg" alt="BTC" class="crypto-icon-small" /> BTC (Bitcoin)
              </button>
              <button
                class="web3-segment"
                class:active={cryptoCurrency === 'ETH'}
                onclick={() => (cryptoCurrency = 'ETH')}
              >
                <img src="https://cryptologos.cc/logos/ethereum-eth-logo.svg" alt="ETH" class="crypto-icon-small" /> ETH (ERC20)
              </button>
            </div>

            <!-- VIP Black Card -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div 
              class="vip-black-card"
              onmousemove={handleMouseMove}
              onmouseleave={handleMouseLeave}
            >
              <div class="vip-card-glare"></div>
              
              <div class="vip-card-content">
                <div class="vip-qr-side">
                  {#if cryptoCurrency === 'XMR'}
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=monero:${siteConfig.donations.crypto.xmr}`} alt="QR XMR" class="vip-qr-code" />
                  {:else if cryptoCurrency === 'USDT'}
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${siteConfig.donations.crypto.usdt}`} alt="QR USDT" class="vip-qr-code" />
                  {:else if cryptoCurrency === 'BTC'}
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=bitcoin:${siteConfig.donations.crypto.btc}`} alt="QR BTC" class="vip-qr-code" />
                  {:else}
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=ethereum:${siteConfig.donations.crypto.eth}`} alt="QR ETH" class="vip-qr-code" />
                  {/if}
                </div>
                
                <div class="vip-details-side">
                  <div class="vip-detail-row">
                    <span class="vip-label">MONTO A ENVIAR</span>
                    <span class="vip-value highlight">${checkoutAmount} USD</span>
                  </div>
                  
                  <div class="vip-detail-row">
                    <span class="vip-label">DIRECCIÓN {cryptoCurrency}{cryptoCurrency === 'USDT' ? ' (TRC20)' : cryptoCurrency === 'ETH' ? ' (ERC20)' : cryptoCurrency === 'BTC' ? ' (Bitcoin)' : ''}</span>
                    <div class="vip-address-box">
                      {#if cryptoCurrency === 'XMR'}
                        {siteConfig.donations.crypto.xmr}
                      {:else if cryptoCurrency === 'USDT'}
                        {siteConfig.donations.crypto.usdt}
                      {:else if cryptoCurrency === 'BTC'}
                        {siteConfig.donations.crypto.btc}
                      {:else}
                        {siteConfig.donations.crypto.eth}
                      {/if}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cyber Input -->
            <div class="cyber-input-group" class:error={!!errorMessage}>
              <input
                id="txhash"
                type="text"
                bind:value={txHash}
                oninput={() => (errorMessage = '')}
                placeholder="Pega el Hash para verificar en tiempo real..."
              />
              <button
                class="cyber-submit-btn"
                disabled={!txHash || isSubmitting}
                onclick={submitCryptoPayment}
              >
                {isSubmitting ? 'VERIFICANDO...' : 'VERIFICAR RED'}
              </button>
            </div>
            
            {#if errorMessage}
              <div class="cyber-error" in:fade={{ duration: 200 }}>
                {errorMessage}
              </div>
            {/if}
          </div>
        </div>
      {:else if checkoutStep === 'success_crypto'}
        <div class="checkout-pane success-pane" in:fade={{ duration: 300 }}>
          <div class="success-icon-wrapper">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><polyline points="20 6 9 17 4 12"></polyline></svg
            >
          </div>
          <h3>¡Gracias por tu apoyo!</h3>
          <p>Hemos recibido tu solicitud.</p>
          <p class="success-desc">
            Pago 100% automatizado e instantáneamente verificado en la blockchain. 
            <strong>Tu nivel VIP ya está activado y listo para usarse.</strong>
          </p>
          <button class="done-btn" onclick={handleClose}>Entendido</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    box-sizing: border-box;
  }

  .modal-container {
    position: relative;
    width: 100%;
    max-width: 650px;
    max-height: 90vh;
    background: rgba(10, 10, 12, 0.98);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-top: 2px solid rgba(59, 130, 246, 0.8);
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column; /* Single column layout */
    overflow: hidden;
    transition: box-shadow 0.3s ease;
  }

  .modal-container:hover {
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.8);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .bg-glow {
    position: absolute;
    top: -50%;
    left: -10%;
    width: 120%;
    height: 100%;
    background: radial-gradient(
      circle,
      rgba(255, 140, 0, 0.15) 0%,
      rgba(15, 23, 42, 0) 70%
    );
    pointer-events: none;
    z-index: 0;
  }

  .close-btn {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    transform: rotate(90deg);
  }

  .close-btn svg {
    width: 18px;
    height: 18px;
  }

  .modal-header {
    display: none; /* Oculto a petición para dejar un diseño directo */
  }

  .heart-icon-wrapper {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ff5500, #ffaa00);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
    box-shadow: 0 0 20px rgba(255, 140, 0, 0.4);
    animation: pulse-heart 2s infinite;
  }

  .heart-icon {
    width: 28px;
    height: 28px;
    color: white;
    fill: rgba(255, 255, 255, 0.3);
  }

  @keyframes pulse-heart {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(255, 140, 0, 0.4);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 0 0 10px rgba(255, 140, 0, 0);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(255, 140, 0, 0);
    }
  }

  .modal-header h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.8rem;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.5px;
    line-height: 1.2;
  }

  .modal-header p {
    margin: 0;
    color: #94a3b8;
    line-height: 1.5;
    font-size: 0.95rem;
  }

  .tabs-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 0.5rem;
    margin-top: auto; /* Pushes tabs to the bottom of the sidebar */
  }

  .tab-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: #94a3b8;
    font-weight: 600;
    font-size: 0.95rem;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s;
    text-align: left;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .tab-btn.active {
    background: rgba(255, 170, 0, 0.1);
    border-color: #ffaa00;
    color: #ffaa00;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  .tab-btn.active::after {
    content: '→';
    font-weight: bold;
  }

  .modal-content {
    position: relative;
    z-index: 1;
    flex-grow: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    /* Removed padding so scroll container can take full height */
  }

  /* --- TIERS SCROLL --- */
  .tiers-scroll-container {
    width: 100%;
    height: 100%;
    overflow-x: auto;
    padding: 2rem;
    padding-bottom: 1.5rem;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    scrollbar-color: rgba(255, 170, 0, 0.5) rgba(0, 0, 0, 0.2);
    scrollbar-width: thin;
  }

  .tiers-scroll-container::-webkit-scrollbar {
    height: 8px;
  }
  .tiers-scroll-container::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    margin: 0 2rem;
  }
  .tiers-scroll-container::-webkit-scrollbar-thumb {
    background: rgba(255, 170, 0, 0.5);
    border-radius: 10px;
  }
  .tiers-scroll-container::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 170, 0, 0.8);
  }

  .tiers-track {
    display: inline-flex;
    gap: 1.5rem;
    scroll-snap-type: x mandatory;
    padding-right: 2rem;
    height: 100%; /* Make track fill container */
    align-items: center;
  }

  .tier-card {
    flex: 0 0 320px;
    scroll-snap-align: center;
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-top: 2px solid var(--tier-color);
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: all 0.3s ease;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    position: relative;
  }

  .tier-card:hover {
    transform: translateY(-5px);
    box-shadow:
      0 15px 40px rgba(0, 0, 0, 0.5),
      0 0 20px rgba(var(--tier-color-rgb), 0.1);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .tier-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100px;
    background: linear-gradient(180deg, var(--tier-color) 0%, transparent 100%);
    opacity: 0.05;
    pointer-events: none;
  }

  .tier-header-simple {
    width: 100%;
    padding: 1.5rem 1.5rem 0 1.5rem;
    position: relative;
    display: flex;
    align-items: flex-start;
  }

  .tier-badge {
    background: var(--tier-color);
    color: #fff;
    font-weight: 800;
    font-size: 0.85rem;
    padding: 0.4rem 1rem;
    border-radius: 100px;
    text-transform: uppercase;
    letter-spacing: 1px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    display: inline-block;
  }

  .tier-body {
    padding: 1.5rem 1.5rem 1.5rem 1.5rem;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
  }

  .tier-price-header {
    display: flex;
    align-items: baseline;
    gap: 2px;
    color: #fff;
    margin-bottom: 0.5rem;
  }

  .tier-price-header .currency {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--tier-color);
  }

  .tier-price-header .amount {
    font-size: 2.5rem;
    font-weight: 800;
    letter-spacing: -1px;
  }

  .tier-price-header .period {
    font-size: 1rem;
    color: #94a3b8;
    margin-left: 0.2rem;
  }

  .tier-desc {
    font-size: 0.9rem;
    color: #cbd5e1;
    margin: 0 0 1.5rem 0;
    font-style: italic;
  }

  .tier-perks {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .tier-perks li {
    display: flex;
    align-items: flex-start;
    gap: 0.8rem;
    font-size: 0.9rem;
    color: #cbd5e1;
    line-height: 1.4;
  }

  .tier-perks li svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: var(--tier-color);
    margin-top: 2px;
  }

  .tier-footer {
    padding: 1.5rem;
    padding-top: 0;
  }

  .subscribe-btn {
    width: 100%;
    padding: 1rem;
    border-radius: 12px;
    border: none;
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tier-card:hover .subscribe-btn {
    background: var(--tier-color);
    border-color: var(--tier-color);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  }

  /* --- ONETIME DONATION --- */
  .onetime-container {
    max-width: 600px;
    margin: auto; /* Center in right pane */
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }
  
  .modal-container::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(
      800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
      rgba(255, 170, 0, 0.08),
      transparent 40%
    );
    pointer-events: none;
    z-index: 1;
    opacity: 0;
    transition: opacity 0.3s;
    border-radius: 24px;
  }
  
  .modal-container:hover::after {
    opacity: 1;
  }
  
  .modal-header, .onetime-hero, .preset-amounts, .custom-amount-wrapper, .donate-btn-primary {
    z-index: 2;
  }

  .onetime-hero {
    text-align: center;
    margin-bottom: 2rem;
  }


  .onetime-hero h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.8rem;
    color: #fff;
    font-weight: 700;
  }

  .onetime-hero p {
    margin: 0;
    color: #94a3b8;
    line-height: 1.5;
    font-size: 0.95rem;
  }

  .preset-amounts {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 2rem;
    width: 100%;
  }

  .preset-btn {
    flex: 1 1 calc(33.333% - 1rem);
    min-width: 80px;
    padding: 0.8rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #94a3b8;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .preset-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
    transform: translateY(-2px);
  }

  .preset-btn.active {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.8);
    color: #60a5fa;
  }

  .custom-amount-wrapper {
    display: flex;
    align-items: center;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0.5rem 1rem;
    width: 100%;
    margin-bottom: 1.5rem;
    transition: all 0.3s;
  }

  .custom-amount-wrapper:focus-within {
    border-color: rgba(59, 130, 246, 0.6);
    background: rgba(0, 0, 0, 0.5);
  }

  .currency-prefix {
    font-size: 1.25rem;
    color: #64748b;
    font-weight: 500;
  }

  .custom-amount-wrapper input {
    flex-grow: 1;
    background: transparent;
    border: none;
    color: #fff;
    font-size: 1.5rem;
    font-weight: 600;
    padding: 0.5rem;
    outline: none;
    text-align: center;
    width: 100%;
    appearance: textfield;
    -moz-appearance: textfield;
  }
  .custom-amount-wrapper input::-webkit-outer-spin-button,
  .custom-amount-wrapper input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .currency-suffix {
    color: #64748b;
    font-weight: 500;
  }

  .payment-actions {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
  }

  .donate-btn-primary {
    width: 100%;
    padding: 1rem;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.8);
    border-radius: 8px;
    color: #60a5fa;
    font-size: 1rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.3s;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    text-decoration: none;
  }
  
  .donate-btn-primary.fiat-btn {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
    color: #e2e8f0;
  }

  .donate-btn-primary.fiat-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: #fff;
    color: #fff;
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
  }
  
  .donate-btn-primary:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.2);
    color: #fff;
  }
  
  .donate-btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    border-color: #334155;
    color: #64748b;
    background: transparent;
  }
  
  .donate-btn-primary::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 50%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    transform: skewX(-20deg);
    transition: left 0.5s ease;
  }

  .donate-btn-primary:hover:not(:disabled)::before {
    left: 200%;
  }

  .donate-btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 30px rgba(255, 140, 0, 0.4);
  }

  .donate-btn-primary:disabled {
    background: #334155;
    color: #94a3b8;
    box-shadow: none;
    cursor: not-allowed;
  }

  /* --- CHECKOUT PANES --- */
  .checkout-pane {
    width: 100%;
    height: 100%;
    padding: 2rem 2.5rem;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    background: transparent;
    z-index: 2;
  }

  .back-btn {
    align-self: flex-start;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 1rem;
    padding: 0.5rem 0;
    transition: color 0.3s;
  }

  .back-btn:hover {
    color: #fff;
  }

  /* --- WEB3 RADICAL CRYPTO --- */
  .crypto-pane {
    align-items: center;
    padding: 1.5rem;
    overflow-y: hidden;
  }
  


  .crypto-web3-container {
    width: 100%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    position: relative;
  }

  .web3-segmented-control {
    display: flex;
    background: rgba(15, 23, 42, 0.8);
    padding: 0.35rem;
    border-radius: 14px;
    width: 100%;
    border: 1px solid rgba(255,255,255,0.05);
    box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
  }

  .web3-segment {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    background: transparent;
    border: none;
    color: #64748b;
    padding: 0.6rem 0;
    border-radius: 10px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .crypto-icon-small {
    width: 16px;
    height: 16px;
    opacity: 0.6;
    transition: all 0.3s;
  }

  .web3-segment:hover {
    color: #cbd5e1;
  }

  .web3-segment.active {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  
  .web3-segment.active .crypto-icon-small {
    opacity: 1;
  }

  .vip-black-card {
    background: #050505;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    width: 100%;
    position: relative;
    overflow: hidden;
    box-shadow: 0 15px 30px rgba(0,0,0,0.6);
    background-image: 
      radial-gradient(circle at 10% 20%, rgba(59, 130, 246, 0.08) 0%, transparent 40%),
      url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noiseFilter)" opacity="0.05"/></svg>');
  }
  
  .vip-card-glare {
    position: absolute;
    top: 0;
    left: -100%;
    width: 50%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
    transform: skewX(-20deg);
    animation: glare 8s infinite;
    pointer-events: none;
  }
  
  @keyframes glare {
    0%, 80% { left: -100%; }
    100% { left: 200%; }
  }

  .vip-card-content {
    display: flex;
    padding: 1.5rem;
    gap: 1.5rem;
    align-items: center;
  }

  .vip-qr-side {
    flex-shrink: 0;
    background: #fff;
    padding: 10px;
    border-radius: 8px;
    display: flex;
  }

  .vip-qr-code {
    width: 140px;
    height: 140px;
    display: block;
  }

  .vip-details-side {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
    text-align: left;
  }
  
  .vip-detail-row {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .vip-label {
    font-size: 0.75rem;
    font-weight: 800;
    color: #64748b;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .vip-value.highlight {
    font-size: 1.5rem;
    font-weight: 900;
    color: #60a5fa;
    text-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
  }

  .vip-address-box {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    color: #e2e8f0;
    word-break: break-all;
    user-select: all;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    cursor: copy;
    transition: background 0.2s;
  }
  
  .vip-address-box:hover {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.4);
  }

  /* --- CYBER INPUT --- */
  .cyber-input-group {
    display: flex;
    width: 100%;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  
  .cyber-input-group:focus-within {
    border-color: #3b82f6;
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
  }
  
  .cyber-input-group.error {
    border-color: #ef4444;
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
  }

  .cyber-input-group input {
    flex: 1;
    background: transparent;
    border: none;
    color: #fff;
    padding: 0.85rem 1rem;
    font-size: 0.8rem;
    outline: none;
    font-family: 'JetBrains Mono', monospace;
  }
  
  .cyber-input-group input::placeholder {
    color: #475569;
  }

  .cyber-submit-btn {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: #fff;
    border: none;
    padding: 0 1.25rem;
    font-weight: 900;
    font-size: 0.8rem;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cyber-submit-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #60a5fa, #3b82f6);
  }

  .cyber-submit-btn:disabled {
    background: #334155;
    color: #94a3b8;
    cursor: not-allowed;
  }

  .cyber-error {
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    padding: 0.6rem;
    border-radius: 10px;
    font-size: 0.75rem;
    text-align: center;
    width: 100%;
    font-weight: 600;
  }

  /* --- SUCCESS --- */
  .success-pane {
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .success-icon-wrapper {
    width: 80px;
    height: 80px;
    background: #34d399;
    color: #064e3b;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
    box-shadow: 0 0 30px rgba(52, 211, 153, 0.4);
  }

  .success-icon-wrapper svg {
    width: 40px;
    height: 40px;
  }

  .success-pane h3 {
    font-size: 2.5rem;
    color: #fff;
    margin-bottom: 0.5rem;
  }

  .success-desc {
    color: #94a3b8;
    max-width: 400px;
    line-height: 1.5;
    margin-bottom: 2rem;
  }

  .done-btn {
    background: #34d399;
    color: #064e3b;
    border: none;
    padding: 1rem 3rem;
    border-radius: 100px;
    font-weight: 800;
    font-size: 1.1rem;
    cursor: pointer;
  }

  @media (max-width: 900px) {
    .modal-container {
      flex-direction: column;
      max-height: 95vh;
    }
    .modal-header {
      width: 100%;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 1.5rem 1.5rem 1rem 1.5rem;
      border-right: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .modal-header h2 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    .modal-header p {
      margin-bottom: 1rem;
    }
    .tabs-container {
      flex-direction: row;
      margin-top: 0.5rem;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 100px;
      padding: 0.3rem;
    }
    .tab-btn {
      padding: 0.6rem 1.2rem;
      border-radius: 100px;
      border: none;
      text-align: center;
      justify-content: center;
    }
    .tab-btn.active {
      background: #1e293b;
      color: #fff;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    }
    .tab-btn.active::after {
      display: none;
    }
    .tier-card {
      flex: 0 0 280px;
    }
    .tiers-scroll-container {
      padding: 1.5rem;
    }
    .checkout-pane {
      padding: 2rem;
    }
  }

  @media (max-width: 600px) {
    .modal-container {
      width: 100%;
      max-width: 100%;
      max-height: 100vh;
      border-radius: 0;
      border: none;
      border-top: 2px solid rgba(59, 130, 246, 0.8);
    }
    .modal-header {
      padding: 1rem;
    }
    .checkout-pane, .crypto-pane {
      padding: 1.5rem 1rem;
    }
    .vip-card-content {
      flex-direction: column;
      text-align: center;
      gap: 1rem;
      padding: 1rem;
    }
    .vip-details-side {
      text-align: center;
      align-items: center;
      width: 100%;
    }
    .vip-address-box {
      font-size: 0.7rem;
      padding: 0.5rem;
    }
    .web3-segmented-control {
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .web3-segment {
      flex: 1 1 calc(50% - 0.5rem);
      padding: 0.6rem 0;
      font-size: 0.75rem;
    }
    .preset-amounts {
      gap: 0.5rem;
    }
    .preset-btn {
      padding: 0.6rem;
      font-size: 0.9rem;
    }
    .onetime-hero h3 {
      font-size: 1.4rem;
    }
    .donate-btn-primary {
      font-size: 0.9rem;
      padding: 0.8rem;
    }
  }
</style>
