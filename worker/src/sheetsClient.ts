import { Env } from './types';
import { getAccessToken } from './auth';

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Tab sheetId (gid) values never change for the life of a tab (only if the
// tab is deleted and recreated), so this is safe to cache indefinitely per
// isolate — unlike the OAuth token, no expiry check is needed.
let cachedGids: Record<string, number> | null = null;

async function sheetsFetch(env: Env, path: string, init?: RequestInit): Promise<any> {
  const token = await getAccessToken(env);
  const res = await fetch(`${BASE}/${env.SPREADSHEET_ID}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`Sheets API ${path} failed: HTTP ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function valuesGet(env: Env, range: string): Promise<string[][]> {
  const data = await sheetsFetch(env, `/values/${encodeURIComponent(range)}`);
  return data.values || [];
}

export async function valuesUpdate(env: Env, range: string, values: unknown[][]): Promise<void> {
  await sheetsFetch(env, `/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values })
  });
}

export async function valuesAppend(env: Env, range: string, values: unknown[][]): Promise<void> {
  await sheetsFetch(
    env,
    `/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values }) }
  );
}

export async function valuesClear(env: Env, range: string): Promise<void> {
  await sheetsFetch(env, `/values/${encodeURIComponent(range)}:clear`, { method: 'POST' });
}

async function getSheetGid(env: Env, tabName: string): Promise<number> {
  if (!cachedGids) {
    const token = await getAccessToken(env);
    const res = await fetch(
      `${BASE}/${env.SPREADSHEET_ID}?fields=sheets.properties(sheetId,title)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      throw new Error(`Failed to read spreadsheet metadata: HTTP ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { sheets: { properties: { sheetId: number; title: string } }[] };
    cachedGids = {};
    for (const s of data.sheets) cachedGids[s.properties.title] = s.properties.sheetId;
  }
  const gid = cachedGids[tabName];
  if (gid === undefined) throw new Error(`Sheet tab "${tabName}" not found`);
  return gid;
}

// Deletes a single row (1-indexed as shown in the Sheets UI, including the
// header row in that count) from the given tab.
export async function deleteRow(env: Env, tabName: string, rowNumber: number): Promise<void> {
  const sheetId = await getSheetGid(env, tabName);
  await sheetsFetch(env, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber
            }
          }
        }
      ]
    })
  });
}
