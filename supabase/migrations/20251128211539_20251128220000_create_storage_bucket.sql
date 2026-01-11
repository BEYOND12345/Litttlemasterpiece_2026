-- Create Storage Bucket for Artworks
-- This migration creates the storage bucket and RLS policies for artwork images

-- Create the artworks storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'artworks',
  'artworks',
  true,
  52428800,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own artwork
CREATE POLICY "Users can upload own artwork"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'artworks' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update their own artwork
CREATE POLICY "Users can update own artwork"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'artworks' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'artworks' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own artwork
CREATE POLICY "Users can delete own artwork"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'artworks' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read access to all artwork (for displaying in app)
CREATE POLICY "Public can view artwork"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'artworks');
