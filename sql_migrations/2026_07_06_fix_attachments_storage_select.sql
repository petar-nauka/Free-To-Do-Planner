-- Fix (Security Wave 1): storage SELECT политиката за bucket 'attachments'
-- нямаше ownership check (USING (bucket_id='attachments')) -> всеки логнат
-- потребител можеше да чете чужди файлове. Огледално на INSERT/DELETE политиките
-- (миграция 20260210175813) и на таблицата public.attachments (is_project_member).
--
-- ПРИЛАГАНЕ: изпълни този файл в Supabase SQL Editor (self-hosted).
-- Пътят на файловете е {user_id}/{project_id}/... => foldername[1] = собственика.

-- ВАЖНО: на живо политиката се казва "Users can view files in attachments"
-- (потвърдено на сървъра: qual = bucket_id='attachments' AND auth.role()='authenticated').
-- Дропваме всички възможни имена, иначе старата (свръх-позволителна) политика остава
-- успоредно на новата и RLS ги ИЛИ-ва → дупката НЕ се затваря.
DROP POLICY IF EXISTS "Users can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files in attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own or project attachments" ON storage.objects;

CREATE POLICY "Users can view own or project attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'attachments' AND (
    -- собственик (пътят започва с неговия user_id)
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- член на проекта, към който принадлежи файлът
    EXISTS (
      SELECT 1 FROM public.attachments a
      WHERE a.file_path = storage.objects.name
        AND public.is_project_member(auth.uid(), a.project_id)
    )
  )
);
