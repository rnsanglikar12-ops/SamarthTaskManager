#!/usr/bin/env node
// =========================================================================
// One-off migration: live Apps Script backend -> a fresh Supabase project.
//
// !!! HARD PREREQUISITE — READ BEFORE RUNNING !!!
// The `ADMIN_FIX_INTEGRITY` repair (deployed to the Apps Script backend
// this session, see scripts/apps-script-complete.gs) must have already been
// run against production and confirmed clean (no duplicate task IDs, no
// desynced counters) BEFORE this script runs. Migrating before that repair
// carries the duplicate-ID corruption into Supabase, where there is no
// equivalent repair tooling yet. If you have not run and confirmed that fix,
// stop now.
//
// This script is meant to be run by a human, not an agent — it needs a
// Supabase SERVICE ROLE key (bypasses Row Level Security), which must never
// be committed to git, shipped to the frontend, or pasted anywhere public.
//
// Usage:
//   SOURCE_APPS_SCRIPT_URL="https://script.google.com/macros/s/.../exec" \
//   SUPABASE_URL="https://xxxx.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="ey..." \
//   USERS_CSV_PATH="./Users.csv" \
//   node scripts/migrate-to-supabase.mjs [--force]
//
// USERS_CSV_PATH: FETCH_USERS deliberately never returns password hashes
// (see includeHash=false in doFetchUsers(), scripts/apps-script-complete.gs)
// so passwords can't be migrated over that endpoint. Export the Users sheet
// tab directly instead: Google Sheets -> File -> Download -> Comma
// Separated Values (.csv), for just that tab. Expected columns, in order,
// matching USERS_HEADERS in the Apps Script:
//   username, displayName, passwordHash, role, department, mustChangePassword, createdAt
//
// --force: skip the "target tables must be empty" safety check, for a
// deliberate re-migration during testing. Without it, the script refuses to
// run if tasks/users/supervisors already have rows.
// =========================================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const FORCE = process.argv.includes('--force');

const SOURCE_APPS_SCRIPT_URL = process.env.SOURCE_APPS_SCRIPT_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USERS_CSV_PATH = process.env.USERS_CSV_PATH;

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}
requireEnv('SOURCE_APPS_SCRIPT_URL', SOURCE_APPS_SCRIPT_URL);
requireEnv('SUPABASE_URL', SUPABASE_URL);
requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY);
requireEnv('USERS_CSV_PATH', USERS_CSV_PATH);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: HTTP ${res.status}`);
  return res.json();
}

// Minimal CSV parser: handles quoted fields containing commas/newlines, no
// external dependency needed for a single small export file.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function checkTargetsEmpty() {
  if (FORCE) return;
  for (const table of ['tasks', 'users', 'supervisors']) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`Could not check ${table}: ${error.message}`);
    if (count && count > 0) {
      console.error(`Refusing to run: table "${table}" already has ${count} row(s). Pass --force to override.`);
      process.exit(1);
    }
  }
}

async function migrateTasks() {
  console.log('Fetching tasks from Apps Script (FETCH_ALL)...');
  const data = await fetchJson(`${SOURCE_APPS_SCRIPT_URL}?action=FETCH_ALL&_t=${Date.now()}`);
  const records = data.records || [];
  console.log(`  ${records.length} tasks fetched.`);

  const rows = records.map(r => ({
    id: String(r.id),
    priority: r.priority || 'B',
    recurrence: r.recurrence || 'One-Time',
    dept: r.dept || '',
    description: r.description ?? r.desc ?? '',
    owner: r.owner || '',
    deadline: r.targetDate ?? r.deadline ?? '',
    evidence: r.evidence || '',
    status: r.status || 'Pending',
    action_notes: r.actionNotes || '',
    attached_photo: r.attachedPhoto || null,
    timestamp: r.lastUpdated ?? r.timestamp ?? '',
    originator_dept: r.originatorDept || '',
    after_photo: r.afterPhoto || null,
    is_kaizen: Boolean(r.isKaizen),
    kaizen_benefit: r.kaizenBenefit || null,
    is_broadcast: Boolean(r.isBroadcast),
    category: r.category || null,
    is_mom: Boolean(r.isMOM),
    is_cft: Boolean(r.isCFT),
    machine_note: r.machineNote || null
  }));

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('tasks').insert(batch);
    if (error) throw new Error(`Failed inserting tasks batch at offset ${i}: ${error.message}`);
    console.log(`  inserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  return rows;
}

