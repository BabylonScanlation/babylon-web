<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Swiper from './Swiper.svelte';
  import { timeAgo } from '../lib/utils';

  let progressList = [];
  let isAuthenticated = false;

  async function checkAuthAndLoadProgress() {
    try {
      const authRes = await fetch('/api/auth/status');
      const userData = await authRes.json();
      
      if (userData && userData.uid) {
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
      <div class="header-line"></div>
      <h2 class="section-title">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M12 19l7-7-7-7"></path><path d="M5 19l7-7-7-7"></path></svg>
        Continuar Leyendo
      </h2>
    </div>
    
    <div class="swiper-outer-box">
      <Swiper options={{
        slidesPerView: 2.2,
        spaceBetween: 16,
        breakpoints: {
          640: { slidesPerView: 3.2, spaceBetween: 20 },
          768: { slidesPerView: 4.2, spaceBetween: 20 },
          1024: { slidesPerView: 5.2, spaceBetween: 24 },
        },
        freeMode: true,
        grabCursor: true
      }}>
        {#each progressList as item (item.series.slug)}
          <div class="swiper-slide">
            <a href="{item.nextChapter.url}" class="reading-card">
              <div class="art-frame">
                <img src="{item.series.cover}" alt={item.series.title} loading="lazy" />
                <div class="card-glass-overlay"></div>
              </div>
              
              <div class="card-floating-meta">
                <div class="badge-glass time">
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  {timeAgo(item.nextChapter.createdAt)}
                </div>
              </div>

              <div class="card-info-box">
                <h3 class="series-name">{item.series.title}</h3>
                <div class="progress-indicator">
                  <span class="chap-num">CAP {item.nextChapter.number}</span>
                  <div class="pulse-dot"></div>
                </div>
              </div>
            </a>
          </div>
        {/each}
      </Swiper>
    </div>
  </section>
{/if}

<style>
  .continue-reading-container {
    margin: 3rem 0 4rem;
    width: 100%;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .header-line {
    height: 2px;
    flex: 1;
    background: linear-gradient(90deg, var(--accent-color), transparent);
    opacity: 0.3;
  }

  .section-title {
    font-size: 1.5rem;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .section-title svg {
    color: var(--accent-color);
  }
  
  .swiper-outer-box {
    width: 100%;
    padding: 0.5rem 0;
  }

  .reading-card {
    display: block;
    position: relative;
    border-radius: 20px;
    overflow: hidden;
    aspect-ratio: 2 / 3;
    background: #1a1a1a;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
    text-decoration: none;
  }

  .reading-card:hover {
    transform: translateY(-10px) scale(1.02);
    border-color: var(--accent-color);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  }

  .art-frame {
    position: absolute;
    inset: 0;
    z-index: 0;
  }

  .art-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.6s ease;
  }
  
  .reading-card:hover .art-frame img {
    transform: scale(1.1);
  }

  .card-glass-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, #000 10%, rgba(0,0,0,0.4) 50%, transparent 100%);
    opacity: 0.8;
  }

  .card-floating-meta {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 5;
  }

  .badge-glass {
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 0.7rem;
    padding: 4px 10px;
    border-radius: 100px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 6px;
    text-transform: uppercase;
  }

  .card-info-box {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 1.5rem;
    z-index: 5;
    text-align: center;
  }

  .series-name {
    font-size: 1rem;
    font-weight: 800;
    color: #fff;
    margin-bottom: 0.75rem;
    line-height: 1.2;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-shadow: 0 2px 10px rgba(0,0,0,0.5);
  }

  .progress-indicator {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 6px 12px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
  }

  .reading-card:hover .progress-indicator {
    background: var(--accent-color);
    border-color: var(--accent-color);
  }

  .chap-num {
    font-size: 0.8rem;
    font-weight: 900;
    color: var(--accent-color);
    letter-spacing: 0.05em;
  }

  .reading-card:hover .chap-num {
    color: #000;
  }

  .pulse-dot {
    width: 6px;
    height: 6px;
    background: var(--accent-color);
    border-radius: 50%;
    box-shadow: 0 0 10px var(--accent-color);
    animation: pulse 2s infinite;
  }

  .reading-card:hover .pulse-dot {
    background: #000;
    box-shadow: none;
  }

  @keyframes pulse {
    0% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.2); }
    100% { opacity: 0.4; transform: scale(1); }
  }

  @media (max-width: 768px) {
    .continue-reading-container { margin: 2rem 0 3rem; }
    .section-title { font-size: 1.2rem; }
    .card-info-box { padding: 1rem; }
    .series-name { font-size: 0.9rem; }
    .chap-num { font-size: 0.75rem; }
  }
</style>