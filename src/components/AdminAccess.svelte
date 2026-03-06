<script lang="ts">
</script>

<a 
  href="/admin" 
  class="admin-access-card" 
>
  <div class="card-glow"></div>
  <div class="icon-area">
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  </div>
  <div class="text-area">
    <span class="label">Panel de Control</span>
    <span class="desc">Administrar contenidos</span>
  </div>
  
  <div class="external-icon">
    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="11" x2="21" y2="3"></line></svg>
  </div>
</a>

<style>
  .admin-access-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.5rem;
    background: rgba(0, 191, 255, 0.03);
    border: 1px solid rgba(0, 191, 255, 0.15);
    border-radius: 24px;
    text-decoration: none;
    color: #fff;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    overflow: hidden;
    margin-bottom: 1.5rem;
    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
  }

  .admin-access-card:hover {
    background: rgba(0, 191, 255, 0.08);
    border-color: var(--accent-color);
    transform: translateY(-5px) scale(1.02);
    box-shadow: 0 20px 40px -15px rgba(0, 191, 255, 0.2);
  }

  .card-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, rgba(0, 191, 255, 0.15) 0%, transparent 70%);
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  .admin-access-card:hover .card-glow { opacity: 1; }

  .icon-area {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: #000;
    color: var(--accent-color);
    border-radius: 14px;
    border: 1px solid rgba(0, 191, 255, 0.2);
    transition: all 0.4s;
    flex-shrink: 0;
    box-shadow: 0 0 15px rgba(0, 191, 255, 0.1);
  }

  .admin-access-card:hover .icon-area {
    transform: rotate(90deg);
    background: var(--accent-color);
    color: #000;
    box-shadow: 0 0 20px rgba(0, 191, 255, 0.4);
  }

  .text-area { display: flex; flex-direction: column; flex: 1; }
  .label { font-size: 1.1rem; font-weight: 900; letter-spacing: -0.02em; color: #fff; }
  .desc { font-size: 0.8rem; color: #888; font-weight: 600; margin-top: 1px; }

  .external-icon {
    opacity: 0.3;
    color: #fff;
    transition: all 0.3s;
    transform: translateX(5px);
  }

  .admin-access-card:hover .external-icon {
    opacity: 1;
    color: var(--accent-color);
    transform: translateX(0);
  }

  @media (max-width: 900px) {
    .admin-access-card {
      margin: 0 0 1rem 0;
      border-radius: 20px;
      padding: 1.25rem;
    }
  }
</style>