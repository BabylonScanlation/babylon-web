<script lang="ts">
import { actions } from 'astro:actions';
import { onMount } from 'svelte';

interface Chapter {
  id: number;
  title: string | null;
  chapterNumber: string | number; // Orion: Migrado a camelCase
  urlPortada: string | null; // Orion: Migrado a camelCase
}

let {
  chapter = $bindable(),
  seriesSlug,
  r2PublicUrlAssets,
} = $props<{
  chapter: Chapter;
  seriesSlug: string;
  r2PublicUrlAssets: string;
}>();

let title = $state(chapter.title || '');
let isLoading = $state(false);
let isEditing = $state(false);
let isSelected = $state(false);
let deleteState = $state<'idle' | 'confirm' | 'deleting'>('idle');
let message = $state({ type: '', text: '' });

let deleteTimeout: ReturnType<typeof setTimeout> | undefined;
let fileInput: HTMLInputElement | undefined = $state();

onMount(() => {
  const handleGlobalToggle = (e: Event) => {
    const customEvent = e as CustomEvent<{ isChecked: boolean }>;
    isSelected = customEvent.detail.isChecked;
    dispatchSelection();
  };
  window.addEventListener('toggleAllChapters', handleGlobalToggle);
  return () => {
    window.removeEventListener('toggleAllChapters', handleGlobalToggle);
    clearTimeout(deleteTimeout);
  };
});

function showMessage(type: string, text: string) {
  message = { type, text };
  setTimeout(() => {
    message = { type: '', text: '' };
  }, 3000);
}

function dispatchSelection() {
  const event = new CustomEvent('chapterSelectionChanged', {
    detail: { id: chapter.id, isSelected },
  });
  window.dispatchEvent(event);
}

async function saveTitle() {
  if (title === chapter.title) {
    isEditing = false;
    return;
  }
  isLoading = true;

  try {
    const { error } = await actions.chapters.update({
      chapterId: chapter.id,
      title,
    });

    if (error) throw new Error(error.message);

    chapter.title = title;
    isEditing = false;
    showMessage('success', 'Guardado');
  } catch {
    showMessage('error', 'Error');
  } finally {
    isLoading = false;
  }
}

async function handleDelete() {
  if (deleteState === 'idle') {
    deleteState = 'confirm';
    clearTimeout(deleteTimeout);
    deleteTimeout = setTimeout(() => {
      deleteState = 'idle';
    }, 3000);
    return;
  }

  if (deleteState === 'confirm') {
    deleteState = 'deleting';
    isLoading = true;
    clearTimeout(deleteTimeout);

    try {
      const { error } = await actions.chapters.deleteBulk({ chapterIds: [chapter.id] });
      if (error) throw new Error(error.message);

      window.dispatchEvent(new CustomEvent('chapterDeleted', { detail: { id: chapter.id } }));
    } catch {
      showMessage('error', 'Error');
      isLoading = false;
      deleteState = 'idle';
    }
  }
}

async function handleThumbnailUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  isLoading = true;
  const formData = new FormData();
  formData.append('chapterId', chapter.id.toString());
  formData.append('thumbnailImage', file);

  try {
    const { data, error } = await actions.chapters.uploadThumbnail(formData);

    if (error) throw new Error(error.message);

    chapter.urlPortada = `${data.thumbnailUrl}?t=${Date.now()}`;
    showMessage('success', 'Img OK');
  } catch {
    showMessage('error', 'Error Img');
  } finally {
    isLoading = false;
    input.value = '';
  }
}

function openCropper() {
  window.dispatchEvent(
    new CustomEvent('openCropperModal', {
      detail: {
        chapterId: chapter.id,
        seriesSlug: seriesSlug,
        chapterNumber: chapter.chapterNumber,
      },
    })
  );
}

const finalUrl = $derived.by(() => {
  if (!chapter.urlPortada)
    return `${r2PublicUrlAssets}/covers/placeholder-chapter.jpg`.replace(/([^:]\/)\/+/g, '$1');
  if (chapter.urlPortada.startsWith('http') || chapter.urlPortada.startsWith('/'))
    return chapter.urlPortada;
  return `${r2PublicUrlAssets}/${chapter.urlPortada}`.replace(/([^:]\/)\/+/g, '$1');
});
</script>

