import type { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

export function getDB(env: { DB: D1Database }) {
  if (!env?.DB) {
    throw new Error('D1 Database binding (DB) is missing in environment');
  }
  return drizzle(env.DB, { schema });
}
