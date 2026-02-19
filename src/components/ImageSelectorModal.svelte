<script lang="ts">
import { createEventDispatcher, onMount } from 'svelte';
import { fade, scale } from 'svelte/transition';
import { toast } from '../lib/toastStore';

export let isOpen = false;
export let type: 'avatar' | 'banner' = 'avatar';

const dispatch = createEventDispatcher();

let avatars: string[] = [];
let banners: string[] = [];
let loading = true;
let error = '';

onMount(async () => {
  try {
    const res = await fetch('/api/assets/list-profile-images');
    if (!res.ok) throw new Error('Error cargando galería');
    const data = await res.json();
    avatars = data.avatars || [];
    banners = data.banners || [];
  } catch (e) {
    error = (e as Error).message;
    toast.error(error);
  } finally {
    loading = false;
  }
});

function close() {
  dispatch('close');
}

function selectImage(url: string) {
  dispatch('select', { type, url });
  close();
}

$: images = type === 'avatar' ? avatars : banners;
$: title = type === 'avatar' ? 'Elige tu Avatar' : 'Elige tu Portada';
</script>

{#if isOpen}
  <div class="modal-backdrop" transition:fade={{ duration: 200 }} on:click={close} on:keydown={(e) => e.key === 'Escape' && close()} role="button" tabindex="0">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal-content" tabindex="-1" transition:scale={{ duration: 300, start: 0.95 }} on:click|stopPropagation role="dialog" aria-modal="true">
      <header class="modal-header">
        <h3>{title}</h3>
        <button class="btn-close" on:click={close}>&times;</button>
      </header>

      <div class="modal-body">
        {#if loading}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Cargando galería...</p>
          </div>
        {:else if error}
          <div class="error-state">
            <p>{error}</p>
          </div>
        {:else if images.length === 0}
          <div class="empty-state">
            <p>No hay imágenes disponibles.</p>
          </div>
        {:else}
          <div class="image-grid" class:banners={type === 'banner'}>
            <p style="grid-column: 1/-1; color: #666; font-size: 0.8rem; margin-bottom: 0.5rem;">
              Mostrando {images.length} imágenes
            </p>
            {#each images as img (img)}
              <button class="image-option" on:click={() => selectImage(img)}>
                <img 
                  src={img} 
                  alt="Opción" 
                  loading="lazy" 
                  on:error={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    if (target) target.src = 'https://ui-avatars.com/api/?name=Err&background=red';
                  }}
                />
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
    z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem;
  }

  .modal-content {
    background: #1a1a20; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px;
    width: 100%; max-width: 800px; max-height: 85vh; display: flex; flex-direction: column;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
  }

  .modal-header {
    padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);
    display: flex; justify-content: space-between; align-items: center;
  }
  
  .modal-header h3 { margin: 0; color: #fff; font-size: 1.2rem; font-weight: 700; }
  
  .btn-close {
    background: transparent; border: none; color: #888; font-size: 2rem; line-height: 1;
    cursor: pointer; transition: 0.2s;
  }
  .btn-close:hover { color: #fff; }

  .modal-body {
    padding: 1.5rem; overflow-y: auto; flex: 1;
    /* Custom Scrollbar */
    scrollbar-width: thin; scrollbar-color: #333 transparent;
  }
  .modal-body::-webkit-scrollbar { width: 6px; }
  .modal-body::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

  .loading-state, .error-state, .empty-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 200px; color: #888;
  }

  .spinner {
    width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1);
    border-top-color: var(--accent-color, #0bf); border-radius: 50%;
    animation: spin 1s linear infinite; margin-bottom: 1rem;
  }
  
  @keyframes spin { to { transform: rotate(360deg); } }

  .image-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 1rem;
  }
  
  .image-grid.banners {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }

  .image-option {
    background: transparent; border: 2px solid transparent; padding: 0; cursor: pointer;
    border-radius: 12px; overflow: hidden; transition: 0.2s; aspect-ratio: 1;
    position: relative;
  }
  
  .banners .image-option { aspect-ratio: 16/9; }

  .image-option img {
    width: 100%; height: 100%; object-fit: cover; transition: 0.3s;
  }

  .image-option:hover { border-color: var(--accent-color, #0bf); transform: scale(1.02); }
  .image-option:hover img { transform: scale(1.1); }

</style>
