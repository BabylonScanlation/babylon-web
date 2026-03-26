<script lang="ts">
import { onMount } from 'svelte';
import { fade, scale } from 'svelte/transition';
import { toast } from '../lib/stores.svelte';

interface Props {
  isOpen?: boolean;
  type?: 'avatar' | 'banner';
  onClose: () => void;
  onSelect: (detail: { type: 'avatar' | 'banner'; url: string }) => void;
}

let { isOpen = false, type = 'avatar', onClose, onSelect }: Props = $props();

let avatars = $state<string[]>([]);
let banners = $state<string[]>([]);
let loading = $state(true);
let error = $state('');

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

function selectImage(url: string) {
  onSelect({ type, url });
  onClose();
}

const images = $derived(type === 'avatar' ? avatars : banners);
const title = $derived(type === 'avatar' ? 'Elige tu Avatar' : 'Elige tu Portada');
</script>

{#if isOpen}
  <div class="modal-overlay" transition:fade={{ duration: 200 }} 
       onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()} role="button" tabindex="-1">
    <div class="modal-panel" transition:scale={{ duration: 300, start: 0.9 }} onclick={(e) => e.stopPropagation()} role="presentation">
      <div class="modal-header">
        <h2>{title}</h2>
        <button class="close-btn" onclick={onClose}>×</button>
      </div>

      <div class="modal-body">
        {#if loading}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Cargando galería...</p>
          </div>
        {:else if error}
          <div class="error-state">
            <p>{error}</p>
            <button onclick={() => window.location.reload()}>Reintentar</button>
          </div>
        {:else}
          <div class="images-grid" class:is-banners={type === 'banner'}>
            <p class="grid-hint">
              {type === 'avatar' ? 'Selecciona una imagen para tu perfil' : 'Selecciona un fondo para tu perfil'}
            </p>
            {#each images as img (img)}
              <button class="image-option" onclick={() => selectImage(img)}>
                <img src={img} alt="Opción" loading="lazy" />
                <div class="selection-overlay">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(10px);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .modal-panel {
    background: #15151a;
    width: 100%;
    max-width: 800px;
    max-height: 80vh;
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
  }

  .modal-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h2 { margin: 0; font-size: 1.25rem; font-weight: 900; }

  .close-btn {
    background: rgba(255, 255, 255, 0.05);
    border: none;
    color: #888;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2rem;
    transition: all 0.2s;
  }

  .close-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }

  .modal-body {
    padding: 2rem;
    overflow-y: auto;
    flex: 1;
  }

  .loading-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 0;
    gap: 1rem;
    color: #666;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.05);
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .grid-hint {
    grid-column: 1 / -1;
    margin-bottom: 1.5rem;
    color: #555;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .images-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 1rem;
  }

  .images-grid.is-banners {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }

  .image-option {
    position: relative;
    aspect-ratio: 1;
    border-radius: 16px;
    overflow: hidden;
    border: 3px solid transparent;
    padding: 0;
    background: #000;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .is-banners .image-option { aspect-ratio: 16/9; }

  .image-option img {
    width: 100%; height: 100%; object-fit: cover; transition: 0.3s;
  }

  .image-option:hover { border-color: var(--accent-color, #0bf); transform: scale(1.02); }
  .image-option:hover img { transform: scale(1.1); }

  .selection-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 191, 255, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
    color: #000;
  }

  .image-option:active .selection-overlay { opacity: 1; }

  @media (max-width: 480px) {
    .modal-body { padding: 1.25rem; }
    .images-grid { grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); }
    .images-grid.is-banners { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
  }
</style>
