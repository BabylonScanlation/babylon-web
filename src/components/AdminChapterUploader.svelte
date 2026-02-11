<script lang="ts">
  import { toast } from '../lib/toastStore';

  let { seriesId, seriesTitle } = $props<{
    seriesId: number;
    seriesTitle: string;
  }>();

  let fileInput: HTMLInputElement | undefined = $state();
  let isUploading = $state(false);
  let selectedFiles = $state<FileList | null>(null);
  let progressText = $state('');

  function handleFileChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      selectedFiles = target.files;
    }
  }

  async function uploadChapters() {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast.error('Selecciona al menos un archivo');
      return;
    }

    isUploading = true;
    let successCount = 0;
    let errorCount = 0;

    const total = selectedFiles.length;

    for (let i = 0; i < total; i++) {
        const file = selectedFiles[i];
        if (!file) continue;

        progressText = `Subiendo ${i + 1}/${total}`;

        if (!file.name.endsWith('.zip')) {
            toast.error(`Ignorado ${file.name}: No es ZIP`);
            errorCount++;
            continue;
        }

        const formData = new FormData();
        formData.append('seriesId', seriesId.toString());
        formData.append('file', file);

        try {
            const res = await fetch('/api/admin/chapters/upload-to-telegram', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                successCount++;
            } else {
                const result = await res.json();
                console.error(`Error subiendo ${file.name}:`, result);
                errorCount++;
            }
        } catch (e) {
            console.error(`Error de red con ${file.name}`, e);
            errorCount++;
        }
    }

    isUploading = false;
    progressText = '';
    
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

<div class="quick-uploader">
  <div class="uploader-header">
    <h5>📤 Subida Rápida (Bulk)</h5>
    <span class="target-badge">{seriesTitle}</span>
  </div>

  <div class="compact-form">
    <div class="file-row">
        <input 
          type="file" 
          id="zip-upload-{seriesId}" 
          accept=".zip" 
          multiple
          onchange={handleFileChange} 
          bind:this={fileInput}
          hidden 
        />
        <label for="zip-upload-{seriesId}" class="file-btn" class:has-file={!!selectedFiles}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <span class="file-label text-truncate">
                {#if isUploading}
                    {progressText}
                {:else if selectedFiles && selectedFiles.length > 0}
                    {selectedFiles.length} archivos seleccionados
                {:else}
                    Seleccionar ZIPs
                {/if}
            </span>
        </label>
    </div>

    <div class="meta-row">
        <button 
          class="action-btn full-width" 
          onclick={uploadChapters}
          disabled={isUploading || !selectedFiles}
        >
          {#if isUploading}
            <svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="4"></circle></svg>
            <span>Procesando...</span>
          {:else}
            <span>Subir Seleccionados</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          {/if}
        </button>
    </div>
  </div>
</div>

<style>
  .quick-uploader {
    background: #111;
    border: 1px solid #333;
    border-radius: 16px;
    padding: 1.25rem;
    margin-top: 1rem;
  }

  .uploader-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .uploader-header h5 {
    margin: 0;
    color: #888;
    font-size: 0.75rem;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .target-badge {
    font-size: 0.7rem;
    color: #555;
    background: #1a1a1a;
    padding: 2px 8px;
    border-radius: 4px;
    max-width: 150px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .compact-form { display: flex; flex-direction: column; gap: 0.8rem; }

  .file-btn {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    background: #1a1a1a;
    border: 1px dashed #444;
    padding: 0.8rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    color: #888;
    font-size: 0.9rem;
    font-weight: 600;
    justify-content: center;
  }

  .file-btn:hover { border-color: #666; color: #ccc; }
  .file-btn.has-file { border-style: solid; border-color: rgba(46, 204, 113, 0.3); background: rgba(46, 204, 113, 0.05); color: #2ecc71; }

  .text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .meta-row { display: flex; }

  .action-btn {
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: #fff;
    color: #000;
    border: none;
    border-radius: 16px;
    cursor: pointer;
    transition: transform 0.1s, background 0.2s, box-shadow 0.2s;
    font-weight: 700;
    font-size: 0.95rem;
  }

  .action-btn.full-width { width: 100%; }

  .action-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    background: #4facfe;
    color: #fff;
    box-shadow: 0 8px 25px rgba(79, 172, 254, 0.3);
  }
  .action-btn:disabled { opacity: 0.5; cursor: not-allowed; background: #444; color: #888; }

  .spinner { width: 18px; height: 18px; animation: spin 1s linear infinite; }
  .spinner circle { opacity: 0.25; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>