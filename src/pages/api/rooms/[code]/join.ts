import type { APIRoute } from 'astro';
import { roomStore, db } from '../../../../services/db';

export const prerender = false;

// POST /api/rooms/[code]/join — Student joins a room
export const POST: APIRoute = async ({ params, request }) => {
  const code = (params.code || '').toUpperCase();
  const room = roomStore.getRoomByCode(code);

  if (!room) return new Response(JSON.stringify({ error: 'Phong thi khong ton tai' }), { status: 404 });
  if (room.status === 'closed') return new Response(JSON.stringify({ error: 'Phong thi da ket thuc' }), { status: 410 });

  try {
    const { displayName } = await request.json();
    if (!displayName || !displayName.trim()) {
      return new Response(JSON.stringify({ error: 'Ten hoc sinh la bat buoc' }), { status: 400 });
    }

    // Get question count for this exam
    let totalQuestions = 0;
    try {
      const questions = await db.getQuestionsByExamId(room.exam_id);
      totalQuestions = questions.length;
    } catch (_) {}

    const participant = roomStore.joinRoom(room.id, displayName.trim(), totalQuestions);

    return new Response(JSON.stringify({
      participant,
      room: {
        id: room.id,
        code: room.code,
        exam_id: room.exam_id,
        exam_title: room.exam_title,
        exam_duration: room.exam_duration,
        status: room.status,
      }
    }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};