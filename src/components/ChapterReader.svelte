<script lang="ts">
import { fade, fly } from 'svelte/transition';
import { onMount } from 'svelte';
import { deobfuscate } from '../lib/obfuscator';
import { siteConfig } from '../site.config';
import ReaderPage from './ReaderPage.svelte';
import { actions } from 'astro:actions';

interface Page {
  url?: string;
  imageUrl?: string;
  tiles?: string[];
  cols?: number;
  rows?: number;
  width?: number;
  height?: number;
  pageNumber?: number;
  [key: string]: any;
}

interface Props {
  slug?: string;
  chapter?: string;
  initialPages?: Page[];
  initialImageUrls?: string[];
  encryptedData?: string | null;
  chapterId?: number | null;
  seriesTitle?: string | null;
  watermark?: string;
  initialLoadingMessage?: string | null;
  nextChapter?: { slug: string; chapter: string } | null;
  processing?: boolean;
}

let {
  slug = '',
  chapter = '',
  initialPages = [],
  initialImageUrls = [],
  encryptedData = null,
  chapterId = null,
  seriesTitle = '',
  watermark = '',
  initialLoadingMessage = null,
  nextChapter = null,
  processing = false,
}: Props = $props();

let pagesData = $state<Page[]>([]);
let loadingMessage = $state<string | null>(null);
let isProcessing = $state(false);
let error = $state<string | null>(null);
let isComplete = $state(false);
let useFallback = $state(false);

// Astra: Sincronización inicial silenciosa
onMount(() => {
  loadingMessage = initialLoadingMessage;
  isProcessing = processing;
});

let viewMode = $state<'cascade' | 'single'>('cascade');
let readerWidth = $state(40);
let currentPageIndex = $state(0);
let scrollProgress = $state(0);

let showConfig = $state(false);
let controlsVisible = $state(true);
let lastScrollY = 0;
let isMobile = $state(false);
let hasPrefetched = false; // Prevent multiple prefetches

// SSE & Progress
let simulatedProgress = $state(0);
let eventSource: EventSource | null = null;
let progressInterval: number | undefined;
let retryCount = 0;

// Astra: Reinicio de estado en navegación (Astro View Transitions)
$effect(() => {
  if (slug || chapter) {
    pagesData = [];
    isComplete = false;
    hasPrefetched = false;
    simulatedProgress = 0;
    retryCount = 0;
    error = null;
    if (eventSource) eventSource.close();
  }
});

$effect(() => {
  // Sincronización inicial desde props solo si el estado local está vacío
  if (pagesData.length === 0) {
    if (initialPages.length > 0) pagesData = initialPages;
    else if (initialImageUrls.length > 0)
      pagesData = initialImageUrls.map((url: string) => ({ url }));
  }

  // Si ya tenemos páginas, el procesamiento ha terminado (seguridad)
  if (pagesData.length > 0 && isProcessing) {
    isProcessing = false;
  }

  // Check for prefetch opportunity in single page mode
  if (viewMode === 'single' && !hasPrefetched && nextChapter && pagesData.length > 0) {
    if (currentPageIndex >= pagesData.length - 2) {
      prefetchNextChapter();
    }
  }
});

function prefetchNextChapter() {
  if (!nextChapter || hasPrefetched) return;
  hasPrefetched = true;
  console.log(`[Reader] Prefetching next chapter: ${nextChapter.chapter}`);
  // Trigger the API to ensure processing starts
  fetch(`/api/series/${nextChapter.slug}/${nextChapter.chapter}`, { method: 'GET' }).catch((err) =>
    console.warn('[Reader] Prefetch failed', err)
  );
}

$effect(() => {
  if (showConfig) {
    document.body.setAttribute('data-reader-modal', 'open');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    controlsVisible = true;
  } else {
    document.body.removeAttribute('data-reader-modal');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    if (isProcessing) document.body.style.overflow = 'hidden';
  }
  return () => {
    document.body.removeAttribute('data-reader-modal');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  };
});

let readerEl = $state<HTMLElement | null>(null);

