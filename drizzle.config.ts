import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (
  !process.env.CLOUDFLARE_ACCOUNT_ID ||
  !process.env.CLOUDFLARE_DATABASE_ID ||
  !process.env.CLOUDFLARE_D1_TOKEN
) {
  console.warn(
    'ADVERTENCIA: Faltan credenciales de Cloudflare D1 en .env. La generación local podría fallar si se requiere conexión HTTP.'
  );
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    databaseId: process.env.CLOUDFLARE_DATABASE_ID || '',
    token: process.env.CLOUDFLARE_D1_TOKEN || '',
  },
  verbose: true,
  strict: true,
});

