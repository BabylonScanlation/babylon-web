<script lang="ts">
import { actions } from 'astro:actions';
import { toast } from '../lib/toastStore.svelte';
import ImageSelectorModal from './ImageSelectorModal.svelte';

interface Props {
  currentAvatar?: string | null;
  currentBanner?: string | null;
  username: string;
}

let { currentAvatar, currentBanner, username }: Props = $props();

let showModal = $state(false);
let modalType = $state<'avatar' | 'banner'>('avatar');
let isUpdating = $state(false);

function openSelector(type: 'avatar' | 'banner') {
  modalType = type;
  showModal = true;
}

async function handleSelect(detail: { type: 'avatar' | 'banner'; url: string }) {
  const { type, url } = detail;
  isUpdating = true;

  try {
    const { error } = await actions.user.updateProfileImage({
      type,
      imageUrl: url,
    });

    if (error) throw new Error(error.message);

    if (type === 'avatar') currentAvatar = url;
    else currentBanner = url;

    toast.success('Perfil actualizado');
    // Orion: Recarga parcial o actualización de estado global si fuera necesario
    window.location.reload();
  } catch (e: any) {
    toast.error(e.message || 'Error al actualizar');
  } finally {
    isUpdating = false;
  }
}
</script>

<div class="media-handler">
  <button 
    class="change-banner-btn" 
    onclick={() => openSelector('banner')}
    disabled={isUpdating}
  >
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
    Cambiar Portada
  </button>

  <div class="avatar-container">
    <button 
      class="avatar-edit-overlay" 
      onclick={() => openSelector('avatar')}
      disabled={isUpdating}
      aria-label="Cambiar avatar"
    >
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
    </button>
  </div>

  <ImageSelectorModal 
    isOpen={showModal} 
    type={modalType} 
    onClose={() => showModal = false}
    onSelect={handleSelect}
  />
</div>

<style>
  .media-handler { position: absolute; inset: 0; pointer-events: none; }
  .media-handler button { pointer-events: auto; }

  .change-banner-btn {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    padding: 0.6rem 1.2rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    transition: all 0.2s;
    z-index: 10;
  }

  .change-banner-btn:hover { background: rgba(0, 0, 0, 0.8); transform: translateY(-2px); }

  .avatar-container {
    position: absolute;
    bottom: -50px;
    left: 2rem;
    width: 140px;
    height: 140px;
    z-index: 20;
  }

  .avatar-edit-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    opacity: 0;
    transition: opacity 0.2s;
    border: none;
    cursor: pointer;
  }

  .avatar-container:hover .avatar-edit-overlay { opacity: 1; }

  @media (max-width: 768px) {
    .avatar-container { width: 100px; height: 100px; bottom: -40px; left: 50%; transform: translateX(-50%); }
    .change-banner-btn { top: 1rem; right: 1rem; padding: 0.5rem 0.8rem; font-size: 0.7rem; }
  }
</style>
