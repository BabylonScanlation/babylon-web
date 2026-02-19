<script lang="ts">
import { actions } from 'astro:actions';
import { fade, fly, slide } from 'svelte/transition';
import { toast } from '../lib/toastStore.svelte';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentUser?: any;
  r2PublicUrlAssets?: string;
}

let {
  allSeries = [],
  initialNews = [],
  currentUser = null,
  r2PublicUrlAssets = '',
}: Props = $props();

// Estado local reactivo para las noticias (Svelte 5)
let newsItems = $state<NewsItem[]>(initialNews);

// Orion: Normalizador de imágenes
const getImageUrl = (path: string | null) => {
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
let isSubmitting = $state(false);
let formImage = $state<File | null>(null);
let imagePreview = $state<string | null>(null);

// Author logic derivada
const authorToDisplay = $derived(currentUser?.username || currentUser?.displayName || 'Admin');

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
  formStatus = 'draft';
  formImage = null;
  imagePreview = null;
  editingNewsId = null;
  isEditing = false;
  isSubmitting = false;
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
      toast.error('Error al eliminar: ' + error.message);
    }
  } catch {
    toast.error('Error de conexión');
  }
}

async function handleSubmit() {
  if (!formTitle || !formContent) {
    toast.warning('Completa título y contenido');
    return;
  }

  isSubmitting = true;

  try {
    const payload = {
      title: formTitle,
      content: formContent,
      status: formStatus,
      seriesId: selectedSeriesId,
    };

    let result;

    if (isEditing && editingNewsId) {
      result = await actions.news.update({ id: editingNewsId, ...payload });
    } else {
      result = await actions.news.create(payload);
    }

    if (result.error) throw new Error(result.error.message);

    const savedNews = result.data;

    if (formImage) {
      const uploadData = new FormData();
      uploadData.append('image', formImage);
      uploadData.append('newsId', savedNews.id);

      const { error: uploadError } = await actions.news.uploadImage(uploadData);
      if (uploadError) {
        toast.warning('Noticia guardada pero la imagen falló: ' + uploadError.message);
      }
    }

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

      // Orion: Notificar al Servicio de Noticias centralizado
      window.dispatchEvent(
        new CustomEvent('new-news-created', {
          detail: { news: savedNews },
        })
      );
    }

    resetForm();
  } catch (error: any) {
    console.error(error);
    toast.error('Fallo al guardar noticia: ' + error.message);
  } finally {
    isSubmitting = false;
  }
}

function handleImageChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    formImage = input.files[0];
    imagePreview = URL.createObjectURL(formImage);
  }
}
</script>

