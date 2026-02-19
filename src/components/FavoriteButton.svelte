<script lang="ts">
import { toast } from '../lib/toastStore';

interface Props {
  seriesId: number;
  isFavorited?: boolean;
  isLoggedIn?: boolean;
}

let { seriesId, isFavorited: initialIsFavorited = false, isLoggedIn = false }: Props = $props();

// eslint-disable-next-line svelte/prefer-writable-derived
let isFavorited = $state(false);
let isLoading = $state(false);
let isAnimating = $state(false);

$effect(() => {
  isFavorited = initialIsFavorited;
});

async function toggleFavorite() {
  if (!isLoggedIn) {
    document.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { view: 'login' } }));
    return;
  }

  isLoading = true;

  // Optimistic UI update
  const previousState = isFavorited;
  isFavorited = !isFavorited;

  // Trigger animation
  if (isFavorited) {
    isAnimating = true;
    setTimeout(() => (isAnimating = false), 600);
  }

  try {
    const res = await fetch('/api/user/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'series', id: seriesId }),
    });

    if (!res.ok) throw new Error('Failed to update favorite');

    const data = await res.json();
    isFavorited = data.action === 'added';

    if (isFavorited) {
      toast.success('Serie guardada en biblioteca');
    }
  } catch (e) {
    isFavorited = previousState;
    toast.error('Error de conexión');
    console.error(e);
  } finally {
    isLoading = false;
  }
}
</script>

<button 
  class="fav-btn-premium {isFavorited ? 'active' : ''}" 
  onclick={toggleFavorite}
  aria-label={isFavorited ? "Quitar de favoritos" : "Añadir a favoritos"}
  disabled={isLoading}
>
  <div class="icon-wrapper {isAnimating ? 'pop' : ''}">
    {#if isFavorited}
      <svg viewBox="0 0 24 24" class="heart-filled" width="20" height="20">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" class="heart-outline" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
      </svg>
    {/if}
  </div>
  
  <span class="label">
    {isFavorited ? 'Guardado' : 'Favorito'}
  </span>

  {#if isAnimating}
    <div class="particles">
      <span></span><span></span><span></span><span></span>
    </div>
  {/if}
</button>

<style>
  .fav-btn-premium {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #e0e0e0;
    padding: 0 1.2rem;
    height: 40px;
    border-radius: 100px;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    overflow: visible;
  }

  .fav-btn-premium:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
  }

  .fav-btn-premium.active {
    background: rgba(255, 59, 92, 0.1);
    border-color: rgba(255, 59, 92, 0.4);
    color: #ff3b5c;
    box-shadow: 0 4px 15px rgba(255, 59, 92, 0.2);
  }

  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
  }

  .heart-filled {
    fill: #ff3b5c;
    filter: drop-shadow(0 0 5px rgba(255, 59, 92, 0.6));
    animation: heartBeat 0.4s ease-out;
  }

  @keyframes heartBeat {
    0% { transform: scale(0.5); opacity: 0; }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); opacity: 1; }
  }

  .pop {
    animation: elasticPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes elasticPop {
    0% { transform: scale(1); }
    30% { transform: scale(1.4); }
    60% { transform: scale(0.9); }
    100% { transform: scale(1); }
  }

  .particles {
    position: absolute;
    top: 50%;
    left: 20px;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .particles span {
    position: absolute;
    width: 4px;
    height: 4px;
    background: #ff3b5c;
    border-radius: 50%;
    opacity: 0;
  }

  .particles span:nth-child(1) { animation: particle1 0.6s ease-out forwards; }
  .particles span:nth-child(2) { animation: particle2 0.6s ease-out forwards; }
  .particles span:nth-child(3) { animation: particle3 0.6s ease-out forwards; }
  .particles span:nth-child(4) { animation: particle4 0.6s ease-out forwards; }

  @keyframes particle1 { 0% { transform: translate(0,0); opacity: 1; } 100% { transform: translate(-10px, -15px); opacity: 0; } }
  @keyframes particle2 { 0% { transform: translate(0,0); opacity: 1; } 100% { transform: translate(10px, -15px); opacity: 0; } }
  @keyframes particle3 { 0% { transform: translate(0,0); opacity: 1; } 100% { transform: translate(-8px, 10px); opacity: 0; } }
  @keyframes particle4 { 0% { transform: translate(0,0); opacity: 1; } 100% { transform: translate(8px, 10px); opacity: 0; } }

  @media (max-width: 600px) {
    .fav-btn-premium { padding: 0 1rem; }
    .label { display: none; }
  }
</style>