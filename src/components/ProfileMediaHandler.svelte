<script lang="ts">
import { actions } from 'astro:actions';
import { onMount } from 'svelte';
import { toast, userStore } from '../lib/stores.svelte';
import ImageSelectorModal from './ImageSelectorModal.svelte';

let showModal = $state(false);
let modalType = $state<'avatar' | 'banner'>('avatar');

onMount(() => {
  // Expose function to window for legacy scripts to call
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).openProfileMediaModal = (type: 'avatar' | 'banner') => {
    modalType = type;
    showModal = true;
  };
});

async function handleSelect(detail: { type: 'avatar' | 'banner'; url: string }) {
  const { type, url } = detail;

  try {
    const payload = type === 'avatar' ? { avatarUrl: url } : { bannerUrl: url };

    const { error } = await actions.user.updateProfile(payload);

    if (error) throw new Error(error.message || 'Error actualizando perfil');

    // Orion: Actualizar el store global para que el cambio se vea en comentarios, header, etc.
    if (type === 'avatar') {
      userStore.user = { ...userStore.user, avatarUrl: url };
      const img = document.getElementById('avatar-preview') as HTMLImageElement;
      if (img) img.src = url;
    } else {
      userStore.user = { ...userStore.user, bannerUrl: url };
      const banner = document.getElementById('banner-preview');
      if (banner) {
        banner.style.backgroundImage = `url('${url}')`;
        banner.classList.remove('premium-gradient');
      }
    }

    toast.success(type === 'avatar' ? 'Avatar actualizado' : 'Portada actualizada');
  } catch (e: any) {
    console.error(e);
    toast.error('Fallo al actualizar: ' + e.message);
  }
}
</script>

<ImageSelectorModal
  isOpen={showModal}
  type={modalType}
  onClose={() => showModal = false}
  onSelect={handleSelect}
/>
