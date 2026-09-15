-- Samarth Task Manager — Supabase schema
--
-- Mirrors the existing Google Sheet backend (see scripts/apps-script-complete.gs)
-- field-for-field, so this can act as a drop-in alternative backend behind a
-- build-time switch (VITE_BACKEND_PROVIDER=sheets|supabase) — see
-- src/utils/dataService.ts. Google Sheets remains the production default
-- until this is fully proven out; this schema does not remove anything from
-- the Sheets path.
--
-- Run this once against a fresh Supabase project (SQL editor, or `supabase
-- db push` if using the CLI). Safe to re-run individual CREATE statements
-- only after dropping — this file is not written to be idempotent on a
-- second run against an already-initialized project.

-- =========================================================
-- tasks
-- =========================================================
-- deadline / timestamp are kept as plain `text`, NOT `date`/`timestamptz`.
-- The app already fixed one IST/UTC timezone bug by doing local-date string
-- math (getTodayStr() in src/data/sentinelDataLoader.ts) and compares dates
-- as plain 'YYYY-MM-DD' strings everywhere (ActionRegisterView.tsx,
-- KaizenHubView.tsx, DepartmentDirectoryView.tsx). Real Postgres date/
-- timestamptz types would reintroduce that exact class of bug via a
-- different path (PostgREST serializes timestamptz as UTC), for zero
-- benefit today. Revisit only if real SQL date arithmetic is ever needed —
-- a generated column could be added later without touching the app.
create table public.tasks (
  id                text primary key,               -- dept-prefixed sequential, e.g. "MCM-580"
  priority          text not null check (priority in ('A','B')),
  recurrence        text not null check (recurrence in ('One-Time','Daily','Weekly')),
  dept              text not null,
  description       text not null default '',        -- ActionItem.desc
  owner             text not null default '',
  deadline          text not null default '' check (deadline = '' or deadline ~ '^\d{4}-\d{2}-\d{2}$'),
  evidence          text not null default '',
  status            text not null check (status in ('Pending','In process','Completed','Under Verification','Hold')),
  action_notes      text not null default '',
  attached_photo    text,
  "timestamp"       text not null default '',         -- opaque ISO string, see note above
  originator_dept   text not null default '',
  after_photo       text,
  is_kaizen         boolean not null default false,
  kaizen_benefit    text,
  is_broadcast      boolean not null default false,
  category          text,
  is_mom            boolean not null default false,
  is_cft            boolean not null default false,
  machine_note      text,
  created_at        timestamptz not null default now(),  -- Postgres bookkeeping only, never read by the app
  updated_at        timestamptz not null default now()
);

create index tasks_dept_idx on public.tasks (dept);
create index tasks_status_idx on public.tasks (status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- =========================================================
-- users  (custom auth table — mirrors the Apps Script "Users" tab exactly,
-- see USERS_HEADERS in scripts/apps-script-complete.gs)
-- =========================================================
-- password_hash is a plain, unsalted client-side SHA-256 hex digest (see
-- hashPassword() in src/utils/auth.ts) — carried over unchanged, not a
-- Supabase Auth migration. departments is a comma-separated string exactly
-- like the Sheet's "department" column (parsed client-side via the same
-- parseDepartments_/joinDepartments_ logic ported into supabaseService.ts);
-- empty/null means plant-wide.
create table public.users (
  username              text primary key,
  display_name          text not null,
  password_hash         text not null,
  role                  text not null check (role in ('Viewer','DeptHead','PlantHead','MD','Admin')),
  departments           text not null default '',
  must_change_password  boolean not null default false,
  created_at            text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);

-- =========================================================
-- supervisors  (name-only, no login — see SUPERVISORS_HEADERS in
-- scripts/apps-script-complete.gs)
-- =========================================================
create table public.supervisors (
  name       text not null,
  dept       text not null,
  created_at text not null default to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  primary key (name, dept)
);

-- =========================================================
-- id_counters — backs get_next_task_id() below. One row per department
-- prefix (see DEPT_PREFIXES in scripts/apps-script-complete.gs), tracking
-- the last-assigned number.
-- =========================================================
create table public.id_counters (
  prefix      text primary key,
  last_number integer not null default 0
);

-- Atomic, collision-proof ID generation: the UPDATE locks just the one
-- prefix's row for the transaction, so two concurrent CREATE_TASK calls can
-- never be handed the same number — even under real concurrency, and even
-- across different department prefixes (unlike the Apps Script version's
-- single global LockService lock, this only blocks other inserts for the
-- SAME prefix). This is the Postgres-native fix for the exact ID-collision
-- bug class the Apps Script IDCounters sheet suffered from (see
-- resyncIdCountersFromSheet_ in scripts/apps-script-complete.gs) — it is
-- structurally impossible for this counter to desync from actual data the
-- way the Sheets version did, since every CREATE_TASK must go through it.
create or replace function public.get_next_task_id(dept_prefix text)
returns text
language plpgsql
as $$
declare
  next_num integer;
begin
  insert into public.id_counters (prefix, last_number)
  values (dept_prefix, 0)
  on conflict (prefix) do nothing;

  update public.id_counters
     set last_number = last_number + 1
   where prefix = dept_prefix
  returning last_number into next_num;

  return dept_prefix || '-' || next_num;
end;
$$;

-- =========================================================
-- Row Level Security
-- =========================================================
-- Enabled but fully permissive. This matches — does not regress from —
-- today's trust model: the Apps Script Web App is a public, unauthenticated
-- endpoint; every action (CREATE_TASK, CREATE_USER, ...) is frontend-gated
-- only via can()/isDeptInScope() in src/utils/auth.ts, with zero
-- server-side authorization. The browser talks to Supabase directly using
-- the anon key (auth stays custom, not Supabase Auth — see plan), so there
-- is no auth.uid() to key real policies off of yet. A real fix (Supabase
-- Edge Functions verifying a session token server-side) is a separate,
-- later phase, only worth doing once Sheets is actually retired.
alter table public.tasks enable row level security;
alter table public.users enable row level security;
alter table public.supervisors enable row level security;
alter table public.id_counters enable row level security;

create policy "tasks_anon_all" on public.tasks
  for all using (true) with check (true);
create policy "users_anon_all" on public.users
  for all using (true) with check (true);
create policy "supervisors_anon_all" on public.supervisors
  for all using (true) with check (true);
create policy "id_counters_anon_all" on public.id_counters
  for all using (true) with check (true);

-- =========================================================
-- Realtime — tasks only. users/supervisors are low-frequency, admin-only,
-- and their management modals already refetch on their own open/change
-- callback, so there's no need to widen the realtime merge-logic surface
-- for them until there's an actual complaint.
-- =========================================================
alter publication supabase_realtime add table public.tasks;

-- =========================================================
-- Storage — task photos (replaces Google Drive as the upload target)
-- =========================================================
insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', true)
on conflict (id) do nothing;

create policy "task_photos_public_read" on storage.objects
  for select using (bucket_id = 'task-photos');
create policy "task_photos_anon_write" on storage.objects
  for insert with check (bucket_id = 'task-photos');
