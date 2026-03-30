<script lang="ts">
import { actions } from 'astro:actions';
import { fade, fly, slide } from 'svelte/transition';
import { toast } from '../lib/stores.svelte';
import type { User } from '../types';

// Tipos
interface Series {
  id: number;
  title: string;
  coverImageUrl: string | null;
  isNsfw: boolean | null;
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

// Props Svelte 5
interface Props {
  allSeries?: Series[];
  initialNews?: NewsItem[];
  currentUser?: User | null;
  r2PublicUrlAssets?: string;
}

let {
  allSeries = [],
  initialNews = [],
  currentUser = null,
  r2PublicUrlAssets = '',
}: Props = $props();

// Estado local reactivo para las noticias (Svelte 5)
let newsItems = $state<NewsItem[]>((() => initialNews)());
$effect(() => {
  newsItems = initialNews;
});

// Orion: Normalizador de imágenes
const _getImageUrl = (path: string | null) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = r2PublicUrlAssets || '/api/assets/proxy';
  return `${base}/${path}`.replace(/([^:]\/)\/+/g, '$1');
};

// Estado local reactivo
let selectedSeriesId = $state<number | null>(null);
let isEditing = $state(false);
let editingNewsId = $state<string | null>(null);

// Form state
let formTitle = $state('');
let formContent = $state('');
let formStatus = $state<'draft' | 'published'>('published');
let _isSubmitting = $state(false);
let formImage = $state<File | null>(null);
let _imagePreview = $state<string | null>(null);

// Filtrar noticias derivado
const filteredNews = $derived(
  selectedSeriesId ? newsItems.filter((n) => n.seriesId === selectedSeriesId) : []
);

// Orion: Helper para obtener conteos
function getStats(seriesId: number, currentItems: NewsItem[]) {
  const seriesNews = currentItems.filter((n) => n.seriesId === seriesId);
  return {
    published: seriesNews.filter((n) => n.status === 'published').length,
    draft: seriesNews.filter((n) => n.status === 'draft').length,
  };
}

function selectSeries(id: number) {
  selectedSeriesId = id;
  resetForm();
  isEditing = false;
  window.dispatchEvent(new CustomEvent('series-selected', { detail: { selected: true } }));
}

function goBackToSeries() {
  selectedSeriesId = null;
  resetForm();
  window.dispatchEvent(new CustomEvent('series-selected', { detail: { selected: false } }));
}

function resetForm() {
  formTitle = '';
  formContent = '';
  formStatus = 'published';
  formImage = null;
  _imagePreview = null;
  editingNewsId = null;
  isEditing = false;
  _isSubmitting = false;
}

function startEdit(news: NewsItem) {
  isEditing = true;
  editingNewsId = news.id;
  formTitle = news.title;
  formContent = news.content;
  formStatus = news.status === 'published' || news.status === 'draft' ? news.status : 'draft';

  // Scroll al formulario
  const formEl = document.getElementById('news-form');
  if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
}

async function handleDelete(newsId: string) {
  if (!confirm('¿Estás seguro de eliminar esta noticia?')) return;

  try {
    const { error } = await actions.news.delete({ id: newsId });

    if (!error) {
      newsItems = newsItems.filter((n) => n.id !== newsId);
      toast.success('Noticia eliminada');
    } else {
      toast.error(`Error al eliminar: ${error.message}`);
    }
  } catch {
    toast.error('Error de conexión');
  }
}

async function _handleImageUpload(newsId: string) {
  if (!formImage) return;
  const uploadData = new FormData();
  uploadData.append('image', formImage);
  uploadData.append('newsId', newsId);

  const { error } = await actions.news.uploadImage(uploadData);
  if (error) {
    toast.warning(`Noticia guardada pero la imagen falló: ${error.message}`);
  }
}

