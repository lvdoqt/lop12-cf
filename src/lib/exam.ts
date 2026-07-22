import { shuffleArrayWithPRNG } from './random';

export function buildShuffledExam(allQuestions: any[], prng: () => number) {
  const bySection = {
    mcq: allQuestions.filter(q => !q.type || q.type === 'mcq' || q.type === 'single_choice'), // fallback if missing
    multiple_choice: allQuestions.filter(q => q.type === 'multiple_choice'),
    msq: allQuestions.filter(q => q.type === 'msq'),
    sa: allQuestions.filter(q => q.type === 'sa'),
    true_false: allQuestions.filter(q => q.type === 'true_false'),
    tl: allQuestions.filter(q => q.type === 'tl'),
    read: allQuestions.filter(q => q.type === 'read'),
    read_cloze: allQuestions.filter(q => q.type === 'read_cloze'),
    ordering: allQuestions.filter(q => q.type === 'ordering'),
    list: allQuestions.filter(q => q.type === 'list'),
  };

  const shuffled = {
    mcq: shuffleArrayWithPRNG(bySection.mcq, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })),
    multiple_choice: shuffleArrayWithPRNG(bySection.multiple_choice, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })),
    msq: shuffleArrayWithPRNG(bySection.msq, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })),
    sa: shuffleArrayWithPRNG(bySection.sa, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })),
    true_false: shuffleArrayWithPRNG(bySection.true_false, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })),
    tl: shuffleArrayWithPRNG(bySection.tl, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })),
    
    // read: shuffle nhóm, shuffle câu con, shuffle phương án
    read: shuffleArrayWithPRNG(bySection.read, prng).map(q => shuffleReadQuestion(q, prng, true)),
    
    // read_cloze: shuffle nhóm (passage), KHÔNG shuffle sub-questions bên trong vì các khoảng trống (1), (2) có thứ tự, nhưng CÓ shuffle phương án
    read_cloze: shuffleArrayWithPRNG(bySection.read_cloze, prng).map(q => shuffleReadQuestion(q, prng, false)),
    
    // ordering: shuffle vị trí câu, KHÔNG shuffle đáp án (đáp án là chuỗi thứ tự có nghĩa)
    ordering: shuffleArrayWithPRNG(bySection.ordering, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })),
    
    // list: shuffle nhóm
    list: shuffleArrayWithPRNG(bySection.list, prng),
  };

  // Thứ tự sections theo cấu trúc đề:
  // mcq (single_choice) → msq → sa → tl → multiple_choice → read → list → read_cloze
  return [
    ...shuffled.mcq,
    ...shuffled.msq,
    ...shuffled.sa,
    ...shuffled.tl,
    ...shuffled.multiple_choice,
    ...shuffled.read,
    ...shuffled.list,
    ...shuffled.read_cloze,
    ...shuffled.ordering,
    ...shuffled.true_false,
  ];
}

function shuffleReadQuestion(q: any, prng: () => number, shuffleSubquestions = true) {
  const cloned = JSON.parse(JSON.stringify(q));
  let subs = cloned.metadata?.questions;
  
  // Backwards compatibility with old data structure
  if (!subs && cloned.questions) {
    subs = cloned.questions;
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
