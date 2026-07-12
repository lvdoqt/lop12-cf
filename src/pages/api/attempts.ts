import type { APIRoute } from 'astro';

export const prerender = false;
import { db } from '../../services/db';

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

    let correctCount = 0;
    let totalCount = 0;

    // 3. Grade each question
    examQuestions.forEach(q => {
      const submitted = answers[q.id]; // Can be string, string[], or Record/string for msq/sa

      // Read / Listen: each sub-question counts individually
      if (q.type === 'read' || q.type === 'list') {
        const subs = (q.metadata && (q.metadata as any).questions) || [];
        totalCount += subs.length;
        if (submitted && typeof submitted === 'object' && !Array.isArray(submitted)) {
          subs.forEach((sq: any, i: number) => {
            const sel = (submitted as Record<string, string>)[String(i)];
            if (sel && String(sel).toUpperCase() === String(sq.correct_option || '').toUpperCase()) {
              correctCount++;
            }
          });
        }
        return;
      }

      const correctAnswers = q.answers.filter(a => a.is_correct).map(a => a.id);
      totalCount += 1;

      if (!submitted) {
        return; // Left blank
      }

      if (q.type === 'single_choice' || q.type === 'true_false') {
        // Submitted is a string representing the answer ID
        const selectedId = typeof submitted === 'string' ? submitted : submitted[0];
        if (correctAnswers.includes(selectedId)) {
          correctCount++;
        }
      } else if (q.type === 'multiple_choice') {
        // Submitted should be an array of answer IDs
        const selectedIds = Array.isArray(submitted) ? submitted : [submitted];
        
        // Check if selected matches correct answers exactly (all correct selected and no incorrect selected)
        const allCorrectSelected = correctAnswers.every(id => selectedIds.includes(id));
        const noIncorrectSelected = selectedIds.every(id => correctAnswers.includes(id));
        
        if (allCorrectSelected && noIncorrectSelected && correctAnswers.length === selectedIds.length) {
          correctCount++;
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
            correctCount++;
          }
        }
      } else if (q.type === 'sa') {
        // Submitted is a string answer
        if (typeof submitted === 'string' && q.answer) {
          const normSubmitted = submitted.trim().toLowerCase().replace(/\s+/g, ' ').replace(',', '.');
          const normCorrect = q.answer.trim().toLowerCase().replace(/\s+/g, ' ').replace(',', '.');
          
          if (normSubmitted === normCorrect) {
            correctCount++;
          } else {
            const numSubmitted = Number(normSubmitted);
            const numCorrect = Number(normCorrect);
            if (!isNaN(numSubmitted) && !isNaN(numCorrect) && numSubmitted === numCorrect) {
              correctCount++;
            }
          }
        }
      }
    });

    // 4. Calculate score out of 10
    const rawScore = (correctCount / totalCount) * 10;
    const score = Math.round(rawScore * 100) / 100; // Round to 2 decimal places

    // 5. Save results to database
    const updatedAttempt = await db.submitAttempt(attemptId, score, answers);

    return new Response(JSON.stringify({
      success: true,
      score,
      correctCount,
      totalCount,
      attempt: updatedAttempt
    }), { status: 200 });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
