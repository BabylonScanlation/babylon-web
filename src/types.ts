// src/types.ts

// ✅ CORRECCIÓN: Se añade la propiedad opcional 'chapters'
interface ChapterInfo {
  id: number; // Assuming chapterId is available
  number: number;
  title?: string; // Chapter title is optional
  thumbnailUrl?: string; // New field for thumbnail
  views?: number; // New field for views
  createdAt: string;
}

// Definimos una única interfaz para una Serie que usaremos en todo el proyecto.
export interface Series {
  slug: string;
  title: string;
  coverImageUrl?: string; // Drizzle format
  urlPortada?: string; // DB specific
  description?: string; // La descripción es opcional
  demographic?: string; // New field for demographic (shojo, seinen, etc.)
  views?: number; // Conteo de vistas
  lastChapter?: string;
  lastChapterCreatedAt?: string;
  chapters?: ChapterInfo[];
  isHidden?: boolean; // Added for visibility control
  isNsfw?: boolean;
}

export interface User {
  uid: string;
  email?: string | null;
  username?: string | null; // Added username
  displayName?: string | null;
  photoUrl?: string | null;
  avatarUrl?: string | null; // Added for comments
  isAdmin?: boolean;
  emailVerified?: boolean;
  isNsfw?: boolean;
  preferences?: string;
}

export interface Comment {
  id: number;
  userId?: string;
  userEmail: string | null;
  username?: string;
  avatarUrl?: string;
  commentText: string;
  createdAt: string | number;
  updatedAt?: string | number;
  isOwner?: boolean;
  isEditing?: boolean;
  editedText?: string;
  showSpoiler?: boolean;
  isNew?: boolean;
  isSpoiler?: boolean;
  parentId?: number | null;
  children?: Comment[];
  isDeleted?: boolean;
  likes?: number;
  dislikes?: number;
  userVote?: number; // 1, -1, 0
  isPinned?: boolean;
  isAdminComment?: boolean;
}
