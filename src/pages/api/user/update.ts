import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { users } from '../../../db/schema';
import { getDB } from '../../../lib/db';

const UpdateProfileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guiones bajos')
    .optional(),
  bio: z.string().max(160).optional(),
  website: z.string().url().optional().or(z.literal('')),
  isPrivate: z.boolean().optional(),
  isNsfw: z.boolean().optional(),
  avatarUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !user.uid) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = UpdateProfileSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.errors[0]?.message || 'Datos de perfil inválidos';
      return new Response(JSON.stringify({ error: firstError }), { status: 400 });
    }

    const { username, bio, website, isPrivate, isNsfw, avatarUrl, bannerUrl } = validation.data;
    const db = getDB(locals.runtime.env);

    // Check if username is taken by another user
    if (username) {
      const existing = await db.select().from(users).where(eq(users.username, username)).get();
      if (existing && existing.id !== user.uid) {
        return new Response(JSON.stringify({ error: 'Este nombre de usuario ya está en uso.' }), {
          status: 409,
        });
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };
    if (username !== undefined) updateData.username = username;
    if (bio !== undefined) updateData.bio = bio;
    if (website !== undefined) updateData.website = website;
    if (isPrivate !== undefined) updateData.isPrivate = isPrivate;
    if (isNsfw !== undefined) updateData.isNsfw = isNsfw;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (bannerUrl !== undefined) updateData.bannerUrl = bannerUrl;

    await db
      .insert(users)
      .values({
        id: user.uid,
        email: user.email || 'no-email',
        username: username || `user_${user.uid.substring(0, 8)}`, // Fallback for new insert
        bio: bio,
        website: website,
        isPrivate: isPrivate ?? false,
        isNsfw: isNsfw ?? false,
        avatarUrl: avatarUrl,
        bannerUrl: bannerUrl,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: updateData,
      })
      .run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error interno al actualizar perfil' }), {
      status: 500,
    });
  }
};