<div class="news-manager">
  
  {#if allSeries.length === 0}
    <div class="empty-state" in:fade>
      <div class="icon">📢</div>
      <h3>No hay series disponibles</h3>
      <p>Primero debes registrar una obra para poder publicar noticias.</p>
    </div>

  {:else if selectedSeriesId === null}
    <div class="selector-view" in:fly={{ y: 20, duration: 400 }}>
      <div class="series-grid">
        {#each allSeries as serie (serie.id)}
          {@const stats = getStats(serie.id, newsItems)}
          <div class="card-wrapper">
            <button class="series-card" onclick={() => selectSeries(serie.id)}>
              <div class="card-image">
                  {#if serie.coverImageUrl}
                    <img src={getImageUrl(serie.coverImageUrl)} alt={serie.title} loading="lazy" />
                  {:else}
                    <div class="placeholder">SIN PORTADA</div>
                  {/if}
              </div>
              
              <!-- Astra: Indicadores de estado duales siempre visibles -->
              <div class="card-top-info">
                <div class="stats-badges">
                  <span class="stat-badge published" title="Publicadas">{stats.published}</span>
                  <span class="stat-badge draft" title="Borradores">{stats.draft}</span>
                  {#if serie.isNsfw}
                    <span class="stat-badge nsfw" title="Contenido +18">+18</span>
                  {/if}
                </div>
                <span class="action-hint-top">Gestionar →</span>
              </div>

              <div class="card-overlay">
                  <span class="series-title">{serie.title}</span>
              </div>
            </button>
          </div>
        {/each}
      </div>
    </div>

  {:else}
    <div class="dashboard-view" in:fade>
      <div class="dashboard-nav">
        <button class="back-btn" onclick={goBackToSeries}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Volver a Proyectos
        </button>
        <div class="current-context">
            <span>Publicando en</span>
            <strong class="text-gradient">{allSeries.find(s => s.id === selectedSeriesId)?.title}</strong>
        </div>
      </div>

      <div class="main-layout">
        <!-- Editor -->
        <section class="editor-pane" id="news-form">
          <div class="glass-editor">
            <header class="editor-header">
              <h3>{isEditing ? '✏️ Editando' : '✨ Nueva Noticia'}</h3>
              {#if isEditing}
                <button class="close-edit-btn" onclick={resetForm} title="Cancelar edición">✕</button>
              {/if}
            </header>
            
            <div class="compact-form-grid">
              <!-- Fila Superior: Título + Visibilidad + Imagen -->
              <div class="top-row">
                <label for="n-title" class="sr-only">Título de la noticia</label>
                <input 
                  type="text" 
                  id="n-title" 
                  name="news-title"
                  bind:value={formTitle} 
                  placeholder="Título de la noticia..." 
                  class="glass-input title-input"
                />

                <div class="controls-group">
                  <div class="select-wrapper">
                    <label for="n-status" class="sr-only">Estado</label>
                    <select id="n-status" name="news-status" bind:value={formStatus} class="glass-select">
                        <option value="draft">🔒 Borrador</option>
                        <option value="published">🌍 Público</option>
                    </select>
                  </div>
                  
                  <label for="n-image" class="icon-btn-file" title={formImage ? "Cambiar imagen" : "Adjuntar imagen"}>
                    <input type="file" id="n-image" name="news-image" onchange={handleImageChange} accept="image/*" />
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    {#if formImage}<span class="dot-indicator"></span>{/if}
                  </label>
                </div>
              </div>

              <!-- Área de Texto -->
              <div class="textarea-wrapper">
                <label for="n-content" class="sr-only">Contenido de la noticia</label>
                <textarea 
                  id="n-content" 
                  name="news-content"
                  bind:value={formContent} 
                  rows="6" 
                  placeholder="Escribe aquí las novedades..." 
                  class="glass-textarea"
                ></textarea>
              </div>

              <!-- Preview de Imagen -->
              {#if imagePreview}
                  <div class="mini-preview" transition:slide>
                      <img src={imagePreview} alt="Preview" />
                      <button class="remove-preview" onclick={() => { formImage = null; imagePreview = null; }}>×</button>
                  </div>
              {/if}

              <!-- Footer de Acción -->
              <div class="editor-footer-compact">
                 <span class="author-hint">Publicando como <strong>{currentUser?.username || currentUser?.displayName || 'Admin'}</strong></span>
                 <button class="btn-glass-primary" onclick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? '...' : (isEditing ? 'Guardar' : 'Publicar')}
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                 </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Historial -->
        <section class="history-pane">
          <header class="section-header">
            <h3>📜 Historial</h3>
            <span class="count-chip">{filteredNews.length}</span>
          </header>
          
          <div class="history-list">
            {#if filteredNews.length === 0}
              <div class="empty-list" in:fade>
                <p>No se han registrado noticias aún para este proyecto.</p>
              </div>
            {:else}
              {#each filteredNews as item (item.id)}
                <div class="history-card" in:slide={{ duration: 300 }}>
                  <div class="card-main">
                    <div class="card-info">
                        <h4>{item.title}</h4>
                        <div class="card-meta">
                            <span class="status-dot {item.status}"></span>
                            <span class="status-text">{item.status === 'published' ? 'Pública' : 'Borrador'}</span>
                            <span class="dot-separator">•</span>
                            <time>{new Date(item.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</time>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="action-icon edit" onclick={() => startEdit(item)} title="Editar">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="action-icon delete" onclick={() => handleDelete(item.id)} title="Eliminar">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </section>
      </div>
    </div>
  {/if}
</div>

<style>
  .news-manager {
    color: #e0e0e0;
    font-family: 'Inter', system-ui, sans-serif;
  }

  /* Shared Components */
  .text-gradient {
    background: linear-gradient(90deg, #4facfe, #00f2fe);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  /* --- SELECTOR VIEW --- */
  .selector-view { text-align: center; }

  .series-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1.5rem;
  }

  @media (max-width: 600px) {
    .series-grid {
      grid-template-columns: repeat(3, 1fr); /* FORZAMOS 3 COLUMNAS */
      gap: 0.75rem;
    }
    
    .series-title {
      font-size: 0.7rem;
      line-height: 1.1;
      margin-bottom: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-overlay {
      padding: 0.5rem;
    }
  }

  .card-wrapper {
    padding: 10px 0;
    display: flex;
  }

  .series-card {
    background: #1a1a1a;
    border: none;
    border-radius: 16px;
    padding: 0;
    cursor: pointer;
    overflow: hidden;
    position: relative;
    aspect-ratio: 2/3;
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    width: 100%;
  }

  .card-wrapper:hover .series-card {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 12px 30px rgba(0,0,0,0.4);
  }

  .card-image { width: 100%; height: 100%; position: relative; }
  .card-image img { width: 100%; height: 100%; object-fit: cover; }
  .card-image .placeholder { width: 100%; height: 100%; display: grid; place-items: center; background: #222; color: #444; font-size: 0.8rem; font-weight: 800; }

  .card-top-info {
    position: absolute;
    top: 0.6rem;
    left: 0.6rem;
    right: 0.6rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 10;
  }

  .stats-badges {
    display: flex;
    gap: 4px;
  }

  .stat-badge {
    font-size: 0.65rem;
    font-weight: 900;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid rgba(0, 0, 0, 0.4);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    color: #000;
  }

  .stat-badge.published {
    background: #2ecc71; /* Verde esmeralda */
  }

  .stat-badge.draft {
    background: #f39c12; /* Naranja borrador */
  }

  .stat-badge.nsfw {
    background: #e74c3c; /* Rojo NSFW */
    color: #fff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .action-hint-top {
    margin-left: auto;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    color: #fff;
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    padding: 4px 8px;
    border-radius: 6px;
    opacity: 0;
    transform: translateY(-5px);
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .card-wrapper:hover .action-hint-top {
    opacity: 1;
    transform: translateY(0);
  }

  .card-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, transparent 100%);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 1.2rem;
    text-align: left;
  }

  .series-title { color: #fff; font-weight: 700; font-size: 1rem; line-height: 1.2; }

  /* --- DASHBOARD VIEW --- */
  .dashboard-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .back-btn {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
    color: #888;
    padding: 0.6rem 1.2rem;
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-weight: 600;
    transition: all 0.2s;
  }
  .back-btn:hover { background: rgba(255,255,255,0.08); color: #fff; border-color: #fff; }

  .current-context { text-align: right; }
  .current-context span { display: block; font-size: 0.75rem; color: #666; text-transform: uppercase; font-weight: 700; }
  .current-context strong { font-size: 1.2rem; }

  .main-layout {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 2.5rem;
    align-items: start;
  }

  .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
  .section-header h3 { margin: 0; font-size: 1.1rem; color: #fff; font-weight: 800; }
  .count-chip { background: #252525; padding: 2px 10px; border-radius: 20px; font-size: 0.8rem; color: #aaa; font-weight: 700; }

  /* Editor Pane Reformatted */
  .glass-editor {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 16px;
    padding: 1.5rem;
    backdrop-filter: blur(10px);
  }

  .editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
  .editor-header h3 { font-size: 0.9rem; text-transform: uppercase; color: #888; font-weight: 800; letter-spacing: 0.05em; margin: 0; }
  .close-edit-btn { background: none; border: none; color: #666; cursor: pointer; font-weight: bold; }
  .close-edit-btn:hover { color: #ff4757; }

  .compact-form-grid { display: flex; flex-direction: column; gap: 0.8rem; }

  .top-row { display: flex; gap: 0.8rem; align-items: center; }
  .controls-group { display: flex; gap: 0.5rem; align-items: center; }

  .glass-input, .glass-textarea, .glass-select {
    background: #0a0a0a;
    border: 1px solid #222;
    color: #fff;
    border-radius: 8px;
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
    transition: all 0.2s;
    font-family: inherit;
  }
  .glass-input:focus, .glass-textarea:focus, .glass-select:focus {
    outline: none;
    border-color: #4facfe;
    background: #111;
  }

  .title-input { flex: 1; font-weight: 700; }

  .glass-select { padding: 0.6rem 0.5rem; cursor: pointer; background: #0a0a0a; color: #aaa; font-size: 0.8rem; }
  
  .icon-btn-file {
    position: relative;
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1a1a1a;
    border: 1px dashed #444;
    border-radius: 8px;
    color: #666;
    cursor: pointer;
    transition: all 0.2s;
  }
  .icon-btn-file:hover { color: #fff; border-color: #666; }
  .icon-btn-file input { display: none; }
  .dot-indicator { position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; background: #4facfe; border-radius: 50%; border: 2px solid #000; }

  .glass-textarea { min-height: 100px; resize: vertical; }

  .mini-preview { display: flex; align-items: center; gap: 10px; background: #111; padding: 5px; border-radius: 8px; border: 1px solid #222; }
  .mini-preview img { height: 40px; width: 40px; object-fit: cover; border-radius: 4px; }
  .remove-preview { background: none; border: none; color: #666; cursor: pointer; font-size: 1.2rem; padding: 0 5px; }
  .remove-preview:hover { color: #fff; }

  .editor-footer-compact { display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; }
  .author-hint { font-size: 0.7rem; color: #444; }
  .author-hint strong { color: #666; }

  .btn-glass-primary {
    background: #fff;
    color: #000;
    border: none;
    padding: 0.5rem 1.2rem;
    border-radius: 8px;
    font-weight: 800;
    font-size: 0.8rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: transform 0.1s;
  }
  .btn-glass-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(255,255,255,0.1); }
  .btn-glass-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* History Pane */
  .history-list { display: flex; flex-direction: column; gap: 1rem; max-height: 700px; overflow-y: auto; padding-right: 0.5rem; }
  .history-list::-webkit-scrollbar { width: 4px; }
  .history-list::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }

  .history-card { background: #1a1a1a; padding: 1.2rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.03); transition: all 0.2s; }
  .history-card:hover { border-color: rgba(255,255,255,0.08); background: #222; }

  .card-main { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  .card-info h4 { margin: 0 0 0.4rem 0; font-size: 1rem; color: #eee; }
  .card-meta { display: flex; align-items: center; gap: 0.6rem; font-size: 0.75rem; color: #666; font-weight: 600; }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; }
  .status-dot.published { background: #2ecc71; box-shadow: 0 0 8px rgba(46, 204, 113, 0.4); }
  .status-dot.draft { background: #f1c40f; }
  .status-text { text-transform: uppercase; letter-spacing: 0.5px; }

  .action-icon { background: transparent; border: none; color: #444; padding: 6px; cursor: pointer; border-radius: 8px; transition: all 0.2s; }
  .action-icon:hover { background: rgba(255,255,255,0.05); color: #fff; }
  .action-icon.delete:hover { color: #ff4757; background: rgba(255, 71, 87, 0.1); }

  .empty-state { text-align: center; padding: 5rem 2rem; color: #444; }
  .empty-state .icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.3; }

  @media (max-width: 1024px) {
    .main-layout { grid-template-columns: 1fr; }
  }
</style>