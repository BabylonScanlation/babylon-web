<script lang="ts">
import { fade, slide } from 'svelte/transition';
import { navigate } from 'astro:transitions/client';
import { onDestroy, onMount } from 'svelte';

const sortOptions = [
  { value: 'relevance', label: 'Relevancia' },
  { value: 'popular', label: 'Popularidad' },
  { value: 'latest', label: 'Recientes' },
  { value: 'az', label: 'A-Z' },
];

const typeOptions = [
  { value: 'all', label: 'Todo' },
  { value: 'Manga', label: 'Manga' },
  { value: 'Manhwa', label: 'Manhwa' },
  { value: 'Manhua', label: 'Manhua' },
];

const commonGenres = [
  'Acción',
  'Aventura',
  'Comedia',
  'Drama',
  'Fantasía',
  'Romance',
  'Sci-Fi',
  'Recuentos de la vida',
  'Tragedia',
  'Sobrenatural',
  'Terror',
  'Misterio',
  'Psicológico',
];

let isAdvancedOpen = $state(false);

// Estado real aplicado
let activeFilters = $state({
  sort: 'az',
  type: 'all',
  status: 'all',
  author: '',
  artist: '',
  publisher: '',
  magazine: '',
  genres: [] as string[],
});

// Orion: Calculamos si hay filtros activos de forma reactiva con $derived
const hasActiveFilters = $derived(
  activeFilters.genres.length > 0 ||
    activeFilters.type !== 'all' ||
    activeFilters.author !== '' ||
    activeFilters.artist !== '' ||
    activeFilters.publisher !== '' ||
    activeFilters.magazine !== '' ||
    activeFilters.status !== 'all'
);

// Estado temporal (mientras el usuario edita)
let stagingFilters = $state({ ...activeFilters });

onMount(() => {
  const params = new URLSearchParams(window.location.search);
  const loaded = {
    sort: params.get('sort') || 'az',
    type: params.get('type') || 'all',
    status: params.get('status') || 'all',
    author: params.get('author') || '',
    artist: params.get('artist') || '',
    publisher: params.get('publisher') || '',
    magazine: params.get('magazine') || '',
    genres: params.get('genres')?.split(',').filter(Boolean) || [],
  };
  activeFilters = { ...loaded };
  stagingFilters = { ...loaded };
});

onDestroy(() => {
  if (typeof document !== 'undefined') {
    document.body.removeAttribute('data-search-filter');
  }
});

function toggleAdvanced() {
  if (!isAdvancedOpen) {
    stagingFilters = JSON.parse(JSON.stringify(activeFilters));
    document.body.setAttribute('data-search-filter', 'open');
  } else {
    document.body.removeAttribute('data-search-filter');
  }
  isAdvancedOpen = !isAdvancedOpen;
}

function toggleGenre(genre: string) {
  if (stagingFilters.genres.includes(genre)) {
    stagingFilters.genres = stagingFilters.genres.filter((g) => g !== genre);
  } else {
    stagingFilters.genres = [...stagingFilters.genres, genre];
  }
}

function resetFilters() {
  stagingFilters = {
    sort: 'az',
    type: 'all',
    status: 'all',
    author: '',
    artist: '',
    publisher: '',
    magazine: '',
    genres: [],
  };
}

function cancel() {
  isAdvancedOpen = false;
  document.body.removeAttribute('data-search-filter');
  stagingFilters = JSON.parse(JSON.stringify(activeFilters));
}

function apply() {
  activeFilters = JSON.parse(JSON.stringify(stagingFilters));

  // Orion: Construcción de parámetros limpia para evitar avisos de mutabilidad
  const paramsMap: Record<string, string> = {};
  const url = new URL(window.location.href);
  const currentQ = url.searchParams.get('q');

  if (currentQ) paramsMap.q = currentQ;
  paramsMap.page = '1';

  Object.entries(activeFilters).forEach(([k, v]) => {
    if (k === 'genres') {
      if (Array.isArray(v) && v.length > 0) paramsMap[k] = v.join(',');
    } else if (v && v !== 'all' && v !== '') {
      paramsMap[k] = String(v);
    }
  });

  const newSearchParams = new URLSearchParams(paramsMap);

  // Cerrar modal antes de navegar para UX fluida
  isAdvancedOpen = false;
  document.body.removeAttribute('data-search-filter');

  // Orion: Navegación inteligente sin refresco total
  const nextUrl = `${window.location.pathname}?${newSearchParams.toString()}`;
  navigate(nextUrl, { history: 'push' });
}
</script>

