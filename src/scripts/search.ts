// Astra: Preservar filtros al buscar desde la barra principal
const initSearchGrid = () => {
  const form = document.getElementById('main-search-form');
  const input = document.getElementById('main-search-input') as HTMLInputElement | null;

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = new URL(window.location.href);
    const searchTerm = input?.value?.trim();

    if (searchTerm) {
      url.searchParams.set('q', searchTerm);
    } else {
      url.searchParams.delete('q');
    }

    // Resetear página al buscar
    url.searchParams.set('page', '1');

    window.location.href = url.pathname + url.search;
  });

  // --- Opción A: Sincronizador de Rejilla ---
  function syncGridLimit() {
    // Solo ejecutar en la página del catálogo (donde tiene sentido el parámetro limit)
    if (!window.location.pathname.startsWith('/catalogo') && !window.location.pathname.startsWith('/series')) {
      return;
    }

    const grid = document.querySelector('.manga-list-section ul');
    if (!grid) return;

    // 1. Contar columnas reales calculadas por el navegador
    const computedStyle = window.getComputedStyle(grid);
    const gridCols = computedStyle.gridTemplateColumns.split(' ').length;

    // 2. Calcular límite para 3 filas (Máximo 25 como pediste)
    const targetLimit = Math.min(gridCols * 3, 25);

    // 3. Verificar límite actual en URL
    const url = new URL(window.location.href);
    const currentLimit = parseInt(url.searchParams.get('limit') || '25', 10);

    // 4. Si no coincide, recargar con el límite perfecto para que el contador sea real
    if (targetLimit > 0 && targetLimit !== currentLimit) {
      url.searchParams.set('limit', targetLimit.toString());
      url.searchParams.set('page', '1');
      window.location.replace(url.pathname + url.search);
    }
  }

  // Ejecutar inmediatamente
  syncGridLimit();

  // Y al cambiar el tamaño de la ventana (con debounce)
  let resizeTimeout: number | ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(syncGridLimit, 500);
  });
};

// Compatibilidad con Astro ViewTransitions y carga normal
document.addEventListener('astro:page-load', initSearchGrid);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearchGrid);
} else {
  initSearchGrid();
}
