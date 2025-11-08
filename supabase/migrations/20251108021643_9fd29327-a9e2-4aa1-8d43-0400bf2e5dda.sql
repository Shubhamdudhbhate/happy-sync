-- Create storage bucket for item media if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('item-media', 'item-media', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view item media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their item media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their item media" ON storage.objects;
DROP POLICY IF EXISTS "Officials can manage all media" ON storage.objects;

-- Storage policies for item media
CREATE POLICY "Public can view item media"
ON storage.objects FOR SELECT
USING (bucket_id = 'item-media');

CREATE POLICY "Users can upload their item media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'item-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their item media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'item-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Officials can manage all media"
ON storage.objects FOR ALL
USING (
  bucket_id = 'item-media' AND
  has_role(auth.uid(), 'official'::app_role)
);