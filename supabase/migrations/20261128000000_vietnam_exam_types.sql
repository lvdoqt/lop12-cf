-- Document extended Vietnamese exam programs and live exam session settings in public.exams.settings
COMMENT ON COLUMN public.exams.settings IS
  'JSONB exam configuration supporting:
   - exam_program: "15m" | "midterm" | "semester" | "mock_thpt" | "dgnl_hsa" | "dgnl_vact" | "dgtd_tsa" | "vsat" | "hsg"
   - is_graded: boolean (true = official graded attempt, false = practice mode)
   - point_per_question: numeric (points per MCQ/leaf item)
   - point_per_sa: numeric (points per short-answer item; 0.5 for Math, 0.25 for Science/Social subjects)
   - max_score: numeric (10 standard, 20 HSG, 100 TSA, 120 V-ACT, 150 V-SAT/HSA)
   - pick_per_type: { mcq: k, msq: k, sa: k, ... }
   - open_at: ISO timestamp when exam session opens
   - close_at: ISO timestamp when exam session closes
   - max_attempts: integer max graded attempts per student/SBD
   - show_answers_mode: "always" | "after_close" | "never"';
