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


