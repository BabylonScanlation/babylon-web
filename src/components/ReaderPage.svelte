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
  
  let observer: IntersectionObserver | undefined;
  let worker: Worker | null = null;

  onMount(() => {
    if (loading === 'eager') {
      loadPageData();
    } else {
      observer = new IntersectionObserver(([entry], _self) => {
        if (entry?.isIntersecting) {
          loadPageData();
          _self.disconnect();
        }
      }, { rootMargin: '800px' });
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
        await processWithWorker();
    } catch (e) {
      console.warn(`[ReaderPage] Worker error for ${alt}:`, e);
      if (retries > 0) {
          setTimeout(() => loadPageData(retries - 1), 1500);
          return;
      }
      useFallback = true;
      isLoading = false;
      error = false;
    }
  }

  function processWithWorker() {
      return new Promise<void>((resolve, reject) => {
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

          const resolveUrl = (rel: string) => {
              if (rel.startsWith('http') || rel.startsWith('/')) return new URL(rel, window.location.href).href;
              return new URL(`/${rel}`, window.location.origin).href;
          };
          const finalUrl = page.imageUrl || page.url;

          const message: { watermark: string, type?: 'single' | 'tiled', data?: unknown } = { watermark };
          if (page.tiles && page.tiles.length > 0) {
              message.type = 'tiled';
              message.data = { ...page, tiles: page.tiles.map(resolveUrl) };
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
  class:is-loading={isLoading}
>
  {#if isLoading}
    <div class="loader-wrapper" transition:fade={{ duration: 200 }}>
        <div class="shimmer"></div>
        <div class="kinetic-loader">
            <div class="ring"></div>
            <div class="logo-core"></div>
        </div>
    </div>
  {/if}
  
  {#if error && !useFallback}
    <div class="error-wrapper" in:fade>
        <div class="error-card">
            <span class="error-title">Error de Carga</span>
            <button class="retry-btn" onclick={() => loadPageData()}>Reintentar</button>
        </div>
    </div>
  {/if}

  {#if useFallback}
    <div class="fallback-wrapper">
      <img src={page.imageUrl || page.url} {alt} class="fallback-img" loading={loading} decoding="async" onload={() => isLoading = false} />
    </div>
  {:else}
    <canvas bind:this={canvas} class:hidden={isLoading || error}></canvas>
  {/if}
</div>

<style>
  .page-container {
    width: 100%;
    /* Astra: Proporción 2:3 para simular una página real y evitar el colapso visual */
    aspect-ratio: 2 / 3;
    position: relative;
    background: #050505;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
  }

  /* Astra: Una vez cargada la imagen, quitamos el aspect-ratio fijo para que mande el contenido real */
  .page-container:not(.is-loading) {
    aspect-ratio: auto;
    background: transparent;
  }

  .loader-wrapper {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10;
  }

  /* Nuevo Cargador: Anillo Cinético Premium */
  .kinetic-loader {
    width: 64px;
    height: 64px;
    position: relative;
  }

  .ring {
    position: absolute;
    inset: 0;
    border: 2px solid rgba(255, 255, 255, 0.03);
    border-radius: 50%;
  }

  .ring::after {
    content: '';
    position: absolute;
    inset: -2px;
    border: 2px solid transparent;
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    filter: drop-shadow(0 0 10px var(--accent-color));
  }

  .logo-core {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 24px;
    height: 24px;
    background: url('/favicon.svg') no-repeat center;
    background-size: contain;
    opacity: 0.2;
    animation: pulse 2s ease-in-out infinite;
  }

  .shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.02), transparent);
    animation: shimmer-move 2s infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%, 100% { opacity: 0.1; transform: translate(-50%, -50%) scale(0.9); } 50% { opacity: 0.3; transform: translate(-50%, -50%) scale(1.1); } }
  @keyframes shimmer-move { from { transform: translateX(-100%); } to { transform: translateX(100%); } }

  canvas {
    width: 100%;
    height: auto;
    display: block;
    animation: fade-in 0.6s ease-out;
  }

  .hidden { display: none; }

  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

  /* Minimal Error Styles */
  .error-wrapper { position: absolute; inset: 0; display: flex; justify-content: center; align-items: center; background: rgba(255,0,0,0.05); }
  .error-card { text-align: center; color: #fff; }
  .error-title { display: block; font-size: 0.8rem; margin-bottom: 1rem; opacity: 0.5; }
  .retry-btn { background: #fff; color: #000; border: none; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 800; cursor: pointer; }
</style>