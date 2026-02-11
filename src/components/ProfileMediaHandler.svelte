<script lang="ts">
  import { onMount } from 'svelte';
  import ImageSelectorModal from './ImageSelectorModal.svelte';
  import { toast } from '../lib/toastStore';

  let showModal = false;
  let modalType: 'avatar' | 'banner' = 'avatar';

  onMount(() => {
    // Expose function to window for legacy scripts to call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).openProfileMediaModal = (type: 'avatar' | 'banner') => {
      modalType = type;
      showModal = true;
    };
  });

  async function handleSelect(event: CustomEvent) {
    const { type, url } = event.detail;
    
    // Optimistic update handled by the caller or we do it here?
    // Let's do the API call here.
    try {
      const payload = type === 'avatar' ? { avatarUrl: url } : { bannerUrl: url };
      
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Error actualizando perfil');

      // Update DOM
      if (type === 'avatar') {
        const img = document.getElementById('avatar-preview') as HTMLImageElement;
        if (img) img.src = url;
      } else {
        const banner = document.getElementById('banner-preview');
        if (banner) {
             banner.style.backgroundImage = `url('${url}')`;
             banner.classList.remove('premium-gradient');
        }
      }
      
      toast.success(type === 'avatar' ? 'Avatar actualizado' : 'Portada actualizada');
    } catch (e) {
      console.error(e);
      toast.error('Fallo al actualizar');
    }
  }
</script>

<ImageSelectorModal 
  isOpen={showModal} 
  type={modalType} 
  on:close={() => showModal = false}
  on:select={handleSelect}
/>
