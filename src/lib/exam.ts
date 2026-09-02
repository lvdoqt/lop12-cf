import { shuffleArrayWithPRNG } from './random';
import type { Question, Answer } from '../types';

export type ExamQuestion = Question & { answers: Answer[] };

export function buildShuffledExam(allQuestions: ExamQuestion[], prng: () => number): ExamQuestion[] {
  // Presence of matching identifies a V-SAT paper. Preserve the official section
  // sequence and author-entered group order; candidate randomization can be added
  // later without breaking grouped passages/matching keys.
  if (allQuestions.some(q => q.type === 'matching')) {
    const order: Record<string, number> = { msq: 0, single_choice: 1, read: 1, matching: 2, sa: 3, cloze_text: 3 };
    return allQuestions
      .map((q, index) => ({ q, index }))
      .sort((a, b) => (order[a.q.type] ?? 9) - (order[b.q.type] ?? 9) || a.index - b.index)
      .map(x => x.q);
  }
  const bySection = {
    mcq: allQuestions.filter(q => !q.type || q.type === 'single_choice'), // fallback if missing
    multiple_choice: allQuestions.filter(q => q.type === 'multiple_choice'),
    msq: allQuestions.filter(q => q.type === 'msq'),
    sa: allQuestions.filter(q => q.type === 'sa'),
    true_false: allQuestions.filter(q => q.type === 'true_false'),
    tl: allQuestions.filter(q => q.type === 'tl'),
    read: allQuestions.filter(q => q.type === 'read'),
    read_cloze: allQuestions.filter(q => q.type === 'read_cloze'),
    ordering: allQuestions.filter(q => q.type === 'ordering'),
    list: allQuestions.filter(q => q.type === 'list'),
    matching: allQuestions.filter(q => q.type === 'matching'),
    cloze_text: allQuestions.filter(q => q.type === 'cloze_text'),
  };

  const shuffled = {
    mcq: shuffleArrayWithPRNG(bySection.mcq, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })),
    multiple_choice: shuffleArrayWithPRNG(bySection.multiple_choice, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })),
    msq: shuffleArrayWithPRNG(bySection.msq, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })),
    sa: shuffleArrayWithPRNG(bySection.sa, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })),
    true_false: shuffleArrayWithPRNG(bySection.true_false, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })),
    tl: shuffleArrayWithPRNG(bySection.tl, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })),
    
    // ordering: shuffle vị trí câu, KHÔNG shuffle đáp án (đáp án là chuỗi thứ tự có nghĩa)
    ordering: shuffleArrayWithPRNG(bySection.ordering, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })),
    
    // list: shuffle nhóm
    list: shuffleArrayWithPRNG(bySection.list, prng),
    // V-SAT matching groups keep their prompt/option order, just like the official UI.
    matching: bySection.matching,
    cloze_text: bySection.cloze_text,
  };

  // Gộp read + read_cloze thành 1 pool rồi shuffle chung
  const readPool = [
    ...bySection.read.map(q => shuffleReadQuestion(q, prng, true)),
    ...bySection.read_cloze.map(q => shuffleReadQuestion(q, prng, false)),
  ];
  const shuffledReadPool = shuffleArrayWithPRNG(readPool, prng);

  // Thứ tự sections theo cấu trúc đề:
  // mcq (single_choice) → [read + read_cloze trộn] → msq → sa → tl → multiple_choice → list → ordering → true_false
  return [
    ...shuffled.mcq,
    ...shuffledReadPool,
    ...shuffled.msq,
    ...shuffled.sa,
    ...shuffled.tl,
    ...shuffled.multiple_choice,
    ...shuffled.list,
    ...shuffled.matching,
    ...shuffled.cloze_text,
    ...shuffled.ordering,
    ...shuffled.true_false,
  ];
}

function shuffleReadQuestion(q: ExamQuestion, prng: () => number, shuffleSubquestions = true): ExamQuestion {
  const cloned: ExamQuestion = JSON.parse(JSON.stringify(q));
  let subs = cloned.metadata?.questions;
  
  // Backwards compatibility with old data structure
  if (!subs && (cloned as any).questions) {
    subs = (cloned as any).questions;
  }
  
  if (!subs || !Array.isArray(subs)) return cloned;

  // Shuffle options for each subquestion
  subs.forEach((sq: any) => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const validOptions: { letter: string; text: string }[] = [];
    
    // Collect non-empty options
    for (const l of letters) {
      const text = sq[`option_${l.toLowerCase()}`];
      if (text !== undefined && text !== '') {
        validOptions.push({ letter: l, text });
      }
    }
    
    if (validOptions.length === 0) return;

    const originalCorrectLetter = sq.correct_option;
    
    // Shuffle the options
    const shuffledOptions = shuffleArrayWithPRNG(validOptions, prng);
    
    // Assign back
    shuffledOptions.forEach((opt, idx) => {
      const newLetter = letters[idx];
      sq[`option_${newLetter.toLowerCase()}`] = opt.text;
      
      if (opt.letter === originalCorrectLetter) {
        sq.correct_option = newLetter;
      }
    });
    
    // Clear unused option fields
    for (let i = shuffledOptions.length; i < letters.length; i++) {
      delete sq[`option_${letters[i].toLowerCase()}`];
    }
  });

  // Shuffle the subquestions array itself
  cloned.metadata = cloned.metadata || {};
  if (shuffleSubquestions) {
    cloned.metadata.questions = shuffleArrayWithPRNG(subs, prng);
  } else {
    cloned.metadata.questions = subs;
  }
  
  return cloned;
}
