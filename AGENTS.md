# AGENTS.md — Lớp 12 LMS

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Astro dev server (SSR, hot-reload) at `http://localhost:4321` |
| `npm run build` | Production static build |
| `npm run preview` | Preview production build locally |
| `npx @astrojs/check` | Type-check Astro components (`astro check` not in scripts) |
| `npx tsc --noEmit` | Standalone TypeScript type-check |

No test framework is configured. No linter or formatter is configured.

## Architecture

- **Astro 6** SSR with `@astrojs/node` (standalone mode) — output is `'static'` but runs Node in dev.
- **Data**: Supabase PostgreSQL. **Mock mode** auto-activates when Supabase keys are missing/placeholder (`src/lib/supabase.ts:11-15`). Mock data lives in `src/services/db.ts` as in-memory arrays.
- **Auth**: Supabase Auth with roles `student | teacher | admin`. Middleware (`src/middleware.ts`) reads `mock-user-id` cookie for mock mode, or Supabase session tokens for production.
- **Cache**: Detailed `Cache-Control` headers set per-route in middleware — public pages get CDN-friendly caching; auth/protected/api routes are `no-store`.
- **Env vars**: Code prefers `PUBLIC_SUPABASE_*` (Vite-exposed) but falls back to `SUPABASE_*` (`src/lib/supabase.ts:5-8`). `.env.example` uses the unprefixed names.
- **Node >= 22.12** required (`package.json` engines).

## Key gotchas

- **No git repo locally** — `git diff`–based commands (lint-staged, etc.) will fail. Not a git repo in this workspace.
- **Admin Supabase client** — `createAdminSupabase()` bypasses RLS using `SUPABASE_SERVICE_ROLE_KEY`. Used in most SSR queries since `auth.uid()` is null server-side. Falls back to anon client if service key missing (`src/services/db.ts` throughout).
- **Content collections** — lessons are loaded via `astro:content` with glob loader from `src/content/lessons/**/*.mdx` (`src/content.config.ts`), **not** from Supabase.
- **Question type encoding**: question `type` uses `'single_choice' | 'multiple_choice' | 'true_false' | 'msq' | 'sa' | 'tl'`. Correct answer is comma-separated option letters (e.g. `'A,B,C'`).
- **Vietnamese slugify**: `slugify()` utility in `db.ts` transliterates Vietnamese diacritics. `generateExamSlug()` appends base-36 timestamp.
- **WordPress import**: Blog posts can be imported from `WORDPRESS_API_URL` (set in `.env`). `mapWPPostToBlog()` handles the transformation.
- **Mock login**: Mock accounts (`student@lop12.vn`, `teacher@lop12.vn`, `admin@lop12.vn`) shown as clickable buttons on `/login`.

## File layout

```
src/
  lib/supabase.ts       — Supabase clients + mock mode detection
  services/db.ts        — All DB queries (mock + real), Vietnamese slugify
  types/index.ts        — Shared TS interfaces (snake_case DB → camelCase TS)
  middleware.ts         — Auth + cache header logic
  content.config.ts     — Astro content collections (lessons only)
  components/           — Reusable Astro components (Navbar, Sidebar, AIChat, ChartComponent, etc.)
  layouts/Layout.astro  — Global HTML wrapper, SEO, KaTeX, AdSense
  pages/                — File-based routes; [param] for dynamic segments
  pages/admin/          — Admin/teacher CRUD (users, questions, exams, courses, blogs)
  content/lessons/      — MDX lesson files organized by subject slug
supabase/migrations/    — SQL schema + RLS policies (apply in order)
```

## Route access rules (middleware)

| Route | Access |
|-------|--------|
| `/`, `/ly-thuyet*`, `/[subject]/[slug]`, `/exams/[id]` (info only) | Public |
| `/dashboard`, `/profile`, `/ai-chat`, `/exams/[id]/take*`, `/exams/[id]/result/*` | Login required |
| `/admin/*` | Teacher or admin only |

