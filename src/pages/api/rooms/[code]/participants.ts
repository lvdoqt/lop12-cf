import type { APIRoute } from 'astro';
import { roomStore } from '../../../../services/db';

export const prerender = false;

// GET /api/rooms/[code]/participants — Teacher polls participant list + progress
export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const code = (params.code || '').toUpperCase();
  const room = roomStore.getRoomByCode(code);
  if (!room) return new Response(JSON.stringify({ error: 'Room not found' }), { status: 404 });
  if (room.teacher_id !== user.id) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const participants = roomStore.getParticipants(room.id);
  return new Response(JSON.stringify({ participants, room }), { status: 200 });
};