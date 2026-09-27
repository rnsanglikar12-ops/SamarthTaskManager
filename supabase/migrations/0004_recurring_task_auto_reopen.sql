-- When a recurring task (Daily / Weekly / Monthly / Quarterly) moves to
-- Completed, open the next occurrence automatically: a new Pending task with
-- the same dept, owner, description, priority, recurrence, originator and
-- machine note, due the OLD due date + one period (not the completion date,
-- so the rhythm stays fixed even when a task is completed early or late).
--
-- Done in the database rather than the app so it fires exactly once
-- regardless of who completes the task or from which client.
-- recurrence_spawned guards against a duplicate if the task is later
-- reopened and completed again.

alter table public.tasks
  add column if not exists recurrence_spawned boolean not null default false;

create or replace function public.spawn_next_recurring_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_id  text;
  prefix   text;
  base     date;
  next_due date;
begin
  if new.status <> 'Completed'
     or old.status = 'Completed'
     or new.recurrence = 'One-Time'
     or new.recurrence_spawned then
    return new;
  end if;

  base := case when new.deadline = '' then current_date else new.deadline::date end;
  next_due := case new.recurrence
    when 'Daily'     then base + 1
    when 'Weekly'    then base + 7
    when 'Monthly'   then (base + interval '1 month')::date
    when 'Quarterly' then (base + interval '3 months')::date
  end;

  prefix := regexp_replace(new.id, '-\d+$', '');
  next_id := public.get_next_task_id(prefix);

  insert into public.tasks (
    id, priority, recurrence, dept, description, owner, deadline, evidence,
    status, action_notes, "timestamp", originator_dept, machine_note
  ) values (
    next_id, new.priority, new.recurrence, new.dept, new.description, new.owner,
    to_char(next_due, 'YYYY-MM-DD'), new.evidence,
    'Pending',
    case when coalesce(new.machine_note, '') <> '' then 'M/C: ' || new.machine_note else '' end,
    to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    new.originator_dept, new.machine_note
  );

  new.recurrence_spawned := true;
  return new;
end;
$$;

drop trigger if exists tasks_spawn_next_recurring on public.tasks;
create trigger tasks_spawn_next_recurring
  before update of status on public.tasks
  for each row execute function public.spawn_next_recurring_task();
