import type { APIRoute } from 'astro';

export const prerender = false;
import { db } from '../../services/db';

import { uuidToSeed, mulberry32 } from '../../lib/random';
import { buildShuffledExam } from '../../lib/exam';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { attemptId, answers } = await request.json();
    
    if (!attemptId || !answers) {
      return new Response(JSON.stringify({ error: 'Attempt ID and answers are required' }), { status: 400 });
    }

    // 1. Get the attempt details to know which exam is being taken
    const attempt = await db.getAttemptById(attemptId);
    if (!attempt) {
      return new Response(JSON.stringify({ error: 'Attempt not found' }), { status: 404 });
    }

    // 2. Fetch all questions and correct answers for this exam
    const examQuestions = await db.getQuestionsByExamId(attempt.exam_id);
    if (examQuestions.length === 0) {
      return new Response(JSON.stringify({ error: 'No questions found for this exam' }), { status: 400 });
    }

    // 3. Shuffle exactly as the client saw it
    const prng = mulberry32(uuidToSeed(attemptId));
    const shuffledExamQuestions = buildShuffledExam(examQuestions, prng);

    let totalScore = 0;

    // 4. Grade each question based on the shuffled state
    shuffledExamQuestions.forEach(q => {
      const submitted = answers[q.id]; // Can be string, string[], or Record/string for msq/sa

      // Read / Listen / Cloze (read_cloze): each sub-question counts individually
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

      if (!submitted) {
        return; // Left blank
      }

      let isCorrect = false;

      // ordering: treat same as single_choice (answer ID comparison)
      if (q.type === 'single_choice' || q.type === 'true_false' || q.type === 'ordering') {
        // Submitted is a string representing the answer ID
        const selectedId = typeof submitted === 'string' ? submitted : submitted[0];
        if (correctAnswers.includes(selectedId)) {
          isCorrect = true;
        }
      } else if (q.type === 'multiple_choice') {
        // Submitted should be an array of answer IDs
        const selectedIds = Array.isArray(submitted) ? submitted : [submitted];
        
        // Check if selected matches correct answers exactly (all correct selected and no incorrect selected)
        const allCorrectSelected = correctAnswers.every(id => selectedIds.includes(id));
        const noIncorrectSelected = selectedIds.every(id => correctAnswers.includes(id));
        
        if (allCorrectSelected && noIncorrectSelected && correctAnswers.length === selectedIds.length) {
          isCorrect = true;
        }
      } else if (q.type === 'msq') {
        // Submitted is an object mapping option ID -> "Đúng" or "Sai"
        if (typeof submitted === 'object' && submitted !== null) {
          let allCorrect = true;
          q.answers.forEach(a => {
            const studentChoice = (submitted as any)[a.id];
            const correctChoice = a.is_correct ? 'Đúng' : 'Sai';
            if (studentChoice !== correctChoice) {
              allCorrect = false;
            }
          });
          if (allCorrect && q.answers.length > 0) {
            isCorrect = true;
          }
        }
      } else if (q.type === 'sa') {
        // Submitted is a string answer
        if (typeof submitted === 'string' && q.answer) {
          const normSubmitted = submitted.trim().toLowerCase().replace(/\s+/g, ' ').replace(',', '.');
          const normCorrect = q.answer.trim().toLowerCase().replace(/\s+/g, ' ').replace(',', '.');
          
          if (normSubmitted === normCorrect) {
            isCorrect = true;
          } else {
            const numSubmitted = Number(normSubmitted);
            const numCorrect = Number(normCorrect);
            if (!isNaN(numSubmitted) && !isNaN(numCorrect) && numSubmitted === numCorrect) {
              isCorrect = true;
            }
          }
        }
      }

      if (isCorrect) {
        if (q.type === 'sa') {
          totalScore += 0.5;
        } else {
          totalScore += 0.25;
        }
      }
    });

    const score = totalScore; // Absolute points

    // 5. Save results to database
    const updatedAttempt = await db.submitAttempt(attemptId, score, answers);

    return new Response(JSON.stringify({
      success: true,
      score,
      attempt: updatedAttempt
    }), { status: 200 });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
