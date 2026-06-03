-- ============================================================
-- MIGRACIÓN — Solo si YA corriste supabase-schema.sql antes.
-- Si es tu primera vez, ignorá este archivo y usá supabase-schema.sql.
-- Pegá esto en Supabase → SQL Editor → Run.
-- ============================================================

alter table models   add column if not exists sku text;
alter table settings add column if not exists listing_emoji text default '🌴';
