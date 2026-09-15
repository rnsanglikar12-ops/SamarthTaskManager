-- Extend tasks.recurrence to also allow 'Monthly' and 'Quarterly', alongside
-- the existing 'One-Time' | 'Daily' | 'Weekly' — see Recurrence type in
-- src/types.ts and the recurrence dropdown in NewActionModal.tsx, which
-- already offered "Monthly PM" / "Quarterly PM" options that silently
-- mis-mapped to 'Weekly' before this change.
alter table public.tasks drop constraint tasks_recurrence_check;
alter table public.tasks add constraint tasks_recurrence_check
  check (recurrence in ('One-Time','Daily','Weekly','Monthly','Quarterly'));
