import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user?.isAdmin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const r2Assets = locals.runtime.env.R2_ASSETS;
  const r2PublicUrlAssets = locals.runtime.env.R2_PUBLIC_URL_ASSETS;

  if (!r2Assets || !r2PublicUrlAssets) {
    return new Response('R2 storage not configured', { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return new Response('No image file provided', { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileExtension = file.name.split('.').pop();
    const r2Key = `news/${crypto.randomUUID()}.${fileExtension}`;

    await r2Assets.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    const publicUrl = `${r2PublicUrlAssets}/${r2Key}`;

    return new Response(JSON.stringify({ r2Key, publicUrl }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error uploading image to R2:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};
