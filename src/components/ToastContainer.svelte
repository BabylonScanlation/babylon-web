<script lang="ts">
  import { toast } from '../lib/toastStore';
  import { flip } from 'svelte/animate';
  import { fly, fade } from 'svelte/transition';

  // Íconos SVG simples
  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
  };
</script>

<div class="toast-container">
  {#each $toast as t (t.id)}
    <div
      animate:flip={{ duration: 300 }}
      in:fly={{ y: 20, x: 20, duration: 400, opacity: 0 }}
      out:fade={{ duration: 250 }}
      class="toast toast-{t.type}"
    >
      <div class="toast-indicator"></div>
      <div class="toast-content">
        <div class="toast-icon">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html icons[t.type]}
        </div>
        <div class="toast-body">
          <p class="toast-message">{t.message}</p>
        </div>
        <button
          onclick={() => toast.remove(t.id)}
          class="toast-close"
          aria-label="Cerrar notificación"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 400px;
    width: calc(100% - 4rem);
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    position: relative;
    background: rgba(30, 30, 30, 0.7);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .toast:hover {
    transform: translateY(-2px);
    background: rgba(40, 40, 40, 0.8);
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
  }

  .toast-indicator {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 6px;
  }

  .toast-content {
    display: flex;
    align-items: center;
    padding: 1rem 1.25rem;
    gap: 1rem;
  }

  .toast-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    flex-shrink: 0;
    transition: transform 0.2s;
  }

  .toast:hover .toast-icon {
    transform: scale(1.1) rotate(5deg);
  }

  .toast-icon :global(svg) {
    width: 20px;
    height: 20px;
  }

  .toast-body {
    flex: 1;
    min-width: 0;
  }

  .toast-message {
    color: #fff;
    font-size: 0.95rem;
    font-weight: 500;
    margin: 0;
    line-height: 1.4;
    white-space: pre-wrap;
  }

  .toast-close {
    background: rgba(255, 255, 255, 0.05);
    border: none;
    color: #666;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .toast-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    transform: rotate(90deg);
  }

  /* Success Theme */
  .toast-success .toast-indicator { background: #2ecc71; }
  .toast-success .toast-icon { background: rgba(46, 204, 113, 0.1); color: #2ecc71; }
  .toast-success { border-left-color: rgba(46, 204, 113, 0.5); }

  /* Error Theme */
  .toast-error .toast-indicator { background: #ff4757; }
  .toast-error .toast-icon { background: rgba(255, 71, 87, 0.1); color: #ff4757; }
  .toast-error { border-left-color: rgba(255, 71, 87, 0.5); }

  /* Info Theme */
  .toast-info .toast-indicator { background: #00bfff; }
  .toast-info .toast-icon { background: rgba(0, 191, 255, 0.1); color: #00bfff; }
  .toast-info { border-left-color: rgba(0, 191, 255, 0.5); }

  /* Warning Theme */
  .toast-warning .toast-indicator { background: #ffa502; }
  .toast-warning .toast-icon { background: rgba(255, 165, 2, 0.1); color: #ffa502; }
  .toast-warning { border-left-color: rgba(255, 165, 2, 0.5); }

  @media (max-width: 480px) {
    .toast-container {
      bottom: 1rem;
      right: 1rem;
      width: calc(100% - 2rem);
    }
  }
</style>