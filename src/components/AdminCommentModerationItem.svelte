<script lang="ts">
import { actions } from 'astro:actions';
import { slide as _slide } from 'svelte/transition';
import { toast } from '../lib/stores.svelte';

interface Props {
  commentId: number;
  userEmail: string;
  userName?: string;
  text: string;
  targetType: 'series' | 'chapter' | 'news';
  seriesSlug?: string;
  chapterId?: number | null;
  seriesTitle?: string;
  createdAt?: string;
}

let {
  commentId,
  userEmail: _userEmail,
  userName: _userName,
  text: _text,
  targetType,
  seriesSlug: _seriesSlug,
  chapterId: _chapterId,
  seriesTitle: _seriesTitle = 'Contenido',
  createdAt: _createdAt,
}: Props = $props();

const _commentUrl = $derived.by(() => {
  if (targetType === 'chapter' && _seriesSlug) {
    return `/series/${_seriesSlug}/chapter-${_chapterId}#comment-${commentId}`;
  }
  if (targetType === 'series' && _seriesSlug) {
    return `/series/${_seriesSlug}#comment-${commentId}`;
  }
  if (targetType === 'news' && _seriesSlug) {
    return `/news/${_seriesSlug}#comment-${commentId}`;
  }
  return null;
});

let deleteState = $state<'idle' | 'confirm' | 'deleting'>('idle');
let deleteTimeout: ReturnType<typeof setTimeout> | undefined;
let _isRemoved = $state(false);

function _getDisplayName() {
  if (_userName) return _userName;
  return (_userEmail || 'usuario@anonimo').split('@')[0];
}

function _getInitial() {
  if (_userName) return _userName.charAt(0).toUpperCase();
  return (_userEmail || '?').charAt(0).toUpperCase();
}

async function _handleDelete() {
  if (deleteState === 'idle') {
    deleteState = 'confirm';
    clearTimeout(deleteTimeout);
    deleteTimeout = setTimeout(() => (deleteState = 'idle'), 4000);
    return;
  }

  if (deleteState === 'confirm') {
    deleteState = 'deleting';

    try {
      const { error } = await actions.comments.delete({
        targetType,
        commentId,
      });

      if (!error) {
        _isRemoved = true;
        toast.success('Comentario erradicado');
      } else {
        throw new Error(error.message);
      }
    } catch (e: unknown) {
      const error = e as Error;
      toast.error(`Error al eliminar: ${error.message}`);
      deleteState = 'idle';
    }
  }
}
</script>

{#if !_isRemoved}
  <div class="moderation-item" transition:_slide>
    <div class="item-header">
      <div class="user-info">
        <div class="mini-avatar">
          {_getInitial()}
        </div>
        <div class="user-details">
          <span class="username">{_getDisplayName()}</span>
          <span class="email">{_userEmail}</span>
        </div>
      </div>
      <div class="meta-info">
        <span class="target-badge" class:chapter={targetType === 'chapter'}>
          {targetType === 'chapter' ? 'Capítulo' : (targetType === 'news' ? 'Noticia' : 'Serie')}
        </span>
        {#if _createdAt}
          {@const date = new Date(_createdAt)}
          {#if !isNaN(date.getTime())}
            <span class="date">{date.toLocaleDateString('es-ES')}</span>
          {/if}
        {/if}
      </div>
    </div>

    <div class="item-content">
      <p class="comment-text">{_text}</p>
      <div class="context-info">
        En: <strong>{_seriesTitle}</strong>
      </div>
    </div>

    <div class="item-actions">
      {#if _commentUrl}
        <a href={_commentUrl} target="_blank" class="btn-goto">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
          Ir al mensaje
        </a>
      {/if}
      <button 
        class="btn-delete" 
        class:confirm={deleteState === 'confirm'}
        onclick={_handleDelete}
        disabled={deleteState === 'deleting'}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        {deleteState === 'confirm' ? '¿Confirmar?' : (deleteState === 'deleting' ? 'Borrando...' : 'Eliminar')}
      </button>
    </div>
  </div>
{/if}

<style>
  .moderation-item {
    background: #111;
    border: 1px solid #222;
    border-radius: 16px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    transition: border-color 0.2s;
  }

  .moderation-item:hover { border-color: #333; }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .user-info { display: flex; gap: 0.75rem; align-items: center; }
  .mini-avatar {
    width: 36px;
    height: 36px;
    background: #222;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    color: var(--accent-color);
    font-size: 0.9rem;
  }

  .user-details { display: flex; flex-direction: column; }
  .username { font-weight: 700; color: #fff; font-size: 0.9rem; }
  .email { font-size: 0.75rem; color: #555; }

  .meta-info { display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem; }
  .target-badge {
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    background: rgba(255, 255, 255, 0.05);
    padding: 2px 8px;
    border-radius: 6px;
    color: #888;
  }
  .target-badge.chapter { color: var(--accent-color); background: rgba(0, 191, 255, 0.1); }
  .date { font-size: 0.7rem; color: #444; }

  .item-content {
    background: #000;
    padding: 1rem;
    border-radius: 12px;
    border: 1px solid #111;
  }

  .comment-text { font-size: 0.9rem; line-height: 1.5; color: #ccc; margin: 0 0 0.75rem; word-break: break-word; }
  .context-info { font-size: 0.75rem; color: #555; }
  .context-info strong { color: #888; }

  .item-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
  .btn-delete, .btn-goto {
    background: #222;
    border: none;
    color: #ff4757;
    padding: 0.5rem 1rem;
    border-radius: 10px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
    text-decoration: none;
  }

  .btn-goto { color: var(--accent-color); }
  .btn-goto:hover { background: var(--accent-color); color: #000; }

  .btn-delete:hover { background: #ff4757; color: #fff; }
  .btn-delete.confirm { background: #ffa502; color: #000; }
  .btn-delete:disabled { opacity: 0.5; cursor: wait; }
</style>
