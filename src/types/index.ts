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
    type?: 'single_choice' | 'multiple_choice' | 'true_false' | 'msq' | 'sa' | 'tl' | 'read' | 'list';
    explanation?: string | null;
    subject_id?: string;
    [key: string]: any;
  } | null;
  created_at?: string;
  updated_at?: string;

  // Compatibility fields for the frontend
  subject_id: string;
  explanation: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'msq' | 'sa' | 'tl' | 'read' | 'list';
  created_by?: string | null;
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
  exam_type: '15m' | '45m' | 'semester' | 'mock_thpt';
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

