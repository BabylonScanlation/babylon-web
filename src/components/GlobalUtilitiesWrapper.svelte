<script lang="ts">
  import { onMount } from 'svelte';
  import { authModal } from '../lib/stores.svelte';

  let { isVerifyPage = false, shouldShowAgeGate = false } = $props();
  let GlobalUtilities = $state<any>(null);
  let isActivated = $state(false);

  onMount(() => {
    const activate = async () => { 
      if (isActivated) return;
      // Orion: Solo descargamos el componente real tras la interacción
      const m = await import('./GlobalUtilities.svelte');
      GlobalUtilities = m.default;
      isActivated = true;
    };

    window.addEventListener('open-auth-modal', activate);
    window.addEventListener('show-toast', activate);
    
    // Auto-activar si hay una señal previa
    if ((window as any)._babylonUtilsPending) activate();

    return () => {
      window.removeEventListener('open-auth-modal', activate);
      window.removeEventListener('show-toast', activate);
    };
  });
</script>

{#if isActivated && GlobalUtilities}
  <GlobalUtilities {isVerifyPage} {shouldShowAgeGate} />
{/if}
