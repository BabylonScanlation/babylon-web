<script lang="ts">
import { actions } from 'astro:actions';
import { onMount } from 'svelte';
import type { Chapter } from '../types';

interface Props {
  chapter: Chapter;
  seriesSlug: string;
  r2PublicUrlAssets: string;
}

let { chapter, seriesSlug, r2PublicUrlAssets }: Props = $props();

let _isLoading = $state(false);
let _isEditing = $state(false);
let isSelected = $state(false);
let deleteState = $state<'idle' | 'confirm' | 'deleting'>('idle');
let _message = $state({ type: '', text: '' });

let deleteTimeout: ReturnType<typeof setTimeout> | undefined;

// biome-ignore lint/correctness/noUnusedVariables: Usado en el template como acción use:autoFocus
function autoFocus(node: HTMLInputElement) {
  node.focus();
}

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
  _message = { type, text };
  setTimeout(() => {
    _message = { type: '', text: '' };
  }, 3000);
}

function dispatchSelection() {
  const event = new CustomEvent('chapterSelectionChanged', {
    detail: { id: chapter.id, isSelected },
  });
  window.dispatchEvent(event);
}

async function _saveTitle() {
  if (title === chapter.title) {
    _isEditing = false;
    return;
  }
  _isLoading = true;

  try {
    const { error } = await actions.chapters.update({
      chapterId: chapter.id,
      title,
    });

    if (error) throw new Error(error.message);

    chapter.title = title;
    _isEditing = false;
    showMessage('success', 'Guardado');
  } catch {
    showMessage('error', 'Error');
  } finally {
    _isLoading = false;
  }
}

async function _handleDelete() {
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
    _isLoading = true;
    clearTimeout(deleteTimeout);

    try {
      const { error } = await actions.chapters.deleteBulk({ chapterIds: [chapter.id] });
      if (error) throw new Error(error.message);

      window.dispatchEvent(new CustomEvent('chapterDeleted', { detail: { id: chapter.id } }));
    } catch {
      showMessage('error', 'Error');
      _isLoading = false;
      deleteState = 'idle';
    }
  }
}

async function _handleThumbnailUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  _isLoading = true;
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
    _isLoading = false;
    input.value = '';
  }
}

function _openCropper() {
  window.dispatchEvent(
    new CustomEvent('openCropperModal', {
      detail: {
        chapterId: chapter.id,
        seriesSlug: seriesSlug,
        currentImageUrl: chapter.urlPortada || '',
      },
    })
  );
}

// eslint-disable-next-line svelte/prefer-writable-derived
let title = $state(chapter.title || '');

$effect(() => {
  title = chapter.title || '';
});

const _finalUrl = $derived.by(() => {
  if (!chapter.urlPortada)
    return `${r2PublicUrlAssets}/covers/placeholder-chapter.jpg`.replace(/([^:]\/)\/+/g, '$1');

  if (chapter.urlPortada.startsWith('http')) return chapter.urlPortada;

  return `${r2PublicUrlAssets}/${chapter.urlPortada}`.replace(/([^:]\/)\/+/g, '$1');
});
</script>

