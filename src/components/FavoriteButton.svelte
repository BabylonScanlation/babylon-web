<script lang="ts">
import { actions } from 'astro:actions';
import { onMount } from 'svelte';
import { toast } from '../lib/toastStore.svelte';

interface Props {
  seriesId: number;
  initialIsFavorite?: boolean;
}

let { seriesId, initialIsFavorite = false }: Props = $props();

let isFavorite = $state(initialIsFavorite);
let isLoading = $state(false);
let isLoggedIn = $state(false);

onMount(async () => {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    isLoggedIn = !!data.uid;

    if (isLoggedIn) {
      const favRes = await fetch(`/api/user/is-favorite/${seriesId}`);
      if (favRes.ok) {
        const favData = await favRes.json();
        isFavorite = favData.isFavorite;
      }
    }
  } catch (e) {
    console.error('Error checking favorite status', e);
  }
});

async function _toggleFavorite() {
  if (!isLoggedIn) {
    document.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { view: 'login' } }));
    return;
  }

  if (isLoading) return;
  isLoading = true;

  try {
    const { error } = await actions.series.toggleFavorite({ seriesId });

    if (error) throw new Error(error.message);

    isFavorite = !isFavorite;
    toast.success(isFavorite ? 'Añadido a favoritos' : 'Eliminado de favoritos');
  } catch (e: any) {
    toast.error(e.message || 'Error al actualizar favoritos');
  } finally {
    isLoading = false;
  }
}
</script>

<button 
  class="favorite-btn" 
  class:is-favorite={isFavorite} 
  class:loading={isLoading}
  onclick={toggleFavorite}
  disabled={isLoading}
  aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
>
  <div class="icon-wrapper">
    <svg viewBox="0 0 24 24" width="20" height="20" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" stroke-width="2.5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
  </div>
  <span>{isFavorite ? 'En favoritos' : 'Añadir a favoritos'}</span>
</button>

<style>
  .favorite-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    padding: 0.75rem 1.25rem;
    border-radius: 16px;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
  }

  .favorite-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .favorite-btn.is-favorite {
    background: rgba(255, 71, 87, 0.1);
    border-color: rgba(255, 71, 87, 0.3);
    color: #ff4757;
  }

  .favorite-btn.is-favorite:hover {
    background: rgba(255, 71, 87, 0.2);
  }

  .icon-wrapper {
    display: flex;
    align-items: center;
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  .favorite-btn.is-favorite .icon-wrapper {
    transform: scale(1.2);
  }

  .favorite-btn.loading {
    opacity: 0.7;
    cursor: wait;
  }

  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }

  .favorite-btn.is-favorite .icon-wrapper svg {
    animation: pulse 0.3s ease-out;
  }
</style>
