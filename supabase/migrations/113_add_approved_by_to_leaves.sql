-- Add approved_by column to leaves table if missing
-- This column tracks which user (GM/HR) approved the leave
ALTER TABLE leaves
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_leaves_approved_by
  ON leaves(approved_by);
