-- Enable admin-managed app user deletion.
-- Run this once in Supabase SQL Editor for existing environments.

create or replace function public.delete_app_user_profile(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'permission denied';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'cannot delete yourself';
  end if;

  delete from public.app_user_profiles
  where id = target_user_id;
end;
$$;

grant execute on function public.delete_app_user_profile(uuid) to authenticated;

drop policy if exists "profile_delete_admin" on app_user_profiles;

create policy "profile_delete_admin" on app_user_profiles
  for delete to authenticated
  using (public.is_app_admin() and id <> auth.uid());
