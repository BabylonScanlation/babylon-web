<script lang="ts">
  // No longer need createEventDispatcher as we are using global window events
  export let chapter: any;
  export let seriesSlug: string;
  export let r2PublicUrlAssets: string;

  let title = chapter.title || '';
  let isLoading = false;
  let message = { type: '', text: '' };

  function showMessage(type: string, text: string) {
    message = { type, text };
    setTimeout(() => {
      message = { type: '', text: '' };
    }, 4000);
  }

  async function handleUpdateTitle(event: Event) {
    event.preventDefault();
    isLoading = true;
    
    const formData = new FormData();
    formData.append('chapterId', chapter.id);
    formData.append('title', title);

    try {
      const response = await fetch('/api/update-chapter', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error al actualizar.');
      
      showMessage('success', 'Título actualizado.');
    } catch (err: any) {
      showMessage('error', err.message);
    } finally {
      isLoading = false;
    }
  }

  async function handleDeleteChapter(event: Event) {
    event.preventDefault();
    if (!confirm('¿Seguro que quieres eliminar este capítulo? Esta acción no se puede deshacer.')) {
      return;
    }
    
    isLoading = true;
    const formData = new FormData();
    formData.append('chapterId', chapter.id);

    try {
      const response = await fetch('/api/delete-chapters', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error al eliminar.');

      // Dispatch a GLOBAL event so the parent Astro component can listen
      window.dispatchEvent(new CustomEvent('chapterDeleted', { detail: { id: chapter.id } }));
      // We don't show a message here as the element will disappear
    } catch (err: any) {
      showMessage('error', err.message);
    } finally {
      isLoading = false;
    }
  }

  async function handleManualThumbnailUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    isLoading = true;
    const formData = new FormData();
    formData.append('chapterId', chapter.id.toString());
    formData.append('thumbnailImage', file);

    try {
        const response = await fetch('/api/upload-chapter-thumbnail', {
            method: 'POST',
            body: formData,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Error al subir la miniatura.');

        // Optimistically update the image source
        chapter.url_portada = `${result.thumbnailUrl}?t=${Date.now()}`;
        showMessage('success', 'Miniatura actualizada.');
    } catch (err: any) {
        showMessage('error', err.message);
    } finally {
        isLoading = false;
        input.value = ''; // Reset file input
    }
  }

  function openCropperModal() {
    // Dispatch a GLOBAL event that the listener in AdminChapterList.astro can catch
    window.dispatchEvent(new CustomEvent('openCropperModal', {
      detail: {
        chapterId: chapter.id,
        seriesSlug: seriesSlug,
        chapterNumber: chapter.chapter_number,
      }
    }));
  }
</script>

<li class="chapter-item" class:loading={isLoading} data-chapter-id={chapter.id}>
  <img
    src={chapter.url_portada || `${r2PublicUrlAssets}/covers/placeholder-chapter.jpg`}
    alt={`Miniatura del Capítulo ${chapter.chapter_number}`}
    class="chapter-thumbnail-img"
    onerror={`this.onerror=null; this.src='${r2PublicUrlAssets}/covers/placeholder-chapter.jpg';`}
  />
  <div class="chapter-details-and-controls">
    <form class="update-chapter-form" onsubmit={handleUpdateTitle}>
      <span class="chapter-number-label">Cap. {chapter.chapter_number}</span>
      <input
        type="text"
        name="title"
        placeholder="Sin título"
        class="chapter-title-input"
        bind:value={title}
        disabled={isLoading}
      />
      <button type="submit" class="btn btn-success" title="Guardar Título" disabled={isLoading}>✓</button>
    </form>

    <div class="chapter-thumbnail-controls">
      <button type="button" class="btn btn-warning" onclick={openCropperModal} disabled={isLoading}>
        Recortar Portada
      </button>
      <input
        type="file"
        class="upload-thumbnail-input"
        accept="image/jpeg,image/png,image/webp"
        title="Subir Miniatura Manualmente"
        onchange={handleManualThumbnailUpload}
        disabled={isLoading}
      />
    </div>
    {#if message.text}
      <div class="action-message" class:success={message.type === 'success'} class:error={message.type === 'error'}>
        {message.text}
      </div>
    {/if}
  </div>

  <form class="delete-chapter-form" onsubmit={handleDeleteChapter}>
    <button type="submit" class="btn btn-danger" title="Eliminar Capítulo" disabled={isLoading}>✗</button>
  </form>
</li>

<style>
  .chapter-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid #444;
    border-radius: 6px;
    background-color: #333;
    transition: opacity 0.3s ease;
  }
  .chapter-item.loading {
    opacity: 0.6;
    pointer-events: none;
  }
  .chapter-thumbnail-img {
    width: 50px;
    height: 75px;
    object-fit: cover;
    border-radius: 4px;
    flex-shrink: 0;
    border: 1px solid #555;
  }
  .chapter-details-and-controls {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    gap: 0.5rem;
  }
  .update-chapter-form {
    flex-grow: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .delete-chapter-form {
    margin-left: auto;
  }
  .chapter-number-label {
    white-space: nowrap;
    font-weight: bold;
    color: #ccc;
  }
  .chapter-title-input {
    width: 100%;
    background-color: #444;
    border: 1px solid #666;
    color: var(--font-color);
    border-radius: 4px;
    padding: 0.5rem;
  }
  .chapter-thumbnail-controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .upload-thumbnail-input {
    width: auto;
    flex-grow: 1;
    font-size: 0.9rem;
  }
  .action-message {
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    border-radius: 4px;
    margin-top: 0.25rem;
  }
  .action-message.success {
    background-color: #28a745;
    color: white;
  }
  .action-message.error {
    background-color: #dc3545;
    color: white;
  }
</style>
