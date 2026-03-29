<script lang="ts">
import { actions } from 'astro:actions';
import { toast } from '../lib/stores.svelte';

interface Props {
  seriesId: number;
  seriesTitle: string;
}

let { seriesId, seriesTitle: _seriesTitle }: Props = $props();

let fileInput: HTMLInputElement | undefined = $state();
let _isUploading = $state(false);
let selectedFiles = $state<FileList | null>(null);
let _progressText = $state('');

function _handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    selectedFiles = target.files;
  }
}

async function _uploadChapters() {
  if (!selectedFiles || selectedFiles.length === 0) {
    toast.error('Selecciona al menos un archivo');
    return;
  }

  _isUploading = true;
  let successCount = 0;
  let errorCount = 0;

  const total = selectedFiles.length;

  for (let i = 0; i < total; i++) {
    const file = selectedFiles[i];
    if (!file) continue;

    _progressText = `Subiendo ${i + 1}/${total}`;

    if (!file.name.endsWith('.zip')) {
      toast.error(`Ignorado ${file.name}: No es ZIP`);
      errorCount++;
      continue;
    }

    const formData = new FormData();
    formData.append('seriesId', seriesId.toString());
    formData.append('file', file);

    try {
      const { error } = await actions.chapters.upload(formData);

      if (!error) {
        successCount++;
      } else {
        console.error(`Error subiendo ${file.name}:`, error);
        errorCount++;
      }
    } catch (e) {
      console.error(`Error de red con ${file.name}`, e);
      errorCount++;
    }
  }

  _isUploading = false;
  _progressText = '';

  if (successCount > 0) {
    toast.success(`${successCount} capítulos subidos correctamente.`);
    selectedFiles = null;
    if (fileInput) fileInput.value = '';
    // Disparar evento para recargar lista
    window.dispatchEvent(new CustomEvent('chapterUploaded'));
  }

  if (errorCount > 0) {
    toast.warning(`${errorCount} fallaron. Revisa la consola.`);
  }
}
</script>

<div class="uploader-card">
  <div class="header">
    <h3>Subir Capítulos</h3>
    <p>Arrastra archivos ZIP o selecciónalos. El nombre del archivo debe ser el número del capítulo (ej: 1.zip, 2.5.zip).</p>
  </div>

  <div class="upload-area" class:active={selectedFiles}>
    <input 
      type="file" 
      multiple 
      accept=".zip" 
      onchange={_handleFileChange}
      bind:this={fileInput}
      id="file-upload"
      disabled={_isUploading}
    />
    <label for="file-upload">
      <div class="upload-icon">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      </div>
      {#if selectedFiles}
        <span class="file-count">{selectedFiles.length} archivos seleccionados</span>
      {:else}
        <span class="hint">Click para seleccionar o soltar archivos ZIP</span>
      {/if}
    </label>
  </div>

  {#if selectedFiles && !_isUploading}
    <div class="file-list">
      {#each Array.from(selectedFiles) as file}
        <div class="file-item">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          {file.name}
        </div>
      {/each}
    </div>
  {/if}

  <div class="actions">
    {#if _isUploading}
      <div class="progress-container">
        <div class="spinner">
          <svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg>
        </div>
        <span class="progress-label">{_progressText}</span>
      </div>
    {:else}
      <button 
          class="action-btn full-width" 
          onclick={_uploadChapters}
          disabled={_isUploading || !selectedFiles}
      >
        Subir a {_seriesTitle}
      </button>
    {/if}
  </div>
</div>

<style>
  .uploader-card { background: #111; border: 1px solid #222; border-radius: 20px; padding: 1.5rem; }
  .header h3 { margin: 0 0 0.5rem; color: #fff; }
  .header p { font-size: 0.8rem; color: #666; margin-bottom: 1.5rem; }

  .upload-area {
    border: 2px dashed #333;
    border-radius: 16px;
    position: relative;
    padding: 2rem;
    text-align: center;
    transition: all 0.2s;
  }

  .upload-area:hover, .upload-area.active { border-color: var(--accent-color); background: rgba(0, 191, 255, 0.03); }

  .upload-area input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
  
  .upload-icon { color: #444; margin-bottom: 1rem; transition: color 0.2s; }
  .upload-area:hover .upload-icon { color: var(--accent-color); }

  .hint { font-size: 0.9rem; font-weight: 600; color: #666; }
  .file-count { color: var(--accent-color); font-weight: 800; font-size: 1rem; }

  .file-list { margin-top: 1rem; max-height: 150px; overflow-y: auto; background: #000; border-radius: 10px; padding: 0.5rem; }
  .file-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: #888; padding: 0.4rem; border-bottom: 1px solid #111; }

  .actions { margin-top: 1.5rem; }
  .action-btn { background: var(--accent-color); color: #000; border: none; padding: 1rem; border-radius: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s; }
  .action-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 191, 255, 0.3); }
  .action-btn:disabled { opacity: 0.5; cursor: not-allowed; background: #444; color: #888; }

  .progress-container { display: flex; align-items: center; justify-content: center; gap: 1rem; padding: 1rem; background: #1a1a1a; border-radius: 12px; }
  .progress-label { font-size: 0.9rem; font-weight: 700; color: #fff; }

  .spinner { width: 24px; height: 24px; animation: rotate 2s linear infinite; }
  .spinner svg { width: 100%; height: 100%; }
  .spinner circle { stroke: var(--accent-color); stroke-linecap: round; animation: dash 1.5s ease-in-out infinite; }

  @keyframes rotate { 100% { transform: rotate(360deg); } }
  @keyframes dash { 0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; } 50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; } 100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; } }
</style>
