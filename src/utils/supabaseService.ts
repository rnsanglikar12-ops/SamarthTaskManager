import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { ActionItem } from '../types';

// Same exported names/signatures as googleSheetsService.ts on purpose — see
// src/utils/dataService.ts, which selects between the two at build time via
// VITE_BACKEND_PROVIDER. Renaming the "GoogleSheet"-flavored names is
// deferred until Sheets is actually retired; doing it now, while Sheets
// stays the production default, is pure churn.

const LAST_SYNC_KEY = 'samarth_supabase_last_sync';

function getSupabaseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string) || '';
}

function getSupabaseAnonKey(): string {
  return (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';
}

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error('Supabase URL/anon key are not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }
  cachedClient = createClient(url, key);
  return cachedClient;
}

export function getGoogleSheetUrl(): string {
  return getSupabaseUrl();
}

// No UI caller sets this at runtime today (Supabase config is a build-time
// env var, not a user-entered URL) — kept as a no-op purely for interface
// parity with googleSheetsService.ts.
export function setGoogleSheetUrl(_url: string): void {}

export function isGoogleSheetConnected(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export function getLastSyncTime(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_SYNC_KEY);
}

function updateLastSyncTime(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_SYNC_KEY, new Date().toLocaleString());
}

// Copied verbatim from DEPT_PREFIXES in scripts/apps-script-complete.gs so
// ID generation stays byte-identical across both backends. Keep these two
// in sync by hand if a department is ever renamed/added.
const DEPT_PREFIXES: Record<string, string> = {
  'MD': 'MD',
  'Plant Head': 'PH',
  'PDC': 'PDC',
  'Die Maint': 'DM',
  'SPM': 'SPM',
  'Fettling': 'FTL',
  'Machine shop-01': 'MS1',
  'Machine shop-02': 'MS2',
  'PPC': 'PPC',
  'Store': 'STR',
  'MC Maint': 'MCM',
  'Quality': 'QA',
  'NPD': 'NPD',
  'Tool Room': 'TR',
  'HR': 'HR',
  'Account': 'ACC',
  'Purchase': 'PUR',
  'All Departments': 'ALL'
};

function getDeptPrefix(dept: string): string {
  if (DEPT_PREFIXES[dept]) return DEPT_PREFIXES[dept];
  const cleaned = String(dept || 'GEN').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return cleaned.slice(0, 4) || 'GEN';
}

// Ported verbatim from parseDepartments_/joinDepartments_ in
// scripts/apps-script-complete.gs — the `departments` column is a
// comma-separated string; empty/blank means plant-wide (null).
function parseDepartments(raw: string | null | undefined): string[] | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const list = trimmed.split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list : null;
}

function joinDepartments(departments: string[] | null | undefined): string {
  if (!departments || !departments.length) return '';
  return departments.join(',');
}

interface TaskRow {
  id: string;
  priority: string;
  recurrence: string;
  dept: string;
  description: string;
  owner: string;
  deadline: string;
  evidence: string;
  status: string;
  action_notes: string;
  attached_photo: string | null;
  timestamp: string;
  originator_dept: string;
  after_photo: string | null;
  is_kaizen: boolean;
  kaizen_benefit: string | null;
  is_broadcast: boolean;
  category: string | null;
  is_mom: boolean;
  is_cft: boolean;
  machine_note: string | null;
  updated_at?: string;
}

function rowToActionItem(row: TaskRow): ActionItem {
  return {
    id: row.id,
    priority: row.priority as ActionItem['priority'],
    recurrence: row.recurrence as ActionItem['recurrence'],
    dept: row.dept,
    desc: row.description,
    owner: row.owner,
    deadline: row.deadline,
    evidence: row.evidence,
    status: row.status as ActionItem['status'],
    actionNotes: row.action_notes,
    attachedPhoto: row.attached_photo || undefined,
    timestamp: row.timestamp,
    originatorDept: row.originator_dept,
    afterPhoto: row.after_photo || undefined,
    isKaizen: row.is_kaizen,
    kaizenBenefit: row.kaizen_benefit || undefined,
    isBroadcast: row.is_broadcast,
    category: row.category || undefined,
    isMOM: row.is_mom,
    isCFT: row.is_cft,
    machineNote: row.machine_note || undefined,
    closedAt: row.status === 'Completed' ? row.updated_at : undefined
  };
}

