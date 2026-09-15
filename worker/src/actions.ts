import { Env } from './types';
import { valuesAppend, valuesClear, valuesGet, valuesUpdate, deleteRow } from './sheetsClient';
import { uploadPhotoToDrive } from './driveClient';
import { getNextTaskId } from './idCounter';

const TASKS_SHEET = 'MasterActionMatrix';
const USERS_SHEET = 'Users';
const COUNTERS_SHEET = 'IDCounters';
const TASK_COLS = 22; // A:V
const USER_COLS = 7; // A:G

function isTrue(val: unknown): boolean {
  return val === true || String(val).toUpperCase() === 'TRUE';
}

function pad(row: string[], len: number): string[] {
  const out = row.slice();
  while (out.length < len) out.push('');
  return out;
}

function parseDepartments(cellValue: string | undefined): string[] | null {
  const raw = String(cellValue || '').trim();
  if (!raw) return null;
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : null;
}

function joinDepartments(departments: string[] | null | undefined): string {
  if (!departments || !departments.length) return '';
  return departments.join(',');
}

function taskRowToRecord(row: string[]) {
  const r = pad(row, TASK_COLS);
  return {
    id: String(r[0]),
    dept: String(r[1] || ''),
    description: String(r[2] || ''),
    targetDate: String(r[3] || ''),
    status: String(r[4] || 'Pending'),
    priority: String(r[5] || 'B'),
    owner: String(r[6] || ''),
    originator: String(r[7] || ''),
    originatorDept: String(r[8] || r[1] || ''),
    actualDate: r[9] ? String(r[9]) : undefined,
    recurrence: String(r[10] || 'One-Time'),
    actionType: String(r[11] || 'General'),
    isKaizen: isTrue(r[12]),
    isMOM: isTrue(r[13]),
    verificationStatus: String(r[14] || 'Pending Verification'),
    lastUpdated: r[15] ? String(r[15]) : '',
    attachedPhoto: String(r[16] || '') || undefined,
    afterPhoto: String(r[17] || '') || undefined,
    actionNotes: String(r[18] || ''),
    machineNote: String(r[19] || '') || undefined,
    kaizenBenefit: String(r[20] || '') || undefined,
    isBroadcast: isTrue(r[21])
  };
}

function taskRecordToRow(id: string, item: any): unknown[] {
  return [
    id,
    item.dept || '',
    item.description || '',
    item.targetDate || '',
    item.status || 'Pending',
    item.priority || 'B',
    item.owner || '',
    item.originator || '',
    item.originatorDept || item.dept || '',
    item.actualDate || '',
    item.recurrence || 'One-Time',
    item.actionType || 'General',
    item.isKaizen ? 'TRUE' : 'FALSE',
    item.isMOM ? 'TRUE' : 'FALSE',
    item.verificationStatus || 'Pending Verification',
    new Date().toISOString(),
    item.attachedPhoto || '',
    item.afterPhoto || '',
    item.actionNotes || '',
    item.machineNote || '',
    item.kaizenBenefit || '',
    item.isBroadcast ? 'TRUE' : 'FALSE'
  ];
}

function userRowToRecord(row: string[], includeHash: boolean) {
  const r = pad(row, USER_COLS);
  const record: any = {
    username: r[0],
    displayName: r[1],
    role: r[3],
    departments: parseDepartments(r[4]),
    mustChangePassword: isTrue(r[5]),
    createdAt: r[6]
  };
  if (includeHash) record.passwordHash = r[2];
  return record;
}

async function findRow(
  env: Env,
  sheet: string,
  idColumnRange: string,
  matchValue: string,
  caseInsensitive = false
): Promise<{ rowNumber: number; rows: string[][] } | null> {
  const rows = await valuesGet(env, `${sheet}!${idColumnRange}`);
  const target = caseInsensitive ? matchValue.toLowerCase() : matchValue;
  for (let i = 0; i < rows.length; i++) {
    const cell = String(rows[i][0] || '');
    if ((caseInsensitive ? cell.toLowerCase() : cell) === target) {
      return { rowNumber: i + 2, rows }; // +2: header row + 1-indexed
    }
  }
  return null;
}

// ---------------- Task actions ----------------

export async function ping(env: Env) {
  const rows = await valuesGet(env, `${TASKS_SHEET}!A2:A`);
  return { status: 'success', sheetTitle: TASKS_SHEET, rowCount: rows.filter((r) => r[0]).length };
}

export async function fetchAll(env: Env) {
  const rows = await valuesGet(env, `${TASKS_SHEET}!A2:V`);
  const records = rows.filter((r) => r[0]).map(taskRowToRecord);
  return { status: 'success', count: records.length, records };
}

export async function fetchUsers(env: Env) {
  const rows = await valuesGet(env, `${USERS_SHEET}!A2:G`);
  const users = rows.filter((r) => r[0]).map((r) => userRowToRecord(r, false));
  return { status: 'success', users };
}

async function resolvePhotoLink(env: Env, value: string, filenamePrefix: string): Promise<string> {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('data:image')) {
    return uploadPhotoToDrive(env, value, `${filenamePrefix}.jpg`);
  }
  return '';
}

