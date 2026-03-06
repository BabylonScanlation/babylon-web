<script lang="ts">
  import { onMount } from 'svelte';
  
  let { isVerifyPage = false, shouldShowAgeGate = false } = $props();

  // Orion: Referencias reactivas para componentes dinámicos (Cero carga inicial)
  let AuthModal = $state<any>(null);
  let ToastContainer = $state<any>(null);
  let AppBanner = $state<any>(null);
  let AgeGate = $state<any>(null);

  // Astra: Carga perezosa bajo demanda (On-Demand Hydration)
  const loadAuth = async () => {
    if (AuthModal) return;
    try {
      const mod = await import('./AuthModal.svelte');
      AuthModal = mod.default;
    } catch (e) {
      console.error('[GlobalUtilities] Error loading AuthModal:', e);
    }
  };

  const loadAgeGate = async () => {
    if (AgeGate || !shouldShowAgeGate) return;
    try {
      const mod = await import('./AgeGate.svelte');
      AgeGate = mod.default;
    } catch (e) {
      console.error('[GlobalUtilities] Error loading AgeGate:', e);
    }
  };

  const loadUtilities = async () => {
    // Astra: Solo cargamos Toast y Banner cuando el navegador esté libre
    try {
      const [toast, banner] = await Promise.all([
        import('./ToastContainer.svelte'),
        import('./AppBanner.svelte')
      ]);
      ToastContainer = toast.default;
      AppBanner = banner.default;
    } catch (e) {
      console.error('[GlobalUtilities] Error loading idle utilities:', e);
    }
  };

  onMount(() => {
    // 1. Escuchar el evento de apertura de modal (Carga reactiva de Auth)
    const handleAuthRequest = () => {
      // Solo cargamos el JS del modal si el usuario REALMENTE quiere loguearse
      loadAuth();
    };
    
    window.addEventListener('open-auth-modal', handleAuthRequest, { once: true });
    
    // 2. Cargar AgeGate solo si es necesario (Diferido 1s para no competir con el Hero)
    if (shouldShowAgeGate) {
      setTimeout(loadAgeGate, 1000);
    }

    // 3. Diferir el resto hasta que el navegador esté COMPLETAMENTE en reposo
    // Aumentamos el delay a 5s como fallback para asegurar que no compite con nada inicial
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => loadUtilities(), { timeout: 10000 });
    } else {
      setTimeout(loadUtilities, 5000);
    }

    return () => {
      window.removeEventListener('open-auth-modal', handleAuthRequest);
    };
  });
</script>

{#if ToastContainer}
  <ToastContainer />
{/if}

{#if !isVerifyPage}
  {#if AuthModal}
    <AuthModal />
  {/if}
  {#if AppBanner}
    <AppBanner />
  {/if}
{/if}

{#if shouldShowAgeGate && AgeGate}
  <AgeGate isVerificationPage={false} />
{/if}
