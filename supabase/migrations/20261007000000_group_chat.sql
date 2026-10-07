-- Migration: Nhóm lớp học (/nhom) — bài đăng, bình luận, cảm xúc + Storage ảnh
-- Created At: 2026-10-07

-- 1. GROUP POSTS (Bài đăng / tin nhắn trong nhóm lớp)
CREATE TABLE IF NOT EXISTS public.group_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tag TEXT NOT NULL DEFAULT '💬 Thảo luận',
  body TEXT NOT NULL DEFAULT '',
  images JSONB NOT NULL DEFAULT '[]'::jsonb,        -- [{ url, path }]
  link_url TEXT,
  link_title TEXT,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_group_posts_class_created ON public.group_posts(class_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_posts_user ON public.group_posts(user_id);

-- 2. GROUP COMMENTS (Bình luận / trả lời bài đăng)
CREATE TABLE IF NOT EXISTS public.group_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.group_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_group_comments_post ON public.group_comments(post_id, created_at);

-- 3. GROUP REACTIONS (Mỗi user 1 cảm xúc / bài)
CREATE TABLE IF NOT EXISTS public.group_reactions (
  post_id UUID NOT NULL REFERENCES public.group_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('heart', 'like', 'applause', 'idea', 'question')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (post_id, user_id)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_reactions ENABLE ROW LEVEL SECURITY;

-- Chỉ thành viên đã đăng ký (authenticated) mới được xem
DROP POLICY IF EXISTS "Group posts readable by members" ON public.group_posts;
CREATE POLICY "Group posts readable by members" ON public.group_posts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members insert own posts" ON public.group_posts;
CREATE POLICY "Members insert own posts" ON public.group_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Author or staff update posts" ON public.group_posts;
CREATE POLICY "Author or staff update posts" ON public.group_posts
  FOR UPDATE TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin'))
  );

DROP POLICY IF EXISTS "Author or staff delete posts" ON public.group_posts;
CREATE POLICY "Author or staff delete posts" ON public.group_posts
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin'))
  );

DROP POLICY IF EXISTS "Group comments readable by members" ON public.group_comments;
CREATE POLICY "Group comments readable by members" ON public.group_comments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members insert own comments" ON public.group_comments;
CREATE POLICY "Members insert own comments" ON public.group_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Author delete own comments" ON public.group_comments;
CREATE POLICY "Author delete own comments" ON public.group_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Group reactions readable by members" ON public.group_reactions;
CREATE POLICY "Group reactions readable by members" ON public.group_reactions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members manage own reactions" ON public.group_reactions;
CREATE POLICY "Members manage own reactions" ON public.group_reactions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Cho phép thành viên đã đăng nhập xem hồ sơ cơ bản của nhau (danh sách thành viên nhóm)
DROP POLICY IF EXISTS "Authenticated can view member profiles" ON public.users;
CREATE POLICY "Authenticated can view member profiles" ON public.users
  FOR SELECT TO authenticated USING (true);

-- ── STORAGE: bucket ảnh nhóm ────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'group-images',
  'group-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Ảnh public để hiển thị; chỉ user đăng nhập được upload vào thư mục của chính mình: <user_id>/...
DROP POLICY IF EXISTS "Group images public read" ON storage.objects;
CREATE POLICY "Group images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'group-images');

DROP POLICY IF EXISTS "Group images upload own folder" ON storage.objects;
CREATE POLICY "Group images upload own folder" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'group-images' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Group images delete own folder" ON storage.objects;
CREATE POLICY "Group images delete own folder" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'group-images' AND (storage.foldername(name))[1] = auth.uid()::text
  );
