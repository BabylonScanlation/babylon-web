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
let coverFile = $state<File | null>(null);
let coverPreview = $state('');
let portadaInput: HTMLInputElement | undefined = $state();
let videoEl: HTMLVideoElement | undefined = $state();
let isGeneratingFrame = $state(false);

function handlePortadaChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  coverFile = file;
  coverPreview = URL.createObjectURL(file);
}

function clearPortada() {
  coverFile = null;
  coverPreview = '';
  if (portadaInput) portadaInput.value = '';
}

async function generateRandomPortada() {
  const directServer = servers.find((s) => s.isDirectVideo && s.iframeUrl.trim() !== '');
  if (!directServer) {
    toast.error('Agrega un servidor con video directo primero');
    return;
  }
  isGeneratingFrame = true;
  try {
    const blob = await extractRandomFrame(directServer.iframeUrl.trim());
    coverFile = new File([blob], `ep-cover-${Date.now()}.jpg`, { type: 'image/jpeg' });
    coverPreview = URL.createObjectURL(coverFile);
    toast.success('Portada generada del video');
  } catch (err) {
    console.error(err);
    toast.error('No se pudo generar el frame (CORS o video no válido)');
  } finally {
    isGeneratingFrame = false;
  }
}

function extractRandomFrame(url: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!videoEl) {
      reject(new Error('Elemento de video no disponible'));
      return;
    }
    const video = videoEl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    video.src = url;

    let timeout: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
    };

    const onMetaError = (err: unknown) => {
      cleanup();
      reject(err instanceof Error ? err : new Error('Error cargando el video'));
    };

    video.onerror = () => onMetaError(new Error('Video no soportado o bloqueado por CORS'));

    timeout = setTimeout(() => onMetaError(new Error('Timeout cargando el video')), 20000);

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        onMetaError(new Error('Duración inválida'));
        return;
      }
      video.currentTime = duration * 0.1 + Math.random() * duration * 0.8;
      video.onseeked = () => {
        cleanup();
        const canvas = document.createElement('canvas');
        const maxW = 480;
        const scale = Math.min(1, maxW / (video.videoWidth || 1));
        canvas.width = Math.round((video.videoWidth || 1) * scale);
        canvas.height = Math.round((video.videoHeight || 1) * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas no disponible'));
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('No se pudo exportar el frame'));
              return;
            }
            resolve(blob);
          },
          'image/jpeg',
          0.8
        );
      };
    };
  });
}

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

    const { data, error } = await actions.chapters.addAnimeEpisode(formData);

    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      if (coverFile && data?.chapterId) {
        const coverForm = new FormData();
        coverForm.append('chapterId', String(data.chapterId));
        coverForm.append('thumbnailImage', coverFile);
        const coverRes = await actions.chapters.uploadThumbnail(coverForm);
        if (coverRes.error) {
          toast.warning('Episodio creado, pero la portada no se pudo subir');
        } else {
          toast.success(`Episodio ${chapterNumber} agregado con portada`);
        }
      } else {
        toast.success(`Episodio ${chapterNumber} agregado correctamente`);
      }
      // Reiniciar formulario
      chapterNumber = '';
      title = '';
      servers = [{ serverName: '', iframeUrl: '', isDirectVideo: false }];
      clearPortada();
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

    <div class="portada-section">
      <h4>Portada del episodio (opcional)</h4>
      <div class="portada-row">
        <div class="portada-preview">
          {#if coverPreview}
            <img src={coverPreview} alt="Portada del episodio" />
          {:else}
            <div class="portada-empty">Sin portada</div>
          {/if}
        </div>
        <div class="portada-controls">
          <button type="button" class="btn-rand" onclick={generateRandomPortada} disabled={isGeneratingFrame}>
            {isGeneratingFrame ? 'Generando...' : '🎲 Portada aleatoria del video'}
          </button>
          <label class="btn-manual">
            <input type="file" accept="image/*" onchange={handlePortadaChange} bind:this={portadaInput} />
            Subir imagen
          </label>
          {#if coverFile}
            <button type="button" class="btn-clear" onclick={clearPortada}>Quitar</button>
          {/if}
        </div>
      </div>
    </div>

    <video bind:this={videoEl} style="display:none" tabindex="-1" aria-hidden="true"></video>

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

  .portada-section {
    background: #1a1a1a;
    padding: 1rem;
    border-radius: 12px;
    border: 1px solid #2a2a2a;
    margin-top: 0.5rem;
  }
  .portada-section h4 { margin: 0 0 1rem 0; color: #ddd; font-size: 0.9rem; }

  .portada-row { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
  .portada-preview {
    width: 110px;
    height: 154px;
    border-radius: 8px;
    overflow: hidden;
    background: #000;
    border: 1px solid #333;
    flex-shrink: 0;
  }
  .portada-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .portada-empty {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #555;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    text-align: center;
  }

  .portada-controls { display: flex; flex-direction: column; gap: 0.6rem; align-items: flex-start; }
  .btn-rand, .btn-manual, .btn-clear {
    border: none;
    padding: 0.6rem 1rem;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .btn-rand { background: var(--accent-color); color: #000; }
  .btn-rand:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 191, 255, 0.3); }
  .btn-rand:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-manual { background: rgba(255, 255, 255, 0.06); color: #ccc; position: relative; cursor: pointer; }
  .btn-manual:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
  .btn-manual input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .btn-clear { background: transparent; color: #ff4757; border: 1px solid rgba(255, 71, 87, 0.4); }
  .btn-clear:hover { background: rgba(255, 71, 87, 0.1); }

  .action-btn { background: var(--accent-color); color: #000; border: none; padding: 1rem; border-radius: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s; width: 100%; }
  .action-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 191, 255, 0.3); }
  .action-btn:disabled { opacity: 0.5; cursor: not-allowed; background: #444; color: #888; }
</style>
