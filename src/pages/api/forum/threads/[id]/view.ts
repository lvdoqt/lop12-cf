import type { APIRoute } from 'astro';
import { db } from '../../../../../services/db';

export const prerender = false;

export const POST: APIRoute = async ({ params }) => {
  const id = params.id || '';
  if (!id) return new Response(JSON.stringify({ success: false }), { status: 400 });
  await db.incrementForumThreadViews(id);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
