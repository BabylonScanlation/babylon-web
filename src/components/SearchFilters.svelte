<script lang="ts">
import { navigate } from 'astro:transitions/client';
import { onDestroy, onMount, untrack } from 'svelte';
import { fade, slide } from 'svelte/transition';

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

<div class="filter-system-container">
  <div class="controls-bar">
    <button type="button" class="filter-icon-btn" class:active={isAdvancedOpen} onclick={toggleAdvanced}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line>
        <line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line>
        <line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>
      </svg>
      {#if activeFilters.genres.length > 0 || activeFilters.type !== 'all' || activeFilters.author || activeFilters.artist}
        <span class="active-dot"></span>
      {/if}
    </button>
  </div>

  {#if isAdvancedOpen}
    <div class="filter-overlay full-screen-overlay" 
      onclick={cancel} 
      onkeydown={(e) => e.key === 'Escape' && cancel()}
      role="button"
      tabindex="-1"
      aria-label="Cerrar filtros"
      in:fade={{ duration: 200 }}></div>
    
    <div class="floating-panel" in:slide={{ axis: 'y' }} out:fade>
      <!-- HEADER -->
      <div class="panel-header">
        <h3>Filtros</h3>
        <button type="button" class="reset-link" onclick={resetFilters}>Limpiar</button>
      </div>

      <!-- BODY -->
      <div class="panel-body">
        <!-- FORMAT SECTION -->
        <div class="filter-group full-width">
          <span class="filter-label">Formato</span>
          <div class="pills-grid">
            {#each typeOptions as t (t.value)}
              <button 
                type="button"
                class:active={stagingFilters.type === t.value} 
                onclick={() => stagingFilters.type = t.value}
              >{t.label}</button>
            {/each}
          </div>
        </div>

        <div class="input-grid">
          <div class="filter-group">
            <label class="filter-label" for="f-author">Autor</label>
            <input type="text" id="f-author" bind:value={stagingFilters.author} placeholder="Nombre..." />
          </div>
          <div class="filter-group">
            <label class="filter-label" for="f-artist">Artista</label>
            <input type="text" id="f-artist" bind:value={stagingFilters.artist} placeholder="Nombre..." />
          </div>
        </div>

        <div class="input-grid">
          <div class="filter-group">
            <label class="filter-label" for="f-pub">Editorial</label>
            <input type="text" id="f-pub" bind:value={stagingFilters.publisher} placeholder="Editorial..." />
          </div>
          <div class="filter-group">
            <label class="filter-label" for="f-mag">Revista</label>
            <input type="text" id="f-mag" bind:value={stagingFilters.magazine} placeholder="Revista..." />
          </div>
        </div>

        <!-- GENRES SECTION -->
        <div class="filter-group full-width">
          <div class="label-with-badge">
            <span class="filter-label">Géneros</span>
            {#if stagingFilters.genres.length > 0}
              <span class="count-badge" in:fade>{stagingFilters.genres.length}</span>
            {/if}
          </div>
          <div class="genres-grid">
            {#each commonGenres as g (g)}
              <button 
                type="button"
                class="genre-chip" 
                class:active={stagingFilters.genres.includes(g)}
                onclick={() => toggleGenre(g)}
              >{g}</button>
            {/each}
          </div>
        </div>

        <div class="input-grid">
          <div class="filter-group">
            <label class="filter-label" for="f-sort">Orden</label>
            <select id="f-sort" bind:value={stagingFilters.sort}>
              {#each sortOptions as opt (opt.value)}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label" for="f-status">Estado</label>
            <select id="f-status" bind:value={stagingFilters.status}>
              <option value="all">Todo</option>
              <option value="En emisión">En emisión</option>
              <option value="Finalizado">Finalizado</option>
            </select>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="panel-footer">
        <button type="button" class="btn-cancel" onclick={cancel}>Cancelar</button>
        <button type="button" class="btn-apply" onclick={apply}>Aplicar</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .filter-system-container { position: relative; }
  
  .filter-icon-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    width: 46px;
    height: 46px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    transition: all 0.2s;
  }
  .filter-icon-btn.active { background: var(--accent-color); color: #000; border-color: var(--accent-color); }
  
  .active-dot { 
    position: absolute; 
    top: 8px; 
    right: 8px; 
    width: 8px; 
    height: 8px; 
    background: #ff4444; 
    border: 2px solid #000; 
    border-radius: 50%; 
  }

  .filter-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 7000; }

  .floating-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #111;
    border-radius: 24px 24px 0 0;
    z-index: 7001;
    display: flex;
    flex-direction: column;
    max-height: 80vh;
    box-shadow: 0 -15px 50px rgba(0,0,0,0.8);
  }

  .panel-header { 
    padding: 1.25rem 1.5rem; 
    border-bottom: 1px solid rgba(255,255,255,0.05); 
    display: flex; 
    justify-content: space-between; 
    align-items: center;
  }
  .panel-header h3 { margin: 0; font-size: 1rem; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 0.05em; }
  .reset-link { background: none; border: none; color: #666; font-weight: 700; font-size: 0.75rem; cursor: pointer; }

  .panel-body { 
    overflow-y: auto; 
    padding: 1.5rem; 
    flex: 1; 
    overscroll-behavior: contain;
  }
  .panel-body::-webkit-scrollbar { width: 4px; }
  .panel-body::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }

  .filter-group { margin-bottom: 1.5rem; }
  .filter-group.full-width { grid-column: span 2; }
  
  .filter-label { 
    display: block; 
    text-align: center;
    font-size: 0.7rem; 
    font-weight: 800; 
    text-transform: uppercase; 
    color: var(--accent-color); 
    letter-spacing: 0.1em;
    margin-bottom: 0.75rem; 
    opacity: 0.9;
  }

  .label-with-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  .label-with-badge .filter-label { margin-bottom: 0; }
  
  .count-badge {
    background: var(--accent-color);
    color: #000;
    font-size: 0.6rem;
    font-weight: 900;
    padding: 2px 8px;
    border-radius: 6px;
    box-shadow: 0 0 15px rgba(0, 191, 255, 0.3);
  }

  .input-grid { 
    display: grid; 
    grid-template-columns: 1fr 1fr; 
    gap: 1rem; 
    margin-bottom: 0.5rem; 
  }

  input[type="text"], select {
    width: 100%;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #fff;
    padding: 0.8rem 1rem;
    border-radius: 14px;
    font-size: 0.9rem;
    font-weight: 500;
    outline: none;
    transition: all 0.3s;
    appearance: none; /* Reset standard styling */
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 1rem center;
    background-size: 1em;
  }

  option {
    background-color: #111;
    color: #fff;
    padding: 10px;
  }

  input:focus, select:focus { 
    background-color: rgba(255, 255, 255, 0.06);
    border-color: var(--accent-color); 
    box-shadow: 0 0 0 4px rgba(0, 191, 255, 0.1);
  }

  .pills-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
  .pills-grid button {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #999;
    padding: 0.7rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .pills-grid button.active { 
    background: #fff; 
    color: #000; 
    border-color: #fff;
    box-shadow: 0 5px 15px rgba(255,255,255,0.1);
  }

  .genres-grid { 
    display: flex; 
    flex-wrap: wrap; 
    gap: 0.6rem; 
    background: rgba(255, 255, 255, 0.02);
    padding: 1rem;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  .genre-chip {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #aaa;
    padding: 0.5rem 1rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .genre-chip:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
  .genre-chip.active { 
    background: var(--accent-color); 
    border-color: var(--accent-color); 
    color: #000; 
    font-weight: 800;
    box-shadow: 0 4px 12px rgba(0, 191, 255, 0.2);
  }

  .panel-footer {
    padding: 1.2rem 1.5rem 2rem;
    background: #161616;
    border-top: 1px solid rgba(255,255,255,0.05);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .btn-cancel { background: transparent; border: 1px solid #333; color: #888; padding: 0.9rem; border-radius: 12px; font-weight: 700; cursor: pointer; }
  .btn-apply { background: #fff; color: #000; border: none; padding: 0.9rem; border-radius: 12px; font-weight: 800; cursor: pointer; text-transform: uppercase; }

  @media (min-width: 1024px) {
    /* --- MODAL PANORÁMICO PC (Flex Denso) --- */
    .floating-panel {
        position: fixed !important;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 1000px; 
        max-width: 95vw;
        min-height: 600px;
        border-radius: 32px;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(10, 10, 15, 0.98);
        box-shadow: 0 50px 100px rgba(0,0,0,0.9);
        z-index: 20000 !important;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    
    .panel-body {
        padding: 2.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem; /* Separación vertical eliminada/minimizada */
        overflow-y: auto;
    }

    /* Convertir Grids a Flex Wrap Denso */
    .input-grid, .pills-grid { 
        display: flex;
        flex-wrap: wrap;
        justify-content: center; 
        gap: 0.5rem;
        width: 100%;
    }

    /* Inputs que se expanden para llenar huecos */
    .filter-group {
        flex: 1 1 180px; 
        min-width: 160px;
        max-width: 100%;
    }

    .pills-grid button, .genre-chip {
        flex: 1 1 auto; 
        text-align: center;
        padding: 0.6rem 1rem;
    }

    /* Corrección de alineación de etiquetas a la IZQUIERDA */
    .filter-label {
        text-align: left !important;
        margin-left: 0.5rem;
        font-size: 0.65rem;
        margin-bottom: 0.25rem;
    }

    .label-with-badge {
        justify-content: flex-start !important;
        padding-left: 0.5rem;
        margin-bottom: 0.25rem;
    }

    .panel-footer {
        padding: 1rem 3.5rem;
        justify-content: flex-end;
        display: flex;
        gap: 1rem;
        border-top: 1px solid rgba(255,255,255,0.05);
    }

    /* Botones de Acción Mini */
    .btn-cancel, .btn-apply {
        width: auto;
        padding: 0.6rem 1.5rem; 
        font-size: 0.75rem;
        border-radius: 100px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 800;
    }

    .btn-cancel { border-color: rgba(255,255,255,0.1); background: transparent; color: #666; }
    .btn-cancel:hover { color: #fff; background: rgba(255,255,255,0.05); }
    .btn-apply { min-width: 120px; }

    /* Botón PC Refinado (64px) */
    .filter-icon-btn {
        width: 64px;
        height: 64px;
        padding: 0;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: center;
        align-items: center;
        flex-shrink: 0;
    }

    .filter-icon-btn::after { display: none; } 

    .filter-icon-btn:hover {
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