onMount(() => {
  // console.log('[ChapterReader] onMount starting...');
  // Lógica de recuperación de datos desde el Bridge (Bypass de Cloudflare / Respaldo)
  const bridge = document.getElementById('reader-data-bridge');
  if (bridge) {
    slug = bridge.getAttribute('data-slug') || slug;
    chapter = bridge.getAttribute('data-chapter') || chapter;
    const bridgeEncrypted = bridge.getAttribute('data-encrypted');
    if (bridgeEncrypted) encryptedData = bridgeEncrypted;

    const rawId = bridge.getAttribute('data-chapter-id');
    if (rawId) chapterId = parseInt(rawId, 10);

    const processingAttr = bridge.getAttribute('data-processing') === 'true';
    isProcessing = processingAttr;

    loadingMessage = bridge.getAttribute('data-loading-msg') || loadingMessage;
    seriesTitle = bridge.getAttribute('data-series-title') || seriesTitle;
    watermark = bridge.getAttribute('data-watermark') || watermark;
  }

  isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // Astra: Activar modo lectura total para eliminar paddings del layout
  document.body.setAttribute('data-reader-active', 'true');

  // Intentar recuperar configuración guardada de forma segura
  try {
    const savedWidth = localStorage.getItem('readerWidth');
    if (savedWidth) readerWidth = parseInt(savedWidth, 10);
    else if (isMobile) readerWidth = 100;

    const savedMode = localStorage.getItem('viewMode');
    if (savedMode === 'cascade' || savedMode === 'single') viewMode = savedMode;
  } catch (e) {
    console.warn('No se pudo acceder a localStorage', e);
  }

  // Enfocar el lector
  readerEl?.focus();

  const mainHeader = document.querySelector('header');
  const topNav = document.getElementById('reader-top-nav-wrapper');

  let ticking = false;

  const handleScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        if (document.body.getAttribute('data-reader-modal') === 'open') {
          ticking = false;
          return;
        }

        const currentScroll = window.scrollY;
        const docHeight = document.documentElement.scrollHeight;
        const winHeight = window.innerHeight;
        const scrollHeight = docHeight - winHeight;

        scrollProgress = scrollHeight > 0 ? (currentScroll / scrollHeight) * 100 : 0;

        // Prefetch Trigger
        if (scrollProgress > 80 && !hasPrefetched && nextChapter) {
          prefetchNextChapter();
        }

        if (currentScroll > 100 && currentScroll > lastScrollY + 15) {
          if (controlsVisible) {
            controlsVisible = false;
            mainHeader?.classList.add('hidden');
            topNav?.classList.add('hidden');
          }
        } else if (currentScroll < lastScrollY - 15 || currentScroll < 50) {
          if (!controlsVisible) {
            controlsVisible = true;
            mainHeader?.classList.remove('hidden');
            topNav?.classList.remove('hidden');
          }
        }

        lastScrollY = currentScroll;
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('keydown', handleKeydown, { passive: true });

  // Lógica de hidratación diferida
  setTimeout(() => {
    if (encryptedData && pagesData.length === 0) {
      try {
        console.log('[READER] Hydrating data...');
        const decrypted = deobfuscate(encryptedData);
        if (decrypted) {
          let incomingPages = [];
          if (decrypted.pages) incomingPages = decrypted.pages;
          else if (decrypted.imageUrls)
            incomingPages = decrypted.imageUrls.map((url: string) => ({ url }));

          if (incomingPages.length > 0) {
            console.log(`[READER] Pages received: ${incomingPages.length}`);
            pagesData = incomingPages.sort(
              (a: Page, b: Page) => (a.pageNumber || 0) - (b.pageNumber || 0)
            );
            if (isProcessing) isProcessing = false;
          } else {
            console.warn('[READER] No pages found in decrypted payload');
          }
        } else {
          console.error('[READER] Failed to decrypt payload');
        }
      } catch (e) {
        console.error('[READER] Critical error during hydration:', e);
        error = 'Error de seguridad al cargar el contenido.';
      }
    }

    if (isProcessing) setupSse();

    if (chapterId && !isProcessing) {
      if (document.visibilityState === 'visible') registerView();
      else
        document.addEventListener(
          'visibilitychange',
          () => {
            if (document.visibilityState === 'visible') registerView();
          },
          { once: true }
        );
    }
  }, 50);

  return () => {
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('keydown', handleKeydown);
    document.body.removeAttribute('data-reader-active');
    document.body.removeAttribute('data-reader-modal');
    if (eventSource) eventSource.close();
  };
});