async function handleSubmit() {
  if (!formTitle || !formContent) {
    toast.warning('Completa título y contenido');
    return;
  }

  _isSubmitting = true;

  try {
    const payload = {
      title: formTitle,
      content: formContent,
      status: formStatus,
      seriesId: selectedSeriesId,
    };
    const result =
      isEditing && editingNewsId
        ? await actions.news.update({ id: editingNewsId, ...payload })
        : await actions.news.create(payload);

    if (result.error) throw new Error(result.error.message);

    const savedNews = result.data;
    await _handleImageUpload(savedNews.id);

    toast.success(isEditing ? 'Noticia actualizada' : 'Noticia publicada');

    if (isEditing) {
      newsItems = newsItems.map((n) =>
        n.id === savedNews.id ? { ...savedNews, seriesId: selectedSeriesId } : n
      );
    } else {
      newsItems = [
        {
          ...savedNews,
          seriesId: selectedSeriesId,
          createdAt: savedNews.createdAt || new Date().toISOString(),
        },
        ...newsItems,
      ];
      window.dispatchEvent(new CustomEvent('new-news-created', { detail: { news: savedNews } }));
    }

    resetForm();
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    toast.error(`Fallo al guardar noticia: ${message}`);
  } finally {
    _isSubmitting = false;
  }
}

function handleImageChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.[0]) {
    formImage = input.files[0];
    _imagePreview = URL.createObjectURL(formImage);
  }
}
</script>

