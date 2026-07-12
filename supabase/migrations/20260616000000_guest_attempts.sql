-- Cho phép lưu kết quả làm bài thi của khách (guest) bằng cách cho phép user_id là NULL
ALTER TABLE public.attempts ALTER COLUMN user_id DROP NOT NULL;
