import { isMockMode, isMockModeForEnv, supabase, createAdminSupabase, createServerSupabase } from '../lib/supabase';
import type { Subject, Lesson, Question, Answer, Exam, Attempt, User, Blog, Comment, Course, CourseLesson, CourseEnrollment, LessonProgress, Category, CourseLessonQuiz, VideoQuizResponse, CourseLessonReviewQuestion, CourseLessonReviewAttempt, CourseLessonReviewAnswer, CourseLearningStatistic, LearnerSkillMastery, UserCourseInsights, TeacherNotice } from '../types';

// Ã¢â€â‚¬Ã¢â€â‚¬ Cloudflare runtime env injection Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Middleware calls setRuntimeEnv() per-request with Cloudflare runtime.env.
// All db functions use _runtimeEnv() to create Supabase clients correctly on CF Pages.
let _cachedRuntimeEnv: Record<string, string | undefined> | undefined;

export function setRuntimeEnv(env: Record<string, string | undefined> | undefined) {
  _cachedRuntimeEnv = env;
}

/** True if running in mock mode considering both static env and CF runtime env */
function isInMockMode(): boolean {
  return isMockModeForEnv(_cachedRuntimeEnv);
}

/** Get admin Supabase client, aware of CF runtime env */
function adminClient() {
  return createAdminSupabase(_cachedRuntimeEnv);
}

/** Get anon Supabase client, aware of CF runtime env */
function anonClient() {
  return createServerSupabase(_cachedRuntimeEnv) || supabase;
}


// ============================================================================
// SLUGIFY UTILITY (Vietnamese-aware)
// ============================================================================
function slugify(text: string): string {
  const map: Record<string, string> = {
    'ÃƒÂ ':'a','ÃƒÂ¡':'a','Ã¡ÂºÂ¡':'a','Ã¡ÂºÂ£':'a','ÃƒÂ£':'a','ÃƒÂ¢':'a','Ã¡ÂºÂ§':'a','Ã¡ÂºÂ¥':'a','Ã¡ÂºÂ­':'a','Ã¡ÂºÂ©':'a','Ã¡ÂºÂ«':'a',
    'Ã„Æ’':'a','Ã¡ÂºÂ±':'a','Ã¡ÂºÂ¯':'a','Ã¡ÂºÂ·':'a','Ã¡ÂºÂ³':'a','Ã¡ÂºÂµ':'a',
    'ÃƒÂ¨':'e','ÃƒÂ©':'e','Ã¡ÂºÂ¹':'e','Ã¡ÂºÂ»':'e','Ã¡ÂºÂ½':'e','ÃƒÂª':'e','Ã¡Â»Â':'e','Ã¡ÂºÂ¿':'e','Ã¡Â»â€¡':'e','Ã¡Â»Æ’':'e','Ã¡Â»â€¦':'e',
    'ÃƒÂ¬':'i','ÃƒÂ­':'i','Ã¡Â»â€¹':'i','Ã¡Â»â€°':'i','Ã„Â©':'i',
    'ÃƒÂ²':'o','ÃƒÂ³':'o','Ã¡Â»Â':'o','Ã¡Â»Â':'o','ÃƒÂµ':'o','ÃƒÂ´':'o','Ã¡Â»â€œ':'o','Ã¡Â»â€˜':'o','Ã¡Â»â„¢':'o','Ã¡Â»â€¢':'o','Ã¡Â»â€”':'o',
    'Ã†Â¡':'o','Ã¡Â»Â':'o','Ã¡Â»â€º':'o','Ã¡Â»Â£':'o','Ã¡Â»Å¸':'o','Ã¡Â»Â¡':'o',
    'ÃƒÂ¹':'u','ÃƒÂº':'u','Ã¡Â»Â¥':'u','Ã¡Â»Â§':'u','Ã…Â©':'u','Ã†Â°':'u','Ã¡Â»Â«':'u','Ã¡Â»Â©':'u','Ã¡Â»Â±':'u','Ã¡Â»Â­':'u','Ã¡Â»Â¯':'u',
    'Ã¡Â»Â³':'y','ÃƒÂ½':'y','Ã¡Â»Âµ':'y','Ã¡Â»Â·':'y','Ã¡Â»Â¹':'y',
    'Ã„â€˜':'d',
    'Ãƒâ‚¬':'a','ÃƒÂ':'a','Ã¡ÂºÂ ':'a','Ã¡ÂºÂ¢':'a','ÃƒÆ’':'a','Ãƒâ€š':'a','Ã¡ÂºÂ¦':'a','Ã¡ÂºÂ¤':'a','Ã¡ÂºÂ¬':'a','Ã¡ÂºÂ¨':'a','Ã¡ÂºÂª':'a',
    'Ã„â€š':'a','Ã¡ÂºÂ°':'a','Ã¡ÂºÂ®':'a','Ã¡ÂºÂ¶':'a','Ã¡ÂºÂ²':'a','Ã¡ÂºÂ´':'a',
    'ÃƒË†':'e','Ãƒâ€°':'e','Ã¡ÂºÂ¸':'e','Ã¡ÂºÂº':'e','Ã¡ÂºÂ¼':'e','ÃƒÅ ':'e','Ã¡Â»â‚¬':'e','Ã¡ÂºÂ¾':'e','Ã¡Â»â€ ':'e','Ã¡Â»â€š':'e','Ã¡Â»â€ž':'e',
    'ÃƒÅ’':'i','ÃƒÂ':'i','Ã¡Â»Å ':'i','Ã¡Â»Ë†':'i','Ã„Â¨':'i',
    'Ãƒâ€™':'o','Ãƒâ€œ':'o','Ã¡Â»Å’':'o','Ã¡Â»Å½':'o','Ãƒâ€¢':'o','Ãƒâ€':'o','Ã¡Â»â€™':'o','Ã¡Â»Â':'o','Ã¡Â»Ëœ':'o','Ã¡Â»â€':'o','Ã¡Â»â€“':'o',
    'Ã†Â ':'o','Ã¡Â»Å“':'o','Ã¡Â»Å¡':'o','Ã¡Â»Â¢':'o','Ã¡Â»Å¾':'o','Ã¡Â»Â ':'o',
    'Ãƒâ„¢':'u','ÃƒÅ¡':'u','Ã¡Â»Â¤':'u','Ã¡Â»Â¦':'u','Ã…Â¨':'u','Ã†Â¯':'u','Ã¡Â»Âª':'u','Ã¡Â»Â¨':'u','Ã¡Â»Â°':'u','Ã¡Â»Â¬':'u','Ã¡Â»Â®':'u',
    'Ã¡Â»Â²':'y','ÃƒÂ':'y','Ã¡Â»Â´':'y','Ã¡Â»Â¶':'y','Ã¡Â»Â¸':'y',
    'Ã„Â':'d',
  };
  return text
    .split('').map(c => map[c] || c).join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80); // max 80 chars
}

export function generateExamSlug(title: string, suffix?: string): string {
  const base = slugify(title);
  const unique = suffix || Date.now().toString(36); // e.g. 'lrqj7k'
  return base ? `${base}-${unique}` : unique;
}

// ============================================================================
// STATEFUL MOCK DATABASE (In-Memory for SSR Server / Local Testing)
// ============================================================================
let mockSubjects: Subject[] = [];

interface MockQuestion extends Omit<Question, 'options'> {
  options: string[];
}

let mockQuestions: MockQuestion[] = [];

let mockAnswers: Answer[] = [];

let mockExams: Exam[] = [];

// Junction table: links exams to bank questions (mirrors exam_questions in Supabase)
let mockExamQuestions: { exam_id: string; question_id: string; so_cau: number; phan: string }[] = [];

let mockAttempts: Attempt[] = [];

let mockComments: Comment[] = [];

// Ã¢â€â‚¬Ã¢â€â‚¬ Course mock data Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
let mockCourses: Course[] = [];

let mockCourseLessons: CourseLesson[] = [];

let mockEnrollments: CourseEnrollment[] = [];
let mockLessonProgress: LessonProgress[] = [];

// ── Video quiz mock data ──────────────────────────────────────────────────────
let mockVideoQuizzes: CourseLessonQuiz[] = [];
let mockVideoQuizResponses: VideoQuizResponse[] = [];
let mockReviewQuestions: CourseLessonReviewQuestion[] = [];
let mockReviewAttempts: CourseLessonReviewAttempt[] = [];
let mockReviewAnswers: CourseLessonReviewAnswer[] = [];
let mockTeacherNotices: TeacherNotice[] = [];

let mockBlogs: Blog[] = [];

let mockCategories: Category[] = [];


let mockUsers: User[] = [
  {
    id: 'mock-user-student',
    email: 'student@lop12.vn',
    fullname: 'Học Sinh Thử Nghiệm',
    avatar_url: null,
    role: 'student',
    created_at: new Date().toISOString()
  },
  {
    id: 'mock-user-teacher',
    email: 'teacher@lop12.vn',
    fullname: 'Giáo Viên Thử Nghiệm',
    avatar_url: null,
    role: 'teacher',
    created_at: new Date().toISOString()
  },
  {
    id: 'mock-user-admin',
    email: 'admin@lop12.vn',
    fullname: 'Quản Trị Viên',
    avatar_url: null,
    role: 'admin',
    created_at: new Date().toISOString()
  }
];

function mapWPPostToBlog(post: any): Blog {
  const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
  const cover_url = featuredMedia?.source_url || featuredMedia?.media_details?.sizes?.medium?.source_url || null;
  const authorName = post._embedded?.author?.[0]?.name || null;

  // Clean excerpt.rendered from HTML tags for the summary
  let summary = post.excerpt?.rendered || '';
  summary = summary.replace(/<\/?[^>]+(>|$)/g, '').trim();

  return {
    id: String(post.id),
    title: post.title?.rendered || '',
    slug: post.slug || '',
    summary: summary || null,
    content: post.content?.rendered || null,
    cover_url,
    created_by: authorName,
    created_at: post.date || new Date().toISOString(),
    categories: post.categories || []
  };
}

// Helper to map DB Question to App Question format
function mapDbQuestionToAppQuestion(dbQ: any): Question & { answers: Answer[], subject?: Subject } {
  const metadata = dbQ.metadata || {};
  const difficulty = metadata.difficulty || 'medium';
  const qType = metadata.type || 'single_choice';
  const explanation = metadata.explanation || null;
  const subjectId = metadata.subject_id || '';
  const createdBy = metadata.created_by || null;
  const categoryId = metadata.category_id || null;

  const rawOptions = Array.isArray(dbQ.options) ? dbQ.options : [];
  const correctLetters = (dbQ.answer || '').split(',').map((l: string) => l.trim().toUpperCase());

  const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const answers: Answer[] = rawOptions.map((opt: string, idx: number) => {
    const letter = alphabet[idx] || String(idx);
    const isCorrect = correctLetters.includes(letter);
    return {
      id: `${dbQ.id}-${letter}`,
      question_id: dbQ.id,
      content: opt,
      is_correct: isCorrect
    };
  });

  return {
    id: dbQ.id,
    de_id: dbQ.de_id,
    so_cau: dbQ.so_cau,
    phan: dbQ.phan,
    content: dbQ.content,
    options: dbQ.options,
    answer: dbQ.answer,
    image_url: dbQ.image_url,
    metadata: dbQ.metadata,
    created_at: dbQ.created_at,
    updated_at: dbQ.updated_at,
    
    // Compatibility fields
    subject_id: subjectId,
    explanation: explanation,
    difficulty: difficulty,
    type: qType,
    answers: answers,
    created_by: createdBy,
    category_id: categoryId
  };
}

