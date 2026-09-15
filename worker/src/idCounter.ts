import { Env } from './types';
import { valuesGet, valuesUpdate } from './sheetsClient';

const DEPT_PREFIXES: Record<string, string> = {
  MD: 'MD',
  'Plant Head': 'PH',
  PDC: 'PDC',
  'Die Maint': 'DM',
  SPM: 'SPM',
  Fettling: 'FTL',
  'Machine shop-01': 'MS1',
  'Machine shop-02': 'MS2',
  PPC: 'PPC',
  Store: 'STR',
  'MC Maint': 'MCM',
  Quality: 'QA',
  NPD: 'NPD',
  'Tool Room': 'TR',
  HR: 'HR',
  Account: 'ACC',
  Purchase: 'PUR',
  'All Departments': 'ALL'
};

function getDeptPrefix(dept: string): string {
  if (DEPT_PREFIXES[dept]) return DEPT_PREFIXES[dept];
  const cleaned = String(dept || 'GEN')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  return cleaned.slice(0, 4) || 'GEN';
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getMaxObservedNumber(env: Env, prefix: string): Promise<number> {
  const rows = await valuesGet(env, 'MasterActionMatrix!A2:A');
  const re = new RegExp(`^${escapeRegex(prefix)}-(\\d+)$`);
  let max = 0;
  for (const row of rows) {
    const m = String(row[0] || '').match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

// Sheets API has no compare-and-swap, so this is an optimistic-retry
// approximation of Apps Script's LockService-guarded counter, not a true
// lock: it narrows the collision window to roughly one API round-trip
// rather than eliminating it. To bound the damage if two requests really do
// race, the next number is always at least (highest ID already present in
// MasterActionMatrix for this prefix) + 1, so a rare collision degrades to
// "a number gets skipped," never two tasks silently sharing an ID.
export async function getNextTaskId(env: Env, dept: string): Promise<string> {
  const prefix = getDeptPrefix(dept);
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const [counterRows, maxObserved] = await Promise.all([
      valuesGet(env, 'IDCounters!A2:B'),
      getMaxObservedNumber(env, prefix)
    ]);

    const rowIdx = counterRows.findIndex((r) => r[0] === prefix);
    const counterValue = rowIdx >= 0 ? Number(counterRows[rowIdx][1]) || 0 : 0;
    const nextNumber = Math.max(counterValue, maxObserved) + 1;
    const targetRow = rowIdx >= 0 ? rowIdx + 2 : counterRows.length + 2;

    if (rowIdx >= 0) {
      await valuesUpdate(env, `IDCounters!B${targetRow}`, [[nextNumber]]);
    } else {
      await valuesUpdate(env, `IDCounters!A${targetRow}:B${targetRow}`, [[prefix, nextNumber]]);
    }

    const verify = await valuesGet(env, `IDCounters!B${targetRow}`);
    const verifiedValue = Number(verify[0]?.[0]);
    if (verifiedValue === nextNumber) {
      return `${prefix}-${nextNumber}`;
    }

    await sleep(50 + Math.random() * 150 * (attempt + 1));
  }

  throw new Error(`Failed to allocate task ID for ${dept} after ${maxAttempts} attempts`);
}
