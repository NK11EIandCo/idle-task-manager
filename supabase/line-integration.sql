-- LINE Messaging API integration tables.
-- Run this file in Supabase SQL Editor before deploying the LINE Edge Functions.

create table if not exists line_contacts (
  line_user_id text primary key,
  display_name text,
  picture_url text,
  status_message text,
  last_event_type text,
  last_message_text text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_line_accounts (
  user_id uuid primary key references app_user_profiles(id) on delete cascade,
  line_user_id text not null unique references line_contacts(line_user_id) on delete cascade,
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists line_link_nonces (
  nonce text primary key,
  user_id uuid not null references app_user_profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists line_notification_logs (
  id text primary key default gen_random_uuid()::text,
  line_user_id text references line_contacts(line_user_id) on delete set null,
  event_type text not null,
  message text,
  status text not null default 'pending',
  response_status integer,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_line_contacts_last_seen_at on line_contacts(last_seen_at desc);
create index if not exists idx_user_line_accounts_line_user_id on user_line_accounts(line_user_id);
create index if not exists idx_line_link_nonces_user_id on line_link_nonces(user_id);
create index if not exists idx_line_link_nonces_expires_at on line_link_nonces(expires_at);
create index if not exists idx_line_notification_logs_created_at on line_notification_logs(created_at desc);
create index if not exists idx_line_notification_logs_line_user_id on line_notification_logs(line_user_id);

alter table line_contacts enable row level security;
alter table user_line_accounts enable row level security;
alter table line_link_nonces enable row level security;
alter table line_notification_logs enable row level security;

revoke all on table line_contacts, user_line_accounts, line_link_nonces, line_notification_logs from anon;
revoke all on table line_link_nonces from authenticated;
grant select, insert, update, delete on table line_contacts, user_line_accounts, line_notification_logs to authenticated;
grant select, insert, update, delete on table line_contacts, user_line_accounts, line_link_nonces, line_notification_logs to service_role;

drop policy if exists "employee_all_line_contacts" on line_contacts;
drop policy if exists "employee_all_user_line_accounts" on user_line_accounts;
drop policy if exists "self_select_user_line_accounts" on user_line_accounts;
drop policy if exists "self_delete_user_line_accounts" on user_line_accounts;
drop policy if exists "employee_all_line_link_nonces" on line_link_nonces;
drop policy if exists "employee_all_line_notification_logs" on line_notification_logs;

create policy "employee_all_line_contacts" on line_contacts
  for all to authenticated
  using (public.is_app_employee())
  with check (public.is_app_employee());

create policy "employee_all_user_line_accounts" on user_line_accounts
  for all to authenticated
  using (public.is_app_employee())
  with check (public.is_app_employee());

create policy "self_select_user_line_accounts" on user_line_accounts
  for select to authenticated
  using (user_id = auth.uid());

create policy "self_delete_user_line_accounts" on user_line_accounts
  for delete to authenticated
  using (user_id = auth.uid());

create policy "employee_all_line_notification_logs" on line_notification_logs
  for all to authenticated
  using (public.is_app_employee())
  with check (public.is_app_employee());
