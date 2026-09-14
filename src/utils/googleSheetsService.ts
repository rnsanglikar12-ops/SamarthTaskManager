import { ActionItem } from '../types';

const STORAGE_KEY = 'samarth_google_sheet_url';
const LAST_SYNC_KEY = 'samarth_google_sheet_last_sync';

// Apps Script Web App latency is highly variable even for identical
// back-to-back requests (observed 2-33s, plus occasional transient 404s
// from Google's own routing layer before the script ever runs) — see
// PROJECT_CONTEXT.md. These give every request room to actually finish
// before we give up on it, and let us recover from routing-layer failures
// automatically instead of surfacing them as hard errors.
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 2; // additional attempts after the first
const RETRY_BACKOFF_MS = [1000, 2000];
// A plain HTTP 404 from script.google.com means the request never reached
// our doGet/doPost at all (the script itself always responds 200, even for
// internal errors) — safe to retry. 429/5xx are also assumed transient.
const RETRYABLE_STATUS = new Set([404, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface FetchRetryOptions {
  timeoutMs?: number;
  retries?: number;
  // Whether to retry a request that timed out client-side. Safe for
  // idempotent actions (reads, overwrites, deletes) where re-sending after
  // a timeout can't corrupt data. Left false for actions like CREATE_TASK /
  // UPLOAD_PHOTO where the first attempt may have already been processed
  // server-side (row appended / file created) and a blind retry could
  // create a duplicate — those should surface the timeout so the user
  // consciously decides to retry rather than risk a silent duplicate.
  retryOnTimeout?: boolean;
}

/**
 * fetch() with a per-attempt timeout and automatic retry on transient
 * failures (network errors, routing-layer 404s, 5xx). Returns the last
 * Response even if it ended up non-ok, so callers keep their existing
 * `!res.ok` handling unchanged.
 */
async function fetchWithRetry(url: string, init: RequestInit, opts: FetchRetryOptions = {}): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const retries = opts.retries ?? MAX_RETRIES;
  const retryOnTimeout = opts.retryOnTimeout ?? true;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const isLastAttempt = attempt === retries;
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (!isLastAttempt && RETRYABLE_STATUS.has(res.status)) {
        await sleep(RETRY_BACKOFF_MS[attempt] ?? 2000);
        continue;
      }
      return res;
    } catch (err: any) {
      clearTimeout(timer);
      const isTimeout = err?.name === 'AbortError';
      if (isLastAttempt || (isTimeout && !retryOnTimeout)) {
        throw isTimeout ? new Error('Google Sheet request timed out.') : err;
      }
      await sleep(RETRY_BACKOFF_MS[attempt] ?? 2000);
    }
  }
  // Unreachable, but keeps TypeScript happy.
  throw new Error('Google Sheet request failed.');
}

/**
 * Retrieve saved Google Apps Script Web App URL
 */
export function getGoogleSheetUrl(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem(STORAGE_KEY) ||
    (import.meta.env.VITE_GOOGLE_SHEET_WEBAPP_URL as string) ||
    ''
  );
}

/**
 * Save Google Apps Script Web App URL
 */
export function setGoogleSheetUrl(url: string): void {
  if (typeof window === 'undefined') return;
  if (!url || url.trim() === '') {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, url.trim());
  }
}

/**
 * Check whether a valid Google Sheet Web App URL is connected
 */
export function isGoogleSheetConnected(): boolean {
  const url = getGoogleSheetUrl();
  return Boolean(url && url.startsWith('https://script.google.com/macros/s/'));
}

/**
 * Get timestamp of last successful Google Sheet sync
 */
export function getLastSyncTime(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_SYNC_KEY);
}

function updateLastSyncTime(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_SYNC_KEY, new Date().toLocaleString());
}

/**
 * Helper to safely post to Google Apps Script Web App without CORS preflight issues
 * (Uses text/plain Content-Type which avoids browser OPTIONS preflight blocks)
 */
