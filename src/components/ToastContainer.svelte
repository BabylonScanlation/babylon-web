<script lang="ts">
import { fade, fly } from 'svelte/transition';
import { flip } from 'svelte/animate';
import { toast } from '../lib/toastStore.svelte';

// Íconos SVG simples
const icons = {
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
};
</script>

<div class="toast-container" aria-live="polite">
  {#each toast.toasts as t (t.id)}
    <div
      class="toast toast-{t.type}"
      in:fly={{ x: 100, duration: 300 }}
      out:fade={{ duration: 200 }}
      animate:flip={{ duration: 200 }}
    >
      <div class="toast-icon">
        {@html icons[t.type as keyof typeof icons]}
      </div>
      <div class="toast-content">
        {t.message}
      </div>
      <button
        onclick={() => toast.remove(t.id)}
        class="toast-close"
        aria-label="Cerrar notificación"
      >
        ✕
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    z-index: 100000;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    pointer-events: none;
    max-width: 350px;
    width: 100%;
  }

  .toast {
    pointer-events: auto;
    background: rgba(15, 15, 20, 0.9);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    position: relative;
    overflow: hidden;
  }

  .toast::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--accent-color);
  }

  .toast-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .toast-success::before { background: #2ed573; }
  .toast-success .toast-icon { color: #2ed573; }

  .toast-error::before { background: #ff4757; }
  .toast-error .toast-icon { color: #ff4757; }

  .toast-info::before { background: var(--accent-color); }
  .toast-info .toast-icon { color: var(--accent-color); }

  .toast-warning::before { background: #ffa502; }
  .toast-warning .toast-icon { color: #ffa502; }

  .toast-content {
    flex: 1;
    font-size: 0.9rem;
    font-weight: 600;
    color: #eee;
    line-height: 1.4;
  }

  .toast-close {
    background: none;
    border: none;
    color: #555;
    cursor: pointer;
    padding: 0.25rem;
    font-size: 1rem;
    transition: color 0.2s;
  }

  .toast-close:hover { color: #fff; }

  @media (max-width: 480px) {
    .toast-container {
      bottom: 1rem;
      right: 1rem;
      width: calc(100% - 2rem);
    }
  }
</style>
