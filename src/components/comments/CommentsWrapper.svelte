<script>
  import { onMount } from 'svelte';

  // Svelte 5 Props
  let { targetType, targetId, initialComments = [], user = null } = $props();

  const COMMENTS_VISIBLE_LIMIT = 5;

  // --- Svelte 5 State ---
  let comments = $state(initialComments.map(comment => ({
    ...comment,
    is_owner: user && user.email === comment.user_email,
    is_editing: false,
    edited_text: comment.comment_text
  })));
  let commentText = $state('');
  let errorMessage = $state('');
  let actionMessage = $state({ type: '', text: '' });
  let showDeleteConfirmId = $state(null);
  let isSubmittingComment = $state(false);
  let isDeletingCommentId = $state(null);
  let isSavingEditId = $state(null);
  let showAllComments = $state(false);
  let activeMenuCommentId = $state(null);

  // --- Derived State ---
  let charCounter = $derived(`${commentText.length}/1000`);
  let visibleComments = $derived(showAllComments ? comments : comments.slice(0, COMMENTS_VISIBLE_LIMIT));

  // --- Event Handlers ---
  const formatCommentDateClient = (dateString) => {
    if (!dateString) return 'Fecha inválida';
    return new Date(dateString).toLocaleString('es-ES', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    isSubmittingComment = true;
    actionMessage = { type: '', text: '' };
    const text = commentText.trim();
    if (!text || !targetId) {
        errorMessage = 'El comentario no puede estar vacío.';
        isSubmittingComment = false;
        return;
    }
    errorMessage = '';

    const apiUrl = targetType === 'chapter' ? '/api/comments/add' : `/api/comments/${targetType}/add`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [`${targetType}Id`]: targetId,
          commentText: text,
        }),
      });

      const newCommentData = await response.json();
      if (!response.ok) throw new Error(newCommentData.error || 'Error al publicar.');

      commentText = '';
      comments = [
        { ...newCommentData, is_owner: user && user.email === newCommentData.user_email, is_editing: false, edited_text: newCommentData.comment_text },
        ...comments
      ];
    } catch (err) {
      errorMessage = err.message;
      actionMessage = { type: 'error', text: errorMessage || 'Error al publicar el comentario.' };
    } finally {
      isSubmittingComment = false;
    }
  }

  function handleDelete(commentId) {
    showDeleteConfirmId = commentId;
    activeMenuCommentId = null;
  }

  async function confirmDelete(commentId) {
    isDeletingCommentId = commentId;
    actionMessage = { type: '', text: '' };
    
    const apiUrl = `/api/comments/${targetType}/delete-own`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo eliminar el comentario.');

      comments = comments.filter((c) => c.id !== commentId);
      actionMessage = { type: 'success', text: 'Comentario eliminado con éxito.' };
    } catch (err) {
      actionMessage = { type: 'error', text: err.message || 'Error al eliminar el comentario.' };
    } finally {
      isDeletingCommentId = null;
      showDeleteConfirmId = null;
    }
  }

  function cancelDelete() {
    showDeleteConfirmId = null;
  }

  function startEditing(comment) {
    comment.is_editing = true;
    activeMenuCommentId = null;
  }

  function cancelEditing(comment) {
    comment.is_editing = false;
    comment.edited_text = comment.comment_text;
  }

  async function handleSave(comment) {
    isSavingEditId = comment.id;
    actionMessage = { type: '', text: '' };

    const newCommentText = comment.edited_text.trim();
    if (newCommentText === comment.comment_text || !newCommentText) {
      cancelEditing(comment);
      isSavingEditId = null;
      return;
    }

    const apiUrl = `/api/comments/${targetType}/edit`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: comment.id, commentText: newCommentText }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo editar el comentario.');

      comment.comment_text = result.comment_text;
      comment.is_editing = false;
      actionMessage = { type: 'success', text: 'Comentario editado con éxito.' };
    } catch (err) {
       actionMessage = { type: 'error', text: err.message || 'Error al editar el comentario.' };
    } finally {
      isSavingEditId = null;
    }
  }

  function toggleMenu(commentId) {
    if (activeMenuCommentId === commentId) {
      activeMenuCommentId = null;
    } else {
      activeMenuCommentId = commentId;
    }
  }
</script>

