-- The DSI / Kaizen category a task is classified under when it is marked as
-- a Kaizen (dsi, pokayoke, 5s, standard, quality, productivity — see
-- KAIZEN_CATEGORIES in src/data/sentinelDataLoader.ts). Separate from the
-- free-text `category` column, which tags Customer Complaint / MOM items.
--
-- Adding a nullable column touches no existing rows, so the
-- tasks_set_updated_at trigger (which drives close dates) does not fire.

alter table public.tasks
  add column if not exists kaizen_category text;
