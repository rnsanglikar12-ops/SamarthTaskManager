# Samarth Industries — Operational Excellence Platform

Context document for onboarding a new AI session (or a new developer) onto this
project. Written from the state of the project as of 2026-09-15.

## 1. What this is

A task/action-item tracking platform for a manufacturing plant (Samarth
Industries), covering:

- **Master Matrix**: the core action-item register (5W1H abnormalities /
  directives), scoped by department, priority, status, owner, deadline.
- **Saturday MOM**: weekly Minutes-of-Meeting action items (a filtered view
  of the same action items, flagged `isMOM`).
- **Recurring PM**: preventive-maintenance tasks with a recurrence frequency
  (Daily / Weekly / One-Time).
- **CFT Handshake**: cross-functional-team tasks — items where the
  "Originating Department" differs from the "Responsible Department" (one
  dept raising an issue against another).
- **Kaizen / DSI**: continuous-improvement items flagged `isKaizen`, with
  before/after photo evidence requirements.
- **Dept Leaders & 4-V**: a department directory + velocity/visual
  management view.
- **AI Advisor**: a canned/templated CAPA & root-cause advisor for common
  shopfloor abnormalities (PDC porosity, tap breakage, hole shift, etc.).
  **Not a live LLM integration** — `generateExpertResponse()` in
  `src/components/AIAdvisorView.tsx` is a local rule-based text generator,
  no external API calls, no API key.

There is no separate staging environment — one Cloudflare Pages deployment,
one Supabase (Postgres) project, used directly by the plant.

## 2. Tech stack

- **Frontend**: React 19 + TypeScript, Vite 6 build, Tailwind CSS v4
  (`@tailwindcss/vite` plugin, no separate config file — utility classes
  only), `lucide-react` icons, `recharts` for charts.
- **Backend**: Supabase (Postgres), accessed directly from the browser via
  `@supabase/supabase-js` and the anon/publishable key. No custom API
  server — `src/utils/supabaseService.ts` talks straight to the database
  (`tasks`, `users`, `supervisors`, `id_counters` tables + a
  `get_next_task_id()` SQL function), with Row Level Security enabled but
  fully permissive (auth stays custom/app-level, not Supabase Auth — see
  §5). Realtime (`postgres_changes` on `tasks`) pushes live updates to every
  connected client. Photos go to a public `task-photos` Storage bucket.
  Schema lives in `supabase/migrations/0001_init.sql`.
- **Hosting**: Cloudflare Pages, static SPA build (`dist/`), deployed via
  `wrangler`.
- **PWA**: installable to a phone home screen (manifest + icons + a
  no-op pass-through service worker — no offline caching, since the app's
  entire value is live data and a caching SW would risk showing stale
  tasks).

### Deprecated: Google Apps Script + Sheets backend

The app originally ran on a Google Apps Script Web App bound to a Google
Sheet. That backend is **deprecated as of the Supabase cutover** — the app
no longer reads from or writes to it. The implementation is left in place,
untouched and unused, purely as a dormant reference:
`src/utils/googleSheetsService.ts`, `scripts/apps-script-complete.gs`,
`scripts/clasp-project/`. It receives no further maintenance and none of
the deploy/config instructions below apply to it.

## 3. Repository layout

```
src/
  App.tsx                    — top-level state, routing between tabs, session gating
  types.ts                   — ActionItem, DepartmentStructure, FilterState, OperationalStats
  main.tsx                   — React root + service worker registration
  components/
    LoginScreen.tsx           — username/password login screen
    Header.tsx                 — nav tabs, dept-scope selector, user menu, mobile drawer
    ActionRegisterView.tsx     — Master Matrix table (search/filter/sort/paginate)
    ActionDetailModal.tsx      — view/edit a single action item, photo upload, Kaizen checkbox
    NewActionModal.tsx         — create-task form (incl. broadcast-to-all-departments)
    KaizenHubView.tsx          — Kaizen/DSI tab
    DepartmentDirectoryView.tsx— Dept Leaders & 4-V tab
    AnalyticsView.tsx          — charts (priority pie, dept velocity, etc.), lazy-loaded
    StatsOverview.tsx          — Cockpit tab KPI cards
    AIAdvisorView.tsx          — templated CAPA advisor (see above)
    UserManagementModal.tsx    — Admin: create/edit/delete login accounts
    SupervisorManagementModal.tsx — Admin/PlantHead/MD/DeptHead: manage name-only supervisors
    ChangePasswordModal.tsx    — self-service password change
    BulkDeleteCompletedModal.tsx — Admin: permanently delete Completed tasks before a date
    OnePointSheetModal.tsx     — printable Kaizen One-Point-Lesson sheet
  utils/
    auth.ts                    — Role/Permission model, can(), session storage, password hashing
    dataService.ts              — the data-access entry point every call site imports from
    supabaseService.ts          — the active backend implementation (Supabase)
    googleSheetsService.ts     — deprecated/dormant backend implementation (see §2)
    imageUtils.ts               — client-side photo compression before upload
    syncService.ts             — cross-tab sync via BroadcastChannel (no network)
    exportUtils.ts              — CSV export of the action register (also used for compliance export)
  data/
    orgStructure.ts             — department list, dept heads, supervisors, assignee helpers
    sentinelDataLoader.ts       — local-storage cache helpers, isKaizenAction(), isRaisedToOtherDept()
supabase/
  migrations/0001_init.sql      — schema: tasks, users, supervisors, id_counters, RLS, Realtime, Storage
scripts/
  migrate-to-supabase.mjs       — one-off Sheets→Supabase data migration (user-run, needs service role key)
  apps-script-complete.gs       — deprecated backend source (dormant, see §2)
  clasp-project/                — deprecated clasp-linked copy of the same script
worker/
  (deprecated, undeployed Cloudflare Worker that proxied Sheets/Drive — superseded by Supabase, not used)
public/
  manifest.webmanifest, icon-*.png, apple-touch-icon.png, sw.js
```

