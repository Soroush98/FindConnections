-- FindConnections — remove user-facing data tables
--
-- The membership feature (user signup/login/profile/upload) has been removed
-- entirely. The app is now public-read + admin-only, so the following tables
-- no longer have any callers:
--   profiles    — user accounts (was: userRepository)
--   ip_bans     — login-attempt rate limiting (was: banRepository)
--
-- pending_pairs is left in place — it's still intended for the Phase 6 cron
-- queue. admins is left in place — it's the active admin auth table.

drop table if exists public.profiles cascade;
drop table if exists public.ip_bans cascade;
