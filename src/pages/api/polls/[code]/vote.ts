import type { APIRoute } from 'astro';
import { pollStore } from '../../../../services/mockPollStore';

export const POST: APIRoute = async ({ params, request }) => {
  const code = params.code;
  if (!code) return new Response('Not found', { status: 404 });

  try {
    const body = await request.json();
    if (!body.optionId) {
      return new Response(JSON.stringify({ error: 'Missing optionId' }), { status: 400 });
    }

    const success = pollStore.vote(code, body.optionId);
    if (success) {
      return new Response(JSON.stringify({ success: true }));
    }
    return new Response(JSON.stringify({ error: 'Poll closed or invalid option' }), { status: 400 });
  } catch (err) {
    return new Response('Server error', { status: 500 });
  }
};
