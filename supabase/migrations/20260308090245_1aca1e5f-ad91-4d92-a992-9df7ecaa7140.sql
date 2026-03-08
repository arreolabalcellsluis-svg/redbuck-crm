
-- Create storage bucket for company logo
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true);

-- Allow authenticated users to upload to company-assets bucket
CREATE POLICY "Authenticated users can upload company assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-assets');

-- Allow anyone to read company assets (public bucket)
CREATE POLICY "Anyone can read company assets"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'company-assets');

-- Allow authenticated users to update company assets
CREATE POLICY "Authenticated users can update company assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'company-assets');

-- Allow authenticated users to delete company assets
CREATE POLICY "Authenticated users can delete company assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-assets');
