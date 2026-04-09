// src/types.ts

import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from './db/schema';

export type AppDatabase = DrizzleD1Database<typeof schema>;

export interface BabylonEnv {
  DB: D1Database;
  R2_ASSETS: R2Bucket;
  R2_CACHE: R2Bucket;
  KV_VIEWS: KVNamespace;
  JWT_SECRET?: string;
  AUTH_SECRET?: string;
  SUPER_ADMIN_UID?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  R2_PUBLIC_URL_ASSETS?: string;
  R2_PUBLIC_URL_CACHE?: string;
  INTERNAL_CRYPTO_SALT?: string;
  CONTEXT7_API?: string;
  [key: string]: unknown;
}

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
  messageThreadId?: number | null;
  isAppOnly?: boolean | null;
  processing?: boolean | null;
}

export interface RecentChapterSeries {
  id: number;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  recentChapters: {
    number: number;
    title: string | null;
    createdAt: string | null;
  }[];
  lastUpdate: string | null;
}

export interface Series {
  id: number;
  slug: string;
  title: string;
  coverImageUrl?: string | null;
  urlPortada?: string | null;
  description?: string | null;
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
  createdAt?: string | null;
  lastChapter?: string;
  lastChapterCreatedAt?: string;
  chapters?: Chapter[];
  isHidden?: boolean | null;
  isNsfw?: boolean | null;
  isAppSeries?: boolean | null;
  chapterCount?: number;
  stats?: {
    averageRating: number;
    totalVotes: number;
    reactionCounts: Record<string, number>;
    userVote: number | null;
    userReaction: string | null;
    isFavorited: boolean;
  };
}

export interface SeriesDetails extends Series {
  stats: {
    averageRating: number;
    totalVotes: number;
    reactionCounts: Record<string, number>;
    userVote: number | null;
    userReaction: string | null;
    isFavorited: boolean;
  };
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
  tokenVersion: number;
}

export interface Comment {
  id: number;
  userId?: string;
  userEmail: string | null;
  username?: string | null;
  avatarUrl?: string | null;
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
  isDeleted?: boolean | null;
  likes?: number;
  dislikes?: number;
  userVote?: number; // 1, -1, 0
  isPinned?: boolean | null;
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

export interface FirebaseDecodedToken {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

export interface SessionContext {
  cookies: {
    get: (key: string) => { value: string } | undefined;
    set: (key: string, value: string, options?: unknown) => void;
    delete: (key: string, options?: unknown) => void;
  };
  request: Request;
  locals: {
    runtime: {
      env: BabylonEnv;
    };
    [key: string]: unknown;
  };
}

export interface ChapterPage {
  imageUrl?: string;
  url?: string;
  pageNumber?: number;
  [key: string]: unknown;
}

export interface ChapterManifest {
  seriesId: number;
  chapterNumber: number;
  title?: string | null;
  pages?: ChapterPage[];
  imageUrls?: string[]; // Legacy
  [key: string]: unknown;
}
