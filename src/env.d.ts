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
        ADMIN_PASSWORD?: string;
        TELEGRAM_BOT_TOKEN?: string;
        TELEGRAM_WEBHOOK_SECRET?: string;
        R2_PUBLIC_URL_ASSETS?: string;
        R2_PUBLIC_URL_CACHE?: string;
        FIREBASE_PROJECT_ID?: string;
        FIREBASE_CLIENT_EMAIL?: string;
        FIREBASE_PRIVATE_KEY?: string;
        SUPER_ADMIN_UID?: string;
      }>;
      db: DrizzleD1Database<typeof schema> | undefined; // Corrected type
      user: User | undefined;
    }
  }
}

declare module 'astro' {
  interface Locals extends App.Locals {} // Ensure App.Locals is extended
}
