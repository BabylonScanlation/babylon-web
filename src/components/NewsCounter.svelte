<script lang="ts">
import { onMount } from 'svelte';
import { newsStore } from '../lib/stores.svelte';

interface Props {
  initialCount?: number;
}

let { initialCount = 0 }: Props = $props();

onMount(() => {
  if (initialCount > 0) {
    newsStore.setCount(initialCount);
  }

  const isNewsPage = window.location.pathname.startsWith('/news');

  if (isNewsPage) {
    newsStore.setCount(0);
  } else {
    void newsStore.refreshCount(fetch);
  }

  // Orion: Escuchar evento de creación para actualizar contador instantáneamente
  const handleRefresh = () => {
    if (!window.location.pathname.startsWith('/news')) {
      void newsStore.refreshCount(fetch);
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