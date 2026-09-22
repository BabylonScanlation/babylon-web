<script lang="ts">
import { onMount } from 'svelte';

interface Props {
  onVerify: (token: string) => void;
  theme?: 'light' | 'dark' | 'auto';
}

let { onVerify, theme = 'dark' }: Props = $props();

const containerId = `turnstile-widget-${Math.random().toString(36).substring(2, 9)}`;
const MAX_RETRIES = 3;
let widgetId = '';
let failed = $state(false);

function loadTurnstile(): Promise<void> {
  return new Promise((resolve, reject) => {
    // @ts-expect-error Global turnstile
    if (window.turnstile) return resolve();

    const existing = document.querySelector<HTMLScriptElement>('script[data-babylon-turnstile]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('turnstile load failed')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.babylonTurnstile = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('turnstile load failed'));
    document.head.appendChild(script);
  });
}

function renderWidget() {
  const isDev = import.meta.env.DEV;
  const sitekey =
    (isDev
      ? import.meta.env.PUBLIC_TURNSTILE_DEV_SITE_KEY
      : import.meta.env.PUBLIC_TURNSTILE_SITE_KEY) || '';

  if (!sitekey) {
    console.error('[Cloudflare Turnstile] Sitekey is missing. Check environment variables.');
    failed = true;
    return;
  }

  let retries = 0;

  // @ts-expect-error Global turnstile
  widgetId = window.turnstile.render(`#${containerId}`, {
    sitekey,
    theme,
    'refresh-expired': 'auto',
    callback: (token: string) => {
      retries = 0;
      failed = false;
      onVerify(token);
    },
    'expired-callback': () => {
      onVerify('');
    },
    'error-callback': () => {
      console.warn(
        '[Cloudflare Turnstile] Widget error, limited retry',
        retries + 1,
        '/',
        MAX_RETRIES
      );
      if (retries >= MAX_RETRIES) {
        failed = true;
        onVerify('');
        return;
      }
      retries += 1;
      setTimeout(() => {
        // @ts-expect-error Global turnstile
        if (widgetId) window.turnstile.reset(widgetId);
      }, 2000 * retries);
    },
  });
}

onMount(() => {
  let cancelled = false;

  loadTurnstile()
    .then(() => {
      if (!cancelled) renderWidget();
    })
    .catch((err) => {
      if (!cancelled) {
        console.error('[Cloudflare Turnstile]', err);
        failed = true;
      }
    });

  return () => {
    cancelled = true;
    if (widgetId) {
      try {
        // @ts-expect-error Global turnstile
        window.turnstile.remove(widgetId);
      } catch {
        /* already removed */
      }
    }
  };
});

function retryWidget() {
  failed = false;
  onVerify('');
  // @ts-expect-error Global turnstile
  if (widgetId && window.turnstile) {
    // @ts-expect-error Global turnstile
    window.turnstile.reset(widgetId);
  } else {
    loadTurnstile().then(renderWidget);
  }
}
</script>

{#if failed}
  <div class="turnstile-error" role="alert">
    <p>No se pudo cargar la verificación.</p>
    <button type="button" class="retry-btn" onclick={retryWidget}>Reintentar</button>
  </div>
{/if}
<div id={containerId} class="turnstile-wrapper" hidden={failed}></div>

<style>
  .turnstile-wrapper {
    margin: 1.5rem 0;
    display: flex;
    justify-content: center;
  }

  .turnstile-error {
    margin: 1.5rem 0;
    text-align: center;
    color: #ccc;
    font-size: 0.9rem;
  }

  .retry-btn {
    margin-top: 0.75rem;
    background: transparent;
    color: #00bfff;
    border: 1px solid rgba(0, 191, 255, 0.4);
    padding: 0.5rem 1.25rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
  }

  .retry-btn:hover {
    background: rgba(0, 191, 255, 0.1);
  }
</style>
