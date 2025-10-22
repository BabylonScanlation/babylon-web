// src/pages/api/series/[slug].ts
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ params, locals }) => {
  const { slug } = params;
  if (!slug) {
    return new Response("Se requiere el slug de la serie", { status: 400 });
  }

  try {
    const db = locals.runtime.env.DB;
    const user = locals.user;

    const series = await db.prepare("SELECT *, genres as genres FROM Series WHERE slug = ? AND is_hidden = FALSE").bind(slug).first<any>();

    if (!series) {
      return new Response("Serie no encontrada", { status: 404 });
    }

    const [chaptersResult, ratingsResult, reactionsResult, userRatingResult, userReactionResult] = await Promise.all([
      db.prepare("SELECT chapter_number, title, created_at, views FROM Chapters WHERE series_id = ? AND status = 'live' ORDER BY chapter_number DESC").bind(series.id).all(),
      db.prepare("SELECT rating, COUNT(rating) as count FROM SeriesRatings WHERE series_id = ? GROUP BY rating").bind(series.id).all(),
      db.prepare("SELECT reaction_emoji, COUNT(reaction_emoji) as count FROM SeriesReactions WHERE series_id = ? GROUP BY reaction_emoji").bind(series.id).all(),
      user ? db.prepare("SELECT rating FROM SeriesRatings WHERE series_id = ? AND user_id = ?").bind(series.id, user.uid).first<{ rating: number }>() : Promise.resolve(null),
      user ? db.prepare("SELECT reaction_emoji FROM SeriesReactions WHERE series_id = ? AND user_id = ?").bind(series.id, user.uid).first<{ reaction_emoji: string }>() : Promise.resolve(null),
    ]);

    let totalVotes = 0;
    let totalRating = 0;
    ratingsResult.results.forEach((row: any) => {
      totalVotes += row.count;
      totalRating += row.rating * row.count;
    });
    const averageRating = totalVotes > 0 ? (totalRating / totalVotes) : 0;

    const reactionCounts = reactionsResult.results.reduce((acc: any, row: any) => {
        acc[row.reaction_emoji] = row.count;
        return acc;
    }, {});

    const responseData = {
      ...series,
      chapters: chaptersResult.results,
      stats: {
        averageRating: parseFloat(averageRating.toFixed(2)),
        totalVotes,
        reactionCounts,
        userVote: userRatingResult?.rating || null,
        userReaction: userReactionResult?.reaction_emoji || null,
      }
    };

    return new Response(JSON.stringify(responseData), {
      headers: { 
        "content-type": "application/json",
        // ✅ CORRECCIÓN CLAVE: Esta cabecera evita que el navegador guarde en caché
        // los datos de la serie, asegurando que el contador de vistas siempre esté actualizado.
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    });

  } catch (error) {
    console.error(error);
    return new Response("Error al obtener los detalles de la serie", { status: 500 });
  }
};