function handleGlobalClick(e: MouseEvent) {
  if (showConfig) return;

  // Ignorar clics en elementos interactivos o dentro del HUD
  const target = e.target as HTMLElement;
  if (
    target.closest('button') ||
    target.closest('a') ||
    target.closest('.floating-hud') ||
    target.closest('.reader-cfg-panel')
  ) {
    return;
  }

  const width = window.innerWidth;
  const x = e.clientX;

  // Zonas: 25% Izquierda, 50% Centro, 25% Derecha
  const zoneLeft = width * 0.25;
  const zoneRight = width * 0.75;

  if (x < zoneLeft) {
    handleZoneClick('left');
  } else if (x > zoneRight) {
    handleZoneClick('right');
  } else {
    handleZoneClick('center');
  }
}

function handleZoneClick(zone: 'left' | 'center' | 'right') {
  if (viewMode === 'cascade') {
    if (zone === 'center') toggleControls();
  } else {
    if (zone === 'left') changePage(-1);
    else if (zone === 'right') changePage(1);
    else toggleControls();
  }
}

function toggleControls() {
  if (showConfig) return;
  controlsVisible = !controlsVisible;
  const mainHeader = document.querySelector('header');
  const topNav = document.getElementById('reader-top-nav-wrapper');

  if (!controlsVisible) {
    mainHeader?.classList.add('hidden');
    topNav?.classList.add('hidden');
  } else {
    mainHeader?.classList.remove('hidden');
    topNav?.classList.remove('hidden');
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (viewMode === 'single') {
    if (e.key === 'ArrowLeft') changePage(-1);
    else if (e.key === 'ArrowRight') changePage(1);
  }
  if (e.key === ' ' || e.key === 'Enter') {
    toggleControls();
  }
  if (e.key === 'Escape') {
    if (showConfig) showConfig = false;
  }
}

// Astra: Forzar scroll arriba al cambiar de página en modo single
$effect(() => {
  if (viewMode === 'single' && currentPageIndex >= 0) {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }
});

function changePage(delta: number) {
  const newIndex = currentPageIndex + delta;
  if (newIndex >= 0 && newIndex < pagesData.length) {
    currentPageIndex = newIndex;
  }
}

function scrollToComments() {
  const el = document.getElementById('comments-wrapper');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function setupSse(isRetry = false) {
  if (!isRetry) retryCount = 0;
  if (eventSource) eventSource.close();

  console.log(`[ChapterReader] Setting up SSE for ${slug}/${chapter} (Retry: ${isRetry})`);
  startProgressSimulation();
  eventSource = new EventSource(`/api/series/${slug}/${chapter}`);

  eventSource.addEventListener('processing', (e) => {
    retryCount = 0;
    try {
      const rawData = JSON.parse(e.data);
      const data = rawData.payload ? deobfuscate(rawData.payload) : rawData;
      if (data.message) loadingMessage = data.message;
    } catch {
      console.error('Error parsing SSE processing event');
    }
  });

  eventSource.addEventListener('completed', (e) => {
    console.log('[ChapterReader] SSE Completed event received');
    isComplete = true;
    try {
      const rawData = JSON.parse(e.data);
      const data = rawData.payload ? deobfuscate(rawData.payload) : rawData;

      clearInterval(progressInterval);
      simulatedProgress = 100;
      loadingMessage = '¡Capítulo listo!';

      let incomingPages = [];
      if (data.pages) {
        console.log(`[ChapterReader] SSE Pages received: ${data.pages.length}`);
        incomingPages = data.pages;
      } else if (data.imageUrls) {
        console.log(`[ChapterReader] SSE Image URLs received: ${data.imageUrls.length}`);
        incomingPages = data.imageUrls.map((url: string) => ({ url }));
      }

      if (incomingPages.length > 0) {
        pagesData = incomingPages.sort(
          (a: Page, b: Page) => (a.pageNumber || 0) - (b.pageNumber || 0)
        );
      }

      isProcessing = false;
      if (chapterId) registerView();
      if (eventSource) eventSource.close();
    } catch (err) {
      console.error('[ChapterReader] Error processing completed event:', err);
      error = 'Error al procesar la respuesta del servidor.';
      isProcessing = false;
    }
  });

  eventSource.addEventListener('processing_error', (e) => {
    console.error('[ChapterReader] SSE Processing Error event');
    isComplete = true;
    clearInterval(progressInterval);
    try {
      const rawData = JSON.parse(e.data);
      const data = rawData.payload ? deobfuscate(rawData.payload) : rawData;
      error = data.error || 'Error en el servidor de procesamiento.';
    } catch {
      error = 'Error desconocido en el servidor.';
    }
    isProcessing = false;
    if (eventSource) eventSource.close();
  });

  eventSource.addEventListener('error', () => {
    if (isComplete) return;
    console.warn(`[ChapterReader] SSE Error (Retry ${retryCount + 1}/3)`);

    if (retryCount < 3) {
      console.warn(`SSE connection lost. Retrying... (${retryCount + 1}/3)`);
      retryCount++;
      if (eventSource) eventSource.close();
      setTimeout(() => setupSse(true), 2000);
    } else {
      error =
        'Se perdió la conexión con el servidor de procesamiento. Reintente recargando la página.';
      isProcessing = false;
      if (eventSource) eventSource.close();
    }
  });
}

function registerView() {
  if (chapterId) {
    actions.chapters.registerView({ chapterId }).catch(() => {});
  }
}

function startProgressSimulation() {
  clearInterval(progressInterval);
  simulatedProgress = 0;

  progressInterval = window.setInterval(() => {
    if (simulatedProgress < 99) {
      const remaining = 100 - simulatedProgress;
      const increment = remaining * 0.015;
      simulatedProgress += Math.max(0.01, increment);
    }
  }, 150);
}

function saveSettings() {
  localStorage.setItem('readerWidth', readerWidth.toString());
  localStorage.setItem('viewMode', viewMode);
  showConfig = false;
}

const isInAppOnly = $derived(encryptedData === 'inapp' || loadingMessage === 'inapp');
</script>

<div 
  class="reader-root" 
  bind:this={readerEl}
  onclick={handleGlobalClick}
  role="presentation"
>
  {#if useFallback}
    <div class="fallback-wrapper">
        <div class="fallback-card">
            <h2>Modo Seguro Activo</h2>
            <p>Hemos detectado un problema con el motor de renderizado. Intentando cargar versión simplificada.</p>
            <button onclick={() => window.location.reload()}>Recargar Lector</button>
        </div>
    </div>
  {/if}

  {#if isInAppOnly}
      <div class="loader-overlay" in:fade>
         <div class="glass-inapp">
            <div class="lock-icon">📱</div>
            <h2>Contenido Exclusivo</h2>
            <p>Este capítulo solo puede leerse desde nuestra App oficial.</p>
            <a href={siteConfig.app.androidUrl} class="btn-get-app">Descargar App</a>
         </div>
      </div>
    {:else if error}
      <div class="loader-overlay" in:fade>
        <div class="glass-error">
          <div class="error-icon">⚠️</div>
          <h2>¡Vaya! Algo salió mal</h2>
          <p>{error}</p>
          <button class="retry-btn" onclick={() => window.location.reload()}>Reintentar</button>
        </div>
      </div>
    {:else if isProcessing}
      <div class="loader-overlay" in:fade>
        <div class="glass-loader">
          <div class="dynamic-icon">🚀</div>
          <h2>Procesando Capítulo</h2>
          <p>{loadingMessage || 'Preparando imágenes...'}</p>
          
          <div class="progress-bar-wrapper">
            <div class="progress-fill" style="width: {simulatedProgress}%"></div>
          </div>
          
          <div class="loader-hints">
            <span class="hint">Esto solo ocurre la primera vez que se lee.</span>
          </div>
        </div>
      </div>
    {/if}

    <div 
      class="pages-container {viewMode}" 
      style="--reader-width: {readerWidth}%"
    >
      {#if viewMode === 'cascade'}
        {#each pagesData as page, i (i)}
          <div class="page-frame">
            <ReaderPage {page} alt={`Página ${i + 1}`} watermark={watermark || undefined} loading={i > 3 ? 'lazy' : 'eager'} />
          </div>
        {/each}
      {:else}
        {#if pagesData[currentPageIndex]}
          <div class="page-frame single-page" in:fade={{ duration: 200 }}>
            <ReaderPage 
              page={pagesData[currentPageIndex]!} 
              alt={`Página ${currentPageIndex + 1}`} 
              watermark={watermark || undefined}
            />
          </div>
        {/if}
      {/if}
    </div>

    {#if !isProcessing && pagesData.length > 0}
      <div class="reader-footer">
        <div class="finish-line">
          <span class="check-icon">✓</span>
          <h3>Has terminado el capítulo</h3>
          <p>¿Qué te ha parecido?</p>
        </div>

        <div class="footer-nav-btns">
          {#if nextChapter}
            <a href={`/series/${nextChapter.slug}/${nextChapter.chapter}`} class="next-btn-massive">
              Leer Capítulo {nextChapter.chapter}
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          {:else}
            <a href={`/series/${slug}`} class="next-btn-massive back-series">
              Volver a la serie
            </a>
          {/if}
        </div>
      </div>
    {/if}

    <div class="floating-hud" class:visible={controlsVisible}>
      <div class="hud-content">
        <div class="hud-section left">
          <a href={`/series/${slug}`} class="back-link" title="Volver a la serie">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </a>
          <div class="chapter-info">
            <span class="series-name">{seriesTitle}</span>
            <span class="chapter-num">Capítulo {chapter}</span>
          </div>
        </div>

        <div class="hud-section central">
          <button class="action-pill-btn" onclick={scrollToComments}>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span>Comentarios</span>
          </button>
        </div>

        <div class="hud-section right">
          {#if viewMode === 'single'}
            <div class="page-counter">
              {currentPageIndex + 1} / {pagesData.length}
            </div>
          {/if}
          <button class="config-btn" onclick={() => showConfig = true} aria-label="Ajustes">
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </div>
      
      <div class="scroll-progress-hud" style="width: {scrollProgress}%"></div>
    </div>
</div>

{#if showConfig}
  <div class="modal-overlay" transition:fade={{ duration: 200 }} onclick={() => showConfig = false} role="presentation">
    <div class="reader-cfg-panel" transition:fly={{ y: 50, duration: 400 }} onclick={(e) => e.stopPropagation()} role="presentation">
      <div class="cfg-header">
        <h3>Ajustes de Lectura</h3>
        <button class="close-cfg" onclick={() => showConfig = false}>×</button>
      </div>

      <div class="cfg-body">
        <div class="cfg-section">
          <label for="view-mode">Modo de visualización</label>
          <div class="mode-selector">
            <button class:active={viewMode === 'cascade'} onclick={() => viewMode = 'cascade'}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
              Cascada
            </button>
            <button class:active={viewMode === 'single'} onclick={() => viewMode = 'single'}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
              Página a Página
            </button>
          </div>
        </div>

        <div class="cfg-section">
          <label for="width-range">Ancho del lector ({readerWidth}%)</label>
          <input 
            id="width-range"
            type="range" 
            min="30" 
            max="100" 
            step="5" 
            bind:value={readerWidth} 
          />
          <div class="range-labels">
            <span>Estrecho</span>
            <span>Completo</span>
          </div>
        </div>
      </div>

      <div class="cfg-footer">
        <button class="btn-save-cfg" onclick={saveSettings}>Guardar y Cerrar</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .reader-root {
    background: #000;
    min-height: 100vh;
    color: #fff;
    outline: none;
  }

  .fallback-wrapper {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .fallback-card {
    background: #111;
    border: 1px solid #333;
    padding: 2rem;
    border-radius: 24px;
    text-align: center;
    max-width: 400px;
  }

  .fallback-card h2 { color: var(--accent-color); margin-bottom: 1rem; }
  .fallback-card p { color: #888; margin-bottom: 1.5rem; }
  .fallback-card button { background: var(--accent-color); color: #000; border: none; padding: 0.8rem 1.5rem; border-radius: 12px; font-weight: 800; cursor: pointer; }

  .loader-overlay {
    position: fixed;
    inset: 0;
    background: #000;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .glass-loader, .glass-error, .glass-inapp {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 40px;
    padding: 3rem;
    text-align: center;
    width: 100%;
    max-width: 450px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  }

  .dynamic-icon, .error-icon, .lock-icon { font-size: 3.5rem; margin-bottom: 1.5rem; }
  .glass-loader h2 { font-size: 1.5rem; font-weight: 900; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
  .glass-loader p { color: #666; font-weight: 600; }

  .progress-bar-wrapper {
    height: 6px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    margin: 2rem 0;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent-color);
    box-shadow: 0 0 15px var(--accent-color);
    transition: width 0.3s ease-out;
  }

  .loader-hints { font-size: 0.75rem; color: #444; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }

  .retry-btn, .btn-get-app {
    margin-top: 1.5rem;
    background: var(--accent-color);
    color: #000;
    border: none;
    padding: 0.8rem 2rem;
    border-radius: 14px;
    font-weight: 800;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
  }

  .pages-container {
    margin: 0 auto;
    width: var(--reader-width);
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .pages-container.single {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    justify-content: center;
  }

  .page-frame {
    width: 100%;
    line-height: 0;
    margin-bottom: 0;
  }

  .single-page {
    max-width: 100%;
    display: flex;
    justify-content: center;
  }

  .reader-footer {
    padding: 6rem 2rem 10rem;
    max-width: 600px;
    margin: 0 auto;
    text-align: center;
  }

  .finish-line { margin-bottom: 3rem; }
  .check-icon { font-size: 3rem; color: var(--accent-color); display: block; margin-bottom: 1rem; }
  .finish-line h3 { font-size: 1.5rem; font-weight: 900; margin-bottom: 0.5rem; }
  .finish-line p { color: #666; font-weight: 600; }

  .next-btn-massive {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    background: #fff;
    color: #000;
    text-decoration: none;
    padding: 1.5rem;
    border-radius: 24px;
    font-size: 1.25rem;
    font-weight: 900;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .next-btn-massive:hover { transform: scale(1.02); box-shadow: 0 10px 30px rgba(255, 255, 255, 0.2); }
  .back-series { background: #222; color: #fff; }

  .floating-hud {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    width: 90%;
    max-width: 600px;
    z-index: 100;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0;
  }

  .floating-hud.visible { transform: translateX(-50%) translateY(0); opacity: 1; }

  .hud-content {
    background: rgba(15, 15, 20, 0.8);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    padding: 0.75rem 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
  }

  .hud-section { display: flex; align-items: center; gap: 1rem; }
  .back-link { color: #fff; opacity: 0.6; transition: opacity 0.2s; }
  .back-link:hover { opacity: 1; }

  .chapter-info { display: flex; flex-direction: column; }
  .series-name { font-size: 0.75rem; font-weight: 800; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }
  .chapter-num { font-size: 0.9rem; font-weight: 900; color: #fff; }

  .action-pill-btn {
    background: rgba(255, 255, 255, 0.05);
    border: none;
    color: #fff;
    padding: 0.6rem 1.25rem;
    border-radius: 16px;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    transition: background 0.2s;
  }

  .action-pill-btn:hover { background: rgba(255, 255, 255, 0.1); }

  .page-counter { background: rgba(0, 191, 255, 0.1); color: var(--accent-color); padding: 0.4rem 0.8rem; border-radius: 10px; font-weight: 800; font-size: 0.8rem; }

  .config-btn { background: none; border: none; color: #fff; opacity: 0.6; cursor: pointer; transition: all 0.2s; padding: 0.5rem; }
  .config-btn:hover { opacity: 1; transform: rotate(30deg); }

  .scroll-progress-hud {
    position: absolute;
    bottom: -4px;
    left: 20px;
    height: 3px;
    background: var(--accent-color);
    border-radius: 10px;
    box-shadow: 0 0 10px var(--accent-color);
    transition: width 0.1s linear;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .reader-cfg-panel {
    background: #15151a;
    width: 100%;
    max-width: 500px;
    border-radius: 32px 32px 0 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 2rem;
    box-shadow: 0 -20px 50px rgba(0, 0, 0, 0.5);
  }

  .cfg-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
  .cfg-header h3 { font-size: 1.25rem; font-weight: 900; margin: 0; }
  .close-cfg { background: none; border: none; color: #666; font-size: 2rem; cursor: pointer; }

  .cfg-section { margin-bottom: 2rem; }
  .cfg-section label { display: block; font-size: 0.85rem; font-weight: 800; color: #555; text-transform: uppercase; margin-bottom: 1rem; }

  .mode-selector { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .mode-selector button {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: #666;
    padding: 1rem;
    border-radius: 16px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
  }

  .mode-selector button.active { background: rgba(0, 191, 255, 0.1); border-color: var(--accent-color); color: #fff; }

  input[type="range"] {
    width: 100%;
    height: 6px;
    background: #222;
    border-radius: 10px;
    appearance: none;
    outline: none;
  }

  input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 20px;
    height: 20px;
    background: var(--accent-color);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 0 10px var(--accent-color);
  }

  .range-labels { display: flex; justify-content: space-between; margin-top: 0.75rem; font-size: 0.7rem; color: #444; font-weight: 800; text-transform: uppercase; }

  .btn-save-cfg {
    width: 100%;
    background: #fff;
    color: #000;
    border: none;
    padding: 1rem;
    border-radius: 16px;
    font-weight: 900;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .btn-save-cfg:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 480px) {
    .action-pill-btn span { display: none; }
    .action-pill-btn { padding: 0.6rem; }
  }
</style>