export const db = {
  // --------------------------------------------------------------------------
  // SUBJECTS
  // --------------------------------------------------------------------------
  async getSubjects(): Promise<Subject[]> {
    if (isInMockMode()) {
      return mockSubjects;
    }
    const client = adminClient();
    if (!client) return [];
    const { data, error } = await client.from('subjects').select('*').order('name');
    if (error) { console.error('[db.getSubjects] error:', error); return []; }
    return data || [];
  },

  async getSubjectBySlug(slug: string): Promise<Subject | null> {
    if (isInMockMode()) {
      return mockSubjects.find(s => s.slug === slug) || null;
    }
    const client = adminClient();
    if (!client) return null;
    const { data, error } = await client.from('subjects').select('*').eq('slug', slug).single();
    if (error) return null;
    return data;
  },


  // --------------------------------------------------------------------------
  // CATEGORIES (Chuyên mục — children of subjects)
  // --------------------------------------------------------------------------
  async getCategories(subjectId?: string, createdBy?: string): Promise<Category[]> {
    if (isInMockMode()) {
      let cats = mockCategories;
      if (subjectId) cats = cats.filter(c => c.subject_id === subjectId);
      if (createdBy) cats = cats.filter(c => c.created_by === createdBy);
      return cats;
    }
    const client = adminClient();
    if (!client) return [];
    let query = client.from('categories').select('*').order('name');
    if (subjectId) query = query.eq('subject_id', subjectId);
    if (createdBy) query = query.eq('created_by', createdBy);
    const { data, error } = await query;
    if (error) { console.error('[db.getCategories] error:', error); return []; }
    return data || [];
  },

  async createCategory(cat: Omit<Category, 'id' | 'created_at'>): Promise<Category> {
    if (isInMockMode()) {
      const newCat: Category = {
        ...cat,
        id: `cat-${Date.now()}`,
        created_at: new Date().toISOString()
      };
      mockCategories.push(newCat);
      return newCat;
    }
    const client = adminClient();
    if (!client) throw new Error('[db.createCategory] Admin client unavailable.');
    const { data, error } = await client.from('categories').insert([cat]).select().single();
    if (error) { console.error('[db.createCategory] error:', error); throw error; }
    return data;
  },

  async deleteCategory(id: string): Promise<void> {
    if (isInMockMode()) {
      mockCategories = mockCategories.filter(c => c.id !== id);
      return;
    }
    const client = adminClient();
    if (!client) throw new Error('[db.deleteCategory] Admin client unavailable.');
    const { error } = await client.from('categories').delete().eq('id', id);
    if (error) { console.error('[db.deleteCategory] error:', error); throw error; }
  },

  // --------------------------------------------------------------------------
  // EXAMS & EXAM QUESTIONS
  // --------------------------------------------------------------------------
  async getExams(subjectId?: string, createdBy?: string): Promise<(Exam & { subject?: Subject })[]> {
    if (isInMockMode()) {
      let exams = mockExams;
      if (subjectId) exams = mockExams.filter(e => e.subject_id === subjectId);
      if (createdBy) exams = exams.filter(e => e.created_by === createdBy);
      return exams.map(e => ({ ...e, subject: mockSubjects.find(s => s.id === e.subject_id) }));
    }
    // Use admin client to bypass RLS for server-side reads (auth.uid() is null in SSR)
    const client = adminClient()!;
    let query = client.from('exams').select('*, subject:subjects(*)').order('created_at', { ascending: false });
    if (subjectId) query = query.eq('subject_id', subjectId);
    if (createdBy) query = query.eq('created_by', createdBy);
    const { data, error } = await query;
    if (error) { console.error('[db.getExams] error:', error); throw error; }
    return data || [];
  },

  async getExamBySlug(slug: string): Promise<(Exam & { subject?: Subject }) | null> {
    if (isInMockMode()) {
      const exam = mockExams.find(e => e.slug === slug || e.id === slug);
      if (!exam) return null;
      return { ...exam, subject: mockSubjects.find(s => s.id === exam.subject_id) };
    }
    const client = adminClient()!;
    // Try by slug first, then fall back to id for backward compat with UUID URLs
    const { data: bySlug } = await client.from('exams').select('*, subject:subjects(*)').eq('slug', slug).single();
    if (bySlug) return bySlug;
    // Fallback: try as UUID id (for old links)
    const { data: byId } = await client.from('exams').select('*, subject:subjects(*)').eq('id', slug).single();
    return byId || null;
  },

  async getExamById(id: string): Promise<(Exam & { subject?: Subject }) | null> {
    if (isInMockMode()) {
      const exam = mockExams.find(e => e.id === id);
      if (!exam) return null;
      return { ...exam, subject: mockSubjects.find(s => s.id === exam.subject_id) };
    }
    // Use admin client to bypass RLS for server-side reads
    const client = adminClient()!;
    const { data, error } = await client.from('exams').select('*, subject:subjects(*)').eq('id', id).single();
    if (error) return null;
    return data;
  },


  async getExamAttemptCounts(examIds: string[]): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    if (examIds.length === 0) return counts;
    if (isInMockMode()) {
      for (const att of mockAttempts) {
        if (examIds.includes(att.exam_id) && att.finished_at !== null) {
          counts[att.exam_id] = (counts[att.exam_id] || 0) + 1;
        }
      }
      return counts;
    }
    const client = adminClient();
    const { data, error } = await client
      .from('attempts')
      .select('exam_id')
      .in('exam_id', examIds)
      .not('finished_at', 'is', null);
    if (data && !error) {
      for (const row of data) {
        counts[row.exam_id] = (counts[row.exam_id] || 0) + 1;
      }
    }
    return counts;
  },

  async getExamQuestionCounts(examIds: string[]): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    if (examIds.length === 0) return counts;

    if (isInMockMode()) {
      // In mock mode, track via mockExamQuestions
      for (const eq of mockExamQuestions) {
        if (examIds.includes(eq.exam_id)) {
          const q = mockQuestions.find(mq => mq.id === eq.question_id);
          let cnt = 1;
          if (q) {
             const type = (q as any).metadata?.type || (q as any).type;
             if (type === 'read' || type === 'read_cloze' || type === 'list' || type === 'matching' || type === 'cloze_text') {
               const subs = q.metadata?.questions || [];
               if (subs.length > 0) cnt = subs.length;
             }
          }
          counts[eq.exam_id] = (counts[eq.exam_id] || 0) + cnt;
        }
      }
      return counts;
    }

    const client = adminClient()!;
    // NOTE: `type` is NOT a column in the questions table — it is stored inside `metadata` JSONB.
    // Selecting `type` directly causes a Supabase error; use `metadata` only.
    const { data, error } = await client
      .from('exam_questions')
      .select('exam_id, questions!inner(metadata)')
      .in('exam_id', examIds);
    if (error) {
      console.error('[db.getExamQuestionCounts] Supabase error:', error.message);
    }
    if (data && !error) {
      for (const row of data) {
        if (row.exam_id && row.questions) {
          const q = Array.isArray(row.questions) ? row.questions[0] : row.questions;
          let cnt = 1;
          // type is stored inside metadata, not as a top-level column
          const type = q.metadata?.type;
          if (type === 'read' || type === 'read_cloze' || type === 'list' || type === 'matching' || type === 'cloze_text') {
            const subs = q.metadata?.questions || [];
            if (subs.length > 0) cnt = subs.length;
          }
          counts[row.exam_id] = (counts[row.exam_id] || 0) + cnt;
        }
      }
    }
    return counts;
  },

  async createExam(exam: Omit<Exam, 'id' | 'created_at' | 'slug'>, questionIds: string[]): Promise<Exam> {

    if (isInMockMode()) {
      const newExam: Exam = {
        ...exam,
        id: `exam-${Date.now()}`,
        slug: generateExamSlug(exam.title),
        created_at: new Date().toISOString()
      };
      mockExams.push(newExam);
      // Link questions via mock junction
      questionIds.forEach((qId, index) => {
        mockExamQuestions.push({ exam_id: newExam.id, question_id: qId, so_cau: index + 1, phan: 'I' });
      });
      return newExam;
    }

    // Auto-generate slug from title
    const slug = generateExamSlug(exam.title);
    const _adminCl = adminClient();
    if (!_adminCl) {
      throw new Error('[db.createExam] Admin Supabase client unavailable. Set SUPABASE_SERVICE_ROLE_KEY.');
    }
    const { data: newExam, error: examError } = await _adminCl
      .from('exams')
      .insert([{ ...exam, slug }])
      .select()
      .single();
    if (examError) { console.error('[db.createExam] error:', examError); throw examError; }

    if (questionIds.length > 0) {
      // Verify all IDs exist in the bank
      const { data: bankQs, error: verifyError } = await _adminCl
        .from('questions')
        .select('id')
        .in('id', questionIds)
        .eq('de_id', 'bank');
      if (verifyError) { console.error('[db.createExam] verify bank questions error:', verifyError); throw verifyError; }

      const validIds = new Set((bankQs || []).map((r: any) => r.id));

      const junctionRows = questionIds
        .filter(qId => validIds.has(qId))
        .map((qId, index) => ({
          exam_id: newExam.id,
          question_id: qId,
          so_cau: index + 1,
          phan: 'I'
        }));

      if (junctionRows.length > 0) {
        const { error: insError } = await _adminCl.from('exam_questions').insert(junctionRows);
        if (insError) { console.error('[db.createExam] exam_questions insert error:', insError); throw insError; }
      }
    }
    return newExam;
  },

  async updateExam(id: string, exam: Partial<Omit<Exam, 'id' | 'created_at'>>, questionIds?: string[]): Promise<Exam> {
    if (isInMockMode()) {
      const index = mockExams.findIndex(e => e.id === id);
      if (index === -1) throw new Error('Exam not found');
      mockExams[index] = { ...mockExams[index], ...exam };
      if (questionIds) {
        // Replace mock junction rows
        mockExamQuestions = mockExamQuestions.filter(eq => eq.exam_id !== id);
        questionIds.forEach((qId, idx) => {
          mockExamQuestions.push({ exam_id: id, question_id: qId, so_cau: idx + 1, phan: 'I' });
        });
      }
      return mockExams[index];
    }

    const _adminCl = adminClient();
    if (!_adminCl) {
      throw new Error('[db.updateExam] Admin Supabase client unavailable. Set SUPABASE_SERVICE_ROLE_KEY.');
    }
    const { data: updatedExam, error: examError } = await _adminCl.from('exams').update(exam).eq('id', id).select().single();
    if (examError) throw examError;

    if (questionIds) {
      // Replace exam_questions rows for this exam
      const { error: delError } = await _adminCl.from('exam_questions').delete().eq('exam_id', id);
      if (delError) throw delError;

      if (questionIds.length > 0) {
        const junctionRows = questionIds.map((qId, index) => ({
          exam_id: id,
          question_id: qId,
          so_cau: index + 1,
          phan: 'I'
        }));
        const { error: insError } = await _adminCl.from('exam_questions').insert(junctionRows);
        if (insError) throw insError;
      }
    }

    return updatedExam;
  },

  async updateExamWithQuestions(id: string, exam: Partial<Omit<Exam, 'id' | 'created_at'>>, questionsData?: any[]): Promise<Exam> {
    if (isInMockMode()) {
      const index = mockExams.findIndex(e => e.id === id);
      if (index === -1) throw new Error('Exam not found');
      mockExams[index] = { ...mockExams[index], ...exam };
      return mockExams[index];
    }

    const _adminCl = adminClient();
    if (!_adminCl) {
      throw new Error('[db.updateExamWithQuestions] Admin Supabase client unavailable.');
    }
    const { data: updatedExam, error: examError } = await _adminCl.from('exams').update(exam).eq('id', id).select().single();
    if (examError) throw examError;

    if (questionsData && questionsData.length > 0) {
      // Upsert each question into bank (de_id='bank'), then update exam_questions links
      const bankInserts = questionsData.map((q, index) => ({
        de_id: 'bank' as const,
        so_cau: q.so_cau || index + 1,
        phan: q.phan || 'I',
        content: q.content,
        options: q.options || [],
        answer: q.answer || null,
        image_url: q.image_url || null,
        metadata: {
          ...(q.metadata || {}),
          // preserve original parent_id if present
          ...(q.metadata?.parent_id ? {} : {})
        }
      }));

      let allQuestionLinks: { id: string; so_cau: number; phan: string }[] = [];
      let newQuestionsToInsert: any[] = [];
      
      for (let i = 0; i < questionsData.length; i++) {
        const q = questionsData[i];
        const isNew = !q.metadata?.parent_id || String(q.metadata.parent_id).startsWith('new-');
        
        if (!isNew) {
          const pId = q.metadata.parent_id;
          const { error: updErr } = await _adminCl.from('questions').update({
            content: q.content,
            options: q.options || [],
            answer: q.answer || null,
            image_url: q.image_url || null,
            metadata: q.metadata || {}
          }).eq('id', pId);
          if (updErr) { console.error('[db.updateExamWithQuestions] update error:', updErr); throw updErr; }
          
          allQuestionLinks.push({ id: pId, so_cau: q.so_cau || i + 1, phan: q.phan || 'I' });
        } else {
          // Put placeholder, we will fill it after insert
          allQuestionLinks.push({ id: `new-index-${newQuestionsToInsert.length}`, so_cau: q.so_cau || i + 1, phan: q.phan || 'I' });
          
          const { parent_id, ...cleanMetadata } = q.metadata || {};
          newQuestionsToInsert.push({
            de_id: 'bank' as const,
            so_cau: 0, // will set later
            phan: q.phan || 'I',
            content: q.content,
            options: q.options || [],
            answer: q.answer || null,
            image_url: q.image_url || null,
            metadata: cleanMetadata
          });
        }
      }

      // Insert truly new questions into bank
      if (newQuestionsToInsert.length > 0) {
        const { data: maxData } = await _adminCl
          .from('questions')
          .select('so_cau')
          .eq('de_id', 'bank')
          .order('so_cau', { ascending: false })
          .limit(1);
        let nextSoCau = ((maxData?.[0]?.so_cau) || 0) + 1;
        
        newQuestionsToInsert.forEach((nq, i) => {
          nq.so_cau = nextSoCau + i;
        });

        const { data: inserted, error: insErr } = await _adminCl
          .from('questions')
          .insert(newQuestionsToInsert)
          .select('id');
        if (insErr) { console.error('[db.updateExamWithQuestions] insert new error:', insErr); throw insErr; }

        let insertedIndex = 0;
        for (let i = 0; i < allQuestionLinks.length; i++) {
          if (allQuestionLinks[i].id.startsWith('new-index-')) {
            allQuestionLinks[i].id = inserted![insertedIndex].id;
            insertedIndex++;
          }
        }
      }

      // Replace exam_questions rows
      const { error: delError } = await _adminCl.from('exam_questions').delete().eq('exam_id', id);
      if (delError) throw delError;

      if (allQuestionLinks.length > 0) {
        const junctionRows = allQuestionLinks.map((q, index) => ({
          exam_id: id,
          question_id: q.id,
          so_cau: index + 1,
          phan: q.phan || 'I'
        }));
        const { error: junctionErr } = await _adminCl.from('exam_questions').insert(junctionRows);
        if (junctionErr) { console.error('[db.updateExamWithQuestions] exam_questions insert error:', junctionErr); throw junctionErr; }
      }
    }

    return updatedExam;
  },

  async deleteExam(id: string): Promise<void> {
    if (isInMockMode()) {
      mockExams = mockExams.filter(e => e.id !== id);
      mockExamQuestions = mockExamQuestions.filter(eq => eq.exam_id !== id);
      return;
    }
    const _adminCl = adminClient();
    if (!_adminCl) {
      throw new Error('[db.deleteExam] Admin Supabase client unavailable. Set SUPABASE_SERVICE_ROLE_KEY.');
    }
    // exam_questions rows cascade-deleted via ON DELETE CASCADE on exam_id FK
    // Delete exam (cascade handles exam_questions)
    const { error } = await _adminCl.from('exams').delete().eq('id', id);
    if (error) throw error;
  },

  // --------------------------------------------------------------------------
  // QUESTIONS & ANSWERS
  // --------------------------------------------------------------------------
  async getQuestions(subjectId?: string, createdBy?: string, grade?: string): Promise<(Question & { answers: Answer[], subject?: Subject })[]> {
    if (isInMockMode()) {
      let qList = mockQuestions;
      if (subjectId) {
        qList = qList.filter(q => q.subject_id === subjectId);
      }
      if (createdBy) {
        qList = qList.filter(q => q.metadata?.created_by === createdBy);
      }
      if (grade) {
        qList = qList.filter(q => q.metadata?.grade === grade);
      }
      return qList.map(q => ({
        ...q,
        answers: mockAnswers.filter(a => a.question_id === q.id),
        subject: mockSubjects.find(s => s.id === q.subject_id)
      }));
    }
    
    const client = adminClient();
    let query = client.from('questions').select('*').eq('de_id', 'bank');
    if (subjectId) {
      query = query.eq('metadata->>subject_id', subjectId);
    }
    if (createdBy) {
      query = query.eq('metadata->>created_by', createdBy);
    }
    if (grade) {
      query = query.eq('metadata->>grade', grade);
    }
    const { data, error } = await query;
    if (error) { console.error('[db.getQuestions] error:', error); return []; }

    // Fetch subjects to associate
    const subjects = await this.getSubjects();

    return (data || []).map(q => {
      const mapped = mapDbQuestionToAppQuestion(q);
      mapped.subject = subjects.find(s => s.id === mapped.subject_id);
      return mapped;
    });
  },

  async getQuestionsByExamId(examId: string): Promise<(Question & { answers: Answer[] })[]> {
    if (isInMockMode()) {
      // Look up via mock junction table
      const links = mockExamQuestions
        .filter(eq => eq.exam_id === examId)
        .sort((a, b) => a.so_cau - b.so_cau);
      return links.map(link => {
        const q = mockQuestions.find(mq => mq.id === link.question_id);
        if (!q) return null;
        return {
          ...q,
          so_cau: link.so_cau,
          phan: link.phan,
          answers: (q.options || []).map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const correctLetters = (q.answer || '').split(',').map(l => l.trim().toUpperCase());
            return {
              id: `${q.id}-${letter}`,
              question_id: q.id,
              content: opt,
              is_correct: correctLetters.includes(letter)
            };
          })
        };
      }).filter((x): x is NonNullable<typeof x> => x != null);
    }

    const _adminCl = adminClient();
    if (!_adminCl) {
      console.warn('[db.getQuestionsByExamId] Admin client unavailable (missing SUPABASE_SERVICE_ROLE_KEY?), falling back to anon client — RLS may block SSR reads.');
    }
    const client = _adminCl || supabase;
    if (!client) {
      console.error('[db.getQuestionsByExamId] No Supabase client available (both admin and anon are null).');
      return [];
    }

    // Join exam_questions → questions to get ordered bank questions for this exam
    const { data: junctionRows, error: jError } = await client
      .from('exam_questions')
      .select('so_cau, phan, question_id, questions(*)')
      .eq('exam_id', examId)
      .order('phan')
      .order('so_cau');

    if (jError) {
      console.error('[db.getQuestionsByExamId] Supabase query error:', jError.message);
      throw jError;
    }

    return (junctionRows || []).map((row: any) => {
      const q = row.questions;
      if (!q) return null;
      const mapped = mapDbQuestionToAppQuestion(q);
      // Override so_cau/phan from the junction (exam-specific ordering)
      mapped.so_cau = row.so_cau;
      mapped.phan = row.phan;
      return mapped;
    }).filter((x): x is NonNullable<typeof x> => x != null);
  },

  async createQuestion(question: Omit<Question, 'id'>, answers: Omit<Answer, 'id' | 'question_id'>[]): Promise<Question & { answers: Answer[] }> {
    if (isInMockMode()) {
      const newQuestion: Question = {
        ...question,
        id: `q-${Date.now()}`
      };
      mockQuestions.push(newQuestion);

      const newAnswers = answers.map((ans, idx) => {
        const a: Answer = {
          ...ans,
          id: `a-${Date.now()}-${idx}`,
          question_id: newQuestion.id
        };
        mockAnswers.push(a);
        return a;
      });

      return { ...newQuestion, answers: newAnswers };
    }

    const _adminCl = adminClient();

    // Map answers array to options array and answer string
    const options = question.type === 'sa' ? [] : answers.map(a => a.content);
    const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const correctLetters = answers
      .map((a, idx) => a.is_correct ? alphabet[idx] : null)
      .filter(Boolean) as string[];
    const answerStr = question.type === 'sa' ? (question.answer || '') : correctLetters.join(',');

    const metadata = {
      difficulty: question.difficulty,
      type: question.type,
      explanation: question.explanation,
      subject_id: question.subject_id,
      grade: '12',
      ...(question.created_by ? { created_by: question.created_by } : {}),
      ...(question.metadata || {})
    };

    // Default de_id to 'bank' for templates
    const de_id = 'bank';
    
    // Find next so_cau for 'bank'
    const { data: countData, error: countError } = await _adminCl!
      .from('questions')
      .select('so_cau')
      .eq('de_id', de_id)
      .order('so_cau', { ascending: false })
      .limit(1);
    if (countError) {
      console.error('[db.createQuestion] countError:', countError);
    }
      
    let nextSoCau = 1;
    if (countData && countData.length > 0) {
      nextSoCau = (countData[0].so_cau || 0) + 1;
    }

    const dbInsert = {
      de_id,
      so_cau: nextSoCau,
      phan: 'I',
      content: question.content,
      options,
      answer: answerStr,
      metadata,
      image_url: null
    };

    const { data: newQ, error: qError } = await _adminCl!
      .from('questions')
      .insert([dbInsert])
      .select()
      .single();
      
    if (qError) throw qError;
    if (!newQ) throw new Error('[db.createQuestion] Insert returned no data.');

    return mapDbQuestionToAppQuestion(newQ);
  },

  /**
   * Batch-insert multiple questions in 2 subrequests (1 SELECT max so_cau + 1 INSERT).
   * Use this instead of calling createQuestion() in a loop to avoid the
   * Cloudflare Workers 50-subrequest limit.
   */
  async createQuestionsBatch(
    questions: Array<{
      question: Omit<Question, 'id'>;
      answers: Omit<Answer, 'id' | 'question_id'>[];
    }>
  ): Promise<Question[]> {
    if (questions.length === 0) return [];

    if (isInMockMode()) {
      const results: Question[] = [];
      for (const { question, answers } of questions) {
        const newQuestion: Question = { ...question, id: `q-${Date.now()}-${Math.random()}` };
        mockQuestions.push(newQuestion as any);
        answers.forEach((ans, idx) => {
          mockAnswers.push({ ...ans, id: `a-${Date.now()}-${idx}`, question_id: newQuestion.id });
        });
        results.push(newQuestion);
      }
      return results;
    }

    const _adminCl = adminClient();
    const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const de_id = 'bank';

    // 1 subrequest: get current max so_cau
    const { data: countData, error: countError } = await _adminCl!
      .from('questions')
      .select('so_cau')
      .eq('de_id', de_id)
      .order('so_cau', { ascending: false })
      .limit(1);
    if (countError) console.error('[db.createQuestionsBatch] countError:', countError);

    let nextSoCau = (countData && countData.length > 0 ? (countData[0].so_cau || 0) : 0) + 1;

    // Build all rows
    const dbRows = questions.map(({ question, answers }) => {
      const options = question.type === 'sa' ? [] : answers.map(a => a.content);
      const correctLetters = answers
        .map((a, idx) => a.is_correct ? alphabet[idx] : null)
        .filter(Boolean) as string[];
      const answerStr = question.type === 'sa' ? (question.answer || '') : correctLetters.join(',');
      const metadata = {
        difficulty: question.difficulty,
        type: question.type,
        explanation: question.explanation,
        subject_id: question.subject_id,
        grade: '12',
        ...(question.created_by ? { created_by: question.created_by } : {}),
        ...(question.metadata || {})
      };
      return {
        de_id,
        so_cau: nextSoCau++,
        phan: 'I',
        content: question.content,
        options,
        answer: answerStr,
        metadata,
        image_url: null
      };
    });

    // 1 subrequest: batch insert
    const { data: newQs, error: qError } = await _adminCl!
      .from('questions')
      .insert(dbRows)
      .select();
    if (qError) throw qError;
    if (!newQs || newQs.length === 0) throw new Error('[db.createQuestionsBatch] Insert returned no data.');

    return newQs.map(mapDbQuestionToAppQuestion);
  },

  async updateQuestion(id: string, question: Partial<Omit<Question, 'id'>>, answers?: (Omit<Answer, 'id' | 'question_id'> & { id?: string })[]): Promise<Question & { answers: Answer[] }> {
    if (isInMockMode()) {
      const qIndex = mockQuestions.findIndex(q => q.id === id);
      if (qIndex === -1) throw new Error('Question not found');
      mockQuestions[qIndex] = { ...mockQuestions[qIndex], ...question };

      if (answers) {
        mockAnswers = mockAnswers.filter(a => a.question_id !== id);
        answers.forEach((ans, idx) => {
          mockAnswers.push({
            id: ans.id || `a-${Date.now()}-${idx}`,
            question_id: id,
            content: ans.content,
            is_correct: ans.is_correct
          });
        });
      }

      return {
        ...mockQuestions[qIndex],
        answers: mockAnswers.filter(a => a.question_id === id)
      };
    }

    const _adminCl = adminClient();

    // Get existing question to preserve/merge metadata
    const { data: existingQ, error: fetchErr } = await _adminCl!
      .from('questions')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    const existingMetadata = existingQ.metadata || {};
    
    const updatedMetadata = {
      ...existingMetadata,
      ...(question.difficulty ? { difficulty: question.difficulty } : {}),
      ...(question.type ? { type: question.type } : {}),
      ...(question.explanation !== undefined ? { explanation: question.explanation } : {}),
      ...(question.subject_id ? { subject_id: question.subject_id } : {}),
      ...(question.category_id !== undefined ? { category_id: question.category_id } : {}),
      ...(question.metadata ? question.metadata : {})
    };

    const currentType = question.type || existingMetadata.type;
    const dbUpdate: any = {
      ...(question.content ? { content: question.content } : {}),
      metadata: updatedMetadata
    };

    if (currentType === 'sa') {
      dbUpdate.options = [];
      dbUpdate.answer = question.answer || '';
    } else if (answers) {
      const options = answers.map(a => a.content);
      const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const correctLetters = answers
        .map((a, idx) => a.is_correct ? alphabet[idx] : null)
        .filter(Boolean) as string[];
      const answerStr = correctLetters.join(',');

      dbUpdate.options = options;
      dbUpdate.answer = answerStr;
    }

    const { data: updatedQ, error: qError } = await _adminCl!
      .from('questions')
      .update(dbUpdate)
      .eq('id', id)
      .select()
      .single();
    if (qError) throw qError;

    return mapDbQuestionToAppQuestion(updatedQ);
  },

  async deleteQuestion(id: string): Promise<void> {
    if (isInMockMode()) {
      mockQuestions = mockQuestions.filter((q: MockQuestion) => q.id !== id);
      mockAnswers = mockAnswers.filter(a => a.question_id !== id);
      return;
    }
    const _adminCl = adminClient();
    const { error } = await _adminCl.from('questions').delete().eq('id', id);
    if (error) throw error;
  },

  // --------------------------------------------------------------------------
  // ATTEMPTS & GRADING
  // --------------------------------------------------------------------------
  async getAttempts(userId: string): Promise<(Attempt & { exam?: Exam & { subject?: Subject } })[]> {
    if (isInMockMode()) {
      const userAttempts = mockAttempts.filter(a => a.user_id === userId);
      return userAttempts.map(att => {
        const exam = mockExams.find(e => e.id === att.exam_id);
        const subject = exam ? mockSubjects.find(s => s.id === exam.subject_id) : undefined;
        return {
          ...att,
          exam: exam ? { ...exam, subject } : undefined
        };
      }).sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    }

    // Use admin client to bypass RLS for server-side reads
    const client = adminClient();
    const { data, error } = await client
      .from('attempts')
      .select('*, exam:exams(*, subject:subjects(*))')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getAttemptById(id: string): Promise<(Attempt & { exam?: Exam & { subject?: Subject } }) | null> {
    if (isInMockMode()) {
      const att = mockAttempts.find(a => a.id === id);
      if (!att) return null;
      const exam = mockExams.find(e => e.id === att.exam_id);
      const subject = exam ? mockSubjects.find(s => s.id === exam.subject_id) : undefined;
      return {
        ...att,
        exam: exam ? { ...exam, subject } : undefined
      };
    }

    // Use admin client to bypass RLS for server-side reads
    const client = adminClient();
    const { data, error } = await client
      .from('attempts')
      .select('*, exam:exams(*, subject:subjects(*))')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  },

  async createAttempt(userId: string | null | undefined, examId: string): Promise<Attempt> {
    if (isInMockMode()) {
      const newAttempt: Attempt = {
        id: `att-${Date.now()}`,
        user_id: userId || `guest-${Date.now()}`,
        exam_id: examId,
        score: null,
        answers_submitted: null,
        started_at: new Date().toISOString(),
        finished_at: null
      };
      mockAttempts.push(newAttempt);
      return newAttempt;
    }

    // Use admin client to bypass RLS — user_id is explicitly set so data is still scoped correctly
    const _adminCl = adminClient();
    const { data, error } = await _adminCl!
      .from('attempts')
      .insert([{ user_id: userId || null, exam_id: examId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async submitAttempt(attemptId: string, score: number, answersSubmitted: Record<string, any>, scoring?: { raw_score?: number | null; ability_score?: number | null }): Promise<Attempt> {
    if (isInMockMode()) {
      const index = mockAttempts.findIndex(a => a.id === attemptId);
      if (index === -1) throw new Error('Attempt not found');
      mockAttempts[index] = {
        ...mockAttempts[index],
        score,
        ...(scoring || {}),
        answers_submitted: answersSubmitted,
        finished_at: new Date().toISOString()
      };
      return mockAttempts[index];
    }

    // Use admin client to bypass RLS for server-side updates
    const _adminCl = adminClient();
    const { data, error } = await _adminCl!
      .from('attempts')
      .update({
        score,
        ...(scoring || {}),
        answers_submitted: answersSubmitted,
        finished_at: new Date().toISOString()
      })
      .eq('id', attemptId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getAllAttempts(): Promise<(Attempt & { exam?: Exam, user?: User })[]> {
    if (isInMockMode()) {
      return mockAttempts.map(att => ({
        ...att,
        exam: mockExams.find(e => e.id === att.exam_id),
        user: mockUsers.find(u => u.id === att.user_id)
      })).sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    }

    // Use admin client to bypass RLS for server-side reads
    const client = adminClient();
    const { data, error } = await client
      .from('attempts')
      .select('*, exam:exams(*), user:users(*)')
      .order('started_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getAttemptsByExamId(examId: string): Promise<(Attempt & { user?: User })[]> {
    if (isInMockMode()) {
      return mockAttempts
        .filter(a => a.exam_id === examId && a.finished_at !== null)
        .map(att => ({
          ...att,
          user: mockUsers.find(u => u.id === att.user_id)
        }))
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    }
    const client = adminClient();
    const { data, error } = await client
      .from('attempts')
      .select('*, user:users(id, email, fullname, avatar_url, role)')
      .eq('exam_id', examId)
      .not('finished_at', 'is', null)
      .order('started_at', { ascending: false });
    if (error) { console.error('[db.getAttemptsByExamId]', error); return []; }
    return data || [];
  },


  // --------------------------------------------------------------------------
  // USER PROFILES
  // --------------------------------------------------------------------------
  async getUsers(): Promise<User[]> {
    if (isInMockMode()) {
      return mockUsers;
    }
    const client = adminClient()!;
    const { data, error } = await client.from('users').select('*').order('created_at');
    if (error) throw error;
    return data || [];
  },

  async getUserById(id: string): Promise<User | null> {
    if (isInMockMode()) {
      return mockUsers.find(u => u.id === id) || null;
    }
    const client = adminClient()!;
    const { data, error } = await client.from('users').select('*').eq('id', id).single();
    if (error) {
      // Fallback to mock users for mock-user-* IDs in Supabase mode
      const mockUser = mockUsers.find(u => u.id === id);
      if (mockUser) return mockUser;
      return null;
    }
    return data;
  },

  async updateUserProfile(id: string, updates: Partial<Omit<User, 'id' | 'email' | 'role' | 'created_at'>>): Promise<User> {
    if (isInMockMode()) {
      const index = mockUsers.findIndex(u => u.id === id);
      if (index === -1) throw new Error('User not found');
      mockUsers[index] = { ...mockUsers[index], ...updates };
      return mockUsers[index];
    }
    const _ac = adminClient()!;
    const { data, error } = await _ac.from('users').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async updateUserRole(id: string, role: 'student' | 'teacher' | 'admin'): Promise<User> {
    if (isInMockMode()) {
      const index = mockUsers.findIndex(u => u.id === id);
      if (index === -1) throw new Error('User not found');
      mockUsers[index].role = role;
      return mockUsers[index];
    }
    // Using Admin Client to bypass RLS policies
    const _ac = adminClient();
    if (_ac) {
      const { data, error } = await _ac.from('users').update({ role }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }
    // Fallback to anon client if no admin key
    const _anon = anonClient();
    if (!_anon) throw new Error('No Supabase client available');
    const { data, error } = await _anon.from('users').update({ role }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // --------------------------------------------------------------------------
  // COMMENTS
  // --------------------------------------------------------------------------
  async getComments(blogId: string): Promise<(Comment & { user?: User })[]> {
    if (isInMockMode()) {
      const blogComments = mockComments.filter(c => c.blog_id === blogId);
      return blogComments.map(c => ({
        ...c,
        user: mockUsers.find(u => u.id === c.user_id)
      })).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return [];
  },

  async createComment(comment: Omit<Comment, 'id' | 'created_at'>): Promise<Comment> {
    if (isInMockMode()) {
      const newComment: Comment = {
        ...comment,
        id: `cmt-${Date.now()}`,
        created_at: new Date().toISOString()
      };
      mockComments.push(newComment);
      return newComment;
    }
    throw new Error('Cannot create comment: no database configured');
  },

  async deleteComment(id: string): Promise<void> {
    if (isInMockMode()) {
      mockComments = mockComments.filter(c => c.id !== id);
      return;
    }
    throw new Error('Cannot delete comment: no database configured');
  },

  // --------------------------------------------------------------------------
  // BLOGS (WordPress API Integration)
  // --------------------------------------------------------------------------
  async getBlogs(createdBy?: string): Promise<Blog[]> {
    const wpApiUrl = import.meta.env.WORDPRESS_API_URL || '';
    if (wpApiUrl) {
      try {
        const response = await fetch(`${wpApiUrl}/posts?_embed=1&per_page=10`);
        if (response.ok) {
          const posts = await response.json();
          if (Array.isArray(posts)) {
            return posts.map(mapWPPostToBlog);
          }
        }
      } catch (err) {
        console.error('WP API getBlogs fetch error:', err);
      }
    }

    if (isInMockMode()) {
      let blogs = mockBlogs;
      if (createdBy) {
        blogs = blogs.filter(b => b.created_by === createdBy);
      }
      return [...blogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return [];
  },

  async getBlogById(id: string): Promise<Blog | null> {
    const wpApiUrl = import.meta.env.WORDPRESS_API_URL || '';
    if (wpApiUrl) {
      try {
        const response = await fetch(`${wpApiUrl}/posts/${id}?_embed=1`);
        if (response.ok) {
          const post = await response.json();
          return mapWPPostToBlog(post);
        }
      } catch (err) {
        console.error(`WP API getBlogById (${id}) fetch error:`, err);
      }
    }

    if (isInMockMode()) {
      return mockBlogs.find(b => b.id === id) || null;
    }
    return null;
  },

  async getBlogBySlug(slug: string): Promise<Blog | null> {
    const wpApiUrl = import.meta.env.WORDPRESS_API_URL || '';
    if (wpApiUrl) {
      try {
        const response = await fetch(`${wpApiUrl}/posts?slug=${slug}&_embed=1`);
        if (response.ok) {
          const posts = await response.json();
          if (Array.isArray(posts) && posts.length > 0) {
            return mapWPPostToBlog(posts[0]);
          }
        }
      } catch (err) {
        console.error(`WP API getBlogBySlug (${slug}) fetch error:`, err);
      }
    }

    if (isInMockMode()) {
      return mockBlogs.find(b => b.slug === slug) || null;
    }
    return null;
  },

  async getBlogCategories(): Promise<{ id: number, name: string, slug: string, count: number }[]> {
    const wpApiUrl = import.meta.env.WORDPRESS_API_URL || '';
    if (wpApiUrl) {
      try {
        const response = await fetch(`${wpApiUrl}/categories?per_page=100`);
        if (response.ok) {
          const categories = await response.json();
          if (Array.isArray(categories)) {
            return categories.map(cat => ({
              id: cat.id,
              name: cat.name,
              slug: cat.slug,
              count: cat.count
            }));
          }
        }
      } catch (err) {
        console.error('WP API getBlogCategories fetch error:', err);
      }
    }
    return [];
  },

  async createBlog(blog: Omit<Blog, 'id' | 'created_at'>): Promise<Blog> {
    if (isInMockMode()) {
      const newBlog: Blog = {
        ...blog,
        id: `blog-${Date.now()}`,
        created_at: new Date().toISOString()
      };
      mockBlogs.push(newBlog);
      return newBlog;
    }
    throw new Error('Cannot create blog: no database configured');
  },

  async updateBlog(id: string, blog: Partial<Omit<Blog, 'id' | 'created_at'>>): Promise<Blog> {
    if (isInMockMode()) {
      const index = mockBlogs.findIndex(b => b.id === id);
      if (index === -1) throw new Error('Blog not found');
      mockBlogs[index] = { ...mockBlogs[index], ...blog };
      return mockBlogs[index];
    }
    throw new Error('Cannot update blog: no database configured');
  },

  async deleteBlog(id: string): Promise<void> {
    if (isInMockMode()) {
      mockBlogs = mockBlogs.filter(b => b.id !== id);
      return;
    }
    throw new Error('Cannot delete blog: no database configured');
  },

  // --------------------------------------------------------------------------
  // COURSES (KhÃƒÂ³a hÃ¡Â»Âc)
  // --------------------------------------------------------------------------
  async getCourses(options?: { publishedOnly?: boolean; createdBy?: string; subjectId?: string }): Promise<(Course & { subject?: Subject; lessonCount?: number; enrollmentCount?: number; teacher?: { id: string; fullname: string | null; avatar_url: string | null } })[]> {
    if (isInMockMode()) {
      let courses = [...mockCourses];
      if (options?.publishedOnly) courses = courses.filter(c => c.is_published);
      if (options?.createdBy) courses = courses.filter(c => c.created_by === options.createdBy);
      if (options?.subjectId) courses = courses.filter(c => c.subject_id === options.subjectId);
      return courses.map(c => ({
        ...c,
        subject: mockSubjects.find(s => s.id === c.subject_id),
        lessonCount: mockCourseLessons.filter(l => l.course_id === c.id).length,
        enrollmentCount: mockEnrollments.filter(e => e.course_id === c.id).length,
        teacher: mockUsers.find(u => u.id === c.created_by) ? { id: c.created_by!, fullname: mockUsers.find(u => u.id === c.created_by)!.fullname, avatar_url: mockUsers.find(u => u.id === c.created_by)!.avatar_url } : undefined,
      }));
    }
    const client = adminClient()!;
    let query = client
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });
    if (options?.publishedOnly) query = query.eq('is_published', true);
    if (options?.createdBy) query = query.eq('created_by', options.createdBy);
    if (options?.subjectId) query = query.eq('subject_id', options.subjectId);
    const { data, error } = await query;
    if (error) throw error;
    const courses = data || [];

    const courseIds = courses.map((c: any) => c.id);

    // Fetch subjects
    const subjectIds = [...new Set(courses.map((c: any) => c.subject_id).filter(Boolean))];
    let subjectsMap: Record<string, any> = {};
    if (subjectIds.length > 0) {
      const { data: subData } = await client.from('subjects').select('*').in('id', subjectIds);
      if (subData) subjectsMap = Object.fromEntries(subData.map((s: any) => [s.id, s]));
    }

    // Fetch teacher info
    const teacherIds = [...new Set(courses.map((c: any) => c.created_by).filter(Boolean))];
    let teachersMap: Record<string, any> = {};
    if (teacherIds.length > 0) {
      const { data: teachers } = await client.from('users').select('id, fullname, avatar_url').in('id', teacherIds);
      if (teachers) teachersMap = Object.fromEntries(teachers.map((t: any) => [t.id, t]));
    }

    // Fetch lesson counts
    let lessonCountMap: Record<string, number> = {};
    if (courseIds.length > 0) {
      const { data: allLessons } = await client.from('course_lessons').select('course_id').in('course_id', courseIds);
      if (allLessons) {
        for (const l of allLessons) {
          lessonCountMap[l.course_id] = (lessonCountMap[l.course_id] || 0) + 1;
        }
      }
    }

    // Fetch enrollment counts
    let enrollmentCountMap: Record<string, number> = {};
    if (courseIds.length > 0) {
      const { data: allEnrollments } = await client.from('course_enrollments').select('course_id').in('course_id', courseIds);
      if (allEnrollments) {
        for (const e of allEnrollments) {
          enrollmentCountMap[e.course_id] = (enrollmentCountMap[e.course_id] || 0) + 1;
        }
      }
    }

    return courses.map((c: any) => ({
      ...c,
      subject: subjectsMap[c.subject_id] || undefined,
      lessonCount: lessonCountMap[c.id] || 0,
      enrollmentCount: enrollmentCountMap[c.id] || 0,
      teacher: teachersMap[c.created_by] || undefined,
    }));
  },

  async getCourseBySlug(slug: string): Promise<(Course & { subject?: Subject }) | null> {
    if (isInMockMode()) {
      const course = mockCourses.find(c => c.slug === slug);
      if (!course) return null;
      return { ...course, subject: mockSubjects.find(s => s.id === course.subject_id) };
    }
    const client = adminClient()!;
    const { data, error } = await client.from('courses').select('*').eq('slug', slug).single();
    if (error) return null;
    if (data?.subject_id) {
      const { data: subData } = await client.from('subjects').select('*').eq('id', data.subject_id).single();
      return { ...data, subject: subData || undefined };
    }
    return data;
  },

  async getCourseById(id: string): Promise<(Course & { subject?: Subject }) | null> {
    if (isInMockMode()) {
      const course = mockCourses.find(c => c.id === id);
      if (!course) return null;
      return { ...course, subject: mockSubjects.find(s => s.id === course.subject_id) };
    }
    const client = adminClient()!;
    const { data, error } = await client.from('courses').select('*').eq('id', id).single();
    if (error) return null;
    if (data?.subject_id) {
      const { data: subData } = await client.from('subjects').select('*').eq('id', data.subject_id).single();
      return { ...data, subject: subData || undefined };
    }
    return data;
  },

  async createCourse(course: Omit<Course, 'id' | 'created_at'>): Promise<Course> {
    if (isInMockMode()) {
      const newCourse: Course = { ...course, id: `course-${Date.now()}`, created_at: new Date().toISOString() };
      mockCourses.push(newCourse);
      return newCourse;
    }
    const _adminCl = adminClient();
    const { data, error } = await _adminCl.from('courses').insert([course]).select().single();
    if (error) throw error;
    return data;
  },

  async updateCourse(id: string, updates: Partial<Omit<Course, 'id' | 'created_at'>>): Promise<Course> {
    if (isInMockMode()) {
      const idx = mockCourses.findIndex(c => c.id === id);
      if (idx === -1) throw new Error('Course not found');
      mockCourses[idx] = { ...mockCourses[idx], ...updates };
      return mockCourses[idx];
    }
    const _adminCl = adminClient();
    const { data, error } = await _adminCl.from('courses').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteCourse(id: string): Promise<void> {
    if (isInMockMode()) {
      mockCourses = mockCourses.filter(c => c.id !== id);
      mockCourseLessons = mockCourseLessons.filter(l => l.course_id !== id);
      return;
    }
    const _adminCl = adminClient();
    const { error } = await _adminCl.from('courses').delete().eq('id', id);
    if (error) throw error;
  },

  // --------------------------------------------------------------------------
  // COURSE LESSONS (BÃƒÂ i giÃ¡ÂºÂ£ng trong khÃƒÂ³a hÃ¡Â»Âc)
  // --------------------------------------------------------------------------
  async getCourseLessons(courseId: string): Promise<CourseLesson[]> {
    if (isInMockMode()) {
      return mockCourseLessons
        .filter(l => l.course_id === courseId)
        .sort((a, b) => a.order_index - b.order_index);
    }
    const client = adminClient()!;
    const { data, error } = await client
      .from('course_lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index');
    if (error) throw error;
    return data || [];
  },

  async getCourseLessonById(id: string): Promise<CourseLesson | null> {
    if (isInMockMode()) return mockCourseLessons.find(l => l.id === id) || null;
    const client = adminClient()!;
    const { data, error } = await client.from('course_lessons').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async createCourseLesson(lesson: Omit<CourseLesson, 'id' | 'created_at'>): Promise<CourseLesson> {
    if (isInMockMode()) {
      const newLesson: CourseLesson = { ...lesson, id: `cl-${Date.now()}`, created_at: new Date().toISOString() };
      mockCourseLessons.push(newLesson);
      return newLesson;
    }
    const _adminCl = adminClient();
    const { data, error } = await _adminCl.from('course_lessons').insert([lesson]).select().single();
    if (error) throw error;
    return data;
  },

  /** Create one lesson and its independent end-of-lesson review quiz atomically. */
  async createCourseLessonWithReviewQuiz(
    lesson: Omit<CourseLesson, 'id' | 'created_at'>,
    questions: Array<Omit<CourseLessonReviewQuestion, 'id' | 'lesson_id' | 'created_at'>>,
  ): Promise<CourseLesson> {
    if (isInMockMode()) {
      const created: CourseLesson = { ...lesson, id: `cl-${Date.now()}`, created_at: new Date().toISOString() };
      mockCourseLessons.push(created);
      questions.forEach((question, index) => {
        mockReviewQuestions.push({
          ...question,
          id: `rq-${Date.now()}-${index}`,
          lesson_id: created.id,
          created_at: new Date().toISOString(),
        });
      });
      return created;
    }

    const client = adminClient()!;
    const { data, error } = await client.rpc('create_course_lesson_with_review_quiz', {
      p_course_id: lesson.course_id,
      p_title: lesson.title,
      p_content: lesson.content || '',
      p_video_url: lesson.video_url || '',
      p_order_index: lesson.order_index,
      p_duration: lesson.duration,
      p_is_published: lesson.is_published,
      p_is_free: lesson.is_free,
      p_questions: questions,
    });
    if (error) throw error;
    return data as CourseLesson;
  },

  async updateCourseLesson(id: string, updates: Partial<Omit<CourseLesson, 'id' | 'created_at'>>): Promise<CourseLesson> {
    if (isInMockMode()) {
      const idx = mockCourseLessons.findIndex(l => l.id === id);
      if (idx === -1) throw new Error('Lesson not found');
      mockCourseLessons[idx] = { ...mockCourseLessons[idx], ...updates };
      return mockCourseLessons[idx];
    }
    const _adminCl = adminClient();
    const { data, error } = await _adminCl.from('course_lessons').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteCourseLesson(id: string): Promise<void> {
    if (isInMockMode()) {
      mockCourseLessons = mockCourseLessons.filter(l => l.id !== id);
      return;
    }
    const _adminCl = adminClient();
    const { error } = await _adminCl.from('course_lessons').delete().eq('id', id);
    if (error) throw error;
  },

  // --------------------------------------------------------------------------
  // ENROLLMENTS & PROGRESS
  // --------------------------------------------------------------------------

  async getCourseEnrollments(courseId: string): Promise<(CourseEnrollment & { user?: User })[]> {
    if (isInMockMode()) {
      return mockEnrollments
        .filter(e => e.course_id === courseId)
        .map(e => ({
          ...e,
          user: mockUsers.find(u => u.id === e.user_id)
        }))
        .sort((a, b) => new Date(b.enrolled_at).getTime() - new Date(a.enrolled_at).getTime());
    }
    const client = adminClient()!;
    // Step 1: fetch enrollments
    const { data: enrollments, error } = await client
      .from('course_enrollments')
      .select('*')
      .eq('course_id', courseId)
      .order('enrolled_at', { ascending: false });
    if (error) { console.error('[db.getCourseEnrollments] enrollments error:', error.message); return []; }
    if (!enrollments || enrollments.length === 0) return [];

    // Step 2: fetch users separately (avoids PostgREST join issues)
    const userIds = [...new Set(enrollments.map((e: any) => e.user_id).filter(Boolean))];
    let usersMap: Record<string, User> = {};
    if (userIds.length > 0) {
      const { data: users, error: userErr } = await client
        .from('users')
        .select('id, email, fullname, avatar_url, role')
        .in('id', userIds);
      if (userErr) { console.error('[db.getCourseEnrollments] users error:', userErr.message); }
      if (users) usersMap = Object.fromEntries(users.map((u: any) => [u.id, u]));
    }

    return enrollments.map((e: any) => ({
      ...e,
      user: usersMap[e.user_id] || undefined
    }));
  },

  async enrollUserInCourse(courseId: string, userId: string): Promise<CourseEnrollment> {
    if (isInMockMode()) {
      const exists = mockEnrollments.find(e => e.course_id === courseId && e.user_id === userId);
      if (exists) return exists;
      const newEnrollment: CourseEnrollment = {
        id: `enr-${Date.now()}`,
        course_id: courseId,
        user_id: userId,
        enrolled_at: new Date().toISOString()
      };
      mockEnrollments.push(newEnrollment);
      return newEnrollment;
    }
    const client = adminClient()!;
    const { data, error } = await client
      .from('course_enrollments')
      .upsert({ course_id: courseId, user_id: userId }, { onConflict: 'course_id,user_id' })
      .select().single();
    if (error) throw error;
    return data;
  },

  async getUserEnrollments(userId: string): Promise<(CourseEnrollment & { course?: Course & { subject?: Subject } })[]> {
    if (isInMockMode()) {
      return mockEnrollments
        .filter(e => e.user_id === userId)
        .map(e => {
          const course = mockCourses.find(c => c.id === e.course_id);
          return {
            ...e,
            course: course ? { ...course, subject: mockSubjects.find(s => s.id === course.subject_id) } : undefined
          };
        });
    }
    const client = adminClient()!;
    const { data: enrollments, error } = await client
      .from('course_enrollments')
      .select('*, course:courses(*)')
      .eq('user_id', userId);
    if (error) throw error;
    if (!enrollments || enrollments.length === 0) return [];
    const subjectIds = [...new Set(
      enrollments.map((e: any) => e.course?.subject_id).filter(Boolean)
    )];
    let subjectsMap: Record<string, any> = {};
    if (subjectIds.length > 0) {
      const { data: subData } = await client.from('subjects').select('*').in('id', subjectIds);
      if (subData) subjectsMap = Object.fromEntries(subData.map((s: any) => [s.id, s]));
    }
    return enrollments.map((e: any) => ({
      ...e,
      course: e.course ? { ...e.course, subject: subjectsMap[e.course.subject_id] || undefined } : undefined
    }));
  },

  async isUserEnrolled(courseId: string, userId: string): Promise<boolean> {
    if (isInMockMode()) return mockEnrollments.some(e => e.course_id === courseId && e.user_id === userId);
    const client = adminClient()!;
    const { data } = await client
      .from('course_enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', userId)
      .maybeSingle();
    return !!data;
  },

  async markLessonComplete(lessonId: string, userId: string): Promise<LessonProgress> {
    if (isInMockMode()) {
      const existing = mockLessonProgress.find(p => p.lesson_id === lessonId && p.user_id === userId);
      if (existing) {
        existing.completed = true;
        existing.completed_at = new Date().toISOString();
        existing.status = 'completed';
        existing.last_accessed_at = existing.completed_at;
        existing.updated_at = existing.completed_at;
        return existing;
      }
      const newProgress: LessonProgress = {
        id: `lp-${Date.now()}`,
        lesson_id: lessonId,
        user_id: userId,
        completed: true,
        completed_at: new Date().toISOString(),
        status: 'completed',
        started_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        time_spent_seconds: 0,
        video_position_seconds: 0,
        video_duration_seconds: 0,
        video_watched_seconds: 0,
        visit_count: 1,
        last_session_id: null,
      };
      mockLessonProgress.push(newProgress);
      return newProgress;
    }
    const client = adminClient()!;
    const { data, error } = await client
      .from('lesson_progress')
      .upsert({ lesson_id: lessonId, user_id: userId, completed: true, status: 'completed', completed_at: new Date().toISOString(), last_accessed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'lesson_id,user_id' })
      .select().single();
    if (error) throw error;
    return data;
  },

  async getLessonProgress(userId: string, courseId?: string): Promise<LessonProgress[]> {
    if (isInMockMode()) {
      let progress = mockLessonProgress.filter(p => p.user_id === userId);
      if (courseId) {
        const lessonIds = mockCourseLessons.filter(l => l.course_id === courseId).map(l => l.id);
        progress = progress.filter(p => lessonIds.includes(p.lesson_id));
      }
      return progress;
    }
    const client = adminClient()!;
    let query = client.from('lesson_progress').select('*').eq('user_id', userId);
    if (courseId) {
      const { data: lessons } = await client.from('course_lessons').select('id').eq('course_id', courseId);
      if (lessons) query = query.in('lesson_id', lessons.map((l: any) => l.id));
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getLessonReviewQuestions(lessonId: string): Promise<CourseLessonReviewQuestion[]> {
    if (isInMockMode()) {
      return mockReviewQuestions.filter(question => question.lesson_id === lessonId)
        .sort((a, b) => a.order_index - b.order_index);
    }
    const client = adminClient()!;
    const { data, error } = await client.from('course_lesson_review_questions')
      .select('*').eq('lesson_id', lessonId).order('order_index');
    if (error) throw error;
    return (data || []).map((row: any) => ({ ...row, options: Array.isArray(row.options) ? row.options : JSON.parse(row.options || '[]'), points: Number(row.points) }));
  },

  async getLessonReviewAttempts(lessonId: string, userId: string): Promise<CourseLessonReviewAttempt[]> {
    if (isInMockMode()) {
      return mockReviewAttempts.filter(attempt => attempt.lesson_id === lessonId && attempt.user_id === userId)
        .sort((a, b) => b.attempt_number - a.attempt_number);
    }
    const client = adminClient()!;
    const { data, error } = await client.from('course_lesson_review_attempts')
      .select('*').eq('lesson_id', lessonId).eq('user_id', userId).order('attempt_number', { ascending: false });
    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row, score: Number(row.score), earned_points: Number(row.earned_points), total_points: Number(row.total_points),
    }));
  },

  async submitLessonReviewQuiz(lessonId: string, userId: string, answers: Record<string, string>): Promise<CourseLessonReviewAttempt> {
    if (isInMockMode()) {
      const questions = mockReviewQuestions.filter(question => question.lesson_id === lessonId);
      if (!questions.length) throw new Error('Quiz ôn tập chưa có câu hỏi.');
      const attemptNumber = mockReviewAttempts.filter(attempt => attempt.lesson_id === lessonId && attempt.user_id === userId).length + 1;
      const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);
      let earnedPoints = 0;
      let correctCount = 0;
      const attemptId = `ra-${Date.now()}`;
      for (const question of questions) {
        const selected = String(answers[question.id] || '').toUpperCase();
        if (!selected) throw new Error('Vui lòng trả lời đầy đủ các câu hỏi.');
        const correct = selected === question.answer;
        if (correct) { correctCount++; earnedPoints += question.points; }
        mockReviewAnswers.push({
          id: `rans-${Date.now()}-${question.id}`, attempt_id: attemptId, question_id: question.id,
          selected_answer: selected, is_correct: correct, awarded_points: correct ? question.points : 0,
          answered_at: new Date().toISOString(),
        });
      }
      const attempt: CourseLessonReviewAttempt = {
        id: attemptId, lesson_id: lessonId, user_id: userId, attempt_number: attemptNumber,
        score: Math.round(earnedPoints / totalPoints * 1000) / 100,
        correct_count: correctCount, total_questions: questions.length,
        earned_points: earnedPoints, total_points: totalPoints, submitted_at: new Date().toISOString(),
      };
      mockReviewAttempts.push(attempt);
      return attempt;
    }
    const client = adminClient()!;
    const { data, error } = await client.rpc('submit_course_lesson_review_quiz', {
      p_lesson_id: lessonId, p_user_id: userId, p_answers: answers,
    });
    if (error) throw error;
    return { ...data, score: Number(data.score), earned_points: Number(data.earned_points), total_points: Number(data.total_points) } as CourseLessonReviewAttempt;
  },

  /** Persist a bounded learning heartbeat so refreshes and seeks do not inflate study time. */
  async recordLessonActivity(input: {
    lessonId: string;
    userId: string;
    sessionId: string;
    activeSeconds?: number;
    watchedSeconds?: number;
    videoPositionSeconds?: number;
    videoDurationSeconds?: number;
    complete?: boolean;
  }): Promise<LessonProgress> {
    const now = new Date().toISOString();
    const boundedNumber = (value: unknown, max: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(0, Math.min(max, Math.round(parsed))) : 0;
    };
    const activeDelta = boundedNumber(input.activeSeconds, 60);
    const watchedDelta = boundedNumber(input.watchedSeconds, 60);
    const position = input.videoPositionSeconds == null ? null : boundedNumber(input.videoPositionSeconds, 86400);
    const duration = input.videoDurationSeconds == null ? null : boundedNumber(input.videoDurationSeconds, 86400);

    if (isInMockMode()) {
      let progress = mockLessonProgress.find(p => p.lesson_id === input.lessonId && p.user_id === input.userId);
      if (!progress) {
        progress = {
          id: `lp-${Date.now()}`,
          lesson_id: input.lessonId,
          user_id: input.userId,
          completed: false,
          completed_at: null,
          status: 'in_progress',
          started_at: now,
          last_accessed_at: now,
          updated_at: now,
          time_spent_seconds: 0,
          video_position_seconds: 0,
          video_duration_seconds: 0,
          video_watched_seconds: 0,
          visit_count: 1,
          last_session_id: input.sessionId,
        };
        mockLessonProgress.push(progress);
      }
      const newSession = progress.last_session_id !== input.sessionId;
      progress.time_spent_seconds = (progress.time_spent_seconds || 0) + activeDelta;
      progress.video_watched_seconds = Math.min(
        duration || progress.video_duration_seconds || Number.MAX_SAFE_INTEGER,
        (progress.video_watched_seconds || 0) + watchedDelta,
      );
      if (position !== null) progress.video_position_seconds = position;
      if (duration !== null) progress.video_duration_seconds = Math.max(progress.video_duration_seconds || 0, duration);
      progress.visit_count = (progress.visit_count || 1) + (newSession ? 1 : 0);
      progress.last_session_id = input.sessionId;
      progress.last_accessed_at = now;
      progress.updated_at = now;
      if (input.complete) {
        progress.completed = true;
        progress.status = 'completed';
        progress.completed_at ||= now;
      }
      const lesson = mockCourseLessons.find(item => item.id === input.lessonId);
      const enrollment = lesson && mockEnrollments.find(item => item.course_id === lesson.course_id && item.user_id === input.userId);
      if (enrollment) {
        enrollment.last_activity_at = now;
        const courseLessons = mockCourseLessons.filter(item => item.course_id === lesson!.course_id && item.is_published);
        const finished = courseLessons.length > 0 && courseLessons.every(item =>
          mockLessonProgress.some(row => row.user_id === input.userId && row.lesson_id === item.id && row.completed),
        );
        enrollment.status = finished ? 'completed' : 'active';
        enrollment.completed_at = finished ? (enrollment.completed_at || now) : null;
      }
      return progress;
    }

    const client = adminClient()!;
    const { data, error } = await client.rpc('record_lesson_activity', {
      p_lesson_id: input.lessonId,
      p_user_id: input.userId,
      p_session_id: input.sessionId,
      p_active_seconds: activeDelta,
      p_watched_seconds: watchedDelta,
      p_video_position_seconds: position,
      p_video_duration_seconds: duration,
      p_complete: Boolean(input.complete),
    });
    if (error) throw error;
    return data as LessonProgress;
  },

  async getUserCourseInsights(userId: string, courseId: string): Promise<UserCourseInsights> {
    const lessonProgress = await this.getLessonProgress(userId, courseId);
    let skills: LearnerSkillMastery[] = [];

    if (!isInMockMode()) {
      const client = adminClient()!;
      const [videoResult, reviewResult] = await Promise.all([
        client.from('student_skill_mastery').select('*').eq('user_id', userId).eq('course_id', courseId),
        client.from('student_review_skill_mastery').select('*').eq('user_id', userId).eq('course_id', courseId),
      ]);
      if (videoResult.error) console.error('[db.getUserCourseInsights] video mastery error:', videoResult.error.message);
      if (reviewResult.error) console.error('[db.getUserCourseInsights] review mastery error:', reviewResult.error.message);
      const normalized = [...(videoResult.data || []), ...(reviewResult.data || [])].map((row: any): LearnerSkillMastery => ({
        ...row,
        questions_attempted: Number(row.questions_attempted),
        questions_mastered: Number(row.questions_mastered),
        total_attempts: Number(row.total_attempts),
        wrong_attempts: Number(row.wrong_attempts),
        first_try_accuracy: Number(row.first_try_accuracy),
        eventual_accuracy: Number(row.eventual_accuracy),
        average_attempts_to_master: Number(row.average_attempts_to_master),
        mastery_score: Number(row.mastery_score),
      }));
      const byTag = new Map<string, LearnerSkillMastery>();
      for (const skill of normalized) {
        const previous = byTag.get(skill.knowledge_tag);
        if (!previous) { byTag.set(skill.knowledge_tag, skill); continue; }
        const questions = previous.questions_attempted + skill.questions_attempted;
        const mastered = previous.questions_mastered + skill.questions_mastered;
        const attempts = previous.total_attempts + skill.total_attempts;
        const wrong = previous.wrong_attempts + skill.wrong_attempts;
        byTag.set(skill.knowledge_tag, {
          ...previous,
          questions_attempted: questions,
          questions_mastered: mastered,
          total_attempts: attempts,
          wrong_attempts: wrong,
          first_try_accuracy: questions ? Math.round((previous.first_try_accuracy * previous.questions_attempted + skill.first_try_accuracy * skill.questions_attempted) / questions) : 0,
          eventual_accuracy: questions ? Math.round(mastered / questions * 100) : 0,
          average_attempts_to_master: questions ? Math.round((previous.average_attempts_to_master * previous.questions_attempted + skill.average_attempts_to_master * skill.questions_attempted) / questions * 100) / 100 : 0,
          last_attempt_at: new Date(previous.last_attempt_at).getTime() > new Date(skill.last_attempt_at).getTime() ? previous.last_attempt_at : skill.last_attempt_at,
          mastery_score: questions ? Math.max(0, Math.min(100, Math.round(mastered / questions * 100 - wrong / questions * 8))) : 0,
        });
      }
      skills = [...byTag.values()].sort((a, b) => a.mastery_score - b.mastery_score);
    } else {
      const lessonIds = new Set(mockCourseLessons.filter(l => l.course_id === courseId).map(l => l.id));
      const quizzes = new Map(mockVideoQuizzes.filter(q => lessonIds.has(q.lesson_id)).map(q => [q.id, q]));
      const grouped = new Map<string, VideoQuizResponse[]>();
      for (const response of mockVideoQuizResponses.filter(r => r.user_id === userId && quizzes.has(r.quiz_id))) {
        const tag = quizzes.get(response.quiz_id)?.knowledge_tag || 'Chưa phân loại';
        grouped.set(tag, [...(grouped.get(tag) || []), response]);
      }
      skills = [...grouped.entries()].map(([tag, responses]) => {
        const questionIds = [...new Set(responses.map(r => r.quiz_id))];
        const mastered = questionIds.filter(id => responses.some(r => r.quiz_id === id && r.is_correct)).length;
        const wrong = responses.filter(r => !r.is_correct).length;
        const firstCorrect = questionIds.filter(id => responses.some(r => r.quiz_id === id && r.attempt_number === 1 && r.is_correct)).length;
        return {
          user_id: userId, course_id: courseId, knowledge_tag: tag,
          questions_attempted: questionIds.length, questions_mastered: mastered,
          total_attempts: responses.length, wrong_attempts: wrong,
          first_try_accuracy: questionIds.length ? Math.round(firstCorrect / questionIds.length * 100) : 0,
          eventual_accuracy: questionIds.length ? Math.round(mastered / questionIds.length * 100) : 0,
          average_attempts_to_master: responses.length / Math.max(questionIds.length, 1),
          last_attempt_at: responses.sort((a, b) => b.answered_at.localeCompare(a.answered_at))[0]?.answered_at || '',
          mastery_score: Math.max(0, Math.round(mastered / Math.max(questionIds.length, 1) * 100 - wrong / Math.max(questionIds.length, 1) * 8)),
        };
      }).sort((a, b) => a.mastery_score - b.mastery_score);
    }

    const videoRows = lessonProgress.filter(p => Number(p.video_duration_seconds || 0) > 0);
    const watched = videoRows.reduce((sum, p) => sum + Number(p.video_watched_seconds || 0), 0);
    const duration = videoRows.reduce((sum, p) => sum + Number(p.video_duration_seconds || 0), 0);
    return {
      lessonProgress,
      skills,
      totalTimeSpentSeconds: lessonProgress.reduce((sum, p) => sum + Number(p.time_spent_seconds || 0), 0),
      averageVideoPercent: duration > 0 ? Math.min(100, Math.round(watched / duration * 100)) : null,
      totalAttempts: skills.reduce((sum, skill) => sum + skill.total_attempts, 0),
      wrongAttempts: skills.reduce((sum, skill) => sum + skill.wrong_attempts, 0),
    };
  },

  /** Aggregate course completion and the latest answer for each video quiz per enrolled user. */
  async getCourseLearningStatistics(courseId: string): Promise<CourseLearningStatistic[]> {
    const buildStatistics = (
      enrollments: (CourseEnrollment & { user?: User })[],
      lessons: CourseLesson[],
      quizzes: CourseLessonQuiz[],
      progressRows: LessonProgress[],
      responseRows: VideoQuizResponse[],
      reviewAttemptRows: CourseLessonReviewAttempt[] = [],
      reviewAnswerRows: CourseLessonReviewAnswer[] = [],
      reviewQuestionRows: CourseLessonReviewQuestion[] = [],
    ): CourseLearningStatistic[] => {
      const lessonIds = new Set(lessons.map(lesson => lesson.id));
      const totalLessons = lessons.length;
      const totalQuizzes = quizzes.length;

      return enrollments.map(enrollment => {
        const studentResponses = responseRows.filter(response =>
          response.user_id === enrollment.user_id && lessonIds.has(response.lesson_id),
        );
        const studentProgress = progressRows.filter(progress =>
          progress.user_id === enrollment.user_id && lessonIds.has(progress.lesson_id),
        );
        const studentReviewAttempts = reviewAttemptRows.filter(attempt =>
          attempt.user_id === enrollment.user_id && lessonIds.has(attempt.lesson_id),
        );
        const completed = new Set(
          studentProgress
            .filter(progress => progress.completed)
            .map(progress => progress.lesson_id),
        );

        // A learner may retry a quiz. The dashboard reports their latest answer per question,
        // so one learner cannot inflate their own result by retrying.
        const latestAnswers = new Map<string, VideoQuizResponse>();
        for (const response of studentResponses) {
          const previous = latestAnswers.get(response.quiz_id);
          if (!previous || new Date(response.answered_at).getTime() > new Date(previous.answered_at).getTime()) {
            latestAnswers.set(response.quiz_id, response);
          }
        }

        const latestActivity = [
          ...studentProgress.flatMap(progress => [progress.last_accessed_at, progress.completed_at].filter(Boolean) as string[]),
          ...studentResponses.map(response => response.answered_at),
          ...studentReviewAttempts.map(attempt => attempt.submitted_at),
        ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

        const answeredQuizzes = latestAnswers.size;
        const correctQuizzes = [...latestAnswers.values()].filter(response => response.is_correct).length;
        const firstAttempts = studentResponses.filter(response => response.attempt_number === 1);
        const totalVideoDuration = studentProgress.reduce((sum, progress) => sum + Number(progress.video_duration_seconds || 0), 0);
        const totalVideoWatched = studentProgress.reduce((sum, progress) => sum + Number(progress.video_watched_seconds || 0), 0);
        const quizById = new Map(quizzes.map(quiz => [quiz.id, quiz]));
        const tagAttempts = new Map<string, { attempts: number; wrong: number; first: number; firstCorrect: number }>();
        for (const response of studentResponses) {
          const tag = quizById.get(response.quiz_id)?.knowledge_tag || 'Chưa phân loại';
          const summary = tagAttempts.get(tag) || { attempts: 0, wrong: 0, first: 0, firstCorrect: 0 };
          summary.attempts++;
          if (!response.is_correct) summary.wrong++;
          if (response.attempt_number === 1) {
            summary.first++;
            if (response.is_correct) summary.firstCorrect++;
          }
          tagAttempts.set(tag, summary);
        }
        const reviewAttemptById = new Map(studentReviewAttempts.map(attempt => [attempt.id, attempt]));
        const reviewQuestionById = new Map(reviewQuestionRows.map(question => [question.id, question]));
        for (const answer of reviewAnswerRows.filter(row => reviewAttemptById.has(row.attempt_id))) {
          const question = reviewQuestionById.get(answer.question_id);
          const tag = question?.knowledge_tag || 'Chưa phân loại';
          const summary = tagAttempts.get(tag) || { attempts: 0, wrong: 0, first: 0, firstCorrect: 0 };
          summary.attempts++;
          if (!answer.is_correct) summary.wrong++;
          if (reviewAttemptById.get(answer.attempt_id)?.attempt_number === 1) {
            summary.first++;
            if (answer.is_correct) summary.firstCorrect++;
          }
          tagAttempts.set(tag, summary);
        }
        const weakKnowledgeTags = [...tagAttempts.entries()]
          .filter(([, value]) => value.wrong >= 2 || (value.first > 0 && value.firstCorrect / value.first < 0.7))
          .sort((a, b) => (b[1].wrong / b[1].attempts) - (a[1].wrong / a[1].attempts))
          .slice(0, 3)
          .map(([tag]) => tag);
        // 1.0 point per question on first try, minus 0.2 for each retry
        // (minimum 0.4 after eventually answering correctly); unanswered/wrong = 0.
        const earnedQuizPoints = [...latestAnswers.values()].reduce((sum, response) => {
          if (!response.is_correct) return sum;
          return sum + Math.max(0.4, 1 - 0.2 * Math.max(0, response.attempt_number - 1));
        }, 0);
        return {
          enrollment,
          completedLessons: completed.size,
          totalLessons,
          completionPercent: totalLessons > 0 ? Math.round((completed.size / totalLessons) * 100) : 0,
          answeredQuizzes,
          totalQuizzes,
          correctQuizzes,
          quizAccuracy: answeredQuizzes > 0 ? Math.round((correctQuizzes / answeredQuizzes) * 100) : null,
          quizScore: answeredQuizzes > 0 && totalQuizzes > 0
            ? Math.round((earnedQuizPoints / totalQuizzes) * 100) / 10
            : null,
          reviewQuizAttempts: studentReviewAttempts.length,
          reviewQuizAverageScore: studentReviewAttempts.length
            ? Math.round(studentReviewAttempts.reduce((sum, attempt) => sum + Number(attempt.score), 0) / studentReviewAttempts.length * 10) / 10
            : null,
          reviewQuizBestScore: studentReviewAttempts.length
            ? Math.max(...studentReviewAttempts.map(attempt => Number(attempt.score)))
            : null,
          totalQuizAttempts: studentResponses.length,
          wrongQuizAttempts: studentResponses.filter(response => !response.is_correct).length,
          firstTryAccuracy: firstAttempts.length > 0
            ? Math.round(firstAttempts.filter(response => response.is_correct).length / firstAttempts.length * 100)
            : null,
          timeSpentSeconds: studentProgress.reduce((sum, progress) => sum + Number(progress.time_spent_seconds || 0), 0),
          videoWatchedPercent: totalVideoDuration > 0 ? Math.min(100, Math.round(totalVideoWatched / totalVideoDuration * 100)) : null,
          weakKnowledgeTags,
          lastActivityAt: latestActivity,
        };
      });
    };

    if (isInMockMode()) {
      const lessons = mockCourseLessons.filter(lesson => lesson.course_id === courseId && lesson.is_published);
      const lessonIds = new Set(lessons.map(lesson => lesson.id));
      const enrollments = await this.getCourseEnrollments(courseId);
      return buildStatistics(
        enrollments,
        lessons,
        mockVideoQuizzes.filter(quiz => lessonIds.has(quiz.lesson_id)),
        mockLessonProgress.filter(progress => lessonIds.has(progress.lesson_id)),
        mockVideoQuizResponses.filter(response => lessonIds.has(response.lesson_id)),
        mockReviewAttempts.filter(attempt => lessonIds.has(attempt.lesson_id)),
        mockReviewAnswers,
        mockReviewQuestions.filter(question => lessonIds.has(question.lesson_id)),
      );
    }

    const client = adminClient()!;
    const enrollments = await this.getCourseEnrollments(courseId);
    const { data: lessonRows, error: lessonsError } = await client
      .from('course_lessons')
      .select('*')
      .eq('course_id', courseId)
      .eq('is_published', true);
    if (lessonsError) throw lessonsError;

    const lessons = (lessonRows || []) as CourseLesson[];
    const lessonIds = lessons.map(lesson => lesson.id);
    const userIds = enrollments.map(enrollment => enrollment.user_id);
    if (lessonIds.length === 0 || userIds.length === 0) {
      return buildStatistics(enrollments, lessons, [], [], []);
    }

    const [quizzesResult, progressResult, responsesResult, reviewAttemptsResult, reviewQuestionsResult] = await Promise.all([
      client.from('course_lesson_quizzes').select('*').in('lesson_id', lessonIds),
      client.from('lesson_progress').select('*').in('lesson_id', lessonIds).in('user_id', userIds),
      client.from('video_quiz_responses').select('*').in('lesson_id', lessonIds).in('user_id', userIds),
      client.from('course_lesson_review_attempts').select('*').in('lesson_id', lessonIds).in('user_id', userIds),
      client.from('course_lesson_review_questions').select('*').in('lesson_id', lessonIds),
    ]);
    if (quizzesResult.error) throw quizzesResult.error;
    if (progressResult.error) throw progressResult.error;
    if (responsesResult.error) throw responsesResult.error;
    if (reviewAttemptsResult.error) throw reviewAttemptsResult.error;
    if (reviewQuestionsResult.error) throw reviewQuestionsResult.error;
    const reviewAttemptIds = (reviewAttemptsResult.data || []).map((row: any) => row.id);
    const reviewAnswersResult = reviewAttemptIds.length
      ? await client.from('course_lesson_review_answers').select('*').in('attempt_id', reviewAttemptIds)
      : { data: [], error: null };
    if (reviewAnswersResult.error) throw reviewAnswersResult.error;

    return buildStatistics(
      enrollments,
      lessons,
      (quizzesResult.data || []).map((quiz: any) => ({ ...quiz, options: Array.isArray(quiz.options) ? quiz.options : JSON.parse(quiz.options || '[]') })),
      (progressResult.data || []) as LessonProgress[],
      (responsesResult.data || []) as VideoQuizResponse[],
      (reviewAttemptsResult.data || []).map((row: any) => ({ ...row, score: Number(row.score), earned_points: Number(row.earned_points), total_points: Number(row.total_points) })),
      (reviewAnswersResult.data || []).map((row: any) => ({ ...row, awarded_points: Number(row.awarded_points) })),
      (reviewQuestionsResult.data || []).map((row: any) => ({ ...row, options: Array.isArray(row.options) ? row.options : JSON.parse(row.options || '[]'), points: Number(row.points) })),
    );
  },

  // --------------------------------------------------------------------------
  // VIDEO QUIZZES
  // --------------------------------------------------------------------------

  async getVideoQuizzes(lessonId: string): Promise<CourseLessonQuiz[]> {
    if (isInMockMode()) {
      return mockVideoQuizzes
        .filter(q => q.lesson_id === lessonId)
        .sort((a, b) => a.order_index - b.order_index || a.timestamp_sec - b.timestamp_sec);
    }
    const client = adminClient()!;
    const { data, error } = await client
      .from('course_lesson_quizzes')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('order_index')
      .order('timestamp_sec');
    if (error) throw error;
    return (data || []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]') }));
  },

  async getVideoQuizById(id: string): Promise<CourseLessonQuiz | null> {
    if (isInMockMode()) return mockVideoQuizzes.find(quiz => quiz.id === id) || null;
    const client = adminClient()!;
    const { data, error } = await client.from('course_lesson_quizzes').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { ...data, options: Array.isArray(data.options) ? data.options : JSON.parse(data.options || '[]') };
  },

  async createVideoQuiz(quiz: Omit<CourseLessonQuiz, 'id' | 'created_at'>): Promise<CourseLessonQuiz> {
    if (isInMockMode()) {
      const newQuiz: CourseLessonQuiz = { ...quiz, id: `vq-${Date.now()}`, created_at: new Date().toISOString() };
      mockVideoQuizzes.push(newQuiz);
      return newQuiz;
    }
    const client = adminClient()!;
    const { data, error } = await client
      .from('course_lesson_quizzes')
      .insert([{ ...quiz, options: JSON.stringify(quiz.options) }])
      .select().single();
    if (error) throw error;
    return { ...data, options: Array.isArray(data.options) ? data.options : JSON.parse(data.options || '[]') };
  },

  async updateVideoQuiz(id: string, updates: Partial<Omit<CourseLessonQuiz, 'id' | 'created_at'>>): Promise<CourseLessonQuiz> {
    if (isInMockMode()) {
      const idx = mockVideoQuizzes.findIndex(q => q.id === id);
      if (idx === -1) throw new Error('Quiz not found');
      mockVideoQuizzes[idx] = { ...mockVideoQuizzes[idx], ...updates };
      return mockVideoQuizzes[idx];
    }
    const client = adminClient()!;
    const payload: any = { ...updates };
    if (updates.options) payload.options = JSON.stringify(updates.options);
    const { data, error } = await client
      .from('course_lesson_quizzes')
      .update(payload).eq('id', id).select().single();
    if (error) throw error;
    return { ...data, options: Array.isArray(data.options) ? data.options : JSON.parse(data.options || '[]') };
  },

  async deleteVideoQuiz(id: string): Promise<void> {
    if (isInMockMode()) {
      mockVideoQuizzes = mockVideoQuizzes.filter(q => q.id !== id);
      return;
    }
    const client = adminClient()!;
    const { error } = await client.from('course_lesson_quizzes').delete().eq('id', id);
    if (error) throw error;
  },

  async saveVideoQuizResponse(response: Omit<VideoQuizResponse, 'id' | 'answered_at'>): Promise<VideoQuizResponse> {
    if (isInMockMode()) {
      const existing = response.client_event_id && mockVideoQuizResponses.find(r => r.client_event_id === response.client_event_id);
      if (existing) {
        if (existing.quiz_id !== response.quiz_id || existing.user_id !== response.user_id || existing.guest_id !== response.guest_id || existing.selected_answer !== response.selected_answer) throw new Error('Conflicting quiz response');
        return existing;
      }
      const newResp: VideoQuizResponse = { ...response, id: `vqr-${Date.now()}`, answered_at: new Date().toISOString() };
      mockVideoQuizResponses.push(newResp);
      return newResp;
    }
    const client = adminClient()!;
    const { data, error } = await client
      .from('video_quiz_responses')
      .insert([response])
      .select().single();
    // A retry after a lost HTTP response must not count the same mistake twice.
    if (error?.code === '23505' && response.client_event_id) {
      let query = client.from('video_quiz_responses').select('*')
        .eq('client_event_id', response.client_event_id).eq('quiz_id', response.quiz_id)
        .eq('lesson_id', response.lesson_id).eq('selected_answer', response.selected_answer);
      query = response.user_id ? query.eq('user_id', response.user_id) : query.is('user_id', null).eq('guest_id', response.guest_id!);
      const existing = await query.maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return existing.data;
    }
    if (error) throw error;
    return data;
  },

  /** Get all responses for a lesson — for teacher analytics */
  async getVideoQuizResponsesByLesson(lessonId: string): Promise<(VideoQuizResponse & { user?: Pick<User, 'id' | 'fullname' | 'email'> })[]> {
    if (isInMockMode()) {
      return mockVideoQuizResponses
        .filter(r => r.lesson_id === lessonId)
        .map(r => ({ ...r, user: mockUsers.find(u => u.id === r.user_id) }));
    }
    const client = adminClient()!;
    const { data, error } = await client
      .from('video_quiz_responses')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('answered_at', { ascending: false });
    if (error) throw error;
    const rows = data || [];
    // Fetch user info separately
    const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
    let usersMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users } = await client.from('users').select('id, fullname, email').in('id', userIds);
      if (users) usersMap = Object.fromEntries(users.map((u: any) => [u.id, u]));
    }
    return rows.map((r: any) => ({ ...r, user: usersMap[r.user_id] || undefined }));
  },

  /** Latest saved answer for every quiz in a lesson by one learner. */
  async getLatestVideoQuizResponses(lessonId: string, userId?: string, guestId?: string): Promise<VideoQuizResponse[]> {
    if (!userId && !guestId) return [];
    const matchesLearner = (response: VideoQuizResponse) => userId
      ? response.user_id === userId
      : response.guest_id === guestId;
    const keepLatest = (responses: VideoQuizResponse[]) => {
      const latest = new Map<string, VideoQuizResponse>();
      for (const response of responses) {
        const previous = latest.get(response.quiz_id);
        const isNewer = !previous
          || new Date(response.answered_at).getTime() > new Date(previous.answered_at).getTime()
          || (response.answered_at === previous.answered_at && response.attempt_number > previous.attempt_number);
        if (isNewer) latest.set(response.quiz_id, response);
      }
      return [...latest.values()];
    };

    if (isInMockMode()) {
      return keepLatest(mockVideoQuizResponses.filter(response => response.lesson_id === lessonId && matchesLearner(response)));
    }

    const client = adminClient()!;
    let query = client.from('video_quiz_responses').select('*').eq('lesson_id', lessonId);
    query = userId ? query.eq('user_id', userId) : query.eq('guest_id', guestId!);
    const { data, error } = await query;
    if (error) throw error;
    return keepLatest((data || []) as VideoQuizResponse[]);
  },

  /** Get attempt count per quiz for a specific user/guest in a lesson */
  async getVideoQuizAttemptCounts(lessonId: string, userId?: string, guestId?: string): Promise<Record<string, number>> {
    const stats = await db.getVideoQuizAttemptStats(lessonId, userId, guestId);
    return Object.fromEntries(Object.entries(stats).map(([id, value]) => [id, value.attempts]));
  },

  async getVideoQuizAttemptStats(lessonId: string, userId?: string, guestId?: string): Promise<Record<string, { attempts: number; wrongAttempts: number }>> {
    if (!userId && !guestId) return {};
    const stats: Record<string, { attempts: number; wrongAttempts: number }> = {};
    const count = (rows: Pick<VideoQuizResponse, 'quiz_id' | 'is_correct'>[]) => {
      for (const row of rows) {
        const value = stats[row.quiz_id] ||= { attempts: 0, wrongAttempts: 0 };
        value.attempts++;
        if (!row.is_correct) value.wrongAttempts++;
      }
    };
    if (isInMockMode()) {
      const relevant = mockVideoQuizResponses.filter(r =>
        r.lesson_id === lessonId && (userId ? r.user_id === userId : r.user_id === null && r.guest_id === guestId)
      );
      count(relevant);
      return stats;
    }
    const client = adminClient()!;
    for (let offset = 0; ; offset += 1000) {
      let query = client.from('video_quiz_responses').select('quiz_id, is_correct').eq('lesson_id', lessonId).order('id').range(offset, offset + 999);
      query = userId ? query.eq('user_id', userId) : query.is('user_id', null).eq('guest_id', guestId!);
      const { data, error } = await query;
      if (error) throw error;
      count(data || []);
      if (!data || data.length < 1000) break;
    }
    return stats;
  },

  // --------------------------------------------------------------------------
  // TEACHER NOTICES & TIMETABLE IMAGES
  // --------------------------------------------------------------------------

  async getTeacherNotices(includeUnpublished = false, teacherId?: string): Promise<TeacherNotice[]> {
    if (isInMockMode()) {
      return mockTeacherNotices
        .filter(notice => (includeUnpublished || notice.is_published) && (!teacherId || notice.recipient_teacher_id === null || notice.recipient_teacher_id === teacherId))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    const client = adminClient()!;
    let query = client.from('teacher_notices').select('*').order('created_at', { ascending: false });
    if (!includeUnpublished) query = query.eq('is_published', true);
    if (teacherId) query = query.or(`recipient_teacher_id.is.null,recipient_teacher_id.eq.${teacherId}`);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as TeacherNotice[];
  },

  async createTeacherNotice(notice: Omit<TeacherNotice, 'id' | 'created_at'>): Promise<TeacherNotice> {
    if (isInMockMode()) {
      const created: TeacherNotice = { ...notice, id: `teacher-notice-${Date.now()}`, created_at: new Date().toISOString() };
      mockTeacherNotices.unshift(created);
      return created;
    }
    const client = adminClient()!;
    const { data, error } = await client.from('teacher_notices').insert([notice]).select().single();
    if (error) throw error;
    return data as TeacherNotice;
  },

  async updateTeacherNotice(id: string, updates: Partial<Omit<TeacherNotice, 'id' | 'created_at'>>): Promise<TeacherNotice> {
    if (isInMockMode()) {
      const index = mockTeacherNotices.findIndex(notice => notice.id === id);
      if (index === -1) throw new Error('Teacher notice not found');
      mockTeacherNotices[index] = { ...mockTeacherNotices[index], ...updates };
      return mockTeacherNotices[index];
    }
    const client = adminClient()!;
    const { data, error } = await client.from('teacher_notices').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as TeacherNotice;
  },

  async deleteTeacherNotice(id: string): Promise<void> {
    if (isInMockMode()) {
      mockTeacherNotices = mockTeacherNotices.filter(notice => notice.id !== id);
      return;
    }
    const client = adminClient()!;
    const { error } = await client.from('teacher_notices').delete().eq('id', id);
    if (error) throw error;
  },
};


// ============================================================================
// PHÒNG THI ẢO — In-Memory Store (works for both mock and production SSR)
// Rooms are ephemeral: they live for the duration of the server process.
// For production with multiple workers, a shared store (Redis/Supabase) is needed.
// ============================================================================

import type { ExamRoom, RoomParticipant } from '../types';

let _examRooms: ExamRoom[] = [];
let _roomParticipants: RoomParticipant[] = [];

/** Generate a random 4-digit room code */
function generateRoomCode(): string {
  const chars = '0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Ensure the code is unique among active rooms */
function uniqueRoomCode(): string {
  let code = generateRoomCode();
  let attempts = 0;
  while (_examRooms.some(r => r.code === code && r.status !== 'closed') && attempts < 20) {
    code = generateRoomCode();
    attempts++;
  }
  return code;
}

export const roomStore = {
  // ── Teacher operations ──────────────────────────────────────────────────────

  async createRoom(examId: string, teacherId: string): Promise<ExamRoom> {
    // Fetch exam info to denormalize title/duration
    let examTitle = '';
    let examDuration = 90;
    try {
      const exam = await db.getExamById(examId);
      if (exam) {
        examTitle = exam.title;
        examDuration = exam.duration;
      }
    } catch (_) {}

    const room: ExamRoom = {
      id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code: uniqueRoomCode(),
      exam_id: examId,
      exam_title: examTitle,
      exam_duration: examDuration,
      teacher_id: teacherId,
      status: 'waiting',
      created_at: new Date().toISOString(),
      closed_at: null,
    };
    _examRooms.push(room);
    return room;
  },

  getRoomByCode(code: string): ExamRoom | null {
    return _examRooms.find(r => r.code === code.toUpperCase()) ?? null;
  },

  getRoomById(id: string): ExamRoom | null {
    return _examRooms.find(r => r.id === id) ?? null;
  },

  getTeacherRooms(teacherId: string): ExamRoom[] {
    return _examRooms
      .filter(r => r.teacher_id === teacherId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  activateRoom(roomId: string): ExamRoom | null {
    const room = _examRooms.find(r => r.id === roomId);
    if (room) room.status = 'active';
    return room ?? null;
  },

  closeRoom(roomId: string): ExamRoom | null {
    const room = _examRooms.find(r => r.id === roomId);
    if (room) {
      room.status = 'closed';
      room.closed_at = new Date().toISOString();
    }
    return room ?? null;
  },

  // ── Participant operations ──────────────────────────────────────────────────

  joinRoom(roomId: string, displayName: string, totalQuestions: number): RoomParticipant {
    // Prevent duplicate name in same room (re-join scenario)
    const existing = _roomParticipants.find(
      p => p.room_id === roomId && p.display_name.toLowerCase() === displayName.toLowerCase()
    );
    if (existing) return existing;

    const participant: RoomParticipant = {
      id: `rp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      room_id: roomId,
      display_name: displayName,
      joined_at: new Date().toISOString(),
      submitted_at: null,
      score: null,
      total_questions: totalQuestions,
      answered_count: 0,
    };
    _roomParticipants.push(participant);
    return participant;
  },

  getParticipant(participantId: string): RoomParticipant | null {
    return _roomParticipants.find(p => p.id === participantId) ?? null;
  },

  getParticipants(roomId: string): RoomParticipant[] {
    return _roomParticipants
      .filter(p => p.room_id === roomId)
      .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
  },

  updateProgress(participantId: string, answeredCount: number): RoomParticipant | null {
    const p = _roomParticipants.find(p => p.id === participantId);
    if (p && !p.submitted_at) p.answered_count = answeredCount;
    return p ?? null;
  },

  submitParticipant(participantId: string, score: number, answeredCount: number): RoomParticipant | null {
    const p = _roomParticipants.find(p => p.id === participantId);
    if (p) {
      p.score = score;
      p.answered_count = answeredCount;
      p.submitted_at = new Date().toISOString();
    }
    return p ?? null;
  },
};
