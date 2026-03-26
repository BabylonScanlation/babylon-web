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
let activeTab = $state<'history' | 'favorites' | 'ratings'>('history');
let historyItems = $state<ProgressItem[]>([]);
let favoritesItems = $state<FavoriteItem[]>([]);
let ratingsItems = $state<RatingItem[]>([]);
let isLoading = $state(true);
let isAuthenticated = $state(false);
let selectedStarFilter = $state<number | null>(null);

// Derived state for filtered ratings
let filteredRatings = $derived(
  selectedStarFilter
    ? ratingsItems.filter((item) => item.rating === selectedStarFilter)
    : ratingsItems
);

// Actions
async function loadData() {
  isLoading = true;
  try {
    const authRes = await fetch('/api/auth/status');
    const userData = await authRes.json();

    if (userData?.uid) {
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
  window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { view: 'login' } }));
}

onMount(() => {
  loadData();
  document.addEventListener('auth-success', loadData);
  return () => document.removeEventListener('auth-success', loadData);
});
</script>

<div class="library-container">
  <div class="library-header">
    <h1>Mi Biblioteca</h1>
    <p class="subtitle">Gestiona tus lecturas, favoritos y valoraciones</p>
  </div>

  <div class="library-tabs">
    <button 
      class="tab-btn {activeTab === 'history' ? 'active' : ''}"
      onclick={() => activeTab = 'history'}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      Historial
    </button>
    <button 
      class="tab-btn {activeTab === 'favorites' ? 'active' : ''}"
      onclick={() => activeTab = 'favorites'}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
      Favoritos
    </button>
    <button 
      class="tab-btn {activeTab === 'ratings' ? 'active' : ''}"
      onclick={() => activeTab = 'ratings'}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
      Valoraciones
    </button>
  </div>

  <div class="tab-content">
    {#if isLoading}
      <div class="loading-state" in:fade>
        <div class="spinner"></div>
        <p>Cargando tus datos...</p>
      </div>
    {:else if !isAuthenticated}
      <div class="guest-state" in:fade>
        <div class="illustration-locked">🔒</div>
        <h2>Acceso Restringido</h2>
        <p>Inicia sesión para sincronizar tu biblioteca en todos tus dispositivos.</p>
        <button class="login-btn" onclick={handleLogin}>Iniciar Sesión</button>
      </div>
    {:else}
      {#if activeTab === 'history'}
        {#if historyItems.length > 0}
          <div class="history-grid" in:fade>
            {#each historyItems as item (item.series.slug)}
              <a href={item.nextChapter.url} class="history-card">
                <div class="card-cover">
                  <img src={item.series.cover} alt={item.series.title} loading="lazy" />
                  <div class="overlay">
                    <div class="play-btn">
                      <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                </div>
                <div class="card-details">
                  <h3>{item.series.title}</h3>
                  <div class="meta">
                    <span class="chap-badge">Cap {item.nextChapter.number}</span>
                    <span class="time">{timeAgo(new Date(item.nextChapter.createdAt).getTime())}</span>
                  </div>
                </div>
              </a>
            {/each}
          </div>
        {:else}
          <div class="empty-tab" in:fade>
            <div class="illustration-empty">📖</div>
            <h3>Nada por aquí</h3>
            <p>Aún no has empezado ninguna lectura. ¡Explora el catálogo!</p>
            <a href="/" class="explore-btn">Ver novedades</a>
          </div>
        {/if}
      {:else if activeTab === 'favorites'}
        {#if favoritesItems.length > 0}
          <div class="library-grid" in:fade>
            {#each favoritesItems as item (item.series.id)}
              <a href={`/series/${item.series.slug}`} class="manga-card">
                <div class="card-cover">
                  <img src={item.series.cover || '/covers/placeholder.jpg'} alt={item.series.title} loading="lazy" />
                  <div class="views-badge">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    {item.series.views}
                  </div>
                </div>
                <div class="card-info">
                  <h3>{item.series.title}</h3>
                  <span class="added-date">Añadido {timeAgo(new Date(item.createdAt).getTime())}</span>
                </div>
              </a>
            {/each}
          </div>
        {:else}
          <div class="empty-tab" in:fade>
            <div class="illustration-empty">❤️</div>
            <h3>Tu lista está vacía</h3>
            <p>Guarda tus series favoritas para recibir notificaciones de nuevos capítulos.</p>
          </div>
        {/if}
      {:else if activeTab === 'ratings'}
        <div class="ratings-filter">
          <button class:active={selectedStarFilter === null} onclick={() => selectedStarFilter = null}>Todo</button>
          {#each [5, 4, 3, 2, 1] as star}
            <button class:active={selectedStarFilter === star} onclick={() => selectedStarFilter = star}>
              {star} ⭐
            </button>
          {/each}
        </div>

        {#if filteredRatings.length > 0}
          <div class="library-grid" in:fade>
            {#each filteredRatings as item (item.series.id)}
              <a href={`/series/${item.series.slug}`} class="manga-card rating-card">
                <div class="card-cover">
                  <img src={item.series.cover || '/covers/placeholder.jpg'} alt={item.series.title} loading="lazy" />
                  <div class="rating-badge">{item.rating} ⭐</div>
                </div>
                <div class="card-info">
                  <h3>{item.series.title}</h3>
                  <span class="added-date">Valorado {timeAgo(new Date(item.createdAt).getTime())}</span>
                </div>
              </a>
            {/each}
          </div>
        {:else}
          <div class="empty-tab" in:fade>
            <div class="illustration-empty">⭐</div>
            <h3>Sin valoraciones</h3>
            <p>Parece que no hay series con este puntaje en tu historial.</p>
          </div>
        {/if}
      {/if}
    {/if}
  </div>
</div>

<style>
  .library-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1rem 6rem;
  }

  .library-header { margin-bottom: 2.5rem; }
  .library-header h1 { font-size: 2.5rem; font-weight: 900; letter-spacing: -0.04em; margin-bottom: 0.5rem; }
  .subtitle { color: #666; font-weight: 600; }

  .library-tabs {
    display: flex;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.03);
    padding: 0.4rem;
    border-radius: 16px;
    margin-bottom: 2.5rem;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 0.8rem;
    border: none;
    background: transparent;
    color: #666;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    border-radius: 12px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .tab-btn:hover { color: #aaa; background: rgba(255, 255, 255, 0.02); }
  .tab-btn.active { background: var(--accent-color); color: #000; box-shadow: 0 4px 15px rgba(0, 191, 255, 0.3); }

  .loading-state, .guest-state, .empty-tab {
    text-align: center;
    padding: 2rem;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 32px;
    border: 1px dashed rgba(255, 255, 255, 0.08);
  }

  .spinner {
    width: 40px; height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.05);
    border-top-color: var(--accent-color);
    border-radius: 50%;
    margin: 0 auto 0.5rem;
    animation: spin 1s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .illustration-locked, .illustration-empty { font-size: 3.5rem; margin-bottom: 0.5rem; filter: grayscale(1) opacity(0.3); }

  .guest-state h2 { font-size: 1.6rem; font-weight: 900; margin-bottom: 0.25rem; color: #fff; }
  .guest-state p { color: #666; margin-bottom: 1.25rem; font-weight: 600; font-size: 0.9rem; }

  .login-btn, .explore-btn {
    background: var(--accent-color);
    color: #000;
    border: none;
    padding: 1.1rem 3.5rem;
    border-radius: 18px;
    font-weight: 900;
    font-size: 1.1rem;
    cursor: pointer;
    display: inline-block;
    text-decoration: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 10px 25px rgba(0, 191, 255, 0.2);
  }

  .login-btn:hover, .explore-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 15px 30px rgba(0, 191, 255, 0.3);
  }

  .history-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .history-card {
    display: flex;
    gap: 1rem;
    background: rgba(255, 255, 255, 0.03);
    padding: 0.75rem;
    border-radius: 20px;
    text-decoration: none;
    border: 1px solid transparent;
    transition: all 0.3s;
  }

  .history-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
    transform: translateY(-4px);
  }

  .card-cover {
    width: 80px;
    height: 110px;
    border-radius: 12px;
    overflow: hidden;
    position: relative;
    flex-shrink: 0;
  }

  .card-cover img { width: 100%; height: 100%; object-fit: cover; }
  .card-cover .overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; }
  .history-card:hover .overlay { opacity: 1; }
  .play-btn { color: var(--accent-color); transform: scale(0.8); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  .history-card:hover .play-btn { transform: scale(1); }

  .card-details { flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0; }
  .card-details h3 { 
    font-size: 1rem; 
    margin: 0 0 0.5rem; 
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis; 
    color: #fff; 
  }
  
  .meta { display: flex; flex-direction: column; gap: 0.25rem; }
  .chap-badge { font-size: 0.75rem; font-weight: 800; color: var(--accent-color); }
  .time { font-size: 0.7rem; color: #555; font-weight: 600; }

  .library-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1.5rem;
  }

  .manga-card {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    transition: transform 0.3s;
  }

  .manga-card:hover { transform: translateY(-8px); }

  .manga-card .card-cover {
    width: 100%;
    aspect-ratio: 2/3;
    border-radius: 18px;
    height: auto;
    margin-bottom: 0.75rem;
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
  }

  .views-badge, .rating-badge {
    position: absolute;
    bottom: 10px;
    right: 10px;
    background: rgba(0,0,0,0.8);
    backdrop-filter: blur(4px);
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 0.7rem;
    font-weight: 800;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .rating-badge { background: var(--accent-color); color: #000; }

  .card-info h3 { font-size: 0.9rem; font-weight: 800; margin: 0 0 0.2rem; color: #fff; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; }
  .added-date { font-size: 0.7rem; color: #555; font-weight: 600; }

  .ratings-filter {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
    scrollbar-width: none;
  }

  .ratings-filter button {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: #666;
    padding: 0.5rem 1.25rem;
    border-radius: 12px;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .ratings-filter button.active {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  @media (max-width: 640px) {
    .library-header h1 { font-size: 2rem; }
    .library-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; }
    .history-grid { grid-template-columns: 1fr; }
    .tab-btn { font-size: 0.8rem; padding: 0.6rem; }
    .tab-btn svg { width: 16px; height: 16px; }
    .card-details h3 { font-size: 1.1rem; }

    .loading-state, .guest-state, .empty-tab {
      max-width: 1400px;
      margin-left: auto;
      margin-right: auto;
      padding: 6rem 2rem;
    }
  }
</style>