<section class="comments-section">
  <div class="comments-header">
    <h3>
      Comentarios {targetType === 'series' ? 'de la Serie' : 'del Capítulo'} ({comments.length})
    </h3>
    {#if comments.length > COMMENTS_VISIBLE_LIMIT}
      <div class="read-more-container">
        <button class="read-more-btn" onclick={() => showAllComments = !showAllComments}>
          {showAllComments ? 'Ver menos comentarios' : 'Ver todos los comentarios'}
        </button>
      </div>
    {/if}
  </div>

  {#if user}
    <form class="comment-form" onsubmit={handleSubmit}>
      <textarea
        placeholder={targetType === 'series' ? 'Escribe tu comentario sobre la serie...' : 'Escribe tu comentario aquí...'}
        required
        minlength="1"
        maxlength="1000"
        bind:value={commentText}
      />
      <div class="comment-form-actions">
        <span>{charCounter}</span>
        <button type="submit" disabled={isSubmittingComment}>Publicar</button>
      </div>
      {#if errorMessage}
        <p class="comment-error">{errorMessage}</p>
      {/if}
    </form>
    {#if actionMessage.text}
      <p class="action-message" class:success={actionMessage.type === 'success'} class:error={actionMessage.type === 'error'}>
        {actionMessage.text}
      </p>
    {/if}
  {:else}
    <p class="comment-login-prompt">
      <button class="link-button" onclick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}>
        Inicia sesión
      </button> para comentar {targetType === 'series' ? 'sobre esta serie' : 'aquí'}.
    </p>
  {/if}

  <div class="comments-list">
    {#if visibleComments.length > 0}
      {#each visibleComments as comment (comment.id)}
        <div class="comment">
          <div class="comment-header">
            <div class="comment-meta">
              <span class="comment-author">{comment.user_email.split('@')[0]}</span>
              <span class="comment-separator">|</span>
              <span class="comment-date">{formatCommentDateClient(comment.created_at)}</span>
            </div>
            {#if comment.is_owner && targetType === 'series'}
              <div class="comment-actions">
                <button class="menu-btn" aria-label="Opciones de comentario" onclick={() => toggleMenu(comment.id)}>•••</button>
                {#if activeMenuCommentId === comment.id}
                  <div class="menu-dropdown">
                    <button class="menu-item" onclick={() => startEditing(comment)}>Editar</button>
                    <button class="menu-item delete-btn" onclick={() => handleDelete(comment.id)}>Eliminar</button>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
          {#if comment.is_editing}
            <div class="edit-container">
              <textarea class="edit-textarea" maxlength="1000" bind:value={comment.edited_text}></textarea>
              <div class="edit-actions">
                  <button class="edit-cancel-btn" onclick={() => cancelEditing(comment)}>Cancelar</button>
                  <button class="edit-save-btn" onclick={() => handleSave(comment)}>Guardar</button>
              </div>
            </div>
          {:else}
            <p class="comment-body">{comment.comment_text}</p>
          {/if}
          {#if showDeleteConfirmId === comment.id}
            <div class="delete-confirm-overlay" onclick={(e) => e.target === e.currentTarget && cancelDelete()}>
              <div class="delete-confirm-dialog">
                <p>¿Estás seguro de que quieres eliminar este comentario?</p>
                <div class="delete-confirm-actions">
                  <button class="confirm-cancel-btn" onclick={cancelDelete}>Cancelar</button>
                  <button class="confirm-delete-btn" onclick={() => confirmDelete(comment.id)} disabled={isDeletingCommentId === comment.id}>
                    {#if isDeletingCommentId === comment.id}
                      Eliminando...
                    {:else}
                      Eliminar
                    {/if}
                  </button>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    {:else}
      <p class="no-comments-message">Aún no hay comentarios. ¡Sé el primero!</p>
    {/if}
  </div>
</section>

<style>
  /* Styles are the same as before */
  .link-button { background: none; border: none; padding: 0; color: var(--accent-color); text-decoration: underline; cursor: pointer; font-size: inherit; font-family: inherit; }
  .comments-section { width: 100%; margin: 0; padding-top: 0.5rem; }
  .comments-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem; }
  .comments-header h3 { margin: 0; font-size: 1.5rem; }
  .comment-form textarea { width: 100%; background: #2a2a2a; border: 1px solid #444; color: var(--font-color); padding: 0.75rem; border-radius: 6px; min-height: 100px; resize: vertical; margin-bottom: 0.5rem; font-family: inherit; font-size: 1rem; }
  .comment-form-actions { display: flex; justify-content: space-between; align-items: center; }
  .comment-form-actions span { font-size: 0.8rem; color: #aaa; }
  .comment-form button[type="submit"] { background-color: var(--accent-color); color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; font-weight: bold; cursor: pointer; transition: background-color 0.2s; }
  .comment-form button[type="submit"]:hover { background-color: #009acd; }
  .comment-error { color: #ff6b6b; font-size: 0.9rem; margin-top: 0.5rem; text-align: right; }
  .comment-login-prompt { text-align: center; color: #aaa; margin: 0; padding: 1rem; background-color: var(--card-background); border-radius: 8px; }
  .comments-list { margin-top: 2rem; display: flex; flex-direction: column; gap: 1rem; }
  .comment { background-color: var(--card-background); padding: 1.25rem; border-radius: 8px; text-align: left; border: 1px solid #2a2a2a; transition: opacity 0.3s ease; }
  .comment-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; gap: 1rem; }
  .comment-meta { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; flex-grow: 1; }
  .comment-author { font-weight: bold; color: #eee; }
  .comment-separator { color: #555; }
  .comment-date { font-size: 0.8rem; color: #888; }
  .comment-body { color: #ddd; line-height: 1.6; white-space: break-word; word-wrap: break-word; padding-left: 0.25rem; }
  .comment-actions { position: relative; flex-shrink: 0; }
  .menu-btn { background: none; border: none; color: #888; cursor: pointer; font-size: 1.2rem; font-weight: bold; line-height: 1; padding: 0.25rem 0.5rem; border-radius: 4px; }
  .menu-btn:hover { background-color: #333; color: #fff; }
  .menu-dropdown { position: absolute; top: 100%; right: 0; background-color: #2a2a2a; border: 1px solid #444; border-radius: 6px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3); z-index: 10; padding: 0.5rem 0; width: 120px; }
  .menu-item { display: block; width: 100%; background: none; border: none; color: #ddd; padding: 0.5rem 1rem; text-align: left; cursor: pointer; font-size: 0.9rem; }
  .menu-item:hover { background-color: var(--accent-color); color: white; }
  .menu-item.delete-btn { color: #ff6b6b; }
  .menu-item.delete-btn:hover { background-color: #c0392b; color: white; }
  .edit-container { display: flex; flex-direction: column; gap: 0.5rem; }
  .edit-textarea { width: 100%; background: #3a3a3a; border: 1px solid #555; color: var(--font-color); padding: 0.5rem; border-radius: 4px; min-height: 80px; resize: vertical; font-family: inherit; font-size: 0.95rem; }
  .edit-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
  .edit-actions button { padding: 0.25rem 0.75rem; border-radius: 4px; font-weight: bold; cursor: pointer; border: none; font-size: 0.8rem; }
  .edit-cancel-btn { background-color: #555; color: white; }
  .edit-save-btn { background-color: var(--accent-color); color: white; }
  .edit-error { color: #ff6b6b; font-size: 0.8rem; text-align: right; }
  .no-comments-message { font-style: italic; color: #888; }
  .read-more-container { text-align: right; }
  .read-more-btn { background-color: #333; color: var(--font-color); padding: 0.5rem 1.5rem; border: 1px solid #555; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
  .read-more-btn:hover { background-color: #444; }
          .action-message {
            margin-top: 1rem;
            padding: 0.75rem 1rem;
            border-radius: 6px;
            font-size: 0.9rem;
            font-weight: bold;
            text-align: center;
          }
          .action-message.success {
            background-color: #28a745;
            color: white;
          }
          .action-message.error {
            background-color: #dc3545;
            color: white;
          }
          .delete-confirm-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
          }
          .delete-confirm-dialog {
            background-color: var(--card-background);
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            max-width: 400px;
            text-align: center;
            color: var(--font-color);
          }
          .delete-confirm-dialog p {
            margin-bottom: 1.5rem;
            font-size: 1.1rem;
          }
          .delete-confirm-actions {
            display: flex;
            justify-content: center;
            gap: 1rem;
          }
          .confirm-cancel-btn,
          .confirm-delete-btn {
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            border: none;
            font-size: 1rem;
            transition: background-color 0.2s;
          }
          .confirm-cancel-btn {
            background-color: #555;
            color: white;
          }
          .confirm-cancel-btn:hover {
            background-color: #777;
          }
          .confirm-delete-btn {
            background-color: #dc3545;
            color: white;
          }
          .confirm-delete-btn:hover {
            background-color: #c82333;
          }
          .confirm-delete-btn:disabled {
            background-color: #6c757d;
            cursor: not-allowed;
          }
        </style>