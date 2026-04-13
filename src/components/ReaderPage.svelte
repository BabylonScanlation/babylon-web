<script lang="ts" module>
// Orion: Shared state strictly outside the Svelte component lifecycle
let globalWorker: Worker | null = null;
const globalWorkerQueue: (() => void)[] = [];
let isGlobalWorkerBusy = false;

function getSharedWorker() {
  if (typeof Worker === 'undefined') return null;
  if (!globalWorker) {
    try {
      globalWorker = new Worker(
        new URL('../lib/workers/image-processor.worker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch {
      return null;
    }
  }
  return globalWorker;
}

function processSharedQueue() {
  if (isGlobalWorkerBusy || globalWorkerQueue.length === 0) return;
  const nextTask = globalWorkerQueue.shift();
  if (nextTask) nextTask();
}
</script>

<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import { fade } from 'svelte/transition';

interface PageData {
  imageUrl?: string;
  url?: string;
  tiles?: string[];
  [key: string]: unknown;
}

interface Props {
  page: PageData;
  alt?: string;
  watermark?: string;
  loading?: 'eager' | 'lazy';
}

interface WorkerMessage {
  watermark: string;
  type?: 'single' | 'tiled';
  data?: {
    url?: string;
    tiles?: string[];
    [key: string]: unknown;
  };
}

let { page, alt = '', watermark = '', loading = 'lazy' }: Props = $props();

let canvas = $state<HTMLCanvasElement | null>(null);
let container = $state<HTMLDivElement | null>(null);
let isLoading = $state(true);
let error = $state(false);
let useFallback = $state(false);

let observer: IntersectionObserver | undefined;
let isLocalTaskQueued = false;
let loadTimeout: number;

onMount(() => {
  window.addEventListener('pageLoaded', handleGlobalPageLoad as EventListener);

  if (loading === 'eager') {
    void loadPageData();
  } else {
    const pageNum = getPageNum();
    if (pageNum <= 2) { 
      void loadPageData();
      return;
    }

    observer = new IntersectionObserver(
      ([entry], _self) => {
        if (entry?.isIntersecting) {
          clearTimeout(loadTimeout);
          loadTimeout = window.setTimeout(() => {
            void loadPageData();
          }, 50);
          _self.disconnect();
        }
      },
      { rootMargin: '800px' }
    );
    if (container) observer.observe(container);
  }
});

onDestroy(() => {
  window.removeEventListener('pageLoaded', handleGlobalPageLoad as EventListener);
  clearTimeout(loadTimeout);
  if (observer) observer.disconnect();
  isLocalTaskQueued = false;
});

function getPageNum(): number {
  const match = alt.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function handleGlobalPageLoad(e: CustomEvent<{ pageNum: number }>) {
  const loadedNum = e.detail.pageNum;
  const myNum = getPageNum();

  if (loadedNum === myNum - 1 || (myNum > loadedNum && myNum <= loadedNum + 2)) {
    if (isLoading) void loadPageData();
  }
}

async function loadPageData(retries = 2) {
  if (!isLoading && !error) return;

  try {
    error = false;
    await processWithWorker();
    window.dispatchEvent(new CustomEvent('pageLoaded', { detail: { pageNum: getPageNum() } }));
  } catch (e) {
    console.warn(`[ReaderPage] Worker error for ${alt}:`, e);
    if (retries > 0) {
      setTimeout(() => {
        void loadPageData(retries - 1);
      }, 1500);
      return;
    }
    // Astra: Show the error message UI first
    error = true;
    isLoading = false;
  }
}

// Astra: Provide a function to trigger fallback manually from the error UI
function handleFallback() {
  useFallback = true;
  error = false;
}

function processWithWorker() {
  return new Promise<void>((resolve, reject) => {
    if (isLocalTaskQueued) return resolve();
    
    if (typeof Worker === 'undefined' || !window.OffscreenCanvas) {
      return reject('Environment not supported');
    }

    const worker = getSharedWorker();
    if (!worker) {
      isLocalTaskQueued = false;
      return reject('Worker not available');
    }

    isLocalTaskQueued = true;

    const task = () => {
      // If component unmounted while queued, abort processing
      if (!isLocalTaskQueued) {
         processSharedQueue();
         return resolve();
      }

      isGlobalWorkerBusy = true;
      
      const messageHandler = (ev: MessageEvent) => {
        const { success, bitmap, error: workerError, url } = ev.data;
        
        const finalUrl = page.imageUrl || page.url;
        const expectedUrl = resolveUrl(finalUrl as string);
        
        if (url && url !== expectedUrl) {
           // Not for us. Since we use a queue, this shouldn't happen, but ignore just in case
           return;
        }
        
        worker.removeEventListener('message', messageHandler);
        worker.removeEventListener('error', errorHandler);
        
        if (success && bitmap && canvas) {
          setTimeout(() => {
            if (!canvas || !isLocalTaskQueued) {
               (bitmap as ImageBitmap).close();
               isGlobalWorkerBusy = false;
               processSharedQueue();
               return resolve();
            }
            canvas.width = (bitmap as ImageBitmap).width;
            canvas.height = (bitmap as ImageBitmap).height;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (ctx) {
              ctx.drawImage(bitmap as ImageBitmap, 0, 0);
              (bitmap as ImageBitmap).close();
              isLoading = false;
              isLocalTaskQueued = false;
              isGlobalWorkerBusy = false;
              processSharedQueue();
              resolve();
            } else {
              (bitmap as ImageBitmap).close();
              isLocalTaskQueued = false;
              isGlobalWorkerBusy = false;
              processSharedQueue();
              reject('Canvas context failed');
            }
          }, 0);
        } else {
          isLocalTaskQueued = false;
          isGlobalWorkerBusy = false;
          processSharedQueue();
          reject(workerError || 'Worker returned failure');
        }
      };

      const errorHandler = (ev: ErrorEvent) => {
        worker.removeEventListener('message', messageHandler);
        worker.removeEventListener('error', errorHandler);
        isLocalTaskQueued = false;
        isGlobalWorkerBusy = false;
        processSharedQueue(); // Orion: Continúa con la cola incluso si hay error
        reject(ev.message || 'Worker error');
      };

      worker.addEventListener('message', messageHandler);
      worker.addEventListener('error', errorHandler);

      const resolveUrl = (rel: string) => {
        if (rel.startsWith('http') || rel.startsWith('/'))
          return new URL(rel, window.location.href).href;
        return new URL(`/${rel}`, window.location.origin).href;
      };
      const finalUrl = page.imageUrl || page.url;

      const message: WorkerMessage = { watermark };
      if (page.tiles && (page.tiles as string[]).length > 0) {
        message.type = 'tiled';
        message.data = { ...page, tiles: (page.tiles as string[]).map(resolveUrl), url: finalUrl ? resolveUrl(finalUrl as string) : undefined };
      } else if (finalUrl) {
        message.type = 'single';
        message.data = { url: resolveUrl(finalUrl as string) };
      } else {
        isLocalTaskQueued = false;
        isGlobalWorkerBusy = false;
        worker.removeEventListener('message', messageHandler);
        worker.removeEventListener('error', errorHandler);
        processSharedQueue();
        reject('Missing data');
        return;
      }
      
      worker.postMessage(message);
    };

    globalWorkerQueue.push(task);
    processSharedQueue();
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
        <div class="scanner-line"></div>
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
            <div style="display: flex; gap: 0.5rem; justify-content: center;">
              <button class="retry-btn" onclick={() => { void loadPageData(); }}>Reintentar</button>
              <button class="retry-btn fallback-btn" onclick={handleFallback}>Modo Básico</button>
            </div>
        </div>
    </div>
  {/if}

  {#if useFallback}
    <div class="fallback-wrapper" style="background-image: url('{page.imageUrl || page.url}')" role="img" aria-label={alt}>
      <div class="glass-shield"></div>
    </div>
  {:else}
    <canvas 
      bind:this={canvas} 
      class:hidden={isLoading || error}
      oncontextmenu={(e) => e.preventDefault()}
    ></canvas>
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
    user-select: none;
    -webkit-user-drag: none;
  }

  .fallback-wrapper {
    width: 100%;
    height: 100%;
    min-height: 60vh;
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    position: relative;
  }

  .glass-shield {
    position: absolute;
    inset: 0;
    z-index: 10;
    background: transparent;
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
    background: url('/favicon.png') no-repeat center;
    background-size: contain;
    opacity: 0.2;
    animation: pulse 2s ease-in-out infinite;
  }

  .shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
    animation: shimmer-move 2s infinite;
  }

  /* Astra: Línea de escaneo para sugerir procesamiento JIT */
  .scanner-line {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--accent-color, #fff), transparent);
    box-shadow: 0 0 15px var(--accent-color, #fff);
    opacity: 0.5;
    z-index: 5;
    animation: scan-move 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  @keyframes scan-move {
    0% { top: 0; opacity: 0; }
    10% { opacity: 0.5; }
    90% { opacity: 0.5; }
    100% { top: 100%; opacity: 0; }
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
