import type { APIRoute } from 'astro';
import { pollStore } from '../../../../services/mockPollStore';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body.question || !Array.isArray(body.options) || body.options.length < 2) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400 });
    }

    const poll = pollStore.createPoll(body.question, body.options, user.id);
    return new Response(JSON.stringify(poll), { 
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};
