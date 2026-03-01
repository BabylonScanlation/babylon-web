<script lang="ts">
import { fade, fly } from 'svelte/transition';
let isHovered = $state(false);
</script>

<a 
  href="/admin" 
  class="admin-access-card" 
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
>
  <div class="card-glow"></div>
  <div class="icon-area">
    <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="2" fill="none">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
    </svg>
  </div>
  <div class="text-area">
    <span class="label">Panel de Control</span>
    <span class="desc">Administrar contenidos</span>
  </div>
  
  {#if isHovered}
    <div class="scan-line" in:fly={{ y: -20, duration: 1000 }} out:fade></div>
  {/if}
</a>

<style>
  .admin-access-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    text-decoration: none;
    color: #fff;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }

  .admin-access-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--accent-color);
    transform: translateY(-4px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  }

  .card-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(0, 191, 255, 0.1), transparent 70%);
    opacity: 0;
    transition: opacity 0.3s;
  }

  .admin-access-card:hover .card-glow { opacity: 1; }

  .icon-area {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    background: rgba(0, 191, 255, 0.1);
    color: var(--accent-color);
    border-radius: 14px;
    transition: all 0.3s;
  }

  .admin-access-card:hover .icon-area {
    transform: scale(1.1) rotate(10deg);
    background: var(--accent-color);
    color: #000;
  }

  .text-area { display: flex; flex-direction: column; }
  .label { font-size: 1rem; font-weight: 800; letter-spacing: -0.01em; }
  .desc { font-size: 0.8rem; color: #666; font-weight: 500; }

  .scan-line {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #ff4444, transparent);
    z-index: 3;
    animation: scan 2s linear infinite;
  }

  @keyframes scan {
    0% { transform: translateY(0); }
    100% { transform: translateY(100px); opacity: 0; }
  }
</style>
