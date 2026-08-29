<script lang="ts">
import { onDestroy, onMount, untrack } from 'svelte';
import { fade, slide } from 'svelte/transition';
import Combobox from './Combobox.svelte';

let { filterMetadata = { authors: [], artists: [], publishers: [], magazines: [] } } = $props<{
  filterMetadata?: {
    authors: string[];
    artists: string[];
    publishers: string[];
    magazines: string[];
  };
}>();

const sortOptions = [
  { value: 'Relevancia', label: 'Relevancia' },
  { value: 'Popularidad', label: 'Popularidad' },
  { value: 'Recientes', label: 'Recientes' },
  { value: 'A-Z', label: 'A-Z' },
];

const typeOptions = [
  { value: 'Todo', label: 'Todo' },
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
  sort: '',
  type: '',
  status: '',
  author: '',
  artist: '',
  publisher: '',
  magazine: '',
  genres: [] as string[],
});

// Orion: Calculamos si hay filtros activos de forma reactiva con $derived
const hasActiveFilters = $derived(
  activeFilters.genres.length > 0 ||
    activeFilters.type !== '' ||
    activeFilters.author !== '' ||
    activeFilters.artist !== '' ||
    activeFilters.publisher !== '' ||
    activeFilters.magazine !== '' ||
    activeFilters.status !== ''
);

// Estado temporal (mientras el usuario edita)
let stagingFilters = $state(
  Object.assign(
    {},
    untrack(() => activeFilters)
  )
);

onMount(() => {
  const params = new URLSearchParams(window.location.search);
  const loaded = {
    sort: params.get('sort') || '',
    type: params.get('type') || '',
    status: params.get('status') || '',
    author: params.get('author') || '',
    artist: params.get('artist') || '',
    publisher: params.get('publisher') || '',
    magazine: params.get('magazine') || '',
    genres: params.get('genres')?.split(',').filter(Boolean) || [],
  };

  // Migración de URLs antiguas y compatibilidad con Combobox
  if (loaded.sort === 'az') loaded.sort = 'A-Z';
  if (loaded.sort === 'latest') loaded.sort = 'Recientes';
  if (loaded.sort === 'popular') loaded.sort = 'Popularidad';
  if (loaded.sort === 'relevance') loaded.sort = 'Relevancia';
  if (loaded.type === 'all') loaded.type = 'Todo';
  if (loaded.status === 'all') loaded.status = 'Todo';

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
    document.body.setAttribute('data-reader-modal', 'open');
  } else {
    document.body.removeAttribute('data-reader-modal');
  }
  isAdvancedOpen = !isAdvancedOpen;
}

function resetFilters() {
  stagingFilters = {
    sort: '',
    type: '',
    status: '',
    author: '',
    artist: '',
    publisher: '',
    magazine: '',
    genres: [],
  };
}

function cancel() {
  isAdvancedOpen = false;
  document.body.removeAttribute('data-reader-modal');
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
    } else if (v && v !== 'all' && v !== 'Todo' && v !== '') {
      paramsMap[k] = String(v);
    }
  });

  const newSearchParams = new URLSearchParams(paramsMap);

  // Cerrar modal antes de navegar para UX fluida
  isAdvancedOpen = false;
  document.body.removeAttribute('data-reader-modal');

  // Orion: Navegación tradicional
  const nextUrl = `${window.location.pathname}?${newSearchParams.toString()}`;
  window.location.href = nextUrl;
}
</script>