<div class="chapter-card" class:selected={isSelected} class:loading={isLoading} data-chapter-id={chapter.id}>
  <div class="card-cover">
    <div class="img-container">
        <img
            src={finalUrl}
            alt={`Portada Cap ${chapter.chapterNumber}`}
            class="cover-img"
            onerror={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (img) {
                    img.onerror = null;  
                    img.src = `${r2PublicUrlAssets}/covers/placeholder-chapter.jpg`.replace(/([^:]\/)\/+/g, "$1");
                }
            }}
        />
        <div class="cover-overlay">
            <button class="overlay-btn" onclick={() => fileInput?.click()} title="Subir imagen">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </button>
            <button class="overlay-btn" onclick={openCropper} title="Recortar">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"></path><path d="M18 22V8a2 2 0 0 0-2-2H2"></path></svg>
            </button>
        </div>
    </div>
    <div class="checkbox-wrapper">
        <input 
          type="checkbox" 
          class="chapter-checkbox" 
          bind:checked={isSelected} 
          onchange={dispatchSelection} 
          aria-label={`Seleccionar capítulo ${chapter.chapterNumber}`}
        />
    </div>
    <input 
        type="file" 
        hidden 
        accept="image/*" 
        bind:this={fileInput} 
        onchange={handleThumbnailUpload} 
        aria-label="Subir miniatura de capítulo"
    />
  </div>

  <div class="card-body">
    <div class="meta-row">
        <span class="chapter-badge"># {chapter.chapterNumber}</span>
        <button 
            class="premium-delete-btn" 
            class:is-confirming={deleteState === 'confirm'}
            class:is-deleting={deleteState === 'deleting'}
            onclick={handleDelete} 
            title={deleteState === 'confirm' ? '¿Confirmar eliminación?' : 'Eliminar capítulo'}
            aria-label="Eliminar capítulo"
        >
            <div class="btn-icon-stack">
              {#if deleteState === 'idle'}
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              {:else if deleteState === 'confirm'}
                <span class="confirm-label">ELIMINAR?</span>
              {:else}
                <div class="mini-loader"></div>
              {/if}
            </div>
        </button>
    </div>

    <div class="title-row">
        {#if isEditing}
            <div class="edit-box">
                <input 
                    type="text" 
                    bind:value={title} 
                    class="title-input" 
                    onkeydown={(e) => e.key === 'Enter' && saveTitle()} 
                    onblur={() => { if(title === chapter.title) isEditing = false; }}
                />
                <button class="save-mini-btn" onmousedown={saveTitle}>OK</button>
            </div>
        {:else}
            <div 
                class="title-display" 
                onclick={() => isEditing = true} 
                title={chapter.title || 'Sin título'}
                role="button"
                tabindex="0"
                onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (isEditing = true)}
            >
                {chapter.title || 'Sin título'}
            </div>
        {/if}
    </div>
    
    {#if message.text}
        <div class="status-toast" class:error={message.type === 'error'}>
            {message.text}
        </div>
    {/if}
  </div>
</div>

<style>
  .chapter-card {
    background: #252525;
    border-radius: 8px;
    overflow: hidden;
    position: relative;
    border: 1px solid rgba(255,255,255,0.05);
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    height: 180px; 
  }

  .chapter-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border-color: rgba(255,255,255,0.1);
  }

  .chapter-card.selected {
    border-color: #4facfe;
    background: rgba(79, 172, 254, 0.05);
  }

  .chapter-card.loading {
    opacity: 0.6;
    pointer-events: none;
  }

  .card-cover {
    height: 100px;
    position: relative;
    background: #000;
    overflow: hidden;
  }

  .img-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
  }

  .chapter-card:hover .cover-img {
    transform: scale(1.05);
  }

  .cover-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .card-cover:hover .cover-overlay {
    opacity: 1;
  }

  .overlay-btn {
    background: rgba(255,255,255,0.2);
    border: none;
    color: #fff;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
    transition: background 0.2s;
  }

  .overlay-btn:hover {
    background: #4facfe;
  }

  .checkbox-wrapper {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 10;
  }

  .chapter-checkbox {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: #4facfe;
  }

  .card-body {
    padding: 0.8rem;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
  }

  .chapter-badge {
    font-size: 0.75rem;
    font-weight: 800;
    color: #aaa;
    background: rgba(255,255,255,0.05);
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .premium-delete-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #666;
    height: 28px;
    padding: 0 10px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0;
  }

  .chapter-card:hover .premium-delete-btn {
    opacity: 1;
  }

  .premium-delete-btn:hover {
    color: #ff4757;
    background: rgba(255, 71, 87, 0.1);
    border-color: rgba(255, 71, 87, 0.2);
  }

  .premium-delete-btn.is-confirming {
    opacity: 1;
    background: #ff4757;
    color: #fff;
    border-color: #ff4757;
    box-shadow: 0 0 15px rgba(255, 71, 87, 0.4);
    animation: quick-shake 0.3s ease-in-out;
  }

  .confirm-label {
    font-size: 0.65rem;
    font-weight: 900;
    letter-spacing: 0.05em;
  }

  .mini-loader {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes quick-shake {
    0% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    50% { transform: translateX(4px); }
    75% { transform: translateX(-4px); }
    100% { transform: translateX(0); }
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .title-row {
    flex-grow: 1;
    display: flex;
    align-items: center;
  }

  .title-display {
    font-size: 0.9rem;
    font-weight: 500;
    color: #e0e0e0;
    line-height: 1.3;
    cursor: text;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    width: 100%;
  }

  .title-display:hover {
    color: #fff;
    text-decoration: underline;
    text-decoration-color: #444;
  }

  .edit-box {
    display: flex;
    gap: 4px;
    width: 100%;
  }

  .title-input {
    width: 100%;
    background: #111;
    border: 1px solid #4facfe;
    color: #fff;
    font-size: 0.85rem;
    padding: 4px 6px;
    border-radius: 4px;
    outline: none;
  }

  .save-mini-btn {
    background: #4facfe;
    color: #000;
    border: none;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: bold;
    padding: 0 6px;
    cursor: pointer;
  }

  .status-toast {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: #2ecc71;
    color: #000;
    font-size: 0.7rem;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 4px;
    animation: popIn 0.2s;
  }

  .status-toast.error { background: #ff4757; color: #fff; }

  @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>