<script lang="ts">
  import AuthModal from './AuthModal.svelte';
  import ToastContainer from './ToastContainer.svelte';
  import AppBanner from './AppBanner.svelte';
  import AgeGate from './AgeGate.svelte';
  import { onMount } from 'svelte';
  import { NewsService } from '../lib/news-service';

  let { isVerifyPage = false, shouldShowAgeGate = false } = $props();

  onMount(() => {
    // Astra: Sincronizar el badge estático del Header
    const updateBadge = () => {
      const newsService = NewsService.getInstance();
      const count = newsService.getUnreadCountSync?.() || 0;
      const badge = document.getElementById('news-badge');
      const text = document.getElementById('news-count-text');
      
      if (badge && text) {
        if (count > 0) {
          text.textContent = count > 99 ? '99+' : count.toString();
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    };

    updateBadge();
    window.addEventListener('news-updated', updateBadge);
    return () => window.removeEventListener('news-updated', updateBadge);
  });
</script>

<ToastContainer />
{#if !isVerifyPage}
  <AuthModal />
  <AppBanner />
{/if}

{#if shouldShowAgeGate}
  <AgeGate isVerificationPage={false} />
{/if}
