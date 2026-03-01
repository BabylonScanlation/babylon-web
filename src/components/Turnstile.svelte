<script lang="ts">
import { onMount } from 'svelte';

interface Props {
  onVerify: (token: string) => void;
  theme?: 'light' | 'dark' | 'auto';
}

let { onVerify, theme = 'auto' }: Props = $props();

const containerId = `turnstile-widget-${Math.random().toString(36).substring(2, 9)}`;

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
  // Orion: Si estamos en modo desarrollo local, usamos la Sitekey oficial de Test de Cloudflare
  // que "Siempre Pasa" para evitar errores de dominio al probar desde el móvil en la misma red WiFi.
  const isDev = import.meta.env.DEV;
  const sitekey = isDev ? '1x00000000000000000000AA' : import.meta.env.PUBLIC_TURNSTILE_SITE_KEY;

  // @ts-expect-error Global turnstile
  window.turnstile.render(`#${containerId}`, {
    sitekey: sitekey,
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
