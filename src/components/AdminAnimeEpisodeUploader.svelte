<script lang="ts">
import { actions } from 'astro:actions';
import { toast } from '../lib/stores.svelte';

interface Props {
  seriesId: number;
  seriesTitle: string;
}

let { seriesId, seriesTitle }: Props = $props();

let chapterNumber = $state<string>('');
let language = $state<string>('es-la');
let title = $state<string>('');
let servers = $state<{ serverName: string; iframeUrl: string; isDirectVideo: boolean }[]>([
  { serverName: '', iframeUrl: '', isDirectVideo: false },
]);

let isUploading = $state(false);

function addServer() {
  servers = [...servers, { serverName: '', iframeUrl: '', isDirectVideo: false }];
}

function removeServer(index: number) {
  servers = servers.filter((_, i) => i !== index);
}

async function handleAddEpisode(e: Event) {
  e.preventDefault();

  if (!chapterNumber) {
    toast.error('El número de episodio es obligatorio');
    return;
  }

  const validServers = servers.filter(
    (s) => s.serverName.trim() !== '' && s.iframeUrl.trim() !== ''
  );
  if (validServers.length === 0) {
    toast.error('Agrega al menos un servidor válido');
    return;
  }

  isUploading = true;

  try {
    const formData = new FormData();
    formData.append('seriesId', seriesId.toString());
    formData.append('chapterNumber', chapterNumber);
    formData.append('language', language);
    if (title) formData.append('title', title);
    formData.append('servers', JSON.stringify(validServers));

    const { error } = await actions.chapters.addAnimeEpisode(formData);

    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      toast.success(`Episodio ${chapterNumber} agregado correctamente`);
      // Reiniciar formulario
      chapterNumber = '';
      title = '';
      servers = [{ serverName: '', iframeUrl: '', isDirectVideo: false }];
      // Recargar lista
      window.dispatchEvent(new CustomEvent('chapterUploaded'));
      setTimeout(() => window.location.reload(), 1500);
    }
  } catch (err) {
    console.error(err);
    toast.error('Error de red al agregar el episodio');
  } finally {
    isUploading = false;
  }
}
</script>

<div class="uploader-card">
  <div class="header">
    <h3>Añadir Episodio de Anime</h3>
    <p>
      Agrega los servidores de video para el episodio. Puedes usar enlaces de iframe
      (Mega, Someprox...) o vídeo directo (MP4, M3U8, Archive.org, etc.).
    </p>
  </div>

  <form onsubmit={handleAddEpisode} class="episode-form">
    <div class="input-row">
      <div class="input-group">
        <label for="ep-number">N° de Episodio</label>
        <input id="ep-number" type="number" step="0.1" bind:value={chapterNumber} placeholder="Ej: 1" required />
      </div>
      <div class="input-group">
        <label for="ep-lang">Idioma</label>
        <select id="ep-lang" bind:value={language}>
          <option value="es-la">Sub Español</option>
          <option value="es">Español Latino</option>
          <option value="en">Inglés</option>
          <option value="raw">Raw (Sin subtítulos)</option>
        </select>
      </div>
    </div>
    
    <div class="input-group">
      <label for="ep-title">Título del Episodio (Opcional)</label>
      <input id="ep-title" type="text" bind:value={title} placeholder="Ej: El comienzo" />
    </div>

    <div class="servers-section">
      <h4>Servidores</h4>
      {#each servers as server, index (index)}
        <div class="server-item">
          <div class="server-inputs">
            <input type="text" placeholder="Nombre (Ej: Mega)" bind:value={server.serverName} required />
            <input type="text" placeholder="URL del Iframe o Video" bind:value={server.iframeUrl} required />
          </div>
          <label class="direct-toggle">
            <input type="checkbox" bind:checked={server.isDirectVideo} />
            <span>Video directo</span>
          </label>
          <button type="button" aria-label="Eliminar servidor" class="btn-remove" onclick={() => removeServer(index)} disabled={servers.length === 1}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      {/each}
      <button type="button" class="btn-add" onclick={addServer}>+ Añadir otro servidor</button>
    </div>

    <div class="actions">
      <button type="submit" class="action-btn full-width" disabled={isUploading}>
        {isUploading ? 'Guardando...' : `Añadir a ${seriesTitle}`}
      </button>
    </div>
  </form>
</div>

<style>
  .uploader-card { background: #111; border: 1px solid #222; border-radius: 20px; padding: 1.5rem; }
  .header h3 { margin: 0 0 0.5rem; color: #fff; }
  .header p { font-size: 0.8rem; color: #666; margin-bottom: 1.5rem; }

  .episode-form { display: flex; flex-direction: column; gap: 1rem; }
  
  .input-row { display: flex; gap: 1rem; }
  .input-group { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
  .input-group label { font-size: 0.8rem; color: #aaa; font-weight: 600; }
  
  input, select {
    background: #222;
    border: 1px solid #333;
    color: #fff;
    padding: 0.8rem;
    border-radius: 8px;
    font-size: 0.9rem;
  }
  input:focus, select:focus { outline: none; border-color: var(--accent-color); }

  .servers-section {
    background: #1a1a1a;
    padding: 1rem;
    border-radius: 12px;
    border: 1px solid #2a2a2a;
    margin-top: 0.5rem;
  }
  .servers-section h4 { margin: 0 0 1rem 0; color: #ddd; font-size: 0.9rem; }
  
  .server-item { display: flex; gap: 0.5rem; margin-bottom: 0.8rem; align-items: center; }
  .server-inputs { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
  @media (min-width: 600px) {
    .server-inputs { flex-direction: row; }
  }
  .server-inputs input { flex: 1; padding: 0.6rem; }
  
  .btn-remove { 
    background: rgba(255, 71, 87, 0.1); 
    color: #ff4757; 
    border: none; 
    padding: 0.6rem; 
    border-radius: 8px; 
    cursor: pointer; 
    display: flex; 
    align-items: center; 
    justify-content: center;
  }
  .btn-remove:disabled { opacity: 0.3; cursor: not-allowed; }
  .btn-remove:hover:not(:disabled) { background: #ff4757; color: white; }

  .btn-add {
    background: transparent;
    border: 1px dashed #444;
    color: #aaa;
    width: 100%;
    padding: 0.8rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }
  .btn-add:hover { border-color: var(--accent-color); color: var(--accent-color); }

  .direct-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #aaa;
    cursor: pointer;
    white-space: nowrap;
    margin-bottom: 0.4rem;
  }
  .direct-toggle input {
    width: 16px;
    height: 16px;
    accent-color: var(--accent-color);
    cursor: pointer;
  }
  @media (max-width: 600px) {
    .direct-toggle { align-self: flex-start; margin-bottom: 0; }
  }

  .actions { margin-top: 1rem; }
  .action-btn { background: var(--accent-color); color: #000; border: none; padding: 1rem; border-radius: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s; width: 100%; }
  .action-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 191, 255, 0.3); }
  .action-btn:disabled { opacity: 0.5; cursor: not-allowed; background: #444; color: #888; }
</style>
