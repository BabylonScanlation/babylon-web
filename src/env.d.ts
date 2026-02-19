// src/env.d.ts

/// <reference types="astro/client" />
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { Runtime } from '@astrojs/cloudflare/runtime';
import type { User } from './types';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './db/schema'; // Import all schema definitions

declare global {
  namespace App {
    interface Locals {
      runtime: Runtime<{
        DB: D1Database;
        R2_ASSETS: R2Bucket;
        R2_CACHE: R2Bucket;
        KV_VIEWS: KVNamespace;
        ADMIN_PASSWORD?: string;
        TELEGRAM_BOT_TOKEN?: string;
        TELEGRAM_WEBHOOK_SECRET?: string;
        R2_PUBLIC_URL_ASSETS?: string;
        R2_PUBLIC_URL_CACHE?: string;
        FIREBASE_PROJECT_ID?: string;
        FIREBASE_CLIENT_EMAIL?: string;
        FIREBASE_PRIVATE_KEY?: string;
        SUPER_ADMIN_UID?: string;
        JWT_SECRET?: string;
        AUTH_SECRET?: string;
      }>;
      db: DrizzleD1Database<typeof schema> | undefined; // Corrected type
      user: User | undefined;
      isBot: boolean;
    }
  }

  // Extend the global Window interface
  interface Window {
    atOptions: any;
    pageImageUrls: string[];
    isProcessing: boolean;
    isVignetteBlocked?: boolean;
    isAdsterraBlocked?: boolean;
    isMonetagBlocked?: boolean;
    canRunAds?: boolean;
    newsFeedListener?: any;
    handleDelete?: (id: string) => Promise<void>;
    handleEdit?: (id: string) => void;
    saveEdit?: (id: string) => Promise<void>;
    handleToggleStatus?: (id: string, currentStatus: string) => Promise<void>;
  }
}
