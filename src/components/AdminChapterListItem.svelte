<script lang="ts">
  import { onMount } from 'svelte';

  export let chapter: any;
  export let seriesSlug: string;
  export let r2PublicUrlAssets: string;

  let title = chapter.title || '';
  let isLoading = false;
  let isEditing = false;
  let isSelected = false;
  let message = { type: '', text: '' };
  
  // Ref al input de archivo para simular clic
  let fileInput: HTMLInputElement;

  onMount(() => {
    // Escuchar evento global para seleccionar todos
    const handleGlobalToggle = (e: any) => {
        // console.log('Evento recibido en hijo:', e.detail); // Descomentar para depurar
        isSelected = e.detail.isChecked;
        // Forzar actualización de UI si Svelte 5 runes lo requiere de forma específica,
        // aunque isSelected es reactivo ($state o let normal en svelte 4/5 legacy mode).
        dispatchSelection();
    };
    window.addEventListener('toggleAllChapters', handleGlobalToggle);
    return () => window.removeEventListener('toggleAllChapters', handleGlobalToggle);
  });

  function showMessage(type: string, text: string) {
    message = { type, text };
    setTimeout(() => {
      message = { type: '', text: '' };
    }, 3000);
  }

  function dispatchSelection() {
    const event = new CustomEvent('chapterSelectionChanged', {
        detail: { id: chapter.id, isSelected }
    });
    window.dispatchEvent(event);
  }

  function toggleSelection() {
    isSelected = !isSelected;
    dispatchSelection();
  }

  async function saveTitle() {
    if (title === chapter.title) {
        isEditing = false;
        return;
    }
    isLoading = true;
    
    const formData = new FormData();
    formData.append('chapterId', chapter.id);
    formData.append('title', title);

    try {
      const response = await fetch('/api/update-chapter', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Error al actualizar.');
      
      chapter.title = title; // Update local prop
      isEditing = false;
      showMessage('success', 'Guardado');
    } catch (err: any) {
      showMessage('error', 'Error');
    } finally {
      isLoading = false;
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar capítulo?')) return;
    
    isLoading = true;
    const formData = new FormData();
    formData.append('chapterId', chapter.id);

    try {
      const response = await fetch('/api/delete-chapters', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Error al eliminar.');

      window.dispatchEvent(new CustomEvent('chapterDeleted', { detail: { id: chapter.id } }));
    } catch (err: any) {
      showMessage('error', 'Error');
      isLoading = false;
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
        const response = await fetch('/api/upload-chapter-thumbnail', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error('Falló subida.');

        chapter.url_portada = `${result.thumbnailUrl}?t=${Date.now()}`;
        showMessage('success', 'Img OK');
    } catch (err: any) {
        showMessage('error', 'Error Img');
    } finally {
        isLoading = false;
        input.value = '';
    }
  }

  function openCropper() {
    window.dispatchEvent(new CustomEvent('openCropperModal', {
      detail: { chapterId: chapter.id, seriesSlug: seriesSlug, chapterNumber: chapter.chapter_number }
    }));
  }
</script>

<div class="chapter-row" class:loading={isLoading} data-chapter-id={chapter.id}>
  <!-- Col 1: Select -->
  <div class="col-select">
    <input type="checkbox" class="chapter-checkbox" bind:checked={isSelected} onchange={dispatchSelection} />
  </div>

  <!-- Col 2: Image -->
  <div class="col-img">
    <div class="img-wrapper">
        <img
            src={chapter.url_portada || `${r2PublicUrlAssets}/covers/placeholder-chapter.jpg`}
            alt="Miniatura"
            class="thumbnail"
            onerror={`this.onerror=null; this.src='${r2PublicUrlAssets}/covers/placeholder-chapter.jpg';`}
        />
        <div class="img-overlay">
            <button class="icon-btn xs" onclick={() => fileInput.click()} title="Subir imagen">☁️</button>
            <button class="icon-btn xs" onclick={openCropper} title="Recortar">✂️</button>
        </div>
    </div>
    <input 
        type="file" 
        hidden 
        accept="image/*" 
        bind:this={fileInput} 
        onchange={handleThumbnailUpload} 
    />
  </div>

  <!-- Col 3: Num -->
  <div class="col-num">
    <span class="num-badge">{chapter.chapter_number}</span>
  </div>

  <!-- Col 4: Title (Editable) -->
  <div class="col-title">
    {#if isEditing}
        <div class="edit-group">
            <input type="text" bind:value={title} class="inline-input" onkeydown={(e) => e.key === 'Enter' && saveTitle()} autoFocus />
            <button class="icon-btn success" onclick={saveTitle}>✅</button>
            <button class="icon-btn cancel" onclick={() => { isEditing = false; title = chapter.title || ''; }}>❌</button>
        </div>
    {:else}
        <div class="text-display" onclick={() => isEditing = true} title="Click para editar">
            {chapter.title || 'Sin título'}
            <span class="edit-hint">✎</span>
        </div>
    {/if}
    {#if message.text}
        <span class="status-msg" class:error={message.type === 'error'}>{message.text}</span>
    {/if}
  </div>

  <!-- Col 5: Actions -->
  <div class="col-actions">
    <button class="icon-btn danger" onclick={handleDelete} title="Eliminar">🗑️</button>
  </div>
</div>

<style>
  .chapter-row {
    display: grid;
    /* Grid Columns Match Parent: Checkbox | Img | Num | Title (flexible) | Actions */
    grid-template-columns: 40px 60px 60px 1fr 140px;
    align-items: center;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #2a2a2a;
    transition: background-color 0.2s;
  }

  .chapter-row:hover {
    background-color: #252525;
  }

  .chapter-row.loading {
    opacity: 0.5;
    pointer-events: none;
  }

  /* Columns */
  .col-select { display: flex; justify-content: center; }
  .col-img { display: flex; justify-content: center; align-items: center; position: relative; }
  .col-num { display: flex; justify-content: center; align-items: center; font-weight: bold; color: #888; }
  .col-title { display: flex; justify-content: flex-start; align-items: center; padding: 0; position: relative; }
  .col-actions { 
    display: flex; 
    justify-content: center; 
    align-items: center; 
    gap: 0.5rem; 
  }

  @media (max-width: 600px) {
    .chapter-row {
      grid-template-columns: 40px 60px 50px 1fr 60px; /* Ajuste de anchos para móvil */
      padding: 0.5rem;
    }
    .col-title {
      font-size: 0.85rem;
    }
    .col-num {
      font-size: 0.85rem;
    }
  }
  .img-wrapper {
    position: relative;
    width: 60px; /* Ancho fijo */
    height: 40px; /* Altura menor para forzar horizontalidad */
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #000;
    border-radius: 4px;
    overflow: hidden;
  }
  .thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover; /* Recortar para llenar el contenedor horizontal */
    border: none;
  }
  .img-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    display: flex;
    flex-direction: row; /* Cambio de column a row */
    justify-content: center;
    align-items: center;
    gap: 0.5rem; /* Espacio entre iconos */
    opacity: 0;
    transition: opacity 0.2s;
    border-radius: 4px;
  }
  .img-wrapper:hover .img-overlay { opacity: 1; }

  /* Editable Title */
  .text-display {
    cursor: pointer;
    padding: 0.25rem 0.5rem 0.25rem 0; /* Padding izquierdo a 0 */
    border-radius: 4px;
    color: #ddd;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .text-display:hover { background-color: #333; }
  .edit-hint { opacity: 0; font-size: 0.8rem; color: #666; }
  .text-display:hover .edit-hint { opacity: 1; }

  .edit-group { display: flex; gap: 0.25rem; align-items: center; }
  .inline-input {
    flex-grow: 1;
    background: #111;
    border: 1px solid #555;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  /* Buttons */
  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1rem;
    padding: 0.25rem;
    border-radius: 4px;
    transition: background-color 0.2s;
  }
  .icon-btn:hover { background-color: #444; }
  .icon-btn.xs { font-size: 0.8rem; padding: 2px; }
  .icon-btn.success:hover { background-color: rgba(40, 167, 69, 0.2); }
  .icon-btn.cancel:hover { background-color: rgba(255, 193, 7, 0.2); }
  .icon-btn.danger:hover { background-color: rgba(220, 53, 69, 0.2); }

  .status-msg {
    font-size: 0.75rem;
    color: #4ade80;
    margin-left: 0.5rem;
  }
  .status-msg.error { color: #f87171; }
</style>
