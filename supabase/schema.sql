-- FOC live manager schema
-- Apply this file in Supabase SQL Editor before deploying the app.

create table if not exists idol_groups (
  id text primary key,
  name text not null,
  manager_name text,
  photo_url text,
  google_calendar_url text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lives (
  id text primary key,
  group_id text not null references idol_groups(id) on delete cascade,
  title text not null,
  venue text,
  event_date date,
  status text not null default '計画',
  live_type text,
  manager_name text,
  ticket_launch_at timestamptz,
  rehearsal_text text,
  photo_shoot_text text,
  production_company text,
  drive_folder_url text,
  source_calendar_event_id text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id text primary key,
  live_id text not null references lives(id) on delete cascade,
  phase text,
  title text not null,
  due_date date,
  owner_name text,
  priority text,
  status text not null default '未着手',
  memo text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subtasks (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tickets (
  id text primary key,
  live_id text not null references lives(id) on delete cascade,
  name text not null,
  price integer not null default 0,
  sale_start_at timestamptz,
  benefit text,
  page_url text,
  status text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists production_items (
  id text primary key,
  live_id text not null references lives(id) on delete cascade,
  name text not null,
  owner_name text,
  designer_name text,
  vendor text,
  due_date date,
  status text,
  file_url text,
  memo text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists run_schedule_items (
  id text primary key,
  live_id text not null references lives(id) on delete cascade,
  day text not null,
  time text not null,
  title text not null,
  owner_kind text,
  owner_name text,
  place text,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists task_templates (
  id text primary key,
  name text not null,
  live_type text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists task_template_items (
  id text primary key,
  template_id text not null references task_templates(id) on delete cascade,
  phase text,
  title text not null,
  due_offset_days integer not null default -30,
  owner_name text,
  priority text,
  memo text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists task_template_subtasks (
  id text primary key,
  template_item_id text not null references task_template_items(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists run_schedule_templates (
  id text primary key,
  name text not null,
  live_type text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists run_schedule_template_items (
  id text primary key,
  template_id text not null references run_schedule_templates(id) on delete cascade,
  day text not null,
  time text not null,
  title text not null,
  owner_kind text,
  owner_name text,
  place text,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cheki_applications (
  id text primary key,
  shift_id text not null,
  app_user_id uuid not null default auth.uid(),
  status text not null default '応募済み',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists calendar_events (
  id text primary key,
  group_id text references idol_groups(id) on delete cascade,
  source_event_id text not null,
  title text not null,
  venue text,
  starts_at timestamptz,
  ends_at timestamptz,
  raw_payload jsonb,
  imported_at timestamptz not null default now()
);

create table if not exists app_user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'cheki' check (role in ('admin', 'employee', 'cheki')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lives_group_id on lives(group_id);
create index if not exists idx_tasks_live_id on tasks(live_id);
create index if not exists idx_subtasks_task_id on subtasks(task_id);
create index if not exists idx_tickets_live_id on tickets(live_id);
create index if not exists idx_production_items_live_id on production_items(live_id);
create index if not exists idx_run_schedule_items_live_id on run_schedule_items(live_id);
create index if not exists idx_cheki_applications_app_user_id on cheki_applications(app_user_id);
create index if not exists idx_app_user_profiles_status on app_user_profiles(status);

alter table idol_groups enable row level security;
alter table lives enable row level security;
alter table tasks enable row level security;
alter table subtasks enable row level security;
alter table tickets enable row level security;
alter table production_items enable row level security;
alter table run_schedule_items enable row level security;
alter table task_templates enable row level security;
alter table task_template_items enable row level security;
alter table task_template_subtasks enable row level security;
alter table run_schedule_templates enable row level security;
alter table run_schedule_template_items enable row level security;
alter table cheki_applications enable row level security;
alter table calendar_events enable row level security;
alter table app_user_profiles enable row level security;

revoke all on schema public from anon;
revoke all on table
  idol_groups,
  lives,
  tasks,
  subtasks,
  tickets,
  production_items,
  run_schedule_items,
  task_templates,
  task_template_items,
  task_template_subtasks,
  run_schedule_templates,
  run_schedule_template_items,
  cheki_applications,
  calendar_events,
  app_user_profiles
from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  idol_groups,
  lives,
  tasks,
  subtasks,
  tickets,
  production_items,
  run_schedule_items,
  task_templates,
  task_template_items,
  task_template_subtasks,
  run_schedule_templates,
  run_schedule_template_items,
  cheki_applications,
  calendar_events,
  app_user_profiles
to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_user_profiles (id, email, display_name, role, status)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    'cheki',
    'pending'
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.current_app_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.app_user_profiles
  where id = auth.uid()
    and status = 'active'
  limit 1
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_user_role() = 'admin', false)
$$;

create or replace function public.is_app_employee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_user_role() in ('admin', 'employee'), false)
$$;

create or replace function public.is_app_cheki()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_user_role() = 'cheki', false)
$$;

grant execute on function public.current_app_user_role() to authenticated;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.is_app_employee() to authenticated;
grant execute on function public.is_app_cheki() to authenticated;

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

drop policy if exists "authenticated_select_idol_groups" on idol_groups;
drop policy if exists "authenticated_write_idol_groups" on idol_groups;
drop policy if exists "authenticated_select_lives" on lives;
drop policy if exists "authenticated_write_lives" on lives;
drop policy if exists "authenticated_select_tasks" on tasks;
drop policy if exists "authenticated_write_tasks" on tasks;
drop policy if exists "authenticated_select_subtasks" on subtasks;
drop policy if exists "authenticated_write_subtasks" on subtasks;
drop policy if exists "authenticated_select_tickets" on tickets;
drop policy if exists "authenticated_write_tickets" on tickets;
drop policy if exists "authenticated_select_production_items" on production_items;
drop policy if exists "authenticated_write_production_items" on production_items;
drop policy if exists "authenticated_select_run_schedule_items" on run_schedule_items;
drop policy if exists "authenticated_write_run_schedule_items" on run_schedule_items;
drop policy if exists "authenticated_select_task_templates" on task_templates;
drop policy if exists "authenticated_write_task_templates" on task_templates;
drop policy if exists "authenticated_select_task_template_items" on task_template_items;
drop policy if exists "authenticated_write_task_template_items" on task_template_items;
drop policy if exists "authenticated_select_task_template_subtasks" on task_template_subtasks;
drop policy if exists "authenticated_write_task_template_subtasks" on task_template_subtasks;
drop policy if exists "authenticated_select_run_schedule_templates" on run_schedule_templates;
drop policy if exists "authenticated_write_run_schedule_templates" on run_schedule_templates;
drop policy if exists "authenticated_select_run_schedule_template_items" on run_schedule_template_items;
drop policy if exists "authenticated_write_run_schedule_template_items" on run_schedule_template_items;
drop policy if exists "authenticated_select_cheki_applications" on cheki_applications;
drop policy if exists "authenticated_write_cheki_applications" on cheki_applications;
drop policy if exists "authenticated_select_calendar_events" on calendar_events;
drop policy if exists "authenticated_write_calendar_events" on calendar_events;
drop policy if exists "employee_all_idol_groups" on idol_groups;
drop policy if exists "employee_all_lives" on lives;
drop policy if exists "employee_all_tasks" on tasks;
drop policy if exists "employee_all_subtasks" on subtasks;
drop policy if exists "employee_all_tickets" on tickets;
drop policy if exists "employee_all_production_items" on production_items;
drop policy if exists "employee_all_run_schedule_items" on run_schedule_items;
drop policy if exists "employee_all_task_templates" on task_templates;
drop policy if exists "employee_all_task_template_items" on task_template_items;
drop policy if exists "employee_all_task_template_subtasks" on task_template_subtasks;
drop policy if exists "employee_all_run_schedule_templates" on run_schedule_templates;
drop policy if exists "employee_all_run_schedule_template_items" on run_schedule_template_items;
drop policy if exists "employee_all_calendar_events" on calendar_events;
drop policy if exists "employee_all_cheki_applications" on cheki_applications;
drop policy if exists "cheki_select_idol_groups" on idol_groups;
drop policy if exists "cheki_select_lives" on lives;
drop policy if exists "cheki_select_own_applications" on cheki_applications;
drop policy if exists "cheki_insert_own_applications" on cheki_applications;
drop policy if exists "cheki_update_own_applications" on cheki_applications;
drop policy if exists "cheki_delete_own_applications" on cheki_applications;
drop policy if exists "no_auth_all_idol_groups" on idol_groups;
drop policy if exists "no_auth_all_lives" on lives;
drop policy if exists "no_auth_all_tasks" on tasks;
drop policy if exists "no_auth_all_subtasks" on subtasks;
drop policy if exists "no_auth_all_tickets" on tickets;
drop policy if exists "no_auth_all_production_items" on production_items;
drop policy if exists "no_auth_all_run_schedule_items" on run_schedule_items;
drop policy if exists "no_auth_all_task_templates" on task_templates;
drop policy if exists "no_auth_all_task_template_items" on task_template_items;
drop policy if exists "no_auth_all_task_template_subtasks" on task_template_subtasks;
drop policy if exists "no_auth_all_run_schedule_templates" on run_schedule_templates;
drop policy if exists "no_auth_all_run_schedule_template_items" on run_schedule_template_items;
drop policy if exists "no_auth_all_calendar_events" on calendar_events;
drop policy if exists "no_auth_all_cheki_applications" on cheki_applications;
drop policy if exists "profile_select_self_or_admin" on app_user_profiles;
drop policy if exists "profile_insert_self_pending" on app_user_profiles;
drop policy if exists "profile_update_admin" on app_user_profiles;
drop policy if exists "profile_delete_admin" on app_user_profiles;

create policy "profile_select_self_or_admin" on app_user_profiles
  for select to authenticated
  using (id = auth.uid() or public.is_app_admin());

create policy "profile_insert_self_pending" on app_user_profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'cheki' and status = 'pending');

create policy "profile_update_admin" on app_user_profiles
  for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy "profile_delete_admin" on app_user_profiles
  for delete to authenticated
  using (public.is_app_admin() and id <> auth.uid());

create policy "employee_all_idol_groups" on idol_groups for all to authenticated using (public.is_app_employee()) with check (public.is_app_employee());
create policy "employee_all_lives" on lives for all to authenticated using (public.is_app_employee()) with check (public.is_app_employee());
create policy "employee_all_tasks" on tasks for all to authenticated using (public.is_app_employee()) with check (public.is_app_employee());
create policy "employee_all_subtasks" on subtasks for all to authenticated using (public.is_app_employee()) with check (public.is_app_employee());
create policy "employee_all_tickets" on tickets for all to authenticated using (public.is_app_employee()) with check (public.is_app_employee());
create policy "employee_all_production_items" on production_items for all to authenticated using (public.is_app_employee()) with check (public.is_app_employee());
create policy "employee_all_run_schedule_items" on run_schedule_items for all to authenticated using (public.is_app_employee()) with check (public.is_app_employee());
create policy "employee_all_task_templates" on task_templates for all to authenticated using (public.is_app_employee()) with check (public.is_app_employee());
create policy "employee_all_task_template_items" on task_template_items for all to authenticated using (public.is_app_employee()) with check (public.is_app_employee());
create policy "employee_all_task_template_subtasks" on task_template_subtasks for all to authenticated using (public.is_app_employee()) with check (public.is_app_employee());
create policy "employee_all_run_schedule_templates" on run_schedule_templates for all to authenticated using (public.is_app_employee()) with check (public.is_app_employee());
create policy "employee_all_run_schedule_template_items" on run_schedule_template_items for all to authenticated using (public.is_app_employee()) with check (public.is_app_employee());
create policy "employee_all_calendar_events" on calendar_events for all to authenticated using (public.is_app_employee()) with check (public.is_app_employee());
create policy "employee_all_cheki_applications" on cheki_applications for all to authenticated using (public.is_app_employee()) with check (public.is_app_employee());

create policy "cheki_select_idol_groups" on idol_groups for select to authenticated using (public.is_app_cheki());
create policy "cheki_select_lives" on lives for select to authenticated using (public.is_app_cheki());
create policy "cheki_select_own_applications" on cheki_applications for select to authenticated using (app_user_id = auth.uid());
create policy "cheki_insert_own_applications" on cheki_applications for insert to authenticated with check (app_user_id = auth.uid());
create policy "cheki_update_own_applications" on cheki_applications for update to authenticated using (app_user_id = auth.uid()) with check (app_user_id = auth.uid());
create policy "cheki_delete_own_applications" on cheki_applications for delete to authenticated using (app_user_id = auth.uid());