<div class="search-filters-bar">
  <div class="filters-container">
    <div class="quick-filters">
      <div class="select-wrapper">
        <select bind:value={activeFilters.sort} onchange={apply}>
          {#each sortOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>

      <div class="select-wrapper">
        <select bind:value={activeFilters.type} onchange={apply}>
          {#each typeOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
    </div>

    <button class="advanced-toggle" class:has-filters={hasActiveFilters} onclick={toggleAdvanced}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      <span>Filtros avanzados</span>
      {#if hasActiveFilters}
        <span class="indicator"></span>
      {/if}
    </button>
  </div>
</div>

{#if isAdvancedOpen}
  <div class="modal-overlay" transition:fade={{ duration: 200 }} 
      onclick={cancel}
      onkeydown={(e) => e.key === 'Escape' && cancel()}
      role="button"
      tabindex="-1"
  >
    <div class="modal-panel" transition:slide={{ axis: 'y', duration: 400 }} onclick={(e) => e.stopPropagation()} role="presentation">
      <div class="modal-header">
        <h3>Filtros</h3>
        <button type="button" class="reset-link" onclick={resetFilters}>Limpiar</button>
      </div>

      <div class="modal-body">
        <section class="filter-section">
          <h4>Géneros</h4>
          <div class="genres-grid">
            {#each commonGenres as genre}
              <button 
                type="button"
                class="genre-chip" 
                class:active={stagingFilters.genres.includes(genre)}
                onclick={() => toggleGenre(genre)}
              >
                {genre}
              </button>
            {/each}
          </div>
        </section>

        <section class="filter-section">
          <h4>Estado de publicación</h4>
          <div class="pills-grid">
            {#each ['all', 'Ongoing', 'Completed', 'Hiatus', 'Dropped'] as st}
              <button 
                type="button"
                class:active={stagingFilters.status === st}
                onclick={() => stagingFilters.status = st}
              >
                {st === 'all' ? 'Cualquiera' : st}
              </button>
            {/each}
          </div>
        </section>

        <div class="inputs-row">
          <div class="input-group">
            <label for="author">Autor</label>
            <input id="author" type="text" bind:value={stagingFilters.author} placeholder="Nombre del autor..." />
          </div>
          <div class="input-group">
            <label for="artist">Artista</label>
            <input id="artist" type="text" bind:value={stagingFilters.artist} placeholder="Nombre del artista..." />
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-cancel" onclick={cancel}>Cancelar</button>
        <button type="button" class="btn-apply" onclick={apply}>Aplicar Filtros</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .search-filters-bar {
    margin-bottom: 2rem;
    position: sticky;
    top: 70px;
    z-index: 100;
    background: rgba(10, 10, 15, 0.8);
    backdrop-filter: blur(12px);
    padding: 0.75rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .filters-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
    gap: 1rem;
  }

  .quick-filters { display: flex; gap: 0.75rem; }

  .select-wrapper {
    position: relative;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0 0.5rem;
  }

  select {
    background: transparent;
    border: none;
    color: #fff;
    padding: 0.6rem 1.5rem 0.6rem 0.5rem;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    outline: none;
    appearance: none;
  }

  .select-wrapper::after {
    content: "↓";
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.7rem;
    pointer-events: none;
    opacity: 0.5;
  }

  .advanced-toggle {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #aaa;
    padding: 0.6rem 1rem;
    border-radius: 12px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 700;
    transition: all 0.2s;
    position: relative;
  }

  .advanced-toggle:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
  .advanced-toggle.has-filters { border-color: var(--accent-color); color: var(--accent-color); }

  .indicator {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 10px;
    height: 10px;
    background: var(--accent-color);
    border-radius: 50%;
    box-shadow: 0 0 10px var(--accent-color);
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 5vh;
  }

  .modal-panel {
    background: #15151a;
    width: 95%;
    max-width: 600px;
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    padding: 1.5rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .modal-header h3 { margin: 0; font-size: 1.25rem; font-weight: 900; }
  .reset-link { background: none; border: none; color: #666; font-weight: 700; cursor: pointer; font-size: 0.85rem; }
  .reset-link:hover { color: var(--accent-color); }

  .modal-body { padding: 2rem; overflow-y: auto; max-height: 60vh; }

  .filter-section { margin-bottom: 2rem; }
  .filter-section h4 { font-size: 0.85rem; color: #555; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1rem; font-weight: 800; }

  .genres-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.5rem;
  }

  .genre-chip {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: #888;
    padding: 0.6rem;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .genre-chip:hover { border-color: #444; color: #fff; }
  .genre-chip.active { background: var(--accent-color); color: #000; border-color: var(--accent-color); font-weight: 800; }

  .pills-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .pills-grid button {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: #888;
    padding: 0.6rem 1.2rem;
    border-radius: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .pills-grid button.active { background: #fff; color: #000; }

  .inputs-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1rem; }
  .input-group { display: flex; flex-direction: column; gap: 0.5rem; }
  .input-group label { font-size: 0.8rem; font-weight: 700; color: #555; }
  input {
    background: #000;
    border: 1px solid #222;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    color: #fff;
    outline: none;
  }
  input:focus { border-color: var(--accent-color); }

  .modal-footer {
    padding: 1.5rem 2rem;
    background: rgba(255, 255, 255, 0.02);
    display: flex;
    gap: 1rem;
  }

  .btn-cancel { flex: 1; background: transparent; border: 1px solid #333; color: #888; padding: 0.8rem; border-radius: 14px; font-weight: 700; cursor: pointer; }
  .btn-apply { flex: 2; background: var(--accent-color); color: #000; border: none; padding: 0.8rem; border-radius: 14px; font-weight: 800; cursor: pointer; }

  @media (max-width: 640px) {
    .search-filters-bar { top: 60px; }
    .inputs-row { grid-template-columns: 1fr; }
    .advanced-toggle span { display: none; }
    .advanced-toggle { padding: 0.6rem; }
    
    .modal-panel { 
        position: fixed;
        bottom: 0;
        border-radius: 28px 28px 0 0;
        max-height: 90vh;
    }
    
    .genre-chip:active {
        background: rgba(255, 255, 255, 0.1);
        border-color: var(--accent-color);
        transform: translateY(-2px);
    }
    
    .pills-grid button, .genre-chip {
        padding: 0.5rem 0.75rem;
        font-size: 0.8rem;
    }
  }
</style>
