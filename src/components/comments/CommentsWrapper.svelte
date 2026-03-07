<script lang="ts">
/* eslint-disable */
import { fade, slide, scale } from 'svelte/transition';
import { elasticOut, quintOut } from 'svelte/easing';
import { actions } from 'astro:actions';
import { onMount } from 'svelte';
import { toast, userStore } from '../../lib/stores.svelte';
import { parseToTimestamp, timeAgo } from '../../lib/utils';
import { siteConfig } from '../../site.config';
import type { Comment, User } from '../../types';

interface Props {
  targetType: 'chapter' | 'series' | 'news';
  targetId: number | string;
  initialComments?: Comment[];
  user?: User | null;
}

let { targetType, targetId, initialComments = [], user: initialUser = null }: Props = $props();

// Orion: Mezclamos datos de SSR con el store reactivo para máxima fluidez y frescura
let user = $derived(userStore.user ? { ...initialUser, ...userStore.user } : initialUser);

const COMMENTS_VISIBLE_LIMIT = 5;

const sortNodes = (nodes: Comment[] | undefined) => {
  if (!nodes || !Array.isArray(nodes)) return;

  const isPinnedRecursive = (node: Comment): boolean => {
    if (node.isPinned) return true;
    if (node.children && node.children.length > 0) {
      return node.children.some((child) => isPinnedRecursive(child));
    }
    return false;
  };

  nodes.sort((a, b) => {
    const aPinned = isPinnedRecursive(a);
    const bPinned = isPinnedRecursive(b);

    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return b.id - a.id;
  });

  nodes.forEach((node) => {
    if (node.children && node.children.length > 0) {
      sortNodes(node.children);
    }
  });
};

function buildCommentTree(flatComments: Comment[]): Comment[] {
  const commentMap = new Map<number, Comment>();
  const roots: Comment[] = [];

  // 1. Fase de Procesamiento Inicial
  flatComments.forEach((c) => {
    const isOwner = !!(user && (user.email === c.userEmail || user.uid === c.userId));
    const processed: Comment = {
      ...c,
      isOwner,
      isEditing: false,
      editedText: c.isDeleted ? '' : c.commentText,
      showSpoiler: Boolean(c.showSpoiler),
      username: c.username || 'Usuario',
      avatarUrl: (isOwner && user ? user.avatarUrl || c.avatarUrl : c.avatarUrl) || '',
      isDeleted: Boolean(c.isDeleted),
      isAdminComment: Boolean(c.isAdminComment),
      isPinned: Boolean(c.isPinned),
      isSpoiler: Boolean(c.isSpoiler),
      children: [],
    };
    commentMap.set(c.id, processed);
  });

  // 2. Construcción del Árbol con Detección de Ciclos Exhaustiva
  flatComments.forEach((c) => {
    const processed = commentMap.get(c.id)!;

    if (c.parentId && commentMap.has(c.parentId)) {
      // Orion: Verificar si el padre es un ancestro (evita ciclos de cualquier longitud)
      let isCycle = false;
      let currentParentId: number | null = c.parentId;
      const visited = new Set<number>([c.id]);

      while (currentParentId !== null) {
        if (visited.has(currentParentId)) {
          isCycle = true;
          break;
        }
        visited.add(currentParentId);
        const nextParent = commentMap.get(currentParentId);
        currentParentId = nextParent?.parentId || null;
      }

      if (!isCycle) {
        commentMap.get(c.parentId)?.children?.push(processed);
      } else {
        roots.push(processed); // Si hay ciclo, lo tratamos como raíz para no perder el dato pero romper el bucle
      }
    } else {
      roots.push(processed);
    }
  });

  sortNodes(roots);
  return roots;
}

let comments = $state<Comment[]>([]);

// Astra: Sincronización robusta. Usamos una variable local para evitar bucles.
let lastProcessedId = $state<string | number | null>(null);

$effect(() => {
  if (targetId && targetId !== lastProcessedId) {
    const safeComments = initialComments && Array.isArray(initialComments) ? initialComments : [];
    comments = buildCommentTree(safeComments);
    lastProcessedId = targetId;
  }
});

let commentText = $state('');
let replyText = $state('');
let replyToId = $state<number | null>(null);
let showDeleteConfirmId = $state<number | null>(null);
let isSubmittingComment = $state(false);
let isDeletingCommentId = $state<number | null>(null);
let isSavingEditId = $state<number | null>(null);
let showAllComments = $state(false);

let expandedThreads = $state(new Set<number>());

function toggleThread(id: number) {
  if (expandedThreads.has(id)) {
    expandedThreads.delete(id);
  } else {
    expandedThreads.add(id);
  }
  expandedThreads = new Set(expandedThreads); // Trigger reactivity
}

let cooldownRemaining = $state(0);

// Orion: Recuperar cooldown persistente inmediatamente al cargar el script
if (typeof window !== 'undefined') {
  const lastCommentTime = localStorage.getItem(`${siteConfig.storage.prefix}last_comment_ts`);
  if (lastCommentTime) {
    const elapsed = Math.floor((Date.now() - parseInt(lastCommentTime, 10)) / 1000);
    if (elapsed < 30) {
      cooldownRemaining = 30 - elapsed;
      const timer = setInterval(() => {
        cooldownRemaining--;
        if (cooldownRemaining <= 0) {
          clearInterval(timer);
          localStorage.removeItem(`${siteConfig.storage.prefix}last_comment_ts`);
        }
      }, 1000);
    } else {
      localStorage.removeItem(`${siteConfig.storage.prefix}last_comment_ts`);
    }
  }
}

