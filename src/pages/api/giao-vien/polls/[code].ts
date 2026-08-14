import type { APIRoute } from 'astro';
import { pollStore } from '../../../../services/mockPollStore';

export const GET: APIRoute = ({ params }) => {
  const code = params.code;
  if (!code) return new Response('Not found', { status: 404 });

  const poll = pollStore.getPollByCode(code);
  if (!poll) {
    return new Response(JSON.stringify({ error: 'Poll not found' }), { status: 404 });
  }

  return new Response(JSON.stringify(poll), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const code = params.code;
  if (!code) return new Response('Not found', { status: 404 });

  try {
    const body = await request.json();
    if (body.action === 'close') {
      const success = pollStore.closePoll(code, user.id);
      if (success) {
        return new Response(JSON.stringify({ success: true }));
      }
      return new Response(JSON.stringify({ error: 'Unauthorized or not found' }), { status: 403 });
    }
    return new Response('Invalid action', { status: 400 });
  } catch (err) {
    return new Response('Server error', { status: 500 });
  }
};
