<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import ReportModal from './ReportModal.svelte';

  let isOpen = $state(false);
  let isHidden = $state(false); // Para ocultarlo cuando el lector oculta su UI
  let menuContainer: HTMLDivElement;
  
  type ReportType = 'chapter_fallen' | 'bug' | 'claim' | 'suggestion';
  let isModalOpen = $state(false);
  let currentModalType = $state<ReportType>('bug');

  function toggleOpen() {
    isOpen = !isOpen;
  }

  function handleClickOutside(e: MouseEvent) {
    if (menuContainer && !menuContainer.contains(e.target as Node)) {
      isOpen = false;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);

    // Ocultar inteligentemente si estamos en el lector y la UI se esconde
    const header = document.querySelector('header');
    if (header) {
      const observer = new MutationObserver(() => {
        const isReaderActive = document.body.getAttribute('data-reader-active') === 'true';
        if (isReaderActive) {
          isHidden = header.classList.contains('hidden');
          if (isHidden) isOpen = false; // Cerrar el menú si se oculta
        } else {
          isHidden = false; // Siempre visible fuera del lector
        }
      });
      observer.observe(header, { attributes: true, attributeFilter: ['class'] });

      return () => {
        document.removeEventListener('click', handleClickOutside);
        observer.disconnect();
      };
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  function handleReport(type: ReportType) {
    isOpen = false;
    currentModalType = type;
    isModalOpen = true;
  }
</script>

<div 
  class="speed-dial-container" 
  class:hidden={isHidden} 
  bind:this={menuContainer}
>
  {#if isOpen}
    <div class="speed-dial-menu" transition:fly={{ y: 25, duration: 400, easing: backOut }}>
      <button class="sd-item group" onclick={() => handleReport('suggestion')}>
        <span class="sd-label">Sugerencias</span>
        <div class="sd-icon sd-purple">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
        </div>
      </button>

      <button class="sd-item group" onclick={() => handleReport('claim')}>
        <span class="sd-label">Reclamar Capítulos</span>
        <div class="sd-icon sd-blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
        </div>
      </button>

      <button class="sd-item group" onclick={() => handleReport('chapter_fallen')}>
        <span class="sd-label">Capítulo Caído</span>
        <div class="sd-icon sd-orange">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
      </button>

      <button class="sd-item group" onclick={() => handleReport('bug')}>
        <span class="sd-label">Reportar Bugs o Errores</span>
        <div class="sd-icon sd-red">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><path d="M12 8V12"></path><path d="M12 16H12.01"></path><circle cx="12" cy="12" r="10"></circle></svg>
        </div>
      </button>
    </div>
  {/if}

  <button 
    class="sd-fab" 
    class:open={isOpen}
    onclick={toggleOpen} 
    aria-label="Soporte y Ayuda"
  >
    <svg class="icon-support" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <defs>
        <linearGradient id="holo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="60%" stop-color="var(--accent-color)" />
          <stop offset="100%" stop-color="#a855f7" />
        </linearGradient>
      </defs>
      <!-- Diadema trasera con opacidad -->
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" stroke="url(#holo-gradient)" opacity="0.5"></path>
      <!-- Auriculares rellenos con cristal -->
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" stroke="url(#holo-gradient)" fill="url(#holo-gradient)" fill-opacity="0.3"></path>
    </svg>
    <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="url(#holo-gradient)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  </button>
</div>

<ReportModal 
  type={currentModalType} 
  isOpen={isModalOpen} 
  onClose={() => isModalOpen = false} 
/>

<style>
  .speed-dial-container {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    transition: opacity 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), visibility 0.3s;
  }

  .speed-dial-container.hidden {
    opacity: 0;
    visibility: hidden;
    transform: translateY(30px) scale(0.9);
    pointer-events: none;
  }

  .speed-dial-menu {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1.1rem;
    margin-bottom: 1.5rem;
    padding-right: 0.2rem;
  }

  .sd-item {
    background: transparent;
    border: none;
    display: flex;
    align-items: center;
    gap: 1rem;
    cursor: pointer;
    padding: 0;
    outline: none;
  }

  .sd-label {
    background: rgba(15, 15, 20, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #cbd5e1;
    padding: 0.6rem 1.1rem;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: right center;
  }

  .sd-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(20, 20, 25, 0.8);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }

  /* Hover Effects per Color */
  .sd-purple { color: #d8b4fe; }
  .sd-item:hover .sd-purple { 
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.5);
    box-shadow: 0 0 20px rgba(168, 85, 247, 0.4);
    color: #f3e8ff;
    transform: scale(1.1) rotate(-5deg);
  }

  .sd-blue { color: #93c5fd; }
  .sd-item:hover .sd-blue { 
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
    color: #dbeafe;
    transform: scale(1.1) rotate(5deg);
  }

  .sd-orange { color: #fdba74; }
  .sd-item:hover .sd-orange { 
    background: rgba(249, 115, 22, 0.15);
    border-color: rgba(249, 115, 22, 0.5);
    box-shadow: 0 0 20px rgba(249, 115, 22, 0.4);
    color: #ffedd5;
    transform: scale(1.1) rotate(-5deg);
  }

  .sd-red { color: #fca5a5; }
  .sd-item:hover .sd-red { 
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.5);
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
    color: #fee2e2;
    transform: scale(1.1) rotate(5deg);
  }

  .sd-item:hover .sd-label {
    color: #fff;
    background: rgba(30, 30, 40, 0.95);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateX(-8px) scale(1.02);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
  }

  /* Main FAB */
  .sd-fab {
    width: 60px;
    height: 60px;
    border-radius: 18px; /* App Icon Squircle */
    background: rgba(20, 20, 25, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--accent-color, #00bfff);
    cursor: pointer;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .sd-fab::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: 19px;
    padding: 1px;
    background: linear-gradient(135deg, var(--accent-color), transparent 60%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0.5;
    transition: opacity 0.3s;
    pointer-events: none;
  }

  .sd-fab:hover {
    transform: scale(1.08) translateY(-4px);
    box-shadow: 0 15px 40px rgba(0, 191, 255, 0.25);
    background: rgba(30, 30, 35, 0.95);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .sd-fab:hover::before {
    opacity: 1;
    background: linear-gradient(135deg, var(--accent-color), var(--accent-color) 100%);
  }

  .sd-fab.open {
    transform: scale(0.95);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }

  .icon-support, .icon-close {
    position: absolute;
    transition: opacity 0.3s, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .icon-close {
    opacity: 0;
    transform: rotate(-135deg) scale(0.5);
  }

  .sd-fab.open .icon-support {
    opacity: 0;
    transform: rotate(135deg) scale(0.5);
  }

  .sd-fab.open .icon-close {
    opacity: 1;
    transform: rotate(-135deg) scale(1.1);
  }

  @media (max-width: 768px) {
    .speed-dial-container {
      bottom: 5.5rem;
      right: 1.25rem;
    }
    
    .sd-fab {
      width: 54px;
      height: 54px;
      border-radius: 16px;
    }
    .sd-fab::before {
      border-radius: 17px;
    }
  }
</style>
