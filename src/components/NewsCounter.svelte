<script lang="ts">
import { onMount } from 'svelte';
import { fade, scale } from 'svelte/transition';
import { newsStore } from '../lib/newsStore.svelte';

interface Props {
  initialCount?: number;
}

let { initialCount = 0 }: Props = $props();
let isNewsPage = $state(false);

// Astra: Reactividad para el conteo inicial (Server Islands)
$effect(() => {
  if (initialCount > 0) {
    newsStore.setCount(initialCount);
  }
});

onMount(() => {
  if (typeof window !== 'undefined') {
    isNewsPage = window.location.pathname.startsWith('/news');
  }

  if (isNewsPage) {
    newsStore.setCount(0);
    return;
  }

  // Refrescar conteo asíncronamente
  void newsStore.refreshCount(fetch);

  // Auto-actualizar cada 5 minutos
  const interval = setInterval(() => {
    if (!window.location.pathname.startsWith('/news')) {
      void newsStore.refreshCount(fetch);
    }
  }, 300000);

  return () => clearInterval(interval);
});
</script>

<div class="news-counter-wrapper">
  {#if !isNewsPage && newsStore.count > 0}
    <div 
      class="badge" 
      in:scale={{ duration: 300, start: 0.5 }} 
      out:fade={{ duration: 200 }}
      style="display: flex !important; z-index: 9999 !important; visibility: visible !important; opacity: 1 !important;"
    >
      {newsStore.count > 99 ? '99+' : newsStore.count}
    </div>
  {/if}
</div>

<style>
  .news-counter-wrapper {
    position: absolute;
    top: -12px; /* Un poco más arriba */
    right: -15px; /* Un poco más a la derecha */
    display: flex !important;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 9999;
  }

  .badge {
    background: #ff4444 !important; /* Rojo puro garantizado */
    color: white !important;
    font-size: 0.7rem;
    font-weight: 900;
    min-width: 1.4rem;
    min-height: 1.4rem;
    padding: 0 4px;
    border-radius: 50%;
    display: flex !important;
    justify-content: center;
    align-items: center;
    box-shadow: 0 0 15px rgba(255, 68, 68, 0.6);
    border: 2px solid #fff; /* Borde blanco para que resalte más */
    animation: pulse-glow 2s infinite ease-in-out;
    line-height: 1;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 5px rgba(225, 29, 72, 0.3); }
    50% { box-shadow: 0 0 15px rgba(225, 29, 72, 0.6); }
  }
</style>