import type { APIRoute } from 'astro';
import { roomStore, db } from '../../../../services/db';
import { uuidToSeed, mulberry32 } from '../../../../lib/random';
import { buildShuffledExam } from '../../../../lib/exam';

export const prerender = false;

// PATCH /api/rooms/[code]/progress — Student updates answered count (live progress)
export const PATCH: APIRoute = async ({ params, request }) => {
  const code = (params.code || '').toUpperCase();
  const room = roomStore.getRoomByCode(code);
  if (!room) return new Response(JSON.stringify({ error: 'Room not found' }), { status: 404 });

  try {
    const { participantId, answeredCount } = await request.json();
    if (!participantId) return new Response(JSON.stringify({ error: 'participantId required' }), { status: 400 });

    const updated = roomStore.updateProgress(participantId, answeredCount ?? 0);
    return new Response(JSON.stringify({ participant: updated }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

// POST /api/rooms/[code]/progress — Student submits final answers + score
export const POST: APIRoute = async ({ params, request }) => {
  const code = (params.code || '').toUpperCase();
  const room = roomStore.getRoomByCode(code);
  if (!room) return new Response(JSON.stringify({ error: 'Room not found' }), { status: 404 });

  try {
    const { participantId, answers } = await request.json();
    if (!participantId || !answers) {
      return new Response(JSON.stringify({ error: 'participantId and answers are required' }), { status: 400 });
    }

    const participant = roomStore.getParticipant(participantId);
    if (!participant) return new Response(JSON.stringify({ error: 'Participant not found' }), { status: 404 });

    // Grade: reuse same scoring logic as attempts.ts
    const examQuestions = await db.getQuestionsByExamId(room.exam_id);
    const prng = mulberry32(uuidToSeed(participantId));
    const shuffled = buildShuffledExam(examQuestions, prng);

    let totalScore = 0;
    const answeredCount = Object.keys(answers).length;

    shuffled.forEach(q => {
      const submitted = answers[q.id];
      if (!submitted) return;

      if (q.type === 'read' || q.type === 'list' || q.type === 'read_cloze') {
        const subs = (q.metadata && (q.metadata as any).questions) || [];
        if (submitted && typeof submitted === 'object' && !Array.isArray(submitted)) {
          subs.forEach((sq: any, i: number) => {
            const sel = (submitted as Record<string, string>)[String(i)];
            if (sel && String(sel).toUpperCase() === String(sq.correct_option || '').toUpperCase()) {
              totalScore += 0.25;
            }
          });
        }
        return;
      }

      const correctAnswers = q.answers.filter(a => a.is_correct).map(a => a.id);
      let isCorrect = false;

      if (q.type === 'single_choice' || q.type === 'true_false' || q.type === 'ordering') {
        const selectedId = typeof submitted === 'string' ? submitted : (submitted as any)[0];
        if (correctAnswers.includes(selectedId)) isCorrect = true;
      } else if (q.type === 'multiple_choice') {
        const selectedIds = Array.isArray(submitted) ? submitted : [submitted];
        const allCorrectSelected = correctAnswers.every(id => selectedIds.includes(id));
        const noIncorrectSelected = (selectedIds as string[]).every(id => correctAnswers.includes(id));
        if (allCorrectSelected && noIncorrectSelected && correctAnswers.length === selectedIds.length) isCorrect = true;
      } else if (q.type === 'msq') {
        if (typeof submitted === 'object' && submitted !== null) {
          let allCorrect = true;
          q.answers.forEach(a => {
            const studentChoice = (submitted as any)[a.id];
            const correctChoice = a.is_correct ? 'Dung' : 'Sai';
            if (studentChoice !== correctChoice && studentChoice !== (a.is_correct ? '\u0110\u00fang' : 'Sai')) allCorrect = false;
          });
          if (allCorrect && q.answers.length > 0) isCorrect = true;
        }
      } else if (q.type === 'sa') {
        if (typeof submitted === 'string' && q.answer) {
          const normSub = submitted.trim().toLowerCase().replace(/\s+/g, ' ').replace(',', '.');
          const normCorr = q.answer.trim().toLowerCase().replace(/\s+/g, ' ').replace(',', '.');
          if (normSub === normCorr) isCorrect = true;
          else {
            const nSub = Number(normSub); const nCorr = Number(normCorr);
            if (!isNaN(nSub) && !isNaN(nCorr) && nSub === nCorr) isCorrect = true;
          }
        }
      }

      if (isCorrect) totalScore += q.type === 'sa' ? 0.5 : 0.25;
    });

    const updated = roomStore.submitParticipant(participantId, totalScore, answeredCount);
    return new Response(JSON.stringify({ participant: updated, score: totalScore }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};