function actionToRow(action: Omit<ActionItem, 'id'> & { id?: string }): Omit<TaskRow, 'id'> {
  return {
    priority: action.priority,
    recurrence: action.recurrence,
    dept: action.dept,
    description: action.desc,
    owner: action.owner,
    deadline: action.deadline,
    evidence: action.evidence,
    status: action.status,
    action_notes: action.actionNotes,
    attached_photo: action.attachedPhoto || null,
    timestamp: action.timestamp,
    originator_dept: action.originatorDept,
    after_photo: action.afterPhoto || null,
    is_kaizen: Boolean(action.isKaizen),
    kaizen_benefit: action.kaizenBenefit || null,
    is_broadcast: Boolean(action.isBroadcast),
    category: action.category || null,
    is_mom: Boolean(action.isMOM),
    is_cft: Boolean(action.isCFT),
    machine_note: action.machineNote || null
  };
}

// PostgREST caps any single response at the project's db-max-rows setting
// (1000 by default), so a plain select silently truncates once the tasks
// table grows past that — page through with .range() until a page comes
// back short, rather than depend on that config never mattering.
export async function fetchActionsFromGoogleSheet(): Promise<ActionItem[]> {
  const PAGE_SIZE = 1000;
  const rows: TaskRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await getClient()
      .from('tasks')
      .select('*')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to fetch tasks from Supabase: ${error.message}`);
    rows.push(...(data as TaskRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  updateLastSyncTime();
  return rows.map(rowToActionItem);
}

export interface PhotoDriveLinks {
  attachedPhotoDriveLink?: string;
  afterPhotoDriveLink?: string;
}

// Compliance-export support (see src/utils/driveArchive.ts): a photo only
// needs to be copied into Drive once, so the export flow checks this cache
// before archiving anything, and writes back through savePhotoDriveLinks
// after a fresh archive. Deliberately a separate narrow query, not part of
// fetchActionsFromGoogleSheet/ActionItem — Drive archival is purely an
// export-time concern, the rest of the app never needs these fields.
export async function fetchPhotoDriveLinks(): Promise<Record<string, PhotoDriveLinks>> {
  const { data, error } = await getClient()
    .from('tasks')
    .select('id, attached_photo_drive_link, after_photo_drive_link');
  if (error) throw new Error(`Failed to fetch cached Drive links: ${error.message}`);
  const result: Record<string, PhotoDriveLinks> = {};
  for (const row of data) {
    result[row.id] = {
      attachedPhotoDriveLink: row.attached_photo_drive_link || undefined,
      afterPhotoDriveLink: row.after_photo_drive_link || undefined
    };
  }
  return result;
}

export async function savePhotoDriveLinks(
  updates: { id: string; attachedPhotoDriveLink?: string; afterPhotoDriveLink?: string }[]
): Promise<void> {
  await Promise.all(
    updates.map(u => {
      const patch: Record<string, string> = {};
      if (u.attachedPhotoDriveLink) patch.attached_photo_drive_link = u.attachedPhotoDriveLink;
      if (u.afterPhotoDriveLink) patch.after_photo_drive_link = u.afterPhotoDriveLink;
      return getClient().from('tasks').update(patch).eq('id', u.id);
    })
  );
}

interface PhotoLinks {
  attachedPhoto?: string;
  afterPhoto?: string;
}

export async function uploadPhotoToGoogleSheet(base64: string, filename?: string): Promise<string | null> {
  if (!isGoogleSheetConnected()) return null;
  try {
    const match = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      console.warn('uploadPhotoToGoogleSheet (Supabase): unexpected base64 format');
      return null;
    }
    const contentType = match[1];
    const raw = atob(match[2]);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const path = `${Date.now()}_${filename || 'photo.jpg'}`.replace(/[^a-zA-Z0-9._-]/g, '_');
    const { error } = await getClient().storage.from('task-photos').upload(path, bytes, { contentType });
    if (error) {
      console.warn('Supabase Storage rejected the photo upload:', error.message);
      return null;
    }
    const { data } = getClient().storage.from('task-photos').getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn('Failed to upload photo to Supabase Storage:', err);
    return null;
  }
}

export async function updateActionInGoogleSheet(action: ActionItem): Promise<PhotoLinks | null> {
  if (!isGoogleSheetConnected()) return null;
  try {
    const { error } = await getClient().from('tasks').update(actionToRow(action)).eq('id', action.id);
    if (error) {
      console.warn('Supabase rejected the task update:', error.message);
      return null;
    }
    updateLastSyncTime();
    return { attachedPhoto: action.attachedPhoto, afterPhoto: action.afterPhoto };
  } catch (err) {
    console.warn('Failed to update task in Supabase:', err);
    return null;
  }
}

export async function createActionInGoogleSheet(action: Omit<ActionItem, 'id'>): Promise<(PhotoLinks & { id: string }) | null> {
  if (!isGoogleSheetConnected()) return null;
  try {
    const prefix = getDeptPrefix(action.dept);
    const { data: idData, error: idError } = await getClient().rpc('get_next_task_id', { dept_prefix: prefix });
    if (idError || !idData) {
      console.warn('Supabase failed to assign a task ID:', idError?.message);
      return null;
    }
    const id = String(idData);
    const { error: insertError } = await getClient().from('tasks').insert({ id, ...actionToRow(action) });
    if (insertError) {
      console.warn('Supabase rejected the task creation:', insertError.message);
      return null;
    }
    updateLastSyncTime();
    return { id, attachedPhoto: action.attachedPhoto, afterPhoto: action.afterPhoto };
  } catch (err) {
    console.warn('Failed to create task in Supabase:', err);
    return null;
  }
}

export async function deleteActionInGoogleSheet(id: string): Promise<boolean> {
  if (!isGoogleSheetConnected()) return false;
  try {
    const { error } = await getClient().from('tasks').delete().eq('id', id);
    if (error) {
      console.warn('Failed to delete task in Supabase:', error.message);
      return false;
    }
    updateLastSyncTime();
    return true;
  } catch (err) {
    console.warn('Failed to delete task in Supabase:', err);
    return false;
  }
}

// Admin-only compliance cleanup: permanently removes every Completed task
// created (timestamp) before the given date. `cutoffDate` is a plain
// 'YYYY-MM-DD' string — lexicographic comparison against the stored ISO
// timestamp string correctly implements "before this calendar date"
// (exclusive) with no date parsing needed, same as every other date
// comparison in this app (see getTodayStr() in sentinelDataLoader.ts).
export async function deleteCompletedTasksBefore(cutoffDate: string): Promise<number> {
  const { data, error } = await getClient()
    .from('tasks')
    .delete()
    .eq('status', 'Completed')
    .lt('timestamp', cutoffDate)
    .select('id');
  if (error) throw new Error(`Failed to bulk-delete completed tasks: ${error.message}`);
  return data.length;
}

// Not wired to any UI today (matches googleSheetsService.ts) — kept for
// interface parity only.
export async function clearAllTasksInGoogleSheet(): Promise<boolean> {
  if (!isGoogleSheetConnected()) return false;
  const { error } = await getClient().from('tasks').delete().neq('id', '');
  if (error) return false;
  const { error: counterError } = await getClient().from('id_counters').delete().neq('prefix', '');
  return !counterError;
}

export async function pushAllActionsToGoogleSheet(actions: ActionItem[]): Promise<boolean> {
  if (!isGoogleSheetConnected()) {
    throw new Error('Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }
  const rows = actions.map(a => ({ id: a.id, ...actionToRow(a) }));
  const { error } = await getClient().from('tasks').insert(rows);
  updateLastSyncTime();
  return !error;
}

export async function loginUser(
  username: string,
  passwordHash: string
): Promise<{ username: string; displayName: string; role: string; departments: string[] | null; mustChangePassword: boolean } | null> {
  if (!isGoogleSheetConnected()) throw new Error('Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  const { data, error } = await getClient()
    .from('users')
    .select('username, display_name, role, departments, must_change_password, password_hash')
    .ilike('username', username)
    .maybeSingle();
  if (error || !data || data.password_hash !== passwordHash) return null;
  return {
    username: data.username,
    displayName: data.display_name,
    role: data.role,
    departments: parseDepartments(data.departments),
    mustChangePassword: data.must_change_password
  };
}

export interface AppsScriptUserRecord {
  username: string;
  displayName: string;
  role: string;
  departments: string[] | null;
  mustChangePassword: boolean;
  createdAt: string;
}

export async function fetchUsers(): Promise<AppsScriptUserRecord[]> {
  // password_hash deliberately excluded — mirrors doFetchUsers()'s
  // includeHash=false behavior in the Apps Script backend.
  const { data, error } = await getClient()
    .from('users')
    .select('username, display_name, role, departments, must_change_password, created_at');
  if (error) throw new Error(`Failed to fetch users from Supabase: ${error.message}`);
  return data.map(row => ({
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    departments: parseDepartments(row.departments),
    mustChangePassword: row.must_change_password,
    createdAt: row.created_at
  }));
}

export async function createUser(user: {
  username: string;
  displayName: string;
  passwordHash: string;
  role: string;
  departments: string[] | null;
}): Promise<boolean> {
  const { error } = await getClient().from('users').insert({
    username: user.username,
    display_name: user.displayName,
    password_hash: user.passwordHash,
    role: user.role,
    departments: joinDepartments(user.departments),
    must_change_password: true
  });
  return !error;
}

export async function updateUser(user: {
  username: string;
  displayName?: string;
  role?: string;
  departments?: string[] | null;
}): Promise<boolean> {
  const patch: Record<string, unknown> = {};
  if (user.displayName !== undefined) patch.display_name = user.displayName;
  if (user.role !== undefined) patch.role = user.role;
  if (user.departments !== undefined) patch.departments = joinDepartments(user.departments);
  const { error } = await getClient().from('users').update(patch).eq('username', user.username);
  return !error;
}

export async function deleteUser(username: string): Promise<boolean> {
  const { error } = await getClient().from('users').delete().eq('username', username);
  return !error;
}

export async function changePassword(
  username: string,
  newPasswordHash: string,
  forceChangeOnNextLogin = false
): Promise<boolean> {
  const { error } = await getClient()
    .from('users')
    .update({ password_hash: newPasswordHash, must_change_password: forceChangeOnNextLogin })
    .eq('username', username);
  return !error;
}

export interface Supervisor {
  name: string;
  dept: string;
}

export async function fetchSupervisors(): Promise<Supervisor[]> {
  const { data, error } = await getClient().from('supervisors').select('name, dept');
  if (error) throw new Error(`Failed to fetch supervisors from Supabase: ${error.message}`);
  return data;
}

export async function createSupervisor(supervisor: Supervisor): Promise<{ success: boolean; message?: string }> {
  const name = supervisor.name.trim();
  const dept = supervisor.dept.trim();
  if (!name || !dept) return { success: false, message: 'Name and department are required' };

  const { data: existing } = await getClient()
    .from('supervisors')
    .select('name')
    .ilike('name', name)
    .ilike('dept', dept)
    .maybeSingle();
  if (existing) return { success: false, message: 'This supervisor already exists in this department' };

  const { error } = await getClient().from('supervisors').insert({ name, dept });
  return { success: !error, message: error?.message };
}

export async function deleteSupervisor(supervisor: Supervisor): Promise<boolean> {
  const { error } = await getClient()
    .from('supervisors')
    .delete()
    .eq('name', supervisor.name)
    .eq('dept', supervisor.dept);
  return !error;
}

export type TaskChangeEvent =
  | { type: 'INSERT' | 'UPDATE'; row: ActionItem }
  | { type: 'DELETE'; row: { id: string } };

// The one genuinely new capability this backend adds: live push of task
// changes to every connected client, replacing the Sheets path's
// manual-Refresh-only model. googleSheetsService.ts exports a no-op stub of
// the same signature so App.tsx can call this unconditionally when wired.
export function subscribeToTaskChanges(onChange: (event: TaskChangeEvent) => void): () => void {
  if (!isGoogleSheetConnected()) return () => {};

  let channel: RealtimeChannel | null = getClient()
    .channel('tasks-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          onChange({ type: payload.eventType, row: rowToActionItem(payload.new as TaskRow) });
        } else if (payload.eventType === 'DELETE') {
          onChange({ type: 'DELETE', row: { id: (payload.old as Partial<TaskRow>).id as string } });
        }
      }
    )
    .subscribe();

  return () => {
    if (channel) {
      getClient().removeChannel(channel);
      channel = null;
    }
  };
}
