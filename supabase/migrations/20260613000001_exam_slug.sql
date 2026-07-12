-- Migration: Add slug to exams table for SEO-friendly URLs
-- Purpose: Allow exam URLs to use readable slugs instead of UUIDs
-- Example: /de-thi/de-kiem-tra-15-phut-toan-12 instead of /exams/uuid

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill existing exams: use their id as slug placeholder
-- (App will generate proper Vietnamese slugs for new exams)
UPDATE public.exams
  SET slug = id::text
  WHERE slug IS NULL;

-- Make slug NOT NULL and UNIQUE going forward
ALTER TABLE public.exams
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS exams_slug_unique_idx ON public.exams(slug);

COMMENT ON COLUMN public.exams.slug IS
  'URL-friendly slug for SEO. Generated from title (Vietnamese transliterated). Used in /de-thi/[slug] routes.';
