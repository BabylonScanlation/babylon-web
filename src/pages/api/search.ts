// src/pages/api/search.ts
import type { APIRoute } from 'astro';
import { and, asc, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
import { series } from '../../db/schema';
import { getDB } from '../../lib/db';
import { logError } from '../../lib/logError';

export const GET: APIRoute = async ({ url, locals, cookies }) => {
  try {
    const drizzleDb = getDB(locals.runtime.env);

    // Extraction of all possible filters
    const query = url.searchParams.get('q')?.trim();
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    const author = url.searchParams.get('author')?.trim();
    const artist = url.searchParams.get('artist')?.trim();
    const publisher = url.searchParams.get('publisher')?.trim();
    const magazine = url.searchParams.get('magazine')?.trim();
    const genresRaw = url.searchParams.get('genres');
    const sort = url.searchParams.get('sort') || 'az';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '18', 10);
    const offset = (page - 1) * pageSize;

    // Auth-based NSFW filter
    const nsfwCookieValue = url.searchParams.get('nsfw') || cookies.get('babylon_nsfw')?.value;
    const allowNsfw =
      typeof nsfwCookieValue === 'string'
        ? nsfwCookieValue === 'true'
        : locals.user?.isNsfw || false;

    // Base Selection
    let baseQuery = drizzleDb
      .select({
        id: series.id,
        slug: series.slug,
        title: series.title,
        coverImageUrl: series.coverImageUrl,
        description: series.description,
        views: series.views,
        type: series.type,
        status: series.status,
        genres: series.genres,
        author: series.author,
        artist: series.artist,
        createdAt: series.createdAt,
      })
      .from(series);

    // Dynamic Conditions
    const conditions: any[] = [eq(series.isHidden, false)];

    if (allowNsfw) {
      conditions.push(eq(series.isNsfw, true));
    } else {
      conditions.push(or(eq(series.isNsfw, false), isNull(series.isNsfw)));
    }

    // 1. Text Search (FTS5 integration if query exists)
    if (query && query !== '') {
      const searchTerm = query
        .split(/\s+/)
        .map((word) => `${word}*`)
        .join(' ');
      baseQuery = baseQuery.innerJoin(sql`series_fts`, eq(series.id, sql`series_fts.rowid`)) as any;
      conditions.push(sql`series_fts MATCH ${searchTerm}`);
    }

    // 2. Exact/Partial Filters (Case Insensitive for type)
    if (type && type !== 'all') {
      conditions.push(like(series.type, `%${type}%`));
    }
    if (status && status !== 'all') {
      conditions.push(like(series.status, `%${status}%`));
    }

    if (author) conditions.push(like(series.author, `%${author}%`));
    if (artist) conditions.push(like(series.artist, `%${artist}%`));
    if (publisher) conditions.push(like(series.publishedBy, `%${publisher}%`));
    if (magazine) conditions.push(like(series.serializedBy, `%${magazine}%`));

    // 3. Multi-Genre Filter (Intersection/AND logic)
    if (genresRaw) {
      const genresList = genresRaw.split(',').filter((g) => g.trim() !== '');
      genresList.forEach((genre) => {
        conditions.push(like(series.genres, `%${genre.trim()}%`));
      });
    }

    // Apply Filters
    let finalQuery = (baseQuery as any).where(and(...conditions.filter(Boolean)));

    // Get Total Count for pagination
    let countBase = drizzleDb.select({ count: sql`count(*)` }).from(series);
    if (query && query !== '') {
      countBase = countBase.innerJoin(sql`series_fts`, eq(series.id, sql`series_fts.rowid`)) as any;
    }

    const [totalResult] = (await (countBase as any)
      .where(and(...conditions.filter(Boolean)))
      .all()) as any;

    const total = totalResult?.count || 0;

    // 4. Advanced Sorting
    switch (sort) {
      case 'popular':
        finalQuery = finalQuery.orderBy(desc(series.views));
        break;
      case 'latest':
        finalQuery = finalQuery.orderBy(desc(series.createdAt));
        break;
      case 'az':
        finalQuery = finalQuery.orderBy(asc(series.isNsfw), asc(series.title));
        break;
      default:
        if (query) {
          finalQuery = finalQuery.orderBy(sql`rank`);
        } else {
          finalQuery = finalQuery.orderBy(asc(series.isNsfw), asc(series.title));
        }
        break;
    }

    // Limit and Offset for pagination
    finalQuery = finalQuery.limit(pageSize).offset(offset);

    const results = await finalQuery.all();

    // Map to frontend expected format
    const formattedResults = results.map((s: any) => ({
      ...s,
      coverImageUrl: s.coverImageUrl,
    }));

    return new Response(
      JSON.stringify({
        results: formattedResults,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60', // Cache search for 1 min at edge
        },
      }
    );
  } catch (error: unknown) {
    const queryForLog = url.searchParams.get('q');
    logError(error, 'Error al realizar la búsqueda en la API', { query: queryForLog });
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
