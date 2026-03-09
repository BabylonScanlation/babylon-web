import type { APIRoute } from 'astro';
import { GET as getIndexMin } from './index.min.json';

export const GET: APIRoute = async (context) => {
  return getIndexMin(context);
};
