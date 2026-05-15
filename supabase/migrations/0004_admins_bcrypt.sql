-- FindConnections — admin auth on Supabase Postgres (without Supabase Auth)
--
-- Phase 4 (partial): move admin records from DynamoDB to Postgres, but keep
-- the existing bcrypt+custom-JWT flow. The original 0001_init.sql modelled
-- admins keyed by auth.users.id assuming Supabase Auth would manage credentials.
-- For now we want a self-contained password column instead, so:
--   - drop the FK to auth.users
--   - generate our own UUID
--   - add password (bcrypt hash) column

----------------------------------------------------------------------------
-- Drop FK and reshape
----------------------------------------------------------------------------
alter table public.admins
  drop constraint if exists admins_id_fkey;

alter table public.admins
  alter column id set default gen_random_uuid();

alter table public.admins
  add column if not exists password text;

-- Existing rows (none expected at this phase, but be safe) need a password.
-- New inserts will provide it.
