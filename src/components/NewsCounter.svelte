<script lang="ts">
import { onMount } from 'svelte';
import { newsStore } from '../lib/newsStore.svelte';

interface Props {
  initialCount?: number;
}

let { initialCount = 0 }: Props = $props();

onMount(() => {
  if (initialCount > 0) newsStore.setCount(initialCount);
  void newsStore.refreshCount(fetch);

  // Auto-actualizar cada 5 minutos
  const interval = setInterval(() => {
    void newsStore.refreshCount(fetch);
  }, 300000);

  return () => clearInterval(interval);
});
</script>

<div class="news-counter-wrapper">
  {#if newsStore.count > 0}
    <div 
      class="badge" 
      in:scale={{ duration: 300, start: 0.5 }} 
      out:fade={{ duration: 200 }}
    >
      {newsStore.count > 99 ? '99+' : newsStore.count}
    </div>
  {/if}
</div>

<style>
  .news-counter-wrapper {
    position: absolute;
    top: -8px;
    right: -12px;
    display: inline-flex;
    align-items: center;
    pointer-events: none; /* No interceptar clics del enlace padre */
  }

  .badge {
    background: var(--accent-color, #ff4444);
    color: white;
    font-size: 0.65rem;
    font-weight: 800;
    min-width: 1.2rem;
    height: 1.2rem;
    padding: 0 0.2rem;
    border-radius: 999px;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 0 10px rgba(225, 29, 72, 0.4);
    border: 2px solid #000;
    animation: pulse-glow 2s infinite ease-in-out;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 5px rgba(225, 29, 72, 0.3); }
    50% { box-shadow: 0 0 15px rgba(225, 29, 72, 0.6); }
  }
</style>