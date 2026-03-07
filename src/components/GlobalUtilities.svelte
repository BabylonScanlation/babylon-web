<script lang="ts">
  import { onMount } from 'svelte';
  import { authModal, toast } from '../lib/stores.svelte';
  
  let { isVerifyPage = false, shouldShowAgeGate = false } = $props();

  let AuthModal = $state<any>(null);
  let ToastContainer = $state<any>(null);
  let AppBanner = $state<any>(null);
  let AgeGate = $state<any>(null);

  // Orion: Solo cargar componentes si hay una acción que los requiera
  $effect(() => {
    if (authModal.isOpen && !AuthModal) {
      import('./AuthModal.svelte').then(m => AuthModal = m.default);
    }
  });

  $effect(() => {
    if (toast.messages.length > 0 && !ToastContainer) {
      import('./ToastContainer.svelte').then(m => ToastContainer = m.default);
    }
  });

  onMount(() => {
    // Orion: Procesar evento pendiente tras hidratación bajo demanda
    const pending = (window as any)._babylonPendingEvent;
    if (pending) {
      if (pending.type === 'open-auth-modal') {
        authModal.open(pending.detail?.view || 'login', pending.detail?.message || '');
      }
      (window as any)._babylonPendingEvent = null;
    }

    // Orion: Retrasar componentes secundarios para no inflar las peticiones iniciales
    setTimeout(() => {
      if (!isVerifyPage && !localStorage.getItem('babylon_app_banner_closed')) {
        import('./AppBanner.svelte').then(m => AppBanner = m.default);
      }
      if (shouldShowAgeGate) {
        import('./AgeGate.svelte').then(m => AgeGate = m.default);
      }
    }, 2000);
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
