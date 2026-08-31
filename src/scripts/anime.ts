const searchInput = document.getElementById('anime-search') as HTMLInputElement | null;
const searchBtn = document.getElementById('search-btn');
const grid = document.getElementById('anime-grid');

async function performSearch(query: string) {
  if (!query) return;
  if (grid) grid.innerHTML = '<div class="loading">Buscando...</div>';
  try {
    const res = await fetch(`/api/anime/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (grid) {
      if (data.results && data.results.length > 0) {
        grid.innerHTML = data.results
          .map(
            (anime: { id: string; image: string; title: string; releaseDate?: string }) => `
          <a href="/anime/${anime.id}" class="anime-card">
            <div class="img-wrapper">
              <img src="${anime.image}" alt="${anime.title}" loading="lazy" />
              <div class="overlay">
                <span class="play-icon">▶</span>
              </div>
            </div>
            <div class="anime-info">
              <h3>${anime.title}</h3>
              ${anime.releaseDate ? `<span class="year">${anime.releaseDate}</span>` : ''}
            </div>
          </a>
        `
          )
          .join('');
      } else {
        grid.innerHTML = '<div class="empty">No se encontraron resultados.</div>';
      }
    }
  } catch (err) {
    console.error(err);
    if (grid) grid.innerHTML = '<div class="error-msg">Error al buscar.</div>';
  }
}

if (searchInput) {
  searchBtn?.addEventListener('click', () => performSearch(searchInput.value));
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch(searchInput.value);
  });
}
