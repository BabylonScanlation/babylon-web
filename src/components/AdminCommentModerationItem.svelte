<script lang="ts">
import { slide } from 'svelte/transition';
import { toast } from '../lib/toastStore';

interface Props {
  commentId: number;
  userEmail: string;
  text: string;
  targetType: 'series' | 'chapter';
  seriesTitle?: string;
  createdAt?: string;
}

let {
  commentId,
  userEmail,
  text,
  targetType,
  seriesTitle = 'Contenido',
  createdAt,
}: Props = $props();

let deleteState = $state<'idle' | 'confirm' | 'deleting'>('idle');
let deleteTimeout: ReturnType<typeof setTimeout> | undefined;
let isRemoved = $state(false);

function getUsername(email: string) {
  return (email || 'usuario@anonimo').split('@')[0];
}

function getInitial(email: string) {
  return email.charAt(0).toUpperCase();
}

async function handleDelete() {
  if (deleteState === 'idle') {
    deleteState = 'confirm';
    clearTimeout(deleteTimeout);
    deleteTimeout = setTimeout(() => (deleteState = 'idle'), 4000);
    return;
  }

  if (deleteState === 'confirm') {
    deleteState = 'deleting';
    const url = targetType === 'series' ? '/api/comments/series/delete' : '/api/comments/delete';

    const formData = new FormData();
    formData.append('commentId', commentId.toString());

    try {
      const res = await fetch(url, { method: 'POST', body: formData });
      if (res.ok) {
        isRemoved = true;
        toast.success('Comentario erradicado');
      } else {
        throw new Error();
      }
    } catch {
      toast.error('Error en los sistemas de eliminación');
      deleteState = 'idle';
    }
  }
}
</script>

{#if !isRemoved}
  <div 
    class="moderation-card" 
    class:is-confirming={deleteState === 'confirm'}
    class:is-deleting={deleteState === 'deleting'}
    transition:slide={{ duration: 400 }}
  >
    <div class="card-glow"></div>
    
    <div class="card-inner">
      <!-- User Side -->
      <aside class="user-meta">
        <div class="avatar-box">
          <div class="avatar-circle">{getInitial(userEmail)}</div>
          <div class="status-dot online"></div>
        </div>
      </aside>

      <!-- Content Side -->
      <main class="content-area">
        <header class="content-header">
          <div class="user-info">
            <span class="username">@{getUsername(userEmail)}</span>
            <span class="timestamp">{createdAt || 'Recientemente'}</span>
          </div>
          <div class="target-badge" class:is-chapter={targetType === 'chapter'}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
              {#if targetType === 'series'}
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              {:else}
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
              {/if}
            </svg>
            <span>{seriesTitle}</span>
          </div>
        </header>

        <div class="text-body">
          <p>{text}</p>
        </div>

        <footer class="card-footer">
          <div class="quick-tags">
            <span class="tag">#ID-{commentId}</span>
            <span class="tag">{targetType === 'series' ? 'Serie' : 'Capítulo'}</span>
          </div>
          
          <div class="actions">
            <button 
              class="action-btn delete" 
              class:confirm={deleteState === 'confirm'}
              onclick={handleDelete}
              disabled={deleteState === 'deleting'}
            >
              <div class="btn-bg"></div>
              {#if deleteState === 'idle'}
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
                <span>Eliminar</span>
              {:else if deleteState === 'confirm'}
                <span class="alert-text">¿ESTÁS SEGURO?</span>
              {:else}
                <div class="loader-dots"><span></span><span></span><span></span></div>
              {/if}
            </button>
          </div>
        </footer>
      </main>
    </div>
  </div>
{/if}

<style>
  .moderation-card {
    position: relative;
    background: #111;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 20px;
    margin-bottom: 1.5rem;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .moderation-card:hover {
    transform: translateX(5px);
    border-color: rgba(255, 255, 255, 0.1);
    background: #141414;
  }

  .moderation-card.is-confirming {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.02);
    transform: scale(1.01) translateX(0);
  }

  .card-glow {
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: var(--accent-color);
    opacity: 0.3;
  }

  .is-confirming .card-glow {
    background: #ef4444;
    opacity: 1;
    box-shadow: 0 0 15px rgba(239, 68, 68, 0.5);
  }

  .card-inner {
    display: flex;
    padding: 1.5rem;
    gap: 1.5rem;
  }

  /* User Side */
  .user-meta {
    flex-shrink: 0;
  }

  .avatar-box {
    position: relative;
    width: 48px;
    height: 48px;
  }

  .avatar-circle {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #222 0%, #333 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    color: var(--accent-color);
    font-size: 1.2rem;
  }

  .status-dot {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 12px;
    height: 12px;
    background: #10b981;
    border: 3px solid #111;
    border-radius: 50%;
  }

  /* Content Area */
  .content-area {
    flex: 1;
    min-width: 0;
  }

  .content-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    gap: 1rem;
  }

  .user-info {
    display: flex;
    flex-direction: column;
  }

  .username {
    font-size: 0.95rem;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.01em;
  }

  .timestamp {
    font-size: 0.75rem;
    color: #555;
    font-weight: 600;
  }

  .target-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    font-size: 0.7rem;
    font-weight: 700;
    color: #888;
    max-width: 150px;
  }

  .target-badge span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .target-badge.is-chapter {
    color: var(--accent-color);
    background: rgba(0, 191, 255, 0.05);
    border-color: rgba(0, 191, 255, 0.1);
  }

  .text-body {
    background: rgba(0, 0, 0, 0.2);
    padding: 1rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.02);
    margin-bottom: 1.5rem;
  }

  .text-body p {
    margin: 0;
    font-size: 0.95rem;
    color: #ccc;
    line-height: 1.6;
    word-break: break-word;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .quick-tags {
    display: flex;
    gap: 0.5rem;
  }

  .tag {
    font-size: 0.65rem;
    font-weight: 800;
    color: #444;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Actions */
  .action-btn {
    position: relative;
    border: none;
    background: transparent;
    padding: 0.6rem 1.2rem;
    border-radius: 100px;
    color: #666;
    font-weight: 800;
    font-size: 0.75rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    transition: all 0.3s;
    overflow: hidden;
  }

  .action-btn.delete:hover {
    color: #ef4444;
  }

  .action-btn.delete.confirm {
    background: #ef4444;
    color: #fff;
    box-shadow: 0 5px 15px rgba(239, 68, 68, 0.3);
  }

  .alert-text {
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .loader-dots {
    display: flex;
    gap: 4px;
  }

  .loader-dots span {
    width: 4px;
    height: 4px;
    background: currentColor;
    border-radius: 50%;
    animation: dot-wave 1s infinite;
  }

  .loader-dots span:nth-child(2) { animation-delay: 0.2s; }
  .loader-dots span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes dot-wave {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }

  @media (max-width: 600px) {
    .card-inner { flex-direction: column; padding: 1rem; }
    .content-header { flex-direction: column; align-items: flex-start; }
    .target-badge { max-width: 100%; width: 100%; }
    .actions { width: 100%; }
    .action-btn { width: 100%; justify-content: center; }
  }
</style>