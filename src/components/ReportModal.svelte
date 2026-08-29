<script lang="ts">
import { actions } from 'astro:actions';
import { fade, fly } from 'svelte/transition';
import { toast } from '../lib/stores.svelte';
import Combobox from './Combobox.svelte';

type ReportType = 'chapter_fallen' | 'bug' | 'claim' | 'suggestion';

let {
  type,
  isOpen = false,
  onClose,
}: { type: ReportType; isOpen: boolean; onClose: () => void } = $props();

let isLoading = $state(false);

// Form fields
let details = $state('');
let seriesTitle = $state('');
let chapterNumber = $state('');
let scanName = $state('');
let contactInfo = $state('');
let fileInput: HTMLInputElement | undefined = $state();

let seriesList = $state<{ id: number; title: string }[]>([]);
let chaptersList = $state<{ id: number; number: string }[]>([]);
let seriesOptions = $derived(seriesList.map((s) => s.title));
let chaptersOptions = $derived(chaptersList.map((c) => c.number));
let isFetchingSeries = $state(false);
let isFetchingChapters = $state(false);

const typeLabels: Record<ReportType, string> = {
  chapter_fallen: 'Reportar Capítulo Caído',
  bug: 'Reportar Bug o Error',
  claim: 'Reclamar Capítulos',
  suggestion: 'Enviar Sugerencia',
};

const typeIcons: Record<ReportType, string> = {
  chapter_fallen:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  bug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24"><path d="M12 8V12"></path><path d="M12 16H12.01"></path><circle cx="12" cy="12" r="10"></circle></svg>',
  claim:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>',
  suggestion:
    '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
};

// Autocompletar datos del lector si estamos en un capítulo
$effect(() => {
  if (isOpen) {
    const bridge = document.getElementById('reader-data-bridge');
    if (bridge) {
      if (!seriesTitle) seriesTitle = bridge.getAttribute('data-series-title') || '';
      if (!chapterNumber) chapterNumber = bridge.getAttribute('data-chapter') || '';
    }
  } else {
    // Resetear form cuando se cierra
    details = '';
    seriesTitle = '';
    chapterNumber = '';
    scanName = '';
    contactInfo = '';
    if (fileInput) fileInput.value = '';

    // Evitar que queden cacheados de requests anteriores
    seriesList = [];
    chaptersList = [];
    isFetchingSeries = false;
    isFetchingChapters = false;
  }
});

// Fetch all series when modal opens for chapter fallen
$effect(() => {
  if (isOpen && type === 'chapter_fallen' && seriesList.length === 0 && !isFetchingSeries) {
    isFetchingSeries = true;
    actions.reports.getSeriesList().then(({ data }) => {
      if (data?.success && data.series) {
        seriesList = data.series;
      }
      isFetchingSeries = false;
    });
  }
});

// Fetch chapters when a valid series is selected
$effect(() => {
  if (seriesTitle && seriesList.length > 0) {
    const found = seriesList.find((s) => s.title === seriesTitle);
    if (found) {
      isFetchingChapters = true;
      actions.reports.getChaptersList({ seriesId: found.id }).then(({ data }) => {
        if (data?.success && data.chapters) {
          chaptersList = data.chapters;
        }
        isFetchingChapters = false;
      });
    } else {
      chaptersList = [];
    }
  } else {
    chaptersList = [];
  }
});

