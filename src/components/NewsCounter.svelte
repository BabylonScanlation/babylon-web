<script lang="ts">
import { onMount } from 'svelte';
import { newsStore } from '../lib/stores.svelte';

interface Props {
  initialCount?: number;
}

let { initialCount = 0 }: Props = $props();

onMount(() => {
  // Orion: Solo usamos el contador inicial si el store está en cero (primera carga)
  if (initialCount > 0 && newsStore.count === 0) {
    newsStore.setCount(initialCount);
  }

  const isNewsPage = window.location.pathname.startsWith('/news');

  if (isNewsPage) {
    newsStore.setCount(0);
  } else {
    // Usamos el refresco cacheado (no disparará API si es reciente)
    void newsStore.refreshCount(fetch);
  }

  // Orion: Escuchar evento de creación para actualizar contador instantáneamente
  const handleRefresh = () => {
    if (!window.location.pathname.startsWith('/news')) {
      void newsStore.refreshCount(fetch, true); // Forzamos refresh al recibir evento
    }
  };

  window.addEventListener('new-news-created', handleRefresh);

  const interval = setInterval(() => {
    if (!window.location.pathname.startsWith('/news')) {
      void newsStore.refreshCount(fetch);
    }
  }, 300000);

  return () => {
    clearInterval(interval);
    window.removeEventListener('new-news-created', handleRefresh);
  };
});
</script>

<!-- Astra: Componente Lógico (Headless) - El UI se maneja vía data-news-badge en Layout.astro -->