<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import ImageWorker from '../lib/workers/image-processor.worker?worker';

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page: any;
    alt?: string;
    watermark?: string;
    loading?: "eager" | "lazy";
  }

  let { page, alt = "", watermark = "", loading = "lazy" }: Props = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let container = $state<HTMLDivElement | null>(null);
  let isLoading = $state(true);
  let error = $state(false);
  let useFallback = $state(false); 
  
  // Orion: Calculate aspect ratio to prevent CLS
  const aspectRatio = $derived(
    page.width && page.height 
      ? page.width / page.height 
      : 0.707 // A4 Standard Fallback
  );

  let observer: IntersectionObserver | undefined;
  let worker: Worker | null = null;

  onMount(() => {
    // console.log(`[ReaderPage] Mount: ${alt} (Loading: ${loading})`);
    if (loading === 'eager') {
      loadPageData();
    } else {
      observer = new IntersectionObserver(([entry], _self) => {
        if (entry?.isIntersecting) {
          // console.log(`[ReaderPage] Visible: ${alt}`);
          loadPageData();
          _self.disconnect();
        }
      }, { rootMargin: '800px' }); // Margin for mobile
      if (container) observer.observe(container);
    }
  });

  onDestroy(() => {
    if (observer) observer.disconnect();
    if (worker) {
        worker.terminate();
        worker = null;
    }
  });

  async function loadPageData(retries = 2) {
    try {
        // Try worker first
        // console.log(`[ReaderPage] Attempting worker load for ${alt} (Retries left: ${retries})`);
        await processWithWorker();
        // console.log(`[ReaderPage] Worker success for ${alt}`);
    } catch (e) {
      console.warn(`[ReaderPage] Worker error for ${alt}:`, e);
      if (retries > 0) {
          // console.warn(`[ReaderPage] Retrying worker... (${retries} left)`);
          setTimeout(() => loadPageData(retries - 1), 1500);
          return;
      }
      console.warn('[ReaderPage] Worker failed final attempt, using fallback <img>');
      // Fallback to standard <img> tag
      useFallback = true;
      isLoading = false;
      error = false; // Reset error so fallback can show
    }
  }

  function processWithWorker() {
      return new Promise<void>((resolve, reject) => {
          // Check for basic support
          if (typeof Worker === 'undefined' || !window.OffscreenCanvas) {
              return reject('Environment not supported');
          }

          if (!worker) {
              try {
                worker = new ImageWorker();
              } catch {
                return reject('Failed to initialize worker');
              }
          }

          if (!worker) return reject('Worker not available');

          worker.onmessage = (ev: MessageEvent) => {
              const { success, bitmap, error: workerError } = ev.data;
              
              if (success && bitmap && canvas) {
                  canvas.width = bitmap.width;
                  canvas.height = bitmap.height;
                  const ctx = canvas.getContext('2d', { alpha: false });
                  if (ctx) {
                      ctx.drawImage(bitmap, 0, 0);
                      bitmap.close();
                      isLoading = false;
                      resolve();
                  } else {
                      reject('Canvas context failed');
                  }
              } else {
                  reject(workerError || 'Worker returned failure');
              }
          };

          worker.onerror = (ev: ErrorEvent) => {
              reject(ev.message || 'Worker error');
          };

          // Resolve absolute URLs before sending to worker
          const resolveUrl = (rel: string) => {
              if (rel.startsWith('http') || rel.startsWith('/')) return new URL(rel, window.location.href).href;
              // If it's a relative path without leading slash, resolve it from the root origin
              return new URL(`/${rel}`, window.location.origin).href;
          };
          const finalUrl = page.imageUrl || page.url;

          const message: { 
              watermark: string, 
              type?: 'single' | 'tiled', 
              data?: unknown 
          } = { watermark };
          
          if (page.tiles && page.tiles.length > 0) {
              message.type = 'tiled';
              message.data = {
                  ...page,
                  tiles: page.tiles.map(resolveUrl)
              };
          } else if (finalUrl) {
              message.type = 'single';
              message.data = { url: resolveUrl(finalUrl) };
          } else {
              reject('Missing data');
              return;
          }

          worker.postMessage(message);
      });
  }
