// src/pages/api/admin-login.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async (context) => {
  console.log(">>> [DEBUG] API Admin Login endpoint hit."); // Nuevo log para depuración

  try {
    const { request, cookies, redirect, locals } = context;
    const formData = await request.formData();
    const password = formData.get('password');
    const adminPassword = locals.runtime.env.ADMIN_PASSWORD;

    console.log(`>>> [DEBUG] Password received (API): ${password ? 'YES' : 'NO'}`);
    console.log(`>>> [DEBUG] Admin password from env (API): ${adminPassword ? 'DEFINED' : 'UNDEFINED'}`);

    if (password === adminPassword) {
      cookies.set('session', 'admin-logged-in', {
        path: '/',
        httpOnly: true,
        secure: !import.meta.env.DEV,
        maxAge: 60 * 60 * 24
      });
      console.log(">>> [DEBUG] API Login successful, redirecting to /admin.");
      return redirect('/admin?success=Inicio de sesión exitoso'); // Redirige con un mensaje de éxito
    } else {
      console.log(">>> [DEBUG] API Incorrect password, redirecting to /admin?error=Contraseña incorrecta.");
      return redirect('/admin?error=Contraseña incorrecta');
    }
  } catch (e: unknown) {
    console.error(">>> [DEBUG] Error in API Admin Login endpoint:", e);
    return new Response(`Internal Server Error en API Login: ${(e instanceof Error ? e.message : String(e))}`, { status: 500 });
  }
};