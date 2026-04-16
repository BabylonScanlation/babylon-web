<script lang="ts">
import { onMount } from 'svelte';
import { fade } from 'svelte/transition';
import { timeAgo } from '../lib/utils';
import Swiper from './Swiper.svelte';

let progressList = $state<any[]>([]);
let isAuthenticated = $state(false);

async function checkAuthAndLoadProgress() {
  try {
    const authRes = await fetch('/api/auth/status');
    const userData = await authRes.json();

    if (userData?.uid) {
      isAuthenticated = true;
      const res = await fetch('/api/user/progress');
      if (res.ok) {
        const data = await res.json();
        progressList = data.progress || [];
      }
    } else {
      isAuthenticated = false;
      progressList = [];
    }
  } catch (e) {
    console.error('Failed to load progress', e);
  }
}

onMount(() => {
  checkAuthAndLoadProgress();

  const handleAuthSuccess = () => checkAuthAndLoadProgress();
  document.addEventListener('auth-success', handleAuthSuccess);

  return () => {
    document.removeEventListener('auth-success', handleAuthSuccess);
  };
});
</script>

{#if isAuthenticated && progressList.length > 0}
  <section class="continue-reading-container" in:fade>
    <div class="section-header">
      <div class="header-left">
        <div class="header-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none">
            <path d="M12 19l7-7-7-7M5 12h14"></path>
          </svg>
        </div>
        <h2 class="section-title">Continuar Leyendo</h2>
      </div>
      <a href="/library" class="view-all">Ir a mi biblioteca →</a>
    </div>

    <Swiper 
      options={{
        slidesPerView: 1.2,
        spaceBetween: 16,
        breakpoints: {
          640: { slidesPerView: 2.2 },
          1024: { slidesPerView: 3.2 },
          1400: { slidesPerView: 4.2 }
        }
      }}
    >
      {#each progressList as item (item.series.seriesSlug)}
        <div class="swiper-slide">
          <a href={item.nextChapter.url} class="continue-card">
            <div class="card-image">
              <img src={item.series.cover} alt={item.series.title} loading="lazy" />
              <div class="image-overlay"></div>
              <div class="play-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </div>
            </div>
            <div class="card-info-box">
              <h3 class="series-name">{item.series.title}</h3>
              <div class="progress-meta">
                <span class="chap-num">Próximo: Cap {item.nextChapter.number}</span>
                <span class="dot">•</span>
                <span class="last-read">{timeAgo(new Date(item.nextChapter.createdAt).getTime())}</span>
              </div>
            </div>
          </a>
        </div>
      {/each}
    </Swiper>
  </section>
{/if}

<style>
  .continue-reading-container {
    margin: 3rem 0 4rem;
    position: relative;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding: 0 0.5rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-icon {
    color: var(--accent-color);
    display: flex;
    align-items: center;
  }

  .section-title {
    font-size: 1.5rem;
    font-weight: 900;
    letter-spacing: -0.03em;
    margin: 0;
  }

  .view-all {
    font-size: 0.85rem;
    font-weight: 700;
    color: #666;
    text-decoration: none;
    transition: color 0.2s;
  }

  .view-all:hover {
    color: var(--accent-color);
  }

  .continue-card {
    display: block;
    text-decoration: none;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 20px;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .continue-card:hover {
    transform: translateY(-6px);
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
  }

  .card-image {
    position: relative;
    height: 140px;
    background: #111;
  }

  .card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.8;
    transition: transform 0.5s;
  }

  .continue-card:hover img {
    transform: scale(1.05);
    opacity: 1;
  }

  .image-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  }

  .play-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.8);
    background: var(--accent-color);
    color: #000;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 20px rgba(0, 191, 255, 0.4);
  }

  .continue-card:hover .play-icon {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  .card-info-box {
    padding: 1.25rem;
  }

  .series-name {
    font-size: 1rem;
    font-weight: 800;
    color: #fff;
    margin: 0 0 0.5rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .progress-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #666;
  }

  .chap-num {
    color: var(--accent-color);
    font-weight: 700;
  }

  .dot { opacity: 0.3; }

  @media (max-width: 768px) {
    .continue-reading-container { margin: 2rem 0 3rem; }
    .section-title { font-size: 1.2rem; }
    .card-info-box { padding: 1rem; }
    .series-name { font-size: 0.9rem; }
    .chap-num { font-size: 0.75rem; }
  }
</style>
