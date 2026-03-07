<script lang="ts">
  import { onMount } from 'svelte';
  
  let { isVerifyPage = false, shouldShowAgeGate = false } = $props();

  let AuthModal = $state<any>(null);
  let ToastContainer = $state<any>(null);
  let AppBanner = $state<any>(null);
  let AgeGate = $state<any>(null);

  onMount(() => {
    // Carga paralela solo cuando el componente se monta (isla visible)
    Promise.all([
      import('./ToastContainer.svelte').then(m => ToastContainer = m.default),
      !isVerifyPage ? import('./AppBanner.svelte').then(m => AppBanner = m.default) : null,
      !isVerifyPage ? import('./AuthModal.svelte').then(m => AuthModal = m.default) : null,
      shouldShowAgeGate ? import('./AgeGate.svelte').then(m => AgeGate = m.default) : null
    ]);
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
