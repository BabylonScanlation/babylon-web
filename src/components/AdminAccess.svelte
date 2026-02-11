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
  <div class="card-glass"></div>
  <div class="card-content">
    <div class="icon-section">
      <div class="icon-glow" class:active={isHovered}></div>
      <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    </div>
    
    <div class="text-section">
      <span class="label">Panel de Control</span>
      <span class="status">SISTEMA ONLINE</span>
    </div>

    <div class="arrow-section">
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="3" fill="none">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>
  </div>
  
  {#if isHovered}
    <div class="scan-line" in:fly={{ y: -20, duration: 1000 }} out:fade></div>
  {/if}
</a>

<style>
  .admin-access-card {
    display: block;
    position: relative;
    width: 100%;
    margin-bottom: 1.5rem;
    text-decoration: none;
    color: #fff;
    border-radius: 18px;
    overflow: hidden;
    background: rgba(255, 68, 68, 0.05);
    border: 1px solid rgba(255, 68, 68, 0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .admin-access-card:hover, .admin-access-card:active {
    background: rgba(255, 68, 68, 0.1);
    border-color: rgba(255, 68, 68, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(255, 68, 68, 0.15);
  }

  .admin-access-card:active {
    transform: scale(0.98);
  }

  .card-glass {
    position: absolute;
    inset: 0;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 1;
  }

  .card-content {
    position: relative;
    z-index: 2;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  @media (max-width: 600px) {
    .card-content {
      padding: 1rem;
    }
    .label {
      font-size: 0.75rem;
    }
    .status {
      font-size: 0.6rem;
    }
  }

  .icon-section {
    position: relative;
    width: 44px;
    height: 44px;
    background: rgba(255, 68, 68, 0.15);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ff4444;
    flex-shrink: 0;
  }

  .icon-glow {
    position: absolute;
    inset: 0;
    background: #ff4444;
    filter: blur(15px);
    opacity: 0;
    transition: opacity 0.3s;
    border-radius: 12px;
  }

  .icon-glow.active {
    opacity: 0.4;
  }

  .text-section {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .label {
    font-size: 0.85rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .status {
    font-size: 0.65rem;
    font-weight: 700;
    color: #ff4444;
    opacity: 0.8;
    font-family: monospace;
  }

  .arrow-section {
    color: #ff4444;
    opacity: 0.5;
    transition: transform 0.3s;
  }

  .admin-access-card:hover .arrow-section {
    transform: translateX(4px);
    opacity: 1;
  }

  .scan-line {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
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