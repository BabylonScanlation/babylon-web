<script lang="ts">
import { onMount } from 'svelte';
import { newsStore } from '../lib/stores.svelte';

interface Props {
  initialCount?: number;
}

let { initialCount = 0 }: Props = $props();
let isNewsPage = $state(false);

onMount(() => {
  if (initialCount > 0) {
    newsStore.setCount(initialCount);
  }

  isNewsPage = window.location.pathname.startsWith('/news');

  if (isNewsPage) {
    newsStore.setCount(0);
    return;
  }

  void newsStore.refreshCount(fetch);

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
      style="display: flex !important; z-index: 9999 !important; visibility: visible !important; opacity: 1 !important;"
    >
      {newsStore.count > 99 ? '99+' : newsStore.count}
    </div>
  {/if}
</div>

<style>
  .news-counter-wrapper {
    position: absolute;
    top: -12px;
    right: -15px;
    display: flex !important;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 9999;
  }

  .badge {
    background: #ff4444 !important;
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
    border: 2px solid #fff;
    animation: pulse-glow 2s infinite ease-in-out, badge-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    line-height: 1;
  }

  @keyframes badge-pop {
    from { transform: scale(0.5); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 5px rgba(225, 29, 72, 0.3); }
    50% { box-shadow: 0 0 15px rgba(225, 29, 72, 0.6); }
  }
</style>