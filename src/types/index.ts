export interface User {
  id: string;
  email: string;
  fullname: string | null;
  avatar_url: string | null;
  role: 'student' | 'teacher' | 'admin';
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  slug: string;
}

export interface Category {
  id: string;
  subject_id: string;
  name: string;
  slug: string;
  created_by: string | null;
  created_at: string;
}

export interface Lesson {
  id: string;
  subject_id: string;
  title: string;
  slug: string;
  description?: string | null;
  content: string | null;
  video_url: string | null;
  created_at: string;
}

export interface Question {
  id: string;
  de_id: string;
  so_cau: number;
  phan: string;
  content: string;
  options: any; // jsonb, typically string[]
  answer: string | null;
  image_url: string | null;
  metadata: {
    grade?: string;
    chapter?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    dang_toan?: string;
    type?: 'single_choice' | 'multiple_choice' | 'true_false' | 'msq' | 'sa' | 'tl' | 'read' | 'list' | 'read_cloze' | 'ordering' | 'matching' | 'cloze_text';
    explanation?: string | null;
    subject_id?: string;
    category_id?: string | null;
    [key: string]: any;
  } | null;
  created_at?: string;
  updated_at?: string;

  // Compatibility fields for the frontend
  subject_id: string;
  explanation: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'msq' | 'sa' | 'tl' | 'read' | 'list' | 'read_cloze' | 'ordering' | 'matching' | 'cloze_text';
  created_by?: string | null;
  category_id?: string | null;
}

export interface Answer {
  id: string;
  question_id: string;
  content: string;
  is_correct: boolean;
}

export interface Exam {
  id: string;
  slug: string;           // SEO-friendly URL slug, e.g. 'de-kiem-tra-15-phut-toan-12'
  title: string;
  duration: number; // in minutes
  subject_id: string;
  category_id?: string | null; // Chuyên mục (con của môn học)
  exam_type: '15m' | '45m' | 'semester' | 'mock_thpt' | 'vsat';
  password?: string | null; // Optional: if set, students must enter password before taking the exam
  created_by?: string | null; // UUID of the creator (teacher/admin)
  created_at: string;
}

export interface ExamQuestion {
  exam_id: string;
  question_id: string;
}

export interface Attempt {
  id: string;
  user_id: string;
  exam_id: string;
  score: number | null;
  /** Official V-SAT raw score, maximum 150. */
  raw_score?: number | null;
  /** IRT scaled score (mean 500, SD 100); null until calibrated externally. */
  ability_score?: number | null;
  answers_submitted: Record<string, string | string[] | boolean> | null; // question_id -> answer choice
  started_at: string;
  finished_at: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface Comment {
  id: string;
  blog_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface Blog {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  cover_url: string | null;
  created_by?: string | null; // UUID of the creator (teacher/admin)
  created_at: string;
  categories?: number[];
}

// ── Course (Khóa học) ──────────────────────────────────────────────────────
export interface Course {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  subject_id: string | null;
  cover_url: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
}

export interface CourseLesson {
  id: string;
  course_id: string;
  title: string;
  content: string | null;   // Markdown content
  video_url: string | null;
  order_index: number;
  duration: number | null;  // in minutes
  is_published: boolean;
  is_free: boolean;
  created_at: string;
}

export interface CourseEnrollment {
  id: string;
  course_id: string;
  user_id: string;
  enrolled_at: string;
}

export interface LessonProgress {
  id: string;
  lesson_id: string;
  user_id: string;
  completed: boolean;
  completed_at: string | null;
}

// ── Phòng thi ảo (Virtual Exam Room) ─────────────────────────────────────────

export interface ExamRoom {
  id: string;
  code: string;            // 6-char alphanum, e.g. 'A3K7P2'
  exam_id: string;
  exam_title?: string;     // denormalized for display
  exam_duration?: number;  // denormalized for display (minutes)
  teacher_id: string;
  status: 'waiting' | 'active' | 'closed';
  created_at: string;
  closed_at: string | null;
}

// ── Interactive Video Quizzes ─────────────────────────────────────────────────
export interface CourseLessonQuiz {
  id: string;
  lesson_id: string;
  timestamp_sec: number;   // second in video when player pauses
  question: string;
  options: string[];       // ["A. ...", "B. ...", "C. ...", "D. ..."]
  answer: string;          // correct letter: "A" | "B" | "C" | "D"
  explanation: string | null;
  order_index: number;
  created_at: string;
}

export interface VideoQuizResponse {
  id: string;
  quiz_id: string;
  lesson_id: string;
  user_id: string | null;   // null for guest
  guest_id: string | null;  // browser fingerprint for guests
  selected_answer: string;
  is_correct: boolean;
  attempt_number: number;
  answered_at: string;
}

// ── Notices for teachers ────────────────────────────────────────────────────
export type TeacherNoticeKind = 'task' | 'timetable';
export type TeacherNoticePriority = 'normal' | 'important' | 'urgent';

export interface TeacherNotice {
  id: string;
  kind: TeacherNoticeKind;
  title: string;
  content: string | null;
  priority: TeacherNoticePriority;
  due_at: string | null;
  image_url: string | null;
  is_published: boolean;
  created_by: string | null;
  /** null = thông báo chung; có giá trị = dữ liệu riêng của một giáo viên. */
  recipient_teacher_id: string | null;
  created_at: string;
}

/** Aggregated learning data for one enrolled user in a course. */
export interface CourseLearningStatistic {
  enrollment: CourseEnrollment & { user?: Pick<User, 'id' | 'fullname' | 'email' | 'avatar_url' | 'role'> };
  completedLessons: number;
  totalLessons: number;
  completionPercent: number;
  answeredQuizzes: number;
  totalQuizzes: number;
  correctQuizzes: number;
  quizAccuracy: number | null;
  lastActivityAt: string | null;
}

export interface RoomParticipant {
  id: string;
  room_id: string;
  display_name: string;
  joined_at: string;
  submitted_at: string | null;
  score: number | null;
  total_questions: number;
  answered_count: number; // how many questions answered so far
}
