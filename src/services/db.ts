import { isMockModeForEnv, supabase, createAdminSupabase, createServerSupabase } from '../lib/supabase';
import { calculateEffectiveQuestionCount } from '../lib/exam';
import { extractMentionedNames as extractMentionNames } from '../lib/forum-security';
import { toPgVector } from '../lib/forum-embeddings';
import type { Subject, Question, Answer, Exam, Attempt, User, Blog, Comment, Course, CourseLesson, CourseEnrollment, LessonProgress, Category, CourseLessonQuiz, VideoQuizResponse, CourseLessonReviewQuestion, CourseLessonReviewAttempt, CourseLessonReviewAnswer, CourseLearningStatistic, LearnerSkillMastery, UserCourseInsights, TeacherNotice, Class, ClassMember, ClassAssignment, ClassAssignmentView, PadletBoard, PadletNote, PadletComment, PadletColor, PadletTheme, PadletLayoutMode, PadletColumn, ForumCategory, ForumThread, ForumPost, ForumAuthor, ForumThreadQuery, ForumStats, ForumReaction, ForumReactionKind, ForumInteractionState, ForumNotification, ForumReport, ForumReportReason, ForumReportStatus, ForumUserStat, ForumAnalytics, ForumThreadPage } from '../types';

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
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
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

/** SEO-friendly slug cho thread diễn đàn (dùng chung bộ slugify tiếng Việt). */
export function generateForumSlug(title: string): string {
  return generateExamSlug(title);
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

// ── Class management mock data ────────────────────────────────────────────────
let mockClasses: Class[] = [
  {
    id: 'mock-class-1',
    name: 'Lớp 12A1',
    grade: '12',
    subject: 'Toán',
    color: '#6366f1',
    teacher_id: 'mock-user-teacher',
    created_at: new Date().toISOString(),
    memberCount: 1
  },
  {
    id: 'mock-class-2',
    name: 'Lớp 12A2',
    grade: '12',
    subject: 'Toán',
    color: '#10b981',
    teacher_id: 'mock-user-teacher',
    created_at: new Date().toISOString(),
    memberCount: 0
  }
];

let mockClassMembers: (Omit<ClassMember, 'user'> & { user?: ClassMember['user'] })[] = [
  {
    class_id: 'mock-class-1',
    user_id: 'mock-user-student',
    joined_at: new Date().toISOString(),
    user: {
      id: 'mock-user-student',
      email: 'student@lop12.vn',
      fullname: 'Học Sinh Thử Nghiệm',
      avatar_url: null,
      role: 'student'
    }
  }
];

let mockClassAssignments: ClassAssignment[] = [
  {
    id: 'mock-assign-material-1',
    class_id: 'mock-class-1',
    type: 'material',
    ref_id: 'mat-sample-1',
    ref_title: 'Chuyên đề: Phương pháp giải nhanh Toán 12 (Tài liệu PDF & Video YouTube)',
    assigned_by: 'mock-user-teacher',
    assigned_at: new Date(Date.now() - 86400000).toISOString(),
    deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
    note: 'Các em tải/xem tài liệu và theo dõi kỹ video bài giảng để nắm vững phương pháp.',
    attachment_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    attachment_type: 'pdf',
    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  }
];

let mockAssignmentViews: ClassAssignmentView[] = [
  {
    id: 'view-sample-1',
    assignment_id: 'mock-assign-material-1',
    user_id: 'mock-user-student',
    document_views: 2,
    youtube_views: 1,
    last_viewed_at: new Date().toISOString()
  }
];

let mockBlogs: Blog[] = [];

let mockCategories: Category[] = [];

// ── Diễn đàn Học sinh (mock) ─────────────────────────────────────────────────
// Dùng khi chưa apply migration hoặc đang chạy local mà chưa có bảng forum_*.
let mockForumCategories: ForumCategory[] = [
  { id: 'forum-cat-chung', name: 'Học tập chung', slug: 'hoc-tap-chung', description: 'Kinh nghiệm ôn thi, quản lý thời gian, tâm lý trước kỳ thi THPT.', icon: '🎓', subject_id: null, parent_id: null, order_index: 0, is_active: true, created_at: new Date().toISOString() },
  { id: 'forum-cat-toan', name: 'Toán 12', slug: 'toan-12', description: 'Hỏi đáp công thức, phương pháp giải nhanh và các dạng bài khó.', icon: '∑', subject_id: null, parent_id: null, order_index: 1, is_active: true, created_at: new Date().toISOString() },
  { id: 'forum-cat-ly', name: 'Vật lý 12', slug: 'vat-ly-12', description: 'Dao động, sóng, điện từ trường và các bài tập nâng cao.', icon: '⚡', subject_id: null, parent_id: null, order_index: 2, is_active: true, created_at: new Date().toISOString() },
  { id: 'forum-cat-hoa', name: 'Hóa học 12', slug: 'hoa-hoc-12', description: 'Este, lipit, điện giải và kỹ năng giải bài tập hóa.', icon: '⚗️', subject_id: null, parent_id: null, order_index: 3, is_active: true, created_at: new Date().toISOString() },
  { id: 'forum-cat-sinh', name: 'Sinh học 12', slug: 'sinh-hoc-12', description: 'Di truyền, tiến hóa, sinh thái và các đề thử chuyên sâu.', icon: '🧬', subject_id: null, parent_id: null, order_index: 4, is_active: true, created_at: new Date().toISOString() },
  { id: 'forum-cat-anh', name: 'Tiếng Anh 12', slug: 'tieng-anh-12', description: 'Ngữ pháp, từ vựng, đọc hiểu và kỹ năng làm bài thi.', icon: '🔤', subject_id: null, parent_id: null, order_index: 5, is_active: true, created_at: new Date().toISOString() },
];

const forumAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

let mockForumPosts: ForumPost[] = [
  {
    id: 'forum-post-1', thread_id: 'forum-thread-1', author_id: 'mock-user-teacher', parent_id: null,
    body: 'Chào em! Em áp dụng công thức đạo hàm của $y = \\dfrac{x-1}{x+2}$:\n\n$$y\' = \\dfrac{(x+2) - (x-1)}{(x+2)^2} = \\dfrac{3}{(x+2)^2}$$\n\nVì $(x+2)^2 > 0$ với mọi $x \\ne -2$ nên $y\' > 0$, hàm **đồng biến** trên từng khoảng $(-\\infty; -2)$ và $(-2; +\\infty)$. Em nhớ không được kết luận đồng biến trên $\\mathbb{R}$ nhé.',
    is_answer: true, created_at: forumAgo(165), updated_at: forumAgo(165),
  },
  {
    id: 'forum-post-2', thread_id: 'forum-thread-1', author_id: 'mock-user-student', parent_id: 'forum-post-1',
    body: 'Dạ em hiểu rồi ạ, trước em hay quên mất điểm $x=-2$ không có nghĩa là hàm xác định. Cảm ơn thầy! 🙏',
    is_answer: false, created_at: forumAgo(140), updated_at: forumAgo(140),
  },
  {
    id: 'forum-post-3', thread_id: 'forum-thread-2', author_id: 'mock-user-student', parent_id: null,
    body: 'Mình dùng cách đặt $u = \\sqrt{x}$ rồi giải phương trình bậc hai, được 2 nghiệm nhưng nghiệm $x=4$ không thỏa điều kiện. Mọi người kiểm tra giúp mình với!',
    is_answer: false, created_at: forumAgo(300), updated_at: forumAgo(300),
  },
  {
    id: 'forum-post-4', thread_id: 'forum-thread-3', author_id: 'mock-user-teacher', parent_id: null,
    body: 'Lịch ôn gợi ý cho 2 tuần cuối: **50% thời gian làm đề thử + 30% sửa lỗi sai + 20% ôn lý thuyết**. Quan trọng là sau mỗi đề phải ghi lại "nguyên nhân sai" thành tag để ôn lại sau nhé.',
    is_answer: false, created_at: forumAgo(1440), updated_at: forumAgo(1440),
  },
  {
    id: 'forum-post-5', thread_id: 'forum-thread-4', author_id: 'mock-user-student', parent_id: null,
    body: 'Dao động điều hòa: $a = -\\omega^2 x$. Mình hay nhớ bằng cách: gia tốc luôn hướng về vị trí cân bằng và tỉ lệ nghịch với li độ. Công thức từng phần: $x^2 + \\dfrac{v^2}{\\omega^2} = A^2$.',
    is_answer: false, created_at: forumAgo(40), updated_at: forumAgo(40),
  },
];

let mockForumThreads: ForumThread[] = [
  {
    id: 'forum-thread-1', category_id: 'forum-cat-toan', author_id: 'mock-user-student',
    title: 'Cách khảo sát sự biến thiên của y = (x-1)/(x+2)?',
    slug: 'khao-sat-su-bien-thien-cua-y-bang-phan-thuc', category: mockForumCategories[1],
    body: 'Em làm đến bước tính đạo hàm thì bối rối phần xác định với tiệm cận đứng ạ.\n\nCho $y = \\dfrac{x-1}{x+2}$. Em tính được $y\' = \\dfrac{3}{(x+2)^2}$ nhưng không biết kết luận đồng biến trên $\\mathbb{R}$ được không. Mong mọi người chỉ giúp ạ!',
    tags: ['dao-ham', 'khao-sat-ham-so', 'lop-12'], status: 'solved', is_pinned: false, is_anonymous: false,
    views_count: 128, reply_count: 2, last_activity_at: forumAgo(140), accepted_post_id: 'forum-post-1',
    created_at: forumAgo(180), updated_at: forumAgo(140),
  },
  {
    id: 'forum-thread-2', category_id: 'forum-cat-toan', author_id: 'mock-user-student',
    title: 'Giải phương trình chứa căn: nghiệm phụ xuất hiện ở đâu?',
    slug: 'giai-phuong-trinh-chua-can-nghiem-phu', category: mockForumCategories[1],
    body: 'Bài toán: $\\sqrt{x+5} = x - 1$. Mình bình phương 2 vế thì ra $x^2 - 3x - 4 = 0$, được $x=4$ và $x=-1$. Thay vào thì chỉ $x=4$ thỏa. Có cách nào nhận ra nghiệm phụ ngay không các bạn?',
    tags: ['phuong-trinh', 'can-bac-hai'], status: 'open', is_pinned: false, is_anonymous: false,
    views_count: 64, reply_count: 1, last_activity_at: forumAgo(300), accepted_post_id: null,
    created_at: forumAgo(320), updated_at: forumAgo(300),
  },
  {
    id: 'forum-thread-3', category_id: 'forum-cat-chung', author_id: 'mock-user-teacher',
    title: 'Chia lịch ôn 2 tuần cuối trước kỳ thi thử lần 3',
    slug: 'lich-on-2-tuan-cuoi-truoc-ky-thi-thu', category: mockForumCategories[0],
    body: 'Các em đang hỏi mình nhiều về cách phân bổ thời gian. Mình gợi ý một khung cơ bản, mỗi người điều chỉnh theo điểm yếu của mình:\n\n- **50%** làm đề thử đúng thời gian\n- **30%** sửa lỗi sai, ghi rõ nguyên nhân\n- **20%** ôn lại lý thuyết chưa chắc\n\nAi có cách hiệu quả hơn thì chia sẻ để cả lớp cùng học tập nhé!',
    tags: ['on-thi', 'kinh-nghiem'], status: 'open', is_pinned: true, is_anonymous: false,
    views_count: 342, reply_count: 1, last_activity_at: forumAgo(1440), accepted_post_id: null,
    created_at: forumAgo(1500), updated_at: forumAgo(1440),
  },
  {
    id: 'forum-thread-4', category_id: 'forum-cat-ly', author_id: 'mock-user-student',
    title: 'Tóm tắt công thức dao động điều hòa dễ nhớ',
    slug: 'tom-tat-cong-thuc-dao-dong-dieu-hoa', category: mockForumCategories[2],
    body: 'Mình vừa gom lại mấy công thức hay dùng, ae kiểm tra giúp:\n\n$$x = A\\cos(\\omega t + \\varphi), \\quad v = -\\omega A\\sin(\\omega t + \\varphi)$$\n$$a = -\\omega^2 x, \\quad A^2 = x^2 + \\frac{v^2}{\\omega^2}$$\n\nNếu có dạng bài nào hay "bẫy" thì comment thêm cho mình với!',
    tags: ['dao-dong', 'cong-thuc', 'vat-ly-12'], status: 'open', is_pinned: false, is_anonymous: false,
    views_count: 87, reply_count: 1, last_activity_at: forumAgo(40), accepted_post_id: null,
    created_at: forumAgo(60), updated_at: forumAgo(40),
  },
  {
    id: 'forum-thread-5', category_id: 'forum-cat-anh', author_id: 'mock-user-student',
    title: 'Phân biệt relative clause xác định và không xác định',
    slug: 'phan-biet-relative-clause-xac-dinh', category: mockForumCategories[5],
    body: 'Mình vẫn hay nhầm dấu phẩy với **that**. Có bạn nào giải thích đơn giản kiểu "nhìn là biết ngay" không? Ví dụ: *The boy who is standing there is my brother.*',
    tags: ['grammar', 'relative-clause'], status: 'open', is_pinned: false, is_anonymous: true,
    views_count: 45, reply_count: 0, last_activity_at: forumAgo(15), accepted_post_id: null,
    created_at: forumAgo(15), updated_at: forumAgo(15),
  },
];

// Phase 2–4: trạng thái tương tác/thông báo trong mock mode.
let mockForumReactions: ForumReaction[] = [
  { post_id: 'forum-post-1', user_id: 'mock-user-student', kind: 'helpful', created_at: forumAgo(160) },
  { post_id: 'forum-post-4', user_id: 'mock-user-student', kind: 'like', created_at: forumAgo(1200) },
];
let mockForumBookmarks: Array<{ thread_id: string; user_id: string; created_at: string }> = [
  { thread_id: 'forum-thread-3', user_id: 'mock-user-student', created_at: forumAgo(1000) },
];
let mockForumFollows: Array<{ thread_id: string; user_id: string; created_at: string }> = [
  { thread_id: 'forum-thread-1', user_id: 'mock-user-student', created_at: forumAgo(150) },
];
let mockForumNotifications: ForumNotification[] = [
  {
    id: 'forum-notif-1', user_id: 'mock-user-student', type: 'answer',
    payload: { thread_id: 'forum-thread-1', thread_title: 'Cách khảo sát sự biến thiên của y = (x-1)/(x+2)?', actor: 'Giáo viên' },
    read_at: null, created_at: forumAgo(160),
  },
];
let mockForumReports: ForumReport[] = [];

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

// ── Forum helpers ────────────────────────────────────────────────────────────
/** Trên local, nếu bảng forum_* chưa có hoặc lỗi, dùng dữ liệu mẫu trong memory. */
function forumDevFallback(): boolean {
  return import.meta.env.DEV;
}

function forumWarn(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[db.${scope}] Supabase unavailable, dùng forum mock:`, message);
}

function forumAuthorMap(users: User[]): Map<string, ForumAuthor> {
  return new Map(users.map(u => [u.id, {
    id: u.id,
    fullname: u.fullname,
    avatar_url: u.avatar_url,
    role: u.role,
  }]));
}

function mockForumAuthorMap(): Map<string, ForumAuthor> {
  return forumAuthorMap(mockUsers);
}

function decorateForumThread(
  thread: ForumThread,
  categories: ForumCategory[],
  authors: Map<string, ForumAuthor>,
): ForumThread {
  return {
    ...thread,
    category: categories.find(c => c.id === thread.category_id) || null,
    author: thread.is_anonymous ? null : (authors.get(thread.author_id) || null),
  };
}

function decorateForumPost(post: ForumPost, authors: Map<string, ForumAuthor>): ForumPost {
  return { ...post, author: authors.get(post.author_id) || null };
}

function sortForumThreads(threads: ForumThread[], sort: ForumThreadQuery['sort']): ForumThread[] {
  const byDate = (a: string, b: string) => new Date(b).getTime() - new Date(a).getTime();
  return [...threads].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    if (sort === 'popular') return b.views_count - a.views_count || byDate(a.last_activity_at, b.last_activity_at);
    if (sort === 'active') return byDate(a.last_activity_at, b.last_activity_at);
    return byDate(a.created_at, b.created_at);
  });
}

const FORUM_REACTION_KINDS: ForumReactionKind[] = ['like', 'helpful', 'heart'];

function forumReactionCounts(reactions: ForumReaction[]): Record<ForumReactionKind, number> {
  const counts: Record<ForumReactionKind, number> = { like: 0, helpful: 0, heart: 0 };
  reactions.forEach(r => {
    if (FORUM_REACTION_KINDS.includes(r.kind)) counts[r.kind] += 1;
  });
  return counts;
}

/** Gắn tổng hợp cảm xúc vào bài trả lời trước khi trả ra page. */
function decorateForumPostsWithReactions(
  posts: ForumPost[],
  reactions: ForumReaction[],
  viewerId: string | null,
): ForumPost[] {
  return posts.map(post => {
    const own = reactions.filter(r => r.post_id === post.id);
    return {
      ...post,
      reaction_counts: forumReactionCounts(own),
      viewer_reaction: viewerId ? (own.find(r => r.user_id === viewerId)?.kind ?? null) : null,
    };
  });
}

/** Thông báo trong mock mode (reply cho chủ thread + follower + @mention). */
function forumNotifyMock(
  thread: ForumThread,
  postId: string,
  authorId: string,
  body: string,
  extraType?: ForumNotification['type'],
): void {
  const recipients = new Set<string>();
  if (extraType === 'answer') recipients.add(thread.author_id);
  mockForumFollows
    .filter(f => f.thread_id === thread.id && f.user_id !== authorId)
    .forEach(f => recipients.add(f.user_id));
  extractMentionNames(body).forEach(name => {
    mockUsers
      .filter(u => u.id !== authorId && u.fullname && name.toLowerCase().includes(u.fullname.toLowerCase().split(' ')[0]))
      .forEach(u => recipients.add(u.id));
  });

  recipients.forEach(userId => {
    mockForumNotifications.unshift({
      id: `forum-notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user_id: userId,
      type: extraType === 'answer' ? 'answer' : 'reply',
      payload: { thread_id: thread.id, thread_title: thread.title, post_id: postId, actor: 'Thành viên' },
      read_at: null,
      created_at: new Date().toISOString(),
    });
  });
}