<div class="filter-system-container">
  <div class="controls-bar">
    <button
      type="button"
      class="filter-icon-btn"
      class:active={isAdvancedOpen}
      onclick={toggleAdvanced}
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <line x1="4" y1="21" x2="4" y2="14"></line><line
          x1="4"
          y1="10"
          x2="4"
          y2="3"
        ></line>
        <line x1="12" y1="21" x2="12" y2="12"></line><line
          x1="12"
          y1="8"
          x2="12"
          y2="3"
        ></line>
        <line x1="20" y1="21" x2="20" y2="16"></line><line
          x1="20"
          y1="12"
          x2="20"
          y2="3"
        ></line>
        <line x1="1" y1="14" x2="7" y2="14"></line><line
          x1="9"
          y1="8"
          x2="15"
          y2="8"
        ></line><line x1="17" y1="16" x2="23" y2="16"></line>
      </svg>
      {#if hasActiveFilters}
        <span class="active-dot"></span>
      {/if}
    </button>
  </div>

  {#if isAdvancedOpen}
    <div
      class="filter-overlay full-screen-overlay"
      onclick={cancel}
      onkeydown={(e) => e.key === 'Escape' && cancel()}
      role="button"
      tabindex="-1"
      aria-label="Cerrar filtros"
      in:fade={{ duration: 200 }}
    ></div>

    <div class="floating-panel" in:slide={{ axis: 'y' }} out:fade>
      <!-- HEADER -->
      <div class="panel-header">
        <h3>Filtros</h3>
        <button type="button" class="reset-link" onclick={resetFilters}
          >Limpiar</button
        >
      </div>

      <!-- BODY -->
      <div class="panel-body">
        <div class="all-filters-grid">
          <div class="filter-group">
            <label class="filter-label" for="f-type">Formato</label>
            <Combobox id="f-type" bind:value={stagingFilters.type} options={typeOptions.map(t => t.value)} />
          </div>
          <div class="filter-group">
            <label class="filter-label" for="f-genre">Género</label>
            <Combobox
              id="f-genre"
              value={stagingFilters.genres[0] || ''}
              onchange={(val) => {
                stagingFilters.genres = val ? [val] : [];
              }}
              options={commonGenres}
            />
          </div>
          <div class="filter-group">
            <label class="filter-label" for="f-author">Autor</label>
            <Combobox id="f-author" bind:value={stagingFilters.author} options={filterMetadata.authors} />
          </div>
          <div class="filter-group">
            <label class="filter-label" for="f-artist">Artista</label>
            <Combobox id="f-artist" bind:value={stagingFilters.artist} options={filterMetadata.artists} />
          </div>
          <div class="filter-group">
            <label class="filter-label" for="f-pub">Editorial</label>
            <Combobox id="f-pub" bind:value={stagingFilters.publisher} options={filterMetadata.publishers} />
          </div>
          <div class="filter-group">
            <label class="filter-label" for="f-mag">Revista</label>
            <Combobox id="f-mag" bind:value={stagingFilters.magazine} options={filterMetadata.magazines} />
          </div>
          <div class="filter-group">
            <label class="filter-label" for="f-sort">Orden</label>
            <Combobox id="f-sort" bind:value={stagingFilters.sort} options={sortOptions.map(opt => opt.value)} />
          </div>
          <div class="filter-group">
            <label class="filter-label" for="f-status">Estado</label>
            <Combobox id="f-status" bind:value={stagingFilters.status} options={['Todo', 'En emisión', 'Finalizado']} />
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="panel-footer">
        <button type="button" class="btn-cancel" onclick={cancel}
          >Cancelar</button
        >
        <button type="button" class="btn-apply" onclick={apply}>Aplicar</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .filter-system-container {
    position: relative;
  }

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
  .filter-icon-btn.active {
    background: var(--accent-color);
    color: #000;
    border-color: var(--accent-color);
  }

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

  .filter-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 7000;
  }

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
    min-height: 50vh;
    max-height: 80vh;
    box-shadow: 0 -15px 50px rgba(0, 0, 0, 0.8);
  }

  .panel-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .panel-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 800;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .reset-link {
    background: none;
    border: none;
    color: #666;
    font-weight: 700;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .panel-body {
    overflow-y: auto;
    padding: 1.25rem;
    flex: 1;
    overscroll-behavior: contain;
  }
  .panel-body::-webkit-scrollbar {
    width: 4px;
  }
  .panel-body::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 10px;
  }

  .filter-group {
    margin-bottom: 0.75rem;
  }

  .filter-label {
    display: block;
    text-align: center;
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--accent-color);
    letter-spacing: 0.1em;
    margin-bottom: 0.4rem;
    opacity: 0.9;
  }



  .all-filters-grid {
    display: grid;
    /* En móvil arranca con 2 columnas apretadas o 1 si la pantalla es enana */
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 0.75rem;
    width: 100%;
    padding-bottom: 180px; /* Astra: Espacio para que el último dropdown no se corte al scrollear en móvil */
  }





  .panel-footer {
    padding: 1.2rem 1.5rem 2rem;
    background: #161616;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid #333;
    color: #888;
    padding: 0.9rem;
    border-radius: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .btn-apply {
    background: #fff;
    color: #000;
    border: none;
    padding: 0.9rem;
    border-radius: 12px;
    font-weight: 800;
    cursor: pointer;
    text-transform: uppercase;
  }

  @media (min-width: 1024px) {
    /* --- MODAL PANORÁMICO PC (Flex Denso) --- */
    .floating-panel {
      position: fixed !important;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 800px;
      max-width: 95vw;
      min-height: 350px;
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(10, 10, 15, 0.98);
      box-shadow: 0 50px 100px rgba(0, 0, 0, 0.9);
      z-index: 20000 !important;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: visible;
    }

    .panel-body {
      padding: 1.5rem 2rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem; /* Separación vertical eliminada/minimizada */
      overflow: visible;
    }

    /* Convertir Grids a columnas más generosas en PC */
    .all-filters-grid {
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 1rem;
      padding-bottom: 0; /* Astra: En PC no hace falta porque el overflow es visible */
    }

    /* Corrección de alineación de etiquetas a la IZQUIERDA */
    .filter-label {
      text-align: left !important;
      margin-left: 0.5rem;
      font-size: 0.65rem;
      margin-bottom: 0.25rem;
    }

    .panel-footer {
      padding: 1rem 2rem;
      justify-content: flex-end;
      display: flex;
      gap: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    /* Botones de Acción Mini */
    .btn-cancel,
    .btn-apply {
      width: auto;
      padding: 0.6rem 1.5rem;
      font-size: 0.75rem;
      border-radius: 100px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 800;
    }

    .btn-cancel {
      border-color: rgba(255, 255, 255, 0.1);
      background: transparent;
      color: #666;
    }
    .btn-cancel:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.05);
    }
    .btn-apply {
      min-width: 120px;
    }

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

    .filter-icon-btn::after {
      display: none;
    }

    .filter-icon-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: var(--accent-color);
      transform: translateY(-2px);
    }
  }
</style>
