-- Migration: Add password field to exams table
-- Purpose: Allow teachers to set a password on exams so students must enter it before taking the exam.
-- The password is optional. If NULL, the exam is open to all logged-in users.
-- If set, students must enter the correct password (validated server-side) to start the exam.

ALTER TABLE public.exams 
  ADD COLUMN IF NOT EXISTS password TEXT DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.exams.password IS 
  'Optional password for the exam. If set, students must enter this password before taking the exam. Validated server-side only.';
