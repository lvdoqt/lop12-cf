# Task: Interactive Video Quiz (H5P-style)

- [x] Migration SQL: `course_lesson_quizzes` + `video_quiz_responses`
- [x] Types: `CourseLessonQuiz`, `VideoQuizResponse`
- [x] db.ts: `getVideoQuizzes`, `saveVideoQuizResponse`, `getVideoQuizResponses` (+ mock)
- [x] API `GET /api/courses/video-quizzes` — quiz list cho lesson
- [x] API `POST /api/courses/video-quiz-response` — ghi nhận câu trả lời
- [x] Lesson page `[lessonId].astro` — Interactive player overlay
- [x] Admin page: `/admin/courses/[courseId]/lessons/[lessonId]/quizzes.astro`
- [x] Admin API: CRUD (`POST`, `PUT`, `DELETE` for video quizzes)
- [x] Admin: quiz analytics per lesson (included in quizzes admin page)
- [x] Linked Quiz Management page from Lesson Edit page
