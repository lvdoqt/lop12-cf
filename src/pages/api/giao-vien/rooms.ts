import type { APIRoute } from 'astro';
import { roomStore } from '../../../services/db';

export const prerender = false;

// POST /api/giao-vien/rooms — Create a new exam room (teacher only)
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { examId } = await request.json();
    if (!examId) {
      return new Response(JSON.stringify({ error: 'examId is required' }), { status: 400 });
    }

    const room = await roomStore.createRoom(examId, user.id);
    return new Response(JSON.stringify({ room }), { status: 201 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

// DELETE /api/giao-vien/rooms?id=... — Close a room
export const DELETE: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const roomId = url.searchParams.get('id');
  if (!roomId) {
    return new Response(JSON.stringify({ error: 'id is required' }), { status: 400 });
  }

  const room = roomStore.getRoomById(roomId);
  if (!room) {
    return new Response(JSON.stringify({ error: 'Room not found' }), { status: 404 });
  }
  if (room.teacher_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const closed = roomStore.closeRoom(roomId);
  return new Response(JSON.stringify({ room: closed }), { status: 200 });
};

// PATCH /api/giao-vien/rooms — Activate a room
export const PATCH: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { roomId } = await request.json();
    if (!roomId) {
      return new Response(JSON.stringify({ error: 'roomId is required' }), { status: 400 });
    }

    const room = roomStore.getRoomById(roomId);
    if (!room) return new Response(JSON.stringify({ error: 'Room not found' }), { status: 404 });
    if (room.teacher_id !== user.id) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

    const activated = roomStore.activateRoom(roomId);
    return new Response(JSON.stringify({ room: activated }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
