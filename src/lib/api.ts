import type { APIRoute, APIContext } from 'astro';
import { logError } from './logError';
import type { getDB } from './db';

export type DrizzleDB = ReturnType<typeof getDB>;

type AuthLevel = 'public' | 'user' | 'admin';

export interface ApiRouteConfig {
  auth: AuthLevel;
}

export type ApiHandler = (
  context: Omit<APIContext, 'locals'> & {
    locals: APIContext['locals'] & {
      db: DrizzleDB;

      user:
        | (APIContext['locals']['user'] & { uid: string; isAdmin: boolean })
        | undefined;
    };
  }
) => Promise<Response>;

export function createApiRoute(
  config: ApiRouteConfig,

  handler: ApiHandler
): APIRoute {

  return async (context: APIContext): Promise<Response> => {
    const { locals, request } = context;

    const user = locals.user as
      | (APIContext['locals']['user'] & { uid: string; isAdmin: boolean })
      | undefined;

    const db = locals.db as DrizzleDB;

    if (config.auth === 'admin') {
      if (!user || !user.isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Acceso denegado. Se requieren permisos de administrador.' }),
          { status: 403 }
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

    try {

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

      const enrichedLocals: Omit<APIContext['locals'], 'user'> & {
        db: DrizzleDB;
        user:
          | (APIContext['locals']['user'] & { uid: string; isAdmin: boolean })
          | undefined;
      } = {
        ...locals,

        db: db,

        user:
          config.auth === 'user' || config.auth === 'admin'
            ? (user as APIContext['locals']['user'] & {
                uid: string;
                isAdmin: boolean;
              })
            : user,
      };

      const handlerContext: Omit<APIContext, 'locals'> & {
        locals: typeof enrichedLocals;
      } = {
        ...context,

        locals: enrichedLocals,
      };

      return await handler(handlerContext);
    } catch (error: unknown) {

      logError(error, `API Route Error at ${request.url}`, {
        userId: user?.uid,
      });

      const errorMessage =
        error instanceof Error ? error.message : 'Ocurrió un error desconocido en la API.';

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
