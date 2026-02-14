<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import ReaderPage from './ReaderPage.svelte';
  import { deobfuscate } from '../lib/obfuscator';

  interface Page {
    url?: string;
    imageUrl?: string;
    tiles?: string[];
    cols?: number;
    rows?: number;
    width?: number;
    height?: number;
    pageNumber?: number;
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
    nextChapter = null
  } : Props = $props();

  let pagesData = $state<Page[]>([]);
  let loadingMessage = $state<string | null>(null);
  let processing = $state(false);
  let error = $state<string | null>(null);
  
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
  let isComplete = false;
  let retryCount = 0;

  $effect(() => {
    // Sincronización inicial desde props solo si el estado local está vacío
    if (pagesData.length === 0) {
        if (initialPages.length > 0) pagesData = initialPages;
        else if (initialImageUrls.length > 0) pagesData = initialImageUrls.map((url: string) => ({ url }));
    }
    
    // Si ya tenemos páginas, el procesamiento ha terminado (seguridad)
    if (pagesData.length > 0 && processing) {
        processing = false;
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
      fetch(`/api/series/${nextChapter.slug}/${nextChapter.chapter}`, { method: 'GET' })
        .catch(err => console.warn('[Reader] Prefetch failed', err));
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
      if (processing) document.body.style.overflow = 'hidden';
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
    // Lógica de recuperación de datos desde el Bridge (Bypass de Cloudflare)
    const bridge = document.getElementById('reader-data-bridge');
    if (bridge) {
        slug = bridge.getAttribute('data-slug') || '';
        chapter = bridge.getAttribute('data-chapter') || '';
        encryptedData = bridge.getAttribute('data-encrypted');
        const rawId = bridge.getAttribute('data-chapter-id');
        chapterId = rawId ? parseInt(rawId) : null;
        
        const processingAttr = bridge.getAttribute('data-processing') === 'true';
        processing = processingAttr;
        
        initialLoadingMessage = bridge.getAttribute('data-loading-msg');
        loadingMessage = initialLoadingMessage;
        
        seriesTitle = bridge.getAttribute('data-series-title') || '';
        watermark = bridge.getAttribute('data-watermark') || '';
        // console.log(`[ChapterReader] Data from bridge: processing=${processing}, slug=${slug}`);
    }

    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Astra: Activar modo lectura total para eliminar paddings del layout
    document.body.setAttribute('data-reader-active', 'true');
    
    // Intentar recuperar configuración guardada de forma segura
    try {
        const savedWidth = localStorage.getItem('readerWidth');
        if (savedWidth) readerWidth = parseInt(savedWidth);
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
          if (document.body.getAttribute('data-reader-modal') === "open") {
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
            console.log('[READER] Hydrating from Bridge...');
            const decrypted = deobfuscate(encryptedData);
            if (decrypted) {
                let incomingPages = [];
                if (decrypted.pages) incomingPages = decrypted.pages;
                else if (decrypted.imageUrls) incomingPages = decrypted.imageUrls.map((url: string) => ({ url }));

                if (incomingPages.length > 0) {
                    console.log(`[READER] Bridge pages received: ${incomingPages.length}`);
                    pagesData = incomingPages.sort((a: Page, b: Page) => (a.pageNumber || 0) - (b.pageNumber || 0));
                    console.log('[READER] Bridge sequence:', pagesData.map(p => p.pageNumber).join(', '));
                }
                
                if (pagesData.length > 0 && !processing) processing = false;
            }
          } catch (e) { 
            console.error('Error descifrando:', e);
            error = 'Error de seguridad al cargar el contenido.'; 
          }
        }
        
        if (processing) setupSSE();
        
        if (chapterId && !processing) {
          if (document.visibilityState === 'visible') registerView();
          else document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') registerView();
          }, { once: true });
        }
    }, 100);

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
    if (target.closest('button') || target.closest('a') || target.closest('.floating-hud') || target.closest('.reader-cfg-panel')) {
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

  function changePage(delta: number) {
    const newIndex = currentPageIndex + delta;
    if (newIndex >= 0 && newIndex < pagesData.length) {
      currentPageIndex = newIndex;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function scrollToComments() {
    const el = document.getElementById('comments-wrapper');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  function setupSSE(isRetry = false) {
    if (!isRetry) retryCount = 0;
    if (eventSource) eventSource.close();

    console.log(`[ChapterReader] Setting up SSE for ${slug}/${chapter} (Retry: ${isRetry})`);
    startProgressSimulation();
    eventSource = new EventSource(`/api/series/${slug}/${chapter}`);
    
    eventSource.addEventListener('processing', (e) => {
      // console.log('[ChapterReader] SSE Processing event');
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

        setTimeout(() => {
          let incomingPages = [];
          if (data.pages) {
             console.log(`[ChapterReader] SSE Pages received: ${data.pages.length}`);
             incomingPages = data.pages;
          }
          else if (data.imageUrls) {
             console.log(`[ChapterReader] SSE Image URLs received: ${data.imageUrls.length}`);
             incomingPages = data.imageUrls.map((url: string) => ({ url }));
          }

          if (incomingPages.length > 0) {
              pagesData = incomingPages.sort((a: Page, b: Page) => (a.pageNumber || 0) - (b.pageNumber || 0));
              console.log('[READER] SSE Sequence:', pagesData.map(p => p.pageNumber).join(', '));
          }

          processing = false;
          // Orion: Registrar vista inmediatamente después de completar el procesamiento
          if (chapterId) registerView();
          
          if (eventSource) eventSource.close();
        }, 800);
      } catch (err) {
        console.error('[ChapterReader] Error processing completed event:', err);
        error = 'Error al procesar la respuesta del servidor.';
        processing = false;
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
        processing = false;
        if (eventSource) eventSource.close();
    });

    eventSource.addEventListener('error', () => {
        if (isComplete) return; 
        console.warn(`[ChapterReader] SSE Error (Retry ${retryCount + 1}/3)`);
        
        if (retryCount < 3) {
            console.warn(`SSE connection lost. Retrying... (${retryCount + 1}/3)`);
            retryCount++;
            if (eventSource) eventSource.close();
            setTimeout(() => setupSSE(true), 2000);
        } else {
            error = 'Se perdió la conexión con el servidor de procesamiento. Reintente recargando la página.';
            processing = false;
            if (eventSource) eventSource.close();
        }
    });
  }

  function registerView() {
    fetch('/api/chapters/view', { method: 'POST', body: JSON.stringify({ chapterId }), headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  }

  function startProgressSimulation() {
    clearInterval(progressInterval);
    simulatedProgress = 0;
    
    // Orion: Curva de progresión tipo "Zeno" o "Phi"
    // Avanza rápido al principio y se va cortando a la mitad conforme se acerca al final.
    progressInterval = window.setInterval(() => {
      if (simulatedProgress < 99) {
        // Calculamos cuánto falta para llegar a 100
        const remaining = 100 - simulatedProgress;
        
        // El incremento es una pequeña fracción de lo que queda (se corta a la mitad/proporción)
        // Esto hace que nunca llegue a 100 por sí solo.
        const increment = remaining * 0.015; 
        
        simulatedProgress += Math.max(0.01, increment);
      }
    }, 150); // Intervalo más corto para que el movimiento sea fluido (60fps feel)
  }

  function saveSettings() {
    localStorage.setItem('readerWidth', readerWidth.toString());
    localStorage.setItem('viewMode', viewMode);
    showConfig = false;
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<main 
  class="premium-reader-context" 
  role="application" 
  aria-label="Lector de Manga"
  onclick={handleGlobalClick} 
  onkeydown={handleKeydown} 
  tabindex="-1"
  bind:this={readerEl}
>
  <div class="top-progress-bar" style="width: {scrollProgress}%"></div>

  <div class="reader-container" style="width: {isMobile ? 100 : readerWidth}%">
    {#if error}
      <div class="loader-overlay" in:fade>
        <div class="glass-error">
          <div class="error-icon-anim">
            <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <h3>Conexión Interrumpida</h3>
          <p class="error-desc">{error}</p>
          <button class="btn-retry" onclick={() => window.location.reload()}>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            Reintentar
          </button>
        </div>
      </div>
    {:else if processing}
      <div class="loader-overlay" in:fade>
        <div class="glass-loader">
          <div class="loader-visual">
            <img src="/favicon.svg" alt="Babylon" class="loader-logo" />
            <div class="loader-ring"></div>
          </div>
          <div class="loader-info">
            {#key loadingMessage}
              <div in:fly={{ y: 10, duration: 400 }} out:fly={{ y: -10, duration: 300 }}>
                <p class="main-loading-text">{loadingMessage}</p>
                <p class="sub-loading-text">Esto solo lo tendrás que hacer una vez, gracias por su paciencia.</p>
              </div>
            {/key}
            <div class="progress-section">
              <div class="bar-container">
                <div class="bar-fill" style="width: {simulatedProgress}%"></div>
              </div>
              <div class="progress-meta">
                <span class="status-dot"></span>
                <span class="pct">{Math.round(simulatedProgress)}%</span>
              </div>
            </div>
            
            <button class="cancel-load-btn" onclick={() => window.history.back()}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    {:else}
      <div class="reading-area {viewMode}">
        {#if viewMode === 'cascade'}
          {#each pagesData as page, i (i)}
            <div class="page-frame">
              <ReaderPage {page} alt={`Página ${i + 1}`} {watermark} loading={i < 2 ? 'eager' : 'lazy'} />
              <div class="no-copy-shield" role="presentation" oncontextmenu={(e) => e.preventDefault()}></div>
            </div>
          {/each}
        {:else}
          <div class="single-wrapper">
            <div class="page-frame">
              <ReaderPage page={pagesData[currentPageIndex]} alt={`Página ${currentPageIndex + 1}`} {watermark} loading="eager" />
              <div class="no-copy-shield" role="presentation" oncontextmenu={(e) => e.preventDefault()}></div>
              <div class="page-counter-floating">{currentPageIndex + 1} / {pagesData.length}</div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <div id="reader-floating-hud" class="floating-hud {controlsVisible ? 'visible' : 'hidden'}">
    <div class="hud-glass">
      <div class="hud-section info">
        <a href={`/series/${slug}`} class="back-pill" title="Volver a la serie">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </a>
        <div class="chapter-label">
          <span class="s-title">{seriesTitle}</span>
          <span class="c-num">Capítulo {chapter}</span>
        </div>
      </div>

      <div class="hud-section central">
        <button class="action-pill-btn" onclick={scrollToComments}>
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span>Comentarios</span>
        </button>
      </div>

      <div class="hud-section tools">
        <button class="tool-btn" onclick={(e) => {
          e.stopPropagation();
          showConfig = true;
        }} title="Configuración">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </button>
      </div>
    </div>
  </div>

  <div 
    id="reader-config-overlay"
    class="reader-cfg-backdrop" 
    class:active={showConfig}
    role="presentation"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
        <div
          class="reader-cfg-panel"
          role="dialog"
          tabindex="-1"
          aria-modal="true"
          onclick={(e) => e.stopPropagation()}
          onkeydown={(e) => e.stopPropagation()}
        >      <div class="modal-header-compact">
        <h3>Configuración</h3>
        <button class="close-modal-btn" onclick={() => showConfig = false}>✕</button>
      </div>

      <div class="config-row">
        <label for="view-mode-cascade">Modo de Vista</label>
        <div class="pill-group" id="view-mode-select">
          <button id="view-mode-cascade" class:active={viewMode === 'cascade'} onclick={() => viewMode = 'cascade'}>Cascada</button>
          <button id="view-mode-single" class:active={viewMode === 'single'} onclick={() => viewMode = 'single'}>Paginado</button>
        </div>
      </div>

      <div class="config-row">
        <label for="reader-width-range">Ancho del Lector ({readerWidth}%)</label>
        <input id="reader-width-range" name="reader-width" type="range" min="20" max="100" step="5" bind:value={readerWidth} disabled={isMobile} />
      </div>

      <button class="btn-save-config" onclick={saveSettings}>Guardar Ajustes</button>
    </div>
  </div>
</main>

<style>
  .premium-reader-context {
    position: relative;
    width: 100%;
    min-height: 100vh;
    background: #000;
    color: #fff;
    z-index: 10;
  }

  .top-progress-bar {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: var(--accent-color);
    box-shadow: none; /* Astra: Eliminada sombra que parece línea */
    z-index: 2000;
    transition: width 0.2s ease;
  }

  .reader-container {
    margin: 0 auto;
    background: transparent; /* Astra: Transparencia total */
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
  }

  .reading-area {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .page-frame {
    position: relative;
    width: 100%;
    line-height: 0;
  }

  .no-copy-shield {
    position: absolute;
    inset: 0;
    z-index: 5;
  }

  /* Reader Specific Modal Styles */
  .reader-cfg-backdrop { 
    position: fixed; 
    inset: 0; 
    background: rgba(0, 0, 0, 0.6); 
    backdrop-filter: blur(8px); 
    z-index: 3000; 
    display: none; 
    align-items: flex-end; 
    justify-content: center; 
    padding: 0; 
    pointer-events: none;
  }

  .reader-cfg-backdrop.active {
    display: flex;
    opacity: 1;
    pointer-events: auto;
  }
  
  .reader-cfg-panel { 
    background: #111; 
    border: 1px solid rgba(255, 255, 255, 0.1); 
    border-radius: 32px 32px 0 0; 
    padding: 2.5rem 2rem; 
    width: 100%; 
    max-width: 650px; 
    box-shadow: 0 -10px 50px rgba(0,0,0,0.9);
    position: relative;
    transform: translateY(100%);
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .reader-cfg-backdrop.active .reader-cfg-panel {
    transform: translateY(0);
  }

  /* Astra: Ocultar herramientas de lectura cuando estamos en comentarios */
  :global(body[data-in-comments="true"]) .floating-hud,
  :global(body[data-in-comments="true"]) .reader-cfg-backdrop {
    display: none !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }

  /* Floating HUD */
  .floating-hud {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2500; 
    width: 90%;
    max-width: 650px;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .floating-hud.hidden { transform: translateX(-50%) translateY(100px); opacity: 0; }

  .hud-glass {
    background: rgba(20, 20, 20, 0.7);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    padding: 0.75rem 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: none; /* Astra: Eliminada sombra que parece línea */
  }

  .hud-section { display: flex; align-items: center; gap: 1rem; }

  .back-pill {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .back-pill:hover { background: rgba(255, 255, 255, 0.15); color: var(--accent-color); }

  .chapter-label { display: flex; flex-direction: column; }
  .s-title { font-size: 0.65rem; font-weight: 800; color: #555; text-transform: uppercase; letter-spacing: 0.05em; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .c-num { font-size: 0.9rem; font-weight: 700; color: #fff; }

  .action-pill-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    padding: 0.6rem 1.2rem;
    border-radius: 100px;
    font-size: 0.8rem;
    font-weight: 800;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    transition: all 0.3s;
  }

  .action-pill-btn:hover {
    background: rgba(0, 191, 255, 0.1);
    border-color: var(--accent-color);
    color: var(--accent-color);
    transform: translateY(-2px);
  }

  .tool-btn {
    background: rgba(255, 255, 255, 0.05);
    border: none;
    color: #666;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tool-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.1); transform: rotate(30deg); }

  /* Error State */
  .glass-error {
    background: rgba(20, 20, 20, 0.8);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 100, 100, 0.2);
    padding: 3rem;
    border-radius: 32px;
    text-align: center;
    width: 320px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .error-icon-anim {
    width: 64px;
    height: 64px;
    background: rgba(255, 80, 80, 0.1);
    color: #ff5555;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
    box-shadow: 0 0 0 8px rgba(255, 80, 80, 0.05);
    animation: pulse-error 2s infinite;
  }

  @keyframes pulse-error { 0% { box-shadow: 0 0 0 0 rgba(255, 80, 80, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(255, 80, 80, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 80, 80, 0); } }

  .glass-error h3 { font-size: 1.25rem; font-weight: 800; color: #fff; margin: 0 0 0.5rem 0; }
  .error-desc { color: #aaa; margin-bottom: 2rem; font-size: 0.95rem; line-height: 1.5; }

  .btn-retry {
    background: #fff;
    color: #000;
    border: none;
    padding: 0.9rem 2rem;
    border-radius: 12px;
    font-weight: 800;
    font-size: 0.95rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: all 0.2s;
  }

  .btn-retry:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(255, 255, 255, 0.1); }
  .btn-retry svg { transition: transform 0.5s ease; }
  .btn-retry:hover svg { transform: rotate(180deg); }

  /* Loader */
  .loader-overlay {
    position: fixed;
    inset: 0;
    background: rgba(2, 2, 5, 0.6); /* Astra: Oscuridad mínima para contraste */
    backdrop-filter: blur(15px); /* Astra: Suavizado galáctico */
    -webkit-backdrop-filter: blur(15px);
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .glass-loader {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 3rem;
    border-radius: 32px;
    text-align: center;
    width: 320px;
  }

  .loader-visual {
    position: relative;
    width: 80px;
    height: 80px;
    margin: 0 auto 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loader-ring {
    position: absolute;
    inset: -10px;
    border: 2px solid rgba(255, 255, 255, 0.05);
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 1.5s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .loader-logo { width: 50px; z-index: 2; animation: pulse 2s infinite; }

  .loader-info {
    position: relative;
    height: 140px; 
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }

  .main-loading-text { 
    font-size: 0.95rem; 
    color: #fff; 
    margin-bottom: 0.5rem; 
    font-weight: 700;
    min-height: 1.5em;
  }

  .sub-loading-text {
    font-size: 0.75rem;
    color: #666;
    margin-bottom: 2rem;
    font-weight: 500;
  }

  .progress-section {
    width: 100%;
  }

  .bar-container { background: rgba(255, 255, 255, 0.05); height: 6px; border-radius: 100px; overflow: hidden; margin-bottom: 1rem; }
  .bar-fill { background: var(--accent-color); height: 100%; transition: width 0.4s cubic-bezier(0.1, 0.7, 0.1, 1); box-shadow: 0 0 20px var(--accent-color); }
  
  .progress-meta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    background: var(--accent-color);
    border-radius: 50%;
    box-shadow: 0 0 10px var(--accent-color);
    animation: blink 1s infinite;
  }

  @keyframes blink { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }

  .pct { font-size: 0.85rem; font-weight: 900; color: #555; font-family: 'JetBrains Mono', monospace; }

  @keyframes pulse { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }

  .modal-header-compact {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .close-modal-btn {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.1);
    color: #fff;
    width: 40px; /* Astra: Target táctil optimizado */
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .close-modal-btn:active {
    transform: scale(0.9);
    background: rgba(255,255,255,0.15);
  }

  .reader-cfg-panel h3 { margin: 0; font-size: 1.1rem; font-weight: 800; }
  .config-row { margin-bottom: 2rem; }
  .config-row label { display: block; font-size: 0.75rem; font-weight: 800; color: #555; text-transform: uppercase; margin-bottom: 1rem; }
  .pill-group { display: flex; background: #0a0a0a; padding: 4px; border-radius: 14px; gap: 4px; }
  .pill-group button { flex: 1; background: transparent; border: none; color: #555; padding: 0.6rem; border-radius: 10px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
  .pill-group button.active { background: var(--accent-color); color: #000; }
  input[type="range"] { width: 100%; accent-color: var(--accent-color); }
  .btn-save-config { width: 100%; background: #fff; color: #000; border: none; padding: 1rem; border-radius: 14px; font-weight: 800; cursor: pointer; }

  .page-counter-floating { position: fixed; top: 1.5rem; right: 1.5rem; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(10px); padding: 4px 12px; border-radius: 100px; font-size: 0.75rem; font-weight: 800; border: 1px solid rgba(255, 255, 255, 0.1); z-index: 100; }

  @media (max-width: 768px) {
    .floating-hud { bottom: 1rem; width: 95%; }
    .hud-glass { padding: 0.5rem 1rem; gap: 0.5rem; }
    .s-title { max-width: 100px; }
    .action-pill-btn { padding: 0.6rem 1rem; }
  }

  .cancel-load-btn {
    margin-top: 2rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #aaa;
    padding: 0.75rem 1.5rem;
    border-radius: 100px;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .cancel-load-btn:hover {
    color: #fff;
    border-color: var(--accent-color, #00bfff);
    background: rgba(0, 191, 255, 0.05);
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  }

  @media (max-width: 480px) {
    .action-pill-btn span { display: none; }
    .action-pill-btn { padding: 0.6rem; }
  }
</style>