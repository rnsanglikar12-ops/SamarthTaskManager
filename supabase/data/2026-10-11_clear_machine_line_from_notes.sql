-- One-off data change, run 2026-10-11: open tasks had "M/C: <machine>" pre-filled
-- in action_notes, which looked like a countermeasure. Remove that leading line
-- (machine stays in machine_note); keep any real text or stamps after it.
-- 278 blanked, 18 trimmed, 2 left where the machine ran into user text.
begin;
alter table public.tasks disable trigger tasks_set_updated_at;
with c as (
  select id, substr(action_notes, length('M/C: ' || machine_note) + 1) rest
  from public.tasks
  where status <> 'Completed' and machine_note is not null
    and left(action_notes, length('M/C: ' || machine_note)) = 'M/C: ' || machine_note
), n as (
  select id,
    case when rest ~ '^\s*$' then ''
         when rest ~ '^\s*\|' then regexp_replace(rest, '^\s*\|\s*', '')
         when rest ~ '^[ \t]*[\r\n]' then regexp_replace(rest, '^\s+', '')
         else null end new_notes
  from c)
update public.tasks t set action_notes = n.new_notes
from n where t.id = n.id and n.new_notes is not null;
alter table public.tasks enable trigger tasks_set_updated_at;
commit;
