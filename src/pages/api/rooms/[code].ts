import type { APIRoute } from 'astro';
import { roomStore } from '../../../services/db';

export const prerender = false;

// GET /api/rooms/[code] — Public: get room info by code (for student join page)
export const GET: APIRoute = async ({ params }) => {
  const code = (params.code || '').toUpperCase();
  if (!code) {
    return new Response(JSON.stringify({ error: 'Code required' }), { status: 400 });
  }

  const room = roomStore.getRoomByCode(code);
  if (!room) {
    return new Response(JSON.stringify({ error: 'Phong thi khong ton tai' }), { status: 404 });
  }
  if (room.status === 'closed') {
    return new Response(JSON.stringify({ error: 'Phong thi da ket thuc' }), { status: 410 });
  }

  return new Response(JSON.stringify({
    room: {
      id: room.id,
      code: room.code,
      exam_title: room.exam_title,
      exam_duration: room.exam_duration,
      status: room.status,
    }
  }), { status: 200 });
};