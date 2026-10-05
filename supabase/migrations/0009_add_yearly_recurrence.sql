-- Add 'Yearly' recurrence. Until now the "Yearly PM / Overhaul" option in
-- NewActionModal.tsx was saved as 'Weekly', so a yearly task re-opened
-- every week.

alter table public.tasks drop constraint tasks_recurrence_check;
alter table public.tasks add constraint tasks_recurrence_check
  check (recurrence in ('One-Time','Daily','Weekly','Monthly','Quarterly','Yearly'));

create or replace function public.spawn_next_recurring_task()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    when 'Yearly'    then (base + interval '1 year')::date
  end;

  prefix := regexp_replace(new.id, '-\d+$', '');
  next_id := public.get_next_task_id(prefix);

  insert into public.tasks (
    id, priority, recurrence, dept, description, owner, deadline, evidence,
    status, action_notes, "timestamp", originator_dept, machine_note,
    series_origin_id, series_start
  ) values (
    next_id, new.priority, new.recurrence, new.dept, new.description, new.owner,
    to_char(next_due, 'YYYY-MM-DD'), new.evidence,
    'Pending',
    case when coalesce(new.machine_note, '') <> '' then 'M/C: ' || new.machine_note else '' end,
    to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    new.originator_dept, new.machine_note,
    coalesce(new.series_origin_id, new.id),
    coalesce(new.series_start, new."timestamp")
  );

  new.recurrence_spawned := true;
  return new;
end;
$function$;
