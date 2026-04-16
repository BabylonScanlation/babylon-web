<script lang="ts">
import { actions } from 'astro:actions';
import { toast } from '../lib/stores.svelte';

interface Props {
  seriesId: number;
  initialIsFavorite?: boolean;
  isLoggedIn?: boolean;
}

let { seriesId, initialIsFavorite = false, isLoggedIn = false }: Props = $props();

// eslint-disable-next-line svelte/prefer-writable-derived
let isFavorite = $state(initialIsFavorite);
let isLoading = $state(false);

$effect(() => {
  isFavorite = initialIsFavorite;
});

async function toggleFavorite() {
  if (!isLoggedIn) {
    window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { view: 'login' } }));
    return;
  }

  if (isLoading) return;
  isLoading = true;

  // Optimistic UI (Astra)
  const previousState = isFavorite;
  isFavorite = !isFavorite;

  try {
    const { error } = await actions.user.toggleFavorite({ type: 'series', id: seriesId });

    if (error) {
      isFavorite = previousState;
      throw new Error(error.message);
    }
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
