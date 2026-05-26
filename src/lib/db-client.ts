import type { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

export function getDB(env: { DB: D1Database }) {
  if (!env?.DB) {
    console.error(
      '[getDB] 🛑 D1 Database binding (DB) is missing. Available keys:',
      Object.keys(env || {})
    );
    throw new Error('D1 Database binding (DB) is missing in environment');
  }
  return drizzle(env.DB, { schema });
}