/** Fallback tìm kiếm ngữ nghĩa khi không có pgvector/Gemini: tag + từ khoá. */
function forumTextScore(thread: ForumThread, tokens: string[]): number {
  if (!tokens.length) return 0;
  const haystack = `${thread.title} ${thread.body} ${(thread.tags || []).join(' ')}`.toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0) / tokens.length;
}

function forumTokenize(text: string): string[] {
  return Array.from(new Set(
    text.toLowerCase()
      .replace(/[\p{P}\p{S}]+/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !['cach', 'nhung', 'khong', 'mot', 'cac', 'cho', 'voi'].includes(w))
  ));
}

function mockForumUserStats(): ForumUserStat[] {
  return mockUsers.map(u => {
    const threadsCount = mockForumThreads.filter(t => t.author_id === u.id).length;
    const answersCount = mockForumPosts.filter(p => p.author_id === u.id).length;
    const acceptedCount = mockForumPosts.filter(p => p.author_id === u.id && p.is_answer).length;
    const helpfulCount = mockForumReactions.filter(r =>
      r.kind !== 'like' && mockForumPosts.some(p => p.id === r.post_id && p.author_id === u.id)).length;
    const badges = [
      acceptedCount >= 1 ? 'Chuyên gia giải đáp' : null,
      threadsCount >= 2 ? 'Người hỏi tích cực' : null,
      answersCount >= 2 ? 'Thành viên nhiệt tình' : null,
      u.role === 'teacher' || u.role === 'admin' ? 'Giáo viên xác thực' : null,
    ].filter(Boolean) as string[];
    return {
      user_id: u.id,
      threads_count: threadsCount,
      answers_count: answersCount,
      accepted_count: acceptedCount,
      helpful_count: helpfulCount,
      reputation: threadsCount * 5 + answersCount * 2 + acceptedCount * 15 + helpfulCount * 3,
      badges,
      user: { id: u.id, fullname: u.fullname, avatar_url: u.avatar_url, role: u.role },
    };
  }).filter(s => s.threads_count + s.answers_count > 0 || s.user?.role === 'teacher' || s.user?.role === 'admin');
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
      const questionsByExam: Record<string, any[]> = {};
      for (const eq of mockExamQuestions) {
        if (examIds.includes(eq.exam_id)) {
          const q = mockQuestions.find(mq => mq.id === eq.question_id);
          if (q) {
            if (!questionsByExam[eq.exam_id]) questionsByExam[eq.exam_id] = [];
            questionsByExam[eq.exam_id].push(q);
          }
        }
      }
      for (const id of examIds) {
        const exam = mockExams.find(e => e.id === id);
        counts[id] = calculateEffectiveQuestionCount(questionsByExam[id] || [], exam?.settings);
      }
      return counts;
    }

    const client = adminClient()!;
    // NOTE: `type` is NOT a column in the questions table — it is stored inside `metadata` JSONB.
    // Selecting `type` directly causes a Supabase error; use `metadata` only.
    // Fetch both exam_questions and exam settings to accurately calculate effective question count
    const [eqRes, examsRes] = await Promise.all([
      client.from('exam_questions').select('exam_id, questions!inner(metadata)').in('exam_id', examIds),
      client.from('exams').select('id, settings').in('id', examIds),
    ]);

    if (eqRes.error) {
      console.error('[db.getExamQuestionCounts] Supabase exam_questions error:', eqRes.error.message);
    }
    if (examsRes.error) {
      console.error('[db.getExamQuestionCounts] Supabase exams error:', examsRes.error.message);
    }

    const questionsByExam: Record<string, any[]> = {};
    for (const row of (eqRes.data || [])) {
      if (row.exam_id && row.questions) {
        if (!questionsByExam[row.exam_id]) questionsByExam[row.exam_id] = [];
        const q = Array.isArray(row.questions) ? row.questions[0] : row.questions;
        questionsByExam[row.exam_id].push(q);
      }
    }

    const settingsByExam: Record<string, any> = {};
    for (const row of (examsRes.data || [])) {
      settingsByExam[row.id] = row.settings;
    }

    for (const id of examIds) {
      counts[id] = calculateEffectiveQuestionCount(questionsByExam[id] || [], settingsByExam[id]);
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
      // Deduplicate IDs
      const uniqueIds = Array.from(new Set(questionIds));
      // Verify all IDs exist in questions table
      const { data: bankQs, error: verifyError } = await _adminCl
        .from('questions')
        .select('id')
        .in('id', uniqueIds);
      if (verifyError) { console.error('[db.createExam] verify questions error:', verifyError); throw verifyError; }

      const validIds = new Set((bankQs || []).map((r: any) => r.id));

      const junctionRows = uniqueIds
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

  async getQuestionsByMatrix(criteria: {
    subjectId: string;
    categoryId?: string | null;
    chapter?: string;
    textbook?: string;
    levels: {
      nb: number;
      th: number;
      vd: number;
      vdc: number;
    };
    types?: {
      single_choice?: number;
      msq?: number;
      sa?: number;
    };
  }): Promise<{
    questions: (Question & { answers: Answer[]; subject?: Subject })[];
    breakdown: { nb: number; th: number; vd: number; vdc: number };
    warnings: string[];
  }> {
    const allBankQuestions = await this.getQuestions(criteria.subjectId);

    // Filter candidate questions
    let candidates = allBankQuestions;
    if (criteria.categoryId) {
      candidates = candidates.filter(q => q.category_id === criteria.categoryId || q.metadata?.category_id === criteria.categoryId);
    }
    if (criteria.chapter && criteria.chapter.trim()) {
      const chapNorm = criteria.chapter.trim().toLowerCase();
      candidates = candidates.filter(q => (q.metadata?.chapter || '').toLowerCase().includes(chapNorm));
    }
    if (criteria.textbook && criteria.textbook !== 'all') {
      candidates = candidates.filter(q => {
        const tb = q.metadata?.textbook;
        return !tb || tb === 'all' || tb === 'chung' || tb === criteria.textbook;
      });
    }

    // Helper to extract cognitive level
    const getCognitiveLevel = (q: Question): 'nb' | 'th' | 'vd' | 'vdc' => {
      const metaLevel = q.metadata?.cognitive_level || q.metadata?.level;
      if (metaLevel === 'nb' || metaLevel === 'th' || metaLevel === 'vd' || metaLevel === 'vdc') {
        return metaLevel;
      }
      const diff = (q.metadata?.difficulty || q.difficulty || 'medium').toLowerCase();
      if (diff === 'easy' || diff === 'dễ') return 'nb';
      if (diff === 'hard' || diff === 'khó') {
        return (q.type === 'sa' || q.metadata?.type === 'sa') ? 'vdc' : 'vd';
      }
      if (diff === 'very_hard') return 'vdc';
      return 'th';
    };

    // Partition into buckets
    const buckets: Record<'nb' | 'th' | 'vd' | 'vdc', typeof candidates> = {
      nb: [],
      th: [],
      vd: [],
      vdc: []
    };

    candidates.forEach(q => {
      const lvl = getCognitiveLevel(q);
      buckets[lvl].push(q);
    });

    // Shuffle helper
    const shuffle = <T>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const warnings: string[] = [];
    const selected: (Question & { answers: Answer[]; subject?: Subject })[] = [];
    const breakdown = { nb: 0, th: 0, vd: 0, vdc: 0 };

    const levelNames: Record<'nb' | 'th' | 'vd' | 'vdc', string> = {
      nb: 'Nhận biết',
      th: 'Thông hiểu',
      vd: 'Vận dụng',
      vdc: 'Vận dụng cao'
    };

    const targetLevels: ('nb' | 'th' | 'vd' | 'vdc')[] = ['nb', 'th', 'vd', 'vdc'];

    for (const lvl of targetLevels) {
      const needed = criteria.levels[lvl] || 0;
      if (needed <= 0) continue;

      const pool = shuffle(buckets[lvl]);
      const taken = pool.slice(0, needed);
      selected.push(...taken);
      breakdown[lvl] = taken.length;

      if (taken.length < needed) {
        warnings.push(`Ngân hàng chỉ có ${taken.length}/${needed} câu hỏi mức độ "${levelNames[lvl]}".`);
      }
    }

    // Number sequentially and organize by section
    selected.forEach((q, idx) => {
      q.so_cau = idx + 1;
      if (q.type === 'msq' || q.type === 'true_false') {
        q.phan = 'II';
      } else if (q.type === 'sa' || q.type === 'tl') {
        q.phan = 'III';
      } else {
        q.phan = 'I';
      }
    });

    return {
      questions: selected,
      breakdown,
      warnings
    };
  },

  async createQuestion(question: Partial<Omit<Question, 'id'>> & { content: string; subject_id: string; difficulty: 'easy' | 'medium' | 'hard'; type: any; created_by?: string | null }, answers: Omit<Answer, 'id' | 'question_id'>[]): Promise<Question & { answers: Answer[] }> {
    if (isInMockMode()) {
      const newQuestion: Question = {
        de_id: question.de_id || '',
        so_cau: question.so_cau || 1,
        phan: question.phan || 'I',
        options: question.options || [],
        image_url: question.image_url || null,
        metadata: question.metadata || null,
        explanation: question.explanation || null,
        answer: question.answer || null,
        created_by: question.created_by || null,
        category_id: question.category_id || null,
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
      const ans = (att.answers_submitted || {}) as Record<string, any>;
      return {
        ...att,
        student_name: ans._student_name || att.student_name || null,
        student_class: ans._student_class || att.student_class || null,
        tab_switches: typeof ans._tab_switches === 'number' ? ans._tab_switches : 0,
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
    if (error || !data) return null;
    const ans = (data.answers_submitted || {}) as Record<string, any>;
    return {
      ...data,
      student_name: ans._student_name || null,
      student_class: ans._student_class || null,
      tab_switches: typeof ans._tab_switches === 'number' ? ans._tab_switches : 0
    };
  },

  async createAttempt(userId: string | null | undefined, examId: string, studentInfo?: { fullname?: string; class_name?: string }): Promise<Attempt> {
    const initialAnswers: Record<string, any> = {};
    if (studentInfo?.fullname?.trim()) {
      initialAnswers._student_name = studentInfo.fullname.trim();
    }
    if (studentInfo?.class_name?.trim()) {
      initialAnswers._student_class = studentInfo.class_name.trim();
    }
    const hasStudentInfo = Object.keys(initialAnswers).length > 0;

    if (isInMockMode()) {
      const newAttempt: Attempt = {
        id: `att-${Date.now()}`,
        user_id: userId || `guest-${Date.now()}`,
        exam_id: examId,
        score: null,
        answers_submitted: hasStudentInfo ? initialAnswers : null,
        started_at: new Date().toISOString(),
        finished_at: null,
        student_name: initialAnswers._student_name || null,
        student_class: initialAnswers._student_class || null
      };
      mockAttempts.push(newAttempt);
      return newAttempt;
    }

    // Use admin client to bypass RLS — user_id is explicitly set so data is still scoped correctly
    const _adminCl = adminClient();
    const insertPayload: Record<string, any> = {
      user_id: userId || null,
      exam_id: examId
    };
    if (hasStudentInfo) {
      insertPayload.answers_submitted = initialAnswers;
    }

    const { data, error } = await _adminCl!
      .from('attempts')
      .insert([insertPayload])
      .select()
      .single();
    if (error) throw error;
    return {
      ...data,
      student_name: initialAnswers._student_name || null,
      student_class: initialAnswers._student_class || null
    };
  },

  async submitAttempt(attemptId: string, score: number, answersSubmitted: Record<string, any>, scoring?: { raw_score?: number | null; ability_score?: number | null; tab_switches?: number }): Promise<Attempt> {
    if (isInMockMode()) {
      const index = mockAttempts.findIndex(a => a.id === attemptId);
      if (index === -1) throw new Error('Attempt not found');
      const oldAns = (mockAttempts[index].answers_submitted || {}) as Record<string, any>;
      const tabSwitches = scoring?.tab_switches !== undefined ? scoring.tab_switches : (oldAns._tab_switches || 0);
      const mergedAnswers = {
        ...answersSubmitted,
        ...(oldAns._student_name ? { _student_name: oldAns._student_name } : {}),
        ...(oldAns._student_class ? { _student_class: oldAns._student_class } : {}),
        _tab_switches: tabSwitches
      };
      mockAttempts[index] = {
        ...mockAttempts[index],
        score,
        ...(scoring ? { raw_score: scoring.raw_score, ability_score: scoring.ability_score } : {}),
        answers_submitted: mergedAnswers,
        tab_switches: tabSwitches,
        finished_at: new Date().toISOString()
      };
      return mockAttempts[index];
    }

    // Use admin client to bypass RLS for server-side updates
    const _adminCl = adminClient();
    let oldAnswers: Record<string, any> = {};
    try {
      const { data: existing } = await _adminCl!
        .from('attempts')
        .select('answers_submitted')
        .eq('id', attemptId)
        .single();
      if (existing?.answers_submitted && typeof existing.answers_submitted === 'object') {
        oldAnswers = existing.answers_submitted as Record<string, any>;
      }
    } catch (e) {
      console.warn('[db.submitAttempt] Could not fetch existing answers_submitted:', e);
    }

    const tabSwitches = scoring?.tab_switches !== undefined ? scoring.tab_switches : (oldAnswers._tab_switches || 0);
    const mergedAnswers = {
      ...answersSubmitted,
      ...(oldAnswers._student_name ? { _student_name: oldAnswers._student_name } : {}),
      ...(oldAnswers._student_class ? { _student_class: oldAnswers._student_class } : {}),
      _tab_switches: tabSwitches
    };

    const updatePayload: Record<string, any> = {
      score,
      answers_submitted: mergedAnswers,
      finished_at: new Date().toISOString()
    };
    if (scoring?.raw_score !== undefined) updatePayload.raw_score = scoring.raw_score;
    if (scoring?.ability_score !== undefined) updatePayload.ability_score = scoring.ability_score;

    const { data, error } = await _adminCl!
      .from('attempts')
      .update(updatePayload)
      .eq('id', attemptId)
      .select()
      .single();
    if (error) throw error;
    return {
      ...data,
      tab_switches: tabSwitches
    };
  },

  async getAllAttempts(): Promise<(Attempt & { exam?: Exam, user?: User; student_name?: string; student_class?: string; tab_switches?: number })[]> {
    if (isInMockMode()) {
      return mockAttempts.map(att => {
        const u = mockUsers.find(u => u.id === att.user_id);
        const ans = (att.answers_submitted || {}) as Record<string, any>;
        return {
          ...att,
          exam: mockExams.find(e => e.id === att.exam_id),
          user: u,
          student_name: ans._student_name || u?.fullname || 'Học sinh',
          student_class: ans._student_class || '—',
          tab_switches: typeof ans._tab_switches === 'number' ? ans._tab_switches : 0
        };
      }).sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    }

    // Use admin client to bypass RLS for server-side reads
    const client = adminClient();
    const { data, error } = await client
      .from('attempts')
      .select('*, exam:exams(*, subject:subjects(*)), user:users(*)')
      .order('started_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((att: any) => {
      const ans = (att.answers_submitted || {}) as Record<string, any>;
      return {
        ...att,
        student_name: ans._student_name || att.user?.fullname || 'Học sinh',
        student_class: ans._student_class || '—',
        tab_switches: typeof ans._tab_switches === 'number' ? ans._tab_switches : 0
      };
    });
  },

  async getAttemptsByExamId(examId: string): Promise<(Attempt & { user?: User; student_name?: string; student_class?: string; tab_switches?: number })[]> {
    if (isInMockMode()) {
      return mockAttempts
        .filter(a => a.exam_id === examId && a.finished_at !== null)
        .map(att => {
          const u = mockUsers.find(u => u.id === att.user_id);
          const ans = (att.answers_submitted || {}) as Record<string, any>;
          return {
            ...att,
            user: u,
            student_name: ans._student_name || u?.fullname || 'Học sinh',
            student_class: ans._student_class || '—',
            tab_switches: typeof ans._tab_switches === 'number' ? ans._tab_switches : 0
          };
        })
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
    return (data || []).map((att: any) => {
      const ans = (att.answers_submitted || {}) as Record<string, any>;
      return {
        ...att,
        student_name: ans._student_name || att.user?.fullname || 'Học sinh',
        student_class: ans._student_class || '—',
        tab_switches: typeof ans._tab_switches === 'number' ? ans._tab_switches : 0
      };
    });
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

  /** Trả về mock user từ bộ nhớ — KHÔNG gọi Supabase.
   *  Dùng khi cookie mock-user-id chứa ID không phải UUID (vd: 'mock-user-admin')
   *  để tránh lỗi "invalid input syntax for type uuid" trong Supabase. */
  async getMockUserById(id: string): Promise<User | null> {
    return mockUsers.find(u => u.id === id) || null;
  },

  async getUserById(id: string): Promise<User | null> {
    // Tránh gọi Supabase với ID không phải UUID hợp lệ
    if (id.startsWith('mock-user-') || isInMockMode()) {
      return mockUsers.find(u => u.id === id) || null;
    }
    const client = adminClient()!;
    const { data, error } = await client.from('users').select('*').eq('id', id).single();
    if (error) {
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

  async deleteUser(id: string): Promise<boolean> {
    if (isInMockMode()) {
      const index = mockUsers.findIndex(u => u.id === id);
      if (index === -1) return false;
      mockUsers.splice(index, 1);
      return true;
    }
    const _ac = adminClient();
    if (_ac) {
      try {
        await _ac.auth.admin.deleteUser(id);
      } catch (authErr) {
        console.warn('[db.deleteUser] Supabase auth.admin.deleteUser warning:', authErr);
      }
      const { error } = await _ac.from('users').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const _anon = anonClient();
    if (!_anon) throw new Error('No Supabase client available');
    const { error } = await _anon.from('users').delete().eq('id', id);
    if (error) throw error;
    return true;
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

  // --------------------------------------------------------------------------
  // CLASSES — Quản lý lớp học
  // --------------------------------------------------------------------------
  async getClasses(teacherId?: string): Promise<Class[]> {
    if (isInMockMode()) {
      let cls = mockClasses;
      if (teacherId) cls = cls.filter(c => c.teacher_id === teacherId);
      // Attach memberCount
      return cls.map(c => ({
        ...c,
        memberCount: mockClassMembers.filter(m => m.class_id === c.id).length
      }));
    }
    const client = adminClient();
    if (!client) return [];
    let query = client.from('classes').select('*, class_members(count)').order('created_at', { ascending: false });
    if (teacherId) query = query.eq('teacher_id', teacherId);
    const { data, error } = await query;
    if (error) { console.error('[db.getClasses] error:', error); return []; }
    return (data || []).map((row: any) => ({
      ...row,
      memberCount: row.class_members?.[0]?.count ?? 0,
      class_members: undefined
    }));
  },

  async getClassById(id: string): Promise<Class | null> {
    if (isInMockMode()) {
      const cls = mockClasses.find(c => c.id === id);
      if (!cls) return null;
      return { ...cls, memberCount: mockClassMembers.filter(m => m.class_id === id).length };
    }
    const client = adminClient();
    if (!client) return null;
    const { data, error } = await client.from('classes').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async createClass(data: Omit<Class, 'id' | 'created_at' | 'memberCount'>): Promise<Class> {
    if (isInMockMode()) {
      const newCls: Class = {
        ...data,
        id: `class-${Date.now()}`,
        created_at: new Date().toISOString(),
        memberCount: 0
      };
      mockClasses.push(newCls);
      return newCls;
    }
    const client = adminClient();
    if (!client) throw new Error('[db.createClass] Admin client unavailable.');
    const { data: row, error } = await client.from('classes').insert([data]).select().single();
    if (error) { console.error('[db.createClass] error:', error); throw error; }
    return row;
  },

  async updateClass(id: string, data: Partial<Pick<Class, 'name' | 'grade' | 'subject' | 'color'>>): Promise<void> {
    if (isInMockMode()) {
      const idx = mockClasses.findIndex(c => c.id === id);
      if (idx !== -1) mockClasses[idx] = { ...mockClasses[idx], ...data };
      return;
    }
    const client = adminClient();
    if (!client) throw new Error('[db.updateClass] Admin client unavailable.');
    const { error } = await client.from('classes').update(data).eq('id', id);
    if (error) { console.error('[db.updateClass] error:', error); throw error; }
  },

  async deleteClass(id: string): Promise<void> {
    if (isInMockMode()) {
      mockClasses = mockClasses.filter(c => c.id !== id);
      mockClassMembers = mockClassMembers.filter(m => m.class_id !== id);
      mockClassAssignments = mockClassAssignments.filter(a => a.class_id !== id);
      return;
    }
    const client = adminClient();
    if (!client) throw new Error('[db.deleteClass] Admin client unavailable.');
    const { error } = await client.from('classes').delete().eq('id', id);
    if (error) { console.error('[db.deleteClass] error:', error); throw error; }
  },

  // --------------------------------------------------------------------------
  // CLASS MEMBERS
  // --------------------------------------------------------------------------
  async getClassMembers(classId: string): Promise<ClassMember[]> {
    if (isInMockMode()) {
      return mockClassMembers
        .filter(m => m.class_id === classId)
        .map(m => ({
          ...m,
          user: mockUsers.find(u => u.id === m.user_id)
            ? { ...mockUsers.find(u => u.id === m.user_id)! }
            : undefined
        }));
    }
    const client = adminClient();
    if (!client) return [];
    const { data, error } = await client
      .from('class_members')
      .select('*, user:users(id, email, fullname, avatar_url, role)')
      .eq('class_id', classId)
      .order('joined_at', { ascending: true });
    if (error) { console.error('[db.getClassMembers] error:', error); return []; }
    return (data || []) as ClassMember[];
  },

  /** Danh sách lớp mà một học sinh tham gia */
  async getStudentClasses(userId: string): Promise<Class[]> {
    if (isInMockMode()) {
      const classIds = mockClassMembers.filter(m => m.user_id === userId).map(m => m.class_id);
      return mockClasses.filter(c => classIds.includes(c.id)).map(c => ({
        ...c,
        memberCount: mockClassMembers.filter(m => m.class_id === c.id).length
      }));
    }
    const client = adminClient();
    if (!client) return [];
    const { data, error } = await client
      .from('class_members')
      .select('class_id, classes(*)')
      .eq('user_id', userId);
    if (error) { console.error('[db.getStudentClasses] error:', error); return []; }
    return ((data || []).map((row: any) => row.classes).filter(Boolean)) as Class[];
  },

  async addClassMember(classId: string, userId: string): Promise<void> {
    if (isInMockMode()) {
      const exists = mockClassMembers.some(m => m.class_id === classId && m.user_id === userId);
      if (!exists) {
        const user = mockUsers.find(u => u.id === userId);
        mockClassMembers.push({
          class_id: classId,
          user_id: userId,
          joined_at: new Date().toISOString(),
          user: user ? { id: user.id, email: user.email, fullname: user.fullname, avatar_url: user.avatar_url, role: user.role } : undefined
        });
      }
      return;
    }
    const client = adminClient();
    if (!client) throw new Error('[db.addClassMember] Admin client unavailable.');
    const { error } = await client.from('class_members').upsert([{ class_id: classId, user_id: userId }], { onConflict: 'class_id,user_id' });
    if (error) { console.error('[db.addClassMember] error:', error); throw error; }
  },

  async removeClassMember(classId: string, userId: string): Promise<void> {
    if (isInMockMode()) {
      mockClassMembers = mockClassMembers.filter(m => !(m.class_id === classId && m.user_id === userId));
      return;
    }
    const client = adminClient();
    if (!client) throw new Error('[db.removeClassMember] Admin client unavailable.');
    const { error } = await client.from('class_members').delete().eq('class_id', classId).eq('user_id', userId);
    if (error) { console.error('[db.removeClassMember] error:', error); throw error; }
  },

  /**
   * Import học sinh từ CSV. Mỗi row: { email, fullname? }
   * Trả về { added, skipped } — skipped chứa email chưa đăng ký.
   */
  async importClassMembersCSV(classId: string, rows: { email: string }[]): Promise<{ added: number; skipped: string[] }> {
    const skipped: string[] = [];
    let added = 0;
    for (const row of rows) {
      if (!row.email) continue;
      const email = row.email.trim().toLowerCase();
      if (isInMockMode()) {
        const user = mockUsers.find(u => u.email.toLowerCase() === email);
        if (!user) { skipped.push(email); continue; }
        const exists = mockClassMembers.some(m => m.class_id === classId && m.user_id === user.id);
        if (!exists) {
          mockClassMembers.push({
            class_id: classId,
            user_id: user.id,
            joined_at: new Date().toISOString(),
            user: { id: user.id, email: user.email, fullname: user.fullname, avatar_url: user.avatar_url, role: user.role }
          });
        }
        added++;
      } else {
        const client = adminClient();
        if (!client) { skipped.push(email); continue; }
        const { data: userRow } = await client.from('users').select('id').eq('email', email).single();
        if (!userRow) { skipped.push(email); continue; }
        await client.from('class_members').upsert([{ class_id: classId, user_id: userRow.id }], { onConflict: 'class_id,user_id' });
        added++;
      }
    }
    return { added, skipped };
  },

  // --------------------------------------------------------------------------
  // CLASS ASSIGNMENTS — Bài tập được giao
  // --------------------------------------------------------------------------
  async getClassAssignments(classId: string): Promise<ClassAssignment[]> {
    if (isInMockMode()) {
      return mockClassAssignments.filter(a => a.class_id === classId)
        .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());
    }
    const client = adminClient();
    if (!client) return [];
    const { data, error } = await client
      .from('class_assignments')
      .select('*')
      .eq('class_id', classId)
      .order('assigned_at', { ascending: false });
    if (error) { console.error('[db.getClassAssignments] error:', error); return []; }
    return (data || []) as ClassAssignment[];
  },

  /** Tất cả bài được giao cho một học sinh qua các lớp của họ */
  async getStudentAssignments(userId: string): Promise<ClassAssignment[]> {
    if (isInMockMode()) {
      const classIds = mockClassMembers.filter(m => m.user_id === userId).map(m => m.class_id);
      return mockClassAssignments
        .filter(a => classIds.includes(a.class_id))
        .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());
    }
    const client = adminClient();
    if (!client) return [];
    // Get classes for this student
    const { data: memberRows } = await client.from('class_members').select('class_id').eq('user_id', userId);
    const classIds = (memberRows || []).map((r: any) => r.class_id);
    if (!classIds.length) return [];
    const { data, error } = await client
      .from('class_assignments')
      .select('*')
      .in('class_id', classIds)
      .order('assigned_at', { ascending: false });
    if (error) { console.error('[db.getStudentAssignments] error:', error); return []; }
    return (data || []) as ClassAssignment[];
  },

  async getAssignmentById(id: string): Promise<ClassAssignment | null> {
    if (isInMockMode()) {
      return mockClassAssignments.find(a => a.id === id) || null;
    }
    const client = adminClient();
    if (!client) return null;
    const { data, error } = await client.from('class_assignments').select('*').eq('id', id).maybeSingle();
    if (error) { console.error('[db.getAssignmentById] error:', error); return null; }
    return data as ClassAssignment | null;
  },

  async createAssignment(data: Omit<ClassAssignment, 'id' | 'assigned_at'>): Promise<ClassAssignment> {
    if (isInMockMode()) {
      const newA: ClassAssignment = {
        ...data,
        id: `assign-${Date.now()}`,
        assigned_at: new Date().toISOString()
      };
      mockClassAssignments.push(newA);
      return newA;
    }
    const client = adminClient();
    if (!client) throw new Error('[db.createAssignment] Admin client unavailable.');
    const { data: row, error } = await client.from('class_assignments').insert([data]).select().single();
    if (error) { console.error('[db.createAssignment] error:', error); throw error; }
    return row as ClassAssignment;
  },

  async deleteAssignment(id: string): Promise<void> {
    if (isInMockMode()) {
      mockClassAssignments = mockClassAssignments.filter(a => a.id !== id);
      mockAssignmentViews = mockAssignmentViews.filter(v => v.assignment_id !== id);
      return;
    }
    const client = adminClient();
    if (!client) throw new Error('[db.deleteAssignment] Admin client unavailable.');
    const { error } = await client.from('class_assignments').delete().eq('id', id);
    if (error) { console.error('[db.deleteAssignment] error:', error); throw error; }
  },

  // --------------------------------------------------------------------------
  // ASSIGNMENT VIEWS — Lượt xem tài liệu & YouTube của học sinh
  // --------------------------------------------------------------------------
  async recordAssignmentView(assignmentId: string, userId: string, viewType: 'document' | 'youtube'): Promise<ClassAssignmentView> {
    if (isInMockMode()) {
      let record = mockAssignmentViews.find(v => v.assignment_id === assignmentId && v.user_id === userId);
      const now = new Date().toISOString();
      if (record) {
        if (viewType === 'document') record.document_views += 1;
        if (viewType === 'youtube') record.youtube_views += 1;
        record.last_viewed_at = now;
      } else {
        record = {
          id: `view-${Date.now()}`,
          assignment_id: assignmentId,
          user_id: userId,
          document_views: viewType === 'document' ? 1 : 0,
          youtube_views: viewType === 'youtube' ? 1 : 0,
          last_viewed_at: now,
          created_at: now
        };
        mockAssignmentViews.push(record);
      }
      return record;
    }
    const client = adminClient();
    if (!client) throw new Error('[db.recordAssignmentView] Admin client unavailable.');

    const { data: existing } = await client
      .from('class_assignment_views')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('user_id', userId)
      .maybeSingle();

    const now = new Date().toISOString();
    if (existing) {
      const updates = {
        last_viewed_at: now,
        document_views: viewType === 'document' ? (existing.document_views || 0) + 1 : existing.document_views,
        youtube_views: viewType === 'youtube' ? (existing.youtube_views || 0) + 1 : existing.youtube_views,
      };
      const { data: updated, error } = await client
        .from('class_assignment_views')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) { console.error('[db.recordAssignmentView] update error:', error); throw error; }
      return updated as ClassAssignmentView;
    } else {
      const insertData = {
        assignment_id: assignmentId,
        user_id: userId,
        document_views: viewType === 'document' ? 1 : 0,
        youtube_views: viewType === 'youtube' ? 1 : 0,
        last_viewed_at: now,
      };
      const { data: inserted, error } = await client
        .from('class_assignment_views')
        .insert([insertData])
        .select()
        .single();
      if (error) { console.error('[db.recordAssignmentView] insert error:', error); throw error; }
      return inserted as ClassAssignmentView;
    }
  },

  async getAssignmentViews(assignmentId: string): Promise<ClassAssignmentView[]> {
    if (isInMockMode()) {
      return mockAssignmentViews.filter(v => v.assignment_id === assignmentId);
    }
    const client = adminClient();
    if (!client) return [];
    const { data, error } = await client
      .from('class_assignment_views')
      .select('*')
      .eq('assignment_id', assignmentId);
    if (error) { console.error('[db.getAssignmentViews] error:', error); return []; }
    return (data || []) as ClassAssignmentView[];
  },

  async getClassAssignmentViews(classId: string): Promise<ClassAssignmentView[]> {
    if (isInMockMode()) {
      const assignments = mockClassAssignments.filter(a => a.class_id === classId);
      const assignIds = assignments.map(a => a.id);
      return mockAssignmentViews.filter(v => assignIds.includes(v.assignment_id));
    }
    const client = adminClient();
    if (!client) return [];
    const { data: assignments } = await client
      .from('class_assignments')
      .select('id')
      .eq('class_id', classId);
    if (!assignments || !assignments.length) return [];
    const assignIds = assignments.map((a: any) => a.id);
    const { data, error } = await client
      .from('class_assignment_views')
      .select('*')
      .in('assignment_id', assignIds);
    if (error) { console.error('[db.getClassAssignmentViews] error:', error); return []; }
    return (data || []) as ClassAssignmentView[];
  },

  // --------------------------------------------------------------------------
  // DIỄN ĐÀN HỌC SINH (/hoc-sinh)
  // --------------------------------------------------------------------------
  async getForumCategories(): Promise<(ForumCategory & { thread_count: number })[]> {
    if (isInMockMode()) {
      return mockForumCategories.map(c => ({
        ...c,
        thread_count: mockForumThreads.filter(t => t.category_id === c.id).length,
      }));
    }
    const client = adminClient();
    if (!client) return [];
    const { data, error } = await client
      .from('forum_categories').select('*').order('order_index');
    if (error) {
      forumWarn('getForumCategories', error);
      if (forumDevFallback()) {
        return mockForumCategories.map(c => ({
          ...c,
          thread_count: mockForumThreads.filter(t => t.category_id === c.id).length,
        }));
      }
      return [];
    }
    const categories = (data || []) as ForumCategory[];
    const { data: threads } = await client.from('forum_threads').select('category_id');
    const counts = new Map<string, number>();
    (threads || []).forEach((t: any) => counts.set(t.category_id, (counts.get(t.category_id) || 0) + 1));
    return categories.map(c => ({ ...c, thread_count: counts.get(c.id) || 0 }));
  },

  async getForumCategoryBySlug(slug: string): Promise<ForumCategory | null> {
    const categories = await this.getForumCategories();
    return categories.find(c => c.slug === slug) || null;
  },

  async createForumCategory(data: {
    name: string; slug: string; description?: string; icon?: string;
    subject_id?: string | null; parent_id?: string | null; order_index?: number; is_active?: boolean;
  }): Promise<ForumCategory> {
    const now = new Date().toISOString();
    const newCat: ForumCategory = {
      id: `forum-cat-${Date.now()}`,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      icon: data.icon ?? null,
      subject_id: data.subject_id ?? null,
      parent_id: data.parent_id ?? null,
      order_index: data.order_index ?? mockForumCategories.length,
      is_active: data.is_active ?? true,
      created_at: now,
    };
    if (isInMockMode()) {
      mockForumCategories.push(newCat);
      return newCat;
    }
    const client = adminClient();
    if (!client) { mockForumCategories.push(newCat); return newCat; }
    const { data: row, error } = await client.from('forum_categories').insert({
      name: data.name, slug: data.slug, description: data.description ?? null,
      icon: data.icon ?? null, subject_id: data.subject_id ?? null,
      parent_id: data.parent_id ?? null,
      order_index: data.order_index ?? 0,
      is_active: data.is_active ?? true,
    }).select().single();
    if (error) throw new Error(error.message);
    return row as ForumCategory;
  },

  async updateForumCategory(id: string, data: Partial<{
    name: string; slug: string; description: string | null; icon: string | null;
    subject_id: string | null; parent_id: string | null; order_index: number; is_active: boolean;
  }>): Promise<ForumCategory> {
    if (isInMockMode()) {
      const idx = mockForumCategories.findIndex(c => c.id === id);
      if (idx === -1) throw new Error('Không tìm thấy chuyên mục.');
      mockForumCategories[idx] = { ...mockForumCategories[idx], ...data };
      return mockForumCategories[idx];
    }
    const client = adminClient();
    if (!client) throw new Error('Không có kết nối DB.');
    const { data: row, error } = await client.from('forum_categories').update(data).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return row as ForumCategory;
  },

  async deleteForumCategory(id: string): Promise<void> {
    if (isInMockMode()) {
      const idx = mockForumCategories.findIndex(c => c.id === id);
      if (idx !== -1) mockForumCategories.splice(idx, 1);
      return;
    }
    const client = adminClient();
    if (!client) throw new Error('Không có kết nối DB.');
    const { error } = await client.from('forum_categories').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getForumThreads(query: ForumThreadQuery = {}): Promise<ForumThread[]> {
    const {
      categoryId, categorySlug, status = 'all', tag, search,
      sort = 'latest', limit = 30, offset = 0,
    } = query;

    let threads: ForumThread[] = [];
    let categories: ForumCategory[] = [];
    let authors: Map<string, ForumAuthor> = new Map();

    if (isInMockMode()) {
      threads = mockForumThreads;
      categories = mockForumCategories;
      authors = mockForumAuthorMap();
    } else {
      const client = adminClient();
      if (!client) return [];
      const [threadsRes, categoriesRes, usersRes] = await Promise.all([
        client.from('forum_threads').select('*').order('created_at', { ascending: false }),
        client.from('forum_categories').select('*'),
        client.from('users').select('id, fullname, avatar_url, role'),
      ]);
      if (threadsRes.error) {
        forumWarn('getForumThreads', threadsRes.error);
        if (!forumDevFallback()) return [];
        threads = mockForumThreads;
        categories = mockForumCategories;
        authors = mockForumAuthorMap();
      } else {
        threads = (threadsRes.data || []) as ForumThread[];
        categories = (categoriesRes.data || []) as ForumCategory[];
        authors = forumAuthorMap((usersRes.data || []) as User[]);
      }
    }

    let category = categoryId;
    if (!category && categorySlug) {
      category = categories.find(c => c.slug === categorySlug)?.id;
    }

    const keyword = (search || '').trim().toLowerCase();
    const filtered = threads
      .filter(t => !category || t.category_id === category)
      .filter(t => status === 'all' || t.status === status)
      .filter(t => !tag || (t.tags || []).some(x => x.toLowerCase() === tag.toLowerCase()))
      .filter(t => !keyword ||
        t.title.toLowerCase().includes(keyword) ||
        t.body.toLowerCase().includes(keyword) ||
        (t.tags || []).some(x => x.toLowerCase().includes(keyword)))
      .map(t => decorateForumThread(t, categories, authors));

    return sortForumThreads(filtered, sort).slice(offset, offset + limit);
  },

  async getForumThreadById(id: string): Promise<ForumThread | null> {
    if (isInMockMode()) {
      const thread = mockForumThreads.find(t => t.id === id);
      if (!thread) return null;
      const authors = mockForumAuthorMap();
      const posts = mockForumPosts
        .filter(p => p.thread_id === id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map(p => decorateForumPost(p, authors));
      return {
        ...thread,
        category: mockForumCategories.find(c => c.id === thread.category_id) || null,
        author: thread.is_anonymous ? null : (authors.get(thread.author_id) || null),
        posts,
      };
    }
    const client = adminClient();
    if (!client) return null;
    const [threadRes, categoriesRes, usersRes] = await Promise.all([
      client.from('forum_threads').select('*').eq('id', id).maybeSingle(),
      client.from('forum_categories').select('*'),
      client.from('users').select('id, fullname, avatar_url, role'),
    ]);
    if (threadRes.error || !threadRes.data) {
      if (threadRes.error) forumWarn('getForumThreadById', threadRes.error);
      if (forumDevFallback()) {
        const mock = mockForumThreads.find(t => t.id === id);
        if (!mock) return null;
        const posts = mockForumPosts.filter(p => p.thread_id === id).map(p => decorateForumPost(p, mockForumAuthorMap()));
        return { ...mock, category: mockForumCategories.find(c => c.id === mock.category_id) || null, posts };
      }
      return null;
    }
    const authors = forumAuthorMap((usersRes.data || []) as User[]);
    const thread = decorateForumThread(threadRes.data as ForumThread, (categoriesRes.data || []) as ForumCategory[], authors);
    const { data: posts } = await client
      .from('forum_posts').select('*').eq('thread_id', id).is('deleted_at', null).order('created_at');
    return {
      ...thread,
      posts: ((posts || []) as ForumPost[]).map(p => decorateForumPost(p, authors)),
    };
  },

  async getForumThreadBySlug(slug: string): Promise<ForumThread | null> {
    if (isInMockMode()) {
      const thread = mockForumThreads.find(t => t.slug === slug);
      return thread ? this.getForumThreadById(thread.id) : null;
    }
    const client = adminClient();
    if (!client) return null;
    const { data } = await client.from('forum_threads').select('id').eq('slug', slug).maybeSingle();
    if (data?.id) return this.getForumThreadById(data.id);
    if (forumDevFallback()) {
      const mock = mockForumThreads.find(t => t.slug === slug);
      return mock ? this.getForumThreadById(mock.id) : null;
    }
    return null;
  },

  async createForumThread(input: {
    categoryId: string;
    authorId: string;
    title: string;
    body: string;
    tags?: string[];
    isAnonymous?: boolean;
    /** Phase 4 — vector 768 chiều dạng pgvector literal, do /api/forum/embed tạo. */
    embedding?: string | null;
    summary?: string | null;
  }): Promise<ForumThread> {
    const payload = {
      category_id: input.categoryId,
      author_id: input.authorId,
      title: input.title.trim(),
      slug: generateForumSlug(input.title),
      body: input.body.trim(),
      tags: input.tags || [],
      is_anonymous: !!input.isAnonymous,
      ...(input.summary ? { summary: input.summary } : {}),
      ...(input.embedding ? { embedding: input.embedding } : {}),
    };

    const makeMockThread = (): ForumThread => {
      const now = new Date().toISOString();
      const thread: ForumThread = {
        id: `forum-thread-${Date.now()}`,
        ...payload,
        status: 'open', is_pinned: false, views_count: 0, reply_count: 0,
        last_activity_at: now, accepted_post_id: null, created_at: now, updated_at: now,
      };
      mockForumThreads.unshift(thread);
      return { ...thread, category: mockForumCategories.find(c => c.id === thread.category_id) || null };
    };

    if (isInMockMode()) return makeMockThread();

    const client = adminClient();
    if (!client) throw new Error('[db.createForumThread] Admin client unavailable.');
    const { data, error } = await client.from('forum_threads').insert([payload]).select().single();
    if (error) {
      forumWarn('createForumThread', error);
      if (forumDevFallback()) return makeMockThread();
      throw error;
    }
    return this.getForumThreadById(data.id) as Promise<ForumThread>;
  },

  async createForumPost(input: {
    threadId: string;
    authorId: string;
    body: string;
    parentId?: string | null;
    isAnswer?: boolean;
  }): Promise<ForumPost> {
    const payload = {
      thread_id: input.threadId,
      author_id: input.authorId,
      parent_id: input.parentId || null,
      body: input.body.trim(),
      is_answer: !!input.isAnswer,
    };

    const makeMockPost = (): ForumPost => {
      const now = new Date().toISOString();
      const post: ForumPost = { id: `forum-post-${Date.now()}`, ...payload, created_at: now, updated_at: now };
      mockForumPosts.push(post);
      const thread = mockForumThreads.find(t => t.id === input.threadId);
      if (thread) {
        thread.reply_count += 1;
        thread.last_activity_at = now;
        forumNotifyMock(thread, post.id, input.authorId, input.body);
      }
      return decorateForumPost(post, mockForumAuthorMap());
    };

    if (isInMockMode()) return makeMockPost();

    const client = adminClient();
    if (!client) throw new Error('[db.createForumPost] Admin client unavailable.');
    const { data, error } = await client.from('forum_posts').insert([payload]).select().single();
    if (error) {
      forumWarn('createForumPost', error);
      if (forumDevFallback()) return makeMockPost();
      throw error;
    }

    // Thông báo follower + @mention + chủ thread trong 1 RPC (best-effort).
    const { error: notifyError } = await client.rpc('forum_notify_new_post', {
      p_thread_id: input.threadId,
      p_post_id: data.id,
      p_author_id: input.authorId,
      p_body: input.body,
    });
    if (notifyError) {
      forumWarn('forum_notify_new_post', notifyError);
      // Fallback tối thiểu nếu RPC chưa được apply: báo cho chủ thread.
      const thread = await this.getForumThreadById(input.threadId);
      if (thread && thread.author_id !== input.authorId) {
        await client.from('forum_notifications').insert([{
          user_id: thread.author_id,
          type: 'reply',
          payload: { thread_id: thread.id, thread_title: thread.title, post_id: data.id },
        }]);
      }
    }
    const author = await this.getUserById(input.authorId);
    return decorateForumPost(data as ForumPost, author ? forumAuthorMap([author]) : new Map());
  },

  async acceptForumPost(threadId: string, postId: string): Promise<ForumThread | null> {
    const acceptInMock = async (): Promise<ForumThread | null> => {
      const thread = mockForumThreads.find(t => t.id === threadId);
      if (!thread) return null;
      mockForumPosts.forEach(p => { p.is_answer = p.id === postId && p.thread_id === threadId; });
      thread.accepted_post_id = postId;
      thread.status = 'solved';
      const answerAuthor = mockForumPosts.find(p => p.id === postId)?.author_id;
      if (answerAuthor && answerAuthor !== thread.author_id) {
        mockForumNotifications.unshift({
          id: `forum-notif-${Date.now()}`, user_id: answerAuthor, type: 'answer',
          payload: { thread_id: thread.id, thread_title: thread.title, post_id: postId },
          read_at: null, created_at: new Date().toISOString(),
        });
      }
      return this.getForumThreadById(threadId);
    };

    if (isInMockMode()) return acceptInMock();

    const client = adminClient();
    if (!client) throw new Error('[db.acceptForumPost] Admin client unavailable.');
    const { error } = await client.rpc('forum_accept_answer', { p_thread_id: threadId, p_post_id: postId });
    if (error) {
      forumWarn('acceptForumPost', error);
      if (forumDevFallback()) return acceptInMock();
      throw error;
    }
    // Báo cho người viết câu trả lời được chọn (best-effort).
    const { data: post } = await client.from('forum_posts').select('author_id').eq('id', postId).maybeSingle();
    if (post?.author_id) {
      const { data: threadInfo } = await client.from('forum_threads').select('author_id, title').eq('id', threadId).maybeSingle();
      if (threadInfo && threadInfo.author_id !== post.author_id) {
        await client.from('forum_notifications').insert([{
          user_id: post.author_id, type: 'answer',
          payload: { thread_id: threadId, thread_title: threadInfo.title, post_id: postId },
        }]);
      }
    }
    return this.getForumThreadById(threadId);
  },

  async incrementForumThreadViews(threadId: string): Promise<void> {
    if (isInMockMode()) {
      const thread = mockForumThreads.find(t => t.id === threadId);
      if (thread) thread.views_count += 1;
      return;
    }
    const client = adminClient();
    if (!client) return;
    const { error } = await client.rpc('forum_increment_views', { p_thread_id: threadId });
    if (error) {
      forumWarn('incrementForumThreadViews', error);
      if (forumDevFallback()) {
        const thread = mockForumThreads.find(t => t.id === threadId);
        if (thread) thread.views_count += 1;
      }
    }
  },

  async getForumStats(): Promise<ForumStats> {
    const mockStats = (): ForumStats => ({
      threads: mockForumThreads.length,
      replies: mockForumPosts.length,
      members: mockUsers.length * 137,
      solved: mockForumThreads.filter(t => t.status === 'solved').length,
    });

    if (isInMockMode()) return mockStats();

    const client = adminClient();
    if (!client) return { threads: 0, replies: 0, members: 0, solved: 0 };
    const [threadsRes, postsRes, usersRes, solvedRes] = await Promise.all([
      client.from('forum_threads').select('id', { count: 'exact', head: true }),
      client.from('forum_posts').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      client.from('users').select('id', { count: 'exact', head: true }),
      client.from('forum_threads').select('id', { count: 'exact', head: true }).eq('status', 'solved'),
    ]);
    if (threadsRes.error) {
      forumWarn('getForumStats', threadsRes.error);
      if (forumDevFallback()) return mockStats();
    }
    return {
      threads: threadsRes.count || 0,
      replies: postsRes.count || 0,
      members: usersRes.count || 0,
      solved: solvedRes.count || 0,
    };
  },

  // --------------------------------------------------------------------------
  // PHASE 2 — TƯƠNG TÁC (reaction / bookmark / follow / notification)
  // --------------------------------------------------------------------------
  async getForumInteractions(userId: string): Promise<ForumInteractionState> {
    const empty: ForumInteractionState = { reactions: {}, bookmarks: [], follows: [] };
    if (!userId) return empty;

    if (isInMockMode()) {
      const reactions: Record<string, ForumReactionKind> = {};
      mockForumReactions.filter(r => r.user_id === userId).forEach(r => { reactions[r.post_id] = r.kind; });
      return {
        reactions,
        bookmarks: mockForumBookmarks.filter(b => b.user_id === userId).map(b => b.thread_id),
        follows: mockForumFollows.filter(f => f.user_id === userId).map(f => f.thread_id),
      };
    }

    const client = adminClient();
    if (!client) return empty;
    const [reactionsRes, bookmarksRes, followsRes] = await Promise.all([
      client.from('forum_reactions').select('post_id, kind').eq('user_id', userId),
      client.from('forum_bookmarks').select('thread_id').eq('user_id', userId),
      client.from('forum_follows').select('thread_id').eq('user_id', userId),
    ]);
    if (reactionsRes.error && forumDevFallback()) {
      forumWarn('getForumInteractions', reactionsRes.error);
      const reactions: Record<string, ForumReactionKind> = {};
      mockForumReactions.filter(r => r.user_id === userId).forEach(r => { reactions[r.post_id] = r.kind; });
      return {
        reactions,
        bookmarks: mockForumBookmarks.filter(b => b.user_id === userId).map(b => b.thread_id),
        follows: mockForumFollows.filter(f => f.user_id === userId).map(f => f.thread_id),
      };
    }
    const reactions: Record<string, ForumReactionKind> = {};
    ((reactionsRes.data || []) as Array<{ post_id: string; kind: ForumReactionKind }>)
      .forEach(r => { reactions[r.post_id] = r.kind; });
    return {
      reactions,
      bookmarks: ((bookmarksRes.data || []) as Array<{ thread_id: string }>).map(b => b.thread_id),
      follows: ((followsRes.data || []) as Array<{ thread_id: string }>).map(f => f.thread_id),
    };
  },

  async getForumThreadReactions(threadId: string): Promise<ForumReaction[]> {
    if (isInMockMode()) {
      const postIds = new Set(mockForumPosts.filter(p => p.thread_id === threadId).map(p => p.id));
      return mockForumReactions.filter(r => postIds.has(r.post_id));
    }
    const client = adminClient();
    if (!client) return [];
    const { data, error } = await client
      .from('forum_reactions')
      .select('post_id, user_id, kind, created_at, forum_posts!inner(thread_id)')
      .eq('forum_posts.thread_id', threadId);
    if (error) {
      forumWarn('getForumThreadReactions', error);
      if (forumDevFallback()) {
        const postIds = new Set(mockForumPosts.filter(p => p.thread_id === threadId).map(p => p.id));
        return mockForumReactions.filter(r => postIds.has(r.post_id));
      }
      return [];
    }
    return (data || []).map((r: any) => ({
      post_id: r.post_id, user_id: r.user_id, kind: r.kind, created_at: r.created_at,
    })) as ForumReaction[];
  },

  /** Trang chi tiết dùng: posts đã có số lượng cảm xúc + lựa chọn của người xem. */
  async getDecoratedForumPosts(threadId: string, viewerId: string | null): Promise<ForumPost[]> {
    const thread = await this.getForumThreadById(threadId);
    const reactions = await this.getForumThreadReactions(threadId);
    return decorateForumPostsWithReactions(thread?.posts || [], reactions, viewerId);
  },

  async toggleForumReaction(input: {
    postId: string;
    userId: string;
    kind: ForumReactionKind;
  }): Promise<{ active: boolean; kind: ForumReactionKind | null; counts: Record<ForumReactionKind, number> }> {
    const { postId, userId, kind } = input;
    const currentCount = () => forumReactionCounts(mockForumReactions.filter(r => r.post_id === postId));

    if (isInMockMode()) {
      const existing = mockForumReactions.find(r => r.post_id === postId && r.user_id === userId);
      if (existing?.kind === kind) {
        mockForumReactions = mockForumReactions.filter(r => r !== existing);
        return { active: false, kind: null, counts: currentCount() };
      }
      if (existing) existing.kind = kind;
      else mockForumReactions.push({ post_id: postId, user_id: userId, kind, created_at: new Date().toISOString() });
      return { active: true, kind, counts: currentCount() };
    }

    const client = adminClient();
    if (!client) throw new Error('[db.toggleForumReaction] Admin client unavailable.');
    const { data: existing } = await client
      .from('forum_reactions').select('kind').eq('post_id', postId).eq('user_id', userId).maybeSingle();
    if ((existing as { kind?: ForumReactionKind } | null)?.kind === kind) {
      await client.from('forum_reactions').delete().eq('post_id', postId).eq('user_id', userId);
    } else {
      await client.from('forum_reactions').upsert(
        { post_id: postId, user_id: userId, kind, created_at: new Date().toISOString() },
        { onConflict: 'post_id,user_id' },
      );
    }
    const { data } = await client.from('forum_reactions').select('user_id, kind').eq('post_id', postId);
    const mine = (data || []).find((r: any) => r.user_id === userId)?.kind as ForumReactionKind | undefined;
    return {
      active: !!mine,
      kind: mine || null,
      counts: forumReactionCounts((data || []).map((r: any) => ({ post_id: postId, user_id: r.user_id, kind: r.kind }))),
    };
  },

  async toggleForumBookmark(threadId: string, userId: string): Promise<boolean> {
    if (isInMockMode()) {
      const index = mockForumBookmarks.findIndex(b => b.thread_id === threadId && b.user_id === userId);
      if (index >= 0) { mockForumBookmarks.splice(index, 1); return false; }
      mockForumBookmarks.push({ thread_id: threadId, user_id: userId, created_at: new Date().toISOString() });
      return true;
    }
    const client = adminClient();
    if (!client) throw new Error('[db.toggleForumBookmark] Admin client unavailable.');
    const { data: existing } = await client
      .from('forum_bookmarks').select('thread_id').eq('thread_id', threadId).eq('user_id', userId).maybeSingle();
    if (existing) {
      await client.from('forum_bookmarks').delete().eq('thread_id', threadId).eq('user_id', userId);
      return false;
    }
    await client.from('forum_bookmarks').insert([{ thread_id: threadId, user_id: userId }]);
    return true;
  },

  async toggleForumFollow(threadId: string, userId: string): Promise<boolean> {
    if (isInMockMode()) {
      const index = mockForumFollows.findIndex(f => f.thread_id === threadId && f.user_id === userId);
      if (index >= 0) { mockForumFollows.splice(index, 1); return false; }
      mockForumFollows.push({ thread_id: threadId, user_id: userId, created_at: new Date().toISOString() });
      return true;
    }
    const client = adminClient();
    if (!client) throw new Error('[db.toggleForumFollow] Admin client unavailable.');
    const { data: existing } = await client
      .from('forum_follows').select('thread_id').eq('thread_id', threadId).eq('user_id', userId).maybeSingle();
    if (existing) {
      await client.from('forum_follows').delete().eq('thread_id', threadId).eq('user_id', userId);
      return false;
    }
    await client.from('forum_follows').insert([{ thread_id: threadId, user_id: userId }]);
    return true;
  },

  async getBookmarkedForumThreads(userId: string): Promise<ForumThread[]> {
    const state = await this.getForumInteractions(userId);
    if (!state.bookmarks.length) return [];
    const all = await this.getForumThreads({ limit: 1000 });
    return all.filter(t => state.bookmarks.includes(t.id));
  },

  async getFollowedForumThreads(userId: string): Promise<ForumThread[]> {
    const state = await this.getForumInteractions(userId);
    if (!state.follows.length) return [];
    const all = await this.getForumThreads({ limit: 1000 });
    return all.filter(t => state.follows.includes(t.id));
  },

  /** Phân trang cho danh sách thread (dùng chung bộ lọc với getForumThreads). */
  async getForumThreadPage(query: ForumThreadQuery = {}, page = 1, pageSize = 20): Promise<ForumThreadPage> {
    const safePage = Math.max(1, Math.floor(page));
    const safeSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const all = await this.getForumThreads({ ...query, limit: 10000, offset: 0 });
    return {
      threads: all.slice((safePage - 1) * safeSize, safePage * safeSize),
      total: all.length,
      page: safePage,
      pageSize: safeSize,
    };
  },

  async getForumNotifications(userId: string, unreadOnly = false, limit = 20): Promise<ForumNotification[]> {
    if (isInMockMode()) {
      return mockForumNotifications
        .filter(n => n.user_id === userId && (!unreadOnly || !n.read_at))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit);
    }
    const client = adminClient();
    if (!client) return [];
    let q = client.from('forum_notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    if (unreadOnly) q = q.is('read_at', null);
    const { data, error } = await q;
    if (error) {
      forumWarn('getForumNotifications', error);
      if (forumDevFallback()) {
        return mockForumNotifications
          .filter(n => n.user_id === userId && (!unreadOnly || !n.read_at))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, limit);
      }
      return [];
    }
    return (data || []) as ForumNotification[];
  },

  async getUnreadForumNotificationCount(userId: string): Promise<number> {
    if (!userId) return 0;
    if (isInMockMode()) return mockForumNotifications.filter(n => n.user_id === userId && !n.read_at).length;
    const client = adminClient();
    if (!client) return 0;
    const { count, error } = await client
      .from('forum_notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).is('read_at', null);
    if (error) { forumWarn('getUnreadForumNotificationCount', error); return 0; }
    return count || 0;
  },

  async markForumNotificationRead(notificationId: string, userId: string): Promise<void> {
    if (isInMockMode()) {
      const item = mockForumNotifications.find(n => n.id === notificationId && n.user_id === userId);
      if (item) item.read_at = new Date().toISOString();
      return;
    }
    const client = adminClient();
    if (!client) return;
    await client.from('forum_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId).eq('user_id', userId);
  },

  async markAllForumNotificationsRead(userId: string): Promise<void> {
    if (isInMockMode()) {
      mockForumNotifications.filter(n => n.user_id === userId && !n.read_at)
        .forEach(n => { n.read_at = new Date().toISOString(); });
      return;
    }
    const client = adminClient();
    if (!client) return;
    await client.from('forum_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId).is('read_at', null);
  },

  // --------------------------------------------------------------------------
  // PHASE 3 — VẬN HÀNH (báo cáo, kiểm duyệt, analytics)
  // --------------------------------------------------------------------------
  async createForumReport(input: {
    threadId?: string | null;
    postId?: string | null;
    reporterId: string;
    reason: ForumReportReason;
    details?: string;
  }): Promise<ForumReport> {
    const payload = {
      thread_id: input.threadId || null,
      post_id: input.postId || null,
      reporter_id: input.reporterId,
      reason: input.reason,
      details: (input.details || '').slice(0, 1000) || null,
      status: 'open' as ForumReportStatus,
    };
    if (isInMockMode()) {
      const report: ForumReport = {
        ...payload, id: `forum-report-${Date.now()}`,
        resolved_by: null, resolved_at: null, created_at: new Date().toISOString(),
      };
      mockForumReports.unshift(report);
      return report;
    }
    const client = adminClient();
    if (!client) throw new Error('[db.createForumReport] Admin client unavailable.');
    const { data, error } = await client.from('forum_reports').insert([payload]).select().single();
    if (error) {
      forumWarn('createForumReport', error);
      if (forumDevFallback()) {
        const report: ForumReport = {
          ...payload, id: `forum-report-${Date.now()}`,
          resolved_by: null, resolved_at: null, created_at: new Date().toISOString(),
        };
        mockForumReports.unshift(report);
        return report;
      }
      throw error;
    }
    return data as ForumReport;
  },

  async getForumReports(status: ForumReportStatus | 'all' = 'open'): Promise<ForumReport[]> {
    if (isInMockMode()) {
      return mockForumReports
        .filter(r => status === 'all' || r.status === status)
        .map(r => ({
          ...r,
          thread: mockForumThreads.find(t => t.id === r.thread_id) || null,
          reporter: mockForumAuthorMap().get(r.reporter_id) || null,
        }));
    }
    const client = adminClient();
    if (!client) return [];
    let q = client.from('forum_reports').select('*').order('created_at', { ascending: false }).limit(100);
    if (status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) {
      forumWarn('getForumReports', error);
      if (forumDevFallback()) {
        return mockForumReports
          .filter(r => status === 'all' || r.status === status)
          .map(r => ({
            ...r,
            thread: mockForumThreads.find(t => t.id === r.thread_id) || null,
            reporter: mockForumAuthorMap().get(r.reporter_id) || null,
          }));
      }
      return [];
    }
    const reports = (data || []) as ForumReport[];
    const [threadsRes, usersRes] = await Promise.all([
      client.from('forum_threads').select('*'),
      client.from('users').select('id, fullname, avatar_url, role'),
    ]);
    const threads = (threadsRes.data || []) as ForumThread[];
    const authors = forumAuthorMap((usersRes.data || []) as User[]);
    const categories = (await client.from('forum_categories').select('*')).data as ForumCategory[] || [];
    return reports.map(r => ({
      ...r,
      thread: decorateForumThread(threads.find(t => t.id === r.thread_id) || {} as ForumThread, categories, authors),
      reporter: authors.get(r.reporter_id) || null,
    }));
  },

  async resolveForumReport(id: string, status: 'resolved' | 'dismissed', resolvedBy: string): Promise<void> {
    // Báo cáo tạo bằng fallback DEV nằm trong mock array, không có row trên Supabase.
    if (id.startsWith('forum-report-')) {
      const report = mockForumReports.find(r => r.id === id);
      if (report) {
        report.status = status;
        report.resolved_by = resolvedBy;
        report.resolved_at = new Date().toISOString();
      }
      return;
    }
    if (isInMockMode()) {
      const report = mockForumReports.find(r => r.id === id);
      if (report) {
        report.status = status;
        report.resolved_by = resolvedBy;
        report.resolved_at = new Date().toISOString();
      }
      return;
    }
    const client = adminClient();
    if (!client) return;
    await client.from('forum_reports').update({
      status, resolved_by: resolvedBy, resolved_at: new Date().toISOString(),
    }).eq('id', id);
  },

  async moderateForumThread(
    threadId: string,
    action: 'pin' | 'unpin' | 'lock' | 'unlock' | 'archive',
  ): Promise<ForumThread | null> {
    const patch: Partial<ForumThread> = action === 'pin' ? { is_pinned: true }
      : action === 'unpin' ? { is_pinned: false }
      : action === 'lock' ? { status: 'locked' }
      : action === 'unlock' ? { status: 'open' }
      : { status: 'archived' };

    if (isInMockMode()) {
      const thread = mockForumThreads.find(t => t.id === threadId);
      if (!thread) return null;
      Object.assign(thread, patch, { updated_at: new Date().toISOString() });
      return this.getForumThreadById(threadId);
    }
    const client = adminClient();
    if (!client) return null;
    const { error } = await client.from('forum_threads').update({
      ...patch, updated_at: new Date().toISOString(),
    }).eq('id', threadId);
    if (error) throw error;
    return this.getForumThreadById(threadId);
  },

  async getForumAnalytics(): Promise<ForumAnalytics> {
    const [categories, stats, reports, threads] = await Promise.all([
      this.getForumCategories(),
      this.getForumStats(),
      this.getForumReports('open'),
      this.getForumThreads({ limit: 10000 }),
    ]);
    const openThreads = threads.filter(t => t.status === 'open').length;
    const tagCounts = new Map<string, number>();
    threads.forEach(t => (t.tags || []).forEach(tag => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));

    return {
      totalThreads: stats.threads,
      totalReplies: stats.replies,
      solvedRate: stats.threads ? Math.round((stats.solved / stats.threads) * 100) : 0,
      openThreads,
      reportsOpen: reports.length,
      byCategory: categories.map(c => {
        const inCategory = threads.filter(t => t.category_id === c.id);
        return {
          slug: c.slug, name: c.name, icon: c.icon,
          threads: inCategory.length,
          replies: inCategory.reduce((sum, t) => sum + t.reply_count, 0),
          solved: inCategory.filter(t => t.status === 'solved').length,
        };
      }),
      topTags: Array.from(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([tag, count]) => ({ tag, count })),
    };
  },

  async getForumLeaderboard(limit = 20): Promise<ForumUserStat[]> {
    if (isInMockMode()) {
      return mockForumUserStats()
        .sort((a, b) => b.reputation - a.reputation)
        .slice(0, limit);
    }
    const client = adminClient();
    if (!client) return [];
    const { data, error } = await client
      .from('forum_user_stats').select('*').order('reputation', { ascending: false }).limit(limit);
    if (error) {
      forumWarn('getForumLeaderboard', error);
      if (forumDevFallback()) {
        return mockForumUserStats()
          .sort((a, b) => b.reputation - a.reputation)
          .slice(0, limit);
      }
      return [];
    }
    const usersRes = await client.from('users').select('id, fullname, avatar_url, role');
    const authors = forumAuthorMap((usersRes.data || []) as User[]);
    return ((data || []) as ForumUserStat[]).map(s => ({ ...s, user: authors.get(s.user_id) || null }));
  },

  // --------------------------------------------------------------------------
  // PHASE 4 — KHÁC BIỆT HOÁ (ngữ nghĩa, AI meta, bridge sang ngân hàng câu hỏi)
  // --------------------------------------------------------------------------
  async searchForumThreadsByEmbedding(
    embedding: number[],
    query: { limit?: number; categoryId?: string | null; excludeId?: string | null } = {},
  ): Promise<ForumThread[]> {
    const client = adminClient();
    if (!client || isInMockMode()) return [];
    const { data, error } = await client.rpc('forum_search_similar', {
      p_embedding: toPgVector(embedding),
      p_match_count: query.limit || 6,
      p_category_id: query.categoryId || null,
      p_exclude_id: query.excludeId || null,
    });
    if (error) { forumWarn('searchForumThreadsByEmbedding', error); return []; }
    const rows = (data || []) as Array<{ id: string; similarity: number }>;
    const threads = await Promise.all(rows.map(r => this.getForumThreadById(r.id)));
    return threads.filter((t): t is ForumThread => !!t);
  },

  /** Fallback khi không có pgvector/Gemini: chấm điểm theo tag + từ khoá. */
  async searchForumThreadsByText(text: string, query: ForumThreadQuery = {}, limit = 6): Promise<ForumThread[]> {
    const tokens = forumTokenize(text);
    const candidates = await this.getForumThreads({ ...query, limit: 10000 });
    return candidates
      .map(thread => ({ thread, score: forumTextScore(thread, tokens) + (thread.tags || []).filter(t => tokens.includes(t)).length * 0.5 }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.thread);
  },

  async getRelatedForumThreads(threadId: string, limit = 5): Promise<ForumThread[]> {
    const thread = await this.getForumThreadById(threadId);
    if (!thread) return [];
    const text = `${thread.title} ${(thread.tags || []).join(' ')}`;
    const related = await this.searchForumThreadsByText(text, {
      categoryId: thread.category_id,
    }, limit + 1);
    return related.filter(t => t.id !== threadId).slice(0, limit);
  },

  async setForumThreadSummary(threadId: string, summary: string): Promise<void> {
    if (isInMockMode()) {
      const thread = mockForumThreads.find(t => t.id === threadId);
      if (thread) thread.summary = summary.slice(0, 600);
      return;
    }
    const client = adminClient();
    if (!client) return;
    const { error } = await client.from('forum_threads').update({ summary: summary.slice(0, 600) }).eq('id', threadId);
    if (error) {
      forumWarn('setForumThreadSummary', error);
      if (forumDevFallback()) {
        const thread = mockForumThreads.find(t => t.id === threadId);
        if (thread) thread.summary = summary.slice(0, 600);
      }
    }
  },

  /** Giáo viên chuyển thread (kèm đáp án được chọn) thành câu hỏi tự luận trong ngân hàng đề. */
  async convertForumThreadToQuestion(threadId: string, createdBy: string): Promise<{ id: string } | null> {
    const thread = await this.getForumThreadById(threadId);
    if (!thread) return null;

    if (!isInMockMode()) {
      const client = adminClient();
      if (!client) return null;
      const { data: existing } = await client
        .from('questions').select('id').eq('metadata->>forum_thread_id', threadId).maybeSingle();
      if (existing?.id) return { id: existing.id };
    }

    let subjectId = thread.category?.subject_id || '';
    if (!subjectId) subjectId = (await this.getSubjects())[0]?.id || '';
    const accepted = thread.posts?.find(p => p.id === thread.accepted_post_id || p.is_answer);

    const question = await this.createQuestion({
      content: `${thread.title}\n\n${thread.body}`.slice(0, 6000),
      subject_id: subjectId,
      difficulty: 'medium',
      type: 'sa',
      explanation: accepted?.body || thread.summary || null,
      created_by: createdBy,
      metadata: {
        source: 'forum',
        forum_thread_id: threadId,
        tags: thread.tags || [],
        grade: '12',
      },
    }, []);

    return { id: question.id };
  },
};


// ============================================================================
// PHÒNG THI ẢO — Supabase-backed Store (with in-memory mock fallback)
// Production: persisted in Supabase tables exam_rooms / room_participants.
// Mock mode: falls back to in-memory arrays for local dev without Supabase.
// ============================================================================

import type { ExamRoom, RoomParticipant } from '../types';

// ── Mock in-memory fallback ──────────────────────────────────────────────────
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

/** Ensure the code is unique (mock: check array; production: DB unique constraint) */
function mockUniqueRoomCode(): string {
  let code = generateRoomCode();
  let attempts = 0;
  while (_examRooms.some(r => r.code === code && r.status !== 'closed') && attempts < 20) {
    code = generateRoomCode();
    attempts++;
  }
  return code;
}

/** Generate a unique room code verified against DB */
async function dbUniqueRoomCode(): Promise<string> {
  const client = adminClient();
  if (!client) return generateRoomCode();
  for (let i = 0; i < 20; i++) {
    const code = generateRoomCode();
    const { data } = await client.from('exam_rooms').select('id').eq('code', code).neq('status', 'closed').limit(1);
    if (!data || data.length === 0) return code;
  }
  return generateRoomCode(); // fallback, DB unique constraint will catch collisions
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

    if (isInMockMode()) {
      const room: ExamRoom = {
        id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        code: mockUniqueRoomCode(),
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
    }

    const client = adminClient();
    if (!client) throw new Error('[roomStore.createRoom] Admin client unavailable.');

    const code = await dbUniqueRoomCode();
    const id = `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const { data, error } = await client.from('exam_rooms').insert([{
      id,
      code,
      exam_id: examId,
      exam_title: examTitle,
      exam_duration: examDuration,
      teacher_id: teacherId,
      status: 'waiting',
    }]).select().single();

    if (error) { console.error('[roomStore.createRoom] error:', error); throw error; }
    return data as ExamRoom;
  },

  async getRoomByCode(code: string): Promise<ExamRoom | null> {
    if (isInMockMode()) {
      return _examRooms.find(r => r.code === code.toUpperCase()) ?? null;
    }
    const client = adminClient();
    if (!client) return null;
    const { data, error } = await client.from('exam_rooms').select('*').eq('code', code.toUpperCase()).single();
    if (error) return null;
    return data as ExamRoom;
  },

  async getRoomById(id: string): Promise<ExamRoom | null> {
    if (isInMockMode()) {
      return _examRooms.find(r => r.id === id) ?? null;
    }
    const client = adminClient();
    if (!client) return null;
    const { data, error } = await client.from('exam_rooms').select('*').eq('id', id).single();
    if (error) return null;
    return data as ExamRoom;
  },

  async getTeacherRooms(teacherId: string): Promise<ExamRoom[]> {
    if (isInMockMode()) {
      return _examRooms
        .filter(r => r.teacher_id === teacherId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    const client = adminClient();
    if (!client) return [];
    const { data, error } = await client.from('exam_rooms').select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });
    if (error) { console.error('[roomStore.getTeacherRooms] error:', error); return []; }
    return (data || []) as ExamRoom[];
  },

  async activateRoom(roomId: string): Promise<ExamRoom | null> {
    if (isInMockMode()) {
      const room = _examRooms.find(r => r.id === roomId);
      if (room) room.status = 'active';
      return room ?? null;
    }
    const client = adminClient();
    if (!client) return null;
    const { data, error } = await client.from('exam_rooms')
      .update({ status: 'active' }).eq('id', roomId).select().single();
    if (error) { console.error('[roomStore.activateRoom] error:', error); return null; }
    return data as ExamRoom;
  },

  async closeRoom(roomId: string): Promise<ExamRoom | null> {
    if (isInMockMode()) {
      const room = _examRooms.find(r => r.id === roomId);
      if (room) {
        room.status = 'closed';
        room.closed_at = new Date().toISOString();
      }
      return room ?? null;
    }
    const client = adminClient();
    if (!client) return null;
    const { data, error } = await client.from('exam_rooms')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', roomId).select().single();
    if (error) { console.error('[roomStore.closeRoom] error:', error); return null; }
    return data as ExamRoom;
  },

  // ── Participant operations ──────────────────────────────────────────────────

  async joinRoom(roomId: string, displayName: string, totalQuestions: number): Promise<RoomParticipant> {
    if (isInMockMode()) {
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
    }

    const client = adminClient();
    if (!client) throw new Error('[roomStore.joinRoom] Admin client unavailable.');

    // Check for existing participant (re-join scenario)
    const { data: existing } = await client.from('room_participants')
      .select('*').eq('room_id', roomId).ilike('display_name', displayName).limit(1);
    if (existing && existing.length > 0) return existing[0] as RoomParticipant;

    const id = `rp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const { data, error } = await client.from('room_participants').insert([{
      id,
      room_id: roomId,
      display_name: displayName,
      total_questions: totalQuestions,
      answered_count: 0,
    }]).select().single();
    if (error) { console.error('[roomStore.joinRoom] error:', error); throw error; }
    return data as RoomParticipant;
  },

  async getParticipant(participantId: string): Promise<RoomParticipant | null> {
    if (isInMockMode()) {
      return _roomParticipants.find(p => p.id === participantId) ?? null;
    }
    const client = adminClient();
    if (!client) return null;
    const { data, error } = await client.from('room_participants').select('*').eq('id', participantId).single();
    if (error) return null;
    return data as RoomParticipant;
  },

  async getParticipants(roomId: string): Promise<RoomParticipant[]> {
    if (isInMockMode()) {
      return _roomParticipants
        .filter(p => p.room_id === roomId)
        .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
    }
    const client = adminClient();
    if (!client) return [];
    const { data, error } = await client.from('room_participants').select('*')
      .eq('room_id', roomId).order('joined_at', { ascending: true });
    if (error) { console.error('[roomStore.getParticipants] error:', error); return []; }
    return (data || []) as RoomParticipant[];
  },

  async updateProgress(participantId: string, answeredCount: number): Promise<RoomParticipant | null> {
    if (isInMockMode()) {
      const p = _roomParticipants.find(p => p.id === participantId);
      if (p && !p.submitted_at) p.answered_count = answeredCount;
      return p ?? null;
    }
    const client = adminClient();
    if (!client) return null;
    // Only update if not yet submitted
    const { data, error } = await client.from('room_participants')
      .update({ answered_count: answeredCount })
      .eq('id', participantId).is('submitted_at', null)
      .select().single();
    if (error) { console.error('[roomStore.updateProgress] error:', error); return null; }
    return data as RoomParticipant;
  },

  async submitParticipant(participantId: string, score: number, answeredCount: number): Promise<RoomParticipant | null> {
    if (isInMockMode()) {
      const p = _roomParticipants.find(p => p.id === participantId);
      if (p) {
        p.score = score;
        p.answered_count = answeredCount;
        p.submitted_at = new Date().toISOString();
      }
      return p ?? null;
    }
    const client = adminClient();
    if (!client) return null;
    const { data, error } = await client.from('room_participants')
      .update({
        score,
        answered_count: answeredCount,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', participantId).select().single();
    if (error) { console.error('[roomStore.submitParticipant] error:', error); return null; }
    return data as RoomParticipant;
  },
};

// ============================================================================
// PADLET STORE (Supabase-backed with graceful in-memory fallback)
// ============================================================================

function generatePadletCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const samplePadletCode = 'LOP12A';
const _mockPadletBoards = new Map<string, PadletBoard>();
_mockPadletBoards.set(samplePadletCode, {
  id: 'board-sample-1',
  code: samplePadletCode,
  title: 'Hộp thư Ý kiến & Thảo luận bài học',
  description: 'Gửi thắc mắc, chia sẻ cảm nghĩ hoặc câu hỏi về bài giảng hôm nay!',
  theme: 'corkboard',
  layout_mode: 'columns',
  columns: [
    { id: 'col-1', title: '💡 Ý tưởng & Sáng kiến' },
    { id: 'col-2', title: '❓ Thắc mắc cần giải đáp' },
    { id: 'col-3', title: '🌟 Cảm nhận sau tiết học' }
  ],
  is_locked: false,
  allow_comments: true,
  allow_likes: true,
  created_by: 'teacher-1',
  created_at: new Date(Date.now() - 3600000).toISOString(),
  notes: [
    {
      id: 'note-1',
      board_code: samplePadletCode,
      author_name: 'Thầy Hùng (GV)',
      title: 'Chào mừng các em!',
      content: 'Hãy dán các mẩu ghi chú chia sẻ thắc mắc hoặc ý tưởng cho dự án tuần này nhé.',
      color: 'yellow',
      column_id: 'col-1',
      likes: 5,
      is_pinned: true,
      comments: [
        {
          id: 'cmt-1',
          author_name: 'Minh Anh',
          content: 'Dạ vâng thầy ơi!',
          created_at: new Date(Date.now() - 3000000).toISOString()
        }
      ],
      created_at: new Date(Date.now() - 3500000).toISOString()
    },
    {
      id: 'note-2',
      board_code: samplePadletCode,
      author_name: 'Tuấn Khang (Lớp phó)',
      title: 'Câu hỏi phần Đạo hàm',
      content: 'Thầy có thể giải thích lại phương pháp tìm tiệm cận xiên khi bậc tử lớn hơn bậc mẫu 1 bậc được không ạ?',
      color: 'pink',
      column_id: 'col-2',
      likes: 3,
      is_pinned: false,
      comments: [],
      created_at: new Date(Date.now() - 2500000).toISOString()
    },
    {
      id: 'note-3',
      board_code: samplePadletCode,
      author_name: 'Hải Đăng',
      title: 'Tiết học thú vị',
      content: 'Hôm nay học phần ứng dụng thực tế rất hay và dễ hiểu ạ. Cảm ơn thầy nhiều!',
      color: 'green',
      column_id: 'col-3',
      likes: 4,
      is_pinned: false,
      comments: [],
      created_at: new Date(Date.now() - 1800000).toISOString()
    }
  ]
});

async function dbUniquePadletCode(): Promise<string> {
  const client = adminClient();
  if (!client) return generatePadletCode();
  for (let i = 0; i < 20; i++) {
    const code = generatePadletCode();
    try {
      const { data } = await client.from('padlet_boards').select('id').eq('code', code).limit(1);
      if (!data || data.length === 0) return code;
    } catch {
      return code;
    }
  }
  return generatePadletCode();
}

function parseColumns(cols: any): PadletColumn[] {
  if (!cols) return [];
  if (Array.isArray(cols)) return cols;
  if (typeof cols === 'string') {
    try {
      return JSON.parse(cols);
    } catch {
      return [];
    }
  }
  return [];
}

export const padletStore = {
  // ── 1. GET ALL BOARDS ──────────────────────────────────────────────────────
  async getAllBoards(userId?: string): Promise<PadletBoard[]> {
    if (!isInMockMode()) {
      const client = adminClient();
      if (client) {
        try {
          let query = client.from('padlet_boards').select('*, padlet_notes(id)').order('created_at', { ascending: false });
          if (userId) {
            query = query.eq('created_by', userId);
          }
          const { data, error } = await query;
          if (!error && data) {
            return data.map((b: any) => ({
              id: b.id,
              code: b.code,
              title: b.title,
              description: b.description || undefined,
              theme: b.theme || 'corkboard',
              layout_mode: b.layout_mode || 'wall',
              columns: parseColumns(b.columns),
              is_locked: Boolean(b.is_locked),
              allow_comments: b.allow_comments !== false,
              allow_likes: b.allow_likes !== false,
              created_by: b.created_by,
              created_at: b.created_at,
              notes: (b.padlet_notes || []).map((n: any) => ({ id: n.id } as any))
            }));
          }
          if (error) {
            console.warn('[padletStore.getAllBoards] Supabase notice (falling back to memory):', error.message);
          }
        } catch (err: any) {
          console.warn('[padletStore.getAllBoards] Exception (falling back to memory):', err?.message);
        }
      }
    }

    // In-memory fallback
    const list = Array.from(_mockPadletBoards.values());
    if (userId) {
      return list.filter(b => b.created_by === userId || b.created_by === 'teacher-1');
    }
    return list;
  },

  // ── 2. GET BOARD BY CODE (includes notes & comments) ───────────────────────
  async getBoardByCode(code: string): Promise<PadletBoard | null> {
    if (!code) return null;
    const upperCode = code.toUpperCase();

    if (!isInMockMode()) {
      const client = adminClient();
      if (client) {
        try {
          const { data: b, error } = await client.from('padlet_boards').select('*').eq('code', upperCode).single();
          if (!error && b) {
            // Fetch notes for this board
            const { data: rawNotes } = await client
              .from('padlet_notes')
              .select('*')
              .eq('board_code', upperCode)
              .order('is_pinned', { ascending: false })
              .order('created_at', { ascending: true });

            const notesList = rawNotes || [];
            const noteIds = notesList.map((n: any) => n.id);

            let commentsList: any[] = [];
            if (noteIds.length > 0) {
              const { data: rawComments } = await client
                .from('padlet_comments')
                .select('*')
                .in('note_id', noteIds)
                .order('created_at', { ascending: true });
              if (rawComments) {
                commentsList = rawComments;
              }
            }

            const commentsByNote = new Map<string, PadletComment[]>();
            for (const c of commentsList) {
              const existing = commentsByNote.get(c.note_id) || [];
              existing.push({
                id: c.id,
                author_name: c.author_name || 'Học sinh',
                content: c.content,
                created_at: c.created_at,
              });
              commentsByNote.set(c.note_id, existing);
            }

            const notes: PadletNote[] = notesList.map((n: any) => ({
              id: n.id,
              board_code: n.board_code,
              author_name: n.author_name || 'Học sinh',
              title: n.title || undefined,
              content: n.content,
              color: n.color || 'yellow',
              column_id: n.column_id || undefined,
              likes: Number(n.likes) || 0,
              is_pinned: Boolean(n.is_pinned),
              comments: commentsByNote.get(n.id) || [],
              created_at: n.created_at,
            }));

            const board: PadletBoard = {
              id: b.id,
              code: b.code,
              title: b.title,
              description: b.description || undefined,
              theme: b.theme || 'corkboard',
              layout_mode: b.layout_mode || 'wall',
              columns: parseColumns(b.columns),
              is_locked: Boolean(b.is_locked),
              allow_comments: b.allow_comments !== false,
              allow_likes: b.allow_likes !== false,
              created_by: b.created_by,
              created_at: b.created_at,
              notes,
            };

            // Cache in memory for quick subsequent access
            _mockPadletBoards.set(upperCode, board);
            return board;
          }
        } catch (err: any) {
          console.warn('[padletStore.getBoardByCode] Exception (falling back to memory):', err?.message);
        }
      }
    }

    return _mockPadletBoards.get(upperCode) || null;
  },

  // ── 3. CREATE BOARD ────────────────────────────────────────────────────────
  async createBoard(params: {
    title: string;
    description?: string;
    theme?: PadletTheme;
    layout_mode?: PadletLayoutMode;
    columns?: string[];
    allow_comments?: boolean;
    allow_likes?: boolean;
    created_by: string;
  }): Promise<PadletBoard> {
    const layout_mode = params.layout_mode || 'wall';
    const columns: PadletColumn[] | undefined =
      layout_mode === 'columns' && params.columns && params.columns.length > 0
        ? params.columns.map((c, idx) => ({ id: `col-${Date.now()}-${idx}`, title: c }))
        : layout_mode === 'columns'
        ? [
            { id: `col-${Date.now()}-1`, title: 'Cột 1' },
            { id: `col-${Date.now()}-2`, title: 'Cột 2' },
            { id: `col-${Date.now()}-3`, title: 'Cột 3' },
          ]
        : [];

    const boardId = `board-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    let code = generatePadletCode();

    if (!isInMockMode()) {
      const client = adminClient();
      if (client) {
        try {
          code = await dbUniquePadletCode();
          const { data, error } = await client.from('padlet_boards').insert([{
            id: boardId,
            code,
            title: params.title.trim(),
            description: params.description?.trim() || null,
            theme: params.theme || 'corkboard',
            layout_mode,
            columns,
            is_locked: false,
            allow_comments: params.allow_comments !== false,
            allow_likes: params.allow_likes !== false,
            created_by: params.created_by,
            created_at: now,
            updated_at: now,
          }]).select().single();

          if (!error && data) {
            const board: PadletBoard = {
              id: data.id,
              code: data.code,
              title: data.title,
              description: data.description || undefined,
              theme: data.theme || 'corkboard',
              layout_mode: data.layout_mode || 'wall',
              columns: parseColumns(data.columns),
              is_locked: Boolean(data.is_locked),
              allow_comments: data.allow_comments !== false,
              allow_likes: data.allow_likes !== false,
              created_by: data.created_by,
              created_at: data.created_at,
              notes: [],
            };
            _mockPadletBoards.set(board.code, board);
            return board;
          }
          if (error) {
            console.warn('[padletStore.createBoard] Supabase error:', error.message);
          }
        } catch (err: any) {
          console.warn('[padletStore.createBoard] Exception:', err?.message);
        }
      }
    }

    // Fallback to in-memory
    while (_mockPadletBoards.has(code)) {
      code = generatePadletCode();
    }
    const board: PadletBoard = {
      id: boardId,
      code,
      title: params.title.trim(),
      description: params.description?.trim(),
      theme: params.theme || 'corkboard',
      layout_mode,
      columns,
      is_locked: false,
      allow_comments: params.allow_comments !== false,
      allow_likes: params.allow_likes !== false,
      created_by: params.created_by,
      created_at: now,
      notes: [],
    };
    _mockPadletBoards.set(code, board);
    return board;
  },

  // ── 4. UPDATE BOARD ────────────────────────────────────────────────────────
  async updateBoard(
    code: string,
    updates: Partial<PadletBoard>,
    userId?: string
  ): Promise<PadletBoard | null> {
    if (!code) return null;
    const upperCode = code.toUpperCase();

    if (!isInMockMode()) {
      const client = adminClient();
      if (client) {
        try {
          const { data: existing, error: checkErr } = await client.from('padlet_boards').select('*').eq('code', upperCode).single();
          if (!checkErr && existing) {
            if (userId && existing.created_by !== userId && userId !== 'teacher-1') {
              return null;
            }
            const updateData: any = { updated_at: new Date().toISOString() };
            if (updates.title !== undefined) updateData.title = updates.title;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.theme !== undefined) updateData.theme = updates.theme;
            if (updates.is_locked !== undefined) updateData.is_locked = updates.is_locked;
            if (updates.allow_comments !== undefined) updateData.allow_comments = updates.allow_comments;
            if (updates.allow_likes !== undefined) updateData.allow_likes = updates.allow_likes;

            const { error: updErr } = await client.from('padlet_boards').update(updateData).eq('code', upperCode);
            if (!updErr) {
              return await padletStore.getBoardByCode(upperCode);
            }
          }
        } catch (err: any) {
          console.warn('[padletStore.updateBoard] Exception:', err?.message);
        }
      }
    }

    // Fallback to in-memory
    const board = _mockPadletBoards.get(upperCode);
    if (!board) return null;
    if (userId && board.created_by !== userId && board.created_by !== 'teacher-1') {
      return null;
    }
    if (updates.title !== undefined) board.title = updates.title;
    if (updates.description !== undefined) board.description = updates.description;
    if (updates.theme !== undefined) board.theme = updates.theme;
    if (updates.is_locked !== undefined) board.is_locked = updates.is_locked;
    if (updates.allow_comments !== undefined) board.allow_comments = updates.allow_comments;
    if (updates.allow_likes !== undefined) board.allow_likes = updates.allow_likes;
    return board;
  },

  // ── 5. DELETE BOARD ────────────────────────────────────────────────────────
  async deleteBoard(code: string, userId?: string): Promise<boolean> {
    if (!code) return false;
    const upperCode = code.toUpperCase();

    if (!isInMockMode()) {
      const client = adminClient();
      if (client) {
        try {
          const { data: existing, error: checkErr } = await client.from('padlet_boards').select('created_by').eq('code', upperCode).single();
          if (!checkErr && existing) {
            if (userId && existing.created_by !== userId && userId !== 'teacher-1') {
              return false;
            }
            const { error } = await client.from('padlet_boards').delete().eq('code', upperCode);
            if (!error) {
              _mockPadletBoards.delete(upperCode);
              return true;
            }
          }
        } catch (err: any) {
          console.warn('[padletStore.deleteBoard] Exception:', err?.message);
        }
      }
    }

    const board = _mockPadletBoards.get(upperCode);
    if (!board) return false;
    if (userId && board.created_by !== userId && board.created_by !== 'teacher-1') {
      return false;
    }
    return _mockPadletBoards.delete(upperCode);
  },

  // ── 6. ADD NOTE ────────────────────────────────────────────────────────────
  async addNote(
    code: string,
    data: {
      author_name: string;
      title?: string;
      content: string;
      color?: PadletColor;
      column_id?: string;
    }
  ): Promise<PadletNote | null> {
    if (!code || !data.content?.trim()) return null;
    const upperCode = code.toUpperCase();

    const validColors: PadletColor[] = ['yellow', 'blue', 'green', 'pink', 'purple', 'orange'];
    const color = validColors.includes(data.color as PadletColor) ? (data.color as PadletColor) : 'yellow';
    const noteId = `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    if (!isInMockMode()) {
      const client = adminClient();
      if (client) {
        try {
          const { data: board, error: bErr } = await client.from('padlet_boards').select('code, is_locked, columns').eq('code', upperCode).single();
          if (!bErr && board) {
            if (board.is_locked) return null;

            const cols = parseColumns(board.columns);
            const column_id = data.column_id || cols[0]?.id || null;

            const { data: newRow, error: insErr } = await client.from('padlet_notes').insert([{
              id: noteId,
              board_code: board.code,
              author_name: data.author_name.trim() || 'Học sinh',
              title: data.title?.trim() || null,
              content: data.content.trim(),
              color,
              column_id,
              likes: 0,
              is_pinned: false,
              created_at: now,
              updated_at: now,
            }]).select().single();

            if (!insErr && newRow) {
              const note: PadletNote = {
                id: newRow.id,
                board_code: newRow.board_code,
                author_name: newRow.author_name || 'Học sinh',
                title: newRow.title || undefined,
                content: newRow.content,
                color: newRow.color,
                column_id: newRow.column_id || undefined,
                likes: 0,
                is_pinned: false,
                comments: [],
                created_at: newRow.created_at,
              };

              const memBoard = _mockPadletBoards.get(upperCode);
              if (memBoard) {
                memBoard.notes.push(note);
              }

              return note;
            }
            if (insErr) {
              console.warn('[padletStore.addNote] Supabase error:', insErr.message);
            }
          }
        } catch (err: any) {
          console.warn('[padletStore.addNote] Exception:', err?.message);
        }
      }
    }

    // Fallback to in-memory
    const board = _mockPadletBoards.get(upperCode);
    if (!board || board.is_locked) return null;

    const note: PadletNote = {
      id: noteId,
      board_code: board.code,
      author_name: data.author_name.trim() || 'Học sinh',
      title: data.title?.trim() || undefined,
      content: data.content.trim(),
      color,
      column_id: data.column_id || (board.columns?.[0]?.id),
      likes: 0,
      is_pinned: false,
      comments: [],
      created_at: now,
    };
    board.notes.push(note);
    return note;
  },

  // ── 7. UPDATE NOTE ─────────────────────────────────────────────────────────
  async updateNote(
    code: string,
    noteId: string,
    updates: { is_pinned?: boolean; color?: PadletColor; title?: string; content?: string }
  ): Promise<PadletNote | null> {
    if (!code || !noteId) return null;
    const upperCode = code.toUpperCase();

    if (!isInMockMode()) {
      const client = adminClient();
      if (client) {
        try {
          const updateData: any = { updated_at: new Date().toISOString() };
          if (updates.is_pinned !== undefined) updateData.is_pinned = updates.is_pinned;
          if (updates.color !== undefined) updateData.color = updates.color;
          if (updates.title !== undefined) updateData.title = updates.title;
          if (updates.content !== undefined) updateData.content = updates.content;

          const { data: row, error } = await client.from('padlet_notes').update(updateData).eq('id', noteId).eq('board_code', upperCode).select().single();
          if (!error && row) {
            const { data: cmts } = await client.from('padlet_comments').select('*').eq('note_id', noteId).order('created_at', { ascending: true });
            const note: PadletNote = {
              id: row.id,
              board_code: row.board_code,
              author_name: row.author_name || 'Học sinh',
              title: row.title || undefined,
              content: row.content,
              color: row.color,
              column_id: row.column_id || undefined,
              likes: Number(row.likes) || 0,
              is_pinned: Boolean(row.is_pinned),
              comments: (cmts || []).map((c: any) => ({
                id: c.id,
                author_name: c.author_name || 'Học sinh',
                content: c.content,
                created_at: c.created_at,
              })),
              created_at: row.created_at,
            };

            const memBoard = _mockPadletBoards.get(upperCode);
            if (memBoard) {
              const idx = memBoard.notes.findIndex(n => n.id === noteId);
              if (idx !== -1) memBoard.notes[idx] = note;
            }

            return note;
          }
        } catch (err: any) {
          console.warn('[padletStore.updateNote] Exception:', err?.message);
        }
      }
    }

    // Fallback to in-memory
    const board = _mockPadletBoards.get(upperCode);
    if (!board) return null;
    const note = board.notes.find(n => n.id === noteId);
    if (!note) return null;

    if (updates.is_pinned !== undefined) note.is_pinned = updates.is_pinned;
    if (updates.color !== undefined) note.color = updates.color;
    if (updates.title !== undefined) note.title = updates.title;
    if (updates.content !== undefined) note.content = updates.content;

    return note;
  },

  // ── 8. DELETE NOTE ─────────────────────────────────────────────────────────
  async deleteNote(code: string, noteId: string): Promise<boolean> {
    if (!code || !noteId) return false;
    const upperCode = code.toUpperCase();

    if (!isInMockMode()) {
      const client = adminClient();
      if (client) {
        try {
          const { error } = await client.from('padlet_notes').delete().eq('id', noteId).eq('board_code', upperCode);
          if (!error) {
            const memBoard = _mockPadletBoards.get(upperCode);
            if (memBoard) {
              const idx = memBoard.notes.findIndex(n => n.id === noteId);
              if (idx !== -1) memBoard.notes.splice(idx, 1);
            }
            return true;
          }
        } catch (err: any) {
          console.warn('[padletStore.deleteNote] Exception:', err?.message);
        }
      }
    }

    const board = _mockPadletBoards.get(upperCode);
    if (!board) return false;
    const idx = board.notes.findIndex(n => n.id === noteId);
    if (idx !== -1) {
      board.notes.splice(idx, 1);
      return true;
    }
    return false;
  },

  // ── 9. TOGGLE LIKE NOTE ────────────────────────────────────────────────────
  async toggleLike(code: string, noteId: string): Promise<{ likes: number } | null> {
    if (!code || !noteId) return null;
    const upperCode = code.toUpperCase();

    if (!isInMockMode()) {
      const client = adminClient();
      if (client) {
        try {
          const { data: board, error: bErr } = await client.from('padlet_boards').select('allow_likes').eq('code', upperCode).single();
          if (!bErr && board && board.allow_likes) {
            const { data: note, error: nErr } = await client.from('padlet_notes').select('likes').eq('id', noteId).single();
            if (!nErr && note) {
              const newLikes = (Number(note.likes) || 0) + 1;
              const { error: updErr } = await client.from('padlet_notes').update({ likes: newLikes }).eq('id', noteId);
              if (!updErr) {
                const memBoard = _mockPadletBoards.get(upperCode);
                const memNote = memBoard?.notes.find(n => n.id === noteId);
                if (memNote) memNote.likes = newLikes;
                return { likes: newLikes };
              }
            }
          }
        } catch (err: any) {
          console.warn('[padletStore.toggleLike] Exception:', err?.message);
        }
      }
    }

    const board = _mockPadletBoards.get(upperCode);
    if (!board || !board.allow_likes) return null;
    const note = board.notes.find(n => n.id === noteId);
    if (!note) return null;
    note.likes += 1;
    return { likes: note.likes };
  },

  // ── 10. ADD COMMENT TO NOTE ────────────────────────────────────────────────
  async addComment(
    code: string,
    noteId: string,
    author_name: string,
    content: string
  ): Promise<PadletComment | null> {
    if (!code || !noteId || !content?.trim()) return null;
    const upperCode = code.toUpperCase();
    const cmtId = `cmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    if (!isInMockMode()) {
      const client = adminClient();
      if (client) {
        try {
          const { data: board, error: bErr } = await client.from('padlet_boards').select('allow_comments, is_locked').eq('code', upperCode).single();
          if (!bErr && board) {
            if (!board.allow_comments || board.is_locked) return null;

            const { data: row, error: insErr } = await client.from('padlet_comments').insert([{
              id: cmtId,
              note_id: noteId,
              author_name: author_name.trim() || 'Học sinh',
              content: content.trim(),
              created_at: now,
            }]).select().single();

            if (!insErr && row) {
              const comment: PadletComment = {
                id: row.id,
                author_name: row.author_name || 'Học sinh',
                content: row.content,
                created_at: row.created_at,
              };

              const memBoard = _mockPadletBoards.get(upperCode);
              const memNote = memBoard?.notes.find(n => n.id === noteId);
              if (memNote) memNote.comments.push(comment);

              return comment;
            }
          }
        } catch (err: any) {
          console.warn('[padletStore.addComment] Exception:', err?.message);
        }
      }
    }

    const board = _mockPadletBoards.get(upperCode);
    if (!board || !board.allow_comments || board.is_locked) return null;
    const note = board.notes.find(n => n.id === noteId);
    if (!note) return null;

    const comment: PadletComment = {
      id: cmtId,
      author_name: author_name.trim() || 'Học sinh',
      content: content.trim(),
      created_at: now,
    };
    note.comments.push(comment);
    return comment;
  },
};
