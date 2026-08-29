<script lang="ts">
import { onMount } from 'svelte';
import { authModal, toast } from '../lib/stores.svelte';
import NewsCounter from './NewsCounter.svelte';
import SupportModal from './SupportModal.svelte';

let { isVerifyPage = false, shouldShowAgeGate = false } = $props();

let authModalPromise = $state<Promise<any> | null>(null);
let toastContainerPromise = $state<Promise<any> | null>(null);
let appBannerPromise = $state<Promise<any> | null>(null);
let ageGatePromise = $state<Promise<any> | null>(null);

// Orion: Solo cargar componentes si hay una acción que los requiera
$effect(() => {
  if (authModal.isOpen && !authModalPromise) {
    authModalPromise = import('./AuthModal.svelte');
  }
});

$effect(() => {
  if (toast.messages.length > 0 && !toastContainerPromise) {
    toastContainerPromise = import('./ToastContainer.svelte');
  }
});

onMount(() => {
  // 1. Procesar evento pendiente tras hidratación bajo demanda
  const pending = (window as any)._babylonPendingEvent;
  if (pending) {
    if (pending.type === 'open-auth-modal') {
      authModal.open(pending.detail?.view || 'login', pending.detail?.message || '');
    } else if (pending.type === 'show-toast') {
      toast.add(pending.detail?.type || 'info', pending.detail?.message || '');
    }
    (window as any)._babylonPendingEvent = null;
  }

  // 2. Listeners persistentes para clics externos (Header, Footer, etc.)
  const handleAuth = (e: any) => authModal.open(e.detail?.view || 'login', e.detail?.message || '');
  const handleToast = (e: any) => toast.add(e.detail?.type || 'info', e.detail?.message || '');

  window.addEventListener('open-auth-modal', handleAuth);
  window.addEventListener('show-toast', handleToast);

  // Orion: Componentes CRÍTICOS sin delay
  if (shouldShowAgeGate) {
    ageGatePromise = import('./AgeGate.svelte');
  }

  // Orion: Retrasar solo componentes secundarios (App Banner)
  setTimeout(() => {
    if (!isVerifyPage && !localStorage.getItem('babylon_app_banner_closed')) {
      appBannerPromise = import('./AppBanner.svelte');
    }
  }, 2000);
});
</script>

{#if toastContainerPromise}
  {#await toastContainerPromise then m}
    {@const ToastContainer = m.default}
    <ToastContainer />
  {/await}
{/if}

{#if !isVerifyPage}
  {#if authModalPromise}
    {#await authModalPromise then m}
      {@const AuthModal = m.default}
      <AuthModal />
    {/await}
  {/if}
  {#if appBannerPromise}
    {#await appBannerPromise then m}
      {@const AppBanner = m.default}
      <AppBanner />
    {/await}
  {/if}
{/if}

{#if shouldShowAgeGate && ageGatePromise}
  {#await ageGatePromise then m}
    {@const AgeGate = m.default}
    <AgeGate isVerificationPage={false} />
  {/await}
{/if}

<SupportModal />

<NewsCounter />
