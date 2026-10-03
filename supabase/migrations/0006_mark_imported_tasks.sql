-- Flags the rows bulk-loaded from the old Google Sheet register during the
-- Supabase cutover (15 Sep 2026, 18:28–18:33 UTC), so weekly "New Tasks
-- Generated" counts (Dept Leaders & 4-V velocity) don't treat the whole
-- legacy backlog as work raised that week. Their real creation dates were not
-- carried over — each got a synthetic 15 Sep timestamp on import.
--
-- The app never writes this column, so normal task updates leave it alone.
--
-- Side effect when applied (3 Oct 2026): the tasks_set_updated_at trigger
-- stamped updated_at = now() on all 3,282 flagged rows, which also moved the
-- close date (closedAt) of the imported Completed tasks to that day. Any
-- future bulk backfill on tasks should disable that trigger around it.

alter table public.tasks
  add column if not exists imported boolean not null default false;

update public.tasks
   set imported = true
 where created_at >= '2026-09-15 18:28:00+00'
   and created_at <  '2026-09-15 18:33:00+00';
