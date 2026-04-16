<script lang="ts">
import { actions } from 'astro:actions';
import { fade, fly, slide } from 'svelte/transition';
import { toast } from '../lib/stores.svelte';
import { generateUUID } from '../lib/utils';
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
// eslint-disable-next-line svelte/prefer-writable-derived
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
let showMarkdownHelp = $state(false);

// Orion: Predecir ruta final de la imagen (Evitar blob:)
const predictedImagePath = $derived.by(() => {
  if (!formImage) return '';
  const cleanName = formImage.name.replace(/[^a-zA-Z0-9.]/g, '_');
  const id = editingNewsId || 'pending';

  // Orion: Lógica de carpetas pre-existentes y prefijo de archivo para evitar subcarpetas
  const isGlobal = selectedSeriesId === -1;
  const folder = isGlobal ? 'news/global_news' : 'news';
  const fileName = `${id}_${cleanName}`;

  // Astra: Si es el proxy interno, usamos ruta relativa "/" para que funcione en móviles en local
  const isInternalProxy = !r2PublicUrlAssets || r2PublicUrlAssets.includes('/api/assets/proxy');
  const base = isInternalProxy ? '/api/assets/proxy' : r2PublicUrlAssets;

  const fullPath = `${base}/${folder}/${fileName}`.replace(/([^:]\/)\/+/g, '$1');

  return fullPath;
});

// Filtrar noticias derivado
const filteredNews = $derived(
  selectedSeriesId === -1
    ? newsItems.filter((n) => n.seriesId === null)
    : selectedSeriesId
      ? newsItems.filter((n) => n.seriesId === selectedSeriesId)
      : []
);

// Orion: Helper para obtener conteos
function getStats(seriesId: number | null, currentItems: NewsItem[]) {
  const seriesNews = currentItems.filter((n) => n.seriesId === seriesId);
  return {
    published: seriesNews.filter((n) => n.status === 'published').length,
    draft: seriesNews.filter((n) => n.status === 'draft').length,
  };
}

