<script lang="ts">
import { actions } from 'astro:actions';
import { onMount } from 'svelte';

interface Chapter {
  id: number;
  title: string | null;
  chapterNumber: string | number; // Orion: Migrado a camelCase
  urlPortada: string | null;
  messageThreadId: number | null;
}

interface Props {
  chapter: Chapter;
  seriesSlug: string;
  r2PublicUrlAssets: string;
}

let { chapter, seriesSlug, r2PublicUrlAssets }: Props = $props();

let title = $state(chapter.title || '');
let isLoading = $state(false);
let isEditing = $state(false);
let isSelected = $state(false);
let deleteState = $state<'idle' | 'confirm' | 'deleting'>('idle');
let message = $state({ type: '', text: '' });

let deleteTimeout: ReturnType<typeof setTimeout> | undefined;

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
    <div class="card-selection">
        <input 
            type="checkbox" 
            bind:checked={isSelected} 
            onchange={dispatchSelection}
            class="chapter-checkbox"
        />
    </div>

    <div class="card-thumbnail">
        <img src={finalUrl} alt={chapter.title || `Cap ${chapter.chapterNumber}`} />
        <div class="thumb-overlay">
            <button class="icon-btn" onclick={openCropper} title="Recortar miniatura">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/></svg>
            </button>
            <label class="icon-btn" title="Subir miniatura">
                <input type="file" accept="image/*" onchange={handleThumbnailUpload} hidden />
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </label>
        </div>
    </div>

    <div class="card-main">
        <div class="chapter-number">Capítulo {chapter.chapterNumber}</div>
        <div class="title-row">
            {#if isEditing}
                <div class="edit-box">
                    <input 
                        type="text" 
                        bind:value={title} 
                        onkeydown={(e) => e.key === 'Enter' && saveTitle()}
                        onblur={saveTitle}
                        autofocus
                    />
                </div>
            {:else}
                <span
                    class="title-display"
                    onclick={() => isEditing = true}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => e.key === 'Enter' && (isEditing = true)}
                    title={chapter.title && chapter.title !== 'null' ? chapter.title : `Capítulo ${chapter.chapterNumber}`}
                >
                    {chapter.title && chapter.title !== 'null' ? chapter.title : `Capítulo ${chapter.chapterNumber}`}
                </span>

            {/if}
        </div>
    </div>

    <div class="card-actions">
        <a href={`/series/${seriesSlug}/${chapter.chapterNumber}`} class="action-btn" title="Ver capítulo">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </a>
        <button 
            class="action-btn delete" 
            class:is-confirming={deleteState === 'confirm'}
            class:is-deleting={deleteState === 'deleting'}
            onclick={handleDelete}
            title={deleteState === 'confirm' ? '¿Confirmar?' : 'Eliminar'}
        >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
    </div>

    {#if message.text}
        <div class="status-toast" class:error={message.type === 'error'}>
            {message.text}
        </div>
    {/if}
</div>

<style>
  .chapter-card {
    display: flex;
    align-items: center;
    background: #111;
    border: 1px solid #222;
    border-radius: 14px;
    padding: 0.75rem;
    gap: 1rem;
    position: relative;
    transition: all 0.2s;
  }

  .chapter-card:hover { border-color: #444; background: #161616; }
  .chapter-card.selected { border-color: var(--accent-color); background: rgba(0, 191, 255, 0.05); }
  .chapter-card.loading { opacity: 0.6; pointer-events: none; }

  .card-selection input { width: 18px; height: 18px; cursor: pointer; }

  .card-thumbnail {
    width: 60px;
    height: 80px;
    background: #000;
    border-radius: 8px;
    overflow: hidden;
    position: relative;
    flex-shrink: 0;
  }

  .card-thumbnail img { width: 100%; height: 100%; object-fit: cover; }

  .thumb-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .card-thumbnail:hover .thumb-overlay { opacity: 1; }

  .icon-btn {
    background: rgba(255,255,255,0.1);
    border: none;
    color: #fff;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-btn:hover { background: var(--accent-color); color: #000; }

  .card-main { flex: 1; min-width: 0; }
  .chapter-number { font-size: 0.75rem; font-weight: 800; color: var(--accent-color); text-transform: uppercase; margin-bottom: 0.25rem; }
  
  .title-row { font-size: 0.95rem; font-weight: 600; color: #eee; }
  .title-display { cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
  .title-display:hover { color: #fff; text-decoration: underline; }

  .edit-box input {
    background: #000;
    border: 1px solid var(--accent-color);
    color: #fff;
    padding: 2px 6px;
    border-radius: 4px;
    width: 100%;
    font-size: 0.9rem;
    outline: none;
  }

  .card-actions { display: flex; gap: 0.5rem; }
  .action-btn {
    background: #222;
    border: none;
    color: #888;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
  }

  .action-btn:hover { background: #333; color: #fff; }
  .action-btn.delete:hover { background: #ff4757; color: #fff; }
  .action-btn.delete.is-confirming { background: #ffa502; color: #000; animation: pulse 1s infinite; }
  .action-btn.delete.is-deleting { background: #2f3542; cursor: wait; }

  @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }

  .status-toast {
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    background: #2ed573;
    color: #000;
    font-size: 0.7rem;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    animation: popIn 0.2s;
    z-index: 10;
  }

  .status-toast.error { background: #ff4757; color: #fff; }

  @keyframes popIn { from { transform: scale(0.8) translateX(-50%); opacity: 0; } to { transform: scale(1) translateX(-50%); opacity: 1; } }
</style>
