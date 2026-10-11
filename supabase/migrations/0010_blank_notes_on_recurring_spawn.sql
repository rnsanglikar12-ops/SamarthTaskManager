-- The next occurrence of a recurring task now starts with an empty Action
-- Notes / Countermeasures box. It used to be pre-filled with "M/C: <machine>",
-- which looked like a countermeasure had already been written; the machine
-- is kept in machine_note and shown separately in the app.

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
    '',
    to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    new.originator_dept, new.machine_note,
    coalesce(new.series_origin_id, new.id),
    coalesce(new.series_start, new."timestamp")
  );

  new.recurrence_spawned := true;
  return new;
end;
$function$;
