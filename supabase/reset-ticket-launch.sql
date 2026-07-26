-- One-time reset for ticket launch dates.
-- Run this in Supabase SQL Editor when existing ticket launch values should be cleared.

update lives
set
  ticket_launch_at = null,
  updated_at = now()
where ticket_launch_at is not null;

update tickets
set
  sale_start_at = null,
  updated_at = now()
where sale_start_at is not null;