## 4. Data model

`ActionItem` (`src/types.ts`) is the single record type for every task
across every tab (Master Matrix, MOM, Recurring PM, CFT, Kaizen — they're
all the same underlying record, distinguished by flags/fields), backed by
the Supabase `tasks` table:

- `id: string` — department-prefixed, server-assigned via the Postgres
  `get_next_task_id(dept_prefix)` function (e.g. `"PDC-47"`), which
  row-locks just that one prefix's counter — collision-proof even under
  concurrent creates, and unaffected by contention on other departments.
- `dept` / `originatorDept` — responsible dept vs. dept that raised it.
  When they differ, the task shows up in CFT Handshake. A **broadcast**
  task (`isBroadcast: true`) is fanned out into one real row per
  department (see `handleAddAction` in `App.tsx`) rather than a single
  fake "All Departments" row, so every department can track its own copy.
- `priority: 'A' | 'B'`, `status`, `recurrence`, `deadline`, `owner`.
- `attachedPhoto?` / `afterPhoto?` — public Supabase Storage URLs
  (`task-photos` bucket), not base64 once persisted.
- `isKaizen`, `isMOM`, `isBroadcast`, `kaizenBenefit` — tab/behavior flags.
- `deadline` / `timestamp` are stored as plain text (`'YYYY-MM-DD'` /
  ISO string), not SQL `date`/`timestamptz` — deliberate, to avoid
  reintroducing an IST/UTC timezone bug the app already hit once (see
  `getTodayStr()` in `sentinelDataLoader.ts`, and the schema comments in
  `supabase/migrations/0001_init.sql`).

## 5. Auth & RBAC (`src/utils/auth.ts`)

Custom username/password auth against the Supabase `users` table (not
Supabase Auth, not Google OAuth — plant staff log in with app-issued
credentials, SHA-256 hashed client-side, unsalted, before ever leaving the
browser). This is a known, accepted limitation carried over unchanged from
the original design — not a regression from the Supabase cutover.

- **Roles**: `Viewer`, `DeptHead`, `PlantHead`, `MD`, `Admin` — each maps to
  a fixed permission set in `ROLE_PERMISSIONS`. `exportData` (CSV export)
  is granted to Admin/PlantHead/MD; `bulkDeleteCompleted` (delete Completed
  tasks before a date) is Admin-only.
- **`departments: string[] | null`** on every user — `null` means
  plant-wide (PlantHead/MD/Admin see and can act on everything); a
  non-null array scopes a DeptHead/Viewer to one or more departments (one
  person can head multiple departments, e.g. a single manager over PDC +
  Die Maint + SPM + Fettling). Stored in the `users` table as a
  comma-joined string, converted to/from `string[]` at the service-layer
  boundary (`supabaseService.ts`).
- **`isDeptInScope()`** — a task is in scope for a user if either its
  `dept` or its `originatorDept` matches one of the user's departments, so
  a DeptHead never loses visibility into CFT tasks their own department
  raised elsewhere.
- Session is stored in `sessionStorage` (cleared on tab close), not
  `localStorage`.

## 6. Backend: Supabase

- **Tables** (`supabase/migrations/0001_init.sql`):
  - `tasks` — one row per `ActionItem`, see §4.
  - `users` — `username` (PK), `display_name`, `password_hash`, `role`,
    `departments` (comma-joined string), `must_change_password`,
    `created_at`.
  - `supervisors` — `(name, dept)` composite PK, no login of their own;
    purely populate the Assignee dropdown.
  - `id_counters` — `(prefix, last_number)`, backing `get_next_task_id()`.
