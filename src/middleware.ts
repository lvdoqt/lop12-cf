import { defineMiddleware } from 'astro:middleware';
import { isMockModeForEnv, createServerSupabase } from './lib/supabase';
import { db, setRuntimeEnv } from './services/db';
// @ts-ignore
import { env } from 'cloudflare:workers';


export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.url);
  const path = url.pathname;

  // Extract Cloudflare Workers runtime env
  // This contains vars from wrangler.toml [vars] and CF Dashboard secrets.
  let runtimeEnv: Record<string, string | undefined> | undefined = undefined;
  try {
    runtimeEnv = env;
  } catch (e) {
    console.warn('Could not read env from cloudflare:workers:', e);
  }

  // Store runtimeEnv in locals so pages/db service can use it
  context.locals.runtimeEnv = runtimeEnv;

  // Inject runtime env into db service (must be called before any db.* calls)
  setRuntimeEnv(runtimeEnv);

  // Determine mock mode using runtime env (correct on Cloudflare Pages)
  const mockMode = isMockModeForEnv(runtimeEnv);

  // Initialize locals
  context.locals.user = null;

  const mockUserId = context.cookies.get('mock-user-id')?.value;
  if (mockUserId) {
    const user = await db.getUserById(mockUserId);
    if (user) {
      context.locals.user = user;
    }
  }

  if (!context.locals.user) {
    // In production, verify session cookies with Supabase
    const accessToken = context.cookies.get('sb-access-token')?.value;
    const refreshToken = context.cookies.get('sb-refresh-token')?.value;

    if (accessToken) {
      const supabaseServer = createServerSupabase(runtimeEnv);
      try {
        // Set session from cookies - this also handles token refresh automatically
        const { data: { session }, error: sessionError } = await supabaseServer.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });
        
        if (!sessionError && session?.user) {
          const { data: profile, error: profileError } = await supabaseServer
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile && !profileError) {
            context.locals.user = profile;
          } else {
            // Graceful fallback profile
            context.locals.user = {
              id: session.user.id,
              email: session.user.email || '',
              fullname: session.user.user_metadata?.fullname || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Học Sinh',
              avatar_url: session.user.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/adventurer/svg?seed=default',
              role: 'student',
              created_at: new Date().toISOString(),
            };
          }
        }
      } catch (e) {
        console.error('Middleware auth check failed:', e);
      }
    }
  }

  const user = context.locals.user;

  // ============================================================
  // ACCESS CONTROL RULES
  // ============================================================

  // Auth pages (redirect to dashboard if already logged in)
  const isAuthPage = path === '/login' || path === '/register' || path === '/forgot-password' || path === '/reset-password';

  // PUBLIC pages - no login needed:
  //   /ly-thuyet, /ly-thuyet/[slug] — Subject list & detail
  //   /[subject]/[slug]          — Lesson content
  //   /exams/[id]                — Exam info page (shows title, time, question count, lock icon if has password)
  //   /, /about, /contact, /guide, /privacy, /sitemap
  const isPublicContent =
    path.startsWith('/ly-thuyet') ||
    /^\/[a-z0-9-]+-12\/[a-z0-9-]+$/.test(path) || // e.g., /toan-12/bai-1
    path === '/';

  // Exam info page is public (e.g. /exams/exam-1 but NOT /exams/exam-1/take or /exams/exam-1/result/...)
  // Check: starts with /exams/ and only has ONE segment after it (no further slashes)
  const examPathSegments = path.split('/').filter(s => s.length > 0); // ['exams', 'exam-1'] or ['exams','exam-1','take']
  const isExamInfoPage = examPathSegments.length === 2 && examPathSegments[0] === 'exams';

  // LOGIN-REQUIRED pages:
  //   /exams/[id]/take           — Taking an exam (need account to save score)
  //   /exams/[id]/result/[id]    — View exam results
  //   /dashboard, /profile, /ai-chat
  const isProtectedRoute =
    path.startsWith('/dashboard') ||
    path.startsWith('/profile');

  const isAdminRoute = path.startsWith('/admin');
  const isApiRoute = path.startsWith('/api');

  // ============================================================
  // REDIRECTIONS
  // ============================================================
  if (user) {
    // Logged-in user trying to access login/register → send to dashboard
    if (isAuthPage) {
      return context.redirect('/dashboard');
    }
    // Admin-only route check
    if (isAdminRoute && user.role !== 'admin' && user.role !== 'teacher') {
      return context.redirect('/dashboard');
    }
  } else {
    // Guest user trying to access protected route → send to login
    if (isProtectedRoute || isAdminRoute) {
      return context.redirect('/login');
    }
  }

  // ============================================================
  // EXECUTE REQUEST
  // ============================================================
  const response = await next();

  // ============================================================
  // CACHE HEADERS (chỉ áp dụng cho GET requests thành công)
  // ============================================================
  if (context.request.method === 'GET' && response.status < 400) {

    // API routes — không cache, private
    if (isApiRoute) {
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    }

    // Admin & protected routes — không cache
    if (isAdminRoute || isProtectedRoute) {
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    }

    // Auth pages (login, register...) — không cache
    if (isAuthPage) {
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    }

    // Nếu user đã đăng nhập → không cache (response cá nhân hoá)
    if (user) {
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    }

    // ── Public static-ish pages ─────────────────────────────────────────────

    // Trang chủ: 1h browser, 2h CDN, stale 24h
    if (path === '/') {
      response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=7200, stale-while-revalidate=86400');
    }
    // Môn học & Bài học: 1h browser, 24h CDN
    else if (path.startsWith('/ly-thuyet/') || /^\/[a-z0-9-]+-12\/[a-z0-9-]+$/.test(path)) {
      response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    }
    // Trang đề thi info (public): 30m browser, 1h CDN
    else if (isExamInfoPage) {
      response.headers.set('Cache-Control', 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400');
    }
    // Trang tĩnh: about, guide, privacy, contact, sitemap — 24h browser, 7 ngày CDN
    else if (['/about', '/guide', '/privacy', '/contact', '/sitemap'].includes(path)) {
      response.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000');
    }
    // Sitemap.xml & robots.txt được serve từ public/ nên handled bởi static server
    // Mặc định không set cache cho các path khác
  }

  return response;
});