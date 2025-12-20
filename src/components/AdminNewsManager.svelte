<script lang="ts">
  import { onMount } from 'svelte';

  // Tipos
  interface Series {
    id: number;
    title: string;
    coverImageUrl: string | null;
  }

  interface NewsItem {
    id: string;
    title: string;
    content: string;
    status: 'draft' | 'published' | string | null;
    seriesId: number | null;
    publishedBy: string;
    createdAt: number | Date;
  }

  // Props recibidas desde Astro
  export let allSeries: Series[] = [];
  export let initialNews: NewsItem[] = [];

  // Estado local
  let selectedSeriesId: number | null = null;
  let filteredNews: NewsItem[] = [];
  let isEditing = false;
  let editingNewsId: string | null = null;
  
  // Form state
  let formTitle = '';
  let formContent = '';
  let formStatus: 'draft' | 'published' = 'draft';
  let formMessage = '';
  let formMessageType = ''; // 'success' | 'error' | 'loading'
  let formImage: File | null = null;

  // Filtrar noticias cuando cambia la selección
  $: {
    if (selectedSeriesId) {
      filteredNews = initialNews.filter(n => n.seriesId === selectedSeriesId);
    } else {
      filteredNews = [];
    }
  }

  function selectSeries(id: number) {
    selectedSeriesId = id;
    resetForm();
    isEditing = false;
  }

  function goBackToSeries() {
    selectedSeriesId = null;
    resetForm();
  }

  function resetForm() {
    formTitle = '';
    formContent = '';
    formStatus = 'draft';
    formImage = null;
    editingNewsId = null;
    isEditing = false;
    formMessage = '';
  }

  function startEdit(news: NewsItem) {
    isEditing = true;
    editingNewsId = news.id;
    formTitle = news.title;
    formContent = news.content;
    formStatus = news.status;
    
    // Scroll al formulario
    const formEl = document.getElementById('news-form');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleDelete(newsId: string) {
    if (!confirm('¿Estás seguro de eliminar esta noticia?')) return;

    try {
      const formData = new FormData();
      formData.append('action', 'delete');
      formData.append('newsId', newsId);

      // Usamos el endpoint de Astro existente o la API
      const res = await fetch('/api/admin/news/delete', { // Asumimos que crearemos/usaremos una API o endpoint
         method: 'POST',
         body: JSON.stringify({ newsId }),
         headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        // Actualizar lista localmente
        initialNews = initialNews.filter(n => n.id !== newsId);
      } else {
        alert('Error al eliminar');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red');
    }
  }

  async function handleSubmit() {
    if (!formTitle || !formContent) {
      formMessage = 'Título y contenido requeridos';
      formMessageType = 'error';
      return;
    }

    formMessage = isEditing ? 'Actualizando...' : 'Creando...';
    formMessageType = 'loading';

    try {
      const payload = {
        title: formTitle,
        content: formContent,
        status: formStatus,
        seriesId: selectedSeriesId
      };

      let url = '/api/admin/news';
      let method = 'POST';

      if (isEditing && editingNewsId) {
        url = `/api/admin/news/${editingNewsId}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Error en la petición');

      const savedNews = await res.json();
      
      // Subir imagen si existe
      if (formImage) {
        formMessage = 'Subiendo imagen...';
        const formData = new FormData();
        formData.append('image', formImage);
        formData.append('newsId', savedNews.id);
        
        await fetch('/api/admin/news/upload-image', {
          method: 'POST',
          body: formData
        });
      }

      formMessage = 'Guardado con éxito';
      formMessageType = 'success';

      // Actualizar lista local
      if (isEditing) {
        initialNews = initialNews.map(n => n.id === savedNews.id ? { ...savedNews, seriesId: selectedSeriesId } : n);
      } else {
        initialNews = [{ ...savedNews, seriesId: selectedSeriesId }, ...initialNews];
      }
      
      // Limpiar form parcial (mantener en la misma serie)
      resetForm();
      
      // Borrar mensaje despues de unos segundos
      setTimeout(() => formMessage = '', 3000);

    } catch (error) {
      console.error(error);
      formMessage = 'Error al guardar la noticia';
      formMessageType = 'error';
    }
  }

  function handleImageChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      formImage = input.files[0];
    }
  }
</script>

<div class="news-manager">
  
  {#if allSeries.length === 0}
    <!-- ESTADO VACÍO: NO HAY SERIES -->
    <div class="empty-state">
      <h3>No hay series creadas</h3>
      <p>Para gestionar noticias, primero debes subir una serie desde Telegram.</p>
    </div>

  {:else if selectedSeriesId === null}
    <!-- VISTA 1: SELECCIONAR SERIE -->
    <div class="series-selector">
      <h2>Selecciona una Serie</h2>
      <p class="subtitle">Gestiona las noticias específicas de cada proyecto.</p>
      
      <div class="series-grid">
        {#each allSeries as serie}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="series-card" onclick={() => selectSeries(serie.id)}>
            {#if serie.coverImageUrl}
              <img src={serie.coverImageUrl} alt={serie.title} />
            {:else}
              <div class="placeholder-img">Sin Portada</div>
            {/if}
            <div class="card-title">{serie.title}</div>
          </div>
        {/each}
      </div>
    </div>

  {:else}
    <!-- VISTA 2: GESTIÓN DE NOTICIAS DE LA SERIE -->
    <div class="series-dashboard">
      <div class="dashboard-header">
        <button class="back-btn" onclick={goBackToSeries}>&larr; Cambiar Serie</button>
        <h2>Noticias de: <span class="highlight">{allSeries.find(s => s.id === selectedSeriesId)?.title}</span></h2>
      </div>

      <div class="split-view">
        <!-- COLUMNA IZQUIERDA: FORMULARIO -->
        <div class="editor-section" id="news-form">
          <h3>{isEditing ? 'Editar Noticia' : 'Nueva Noticia'}</h3>
          
          <div class="form-group">
            <label for="n-title">Título</label>
            <input type="text" id="n-title" bind:value={formTitle} class="form-control" placeholder="Título impactante..." />
          </div>

          <div class="form-group">
            <label for="n-content">Contenido</label>
            <textarea id="n-content" bind:value={formContent} rows="6" class="form-control" placeholder="Escribe el cuerpo de la noticia..."></textarea>
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label for="n-status">Estado</label>
              <select id="n-status" bind:value={formStatus} class="form-control">
                <option value="draft">Borrador</option>
                <option value="published">Publicado</option>
              </select>
            </div>
            <div class="form-group half">
              <label for="n-image">Imagen (Opcional)</label>
              <input type="file" id="n-image" onchange={handleImageChange} accept="image/*" class="form-control-file" />
            </div>
          </div>

          {#if formMessage}
            <div class="message {formMessageType}">{formMessage}</div>
          {/if}

          <div class="form-actions">
            {#if isEditing}
              <button class="btn btn-secondary" onclick={resetForm}>Cancelar</button>
            {/if}
            <button class="btn btn-primary" onclick={handleSubmit} disabled={formMessageType === 'loading'}>
              {isEditing ? 'Actualizar' : 'Publicar Noticia'}
            </button>
          </div>
        </div>

        <!-- COLUMNA DERECHA: LISTADO -->
        <div class="list-section">
          <h3>Historial ({filteredNews.length})</h3>
          
          {#if filteredNews.length === 0}
            <div class="empty-list">
              <p>No hay noticias para esta serie.</p>
            </div>
          {:else}
            <ul class="news-list">
              {#each filteredNews as item}
                <li class="news-item">
                  <div class="news-info">
                    <h4>{item.title}</h4>
                    <span class="status-badge {item.status}">{item.status === 'published' ? 'Publicado' : 'Borrador'}</span>
                    <small>{new Date(item.createdAt).toLocaleDateString()}</small>
                  </div>
                  <div class="news-actions">
                    <button class="icon-btn edit" onclick={() => startEdit(item)} title="Editar">✏️</button>
                    <button class="icon-btn delete" onclick={() => handleDelete(item.id)} title="Eliminar">🗑️</button>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .news-manager {
    color: #e0e0e0;
  }
  
  /* Series Selector Grid */
  .series-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1.5rem;
    margin-top: 1.5rem;
  }
  .series-card {
    background: #2a2a2a;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    position: relative;
    aspect-ratio: 2/3;
  }
  .series-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.5);
    border: 1px solid var(--accent-color, #00bfff);
  }
  .series-card img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .placeholder-img {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #333;
    color: #777;
    font-size: 0.8rem;
  }
  .card-title {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    background: rgba(0,0,0,0.8);
    padding: 0.5rem;
    font-size: 0.9rem;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Dashboard */
  .dashboard-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
    border-bottom: 1px solid #333;
    padding-bottom: 1rem;
  }
  .back-btn {
    background: none;
    border: 1px solid #555;
    color: #aaa;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
  }
  .back-btn:hover {
    color: white;
    border-color: white;
  }
  .highlight {
    color: var(--accent-color, #00bfff);
  }

  .split-view {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }
  @media (max-width: 768px) {
    .split-view {
      grid-template-columns: 1fr;
    }
  }

  /* Form */
  .editor-section {
    background: #1e1e1e;
    padding: 1.5rem;
    border-radius: 8px;
  }
  .form-group {
    margin-bottom: 1rem;
  }
  .form-control {
    width: 100%;
    background: #333;
    border: 1px solid #444;
    color: white;
    padding: 0.75rem;
    border-radius: 4px;
  }
  .form-row {
    display: flex;
    gap: 1rem;
  }
  .half { flex: 1; }
  
  .form-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }

  /* Messages */
  .message { padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem; font-size: 0.9rem; }
  .message.success { background: rgba(46, 204, 113, 0.2); color: #2ecc71; }
  .message.error { background: rgba(231, 76, 60, 0.2); color: #e74c3c; }
  .message.loading { background: rgba(52, 152, 219, 0.2); color: #3498db; }

  /* List */
  .list-section {
    background: #1e1e1e;
    padding: 1.5rem;
    border-radius: 8px;
    max-height: 600px;
    overflow-y: auto;
  }
  .news-list {
    list-style: none;
    padding: 0;
  }
  .news-item {
    background: #2a2a2a;
    padding: 1rem;
    margin-bottom: 0.75rem;
    border-radius: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .news-info h4 { margin: 0 0 0.25rem 0; font-size: 1rem; }
  .status-badge {
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    border-radius: 2px;
    text-transform: uppercase;
  }
  .status-badge.published { background: #2ecc71; color: black; }
  .status-badge.draft { background: #f39c12; color: black; }
  
  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.25rem;
    opacity: 0.7;
  }
  .icon-btn:hover { opacity: 1; }
</style>