async function sendToAppsScript(payload: any, opts: FetchRetryOptions = {}): Promise<any> {
  const url = getGoogleSheetUrl();
  if (!url) throw new Error('Google Sheet Web App URL is not configured.');

  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  }, opts);

  if (!res.ok) {
    throw new Error(`Google Sheet request failed with HTTP ${res.status}`);
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { status: 'success', raw: text };
  }
}

/**
 * Fetch all tasks from connected Google Sheet
 */
export async function fetchActionsFromGoogleSheet(): Promise<ActionItem[]> {
  const url = getGoogleSheetUrl();
  if (!url) throw new Error('No Google Sheet Web App URL configured.');

  const res = await fetchWithRetry(`${url}?action=FETCH_ALL&_t=${Date.now()}`, {});
  if (!res.ok) {
    throw new Error(`Failed to fetch from Google Sheet: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data && Array.isArray(data.records)) {
    updateLastSyncTime();
    return data.records.map((r: any, idx: number) => ({
      id: String(r.id ?? r.ID ?? idx + 1),
      dept: String(r.dept || r.Department || 'Operations'),
      desc: String(r.desc || r.description || r.Description || ''),
      deadline: String(r.deadline || r.targetDate || r['Target Date'] || ''),
      status: (r.status || r.Status || 'Pending') as any,
      priority: (r.priority || r.Priority || 'B') as any,
      owner: String(r.owner || r.Owner || 'Assigned Lead'),
      originatorDept: String(r.originatorDept || r['Originator Dept'] || r.dept || 'Operations'),
      evidence: String(r.evidence || r.Evidence || 'Photo Proof'),
      actionNotes: String(r.actionNotes || r['Action Notes'] || ''),
      attachedPhoto: r.attachedPhoto || r['Problem Photo'] || r['Photo'] || undefined,
      afterPhoto: r.afterPhoto || r['After Photo (Evidence)'] || undefined,
      timestamp: String(r.timestamp || r['Timestamp'] || new Date().toISOString()),
      recurrence: (r.recurrence || r.Recurrence || 'One-Time') as any,
      isKaizen: Boolean(r.isKaizen ?? (r['Kaizen (DSI)'] === true || r['Kaizen (DSI)'] === 'TRUE' || r['Kaizen (DSI)'] === 'Yes')),
      kaizenBenefit: r.kaizenBenefit || r['Kaizen Benefit'] || undefined,
      isMOM: Boolean(r.isMOM ?? (r['Saturday MOM'] === true || r['Saturday MOM'] === 'TRUE' || r['Saturday MOM'] === 'Yes')),
      isCFT: Boolean(r.isCFT ?? (r['CFT Handshake'] === true || r['CFT Handshake'] === 'TRUE' || r['CFT Handshake'] === 'Yes')),
      machineNote: r.machineNote || r['Machine / Note'] || undefined,
      isBroadcast: Boolean(r.isBroadcast ?? (r['Broadcast'] === true || r['Broadcast'] === 'TRUE' || r['Broadcast'] === 'Yes'))
    }));
  }

  if (Array.isArray(data)) {
    updateLastSyncTime();
    return data;
  }

  throw new Error('Unexpected data format received from Google Sheet.');
}

/**
 * Translate an ActionItem into the field names the deployed Apps Script
 * actually expects (e.g. `desc` -> `description`, `deadline` -> `targetDate`).
 * The live sheet's CREATE_TASK/UPDATE_TASK handlers read these exact names —
 * sending the raw ActionItem field names silently produced blank cells.
 */
function toSheetTaskPayload(action: Omit<ActionItem, 'id'> & { id?: string }) {
  return {
    ...action,
    description: action.desc,
    targetDate: action.deadline
  };
}

// Photo fields the backend may hand back after converting a base64 upload
// into a Drive-hosted image link (see saveBase64ImageToDrive_ in the Apps
// Script). Callers should overwrite their local attachedPhoto/afterPhoto
// with these when present, instead of keeping the raw base64 they sent —
// otherwise the local cache keeps re-sending the same base64 blob on every
// later save (re-uploading duplicate Drive files each time).
interface PhotoLinks {
  attachedPhoto?: string;
  afterPhoto?: string;
}

/**
 * Upload a single photo to Drive immediately (at selection time, not at
 * task-save time) and return its Drive link. Keeping this as its own call
 * means CREATE_TASK/UPDATE_TASK never carry base64 image data — just the
 * short link string, like any other field, so a save is not blocked on
 * however long the photo takes to upload.
 */
export async function uploadPhotoToGoogleSheet(base64: string, filename?: string): Promise<string | null> {
  if (!isGoogleSheetConnected()) return null;
  try {
    // No retry on timeout: a slow UPLOAD_PHOTO may have already saved the
    // file to Drive server-side, and a blind retry would create a duplicate.
    const result = await sendToAppsScript({ action: 'UPLOAD_PHOTO', base64, filename }, { retryOnTimeout: false });
    if (result?.status === 'success' && result.url) {
      return String(result.url);
    }
    console.warn('Google Sheet rejected the photo upload:', result);
    return null;
  } catch (err) {
    console.warn('Failed to upload photo to Google Sheet:', err);
    return null;
  }
}

/**
 * Push an updated task row to the Google Sheet. Returns the canonical
 * (Drive-hosted) photo links on success so the caller can replace any raw
 * base64 it's still holding, or null on failure.
 */
export async function updateActionInGoogleSheet(action: ActionItem): Promise<PhotoLinks | null> {
  if (!isGoogleSheetConnected()) return null;
  try {
    const result = await sendToAppsScript({
      action: 'UPDATE_TASK',
      data: toSheetTaskPayload(action)
    });
    if (result?.status !== 'success') {
      console.warn('Google Sheet rejected the task update:', result);
      return null;
    }
    updateLastSyncTime();
    return { attachedPhoto: result.attachedPhoto || undefined, afterPhoto: result.afterPhoto || undefined };
  } catch (err) {
    console.warn('Failed to update task in Google Sheet:', err);
    return null;
  }
}

/**
 * Push a newly created task to the Google Sheet. Returns the server-assigned
 * ID plus the canonical (Drive-hosted) photo links, or null on failure.
 */
export async function createActionInGoogleSheet(action: Omit<ActionItem, 'id'>): Promise<(PhotoLinks & { id: string }) | null> {
  if (!isGoogleSheetConnected()) return null;
  try {
    // No retry on timeout: a slow CREATE_TASK may have already appended the
    // row server-side (IDs are assigned atomically, with no dedup check), so
    // a blind retry risks creating a duplicate task.
    const result = await sendToAppsScript({
      action: 'CREATE_TASK',
      data: toSheetTaskPayload(action)
    }, { retryOnTimeout: false });
    if (result?.status === 'success' && result.createdId) {
      updateLastSyncTime();
      return {
        id: String(result.createdId),
        attachedPhoto: result.attachedPhoto || undefined,
        afterPhoto: result.afterPhoto || undefined
      };
    }
    console.warn('Google Sheet did not return a created task ID:', result);
    return null;
  } catch (err) {
    console.warn('Failed to create task in Google Sheet:', err);
    return null;
  }
}

/**
 * Delete a task row from the Google Sheet
 */
export async function deleteActionInGoogleSheet(id: string): Promise<boolean> {
  if (!isGoogleSheetConnected()) return false;
  try {
    await sendToAppsScript({
      action: 'DELETE_TASK',
      id: id
    });
    updateLastSyncTime();
    return true;
  } catch (err) {
    console.warn('Failed to delete task in Google Sheet:', err);
    return false;
  }
}

/**
 * Permanently wipes every task row from the Google Sheet and resets ID
 * counters, for a clean-slate reset. Does not touch user accounts. Not
 * wired to any UI — deliberately invoked, not something a stray click
 * should be able to trigger.
 */
export async function clearAllTasksInGoogleSheet(): Promise<boolean> {
  if (!isGoogleSheetConnected()) return false;
  const result = await sendToAppsScript({
    action: 'CLEAR_ALL_TASKS',
    confirm: 'DELETE_ALL_TASKS'
  });
  return result?.status === 'success';
}

/**
 * Push all active tasks to the Google Sheet (Initial population / Master Resync)
 */
export async function pushAllActionsToGoogleSheet(actions: ActionItem[]): Promise<boolean> {
  if (!isGoogleSheetConnected()) {
    throw new Error('Please configure and save your Google Sheet Web App URL first.');
  }

  const result = await sendToAppsScript({
    action: 'SYNC_ALL_TASKS',
    records: actions.map(toSheetTaskPayload)
  });

  updateLastSyncTime();
  return result.status === 'success';
}

/**
 * Test ping Google Apps Script Web App
 */
export async function testGoogleSheetConnection(testUrl?: string): Promise<{ success: boolean; message: string; rowCount?: number }> {
  const url = testUrl || getGoogleSheetUrl();
  if (!url) {
    return { success: false, message: 'Google Sheet Web App URL is blank.' };
  }

  try {
    const res = await fetchWithRetry(`${url}?action=PING&_t=${Date.now()}`, {});
    if (!res.ok) {
      return { success: false, message: `Server returned HTTP status ${res.status}` };
    }
    const data = await res.json();
    return {
      success: true,
      message: 'Connection successful! Connected to Google Sheet: ' + (data.sheetTitle || 'ActionMatrix'),
      rowCount: data.rowCount
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Could not connect. Please check deployment settings (Access: "Anyone").'
    };
  }
}

/**
 * Authenticate against the Users tab. Only ever sends/receives a password hash,
 * never plaintext. Returns null on invalid credentials or if no sheet is connected.
 */
export async function loginUser(
  username: string,
  passwordHash: string
): Promise<{ username: string; displayName: string; role: string; departments: string[] | null; mustChangePassword: boolean } | null> {
  if (!isGoogleSheetConnected()) throw new Error('Google Sheet Web App URL is not configured.');
  const result = await sendToAppsScript({ action: 'LOGIN', username, passwordHash });
  if (result && result.status === 'success' && result.user) {
    return result.user;
  }
  return null;
}

export interface AppsScriptUserRecord {
  username: string;
  displayName: string;
  role: string;
  departments: string[] | null;
  mustChangePassword: boolean;
  createdAt: string;
}

/**
 * Fetch the full user list (password hashes are never included in the response).
 * Intended for the Admin user-management panel only.
 */
export async function fetchUsers(): Promise<AppsScriptUserRecord[]> {
  const url = getGoogleSheetUrl();
  if (!url) throw new Error('Google Sheet Web App URL is not configured.');

  const res = await fetchWithRetry(`${url}?action=FETCH_USERS&_t=${Date.now()}`, {});
  if (!res.ok) {
    throw new Error(`Failed to fetch users: HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data && Array.isArray(data.users)) {
    return data.users;
  }
  throw new Error('Unexpected data format received while fetching users.');
}

export async function createUser(user: {
  username: string;
  displayName: string;
  passwordHash: string;
  role: string;
  departments: string[] | null;
}): Promise<boolean> {
  const result = await sendToAppsScript({ action: 'CREATE_USER', data: user });
  return result?.status === 'success';
}

export async function updateUser(user: {
  username: string;
  displayName?: string;
  role?: string;
  departments?: string[] | null;
}): Promise<boolean> {
  const result = await sendToAppsScript({ action: 'UPDATE_USER', data: user });
  return result?.status === 'success';
}

export async function deleteUser(username: string): Promise<boolean> {
  const result = await sendToAppsScript({ action: 'DELETE_USER', username });
  return result?.status === 'success';
}

/**
 * Change a user's password. Self-service calls (user setting their own password)
 * clear mustChangePassword; admin resets pass `forceChangeOnNextLogin: true` so
 * the temp password must be replaced at the user's next login.
 */
export async function changePassword(
  username: string,
  newPasswordHash: string,
  forceChangeOnNextLogin = false
): Promise<boolean> {
  const result = await sendToAppsScript({
    action: 'CHANGE_PASSWORD',
    username,
    newPasswordHash,
    mustChangePassword: forceChangeOnNextLogin
  });
  return result?.status === 'success';
}
