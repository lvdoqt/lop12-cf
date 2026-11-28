-- Create public Supabase Storage bucket `exam-assets` for exam diagrams, graphs, and cropped figures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exam-assets',
  'exam-assets',
  true,
  5242880, -- 5 MB per diagram image
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to exam diagram images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'exam_assets_public_read'
  ) THEN
    CREATE POLICY exam_assets_public_read
      ON storage.objects FOR SELECT
      USING (bucket_id = 'exam-assets');
  END IF;
END $$;

-- Allow authenticated teachers/admins (or service role) to upload exam images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'exam_assets_staff_insert'
  ) THEN
    CREATE POLICY exam_assets_staff_insert
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'exam-assets');
  END IF;
END $$;