let isFocused = $state(false);
let votingIds = $state(new Set<number>());

async function handleVote(comment: Comment, voteValue: number) {
  if (!user) return toast.error('Inicia sesión para votar');
  if (votingIds.has(comment.id)) return;

  votingIds.add(comment.id);

  const previousVote = comment.userVote || 0;
  const previousLikes = comment.likes || 0;
  const previousDislikes = comment.dislikes || 0;

  let newVote = voteValue;
  if (previousVote === voteValue) newVote = 0;

  comment.userVote = newVote;

  if (previousVote === 1) comment.likes = Math.max(0, (comment.likes || 0) - 1);
  if (previousVote === -1) comment.dislikes = Math.max(0, (comment.dislikes || 0) - 1);

  if (newVote === 1) comment.likes = (comment.likes || 0) + 1;
  if (newVote === -1) comment.dislikes = (comment.dislikes || 0) + 1;

  try {
    const { error } = await actions.comments.vote({
      targetType,
      commentId: comment.id,
      voteType: newVote === 1 ? 'up' : 'down',
    });

    if (error) {
      if (error.code === 'UNAUTHORIZED') {
        userStore.sync();
        throw new Error('Sesión expirada');
      }
      throw new Error(error.message);
    }

    // Orion: Forzamos la reactividad en Svelte 5 reasignando el array
    comments = [...comments];

    setTimeout(() => {
      votingIds.delete(comment.id);
    }, 500);
  } catch (e: any) {
    comment.userVote = previousVote;
    comment.likes = previousLikes;
    comment.dislikes = previousDislikes;
    votingIds.delete(comment.id);
    toast.error(e.message || 'Error al votar');
  }
}

onMount(() => {
  // Orion: Sincronizar store al montar
  if (userStore.user) {
    userStore.sync();
  }

  // Astra: Asegurar sincronización inicial en navegación
  if (initialComments && comments.length === 0) {
    const tree = buildCommentTree(initialComments);
    sortNodes(tree);
    comments = tree;
  }

  const handleAuthSuccess = () => {
    // Si el evento de login ocurre, forzamos un refresh del store si fuera necesario
  };
  document.addEventListener('auth-success', handleAuthSuccess);
  return () => document.removeEventListener('auth-success', handleAuthSuccess);
});

let charCounter = $derived(`${commentText.length}/1000`);
let visibleComments = $derived(
  comments && Array.isArray(comments)
    ? showAllComments
      ? comments
      : comments.slice(0, COMMENTS_VISIBLE_LIMIT)
    : []
);

