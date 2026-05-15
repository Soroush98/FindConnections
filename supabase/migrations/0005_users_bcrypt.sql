-- FindConnections — user auth on Supabase Postgres (without Supabase Auth)
--
-- Mirror of 0004_admins_bcrypt.sql but for the profiles table. We're not
-- using Supabase Auth, so the FK to auth.users is dropped and we add a
-- password column plus the confirmation/reset token fields the userRepository
-- needs.

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  alter column id set default gen_random_uuid();

alter table public.profiles
  add column if not exists password                   text,
  add column if not exists is_confirmed               boolean       not null default false,
  add column if not exists confirmation_token         text,
  add column if not exists token_expiration           timestamptz,
  add column if not exists reset_token                text,
  add column if not exists reset_token_expiration     timestamptz;

create index if not exists profiles_confirmation_token_idx on public.profiles (confirmation_token)
  where confirmation_token is not null;
create index if not exists profiles_reset_token_idx        on public.profiles (reset_token)
  where reset_token is not null;
