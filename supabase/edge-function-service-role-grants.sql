-- Grants required by Supabase Edge Functions that use the service role through PostgREST.
-- Run this in Supabase SQL Editor if an Edge Function returns permission errors while reading app_user_profiles.

grant usage on schema public to service_role;
grant select on table public.app_user_profiles to service_role;
