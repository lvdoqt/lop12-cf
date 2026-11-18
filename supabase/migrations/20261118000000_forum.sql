-- Migration: Diễn đàn Học sinh (/hoc-sinh)
-- Chuyên mục -> thread -> bài trả lời, accepted answer, cảm xúc, bookmark, thông báo.
-- Đọc công khai (anon), ghi bắt buộc đăng nhập.

-- 1. CHUYÊN MỤC ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forum_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES public.forum_categories(id) ON DELETE CASCADE,
  order_index INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_forum_categories_order ON public.forum_categories(order_index);

-- 2. THREAD -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forum_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.forum_categories(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  body TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'solved', 'locked', 'archived')),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  views_count INT NOT NULL DEFAULT 0,
  reply_count INT NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  accepted_post_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_category_activity
  ON public.forum_threads(category_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_threads_status_activity
  ON public.forum_threads(status, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_threads_tags ON public.forum_threads USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_forum_threads_author ON public.forum_threads(author_id);

-- 3. BÀI TRẢ LỜI --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.forum_posts(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_answer BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON public.forum_posts(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON public.forum_posts(author_id);

-- accepted_post_id chỉ là tham chiếu mềm (tránh vòng lặp FK). Trigger dưới đây
-- tự đồng bộ cờ is_answer khi chủ thread chọn/đổi câu trả lời đúng.

-- 4. TƯƠNG TÁC ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forum_reactions (
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('like', 'helpful', 'heart')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.forum_bookmarks (
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.forum_follows (
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.forum_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_forum_notifications_user_unread
  ON public.forum_notifications(user_id, read_at, created_at DESC);

-- 5. TRIGGER: cập nhật thống kê thread ----------------------------------------
CREATE OR REPLACE FUNCTION public.forum_sync_thread_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_threads
       SET reply_count = reply_count + 1,
           last_activity_at = now(),
           updated_at = now()
     WHERE id = NEW.thread_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.forum_threads
       SET reply_count = GREATEST(0, reply_count - 1)
     WHERE id = OLD.thread_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_forum_posts_stats ON public.forum_posts;
CREATE TRIGGER trg_forum_posts_stats
AFTER INSERT OR DELETE ON public.forum_posts
FOR EACH ROW EXECUTE FUNCTION public.forum_sync_thread_stats();

-- RPC: chủ thread (hoặc giáo viên/admin) chọn câu trả lời được chấp nhận.
CREATE OR REPLACE FUNCTION public.forum_accept_answer(p_thread_id UUID, p_post_id UUID)
RETURNS void AS $$
DECLARE
  v_author UUID;
BEGIN
  SELECT author_id INTO v_author FROM public.forum_threads WHERE id = p_thread_id;
  IF v_author IS NULL THEN RAISE EXCEPTION 'Thread không tồn tại'; END IF;
  IF auth.uid() IS DISTINCT FROM v_author
     AND NOT EXISTS (SELECT 1 FROM public.users u
                      WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin')) THEN
    RAISE EXCEPTION 'Bạn không có quyền chọn câu trả lời cho thread này';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.forum_posts
                  WHERE id = p_post_id AND thread_id = p_thread_id) THEN
    RAISE EXCEPTION 'Câu trả lời không thuộc thread này';
  END IF;

  UPDATE public.forum_posts SET is_answer = false WHERE thread_id = p_thread_id;
  UPDATE public.forum_posts SET is_answer = true WHERE id = p_post_id;
  UPDATE public.forum_threads
     SET accepted_post_id = p_post_id, status = 'solved', updated_at = now()
   WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: tăng lượt xem (gọi từ client khi mở thread).
CREATE OR REPLACE FUNCTION public.forum_increment_views(p_thread_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.forum_threads SET views_count = views_count + 1 WHERE id = p_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.forum_accept_answer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.forum_increment_views(UUID) TO anon, authenticated;

-- 6. RLS ---------------------------------------------------------------------
ALTER TABLE public.forum_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_threads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_reactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_bookmarks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_follows        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_notifications  ENABLE ROW LEVEL SECURITY;

-- Đọc public
DROP POLICY IF EXISTS "Forum categories readable by all" ON public.forum_categories;
CREATE POLICY "Forum categories readable by all" ON public.forum_categories
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Forum threads readable by all" ON public.forum_threads;
CREATE POLICY "Forum threads readable by all" ON public.forum_threads
  FOR SELECT USING (status <> 'archived');

DROP POLICY IF EXISTS "Forum posts readable by all" ON public.forum_posts;
CREATE POLICY "Forum posts readable by all" ON public.forum_posts
  FOR SELECT USING (deleted_at IS NULL);

-- Ghi: chỉ chính chủ, giáo viên/admin được sửa/xoá
DROP POLICY IF EXISTS "Members create forum threads" ON public.forum_threads;
CREATE POLICY "Members create forum threads" ON public.forum_threads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Author or staff update forum threads" ON public.forum_threads;
CREATE POLICY "Author or staff update forum threads" ON public.forum_threads
  FOR UPDATE TO authenticated USING (
    auth.uid() = author_id OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin'))
  );

DROP POLICY IF EXISTS "Author or staff delete forum threads" ON public.forum_threads;
CREATE POLICY "Author or staff delete forum threads" ON public.forum_threads
  FOR DELETE TO authenticated USING (
    auth.uid() = author_id OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin'))
  );

DROP POLICY IF EXISTS "Members create forum posts" ON public.forum_posts;
CREATE POLICY "Members create forum posts" ON public.forum_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Author or staff update forum posts" ON public.forum_posts;
CREATE POLICY "Author or staff update forum posts" ON public.forum_posts
  FOR UPDATE TO authenticated USING (
    auth.uid() = author_id OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin'))
  );

DROP POLICY IF EXISTS "Author or staff delete forum posts" ON public.forum_posts;
CREATE POLICY "Author or staff delete forum posts" ON public.forum_posts
  FOR DELETE TO authenticated USING (
    auth.uid() = author_id OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin'))
  );

DROP POLICY IF EXISTS "Users manage own forum reactions" ON public.forum_reactions;
CREATE POLICY "Users manage own forum reactions" ON public.forum_reactions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own forum bookmarks" ON public.forum_bookmarks;
CREATE POLICY "Users manage own forum bookmarks" ON public.forum_bookmarks
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own forum follows" ON public.forum_follows;
CREATE POLICY "Users manage own forum follows" ON public.forum_follows
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own forum notifications" ON public.forum_notifications;
CREATE POLICY "Users read own forum notifications" ON public.forum_notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own forum notifications" ON public.forum_notifications;
CREATE POLICY "Users update own forum notifications" ON public.forum_notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 7. SEED chuyên mục ----------------------------------------------------------
INSERT INTO public.forum_categories (name, slug, description, icon, order_index) VALUES
  ('Học tập chung', 'hoc-tap-chung', 'Kinh nghiệm ôn thi, quản lý thời gian, tâm lý trước kỳ thi THPT.', '🎓', 0),
  ('Toán 12', 'toan-12', 'Hỏi đáp công thức, phương pháp giải nhanh và các dạng bài khó.', '∑', 1),
  ('Vật lý 12', 'vat-ly-12', 'Dao động, sóng, điện từ trường và các bài tập nâng cao.', '⚡', 2),
  ('Hóa học 12', 'hoa-hoc-12', 'Este, lipit, điện giải và kỹ năng giải bài tập hóa.', '⚗️', 3),
  ('Sinh học 12', 'sinh-hoc-12', 'Di truyền, tiến hóa, sinh thái và các đề thử chuyên sâu.', '🧬', 4),
  ('Tiếng Anh 12', 'tieng-anh-12', 'Ngữ pháp, từ vựng, đọc hiểu và kỹ năng làm bài thi.', '🔤', 5)
ON CONFLICT (slug) DO NOTHING;

-- Gắn chuyên mục môn học với subjects có sẵn (nếu trùng slug)
UPDATE public.forum_categories fc
   SET subject_id = s.id
  FROM public.subjects s
 WHERE s.slug = fc.slug AND fc.subject_id IS NULL;
