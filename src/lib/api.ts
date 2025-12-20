import type { APIRoute, APIContext } from 'astro';
import { logError } from './logError';
import type { getDB } from './db';

export type DrizzleDB = ReturnType<typeof getDB>;

type AuthLevel = 'public' | 'user' | 'admin';

export interface ApiRouteConfig {
  auth: AuthLevel;
}

// Define the signature for the handler function that our wrapper will execute.

// It receives an enriched context where `locals.db` and `locals.user` are guaranteed to be present and correctly typed for authenticated/admin routes.

export type ApiHandler = (
  context: Omit<APIContext, 'locals'> & {
    locals: APIContext['locals'] & {
      db: DrizzleDB;

      user:
        | (APIContext['locals']['user'] & { uid: string; isAdmin: boolean })
        | undefined; // User can be undefined for public routes
    };
  }
) => Promise<Response>;

export function createApiRoute(
  config: ApiRouteConfig,

  handler: ApiHandler
): APIRoute {
  // This is the actual APIRoute function that Astro will call.

  return async (context: APIContext): Promise<Response> => {
    const { locals, request } = context;

    // Type assertions for user and db access inside the wrapper

    const user = locals.user as
      | (APIContext['locals']['user'] & { uid: string; isAdmin: boolean })
      | undefined;

    const db = locals.db as DrizzleDB;

    // 1. Authorization Check, based on the route's config

    if (config.auth === 'admin') {
      if (!user || !user.uid || !user.isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Forbidden. Admin access required.' }),

          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else if (config.auth === 'user') {
      if (!user || !user.uid) {
        return new Response(
          JSON.stringify({
            error: 'Unauthorized. User authentication required.',
          }),

          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2. Standardized Error Handling via a try...catch block

    try {
      // Ensure db from middleware is available.

      if (!db) {
        logError(
          'Database connection not found in API context.',
          'API Middleware Error'
        );

        return new Response(
          JSON.stringify({
            error: 'Internal Server Error: Database not available.',
          }),
          { status: 500 }
        );
      }

      // Create the enriched locals object for the handler context, ensuring correct types

      const enrichedLocals: Omit<APIContext['locals'], 'user'> & {
        db: DrizzleDB;
        user:
          | (APIContext['locals']['user'] & { uid: string; isAdmin: boolean })
          | undefined;
      } = {
        ...locals, // Spread existing locals

        db: db, // Add guaranteed db

        user:
          config.auth === 'user' || config.auth === 'admin'
            ? (user as APIContext['locals']['user'] & {
                uid: string;
                isAdmin: boolean;
              })
            : user, // Add guaranteed user based on auth
      };

      // Execute the core logic of the endpoint with the enriched context.

      const handlerContext: Omit<APIContext, 'locals'> & {
        locals: typeof enrichedLocals;
      } = {
        ...context,

        locals: enrichedLocals,
      };

      return await handler(handlerContext);
    } catch (error: unknown) {
      // If the handler throws an error, catch it here.

      logError(error, `API Route Error at ${request.url}`, {
        userId: user?.uid,
      });

      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred.';

      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          details: errorMessage,
        }),

        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}
