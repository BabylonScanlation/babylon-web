import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { password: rawPassword } = await request.json();
    const password = rawPassword?.toString().trim();
    const adminPassword = locals.runtime.env.ADMIN_PASSWORD;

    if (password === adminPassword) {
      return new Response(JSON.stringify({ isAdmin: true }), { status: 200 });
    } else {
      return new Response(JSON.stringify({ isAdmin: false }), { status: 200 });
    }
  } catch (e: unknown) {
    console.error('>>> [DEBUG check-admin-password.ts] Error in API check-admin-password endpoint:', e);
    return new Response(
      JSON.stringify({
        error: `Internal Server Error: ${e instanceof Error ? e.message : String(e)}`,
      }),
      { status: 500 }
    );
  }
};