export async function createTask(env: Env, item: any) {
  const newId = await getNextTaskId(env, item.dept);
  const attachedPhoto = await resolvePhotoLink(env, item.attachedPhoto || '', `Task_${newId}_Problem`);
  const afterPhoto = await resolvePhotoLink(env, item.afterPhoto || '', `Task_${newId}_Evidence`);
  const row = taskRecordToRow(newId, { ...item, attachedPhoto, afterPhoto });
  await valuesAppend(env, `${TASKS_SHEET}!A:V`, [row]);
  return { status: 'success', createdId: newId, attachedPhoto, afterPhoto };
}

export async function updateTask(env: Env, item: any) {
  const found = await findRow(env, TASKS_SHEET, 'A2:A', String(item.id));
  const attachedPhoto = await resolvePhotoLink(env, item.attachedPhoto || '', `Task_${item.id}_Problem`);
  const afterPhoto = await resolvePhotoLink(env, item.afterPhoto || '', `Task_${item.id}_Evidence`);
  const row = taskRecordToRow(item.id, { ...item, attachedPhoto, afterPhoto });

  if (found) {
    await valuesUpdate(env, `${TASKS_SHEET}!A${found.rowNumber}:V${found.rowNumber}`, [row]);
  } else {
    await valuesAppend(env, `${TASKS_SHEET}!A:V`, [row]);
  }
  return { status: 'success', updatedId: item.id, attachedPhoto, afterPhoto };
}

export async function deleteTask(env: Env, id: string) {
  const found = await findRow(env, TASKS_SHEET, 'A2:A', String(id));
  if (found) await deleteRow(env, TASKS_SHEET, found.rowNumber);
  return { status: 'success', deletedId: id };
}

export async function syncAllTasks(env: Env, tasks: any[]) {
  await valuesClear(env, `${TASKS_SHEET}!A2:V`);
  if (tasks.length) {
    const rows = await Promise.all(
      tasks.map(async (t) => {
        const attachedPhoto = await resolvePhotoLink(env, t.attachedPhoto || '', `Task_${t.id}_Problem`);
        const afterPhoto = await resolvePhotoLink(env, t.afterPhoto || '', `Task_${t.id}_Evidence`);
        return taskRecordToRow(t.id, { ...t, attachedPhoto, afterPhoto });
      })
    );
    await valuesUpdate(env, `${TASKS_SHEET}!A2:V${rows.length + 1}`, rows);
  }
  return { status: 'success', syncedCount: tasks.length };
}

export async function clearAllTasks(env: Env, confirm: string) {
  if (confirm !== 'DELETE_ALL_TASKS') {
    return { status: 'error', message: 'Missing or incorrect confirmation token' };
  }
  await valuesClear(env, `${TASKS_SHEET}!A2:V`);
  await valuesClear(env, `${COUNTERS_SHEET}!A2:B`);
  return { status: 'success', message: 'All tasks cleared and ID counters reset' };
}

export async function uploadPhoto(env: Env, base64: string, filename: string) {
  const url = await uploadPhotoToDrive(env, base64 || '', filename || `Photo_${Date.now()}.jpg`);
  return { status: 'success', url };
}

// ---------------- User actions ----------------

export async function login(env: Env, username: string, passwordHash: string) {
  const found = await findRow(env, USERS_SHEET, 'A2:G', username, true);
  if (!found) return { status: 'error', message: 'Invalid credentials' };
  const row = pad(found.rows[found.rowNumber - 2], USER_COLS);
  if (row[2] !== passwordHash) return { status: 'error', message: 'Invalid credentials' };
  return { status: 'success', user: userRowToRecord(row, false) };
}

export async function createUser(env: Env, item: any) {
  const existing = await findRow(env, USERS_SHEET, 'A2:A', item.username, true);
  if (existing) return { status: 'error', message: 'Username already exists' };
  await valuesAppend(env, `${USERS_SHEET}!A:G`, [
    [item.username, item.displayName, item.passwordHash, item.role, joinDepartments(item.departments), false, new Date().toISOString()]
  ]);
  return { status: 'success' };
}

export async function updateUser(env: Env, item: any) {
  const found = await findRow(env, USERS_SHEET, 'A2:G', item.username, true);
  if (!found) return { status: 'error', message: 'User not found' };
  const row = pad(found.rows[found.rowNumber - 2], USER_COLS);
  if (item.displayName !== undefined) row[1] = item.displayName;
  if (item.role !== undefined) row[3] = item.role;
  if (item.departments !== undefined) row[4] = joinDepartments(item.departments);
  await valuesUpdate(env, `${USERS_SHEET}!A${found.rowNumber}:G${found.rowNumber}`, [row]);
  return { status: 'success' };
}

export async function deleteUser(env: Env, username: string) {
  const found = await findRow(env, USERS_SHEET, 'A2:A', username, true);
  if (!found) return { status: 'error', message: 'User not found' };
  await deleteRow(env, USERS_SHEET, found.rowNumber);
  return { status: 'success' };
}

export async function changePassword(env: Env, username: string, newPasswordHash: string, mustChangePassword: boolean) {
  const found = await findRow(env, USERS_SHEET, 'A2:G', username, true);
  if (!found) return { status: 'error', message: 'User not found' };
  await valuesUpdate(env, `${USERS_SHEET}!C${found.rowNumber}`, [[newPasswordHash]]);
  await valuesUpdate(env, `${USERS_SHEET}!F${found.rowNumber}`, [[!!mustChangePassword]]);
  return { status: 'success' };
}
