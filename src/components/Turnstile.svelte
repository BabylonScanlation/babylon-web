<script lang="ts">
import { onMount } from 'svelte';

interface Props {
  onVerify: (token: string) => void;
  theme?: 'light' | 'dark' | 'auto';
}

let { onVerify, theme = 'dark' }: Props = $props();

const containerId = `turnstile-widget-${Math.random().toString(36).substring(2, 9)}`;

onMount(() => {
  // Astra: El script ya está en el Layout, solo esperamos que esté listo
  const checkTurnstile = () => {
    // @ts-expect-error Global turnstile
    if (window.turnstile) {
      renderWidget();
    } else {
      setTimeout(checkTurnstile, 50);
    }
  };

  checkTurnstile();
});

function renderWidget() {
  const isDev = import.meta.env.DEV;
  const sitekey =
    (isDev
      ? import.meta.env.TURNSTILE_DEV_SECRET_KEY
      : import.meta.env.TURNSTILE_SECRET_KEY) || '';

  if (!sitekey) {
    console.error('[Cloudflare Turnstile] Sitekey is missing. Check environment variables.');
    return;
  }

  // @ts-expect-error Global turnstile
  window.turnstile.render(`#${containerId}`, {
    sitekey: sitekey,
    theme: theme,
    'refresh-expired': 'manual',
    callback: (token: string) => onVerify(token),
    'expired-callback': () => onVerify(''),
  });
}
</script>

<div id={containerId} class="turnstile-wrapper"></div>

<style>
  .turnstile-wrapper {
    margin: 1.5rem 0;
    display: flex;
    justify-content: center;
  }
</style>