- **RLS**: enabled on every table, fully permissive (`using (true)`). This
  matches the trust model the app has always had — no server-side
  authorization, everything is frontend-gated via `can()`/
  `isDeptInScope()` — not a regression introduced by the cutover. A real
  fix (Edge Functions verifying a session token) would be a separate,
  later phase.
- **Realtime**: `tasks` is in the `supabase_realtime` publication.
  `subscribeToTaskChanges()` (`supabaseService.ts`) pushes INSERT/UPDATE/
  DELETE to every connected client, merged into local state the same way
  as the existing BroadcastChannel cross-tab sync.
- **Storage**: a public-read `task-photos` bucket. Selecting a photo is
  first downscaled/re-encoded client-side (`imageUtils.ts`'s
  `compressImage()`, max 1600px / JPEG quality 0.7, via a `<canvas>`), then
  uploaded immediately (not at task-save time) via `uploadPhotoToGoogleSheet`
  (legacy name, now Supabase-backed — see §2), returning a public URL that
  `CREATE_TASK`/`UPDATE_TASK`-equivalent calls carry like any other field.
- **No polling**: the client fetches once on page load and once per
  explicit Refresh click, plus live Realtime pushes for changes made by
  other clients. There is no background interval.

## 7. Frontend ↔ backend contract

All backend calls go through `src/utils/dataService.ts`, which re-exports
everything from `src/utils/supabaseService.ts` (the active implementation).
Call sites never import `supabaseService.ts` or the deprecated
`googleSheetsService.ts` directly. Function names still carry their
original "GoogleSheet"-flavored names (`fetchActionsFromGoogleSheet`,
`createActionInGoogleSheet`, `isGoogleSheetConnected`, etc.) even though
they're Supabase-backed now — renaming is deferred as a low-value cleanup
since it would touch every call site for no runtime benefit.

Config is resolved via `import.meta.env.VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` at build time (see `.env.example`). There is no
runtime/localStorage override for these — a build-time-only config, unlike
the old Sheets URL.

## 8. Accounts, hosting, and environment

- **Supabase project**: ref `akrkcyeivtpnqlowzsvb`
  (`https://akrkcyeivtpnqlowzsvb.supabase.co`). Managed via the Supabase
  MCP server (`.mcp.json`, project-scoped) for schema/data work — no local
  Supabase CLI project is set up.
- **Cloudflare Pages** project name: `samarth-task-manager`
  (`wrangler pages deploy dist --project-name=samarth-task-manager`).
  Production URL: `https://samarth-task-manager.pages.dev`. Cloudflare
  auth is via the `wrangler` CLI's own login state on this machine (not
  stored in the repo). `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are
  baked into the build at deploy time (via `.env.local`, gitignored) — this
  is a static SPA deploy (`npm run build` locally, then upload `dist/`),
  not a Cloudflare-side build, so the Pages dashboard's own env var UI does
  not apply.
- **GitHub**: `https://github.com/rnsanglikar12-ops/SamarthTaskManager.git`
  (remote `origin`, branch `main`).
- **Env vars**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (see
  `.env.example`). `.env*` (except `.env.example`) is gitignored.
- Deprecated Google account/Sheet/Apps Script deployment details have been
  removed from this doc — see git history if ever needed for reference.

## 9. Local development

```
npm install
npm run dev       # vite dev server
npm run lint       # tsc --noEmit (no separate test suite)
npm run build       # production build to dist/
npm run deploy       # build + wrangler pages deploy
```

There is no automated test suite — verification is: `npm run lint` (must
be clean) + manual browser testing (desktop + a 375×812 mobile viewport)
before every deploy.

## 10. Notable design decisions worth preserving

- **Refresh + Realtime, not polling**: the Refresh button and initial page
  load *read* from Supabase; nothing in the normal UI flow ever pushes the
  client's full local state back. Live updates from other clients arrive
  via Supabase Realtime, not a polling interval. Every mutation (create
  task, update task, change status, upload photo, user management) is an
  individual, explicit API call for that one record.
- **Server-assigned IDs**: task IDs are never generated client-side — the
  Postgres `get_next_task_id()` function increments a per-department
  counter under a row lock, so concurrent creates from different users
  can't collide.
- **Multi-department users**: `departments` is always an array (or `null`
  for plant-wide), even for a single-department user — treat it as a list
  everywhere, don't special-case length 1.
- **No offline caching**: the service worker exists purely to satisfy PWA
  installability requirements; it deliberately does not cache API
  responses or app data.
- **Broadcast tasks fan out per-department**: a broadcast task is *not* a
  single row with a placeholder department — it's one real row per
  department, each independently trackable (see §4).
