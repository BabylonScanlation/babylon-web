import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '../../db/schema';
import { chapters, favorites, series, seriesRatings, seriesReactions } from '../../db/schema';

/**
 * Orion: Obtiene los detalles de una serie.
 */
export async function getSeriesDetails(
  db: DrizzleD1Database<typeof schema>,
  slug: string,
  user?: { uid: string; isAdmin: boolean }
) {
  const seriesData = await db
    .select()
    .from(series)
    .where(and(eq(series.slug, slug), eq(series.isHidden, false)))
    .get();

  if (!seriesData) return null;

  const [chaptersResult, ratingsResult, reactionsResult, userDataResult] = await Promise.all([
    // Orion: Obtenemos los capítulos y sumamos sus vistas registradas para asegurar precisión
    db
      .select({
        id: chapters.id,
        seriesId: chapters.seriesId,
        chapterNumber: chapters.chapterNumber,
        title: chapters.title,
        status: chapters.status,
        urlPortada: chapters.urlPortada,
        createdAt: chapters.createdAt,
        views: chapters.views,
      })
      .from(chapters)
      .where(
        and(eq(chapters.seriesId, seriesData.id), sql`${chapters.status} IN ('live', 'app_only')`)
      )
      .orderBy(desc(chapters.chapterNumber))
      .all()
      .catch((err) => {
        console.error('Error fetching chapters:', err);
        return [];
      }),

    db
      .select({
        rating: seriesRatings.rating,
        count: sql<number>`COUNT(${seriesRatings.rating})`.as('count'),
      })
      .from(seriesRatings)
      .where(eq(seriesRatings.seriesId, seriesData.id))
      .groupBy(seriesRatings.rating)
      .all()
      .catch((err) => {
        console.error('Error fetching ratings:', err);
        return [];
      }),

    db
      .select({
        reactionEmoji: seriesReactions.reactionEmoji,
        count: sql<number>`COUNT(${seriesReactions.reactionEmoji})`.as('count'),
      })
      .from(seriesReactions)
      .where(eq(seriesReactions.seriesId, seriesData.id))
      .groupBy(seriesReactions.reactionEmoji)
      .all()
      .catch((err) => {
        console.error('Error fetching reactions:', err);
        return [];
      }),

    user
      ? db
          .select({
            rating: seriesRatings.rating,
            reactionEmoji: seriesReactions.reactionEmoji,
            favoriteId: favorites.id,
          })
          .from(series)
          .leftJoin(
            seriesRatings,
            and(eq(seriesRatings.seriesId, series.id), eq(seriesRatings.userId, user.uid))
          )
          .leftJoin(
            seriesReactions,
            and(eq(seriesReactions.seriesId, series.id), eq(seriesReactions.userId, user.uid))
          )
          .leftJoin(
            favorites,
            and(
              eq(favorites.seriesId, series.id),
              eq(favorites.userId, user.uid),
              eq(favorites.type, 'series')
            )
          )
          .where(eq(series.id, seriesData.id))
          .get()
          .catch((err) => {
            console.error('Error fetching user data:', err);
            return null;
          })
      : Promise.resolve(null),
  ]);

  const ratingMap = ratingsResult.reduce(
    (acc, curr) => {
      acc[curr.rating] = Number(curr.count);
      return acc;
    },
    {} as Record<number, number>
  );

  const totalVotes = Object.values(ratingMap).reduce((a, b) => a + b, 0);
  const averageRating =
    totalVotes > 0
      ? Object.entries(ratingMap).reduce(
          (acc, [rating, count]) => acc + Number(rating) * count,
          0
        ) / totalVotes
      : 0;

  const reactionMap = reactionsResult.reduce(
    (acc, curr) => {
      acc[curr.reactionEmoji] = Number(curr.count);
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    ...seriesData,
    chapters: chaptersResult,
    stats: {
      averageRating,
      totalVotes,
      reactionCounts: reactionMap,
      userVote: userDataResult?.rating ?? null,
      userReaction: userDataResult?.reactionEmoji ?? null,
      isFavorited: !!userDataResult?.favoriteId,
    },
  };
}

/**
 * Orion: Obtiene las series más recientes.
 */
export async function getRecentSeries(
  db: DrizzleD1Database<typeof schema>,
  allowNsfw: boolean = false,
  limit = 5
) {
  const conditions = [eq(series.isHidden, false)];
  if (!allowNsfw) conditions.push(eq(series.isNsfw, false));

  return await db
    .select()
    .from(series)
    .where(and(...conditions))
    .orderBy(desc(series.createdAt))
    .limit(limit)
    .all();
}

/**
 * Orion: Obtiene las series más populares.
 */
export async function getPopularSeries(
  db: DrizzleD1Database<typeof schema>,
  allowNsfw: boolean = false,
  limit = 5
) {
  const conditions = [eq(series.isHidden, false)];
  if (!allowNsfw) conditions.push(eq(series.isNsfw, false));

  return await db
    .select()
    .from(series)
    .where(and(...conditions))
    .orderBy(desc(series.views))
    .limit(limit)
    .all();
}

/**
 * Orion: Obtiene todas las series con ordenamiento inteligente.
 */
export async function getAllSeries(
  db: DrizzleD1Database<typeof schema>,
  allowNsfw: boolean = false
) {
  const conditions = [eq(series.isHidden, false)];
  if (!allowNsfw) conditions.push(eq(series.isNsfw, false));

  return await db
    .select()
    .from(series)
    .where(and(...conditions))
    .orderBy(asc(series.isNsfw), asc(series.title))
    .all();
}

/**
 * Orion: Obtiene series con capítulos actualizados recientemente.
 */
export async function getSeriesWithRecentChapters(
  db: DrizzleD1Database<typeof schema>,
  allowNsfw: boolean = false
) {
  const conditions = [
    eq(chapters.status, 'live'),
    eq(series.isHidden, false),
    sql`${chapters.chapterNumber} > 0`,
  ];
  if (!allowNsfw) conditions.push(eq(series.isNsfw, false));

  const recentSeriesIds = await db
    .select({ seriesId: chapters.seriesId })
    .from(chapters)
    .innerJoin(series, eq(chapters.seriesId, series.id))
    .where(and(...conditions))
    .groupBy(chapters.seriesId)
    .orderBy(desc(sql`MAX(${chapters.createdAt})`))
    .limit(25)
    .all();

  const targetIds = recentSeriesIds.map((r) => r.seriesId).filter(Boolean) as number[];
  if (targetIds.length === 0) return [];

  const rawChapters = await db
    .select({
      seriesId: series.id,
      slug: series.slug,
      title: series.title,
      coverImageUrl: series.coverImageUrl,
      chapterNumber: chapters.chapterNumber,
      createdAt: chapters.createdAt,
    })
    .from(chapters)
    .innerJoin(series, eq(chapters.seriesId, series.id))
    .where(
      and(
        eq(chapters.status, 'live'),
        inArray(chapters.seriesId, targetIds),
        sql`${chapters.chapterNumber} > 0`
      )
    )
    .orderBy(desc(chapters.createdAt))
    .all();

  const seriesMap = new Map();
  for (const ch of rawChapters) {
    if (!seriesMap.has(ch.slug)) {
      seriesMap.set(ch.slug, { ...ch, recentChapters: [], lastUpdate: ch.createdAt });
    }
    const entry = seriesMap.get(ch.slug);
    if (entry.recentChapters.length < 3) {
      entry.recentChapters.push({ number: ch.chapterNumber, createdAt: ch.createdAt });
    }
  }
  return Array.from(seriesMap.values());
}

/**
 * Orion: Obtiene series ordenadas por cantidad de capítulos (para el Hero).
 */
export async function getSeriesByChapterCount(
  db: DrizzleD1Database<typeof schema>,
  allowNsfw: boolean = false,
  limit = 5
) {
  const conditions = [eq(series.isHidden, false), eq(chapters.status, 'live')];
  if (!allowNsfw) conditions.push(eq(series.isNsfw, false));

  const results = await db
    .select({
      id: series.id,
      title: series.title,
      slug: series.slug,
      coverImageUrl: series.coverImageUrl,
      description: series.description,
      views: series.views,
      chapterCount: sql<number>`count(${chapters.id})`.as('chapterCount'),
    })
    .from(series)
    .leftJoin(chapters, eq(series.id, chapters.seriesId))
    .where(and(...conditions))
    .groupBy(series.id)
    .orderBy(desc(sql`chapterCount`))
    .limit(limit)
    .all();

  return results;
}

/**
 * Orion: Función de búsqueda centralizada con límites y ordenamiento estandarizados.
 */
export async function searchSeries(
  db: DrizzleD1Database<typeof schema>,
  options: {
    q?: string;
    page?: number;
    limit?: number;
    sort?: string;
    type?: string;
    status?: string;
    genres?: string;
    author?: string;
    artist?: string;
    publisher?: string;
    magazine?: string;
    allowNsfw?: boolean;
  }
) {
  const {
    q,
    page = 1,
    limit = 18,
    sort = 'az',
    type,
    status,
    genres,
    author,
    artist,
    publisher,
    magazine,
    allowNsfw = false,
  } = options;

  const offset = (page - 1) * limit;
  const conditions = [eq(series.isHidden, false)];

  if (!allowNsfw) conditions.push(eq(series.isNsfw, false));

  // Orion: Usamos FTS5 si hay una consulta de texto, de lo contrario usamos filtros estándar
  let baseQuery: any = db.select().from(series);
  let countQuery: any = db.select({ count: sql<number>`count(*)` }).from(series);

  if (q && q.trim() !== '') {
    const searchTerm = q
      .trim()
      .split(/\s+/)
      .map((word) => `${word}*`)
      .join(' ');
    baseQuery = baseQuery.innerJoin(sql`series_fts`, eq(series.id, sql`series_fts.rowid`));
    countQuery = countQuery.innerJoin(sql`series_fts`, eq(series.id, sql`series_fts.rowid`));
    conditions.push(sql`series_fts MATCH ${searchTerm}`);
  }

  if (type && type !== 'all') conditions.push(sql`${series.type} LIKE ${`%${type}%`}`);
  if (status && status !== 'all') conditions.push(eq(series.status, status));
  if (author) conditions.push(sql`${series.author} LIKE ${`%${author}%`}`);
  if (artist) conditions.push(sql`${series.artist} LIKE ${`%${artist}%`}`);
  if (publisher) conditions.push(sql`${series.publishedBy} LIKE ${`%${publisher}%`}`);
  if (magazine) conditions.push(sql`${series.serializedBy} LIKE ${`%${magazine}%`}`);

  if (genres) {
    genres.split(',').forEach((g) => {
      conditions.push(sql`${series.genres} LIKE ${`%${g.trim()}%`}`);
    });
  }

  const totalResult = await countQuery.where(and(...conditions)).get();
  const total = totalResult?.count || 0;

  const query = baseQuery.where(and(...conditions));

  // Orion: Aplicamos ordenamiento inteligente
  if (sort === 'az') {
    query.orderBy(asc(series.isNsfw), asc(series.title));
  } else if (sort === 'latest') {
    query.orderBy(desc(series.createdAt));
  } else if (sort === 'popular') {
    query.orderBy(desc(series.views));
  } else if (sort === 'relevance' && q) {
    query.orderBy(sql`rank`);
  } else {
    query.orderBy(asc(series.isNsfw), asc(series.title));
  }

  const results = await query.limit(limit).offset(offset).all();

  return {
    results,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
