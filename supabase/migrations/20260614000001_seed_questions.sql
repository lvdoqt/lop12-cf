-- Migration: Seed sample questions for exams
-- Date: 2026-06-14
-- Purpose: Add sample questions linked to exams via de_id

-- First, ensure we have exams to link to
-- Get existing exam IDs
DO $$
DECLARE
  exam_record RECORD;
  question_data JSONB;
  question_count INTEGER := 0;
BEGIN
  -- Loop through existing exams and create sample questions
  FOR exam_record IN SELECT id, title FROM public.exams LOOP
    -- Check if questions already exist for this exam
    IF NOT EXISTS (SELECT 1 FROM public.questions WHERE de_id = exam_record.id::text LIMIT 1) THEN
      -- Create 5 sample questions per exam
      FOR i IN 1..5 LOOP
        question_count := question_count + 1;
        
        -- Create question with options as JSONB
        question_data := jsonb_build_object(
          'A', 'Đáp án A cho câu ' || i,
          'B', 'Đáp án B cho câu ' || i,
          'C', 'Đáp án C cho câu ' || i,
          'D', 'Đáp án D cho câu ' || i
        );
        
        INSERT INTO public.questions (de_id, so_cau, phan, content, options, answer, metadata)
        VALUES (
          exam_record.id::text,
          CASE WHEN i <= 3 THEN i ELSE i - 3 END,
          CASE WHEN i <= 3 THEN 'I' ELSE 'II' END,
          'Câu hỏi mẫu số ' || (CASE WHEN i <= 3 THEN i ELSE i - 3 END) || ' phần ' || (CASE WHEN i <= 3 THEN 'I' ELSE 'II' END) || ' cho đề thi: ' || exam_record.title,
          question_data,
          CASE (i % 4) WHEN 1 THEN 'A' WHEN 2 THEN 'B' WHEN 3 THEN 'C' ELSE 'D' END,
          jsonb_build_object(
            'grade', 12,
            'chapter', 'Chương ' || ((i-1)/2 + 1),
            'difficulty', CASE WHEN i <= 2 THEN 'easy' WHEN i <= 4 THEN 'medium' ELSE 'hard' END,
            'type', 'single_choice',
            'dang_toan', 'Dạng cơ bản'
          )
        )
        ON CONFLICT (de_id, so_cau, phan) DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Created % sample questions for % exams', question_count, (SELECT COUNT(*) FROM public.exams);
END $$;

-- Verify the data
SELECT e.title as exam_title, q.so_cau, q.phan, q.content, q.answer
FROM public.exams e
JOIN public.questions q ON q.de_id = e.id::text
ORDER BY e.title, q.phan, q.so_cau;