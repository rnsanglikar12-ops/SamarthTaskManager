-- A PDF evidence document per task (customer complaint letter, inspection
-- report, closure record), uploaded to the task-photos bucket like the
-- before/after photos. Kept separate from the photo columns because the
-- printed One-Point Kaizen sheet embeds those as images.
--
-- Adding a nullable column touches no existing rows, so the
-- tasks_set_updated_at trigger (which drives close dates) does not fire.

alter table public.tasks
  add column if not exists evidence_pdf text;
