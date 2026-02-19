<script lang="ts">
import { onMount } from 'svelte';
import { fade } from 'svelte/transition';
import { timeAgo } from '../lib/utils';

// Types
interface ProgressItem {
  series: {
    title: string;
    slug: string;
    cover: string;
  };
  nextChapter: {
    number: string;
    url: string;
    createdAt: string;
  };
}

interface FavoriteItem {
  id: number;
  createdAt: string;
  series: {
    id: number;
    title: string;
    slug: string;
    cover: string | null;
    views: number;
  };
}

interface RatingItem {
  rating: number;
  createdAt: string;
  series: {
    id: number;
    title: string;
    slug: string;
    cover: string | null;
    views: number;
  };
}

// State
let activeTab: 'history' | 'favorites' | 'ratings' = 'history';
let historyItems: ProgressItem[] = [];
let favoritesItems: FavoriteItem[] = [];
let ratingsItems: RatingItem[] = [];
let isLoading = true;
let isAuthenticated = false;
let selectedStarFilter: number | null = null;

// Derived state for filtered ratings
$: filteredRatings = selectedStarFilter
  ? ratingsItems.filter((item) => item.rating === selectedStarFilter)
  : ratingsItems;

// Actions
async function loadData() {
  isLoading = true;
  try {
    const authRes = await fetch('/api/auth/status');
    const userData = await authRes.json();

    if (userData && userData.uid) {
      isAuthenticated = true;

      // Parallel fetch for better performance
      const [histRes, favRes, ratRes] = await Promise.all([
        fetch('/api/user/progress'),
        fetch('/api/user/favorites-full'),
        fetch('/api/user/ratings'),
      ]);

      if (histRes.ok) {
        const data = await histRes.json();
        historyItems = data.progress || [];
      }

      if (favRes.ok) {
        favoritesItems = await favRes.json();
      }

      if (ratRes.ok) {
        ratingsItems = await ratRes.json();
      }
    } else {
      isAuthenticated = false;
    }
  } catch (e) {
    console.error('Library load error:', e);
  } finally {
    isLoading = false;
  }
}

function handleLogin() {
  document.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { view: 'login' } }));
}

onMount(() => {
  loadData();
  document.addEventListener('auth-success', loadData);
  return () => document.removeEventListener('auth-success', loadData);
});
</script>