function selectSeries(id: number | null) {
  selectedSeriesId = id === null ? -1 : id;
  resetForm();
  isEditing = false;
  // Pre-generar un ID para noticias nuevas para que las rutas de imágenes sean permanentes
  editingNewsId = generateUUID();
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

async function toggleNewsStatus(news: NewsItem) {
  try {
    const { error, data } = await actions.news.toggleStatus({
      id: news.id,
      currentStatus: (news.status as 'draft' | 'published') || 'published',
    });

    if (!error && data) {
      newsItems = newsItems.map((n) => (n.id === news.id ? { ...n, status: data.status } : n));
      toast.success(data.status === 'published' ? 'Noticia publicada' : 'Noticia en borrador');
    } else {
      toast.error(`Error: ${error?.message || 'No se pudo cambiar el estado'}`);
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
      seriesId: selectedSeriesId === -1 ? null : selectedSeriesId,
    };

    const result =
      isEditing && editingNewsId
        ? await actions.news.update({ id: editingNewsId as string, ...payload })
        : await actions.news.create({ ...payload, id: editingNewsId as string });

    if (result.error) throw new Error(result.error.message);

    const savedNews = result.data;
    await _handleImageUpload(savedNews.id);

    toast.success(isEditing ? 'Noticia actualizada' : 'Noticia publicada');

    if (isEditing) {
      newsItems = newsItems.map((n) =>
        n.id === savedNews.id
          ? { ...savedNews, seriesId: selectedSeriesId === -1 ? null : selectedSeriesId }
          : n
      );
    } else {
      newsItems = [
        {
          ...savedNews,
          seriesId: selectedSeriesId === -1 ? null : selectedSeriesId,
          createdAt: savedNews.createdAt || new Date().toISOString(),
        },
        ...newsItems,
      ];
      window.dispatchEvent(new CustomEvent('new-news-created', { detail: { news: savedNews } }));
    }

    resetForm();
    if (selectedSeriesId !== null) editingNewsId = generateUUID();
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

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success('Copiado al portapapeles');
}
</script>

<div class="news-manager">
  {#if !selectedSeriesId}
    <div class="series-grid">
      <!-- Tarjeta para Noticias Globales -->
      <button class="series-card global-card" onclick={() => selectSeries(null)}>
        <div class="series-cover global-cover">
          <div class="global-icon-wrapper">
             <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="premium-icon">
               <path d="M4.9 19.1a10 10 0 0 1 0-14.2" />
               <path d="M7.8 16.2a6 6 0 0 1 0-8.4" />
               <circle cx="12" cy="12" r="2" />
               <path d="M16.2 7.8a6 6 0 0 1 0 8.4" />
               <path d="M19.1 4.9a10 10 0 0 1 0 14.2" />
             </svg>
          </div>
          <div class="gradient-overlay"></div>
          <div class="card-badges-right">
            <span class="news-stat-badge published" title="Publicadas">{getStats(null, newsItems).published}</span>
            <span class="news-stat-badge draft" title="Borradores">{getStats(null, newsItems).draft}</span>
          </div>
          <div class="series-info-overlay">
            <h3>Noticias Globales</h3>
          </div>
        </div>
      </button>

      {#each allSeries as series (series.id)}
        <button class="series-card" onclick={() => selectSeries(series.id)}>
          <div class="series-cover">
            {#if series.coverImageUrl}
              <img src={_getImageUrl(series.coverImageUrl)} alt={series.title} />
            {:else}
              <div class="no-cover">NO COVER</div>
            {/if}
            
            <div class="gradient-overlay"></div>

            <div class="card-badges-right">
              <span class="news-stat-badge published" title="Publicadas">{getStats(series.id, newsItems).published}</span>
              <span class="news-stat-badge draft" title="Borradores">{getStats(series.id, newsItems).draft}</span>
            </div>

            {#if series.isNsfw}
              <span class="nsfw-badge">NSFW</span>
            {/if}

            <div class="series-info-overlay">
              <h3>{series.title}</h3>
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
        <h2>{selectedSeriesId === -1 ? 'Noticias Globales' : allSeries.find(s => s.id === selectedSeriesId)?.title}</h2>
      </div>

      <div class="main-layout">
        <div class="editor-section" id="news-form">
          <div class="card editor-card">
            <div class="editor-header">
              <h3>{isEditing ? 'Editar Noticia' : 'Nueva Noticia'}</h3>
              <button class="help-toggle" onclick={() => showMarkdownHelp = !showMarkdownHelp}>
                {showMarkdownHelp ? 'Cerrar Guía' : 'Guía de Formato (Markdown)'}
              </button>
            </div>

            {#if showMarkdownHelp}
              <div class="markdown-guide" transition:slide>
                <div class="guide-header-pro">
                  <h4>Centro de Formato Editorial</h4>
                  <span class="badge-markdown">Markdown Pro</span>
                </div>
                
                <div class="guide-grid-pro">
                  <div class="guide-section">
                    <h5>Texto y Énfasis</h5>
                    <div class="guide-row"><code>**Negrita**</code> ➜ <strong>Texto</strong></div>
                    <div class="guide-row"><code>*Itálica*</code> ➜ <em>Texto</em></div>
                    <div class="guide-row"><code>~~Tachado~~</code> ➜ <del>Texto</del></div>
                  </div>

                  <div class="guide-section">
                    <h5>Estructura</h5>
                    <div class="guide-row"><code># Título</code> ➜ Título Grande</div>
                    <div class="guide-row"><code>## Subtítulo</code> ➜ Título Medio</div>
                    <div class="guide-row"><code>---</code> ➜ Línea Separadora</div>
                  </div>

                  <div class="guide-section">
                    <h5>Organización</h5>
                    <div class="guide-row"><code>- Item</code> ➜ Lista de puntos</div>
                    <div class="guide-row"><code>1. Item</code> ➜ Lista numerada</div>
                    <div class="guide-row"><code>> Cita</code> ➜ Bloque destacado</div>
                  </div>

                  <div class="guide-section">
                    <h5>Multimedia</h5>
                    <div class="guide-row"><code>[Link](url)</code> ➜ Enlace azul</div>
                    <div class="guide-row"><code>![Alt](url)</code> ➜ Imagen centrada</div>
                  </div>
                </div>
                <div class="guide-tips">
                  <p><strong>Alineación:</strong> El texto fluye de izquierda a derecha por defecto. Babylon centra automáticamente las imágenes y títulos para mantener el look editorial premium.</p>
                </div>
              </div>
            {/if}
            
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
              <label for="news-content">Contenido</label>
              <textarea 
                id="news-content"
                bind:value={formContent} 
                placeholder="Escribe el cuerpo de la noticia... Usa Markdown para un acabado profesional."
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
                <label for="news-image">Añadir imagen</label>
                <div class="image-upload-wrapper">
                  <input 
                    id="news-image"
                    type="file" 
                    accept="image/*" 
                    onchange={handleImageChange}
                  />
                  {#if _imagePreview}
                  <div class="image-snippet-box" transition:slide>
                    <div class="mini-preview">
                        <img src={_imagePreview} alt="Preview" />
                        <button class="remove-preview" onclick={() => { formImage = null; _imagePreview = null; }}>×</button>
                    </div>
                    <div class="snippet-action">
                      <p>Para insertar esta imagen, copia y pega esto:</p>
                      <div class="snippet-row">
                        <code>![imagen]({predictedImagePath})</code>
                        <button class="copy-snippet" onclick={() => copyToClipboard(`![imagen](${predictedImagePath})`)}>Copiar</button>
                      </div>
                      <small>Nota: La imagen se subirá a esta ruta al guardar.</small>
                    </div>
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
          <h3>Historial {selectedSeriesId === -1 ? 'Global' : 'de la serie'}</h3>
          <div class="history-list">
            {#if filteredNews.length === 0}
              <div class="empty-list" in:fade>
                <p>No hay noticias {selectedSeriesId === -1 ? 'globales' : 'para esta serie'}.</p>
              </div>
            {:else}
              {#each filteredNews as news (news.id)}
                <div class="news-card-item" class:is-draft={news.status === 'draft'} in:fly={{ y: 20 }}>
                  <div class="item-content">
                    <h4>{news.title}</h4>
                    <span class="date">{new Date(news.createdAt).toLocaleDateString('es-ES')}</span>
                    <p class="excerpt">{news.content.substring(0, 80)}...</p>
                  </div>
                  <div class="item-actions">
                    <button 
                      class="btn-toggle-status" 
                      class:is-published={news.status === 'published'}
                      onclick={() => toggleNewsStatus(news)} 
                      title={news.status === 'published' ? 'Borrador' : 'Publicar'}
                    >
                      {#if news.status === 'published'}
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      {:else}
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      {/if}
                    </button>
                    <a href={`/news/${news.id}`} target="_blank" class="btn-preview" title="Previsualizar">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                    </a>
                    <button class="btn-edit" onclick={() => startEdit(news)} title="Editar" aria-label="Editar">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn-delete" onclick={() => handleDelete(news.id)} title="Eliminar" aria-label="Eliminar">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1.5rem;
  }

  .series-card {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    transition: transform 0.2s, border-color 0.2s;
    padding: 0;
    position: relative;
    aspect-ratio: 2/3;
  }

  .series-card:hover {
    transform: translateY(-5px);
    border-color: var(--accent-color);
  }

  .series-cover {
    width: 100%;
    height: 100%;
    position: relative;
    background: #000;
  }

  .global-cover {
    background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .global-icon-wrapper {
    color: var(--accent-color, #00bfff);
    opacity: 0.5;
    transition: opacity 0.3s;
  }

  .global-card:hover .global-icon-wrapper {
    opacity: 1;
  }

  .series-cover img { 
    width: 100%; 
    height: 100%; 
    object-fit: cover; 
    opacity: 0.8; 
  }

  .gradient-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, transparent 100%);
    z-index: 1;
  }

  .card-badges-right {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    flex-direction: row;
    gap: 4px;
    z-index: 2;
  }

  .news-stat-badge {
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 900;
    color: #fff;
    min-width: 24px;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  }
  .news-stat-badge.published { background: #22c55e; }
  .news-stat-badge.draft { background: #f97316; }

  .nsfw-badge { 
    position: absolute; 
    top: 8px; 
    left: 8px; 
    background: #ff4757; 
    color: #fff; 
    padding: 2px 6px; 
    border-radius: 4px; 
    font-size: 0.65rem; 
    font-weight: 800; 
    z-index: 2;
  }

  .series-info-overlay { 
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 1rem; 
    z-index: 2;
  }

  .series-info-overlay h3 { 
    margin: 0; 
    font-size: 0.95rem; 
    color: #fff; 
    font-weight: 800;
    line-height: 1.2;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

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

  .editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
  .editor-header h3 { margin: 0; }
  .help-toggle { background: rgba(255,255,255,0.05); border: 1px solid #444; color: #aaa; padding: 4px 12px; border-radius: 8px; font-size: 0.75rem; cursor: pointer; transition: all 0.2s; }
  .help-toggle:hover { border-color: var(--accent-color); color: #fff; }

  .markdown-guide { background: rgba(0,0,0,0.2); border: 1px solid #333; border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem; }
  .markdown-guide h4 { margin-top: 0; margin-bottom: 0.75rem; font-size: 0.9rem; color: var(--accent-color); }
  .guide-grid-pro { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1.5rem; }
  .guide-section h5 { margin-top: 0; margin-bottom: 0.5rem; font-size: 0.75rem; color: #888; text-transform: uppercase; }
  .guide-row { font-size: 0.75rem; margin-bottom: 4px; color: #ccc; }
  .guide-row code { background: #000; padding: 2px 4px; border-radius: 4px; color: var(--accent-color); }
  .guide-tips { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #333; font-size: 0.7rem; color: #666; font-style: italic; }

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

  .image-upload-wrapper { position: relative; width: 100%; min-width: 0; }
  .image-snippet-box { 
    margin-top: 1rem; 
    background: #111; 
    border: 1px solid #222; 
    border-radius: 12px; 
    padding: 0.75rem; 
    display: flex; 
    gap: 1rem; 
    align-items: center; 
    max-width: 100%;
    overflow: hidden;
  }
  .mini-preview { position: relative; width: 60px; height: 60px; border-radius: 8px; overflow: hidden; flex-shrink: 0; }
  .mini-preview img { width: 100%; height: 100%; object-fit: cover; }
  .remove-preview { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7); border: none; color: #fff; border-radius: 50%; width: 16px; height: 16px; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; }

  .snippet-action { flex-grow: 1; min-width: 0; }
  .snippet-action p { margin: 0 0 4px; font-size: 0.75rem; color: #888; }
  .snippet-row { display: flex; gap: 8px; align-items: center; width: 100%; min-width: 0; }
  .snippet-row code { 
    background: #000; 
    padding: 6px 10px; 
    border-radius: 6px; 
    font-size: 0.7rem; 
    color: var(--accent-color); 
    flex-grow: 1; 
    flex-shrink: 1; 
    flex-basis: 0; 
    border: 1px solid #222;
    /* Astra: Fix para URLs ultra-largas que rompen el layout */
    white-space: normal;
    word-break: break-all;
    overflow-wrap: anywhere;
    display: block;
    min-width: 0;
    line-height: 1.4;
  }
  .copy-snippet { 
    background: #333; 
    border: none; 
    color: #fff; 
    padding: 4px 10px; 
    border-radius: 6px; 
    font-size: 0.7rem; 
    cursor: pointer; 
    flex-shrink: 0; /* Evita que el botón se encoja */
  }
  .copy-snippet:hover { background: #444; }
  .snippet-action small { display: block; margin-top: 4px; font-size: 0.65rem; color: #555; }

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
  .item-actions .btn-preview:hover { background: var(--accent-color); color: #000; }
  .item-actions .btn-delete:hover { background: #c0392b; color: #fff; }
  
  .btn-toggle-status:hover { background: #444; color: #fff; }
  .btn-toggle-status.is-published { color: #22c55e; }
  .btn-toggle-status.is-published:hover { background: rgba(34, 197, 94, 0.1); }

  .item-actions .btn-preview {
    background: #222;
    color: #888;
    padding: 0.5rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    text-decoration: none;
  }

  .empty-list { text-align: center; padding: 2rem; color: #555; font-style: italic; }

  @media (max-width: 1024px) {
    .main-layout { grid-template-columns: 1fr; }
  }
</style>
