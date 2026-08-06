-- Allow Supabase Edge Functions using the service role key to create LINE link nonces.
-- Run this in Supabase SQL Editor if line-link-nonce returns:
-- nonce_create_failed / permission denied for table line_link_nonces

grant select, insert, update, delete on table line_link_nonces to service_role;
grant select, insert, update, delete on table user_line_accounts to service_role;
grant select, insert, update, delete on table line_contacts to service_role;
grant select, insert, update, delete on table line_notification_logs to service_role;
