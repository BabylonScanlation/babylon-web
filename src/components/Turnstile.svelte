<script lang="ts">
  import { onMount } from 'svelte';

  export let onVerify: (token: string) => void;
  export let theme: 'light' | 'dark' | 'auto' = 'auto';

  let containerId = `turnstile-widget-${Math.random().toString(36).substring(2, 9)}`;

  onMount(() => {
    // 1. Inyectar script si no existe
    if (!document.getElementById('turnstile-script')) {
      const script = document.createElement('script');
      script.id = 'turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    // 2. Esperar a que window.turnstile esté listo
    const interval = setInterval(() => {
      // @ts-expect-error Global turnstile
      if (window.turnstile) {
        clearInterval(interval);
        renderWidget();
      }
    }, 100);

    return () => {
      clearInterval(interval);
    };
  });

  function renderWidget() {
    // @ts-expect-error Global turnstile
    window.turnstile.render(`#${containerId}`, {
      sitekey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY, 
      theme: theme,
      callback: (token: string) => {
        onVerify(token);
      },
      'expired-callback': () => {
        onVerify(''); 
      },
    });
  }
</script>

<div id={containerId} class="turnstile-wrapper"></div>

<style>
  .turnstile-wrapper {
    margin: 1rem 0;
    display: flex;
    justify-content: center; /* Centrar el captcha */
  }
</style>
