-- Make the artworks bucket private.
--
-- 20251128211539 created `artworks` with public = true and a SELECT policy
-- for `public`, so anyone holding the anon key (which ships in every page by
-- design) could list every user's folder and download every file. Those
-- files include the ORIGINAL camera photo of a child's drawing, EXIF intact
-- (possibly GPS). Found in the 2026-11-17 security audit.
--
-- After this: only the signed-in owner can read their own files, through
-- the API or a signed URL. Public URLs (getPublicUrl) stop working, which
-- breaks image display in the legacy studio and dashboard. Those are being
-- taken out of the Christmas site; a child's photo being public is not an
-- acceptable price for keeping them.
--
-- Not covered here: copies already uploaded to Cloudinary by the legacy
-- studio, which are public on Cloudinary's CDN and must be deleted there.

UPDATE storage.buckets SET public = false WHERE id = 'artworks';

DROP POLICY IF EXISTS "Public can view artwork" ON storage.objects;

CREATE POLICY "Users can view own artwork"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'artworks' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
