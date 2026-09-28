-- ============================================
-- Notes Version History & Trash Bin (Soft Delete)
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- 1) Soft-delete column on notes (Trash bin)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);

-- 2) Versions table - one row per saved version
CREATE TABLE IF NOT EXISTS note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_versions_note_id_created_at
  ON note_versions(note_id, created_at DESC);

-- 3) RLS for note_versions
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Users can view versions of accessible notes" ON note_versions;
DROP POLICY IF EXISTS "Users can insert versions for accessible notes" ON note_versions;
DROP POLICY IF EXISTS "Users can delete their own versions" ON note_versions;

-- SELECT: viewable if the user has access to the parent note
CREATE POLICY "Users can view versions of accessible notes" ON note_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM notes n
      WHERE n.id = note_versions.note_id
        AND (
          n.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = n.project_id AND pm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = n.project_id AND p.user_id = auth.uid()
          )
        )
    )
  );

-- INSERT: only insert versions for notes the user can access
CREATE POLICY "Users can insert versions for accessible notes" ON note_versions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM notes n
      WHERE n.id = note_versions.note_id
        AND (
          n.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = n.project_id AND pm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = n.project_id AND p.user_id = auth.uid()
          )
        )
    )
  );

-- DELETE: users can delete their own versions
CREATE POLICY "Users can delete their own versions" ON note_versions
  FOR DELETE USING (auth.uid() = user_id);

-- 4) Optional: cleanup helper to auto-purge versions older than 90 days
-- (Not run automatically; run via cron if desired.)
-- DELETE FROM note_versions WHERE created_at < NOW() - INTERVAL '90 days';