<div class="library-manager">
  <!-- Tabs Navigation -->
  <div class="tabs-header">
    <button 
      class="tab-btn {activeTab === 'history' ? 'active' : ''}" 
      on:click={() => activeTab = 'history'}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
      Historial
    </button>
    <button 
      class="tab-btn {activeTab === 'favorites' ? 'active' : ''}" 
      on:click={() => activeTab = 'favorites'}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
      Favoritos
      {#if favoritesItems.length > 0}
        <span class="count-badge" in:fade>{favoritesItems.length}</span>
      {/if}
    </button>
    <button 
      class="tab-btn {activeTab === 'ratings' ? 'active' : ''}" 
      on:click={() => activeTab = 'ratings'}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
      Calificaciones
      {#if ratingsItems.length > 0}
        <span class="count-badge star-badge" in:fade>{ratingsItems.length}</span>
      {/if}
    </button>
  </div>

  <!-- Content Area -->
  <div class="tab-content">
    {#if isLoading}
      <div class="loading-state" in:fade>
        <div class="spinner"></div>
        <p>Sincronizando biblioteca...</p>
      </div>
    {:else if !isAuthenticated}
      <div class="guest-state" in:fade>
        <div class="icon-lock">🔒</div>
        <h2>Acceso Restringido</h2>
        <p>Inicia sesión para sincronizar tu historial y gestionar tus favoritos en todos tus dispositivos.</p>
        <button class="btn-primary" on:click={handleLogin}>
          Iniciar Sesión
        </button>
      </div>
    {:else}
      {#if activeTab === 'history'}
        {#if historyItems.length > 0}
          <div class="library-grid" in:fade>
            {#each historyItems as item (item.series.slug)}
              <a href={item.nextChapter.url} class="library-card">
                <div class="card-image">
                  <img src={item.series.cover} alt={item.series.title} loading="lazy" />
                  <div class="overlay">
                    <div class="read-action">
                      <svg class="play-triangle" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"></path></svg>
                      <span>¿Continuar leyendo?</span>
                    </div>
                  </div>
                  <div class="progress-badge">CAP {item.nextChapter.number}</div>
                </div>
                <div class="card-details">
                  <h3>{item.series.title}</h3>
                  <span class="time-ago">{timeAgo(item.nextChapter.createdAt)}</span>
                </div>
              </a>
            {/each}
          </div>
        {:else}
          <div class="empty-tab" in:fade>
            <div class="icon-empty">📖</div>
            <h3>Tu historial está vacío</h3>
            <p>Empieza a leer una serie para que aparezca aquí automáticamente.</p>
            <a href="/search" class="btn-secondary">Explorar Catálogo</a>
          </div>
        {/if}
      {:else if activeTab === 'favorites'}
        {#if favoritesItems.length > 0}
          <div class="library-grid" in:fade>
            {#each favoritesItems as item (item.id)}
              <a href={`/series/${item.series.slug}`} class="library-card">
                <div class="card-image fav-card">
                  <img src={item.series.cover} alt={item.series.title} loading="lazy" />
                  <div class="overlay">
                    <div class="read-action">
                      <svg class="play-triangle" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"></path></svg>
                      <span>¿Ver serie?</span>
                    </div>
                  </div>
                  <div class="fav-overlay">
                    <div class="heart-icon">
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    </div>
                  </div>
                </div>
                <div class="card-details">
                  <h3>{item.series.title}</h3>
                  <span class="time-ago">Añadido {timeAgo(item.createdAt)}</span>
                </div>
              </a>
            {/each}
          </div>
        {:else}
          <div class="empty-tab" in:fade>
            <div class="illustration-empty">
              <svg viewBox="0 0 24 24" width="64" height="64" stroke="currentColor" fill="none" stroke-width="1.5">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </div>
            <h3>Sin Favoritos</h3>
            <p>Marca tus series preferidas con el corazón ❤️ para guardarlas aquí.</p>
            <a href="/search" class="btn-secondary">Buscar Series</a>
          </div>
        {/if}
      {:else if activeTab === 'ratings'}
        <!-- Rating Filters -->
        <div class="rating-filters" in:fade>
          <button 
            class="filter-chip {selectedStarFilter === null ? 'active' : ''}"
            on:click={() => selectedStarFilter = null}
          >
            Todos
          </button>
          {#each [5, 4, 3, 2, 1] as star (star)}
            <button 
              class="filter-chip {selectedStarFilter === star ? 'active' : ''}"
              on:click={() => selectedStarFilter = star}
            >
              {star} ⭐
            </button>
          {/each}
        </div>

        {#if filteredRatings.length > 0}
          <div class="library-grid" in:fade>
            {#each filteredRatings as item (item.series.id)}
              <a href={`/series/${item.series.slug}`} class="library-card">
                <div class="card-image rating-card">
                  <img src={item.series.cover} alt={item.series.title} loading="lazy" />
                  <div class="overlay">
                    <div class="read-action">
                      <svg class="play-triangle" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"></path></svg>
                      <span>¿Ver serie?</span>
                    </div>
                  </div>
                  <div class="rating-overlay">
                    <div class="stars-box">
                      {item.rating} ⭐
                    </div>
                  </div>
                </div>
                <div class="card-details">
                  <h3>{item.series.title}</h3>
                  <span class="time-ago">Calificado {timeAgo(item.createdAt)}</span>
                </div>
              </a>
            {/each}
          </div>
        {:else}
          <div class="empty-tab" in:fade>
            <div class="icon-empty">⭐</div>
            <h3>Sin calificaciones</h3>
            <p>
              {selectedStarFilter 
                ? `No tienes series calificadas con ${selectedStarFilter} estrellas.` 
                : 'Aún no has calificado ninguna serie.'}
            </p>
            {#if !selectedStarFilter}
              <a href="/search" class="btn-secondary">Explorar y Calificar</a>
            {:else}
              <button class="btn-secondary" on:click={() => selectedStarFilter = null}>Ver todas</button>
            {/if}
          </div>
        {/if}
      {/if}
    {/if}
  </div>
</div>

<style>
  .library-manager {
    width: 100%;
  }

  /* Tabs */
  .tabs-header {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 0.75rem;
    position: relative;
    flex-wrap: wrap;
  }

  .tab-btn {
    background: transparent;
    border: none;
    color: #888;
    font-size: 1rem;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    border-radius: 100px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.3s ease;
    position: relative;
  }

  .tab-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.05);
  }

  .tab-btn.active {
    color: #000;
    background: var(--accent-color);
    box-shadow: 0 0 15px rgba(0, 191, 255, 0.4);
  }

  .count-badge {
    background: #ff3b5c;
    color: #fff;
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 10px;
    position: absolute;
    top: 0px;
    right: 0px;
    font-weight: 800;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  }
  
  .star-badge {
    background: #f6b40e;
  }

  /* Rating Filters */
  .rating-filters {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
    scrollbar-width: none;
  }
  .rating-filters::-webkit-scrollbar { display: none; }

  .filter-chip {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #888;
    padding: 0.5rem 1.25rem;
    border-radius: 100px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .filter-chip:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .filter-chip.active {
    background: #f6b40e;
    color: #000;
    border-color: #f6b40e;
    box-shadow: 0 0 15px rgba(246, 180, 14, 0.3);
  }

  /* Grid Layout */
  .library-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1.5rem;
    width: 100%;
  }

  @media (min-width: 768px) {
    .library-grid {
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 2rem;
    }
  }

  /* Card Design */
  .library-card {
    text-decoration: none;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .card-image {
    position: relative;
    aspect-ratio: 2/3;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 10px 20px rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.05);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }

  .library-card:hover .card-image {
    transform: translateY(-5px);
    box-shadow: 0 15px 30px rgba(0,0,0,0.5);
    border-color: rgba(255,255,255,0.2);
  }

  .card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.5s ease;
  }

  .library-card:hover .card-image img {
    transform: scale(1.05);
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .read-action {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    transform: translateY(10px);
    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  .library-card:hover .read-action {
    transform: translateY(0);
  }

  .play-triangle {
    width: 40px;
    height: 40px;
    color: var(--accent-color);
    filter: drop-shadow(0 0 10px rgba(0, 191, 255, 0.4));
  }

  .read-action span {
    color: #fff;
    font-size: 0.8rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: center;
  }

  .fav-overlay, .rating-overlay {
    position: absolute;
    top: 0.2rem;
    right: 0.5rem;
    pointer-events: none;
  }
  
  .heart-icon, .stars-box {
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    padding: 0 0.5rem;
  }

  .heart-icon {
    width: 32px;
    background: rgba(255, 59, 92, 0.9);
  }

  .stars-box {
    background: rgba(246, 180, 14, 0.9);
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 900;
  }

  .library-card:hover .overlay {
    opacity: 1;
  }

  .progress-badge {
    position: absolute;
    bottom: 0.75rem;
    right: 0.75rem;
    background: rgba(0,0,0,0.8);
    backdrop-filter: blur(4px);
    color: var(--accent-color);
    font-size: 0.7rem;
    font-weight: 800;
    padding: 0.25rem 0.75rem;
    border-radius: 100px;
    border: 1px solid rgba(255,255,255,0.1);
  }

  .card-details h3 {
    color: #fff;
    font-size: 0.95rem;
    font-weight: 700;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.3;
  }

  .time-ago {
    font-size: 0.8rem;
    color: #666;
  }

  /* States */
  .loading-state, .guest-state, .empty-tab {
    text-align: center;
    padding: 4rem 1rem;
    background: rgba(255,255,255,0.02);
    border-radius: 24px;
    border: 1px solid rgba(255,255,255,0.05);
    margin-top: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255,255,255,0.1);
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1.5rem;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .icon-lock, .icon-empty {
    font-size: 3rem;
    margin-bottom: 1.5rem;
    opacity: 0.5;
  }
  
  .illustration-empty {
    color: #ff3b5c;
    margin-bottom: 1rem;
    opacity: 0.8;
  }

  h2 { font-size: 1.5rem; color: #fff; margin-bottom: 1rem; }
  h3 { font-size: 1.25rem; color: #fff; margin-bottom: 0.5rem; }
  p { color: #888; margin-bottom: 2rem; max-width: 400px; margin-left: auto; margin-right: auto; }

  .btn-primary, .btn-secondary {
    padding: 0.9rem 2rem;
    border-radius: 100px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    transition: transform 0.2s;
    text-decoration: none;
    display: inline-block;
  }

  .btn-primary {
    background: var(--accent-color);
    color: #000;
  }

  .btn-secondary {
    background: rgba(255,255,255,0.1);
    color: #fff;
  }

  .btn-primary:hover, .btn-secondary:hover {
    transform: scale(1.05);
  }

  @media (min-width: 1024px) {
    .tabs-header {
      justify-content: flex-start;
      max-width: 1400px;
      margin-left: auto;
      margin-right: auto;
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
    }

    .tab-btn {
      font-size: 1.1rem;
      padding: 1rem 2rem;
    }

    .library-grid {
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 2.5rem;
      max-width: 1400px;
      margin-left: auto;
      margin-right: auto;
    }

    .card-details h3 {
      font-size: 1.1rem;
    }

    .loading-state, .guest-state, .empty-tab {
      max-width: 1400px;
      margin-left: auto;
      margin-right: auto;
      padding: 6rem 2rem;
    }
  }
</style>