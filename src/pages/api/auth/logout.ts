// src/pages/api/auth/logout.ts
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ cookies, redirect, request }) => {
  cookies.delete("user_session", { path: "/" });

  // Obtenemos la URL de la página anterior desde la cabecera 'Referer'.
  // Si no está disponible, redirigimos a la página principal como respaldo.
  const referer = request.headers.get("Referer") || "/";

  return redirect(referer);
};
