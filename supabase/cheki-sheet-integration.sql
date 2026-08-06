-- Cheki staff spreadsheet integration schema.
-- Run this file in Supabase SQL Editor before deploying sheet-cheki-import.

create table if not exists cheki_recruitments (
  id text primary key default gen_random_uuid()::text,
  live_id text references lives(id) on delete set null,
  group_id text references idol_groups(id) on delete set null,
  group_name text not null,
  live_title text not null,
  venue text,
  event_date date not null,
  time_range text not null default '18:00-21:30',
  live_type text,
  role_description text,
  required_count integer not null default 0 check (required_count >= 0),
  assigned_count integer not null default 0 check (assigned_count >= 0),
  status text not null default '募集中',
  cancel_until date,
  meeting_time text,
  meeting_place text,
  belongings text,
  memo text,
  source_spreadsheet_id text,
  source_sheet_id text,
  source_key text,
  last_synced_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_spreadsheet_id, source_sheet_id, source_key)
);

create table if not exists cheki_recruitment_slots (
  id text primary key default gen_random_uuid()::text,
  recruitment_id text not null references cheki_recruitments(id) on delete cascade,
  source_spreadsheet_id text not null,
  source_sheet_id text not null,
  source_row_uid text not null,
  source_row_number integer,
  event_name text,
  event_date date,
  group_name text,
  staff_name text,
  sheet_status text,
  employee_name text,
  live_type text,
  venue text,
  sort_order integer not null default 0,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_spreadsheet_id, source_sheet_id, source_row_uid)
);

alter table cheki_applications
  add column if not exists recruitment_id text;

do $$
begin
  alter table cheki_applications
    add constraint cheki_applications_recruitment_id_fkey
    foreign key (recruitment_id) references cheki_recruitments(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_cheki_applications_recruitment_id on cheki_applications(recruitment_id);
create index if not exists idx_cheki_recruitments_event_date on cheki_recruitments(event_date);
create index if not exists idx_cheki_recruitments_group_id on cheki_recruitments(group_id);
create index if not exists idx_cheki_recruitments_source on cheki_recruitments(source_spreadsheet_id, source_sheet_id);
create index if not exists idx_cheki_recruitment_slots_recruitment_id on cheki_recruitment_slots(recruitment_id);
create index if not exists idx_cheki_recruitment_slots_source on cheki_recruitment_slots(source_spreadsheet_id, source_sheet_id);

alter table cheki_recruitments enable row level security;
alter table cheki_recruitment_slots enable row level security;

revoke all on table cheki_recruitments, cheki_recruitment_slots from anon;
grant select, insert, update, delete on table cheki_recruitments, cheki_recruitment_slots to authenticated;
grant all on table cheki_recruitments, cheki_recruitment_slots to service_role;

drop policy if exists "employee_all_cheki_recruitments" on cheki_recruitments;
drop policy if exists "employee_all_cheki_recruitment_slots" on cheki_recruitment_slots;
drop policy if exists "cheki_select_cheki_recruitments" on cheki_recruitments;

create policy "employee_all_cheki_recruitments" on cheki_recruitments
  for all to authenticated
  using (public.is_app_employee())
  with check (public.is_app_employee());

create policy "employee_all_cheki_recruitment_slots" on cheki_recruitment_slots
  for all to authenticated
  using (public.is_app_employee())
  with check (public.is_app_employee());

create policy "cheki_select_cheki_recruitments" on cheki_recruitments
  for select to authenticated
  using (public.is_app_cheki() and archived_at is null);
