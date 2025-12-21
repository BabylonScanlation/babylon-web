<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  // Cropper.js imports would be here
  import { logError } from '../lib/logError';

  // --- Internal State (Svelte 5) ---
  let isOpen = $state(false);
  let chapterId = $state<string | null>(null);
  let seriesSlug = $state<string | null>(null);
  let chapterNumber = $state<string | null>(null);

  // --- Helper Functions ---
  const closeModal = () => {
    isOpen = false;
  };

  const handleOpenModal = (event: any) => {
    const { detail } = event;
    if (detail && detail.chapterId && detail.seriesSlug && detail.chapterNumber) {
      chapterId = detail.chapterId;
      seriesSlug = detail.seriesSlug;
      chapterNumber = detail.chapterNumber;
      isOpen = true;
    } else {
      logError('Modal opened with incomplete data', 'AdminThumbnailCropperModal', detail);
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen) {
      closeModal();
    }
  };

  // --- Svelte 5 Side Effects ---
  // $effect is guaranteed to run ONLY in the browser
  $effect(() => {
    window.addEventListener('openCropperModal' as any, handleOpenModal);
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('openCropperModal' as any, handleOpenModal);
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<!-- HTML structure with Svelte bindings -->
<div id="cropper-modal" class="modal-overlay" class:is-hidden={!isOpen} onclick={(e) => e.target === e.currentTarget && closeModal()}>
    <div class="modal-panel">
      <div class="modal-header">
        <h3>
          Recortar Miniatura del Capítulo <span>{chapterNumber}</span>
        </h3>
        <button onclick={closeModal} class="close-modal-btn"
          >&times;</button
        >
      </div>
      <div class="modal-body">
        <p>Este es un modal de recorte simplificado para pruebas.</p>
        <div class="debug-info">
          <p>Estado: {isOpen ? 'Abierto' : 'Cerrado'}</p>
          <p>Capítulo ID: {chapterId}</p>
          <p>Serie Slug: {seriesSlug}</p>
        </div>
      </div>
      <div class="modal-footer">
        <button onclick={closeModal} class="btn btn-secondary"
          >Cancelar</button
        >
        <button class="btn btn-primary" disabled
          >Confirmar Recorte (Deshabilitado)</button
        >
      </div>
    </div>
</div>

<style>
  /* Basic styles to make it visible */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
  }
  .modal-overlay.is-hidden {
    display: none;
  }
  .modal-panel {
    background: #333;
    color: white;
    padding: 2rem;
    border-radius: 8px;
    min-width: 300px;
    max-width: 500px;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #555;
    padding-bottom: 1rem;
    margin-bottom: 1rem;
  }
  .close-modal-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: white;
    cursor: pointer;
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 1rem;
    border-top: 1px solid #555;
    padding-top: 1rem;
  }
  .btn {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  .btn-primary {
    background-color: var(--accent-color);
    color: white;
  }
  .btn-secondary {
    background-color: #555;
    color: white;
  }
  .error-message {
    color: #ff6b6b;
  }
</style>
