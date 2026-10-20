import type { APIRoute } from 'astro';
import { db } from '../../../../services/db';

export const prerender = false;

/** GET /api/classes/[id]/members — get class members */
export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const members = await db.getClassMembers(params.id!);
  return new Response(JSON.stringify(members), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

/** POST /api/classes/[id]/members — add a member by userId */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const { userId } = await request.json();
    if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400 });
    await db.addClassMember(params.id!, userId);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

/** DELETE /api/classes/[id]/members — remove a member by userId */
export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const { userId } = await request.json();
    if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400 });
    await db.removeClassMember(params.id!, userId);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
