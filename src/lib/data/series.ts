import { and, asc, desc, eq, inArray, isNull, or, type SQL, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '../../db/schema';
import {
  chapters,
  favorites,
  scanlations,
  series,
  seriesRatings,
  seriesReactions,
} from '../../db/schema';
import type { BabylonEnv, Chapter, RecentChapterSeries, SeriesDetails } from '../../types';
import { parseToTimestamp } from '../utils';

// Orion: Memoria RAM local para peticiones cero (Isolate level)
const seriesMemoryCache = new Map<string, { data: unknown; expires: number }>();

/**
 * Orion: Obtiene los detalles de una serie.
 */
export async function getSeriesDetails(
  db: DrizzleD1Database<typeof schema>,
  slug: string,
  user?: { uid: string; isAdmin: boolean }
): Promise<SeriesDetails | null> {
  const CACHE_KEY = `series_details_${slug}`;
  const now = Date.now();

  // 1. RAM Cache SOLO para invitados (Peticiones Cero)
  if (!user) {
    const cached = seriesMemoryCache.get(CACHE_KEY);
    if (cached && cached.expires > now) {
      return cached.data as SeriesDetails;
    }
  }

  const seriesData = await db
    .select()
    .from(series)
    .where(and(eq(series.slug, slug), eq(series.isHidden, false)))
    .get();

  if (!seriesData) return null;

  const [chaptersResult, ratingsResult, reactionsResult, userDataResult] = await Promise.all([
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
        language: chapters.language,
        scanlationName: scanlations.name,
        scanlationSlug: scanlations.slug,
        isNsfw: chapters.isNsfw,
      })
      .from(chapters)
      .leftJoin(scanlations, eq(chapters.scanlationId, scanlations.id))
      .where(
        and(eq(chapters.seriesId, seriesData.id), sql`${chapters.status} IN ('live', 'app_only')`)
      )
      .orderBy(desc(chapters.chapterNumber), desc(chapters.createdAt))
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

  // Orion: Agrupar capítulos por idioma
  const chaptersByLanguage = (chaptersResult as unknown[]).reduce(
    (acc: Record<string, Chapter[]>, chap) => {
      const c = chap as Chapter;
      const lang = c.language || 'es-la';
      if (!acc[lang]) acc[lang] = [];
      acc[lang].push(c);
      return acc;
    },
    {} as Record<string, Chapter[]>
  );

  const result = {
    ...seriesData,
    createdAt: seriesData.createdAt || new Date(0).toISOString(),
    chapters: chaptersResult, // Orion: Añadimos lista plana para compatibilidad con templates
    chaptersByLanguage,
    stats: {
      averageRating,
      totalVotes,
      reactionCounts: reactionMap,
      userVote: userDataResult?.rating ?? null,
      userReaction: userDataResult?.reactionEmoji ?? null,
      isFavorited: !!userDataResult?.favoriteId,
    },
  } as SeriesDetails;

  // Guardar en RAM por 5 minutos si es invitado
  if (!user && chaptersResult.length > 0) {
    seriesMemoryCache.set(CACHE_KEY, { data: result, expires: now + 300000 });
  }

  return result;
}

/**
 * Orion: Obtiene los datos necesarios para la Home de forma ultra-optimizada.
 * Reduce múltiples viajes a la DB y solo trae los campos necesarios para la UI.
 */
export async function getHomeData(
  db: DrizzleD1Database<typeof schema>,
  allowNsfw = false,
  env?: BabylonEnv
) {
  const CACHE_KEY = `home_data_nsfw_${allowNsfw}`;
  const now = Date.now();
  const kv = env?.KV_VIEWS;

  // 1. RAM Cache (Nivel 1: Ultra-Rápido, por Isolate)
  const cached = seriesMemoryCache.get(CACHE_KEY);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  // 2. KV Cache (Nivel 2: Distribuido, persiste entre reinicios)
  if (kv) {
    try {
      const kvCached = await kv.get(CACHE_KEY);
      if (kvCached) {
        const parsed = JSON.parse(kvCached);
        // Guardamos en RAM para la siguiente petición en este Isolate
        seriesMemoryCache.set(CACHE_KEY, { data: parsed, expires: now + 300000 });
        return parsed;
      }
    } catch (e) {
      console.error('Error reading Home KV cache:', e);
    }
  }

  const commonConditions: (SQL | undefined)[] = [eq(series.isHidden, false)];

  // Orion: Modo Estricto.
  // Si allowNsfw es true, SOLO mostramos NSFW (isNsfw = true)
  // Si allowNsfw es false, SOLO mostramos SFW (isNsfw = false o nulo)
  if (allowNsfw) {
    commonConditions.push(eq(series.isNsfw, true));
  } else {
    commonConditions.push(or(eq(series.isNsfw, false), isNull(series.isNsfw)));
  }

  // Orion: Ejecutamos absolutamente todas las queries en paralelo
  const [popular, byChapters, recentChaptersData] = await Promise.all([
    // Populares
    db
      .select({
        id: series.id,
        title: series.title,
        slug: series.slug,
        coverImageUrl: series.coverImageUrl,
        views: series.views,
        createdAt: series.createdAt,
        description: series.description,
        status: series.status,
      })
      .from(series)
      .where(and(...commonConditions.filter(Boolean)))
      .orderBy(desc(series.views))
      .limit(60)
      .all(),

    // Por cantidad de capítulos
    db
      .select({
        id: series.id,
        title: series.title,
        slug: series.slug,
        coverImageUrl: series.coverImageUrl,
        description: series.description,
        views: series.views,
        chapterCount: sql<number>`count(DISTINCT ${chapters.chapterNumber})`.as('chapterCount'),
      })
      .from(series)
      .leftJoin(chapters, eq(series.id, chapters.seriesId))
      .where(and(...commonConditions.filter(Boolean), eq(chapters.status, 'live')))
      .groupBy(series.id)
      .orderBy(desc(sql`chapterCount`))
      .limit(5)
      .all(),

    // Capítulos recientes
    getSeriesWithRecentChapters(db, allowNsfw),
  ]);

  const result = {
    popularSeries: popular,
    seriesByChapterCount: byChapters,
    seriesWithRecentChapters: recentChaptersData,
    hasContent: popular.length > 0 || recentChaptersData.length > 0,
  };

  // Guardar en RAM por 5 minutos y en KV por 10 minutos
  if (popular.length > 0 || recentChaptersData.length > 0) {
    seriesMemoryCache.set(CACHE_KEY, { data: result, expires: now + 300000 });

    // Guardamos en KV de forma asíncrona para no bloquear la respuesta
    if (kv) {
      kv.put(CACHE_KEY, JSON.stringify(result), { expirationTtl: 600 }).catch((e: unknown) => {
        console.error('Error writing Home KV cache:', e);
      });
    }
  }

  return result;
}

/**
 * Orion: Obtiene las series más recientes.
 */
export async function getRecentSeries(
  db: DrizzleD1Database<typeof schema>,
  allowNsfw: boolean = false,
  limit = 5
) {
  const conditions: (SQL | undefined)[] = [eq(series.isHidden, false)];
  if (allowNsfw) {
    conditions.push(eq(series.isNsfw, true));
  } else {
    conditions.push(or(eq(series.isNsfw, false), isNull(series.isNsfw)));
  }

  return await db
    .select({
      id: series.id,
      title: series.title,
      slug: series.slug,
      coverImageUrl: series.coverImageUrl,
      views: series.views,
      createdAt: series.createdAt,
      description: series.description,
    })
    .from(series)
    .where(and(...conditions.filter(Boolean)))
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
  const conditions: (SQL | undefined)[] = [eq(series.isHidden, false)];
  if (allowNsfw) {
    conditions.push(eq(series.isNsfw, true));
  } else {
    conditions.push(or(eq(series.isNsfw, false), isNull(series.isNsfw)));
  }

  return await db
    .select({
      id: series.id,
      title: series.title,
      slug: series.slug,
      coverImageUrl: series.coverImageUrl,
      views: series.views,
      createdAt: series.createdAt,
      description: series.description,
    })
    .from(series)
    .where(and(...conditions.filter(Boolean)))
    .orderBy(desc(series.views))
    .limit(limit)
    .all();
}

/**
 * Orion: Obtiene todas las series (Solo para el Sitemap o Admin, NUNCA usar en la Home).
 export async function getAllSeries(
   db: DrizzleD1Database<typeof schema>,
   allowNsfw: boolean = false
 ) {
   const conditions: any[] = [eq(series.isHidden, false)];
   if (allowNsfw) {
     conditions.push(eq(series.isNsfw, true));
   } else {
     conditions.push(or(eq(series.isNsfw, false), isNull(series.isNsfw)));
   }

   return await db
     .select({
       id: series.id,
       title: series.title,
       slug: series.slug,
       coverImageUrl: series.coverImageUrl,
       views: series.views,
     })
     .from(series)
     .where(and(...conditions.filter(Boolean)))
     .all();
 }
    .all();
}

interface RecentChapterSeries {
  id: number;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  recentChapters: {
    number: number;
    title: string | null;
    createdAt: string | null;
  }[];
  lastUpdate: string | null;
}

/**
 * Orion: Obtiene series con capítulos actualizados recientemente.
 * Utiliza 2 pasos optimizados para garantizar variedad de series sin sobrecargar memoria.
 */
export async function getSeriesWithRecentChapters(
  db: DrizzleD1Database<typeof schema>,
  allowNsfw: boolean = false
): Promise<RecentChapterSeries[]> {
  const seriesConditions: (SQL | undefined)[] = [eq(series.isHidden, false)];
  if (allowNsfw) {
    seriesConditions.push(eq(series.isNsfw, true));
  } else {
    seriesConditions.push(or(eq(series.isNsfw, false), isNull(series.isNsfw)));
  }

  // 1. Obtener los IDs de las ÚLTIMAS 25 SERIES distintas que han actualizado
  const recentSeriesIds = await db
    .select({ seriesId: chapters.seriesId })
    .from(chapters)
    .innerJoin(series, eq(chapters.seriesId, series.id))
    .where(
      and(
        eq(chapters.status, 'live'),
        ...seriesConditions.filter(Boolean),
        sql`${chapters.chapterNumber} > 0`
      )
    )
    .groupBy(chapters.seriesId)
    .orderBy(desc(sql`MAX(${chapters.createdAt})`))
    .limit(30)
    .all();

  const targetIds = recentSeriesIds.map((r) => r.seriesId).filter(Boolean) as number[];
  if (targetIds.length === 0) return [];

  // 2. Traer los capítulos de esas 20 series y agrupar en JS (solo campos necesarios)
  const rawData = await db
    .select({
      seriesId: series.id,
      slug: series.slug,
      title: series.title,
      coverImageUrl: series.coverImageUrl,
      chapterNumber: chapters.chapterNumber,
      chapterTitle: chapters.title,
      chapterCreatedAt: chapters.createdAt,
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
    .orderBy(desc(chapters.createdAt)) // Prioridad al tiempo de creación real
    .all();

  const seriesMap = new Map<string, RecentChapterSeries>();
  for (const row of rawData) {
    if (!seriesMap.has(row.slug)) {
      seriesMap.set(row.slug, {
        id: row.seriesId,
        slug: row.slug,
        title: row.title,
        coverImageUrl: row.coverImageUrl,
        recentChapters: [],
        lastUpdate: row.chapterCreatedAt,
      });
    }

    const entry = seriesMap.get(row.slug);
    if (!entry) continue;

    // Actualizamos la fecha de la serie si este capítulo es más nuevo en tiempo
    const rowTime = parseToTimestamp(row.chapterCreatedAt);
    const entryTime = parseToTimestamp(entry.lastUpdate);
    if (rowTime > entryTime) {
      entry.lastUpdate = row.chapterCreatedAt;
    }

    // Orion: Añadimos a la lista si no está ya (evitar duplicados por bug de DB)
    if (entry.recentChapters.length < 3) {
      if (!entry.recentChapters.some((c: { number: number }) => c.number === row.chapterNumber)) {
        entry.recentChapters.push({
          number: row.chapterNumber,
          title: row.chapterTitle,
          createdAt: row.chapterCreatedAt,
        });
      }
    }
  }

  // Ordenamos las series finales por su actualización más reciente en el tiempo
  return Array.from(seriesMap.values()).sort((a, b) => {
    return parseToTimestamp(b.lastUpdate) - parseToTimestamp(a.lastUpdate);
  });
}

/**
 * Orion: Obtiene series ordenadas por cantidad de capítulos (para el Hero).
 */
export async function getSeriesByChapterCount(
  db: DrizzleD1Database<typeof schema>,
  allowNsfw: boolean = false,
  limit = 5
) {
  const conditions: (SQL | undefined)[] = [eq(series.isHidden, false), eq(chapters.status, 'live')];

  if (allowNsfw) {
    conditions.push(eq(series.isNsfw, true));
  } else {
    conditions.push(or(eq(series.isNsfw, false), isNull(series.isNsfw)));
  }

  const results = await db
    .select({
      id: series.id,
      title: series.title,
      slug: series.slug,
      coverImageUrl: series.coverImageUrl,
      description: series.description,
      views: series.views,
      chapterCount: sql<number>`count(DISTINCT ${chapters.chapterNumber})`.as('chapterCount'),
    })
    .from(series)
    .innerJoin(chapters, eq(series.id, chapters.seriesId))
    .where(and(...conditions.filter(Boolean)))
    .groupBy(series.id)
    .orderBy(desc(sql`chapterCount`))
    .limit(limit)
    .all();

  return results;
}

export interface SearchResult {
  results: (typeof series.$inferSelect)[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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
): Promise<SearchResult> {
  const {
    q,
    page = 1,
    limit = 25,
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

  // Orion: Implementación de RAM Cache para búsquedas (Peticiones Cero)
  const CACHE_KEY = `search_${allowNsfw}_${q || ''}_${page}_${limit}_${sort}_${type || ''}_${status || ''}_${genres || ''}`;
  const now = Date.now();
  const cached = seriesMemoryCache.get(CACHE_KEY);
  if (cached && cached.expires > now) {
    return cached.data as SearchResult;
  }

  const offset = (page - 1) * limit;
  const conditions: (SQL | undefined)[] = [eq(series.isHidden, false)];
  if (allowNsfw) {
    conditions.push(eq(series.isNsfw, true));
  } else {
    conditions.push(or(eq(series.isNsfw, false), isNull(series.isNsfw)));
  }

  // Orion: Usamos el tipado dinámico de Drizzle sin recurrir a 'any'
  let baseQuery = db.select().from(series).$dynamic();
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(series).$dynamic();

  if (q && q.trim() !== '') {
    const searchTerm = q
      .trim()
      .split(/\s+/)
      .map((word) => `${word}*`)
      .join(' ');
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle dynamic query with FTS join requires casting
    baseQuery = (baseQuery as any).innerJoin(
      sql`series_fts`,
      eq(series.id, sql`series_fts.rowid`)
    ) as typeof baseQuery;
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle dynamic query with FTS join requires casting
    countQuery = (countQuery as any).innerJoin(
      sql`series_fts`,
      eq(series.id, sql`series_fts.rowid`)
    ) as typeof countQuery;
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

  const totalResult = await countQuery.where(and(...conditions.filter(Boolean))).get();
  const total = totalResult?.count || 0;

  const query = baseQuery.where(and(...conditions.filter(Boolean)));

  // Orion: Aplicamos ordenamiento inteligente
  if (sort === 'az') {
    query.orderBy(asc(series.title));
  } else if (sort === 'latest') {
    query.orderBy(desc(series.createdAt));
  } else if (sort === 'popular') {
    query.orderBy(desc(series.views));
  } else if (sort === 'relevance' && q) {
    query.orderBy(sql`rank`);
  } else {
    query.orderBy(asc(series.title));
  }

  const results = (await query
    .limit(limit)
    .offset(offset)
    .all()) as unknown as (typeof series.$inferSelect)[];

  const result = {
    results,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };

  // Guardar en RAM por 5 minutos (300,000 ms)
  seriesMemoryCache.set(CACHE_KEY, { data: result, expires: now + 300000 });

  return result;
}