</script>

<div 
  bind:this={container} 
  class="page-container" 
  class:has-error={error && !useFallback}
>
  {#if isLoading}
    <div class="skeleton-loader" transition:fade={{ duration: 200 }}>
        <div class="shimmer"></div>
        <div class="skeleton-logo">
            <svg viewBox="0 0 24 24" width="32" height="32" stroke="rgba(255,255,255,0.1)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
        </div>
    </div>
  {/if}
  
  {#if error && !useFallback}
    <div class="error-wrapper" in:fade>
        <div class="error-glass-card">
            <div class="error-icon-container">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline><line x1="16" y1="16" x2="19" y2="19"></line><line x1="19" y1="16" x2="16" y2="19"></line></svg>
                <div class="icon-pulse"></div>
            </div>
            <div class="error-info">
                <span class="error-title">Interrupción de Enlace</span>
                <p class="error-text">No pudimos recuperar este fragmento del servidor.</p>
            </div>
            <button class="premium-retry-btn" onclick={() => { 
                error = false; 
                isLoading = true; 
                if (worker) { worker.terminate(); worker = null; } 
                loadPageData(); 
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
              <span>Sincronizar de nuevo</span>
            </button>
        </div>
    </div>
  {/if}

  {#if useFallback}
    <!-- Fallback for browsers with limited worker/canvas support -->
    <div class="fallback-wrapper" style="width: 100%; display: flex; flex-direction: column; position: relative;">
      {#if watermark}
        <div class="css-watermark-overlay" aria-hidden="true">
          <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
          {#each Array(10) as _, i (i)}
            <div class="wm-row" style="margin-left: {i % 2 === 0 ? '-10%' : '10%'}">
              <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
              {#each Array(2) as __, j (j)}
                <span>{watermark}</span>
              {/each}
            </div>
          {/each}
        </div>
      {/if}
      <img 
        src={page.imageUrl || page.url} 
        {alt} 
        class="fallback-img"
        style="width: 100%; height: auto; display: block;"
        class:hidden={isLoading}
        loading={loading}
        decoding="async"
        onload={() => isLoading = false}
        onerror={() => { error = true; useFallback = false; }}
      />
    </div>
  {:else}
    <canvas 
      bind:this={canvas} 
      class:hidden={isLoading || error}
      title={alt}
    ></canvas>
  {/if}
</div>

<style>
  .page-container {
    width: 100%;
    min-height: 100px; /* Reducido para evitar saltos pero permitir colapso */
    position: relative;
    background: transparent;
    margin-bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    overflow: hidden;
  }

  @media (max-width: 768px) {
    .page-container.has-error {
      min-height: 100vh; /* Astra: Solo ocupar toda la pantalla si hay error */
    }
    .page-container {
      min-height: 50px; /* Mínimo para el loader inicial */
    }
  }

  /* Astra: Sombra para dar profundidad a la hoja flotante */
  canvas, .fallback-img {
    box-shadow: 0 0 40px rgba(0, 0, 0, 0.8);
  }

  /* Error State Styles */
  .error-wrapper {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: radial-gradient(circle at center, rgba(255, 68, 68, 0.1) 0%, transparent 80%);
  }

  .error-glass-card {
    background: rgba(15, 15, 15, 0.85);
    backdrop-filter: blur(25px);
    -webkit-backdrop-filter: blur(25px);
    border: 1px solid rgba(255, 68, 68, 0.3);
    border-radius: 32px;
    padding: 3.5rem 2.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 2rem;
    width: 90%;
    max-width: 420px;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8);
  }

  .error-icon-container {
    position: relative;
    color: #ff4444;
    background: rgba(255, 68, 68, 0.1);
    width: 70px;
    height: 70px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 20px;
  }

  .icon-pulse {
    position: absolute;
    inset: 0;
    border-radius: 20px;
    background: currentColor;
    opacity: 0.2;
    animation: icon-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  @keyframes icon-ping {
    0% { transform: scale(1); opacity: 0.2; }
    70%, 100% { transform: scale(1.5); opacity: 0; }
  }

  .error-info {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
  }

  .error-title {
    color: #fff;
    font-weight: 900;
    font-size: 1.3rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    line-height: 1.5;
    display: block;
  }

  .error-text {
    color: #888;
    font-size: 0.95rem;
    line-height: 1.6;
    margin: 0;
    max-width: 280px;
    margin: 0 auto;
  }

  .premium-retry-btn {
    background: #fff;
    color: #000;
    border: none;
    padding: 0.8rem 1.5rem;
    border-radius: 14px;
    font-weight: 800;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
    box-shadow: 0 4px 15px rgba(255, 255, 255, 0.1);
  }

  .premium-retry-btn:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 8px 25px rgba(255, 255, 255, 0.2);
  }

  .premium-retry-btn:active {
    transform: translateY(0) scale(0.98);
  }

  .premium-retry-btn svg {
    transition: transform 0.5s ease;
  }

  .premium-retry-btn:hover svg {
    transform: rotate(180deg);
  }

  .fallback-wrapper {
    width: 100%;
    line-height: 0;
  }

  .fallback-img {
    max-width: 100%;
    height: auto;
  }

  /* CSS Watermark for Fallback Path */
  .css-watermark-overlay {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    opacity: 0.15;
    user-select: none;
  }

  .wm-row {
    display: flex;
    justify-content: space-around;
    transform: rotate(-30deg) scale(1.2);
    white-space: nowrap;
    width: 150%;
    margin-left: -25%;
  }

  .wm-row span {
    font-family: sans-serif;
    font-weight: 900;
    font-size: 1.5rem;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  canvas {
    width: 100%;
    height: auto;
    display: block;
    animation: fade-in 0.5s ease-out;
  }

  .hidden { 
    display: none; 
    opacity: 0;
  }

  .placeholder {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, #111 0%, #020205 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .cosmos-loader {
    width: 50px;
    height: 50px;
    position: relative;
    animation: spin 2s linear infinite;
  }

  .orbit {
    position: absolute;
    inset: 0;
    border: 2px solid transparent;
    border-top-color: var(--accent-color);
    border-right-color: rgba(138, 43, 226, 0.8);
    border-radius: 50%;
    box-shadow: 0 0 15px rgba(0, 191, 255, 0.1);
  }

  .core {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 8px;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 0 15px #fff;
    animation: pulse-core 1.5s ease-in-out infinite alternate;
  }

  /* .loading-text {
    margin-top: 1.5rem;
    font-family: 'Inter', sans-serif;
    font-size: 0.6rem;
    letter-spacing: 0.25em;
    color: rgba(255,255,255,0.3);
    font-weight: 700;
    text-transform: uppercase;
  } */

  @keyframes pulse-core { from { opacity: 0.4; transform: translate(-50%, -50%) scale(0.8); } to { opacity: 0.9; transform: translate(-50%, -50%) scale(1.2); } }

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Skeleton Loader */
  .skeleton-loader {
    position: absolute;
    inset: 0;
    background: #0f0f0f;
    z-index: 10;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px; /* Optional rounded corners */
  }

  .shimmer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.04) 50%,
      transparent 100%
    );
    transform: skewX(-20deg) translateX(-150%);
    animation: shimmer-anim 1.5s infinite;
  }

  .skeleton-logo {
    opacity: 0.2;
    animation: pulse-logo 2s ease-in-out infinite;
  }

  @keyframes shimmer-anim {
    0% { transform: skewX(-20deg) translateX(-150%); }
    100% { transform: skewX(-20deg) translateX(150%); }
  }

  @keyframes pulse-logo {
    0%, 100% { transform: scale(0.95); opacity: 0.1; }
    50% { transform: scale(1.05); opacity: 0.3; }
  }
</style>