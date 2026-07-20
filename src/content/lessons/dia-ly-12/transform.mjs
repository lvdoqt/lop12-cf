import { readFileSync, writeFileSync } from 'fs';

const files = [
  'dia12-bai-1-vi-tri-dia-li-va-pham-vi-lanh-tho.json',
  'dia12-bai-2-thien-nhien-nhiet-doi-am-gio-mua.json',
  'dia12-bai-3-su-phan-hoa-da-dang-cua-thien-nhien.json',
  'dia12-bai-5-van-de-su-dung-hop-li-tai-nguyen-va-bao-ve-moi-truong.json',
  'dia12-bai-6-dan-so-viet-nam.json',
  'dia12-bai-7-lao-dong-va-viec-lam.json',
  'dia12-bai-8-do-thi-hoa.json',
  'dia12-bai-10-chuyen-dich-co-cau-kinh-te.json',
  'dia12-bai-11-van-de-phat-trien-nganh-nong-nghiep.json',
];

for (const f of files) {
  const path = `D:/lop12-cf/src/content/lessons/dia-ly-12/${f}`;
  const raw = readFileSync(path, 'utf-8');
  const data = JSON.parse(raw);
  const lesson = data.lessons[0];
  const content = lesson.content;

  // --- File 1 (bai-1): already has exercises as array, skip ---
  if (Array.isArray(content.exercises)) {
    console.log(`${f}: ALREADY CORRECT (exercises is array with ${content.exercises.length} items) — skipped`);
    continue;
  }

  // --- Gather existing quiz items and short_answers ---
  const quizItems = content.quiz || [];
  const shortAnswers = (content.exercises && content.exercises.short_answers) || [];

  // Find max ID from quiz items
  let maxId = 0;
  for (const q of quizItems) {
    if (q.id > maxId) maxId = q.id;
  }

  // Convert short_answers to SA format
  const converted = shortAnswers.map((sa, idx) => ({
    id: maxId + idx + 1,
    type: 'sa',
    question: sa.q,
    correct: sa.a_hint,
    explanation: sa.a_hint,
  }));

  // New exercises array: all quiz items + converted short_answers
  const newExercises = [...quizItems, ...converted];

  // Remove old quiz and exercises key, set exercises to new array
  delete content.quiz;
  delete content.exercises;
  content.exercises = newExercises;

  // Clean up extra spacing before "exercises" key if there was a dangling comma
  // Write back with 2-space indent, preserving key order
  const output = JSON.stringify(data, null, 2) + '\n';
  writeFileSync(path, output, 'utf-8');

  const saCount = shortAnswers.length;
  const quizCount = quizItems.length;
  console.log(`${f}: OK — merged ${quizCount} quiz items + ${saCount} short_answers → ${newExercises.length} exercises (IDs 1..${newExercises.length})`);
}
