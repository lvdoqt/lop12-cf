-- Migration: Diễn đàn Học sinh — Phase 2 (tương tác), 3 (vận hành), 4 (khác biệt hoá)
-- Chạy SAU 20261118000000_forum.sql. Mọi lệnh đều idempotent (chạy lại được).

-- ---------------------------------------------------------------------------
-- PHASE 2 — Mở rộng thread + báo cáo/tương tác bổ trợ
-- ---------------------------------------------------------------------------
ALTER TABLE public.forum_threads ADD COLUMN IF NOT EXISTS summary TEXT;

-- Nhúng vector chỉ được tạo khi extension pgvector tồn tại (Supabase có sẵn).
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'vector'
  ) THEN
    EXECUTE 'ALTER TABLE public.forum_threads ADD COLUMN IF NOT EXISTS embedding vector(768)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_forum_threads_embedding ON public.forum_threads USING hnsw (embedding vector_cosine_ops)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Index HNSW có thể không khả dụng trên một số phiên bản; bỏ qua an toàn.
END $$;

-- ---------------------------------------------------------------------------
-- PHASE 3 — Báo cáo vi phạm + thống kê người dùng
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forum_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'offtopic', 'abuse', 'wrong', 'other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_forum_reports_status ON public.forum_reports(status, created_at DESC);

ALTER TABLE public.forum_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members create forum reports" ON public.forum_reports;
CREATE POLICY "Members create forum reports" ON public.forum_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Staff read forum reports" ON public.forum_reports;
CREATE POLICY "Staff read forum reports" ON public.forum_reports
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin'))
  );

DROP POLICY IF EXISTS "Staff update forum reports" ON public.forum_reports;
CREATE POLICY "Staff update forum reports" ON public.forum_reports
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin'))
  );

-- View điểm uy tín/huy hiệu — luôn tính từ dữ liệu thật, không cần đồng bộ trigger.
CREATE OR REPLACE VIEW public.forum_user_stats AS
WITH stats AS (
  SELECT
    u.id AS user_id,
    (SELECT count(*) FROM public.forum_threads t WHERE t.author_id = u.id)::int AS threads_count,
    (SELECT count(*) FROM public.forum_posts p WHERE p.author_id = u.id AND p.deleted_at IS NULL)::int AS answers_count,
    (SELECT count(*) FROM public.forum_posts p WHERE p.author_id = u.id AND p.is_answer)::int AS accepted_count,
    (SELECT count(*) FROM public.forum_reactions r
       JOIN public.forum_posts p ON p.id = r.post_id
      WHERE p.author_id = u.id AND r.kind IN ('helpful', 'heart'))::int AS helpful_count
  FROM public.users u
)
SELECT
  s.user_id,
  s.threads_count,
  s.answers_count,
  s.accepted_count,
  s.helpful_count,
  (s.threads_count * 5 + s.answers_count * 2 + s.accepted_count * 15 + s.helpful_count * 3)::int AS reputation,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN s.accepted_count >= 3 THEN 'Chuyên gia giải đáp' END,
    CASE WHEN s.threads_count >= 5 THEN 'Người hỏi tích cực' END,
    CASE WHEN s.answers_count >= 10 THEN 'Thành viên nhiệt tình' END,
    CASE WHEN u.role IN ('teacher', 'admin') THEN 'Giáo viên xác thực' END
  ], NULL)::text[] AS badges
FROM stats s
JOIN public.users u ON u.id = s.user_id;

-- ---------------------------------------------------------------------------
-- RPC: gộp thông báo follower + @mention trong 1 lần gọi (tiết kiệm subrequest).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.forum_notify_new_post(
  p_thread_id UUID, p_post_id UUID, p_author_id UUID, p_body TEXT
) RETURNS void AS $$
DECLARE
  v_title TEXT;
  v_user UUID;
BEGIN
  SELECT title INTO v_title FROM public.forum_threads WHERE id = p_thread_id;
  IF v_title IS NULL THEN RETURN; END IF;

  FOR v_user IN
    SELECT user_id FROM public.forum_follows
     WHERE thread_id = p_thread_id AND user_id <> p_author_id
     LIMIT 50
  LOOP
    INSERT INTO public.forum_notifications (user_id, type, payload)
    VALUES (v_user, 'follow', jsonb_build_object(
      'thread_id', p_thread_id, 'thread_title', v_title, 'post_id', p_post_id));
  END LOOP;

  FOR v_user IN
    SELECT u.id FROM public.users u
     WHERE u.id <> p_author_id
       AND length(coalesce(u.fullname, '')) >= 3
       AND p_body ILIKE '%@' || u.fullname || '%'
     LIMIT 10
  LOOP
    INSERT INTO public.forum_notifications (user_id, type, payload)
    VALUES (v_user, 'mention', jsonb_build_object(
      'thread_id', p_thread_id, 'thread_title', v_title, 'post_id', p_post_id));
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.forum_notify_new_post(UUID, UUID, UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: tìm thread tương đồng bằng pgvector (chỉ tồn tại khi có pgvector).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regtype('vector') IS NOT NULL OR EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'vector'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.forum_search_similar(
        p_embedding vector(768),
        p_match_count int DEFAULT 5,
        p_category_id uuid DEFAULT NULL,
        p_exclude_id uuid DEFAULT NULL
      ) RETURNS TABLE (id uuid, title text, slug text, body text, similarity float, category_slug text)
      LANGUAGE sql STABLE AS $body$
        SELECT t.id, t.title, t.slug, t.body,
               1 - (t.embedding <=> p_embedding) AS similarity,
               c.slug
          FROM public.forum_threads t
          JOIN public.forum_categories c ON c.id = t.category_id
         WHERE t.embedding IS NOT NULL
           AND t.status <> 'archived'
           AND (p_category_id IS NULL OR t.category_id = p_category_id)
           AND (p_exclude_id IS NULL OR t.id <> p_exclude_id)
         ORDER BY t.embedding <=> p_embedding
         LIMIT LEAST(GREATEST(p_match_count, 1), 20)
      $body$;
      GRANT EXECUTE ON FUNCTION public.forum_search_similar(vector, integer, uuid, uuid) TO anon, authenticated;
    $fn$;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Không có pgvector: API tự fallback sang tìm kiếm theo tag/từ khoá.
END $$;

-- ---------------------------------------------------------------------------
-- PHASE 3 — Storage cho ảnh/PDF đính kèm
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'forum-files', 'forum-files', true, 5242880,
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Forum files readable by all" ON storage.objects;
CREATE POLICY "Forum files readable by all" ON storage.objects
  FOR SELECT USING (bucket_id = 'forum-files');

DROP POLICY IF EXISTS "Members upload own forum files" ON storage.objects;
CREATE POLICY "Members upload own forum files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'forum-files' AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Members delete own forum files" ON storage.objects;
CREATE POLICY "Members delete own forum files" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'forum-files' AND auth.uid()::text = (storage.foldername(name))[1]
  );