const formatCommentDateClient = (dateVal: any) => {
  const ts = parseToTimestamp(dateVal);
  const label = timeAgo(ts);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const isEdited = (comment: Comment) => {
  const created = parseToTimestamp(comment.createdAt);
  const updated = parseToTimestamp(comment.updatedAt);
  if (created <= 0 || updated <= 0) return false;
  return updated > created + 5000;
};

const getAvatarColor = (identifier: string) => {
  const seed = identifier || 'Anonymous';
  const colors = [
    'linear-gradient(135deg, #FF6B6B, #EE5253)',
    'linear-gradient(135deg, #4ECDC4, #22A6B3)',
    'linear-gradient(135deg, #A29BFE, #6C5CE7)',
    'linear-gradient(135deg, #FD79A8, #E84393)',
    'linear-gradient(135deg, #FDCB6E, #E17055)',
    'linear-gradient(135deg, #6c5ce7, #a29bfe)',
    'linear-gradient(135deg, #00b894, #55efc4)',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string) => (name || '?').substring(0, 1).toUpperCase();

async function handleSubmit(e: Event, parentId: number | null = null) {
  if (e) e.preventDefault();
  if (!user) return toast.error('Inicia sesión para comentar');

  const text = parentId ? replyText : commentText;
  if (!text?.trim()) return;
  if (cooldownRemaining > 0) return toast.warning(`Espera ${cooldownRemaining}s`);

  isSubmittingComment = true;

  try {
    const { data, error } = await actions.comments.add({
      targetType,
      targetId: targetId as any, // Orion: Enviamos el ID tal cual (string para news, number para resto)
      parentId,
      text,
    });

    if (error) {
      if (error.code === 'UNAUTHORIZED') {
        toast.error('Sesión expirada. Por favor, inicia sesión de nuevo.');
        userStore.sync();
        return;
      }
      throw new Error(error.message);
    }

    const processedNew: Comment = {
      ...data,
      commentText: data.text,
      userEmail: user.email || null,
      isOwner: true,
      isNew: true,
      isAdminComment: !!user.isAdmin,
      username: user.username || user.displayName || 'Usuario',
      avatarUrl: user.avatarUrl || undefined,
      children: [],
    };

    if (parentId) {
      const addToTree = (nodes: Comment[]): boolean => {
        for (const node of nodes) {
          if (node.id === parentId) {
            if (!node.children) node.children = [];
            node.children.unshift(processedNew);
            return true;
          }
          if (node.children && addToTree(node.children)) return true;
        }
        return false;
      };
      addToTree(comments);
      replyToId = null;
      replyText = '';
    } else {
      comments = [processedNew, ...comments];
      commentText = '';
      isFocused = false;
    }

    window.dispatchEvent(
      new CustomEvent('comment-count-change', {
        detail: { count: comments.length, targetId, targetType },
      })
    );

    sortNodes(comments);

    // Orion: Guardar timestamp para cooldown persistente
    localStorage.setItem(`${siteConfig.storage.prefix}last_comment_ts`, Date.now().toString());

    cooldownRemaining = 30;
    const timer = setInterval(() => {
      cooldownRemaining--;
      if (cooldownRemaining <= 0) {
        clearInterval(timer);
        localStorage.removeItem(`${siteConfig.storage.prefix}last_comment_ts`);
      }
    }, 1000);
    toast.success('¡Comentario publicado!');
  } catch (err: any) {
    toast.error(err.message || 'Error al publicar');
  } finally {
    isSubmittingComment = false;
  }
}

async function handleSave(comment: Comment) {
  if (!comment.editedText) return;
  isSavingEditId = comment.id;
  try {
    const { error } = await actions.comments.edit({
      targetType,
      commentId: comment.id,
      text: comment.editedText,
    });

    if (error) {
      if (error.code === 'UNAUTHORIZED') {
        toast.error('Sesión expirada');
        userStore.sync();
        return;
      }
      throw new Error(error.message);
    }

    comment.commentText = comment.editedText;
    comment.isEditing = false;
    // Orion: Usamos milisegundos reales (número) para disparar isEdited al instante
    comment.updatedAt = Date.now();
    // Orion: Forzamos reactividad
    comments = [...comments];
    toast.success('Editado correctamente');
  } catch {
    toast.error('Error al editar');
  } finally {
    isSavingEditId = null;
  }
}

async function confirmDelete(commentId: number) {
  isDeletingCommentId = commentId;
  try {
    const { error } = await actions.comments.delete({
      targetType,
      commentId,
    });

    if (error) {
      if (error.code === 'UNAUTHORIZED') {
        toast.error('Sesión expirada');
        userStore.sync();
        return;
      }
      throw new Error(error.message);
    }

    const updateInTree = (nodes: Comment[]) => {
      for (const node of nodes) {
        if (node.id === commentId) {
          node.isDeleted = true;
          // Orion: Preservamos los estados de identidad y novedad
          const wasNew = node.isNew;
          const wasOwner = node.isOwner;
          const wasAdmin = node.isAdminComment;

          if (!user?.isAdmin) {
            node.commentText = '[Comentario eliminado]';
            node.username = 'Usuario';
            node.avatarUrl = undefined;
          }

          // Reforzamos la permanencia de los badges
          node.isNew = wasNew;
          node.isOwner = wasOwner;
          node.isAdminComment = wasAdmin;
          return;
        }
        if (node.children) updateInTree(node.children);
      }
    };
    updateInTree(comments);
    // Orion: Forzamos re-asignación para disparar la reactividad de Svelte 5
    comments = [...comments];

    window.dispatchEvent(
      new CustomEvent('comment-count-change', {
        detail: { count: comments.length, targetId, targetType },
      })
    );

    toast.success('Comentario eliminado');
  } catch {
    toast.error('Error al eliminar');
  } finally {
    isDeletingCommentId = null;
    showDeleteConfirmId = null;
  }
}

function toggleReply(id: number) {
  if (replyToId !== id) replyText = '';
  replyToId = replyToId === id ? null : id;
}

async function handleTogglePin(comment: Comment) {
  if (!user?.isAdmin) return;
  const previousState = comment.isPinned;
  const newState = !previousState;
  comment.isPinned = newState;
  const treeCopy = [...comments];
  sortNodes(treeCopy);
  comments = treeCopy;

  try {
    const { error } = await actions.comments.pin({
      commentId: comment.id,
      targetType,
      isPinned: newState,
    });

    if (error) throw new Error(error.message);
    toast.success(newState ? 'Comentario fijado' : 'Comentario desfijado');
  } catch {
    comment.isPinned = previousState;
    sortNodes(comments);
    comments = [...comments];
    toast.error('Error al cambiar estado de fijado');
  }
}
</script>

<div class="comments-wrapper">
    {#if !user}
        <div class="guest-prompt" transition:fade>
            <div class="guest-content">
                <span class="guest-icon">👋</span>
                <p>Únete a la conversación</p>
                <button class="login-btn-pulse" onclick={() => window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { view: 'login' } }))}>
                    Iniciar sesión para comentar
                </button>
            </div>
        </div>
    {/if}

    {#if user}
        <form class="compose-card" onsubmit={handleSubmit} class:focused={isFocused} transition:slide>
            <div class="avatar-area">
                 {#if user.avatarUrl}
                    <img src={user.avatarUrl} alt="Yo" class="avatar-img" />
                 {:else}
                    <div class="avatar-placeholder" style="background: {getAvatarColor(user.uid || user.email || 'U')}">
                        {getInitials(user.username || user.displayName || user.email || 'U')}
                    </div>
                 {/if}
            </div>
            <div class="input-area">
                <div class="textarea-wrapper">
                    <label for="main-comment-input" class="sr-only">Escribe un comentario</label>
                    <textarea
                        id="main-comment-input"
                        name="commentText"
                        bind:value={commentText}
                        placeholder="Comparte tus pensamientos..."
                        rows={isFocused || commentText.length > 0 ? 3 : 1}
                        maxlength="1000"
                        onfocus={() => isFocused = true}
                        onblur={() => {
                            setTimeout(() => {
                                if (document.activeElement?.className !== 'submit-btn') {
                                    isFocused = commentText.length > 0;
                                }
                            }, 100);
                        }}
                    ></textarea>
                    <div class="focus-line"></div>
                </div>

                {#if isFocused || commentText.length > 0}
                    <div class="toolbar" transition:slide={{ duration: 300, easing: quintOut }}>
                        <span class="chars {commentText.length > 900 ? 'warn' : ''}">{charCounter}</span>
                        <button type="submit" class="submit-btn" disabled={isSubmittingComment || !commentText.trim() || cooldownRemaining > 0}>
                            {#if isSubmittingComment}
                                <span class="spinner-sm"></span>
                            {:else}
                                {cooldownRemaining > 0 ? `Espera ${cooldownRemaining}s` : 'Publicar'}
                            {/if}
                        </button>
                    </div>
                {/if}
            </div>
        </form>
    {/if}

    <div class="comments-stream">
        {#snippet commentNode(node: Comment, level: number = 0)}
            <div class="comment-container" class:has-children={node.children && node.children.length > 0} transition:fade={{ duration: 300 }}>
                <div class="comment-card" class:new={node.isNew} class:deleted={node.isDeleted} class:pinned={node.isPinned}>
                    <div class="card-left">
                        <div class="avatar-wrapper">
                            {#if node.isDeleted && !user?.isAdmin}
                                <div class="avatar-placeholder" style="background: #333">?</div>
                            {:else}
                                <a href={`/u/${node.username}`} class="avatar-link">
                                    {#if node.avatarUrl && node.avatarUrl.length > 5}
                                        <img src={node.avatarUrl} alt={node.username} class="avatar-img" loading="lazy" />
                                    {:else}
                                        <div class="avatar-placeholder" style="background: {getAvatarColor(node.userId || node.username || 'A')}">
                                            {getInitials(node.username || 'A')}
                                        </div>
                                    {/if}
                                </a>
                            {/if}
                        </div>
                        {#if node.children && node.children.length > 0}
                            <div class="thread-line-connector"></div>
                        {/if}
                    </div>

                    <div class="card-content">
                        <div class="card-header">
                            <div class="user-meta">
                                {#if node.isDeleted}
                                    <span class="username deleted-name">{node.username}</span>
                                {:else}
                                    <a href={`/u/${node.username}`} class="username-link">
                                        <span class="username">{node.username}</span>
                                    </a>
                                {/if}
                                {#if node.isOwner}<span class="badge-owner">Autor</span>{/if}
                                {#if node.isAdminComment}<span class="badge-admin">
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="margin-right: 2px;"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"></path></svg>
                                    Staff
                                </span>{/if}
                                {#if node.isNew}<span class="badge-new">Nuevo</span>{/if}
                                {#if node.isPinned}<span class="badge-pinned">
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="margin-right: 2px;"><path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"></path></svg>
                                    Fijado
                                </span>{/if}
                                {#if node.isDeleted && user?.isAdmin}
                                    <span class="badge-deleted-admin">
                                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 2px;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        Eliminado (Admin)
                                    </span>
                                {/if}
                            </div>
                            <div class="meta-right">
                                <span class="time-ago">
                                    {formatCommentDateClient(node.createdAt)}
                                </span>
                                {#if isEdited(node) && !node.isDeleted}
                                    <span class="edited-badge" title={`Original: ${formatCommentDateClient(node.createdAt)}`}>
                                        (editado {timeAgo(node.updatedAt!)})
                                    </span>
                                {/if}
                            </div>
                        </div>

                        {#if node.isEditing}
                            <div class="edit-mode">
                                <label for={`edit-input-${node.id}`} class="sr-only">Editar comentario</label>
                                <textarea 
                                    id={`edit-input-${node.id}`}
                                    name={`editedText_${node.id}`}
                                    bind:value={node.editedText} 
                                    class="edit-textarea"
                                ></textarea>
                                <div class="edit-actions">
                                    <button class="btn-text cancel" onclick={() => node.isEditing = false}>Cancelar</button>
                                    <button class="btn-primary-sm" onclick={() => handleSave(node)} disabled={isSavingEditId === node.id}>
                                        {isSavingEditId === node.id ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            </div>
                        {:else}
                            <p class="comment-body" class:deleted-text={node.isDeleted}>{node.commentText}</p>
                        {/if}

                        <div class="card-actions">
                            <div class="vote-group">
                                <button class="vote-btn up" class:active={node.userVote === 1} onclick={() => handleVote(node, 1)} aria-label="Like">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                                    <span class="vote-count">{node.likes || 0}</span>
                                </button>
                                <button class="vote-btn down" class:active={node.userVote === -1} onclick={() => handleVote(node, -1)} aria-label="Dislike">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>
                                    <span class="vote-count">{node.dislikes || 0}</span>
                                </button>
                            </div>

                            {#if !node.isEditing && !node.isDeleted}
                                <span class="action-divider"></span>
                                <div class="action-buttons-group">
                                    {#if level < 9}
                                        <button 
                                            class="action-btn reply" 
                                            onclick={() => { 
                                                if (!user) return toast.error('Inicia sesión para responder');
                                                toggleReply(node.id); 
                                            }}
                                        >
                                            <span class="btn-icon">
                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                            </span>
                                            <span class="btn-label">Responder</span>
                                        </button>
                                    {/if}

                                    {#if node.isOwner}
                                        {#if level < 9}<span class="bullet-sep">•</span>{/if}
                                        <button 
                                            class="action-btn" 
                                            onclick={() => { node.isEditing = true; node.editedText = node.commentText; }}
                                        >
                                            <span class="btn-icon">
                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            </span>
                                            <span class="btn-label">Editar</span>
                                        </button>

                                        <span class="bullet-sep">•</span>
                                        <button 
                                            class="action-btn danger" 
                                            onclick={() => { showDeleteConfirmId = node.id; }}
                                        >
                                            <span class="btn-icon">
                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </span>
                                            <span class="btn-label">Eliminar</span>
                                        </button>
                                    {/if}

                                    {#if user?.isAdmin}
                                        <span class="bullet-sep">•</span>
                                        <button 
                                            class="action-btn pin" 
                                            onclick={() => handleTogglePin(node)}
                                        >
                                            <span class="btn-icon">
                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"></path></svg>
                                            </span>
                                            <span class="btn-label">{node.isPinned ? 'Desfijar' : 'Fijar'}</span>
                                        </button>
                                    {/if}
                                </div>
                            {/if}
                        </div>

                        {#if replyToId === node.id && level < 9}
                            <div class="reply-input-box">
                                <div class="reply-header">
                                    <span class="replying-to">Respondiendo a <strong>{node.username}</strong></span>
                                    <button class="btn-close-sm" onclick={() => replyToId = null}>✕</button>
                                </div>
                                <div class="reply-body">
                                    <label for={`reply-input-${node.id}`} class="sr-only">Escribe tu respuesta</label>
                                    <textarea
                                        id={`reply-input-${node.id}`}
                                        name={`replyText_${node.id}`}
                                        bind:value={replyText}
                                        placeholder="Escribe tu respuesta..."
                                        rows="2"
                                        maxlength="1000"
                                        oninput={(e) => {
                                            const target = e.currentTarget as HTMLTextAreaElement;
                                            target.style.height = 'auto';
                                            target.style.height = target.scrollHeight + 'px';
                                        }}
                                    ></textarea>
                                </div>
                                <div class="reply-footer">
                                    <span class="chars {replyText.length > 900 ? 'warn' : ''}">{replyText.length}/1000</span>
                                    <div class="reply-actions-btns">
                                        <button class="btn-text cancel" onclick={() => replyToId = null}>Cancelar</button>
                                        <button class="btn-primary-sm" onclick={(e) => handleSubmit(e, node.id)} disabled={isSubmittingComment || !replyText.trim()}>
                                            {isSubmittingComment ? '...' : 'Responder'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>

                {#if node.children && node.children.length > 0}
                    {@const isExpanded = expandedThreads.has(node.id)}
                    {@const autoExpand = level === 0 && node.children.length <= 2}
                    
                    {#if !isExpanded && !autoExpand}
                        <div class="thread-expand-wrapper">
                            <button class="btn-expand-thread" onclick={() => toggleThread(node.id)}>
                                <span class="expand-icon">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 13l5 5 5-5M7 6l5 5 5-5"/></svg>
                                </span>
                                {node.children.length === 1 ? 'Ver 1 respuesta' : `Ver ${node.children.length} respuestas`}
                            </button>
                        </div>
                    {:else}
                        {#if !autoExpand}
                            <div class="thread-expand-wrapper collapse">
                                <button class="btn-expand-thread" onclick={() => toggleThread(node.id)}>
                                    <span class="expand-icon rotate">
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 13l5 5 5-5M7 6l5 5 5-5"/></svg>
                                    </span>
                                    Ocultar respuestas
                                </button>
                            </div>
                        {/if}
                        <div class="replies-tree" transition:slide>
                            {#each node.children as child (child.id)}
                                {#if level < 10 && child.id !== node.id}
                                    {@render commentNode(child, level + 1)}
                                {/if}
                            {/each}
                        </div>
                    {/if}
                {/if}
            </div>
        {/snippet}

        {#each visibleComments as comment (comment.id)}
            {@render commentNode(comment)}
        {/each}

        {#if (comments || []).length === 0}
            <div class="empty-state">
                <div class="empty-illustration">💭</div>
                <h3>Sé el primero en comentar</h3>
                <p>Comparte tu opinión sobre este capítulo con la comunidad.</p>
            </div>
        {/if}

        {#if (comments || []).length > COMMENTS_VISIBLE_LIMIT && !showAllComments}
            <div class="load-more-wrapper">
                 <button class="load-more-btn" onclick={() => showAllComments = !showAllComments}>
                    <span class="icon">↓</span>
                    Mostrar {(comments || []).length - COMMENTS_VISIBLE_LIMIT} comentarios más
                 </button>
                 <div class="load-more-line"></div>
            </div>
        {/if}
         {#if showAllComments && (comments || []).length > COMMENTS_VISIBLE_LIMIT}
            <div class="load-more-wrapper">
                 <button class="load-more-btn" onclick={() => showAllComments = !showAllComments}>
                    <span class="icon">↑</span>
                    Ocultar comentarios antiguos
                 </button>
                 <div class="load-more-line"></div>
            </div>
        {/if}
    </div>
</div>

{#if showDeleteConfirmId}
    <div class="modal-overlay" transition:fade={{ duration: 200 }}
        onclick={() => showDeleteConfirmId = null}
        onkeydown={(e) => e.key === 'Escape' && (showDeleteConfirmId = null)}
        role="button"
        tabindex="-1"
    >
        <div class="modal-content" transition:scale={{ duration: 250, start: 0.95, easing: elasticOut }}>
            <div class="modal-icon warning">⚠️</div>
            <h4>¿Eliminar comentario?</h4>
            <p>Esta acción no se puede deshacer y el contenido desaparecerá permanentemente.</p>
            <div class="modal-buttons">
                <button class="btn-modal-cancel" onclick={() => showDeleteConfirmId = null}>Cancelar</button>
                <button class="btn-modal-confirm danger" onclick={() => showDeleteConfirmId && confirmDelete(showDeleteConfirmId)}>
                    {isDeletingCommentId ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    :global(:root) {
        --c-bg-card: #1e1e24;
        --c-bg-card-hover: #25252b;
        --c-bg-input: #15151a;
        --c-border: rgba(255, 255, 255, 0.08);
        --c-border-focus: var(--accent-glow);
        --c-text-primary: #f3f4f6;
        --c-text-secondary: #9ca3af;
        --c-text-tertiary: #6b7280;
        --c-accent: var(--accent-color);
        --c-accent-hover: var(--accent-color);
        --c-danger: #ef4444;
        --thread-line: rgba(255, 255, 255, 0.1);
        --radius-lg: 16px;
        --radius-md: 12px;
        --radius-sm: 8px;
    }

    .comments-wrapper {
        max-width: 850px;
        margin: 0 auto;
        padding: 1rem 1rem;
        font-family: 'Inter', system-ui, sans-serif;
        color: var(--c-text-primary);
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
    }

    .guest-prompt {
        text-align: center;
        background: rgba(30, 30, 35, 0.6);
        border: 1px dashed var(--c-border);
        padding: 1.25rem;
        border-radius: var(--radius-md);
        margin-bottom: 1.5rem;
    }
    .guest-icon { font-size: 1.5rem; display: block; margin-bottom: 0.25rem; }
    .guest-content p { color: var(--c-text-secondary); margin-bottom: 0.75rem; font-size: 0.9rem; }
    .login-btn-pulse {
        background: var(--c-accent); color: white; border: none;
        padding: 0.6rem 1.5rem; border-radius: var(--radius-sm); font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer; box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
        transition: transform 0.2s;
    }
    .login-btn-pulse:hover { transform: translateY(-2px); box-shadow: 0 0 20px rgba(59, 130, 246, 0.5); }

    .compose-card {
        display: flex; gap: 0.75rem;
        background: var(--c-bg-card);
        padding: 1rem;
        border-radius: var(--radius-md);
        margin-bottom: 1.5rem;
        border: 1px solid var(--c-border);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
    }
    .compose-card.focused {
        border-color: var(--c-border-focus);
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    }

    .avatar-img, .avatar-placeholder {
        width: 36px; height: 36px;
        border-radius: 50%; object-fit: cover;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .avatar-placeholder {
        display: flex; align-items: center; justify-content: center;
        color: white; font-weight: 700; font-size: 0.8rem;
    }

    .input-area { flex: 1; display: flex; flex-direction: column; }
    .textarea-wrapper { position: relative; }
    textarea {
        width: 100%; background: transparent; border: none;
        color: var(--c-text-primary); font-size: 0.9rem; line-height: 1.4;
        resize: none; outline: none; padding: 0.25rem 0;
    }
    .focus-line {
        height: 1px; background: var(--c-border); width: 100%;
        margin-top: 2px; transition: all 0.3s;
    }
    .compose-card.focused .focus-line { background: var(--c-accent); }

    .toolbar {
        display: flex; justify-content: flex-end; align-items: center;
        gap: 0.75rem; margin-top: 0.75rem;
    }
    .chars { font-size: 0.7rem; color: var(--c-text-tertiary); }
    .chars.warn { color: #f59e0b; }
    .submit-btn {
        background: var(--c-accent); color: white; border: none;
        padding: 0.4rem 1.2rem; border-radius: 16px; font-weight: 600;
        font-size: 0.8rem; cursor: pointer; transition: background 0.2s;
        min-width: 80px; display: flex; justify-content: center;
    }
    .submit-btn:hover:not(:disabled) { background: var(--c-accent-hover); }
    .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .comments-stream { display: flex; flex-direction: column; gap: 0.5rem; }
    .comment-container { position: relative; }

    .replies-tree {
        position: relative;
        margin-left: 18px;
        padding-left: 18px; 
        border-left: 1.5px solid var(--thread-line);
    }

    .comment-card {
        display: flex; gap: 0.75rem;
        padding: 0.75rem;
        border-radius: var(--radius-sm);
        transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
        border: 1px solid transparent;
    }
    .comment-card:hover { background: var(--c-bg-card-hover); }
    .comment-card.new { animation: highlight-pulse 2s ease-out; }
    
    .comment-card.pinned {
        border-color: rgba(245, 158, 11, 0.2);
        background: rgba(245, 158, 11, 0.02);
    }

    @keyframes highlight-pulse {
        0% { background: rgba(59, 130, 246, 0.1); }
        100% { background: transparent; }
    }

    .card-left { display: flex; flex-direction: column; align-items: center; }
    .card-content { flex: 1; min-width: 0; }

    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; }
    .user-meta { display: flex; align-items: center; gap: 0.5rem; }
    .username { font-weight: 600; color: var(--c-text-primary); font-size: 0.9rem; }
    .username-link { text-decoration: none; transition: opacity 0.2s; outline: none; }
    .username-link:hover { opacity: 0.7; }
    .avatar-link { display: block; transition: transform 0.2s ease; text-decoration: none; border: none; outline: none; }
    .avatar-link:hover { transform: scale(1.05); }
    .avatar-wrapper { position: relative; z-index: 1; }
    .badge-owner {
        background: rgba(59, 130, 246, 0.1); color: #60a5fa;
        font-size: 0.65rem; padding: 1px 5px; border-radius: 4px; font-weight: 500;
    }
    .badge-new {
        background: rgba(16, 185, 129, 0.1); color: #34d399;
        font-size: 0.65rem; padding: 1px 5px; border-radius: 4px; font-weight: 500;
    }
    .badge-admin {
        background: rgba(245, 158, 11, 0.15); color: #fbbf24;
        font-size: 0.65rem; padding: 1px 5px; border-radius: 4px; font-weight: 700;
        display: flex; align-items: center;
        border: 1px solid rgba(245, 158, 11, 0.2);
        box-shadow: 0 0 10px rgba(245, 158, 11, 0.1);
    }
    .badge-pinned {
        background: rgba(245, 158, 11, 0.1); color: #f59e0b;
        font-size: 0.65rem; padding: 1px 5px; border-radius: 4px; font-weight: 500;
        display: flex; align-items: center;
    }
    .badge-deleted-admin {
        background: rgba(239, 68, 68, 0.15); color: #f87171;
        font-size: 0.65rem; padding: 1px 5px; border-radius: 4px; font-weight: 600;
        display: flex; align-items: center;
        border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .meta-right { font-size: 0.75rem; color: var(--c-text-tertiary); display: flex; align-items: center; gap: 0.4rem; }

    .comment-body {
        font-size: 0.9rem; line-height: 1.5; color: #d1d5db;
        white-space: pre-wrap; margin-bottom: 0.5rem;
        word-break: break-word;
        overflow-wrap: anywhere;
    }
    .deleted-text { font-style: italic; color: #888; }
    .comment-card.deleted { background: rgba(239, 68, 68, 0.02); }

    .card-actions {
        display: flex; align-items: center; gap: 1rem;
    }
    .action-divider {
        width: 1px;
        height: 14px;
        background: rgba(255, 255, 255, 0.1);
        display: inline-block;
        flex-shrink: 0;
    }
    .vote-group {
        display: flex; align-items: center;
        background: rgba(255,255,255,0.02);
        border-radius: 12px; padding: 1px;
        border: 1px solid rgba(255,255,255,0.04);
    }
    .vote-btn {
        background: transparent; border: none;
        display: flex; align-items: center; gap: 0.25rem;
        padding: 2px 8px; cursor: pointer; color: var(--c-text-tertiary);
        transition: color 0.2s;
    }
    .vote-btn:hover { color: var(--c-text-secondary); }
    .vote-btn.up.active { color: #4ade80; }
    .vote-btn.down.active { color: #f87171; }
    .vote-count { font-size: 0.75rem; font-weight: 500; }

    .action-buttons-group { 
        display: flex; 
        flex-direction: row;
        align-items: center; 
        gap: 0.4rem; 
        flex-wrap: wrap; 
    }

    .edited-badge { 
        font-size: 0.65rem; 
        color: var(--c-text-tertiary); 
        opacity: 0.6;
        font-style: italic;
        background: rgba(255, 255, 255, 0.03);
        padding: 1px 6px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        user-select: none;
    }

    .action-buttons-group .action-btn {
        background: transparent; 
        border: none; 
        color: var(--c-text-tertiary);
        font-size: 0.75rem; 
        font-weight: 600; 
        cursor: pointer; 
        padding: 0.35rem 0.6rem;
        transition: all 0.2s;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        border-radius: 8px;
        width: auto;
        height: auto;
    }

    .btn-icon {
        display: inline-flex;
        align-items: center;
        opacity: 0.7;
        pointer-events: none; /* Astra: Evitar interferencia con el click del botón */
    }

    .btn-label {
        pointer-events: none; /* Astra: Evitar interferencia con el click del botón */
    }

    .bullet-sep {
        color: var(--c-text-tertiary);
        opacity: 0.2;
        font-size: 0.5rem;
        user-select: none;
        margin: 0 0.1rem;
    }

    .action-buttons-group .action-btn:hover { 
        color: var(--c-text-primary); 
        background: rgba(255, 255, 255, 0.05);
    }
    
    .action-buttons-group .action-btn.reply { color: var(--c-text-secondary); }
    .action-buttons-group .action-btn.reply:hover { color: var(--c-accent); background: rgba(59, 130, 246, 0.1); }
    
    .action-buttons-group .action-btn.danger:hover { color: var(--c-danger); background: rgba(239, 68, 68, 0.1); }
    .action-buttons-group .action-btn.pin:hover { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }

    .thread-expand-wrapper {
        margin-left: 44px;
        margin-top: 2px;
        margin-bottom: 8px;
    }
    
    .thread-expand-wrapper.collapse {
        margin-bottom: 4px;
        opacity: 0.6;
    }

    .btn-expand-thread {
        background: transparent;
        border: none;
        color: var(--c-accent);
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 4px 8px;
        border-radius: 8px;
        transition: all 0.2s;
    }

    .btn-expand-thread:hover {
        background: rgba(59, 130, 246, 0.1);
        transform: translateX(4px);
    }

    .expand-icon {
        display: flex;
        align-items: center;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .expand-icon.rotate {
        transform: rotate(180deg);
    }

    .reply-input-box {
        margin-top: 0.75rem;
        background: var(--c-bg-input);
        border: 1px solid var(--c-border);
        border-radius: var(--radius-sm);
        padding: 0.75rem;
    }
    .reply-header { display: flex; justify-content: space-between; margin-bottom: 0.4rem; font-size: 0.8rem; color: var(--c-text-secondary); }
    .btn-close-sm { background: transparent; border: none; color: var(--c-text-tertiary); cursor: pointer; }
    .reply-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 0.6rem; }
    .reply-actions-btns { display: flex; gap: 0.6rem; }
    .btn-text { background: transparent; border: none; color: var(--c-text-secondary); cursor: pointer; font-size: 0.8rem; }
    .btn-primary-sm {
        background: var(--c-accent); color: white; border: none;
        padding: 0.3rem 0.8rem; border-radius: var(--radius-sm);
        font-size: 0.8rem; font-weight: 600; cursor: pointer;
    }

    .edit-mode { width: 100%; }
    .edit-textarea {
        background: var(--c-bg-input); border: 1px solid var(--c-border);
        color: white; padding: 0.6rem; border-radius: var(--radius-sm);
        width: 100%; min-height: 60px; margin-bottom: 0.4rem; font-size: 0.9rem;
    }
    .edit-actions { display: flex; justify-content: flex-end; gap: 0.6rem; }

    .empty-state {
        text-align: center; padding: 3rem 1rem;
        background: rgba(255,255,255,0.01); border-radius: var(--radius-md);
        border: 1px dashed var(--c-border);
    }
    .empty-illustration { font-size: 2.5rem; margin-bottom: 0.75rem; opacity: 0.6; }
    .empty-state h3 { font-size: 1rem; margin-bottom: 0.4rem; color: var(--c-text-primary); }
    .empty-state p { color: var(--c-text-secondary); font-size: 0.85rem; }

    .load-more-wrapper {
        display: flex; align-items: center; justify-content: center;
        gap: 0.75rem; margin-top: 0.75rem; position: relative;
    }
    .load-more-line { height: 1px; background: var(--c-border); flex: 1; }
    .load-more-btn {
        background: var(--c-bg-card); border: 1px solid var(--c-border);
        color: var(--c-text-secondary); padding: 0.4rem 1rem;
        border-radius: 16px; font-size: 0.8rem; cursor: pointer;
        display: flex; align-items: center; gap: 0.4rem;
        transition: all 0.2s;
    }
    .load-more-btn:hover { border-color: var(--c-text-secondary); color: var(--c-text-primary); }

    .modal-overlay {
        position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(5px); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
    }
    .modal-content {
        background: #202025; padding: 1.5rem; border-radius: var(--radius-md);
        width: 90%; max-width: 360px; text-align: center;
        border: 1px solid var(--c-border); box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    .modal-icon { font-size: 2rem; margin-bottom: 0.75rem; }
    .modal-content h4 { font-size: 1.1rem; margin-bottom: 0.4rem; }
    .modal-content p { color: var(--c-text-secondary); font-size: 0.85rem; margin-bottom: 1.25rem; }
    .modal-buttons { display: flex; gap: 0.75rem; justify-content: center; }
    .btn-modal-cancel, .btn-modal-confirm {
        padding: 0.5rem 1rem; border-radius: var(--radius-sm);
        border: none; font-weight: 600; cursor: pointer; font-size: 0.85rem;
    }
    .btn-modal-cancel { background: transparent; color: var(--c-text-secondary); border: 1px solid var(--c-border); }
    .btn-modal-confirm.danger { background: var(--c-danger); color: white; }

    @media (max-width: 600px) {
        .comments-wrapper { padding: 0.75rem 0.1rem; }
        .compose-card { flex-direction: row; padding: 0.5rem; gap: 0.4rem; }
        .replies-tree { margin-left: 4px; padding-left: 6px; border-left-width: 1px; }
        .comment-card { padding: 0.4rem 0.1rem; gap: 0.4rem; }
        .card-left { width: 22px; }
        .avatar-img, .avatar-placeholder { width: 20px; height: 20px; font-size: 0.6rem; }

        .card-actions {
            flex-direction: row;
            flex-wrap: nowrap; /* Astra: Forzar fila única en móvil */
            justify-content: flex-start;
            align-items: center;
            gap: 0.6rem; 
            margin-top: 0.6rem;
            width: 100%;
            overflow-x: auto; /* Astra: Permitir scroll horizontal si hay muchos botones */
            overflow-y: hidden;
            padding: 0.2rem 0;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none; /* Firefox */
        }
        
        .card-actions::-webkit-scrollbar {
            display: none; /* Chrome/Safari */
        }
        
        .action-divider { display: none; }

        .vote-group {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            gap: 0;
            flex-shrink: 0; /* Astra: Impedir que los votos se encojan */
        }

        .action-buttons-group { 
            margin-left: 0; 
            display: flex;
            align-items: center;
            gap: 0.4rem; 
            flex-wrap: nowrap; /* Astra: Forzar fila única también aquí */
            flex-shrink: 0;
        }

        .action-buttons-group .action-btn { 
            background: rgba(255, 255, 255, 0.03);
            padding: 0.5rem; /* Astra: Más balanceado para iconos */
            gap: 0.35rem;
            border-radius: 10px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 34px; /* Asegurar área mínima táctil */
            height: 34px;
        }

        /* Astra: Solo mostramos el texto en "Responder", los demás solo icono para ahorrar espacio */
        .action-buttons-group .action-btn:not(.reply) .btn-label {
            display: none;
        }

        .action-buttons-group .action-btn.reply {
            padding: 0.4rem 0.8rem;
            width: auto;
            height: auto;
            min-height: 34px;
        }

        .action-buttons-group .action-btn.reply .btn-label {
            display: inline-block;
            font-size: 0.7rem;
            font-weight: 700;
            line-height: 1;
        }

        .action-buttons-group .action-btn :global(svg) { 
            width: 14px; 
            height: 14px;
            display: block; 
        }
        
        .vote-btn { padding: 0.4rem 0.6rem; gap: 0.3rem; }
        .vote-count { font-size: 0.75rem; }
        .bullet-sep { display: none; }
    }
</style>
