import type { APIRoute } from 'astro';
import { db } from '../../../services/db';

export const prerender = false;

// Restores only the current learner's passed quiz IDs after a page refresh.
export const GET: APIRoute = async ({ url, locals }) => {
  const lessonId = url.searchParams.get('lessonId');
  const guestId = url.searchParams.get('guestId');
  if (!lessonId) {
    return new Response(JSON.stringify({ error: 'lessonId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const user = locals.user;
  const responses = await db.getLatestVideoQuizResponses(lessonId, user?.id, user ? undefined : guestId || undefined);
  return new Response(JSON.stringify({
    passedQuizIds: responses.filter(response => response.is_correct).map(response => response.quiz_id),
  }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