async function handleSubmit(e: Event) {
  e.preventDefault();
  isLoading = true;

  try {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('url', window.location.href);

    if (details.trim()) formData.append('details', details.trim());

    if (type === 'chapter_fallen') {
      if (seriesTitle) formData.append('seriesTitle', seriesTitle);
      if (chapterNumber) formData.append('chapterNumber', chapterNumber);
    }

    if (type === 'claim') {
      if (scanName) formData.append('scanName', scanName);
      if (contactInfo) formData.append('contactInfo', contactInfo);
    }

    if (type === 'bug' && fileInput?.files?.[0]) {
      formData.append('file', fileInput.files[0]);
    }

    const { data, error } = await actions.reports.sendReport(formData);

    if (error) throw error;
    if (data?.success) {
      toast.success('¡Mensaje enviado con éxito! Gracias por ayudarnos a mejorar.');
      onClose();
      // Reset form
      details = '';
      scanName = '';
      contactInfo = '';
      if (fileInput) fileInput.value = '';
    } else {
      toast.error(data?.error || 'Error al enviar el reporte.');
    }
  } catch (err) {
    console.error(err);
    toast.error('Hubo un problema de conexión al enviar el reporte.');
  } finally {
    isLoading = false;
  }
}
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay modal-body" transition:fade={{ duration: 200 }} onclick={onClose}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-content" transition:fly={{ y: 20, duration: 300 }} onclick={(e) => e.stopPropagation()}>
      <button class="close-btn" onclick={onClose} aria-label="Cerrar modal">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>

      <div class="modal-header">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <div class="modal-icon {type}">{@html typeIcons[type]}</div>
        <h2>{typeLabels[type]}</h2>
      </div>

      <form onsubmit={handleSubmit} class="report-form">
        
        {#if type === 'suggestion'}
          <div class="form-group">
            <label for="details">¿Qué te gustaría sugerirnos?</label>
            <textarea id="details" bind:value={details} placeholder="Me encantaría que añadieran una función para..." required rows="4"></textarea>
          </div>
        {/if}

        {#if type === 'bug'}
          <div class="form-group">
            <label for="details">Describe el problema detalladamente</label>
            <textarea id="details" bind:value={details} placeholder="Ej: Cuando hago clic en el botón X de la página Y, la pantalla se congela." required rows="4"></textarea>
          </div>
          <div class="form-group">
            <label for="file">Adjuntar Captura o Video (Opcional, Máx 10MB)</label>
            <input type="file" id="file" bind:this={fileInput} accept="image/*,video/mp4,video/webm" class="file-input" />
            <small class="help-text">Una imagen o video corto nos ayuda muchísimo a replicar el error.</small>
          </div>
        {/if}

        {#if type === 'chapter_fallen'}
          <p class="help-text-main">Péganos el enlace, o dinos qué serie y capítulo están fallando.</p>
          <div class="form-row">
            <div class="form-group" style="position: relative; z-index: 105;">
              <label for="series">Serie</label>
              {#if isFetchingSeries}
                <input type="text" disabled placeholder="Cargando series..." />
              {:else}
                <Combobox id="series" bind:value={seriesTitle} options={seriesOptions} placeholder="Nombre del manga..." />
              {/if}
            </div>
            <div class="form-group" style="position: relative; z-index: 104;">
              <label for="chapter">Capítulo</label>
              {#if isFetchingChapters}
                <input type="text" disabled placeholder="..." />
              {:else}
                <Combobox id="chapter" bind:value={chapterNumber} options={chaptersOptions} placeholder="Ej: 45" />
              {/if}
            </div>
          </div>
          <div class="form-group">
            <label for="details">¿Qué sucede exactamente? (Opcional)</label>
            <textarea id="details" bind:value={details} placeholder="Faltan páginas, las imágenes están rotas, etc." rows="2"></textarea>
          </div>
        {/if}

        {#if type === 'claim'}
          <p class="help-text-main">¿Este manga pertenece a tu Scanlation y deseas reclamarlo o hablar con nosotros?</p>
          <div class="form-row">
            <div class="form-group">
              <label for="scan">Nombre de tu Scanlation</label>
              <input type="text" id="scan" bind:value={scanName} placeholder="Mi Scanlation" required />
            </div>
          </div>
          <div class="form-group">
            <label for="contact">Método de Contacto (Discord/Telegram/Twitter)</label>
            <input type="text" id="contact" bind:value={contactInfo} placeholder="Ej: @MiUsuario en Discord" required />
          </div>
          <div class="form-group">
            <label for="details">Mensaje adicional (Opcional)</label>
            <textarea id="details" bind:value={details} placeholder="Queremos reclamar los permisos de subida para esta serie..." rows="3"></textarea>
          </div>
        {/if}

        <div class="form-actions">
          <button type="button" class="btn-cancel" onclick={onClose} disabled={isLoading}>Cancelar</button>
          <button type="submit" class="btn-submit" disabled={isLoading}>
            {#if isLoading}
              Enviando...
            {:else}
              Enviar
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 100000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .modal-content {
    background: rgba(20, 20, 25, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 2rem;
    width: 100%;
    max-width: 500px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .close-btn {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: #a1a1aa;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    transform: scale(1.1);
  }

  .close-btn svg {
    width: 16px;
    height: 16px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .modal-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
  }

  .modal-icon.suggestion { color: #d8b4fe; background: rgba(168, 85, 247, 0.15); }
  .modal-icon.claim { color: #93c5fd; background: rgba(59, 130, 246, 0.15); }
  .modal-icon.chapter_fallen { color: #fdba74; background: rgba(249, 115, 22, 0.15); }
  .modal-icon.bug { color: #fca5a5; background: rgba(239, 68, 68, 0.15); }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: #fff;
  }

  .help-text-main {
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
    color: #a1a1aa;
    line-height: 1.5;
  }

  .report-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #e2e8f0;
  }

  .form-group input[type="text"],
  .form-group textarea {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    color: #fff;
    font-size: 0.95rem;
    transition: border-color 0.2s, box-shadow 0.2s;
    font-family: inherit;
    resize: vertical;
  }

  .form-group input[type="text"]:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(0, 191, 255, 0.2);
  }

  .file-input {
    background: rgba(0, 0, 0, 0.2);
    border: 1px dashed rgba(255, 255, 255, 0.2);
    padding: 1rem;
    border-radius: 10px;
    color: #cbd5e1;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .file-input::file-selector-button {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    color: #fff;
    font-weight: 600;
    margin-right: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .file-input::file-selector-button:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .help-text {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #e2e8f0;
    padding: 0.6rem 1.25rem;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .btn-submit {
    background: var(--accent-color, #00bfff);
    border: none;
    color: #000;
    padding: 0.6rem 1.5rem;
    border-radius: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-submit:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0, 191, 255, 0.4);
    background: #fff;
  }

  .btn-submit:disabled, .btn-cancel:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  @media (max-width: 600px) {
    .modal-content {
      padding: 1.5rem;
    }
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
