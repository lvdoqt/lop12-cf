-- Migration: Quản lý nhóm (Class/Club) cho giáo viên
CREATE TABLE IF NOT EXISTS public.chat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade TEXT DEFAULT '',
  speciality TEXT DEFAULT '',
  color TEXT DEFAULT '#6366f1',
  initials TEXT DEFAULT '',
  is_club BOOLEAN DEFAULT false,
  pinned_notice TEXT DEFAULT '',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_chat_groups_created_by ON public.chat_groups(created_by);

-- Thêm quyền RLS cho chat_groups
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;

-- Ai đã đăng nhập cũng xem được danh sách nhóm
CREATE POLICY "Anyone can view chat groups" ON public.chat_groups
  FOR SELECT TO authenticated USING (true);

-- Giáo viên/admin có thể tạo nhóm
CREATE POLICY "Teachers can insert groups" ON public.chat_groups
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin'))
  );

-- Người tạo hoặc admin có thể sửa/xóa
CREATE POLICY "Creator or admin can update groups" ON public.chat_groups
  FOR UPDATE TO authenticated USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "Creator or admin can delete groups" ON public.chat_groups
  FOR DELETE TO authenticated USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Thêm một bảng phụ để đăng ký thành viên vào nhóm (tương lai nếu cần)
CREATE TABLE IF NOT EXISTS public.chat_group_members (
  group_id UUID REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view members" ON public.chat_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join groups" ON public.chat_group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON public.chat_group_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Sửa group_posts để class_id map tới chat_groups(id) thay vì TEXT (tuy nhiên để tương thích ngược, mình đổi type dần dần hoặc cứ coi class_id là id của group, vì hiện tại nó là TEXT)
-- Hiện tại class_id ở group_posts đang là TEXT. id của chat_groups là UUID. Ta sẽ dùng id kiểu văn bản hoặc uuid đều được.