<div class="news-manager">
  {#if !selectedSeriesId}
    <div class="series-grid" in:fade>
      {#each allSeries as series (series.id)}
        {@const stats = getStats(series.id, newsItems)}
        <button class="series-card" onclick={() => selectSeries(series.id)}>
          <div class="series-cover">
            {#if series.coverImageUrl}
              <img src={_getImageUrl(series.coverImageUrl)} alt={series.title} />
            {:else}
              <div class="no-cover">NO COVER</div>
            {/if}
            {#if series.isNsfw}
              <span class="nsfw-badge">NSFW</span>
            {/if}
          </div>
          <div class="series-info">
            <h3>{series.title}</h3>
            <div class="stats">
              <span class="stat published"><b>{stats.published}</b> publicadas</span>
              <span class="stat draft"><b>{stats.draft}</b> borradores</span>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <div class="dashboard-view" in:fade>
      <div class="dashboard-nav">
        <button class="back-btn" onclick={goBackToSeries}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Volver
        </button>
        <h2>{allSeries.find(s => s.id === selectedSeriesId)?.title}</h2>
      </div>

      <div class="main-layout">
        <div class="editor-section" id="news-form">
          <div class="card editor-card">
            <h3>{isEditing ? 'Editar Noticia' : 'Nueva Noticia'}</h3>
            
            <div class="form-group">
              <label for="news-title">Título</label>
              <input 
                id="news-title"
                type="text" 
                bind:value={formTitle} 
                placeholder="Escribe el título..."
              />
            </div>

            <div class="form-group">
              <label for="news-content">Contenido (Markdown soportado)</label>
              <textarea 
                id="news-content"
                bind:value={formContent} 
                placeholder="Escribe el cuerpo de la noticia..."
                rows="10"
              ></textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="news-status">Estado</label>
                <select id="news-status" bind:value={formStatus}>
                  <option value="published">Publicado</option>
                  <option value="draft">Borrador</option>
                </select>
              </div>

              <div class="form-group">
                <label for="news-image">Imagen de cabecera (Opcional)</label>
                <div class="image-upload-wrapper">
                  <input 
                    id="news-image"
                    type="file" 
                    accept="image/*" 
                    onchange={handleImageChange}
                  />
                  {#if _imagePreview}
                  <div class="mini-preview" transition:slide>
                      <img src={_imagePreview} alt="Preview" />
                      <button class="remove-preview" onclick={() => { formImage = null; _imagePreview = null; }}>×</button>
                  </div>
                  {/if}
                </div>
              </div>
            </div>

            <div class="actions">
              {#if isEditing}
                <button class="btn-cancel" onclick={resetForm}>Cancelar edición</button>
              {/if}
              <button 
                class="btn-submit" 
                onclick={handleSubmit} 
                disabled={_isSubmitting}
              >
                {_isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar Noticia' : 'Publicar Noticia')}
              </button>
            </div>
            
            {#if !isEditing}
                 <span class="author-hint">Publicando como <strong>{currentUser?.username || currentUser?.email || 'Admin'}</strong></span>
            {/if}
          </div>
        </div>

        <div class="history-section">
          <h3>Historial de la serie</h3>
          <div class="history-list">
            {#if filteredNews.length === 0}
              <div class="empty-list" in:fade>
                <p>No hay noticias para esta serie.</p>
              </div>
            {:else}
              {#each filteredNews as news (news.id)}
                <div class="news-card-item" class:is-draft={news.status === 'draft'} in:fly={{ y: 20 }}>
                  <div class="item-content">
                    <h4>{news.title}</h4>
                    <span class="date">{new Date(news.createdAt).toLocaleDateString()}</span>
                    <p class="excerpt">{news.content.substring(0, 80)}...</p>
                  </div>
                  <div class="item-actions">
                    <button class="btn-edit" onclick={() => startEdit(news)} aria-label="Editar">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn-delete" onclick={() => handleDelete(news.id)} aria-label="Eliminar">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .news-manager { color: #eee; padding: 1rem; }
  
  .series-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .series-card {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    transition: transform 0.2s, border-color 0.2s;
    padding: 0;
  }

  .series-card:hover {
    transform: translateY(-5px);
    border-color: var(--accent-color);
  }

  .series-cover {
    height: 160px;
    position: relative;
    background: #000;
  }

  .series-cover img { width: 100%; height: 100%; object-fit: cover; opacity: 0.7; }
  .nsfw-badge { position: absolute; top: 10px; right: 10px; background: #ff4757; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; }

  .series-info { padding: 1rem; }
  .series-info h3 { margin: 0 0 0.5rem; font-size: 1.1rem; color: #fff; }
  .stats { display: flex; gap: 1rem; font-size: 0.8rem; color: #888; }
  .stat b { color: #fff; }

  .dashboard-view { animation: fadeIn 0.3s; }
  .dashboard-nav { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; }
  .back-btn { background: #333; border: none; color: #fff; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-weight: 600; }
  .back-btn:hover { background: #444; }

  .main-layout {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 2rem;
    align-items: start;
  }

  .card { background: #1a1a1a; border: 1px solid #333; border-radius: 20px; padding: 1.5rem; }
  .editor-card h3 { margin-top: 0; margin-bottom: 1.5rem; color: var(--accent-color); }

  .form-group { margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
  .form-group label { font-size: 0.85rem; font-weight: 600; color: #aaa; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

  input, textarea, select {
    background: #000;
    border: 1px solid #333;
    border-radius: 10px;
    padding: 0.75rem;
    color: #fff;
    font-family: inherit;
    outline: none;
  }

  input:focus, textarea:focus { border-color: var(--accent-color); }

  .image-upload-wrapper { position: relative; }
  .mini-preview { margin-top: 0.5rem; position: relative; width: 100px; height: 60px; border-radius: 8px; overflow: hidden; }
  .mini-preview img { width: 100%; height: 100%; object-fit: cover; }
  .remove-preview { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7); border: none; color: #fff; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; }

  .actions { display: flex; gap: 1rem; margin-top: 1rem; }
  .btn-submit { flex: 1; background: var(--accent-color); color: #000; border: none; padding: 0.8rem; border-radius: 12px; font-weight: 800; cursor: pointer; }
  .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-cancel { background: #333; color: #fff; border: none; padding: 0.8rem; border-radius: 12px; cursor: pointer; }
  
  .author-hint { display: block; margin-top: 1rem; font-size: 0.75rem; color: #666; text-align: center; }

  .history-list { display: flex; flex-direction: column; gap: 1rem; }
  .news-card-item {
    background: #111;
    border: 1px solid #222;
    border-radius: 14px;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: border-color 0.2s;
  }
  .news-card-item:hover { border-color: #444; }
  .news-card-item.is-draft { border-left: 4px solid #f1c40f; }

  .item-content h4 { margin: 0 0 0.25rem; font-size: 0.95rem; }
  .item-content .date { font-size: 0.7rem; color: #666; }
  .item-content .excerpt { font-size: 0.8rem; color: #888; margin: 0.5rem 0 0; }

  .item-actions { display: flex; gap: 0.5rem; }
  .item-actions button { background: #222; border: none; color: #888; padding: 0.5rem; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
  .item-actions .btn-edit:hover { background: #2980b9; color: #fff; }
  .item-actions .btn-delete:hover { background: #c0392b; color: #fff; }

  .empty-list { text-align: center; padding: 2rem; color: #555; font-style: italic; }

  @media (max-width: 1024px) {
    .main-layout { grid-template-columns: 1fr; }
  }
</style>
