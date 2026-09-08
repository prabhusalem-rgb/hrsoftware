-- ============================================================
-- 068_add_logos_schema.sql
-- Add support for company and software logos
-- ============================================================

-- 1. Add logo_url to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id          TEXT PRIMARY KEY DEFAULT 'global',
  software_name TEXT NOT NULL DEFAULT 'hrsoftware',
  software_logo_url TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES profiles(id)
);

-- Insert default settings if not exists
INSERT INTO system_settings (id, software_name)
VALUES ('global', 'hrsoftware')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policies for system_settings
CREATE POLICY "Anyone can view system settings"
  ON system_settings FOR SELECT
  USING (true);

CREATE POLICY "Only super_admins can update system settings"
  ON system_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- 3. Storage Bucket for Logos
-- Note: This requires the storage extension and may need manual execution if 
-- the database user doesn't have permissions to 'storage' schema.

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'logos' bucket
CREATE POLICY "Logos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'logos' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can update their uploaded logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'logos' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can delete logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'logos' AND
    auth.role() = 'authenticated'
  );
