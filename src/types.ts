// src/types.ts

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from './db/schema';

export type AppDatabase = DrizzleD1Database<typeof schema>;

export interface Chapter {
  id: number;
  seriesId: number;
  chapterNumber: number;
  title: string | null;
  telegramFileId: string;
  urlPortada: string | null;
  status: string;
  views: number | null;
  createdAt: string | null;
  messageThreadId: number | null;
}

export interface Series {
  id: number;
  slug: string;
  title: string;
  coverImageUrl?: string | null;
  urlPortada?: string | null;
  description?: string;
  demographic?: string | null;
  status?: string | null;
  type?: string | null;
  genres?: string | null;
  author?: string | null;
  artist?: string | null;
  publishedBy?: string | null;
  alternativeNames?: string | null;
  serializedBy?: string | null;
  views?: number | null;
  lastChapter?: string;
  lastChapterCreatedAt?: string;
  chapters?: Chapter[];
  isHidden?: boolean;
  isNsfw?: boolean;
  isAppSeries?: boolean;
  chapterCount?: number;
}

export interface User {
  uid: string;
  email?: string | null;
  username?: string | null;
  displayName?: string | null;
  photoUrl?: string | null;
  avatarUrl?: string | null;
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

export interface JWTPayload {
  uid: string;
  email: string;
  username: string;
  displayName: string | null;
  role: 'admin' | 'user';
  isNsfw: boolean;
  iat?: number;
  exp?: number;
}

export interface SessionContext {
  cookies: {
    get: (key: string) => { value: string } | undefined;
    set: (key: string, value: string, options?: any) => void;
    delete: (key: string, options?: any) => void;
  };
  request: Request;
}