async function migrateSupervisors() {
  console.log('Fetching supervisors from Apps Script (FETCH_SUPERVISORS)...');
  const data = await fetchJson(`${SOURCE_APPS_SCRIPT_URL}?action=FETCH_SUPERVISORS&_t=${Date.now()}`);
  const supervisors = data.supervisors || [];
  console.log(`  ${supervisors.length} supervisors fetched.`);
  if (supervisors.length === 0) return supervisors;

  const { error } = await supabase.from('supervisors').insert(supervisors);
  if (error) throw new Error(`Failed inserting supervisors: ${error.message}`);
  return supervisors;
}

async function migrateUsers() {
  console.log(`Reading users from CSV: ${USERS_CSV_PATH}`);
  const text = readFileSync(USERS_CSV_PATH, 'utf-8');
  const rows = parseCsv(text);
  const [header, ...dataRows] = rows;
  const expected = ['username', 'displayName', 'passwordHash', 'role', 'department', 'mustChangePassword', 'createdAt'];
  const headerLower = header.map(h => h.trim());
  for (const col of expected) {
    if (!headerLower.includes(col)) {
      throw new Error(`Users CSV is missing expected column "${col}". Found columns: ${headerLower.join(', ')}`);
    }
  }
  const idx = Object.fromEntries(expected.map(c => [c, headerLower.indexOf(c)]));

  const users = dataRows
    .filter(r => r[idx.username])
    .map(r => ({
      username: r[idx.username],
      display_name: r[idx.displayName],
      password_hash: r[idx.passwordHash],
      role: r[idx.role],
      departments: r[idx.department] || '',
      must_change_password: String(r[idx.mustChangePassword]).toUpperCase() === 'TRUE'
    }));

  console.log(`  ${users.length} users parsed.`);
  if (users.length === 0) return users;

  const { error } = await supabase.from('users').insert(users);
  if (error) throw new Error(`Failed inserting users: ${error.message}`);
  return users;
}

async function seedIdCounters(taskRows) {
  console.log('Seeding id_counters from true max ID per prefix...');
  const maxPerPrefix = {};
  for (const row of taskRows) {
    const m = String(row.id).match(/^([A-Za-z]+)-(\d+)$/);
    if (!m) continue;
    const prefix = m[1];
    const num = parseInt(m[2], 10);
    if (!maxPerPrefix[prefix] || num > maxPerPrefix[prefix]) maxPerPrefix[prefix] = num;
  }
  const counterRows = Object.entries(maxPerPrefix).map(([prefix, last_number]) => ({ prefix, last_number }));
  if (counterRows.length === 0) {
    console.log('  no task IDs matched the dept-prefix pattern, nothing to seed.');
    return;
  }
  const { error } = await supabase.from('id_counters').insert(counterRows);
  if (error) throw new Error(`Failed seeding id_counters: ${error.message}`);
  console.log(`  seeded ${counterRows.length} prefix counters:`, maxPerPrefix);
}

async function main() {
  console.log('=== Migrating Google Sheets -> Supabase ===');
  console.log('Reminder: this must only run AFTER ADMIN_FIX_INTEGRITY has been executed and confirmed clean.\n');

  await checkTargetsEmpty();

  const taskRows = await migrateTasks();
  const supervisors = await migrateSupervisors();
  const users = await migrateUsers();
  await seedIdCounters(taskRows);

  console.log('\n=== Summary ===');
  console.log(`tasks:       ${taskRows.length}`);
  console.log(`supervisors: ${supervisors.length}`);
  console.log(`users:       ${users.length}`);
  console.log('\nDone. Spot-check counts against the live Sheet before flipping VITE_BACKEND_PROVIDER in production.');
}

main().catch(err => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