<div class="chapter-card" class:selected={isSelected} class:loading={_isLoading} data-chapter-id={chapter.id}>
    <div class="card-selection">
        <input type="checkbox" bind:checked={isSelected} onchange={dispatchSelection} />
    </div>

    <div class="card-thumb" onclick={_openCropper} aria-hidden="true">
        <img src={_finalUrl} alt={chapter.title} loading="lazy" />
        <div class="thumb-overlay">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </div>
    </div>

    <div class="card-main">
        {#if _isEditing}
            <div class="title-edit-wrap">
                <input
                    type="text"
                    bind:value={title}
                    onkeydown={(e) => e.key === 'Enter' && _saveTitle()}
                    onblur={_saveTitle}
                    use:autoFocus
                />
            </div>
        {:else}
            <div class="title-display" onclick={() => (_isEditing = true)} aria-hidden="true">
                <span class="chapter-num">Cap. {chapter.chapterNumber}</span>
                <h4 class="chapter-title">{chapter.title || 'Sin título'}</h4>
            </div>
        {/if}

        <div class="card-meta">
            <span class="meta-item views">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                {chapter.views || 0}
            </span>
            <span class="meta-item date">
                {chapter.createdAt ? new Date(chapter.createdAt).toLocaleDateString('es-ES') : 'N/A'}
            </span>
        </div>
    </div>

    <div class="card-actions">
        <label class="action-btn upload" title="Subir miniatura">
            <input type="file" accept="image/*" onchange={_handleThumbnailUpload} class="hidden" />
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
        </label>

        <button
            class="action-btn delete"
            class:confirm={deleteState === 'confirm'}
            onclick={_handleDelete}
            title="Eliminar capítulo"
        >
            {#if deleteState === 'confirm'}
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            {:else}
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            {/if}
        </button>
    </div>

    {#if _message.text}
        <div class="status-toast" class:error={_message.type === 'error'}>
            {_message.text}
        </div>
    {/if}
</div>

<style>
  .chapter-card {
    background: #1e1e1e;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    display: flex;
    align-items: center;
    padding: 0.75rem;
    gap: 1rem;
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
  }

  .chapter-card:hover { border-color: rgba(0, 191, 255, 0.3); background: #252525; }
  .chapter-card.selected { border-color: var(--accent-color); background: rgba(0, 191, 255, 0.05); }
  .chapter-card.loading { opacity: 0.6; pointer-events: none; }

  .card-selection { display: flex; align-items: center; }
  .card-selection input { width: 18px; height: 18px; accent-color: var(--accent-color); cursor: pointer; }

  .card-thumb {
    width: 50px;
    height: 70px;
    border-radius: 6px;
    overflow: hidden;
    background: #000;
    flex-shrink: 0;
    position: relative;
    cursor: pointer;
  }

  .card-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .thumb-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; color: #fff; }
  .card-thumb:hover .thumb-overlay { opacity: 1; }

  .card-main { flex-grow: 1; min-width: 0; }

  .title-display { cursor: text; }
  .chapter-num { display: block; font-size: 0.7rem; font-weight: 800; color: var(--accent-color); text-transform: uppercase; margin-bottom: 2px; }
  .chapter-title { margin: 0; font-size: 0.95rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .title-edit-wrap input {
    width: 100%;
    background: #111;
    border: 1px solid var(--accent-color);
    border-radius: 4px;
    color: #fff;
    padding: 4px 8px;
    font-size: 0.9rem;
    outline: none;
  }

  .card-meta { display: flex; gap: 1rem; margin-top: 4px; }
  .meta-item { font-size: 0.7rem; color: #666; display: flex; align-items: center; gap: 4px; font-weight: 600; }

  .card-actions { display: flex; gap: 0.5rem; }
  .action-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: rgba(255, 255, 255, 0.03);
    color: #888;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
  .action-btn.upload { position: relative; cursor: pointer; }
  .action-btn.upload input { display: none; }
  .action-btn.delete:hover { background: rgba(255, 71, 87, 0.1); color: #ff4757; }
  .action-btn.delete.confirm { background: #ff4757; color: #fff; animation: pulse 1s infinite; }

  @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }

  .status-toast {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    background: var(--accent-color);
    color: #000;
    font-size: 0.65rem;
    font-weight: 800;
    padding: 2px 10px;
    border-radius: 4px 4px 0 0;
    animation: popIn 0.2s;
    z-index: 10;
  }

  .status-toast.error { background: #ff4757; color: #fff; }

  @keyframes popIn { from { transform: scale(0.8) translateX(-50%); opacity: 0; } to { transform: scale(1) translateX(-50%); opacity: 1; } }
</style>
