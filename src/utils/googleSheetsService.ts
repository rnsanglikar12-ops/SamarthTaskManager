import { ActionItem } from '../types';

const STORAGE_KEY = 'samarth_google_sheet_url';
const LAST_SYNC_KEY = 'samarth_google_sheet_last_sync';

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
async function sendToAppsScript(payload: any): Promise<any> {
  const url = getGoogleSheetUrl();
  if (!url) throw new Error('Google Sheet Web App URL is not configured.');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });

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

  const res = await fetch(`${url}?action=FETCH_ALL&_t=${Date.now()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch from Google Sheet: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data && Array.isArray(data.records)) {
    updateLastSyncTime();
    return data.records.map((r: any, idx: number) => ({
      id: Number(r.id || r.ID || idx + 1),
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
      machineNote: r.machineNote || r['Machine / Note'] || undefined
    }));
  }

  if (Array.isArray(data)) {
    updateLastSyncTime();
    return data;
  }

  throw new Error('Unexpected data format received from Google Sheet.');
}

/**
 * Push an updated task row to the Google Sheet
 */
export async function updateActionInGoogleSheet(action: ActionItem): Promise<boolean> {
  if (!isGoogleSheetConnected()) return false;
  try {
    await sendToAppsScript({
      action: 'UPDATE_TASK',
      data: action
    });
    updateLastSyncTime();
    return true;
  } catch (err) {
    console.warn('Failed to update task in Google Sheet:', err);
    return false;
  }
}

/**
 * Push a newly created task to the Google Sheet
 */
export async function createActionInGoogleSheet(action: ActionItem): Promise<boolean> {
  if (!isGoogleSheetConnected()) return false;
  try {
    await sendToAppsScript({
      action: 'CREATE_TASK',
      data: action
    });
    updateLastSyncTime();
    return true;
  } catch (err) {
    console.warn('Failed to create task in Google Sheet:', err);
    return false;
  }
}

/**
 * Delete a task row from the Google Sheet
 */
export async function deleteActionInGoogleSheet(id: number): Promise<boolean> {
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
 * Push all active tasks to the Google Sheet (Initial population / Master Resync)
 */
export async function pushAllActionsToGoogleSheet(actions: ActionItem[]): Promise<boolean> {
  if (!isGoogleSheetConnected()) {
    throw new Error('Please configure and save your Google Sheet Web App URL first.');
  }

  const result = await sendToAppsScript({
    action: 'SYNC_ALL_TASKS',
    records: actions
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
    const res = await fetch(`${url}?action=PING&_t=${Date.now()}`);
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
 * Generates the clean Google Apps Script code ready to be pasted into the user's spreadsheet
 */
export function getAppsScriptCode(): string {
  return `/**
 * SAMARTH INDUSTRIES - OPERATIONAL EXCELLENCE PLATFORM
 * Google Apps Script Webhook Backend (100% Free Lifetime Hosting)
 *
 * HOW TO INSTALL IN 3 MINUTES:
 * 1. In your Google Sheet, click Extensions > Apps Script.
 * 2. Delete all existing code and paste this entire file.
 * 3. Click "Deploy" (top right) > "New deployment".
 * 4. Select type: "Web app".
 * 5. Set Description: "Samarth Matrix Webhook API".
 * 6. Set "Execute as": "Me".
 * 7. Set "Who has access": "Anyone" (Critical for web app access).
 * 8. Click Deploy, Authorize access, and copy the Web App URL!
 * 9. Paste the URL into the "Google Sheets Sync" modal in the web app.
 */

const SHEET_NAME = 'MasterActionMatrix';
const DRIVE_FOLDER_NAME = 'Samarth_Action_Photos';

const HEADERS = [
  'ID',
  'Department',
  'Description',
  'Deadline',
  'Status',
  'Priority',
  'Owner',
  'Originator Dept',
  'Evidence Requirement',
  'Action Notes / Machine',
  'Problem Photo (Drive Link)',
  'After Photo (Evidence Link)',
  'Recurrence',
  'Kaizen (DSI)',
  'Kaizen Benefit',
  'Saturday MOM',
  'CFT Handshake',
  'Last Updated'
];

function getOrCreatePhotoFolder() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function saveBase64ImageToDrive(base64Data, filename) {
  if (!base64Data || typeof base64Data !== 'string') return '';
  // If it's already a URL, return it
  if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
    return base64Data;
  }
  if (!base64Data.includes('base64,')) {
    return '';
  }
  try {
    const parts = base64Data.split('base64,');
    const contentType = parts[0].split(':')[1].split(';')[0];
    const decoded = Utilities.base64Decode(parts[1]);
    const blob = Utilities.newBlob(decoded, contentType, filename);
    const folder = getOrCreatePhotoFolder();
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    return '';
  }
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Setup header row
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground('#1d64ec')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'FETCH_ALL';
    const sheet = getOrCreateSheet();
    
    if (action === 'PING') {
      const lastRow = sheet.getLastRow();
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        sheetTitle: sheet.getName(),
        rowCount: Math.max(0, lastRow - 1)
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        records: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const records = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      records.push({
        id: Number(row[0]),
        dept: String(row[1] || ''),
        desc: String(row[2] || ''),
        deadline: formatDateValue(row[3]),
        status: String(row[4] || 'Pending'),
        priority: String(row[5] || 'B'),
        owner: String(row[6] || ''),
        originatorDept: String(row[7] || row[1] || ''),
        evidence: String(row[8] || 'Photo Proof'),
        actionNotes: String(row[9] || ''),
        attachedPhoto: String(row[10] || ''),
        afterPhoto: String(row[11] || ''),
        recurrence: String(row[12] || 'One-Time'),
        isKaizen: row[13] === true || String(row[13]).toUpperCase() === 'TRUE',
        kaizenBenefit: String(row[14] || ''),
        isMOM: row[15] === true || String(row[15]).toUpperCase() === 'TRUE',
        isCFT: row[16] === true || String(row[16]).toUpperCase() === 'TRUE',
        lastUpdated: row[17] ? formatDateValue(row[17]) : ''
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      count: records.length,
      records: records
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const sheet = getOrCreateSheet();
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    
    if (action === 'SYNC_ALL_TASKS') {
      const tasks = payload.records || [];
      sheet.clearContents();
      
      const rows = [HEADERS];
      tasks.forEach(t => {
        let problemPhotoLink = t.attachedPhoto || '';
        if (problemPhotoLink && problemPhotoLink.startsWith('data:image')) {
          problemPhotoLink = saveBase64ImageToDrive(problemPhotoLink, 'Task_' + t.id + '_Problem.jpg');
        }
        let afterPhotoLink = t.afterPhoto || '';
        if (afterPhotoLink && afterPhotoLink.startsWith('data:image')) {
          afterPhotoLink = saveBase64ImageToDrive(afterPhotoLink, 'Task_' + t.id + '_Evidence.jpg');
        }

        rows.push([
          t.id,
          t.dept || '',
          t.desc || t.description || '',
          t.deadline || t.targetDate || '',
          t.status || 'Pending',
          t.priority || 'B',
          t.owner || '',
          t.originatorDept || t.dept || '',
          t.evidence || 'Photo Proof',
          t.actionNotes || t.machineNote || '',
          problemPhotoLink,
          afterPhotoLink,
          t.recurrence || 'One-Time',
          t.isKaizen ? 'TRUE' : 'FALSE',
          t.kaizenBenefit || '',
          t.isMOM ? 'TRUE' : 'FALSE',
          t.isCFT ? 'TRUE' : 'FALSE',
          new Date().toISOString()
        ]);
      });
      
      if (rows.length > 0) {
        sheet.getRange(1, 1, rows.length, HEADERS.length).setValues(rows);
        sheet.getRange(1, 1, 1, HEADERS.length)
          .setBackground('#1d64ec')
          .setFontColor('#ffffff')
          .setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        syncedCount: tasks.length
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'UPDATE_TASK') {
      const item = payload.data;
      const data = sheet.getDataRange().getValues();
      let foundIndex = -1;
      
      for (let i = 1; i < data.length; i++) {
        if (Number(data[i][0]) === Number(item.id)) {
          foundIndex = i + 1;
          break;
        }
      }

      let problemPhotoLink = item.attachedPhoto || '';
      if (problemPhotoLink && problemPhotoLink.startsWith('data:image')) {
        problemPhotoLink = saveBase64ImageToDrive(problemPhotoLink, 'Task_' + item.id + '_Problem.jpg');
      }
      let afterPhotoLink = item.afterPhoto || '';
      if (afterPhotoLink && afterPhotoLink.startsWith('data:image')) {
        afterPhotoLink = saveBase64ImageToDrive(afterPhotoLink, 'Task_' + item.id + '_Evidence.jpg');
      }
      
      const updatedRow = [
        item.id,
        item.dept || '',
        item.desc || item.description || '',
        item.deadline || item.targetDate || '',
        item.status || 'Pending',
        item.priority || 'B',
        item.owner || '',
        item.originatorDept || item.dept || '',
        item.evidence || 'Photo Proof',
        item.actionNotes || item.machineNote || '',
        problemPhotoLink,
        afterPhotoLink,
        item.recurrence || 'One-Time',
        item.isKaizen ? 'TRUE' : 'FALSE',
        item.kaizenBenefit || '',
        item.isMOM ? 'TRUE' : 'FALSE',
        item.isCFT ? 'TRUE' : 'FALSE',
        new Date().toISOString()
      ];
      
      if (foundIndex > 0) {
        sheet.getRange(foundIndex, 1, 1, HEADERS.length).setValues([updatedRow]);
      } else {
        sheet.appendRow(updatedRow);
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        updatedId: item.id,
        problemPhotoLink: problemPhotoLink,
        afterPhotoLink: afterPhotoLink
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'CREATE_TASK') {
      const item = payload.data;

      let problemPhotoLink = item.attachedPhoto || '';
      if (problemPhotoLink && problemPhotoLink.startsWith('data:image')) {
        problemPhotoLink = saveBase64ImageToDrive(problemPhotoLink, 'Task_' + item.id + '_Problem.jpg');
      }
      let afterPhotoLink = item.afterPhoto || '';
      if (afterPhotoLink && afterPhotoLink.startsWith('data:image')) {
        afterPhotoLink = saveBase64ImageToDrive(afterPhotoLink, 'Task_' + item.id + '_Evidence.jpg');
      }

      const newRow = [
        item.id,
        item.dept || '',
        item.desc || item.description || '',
        item.deadline || item.targetDate || '',
        item.status || 'Pending',
        item.priority || 'B',
        item.owner || '',
        item.originatorDept || item.dept || '',
        item.evidence || 'Photo Proof',
        item.actionNotes || item.machineNote || '',
        problemPhotoLink,
        afterPhotoLink,
        item.recurrence || 'One-Time',
        item.isKaizen ? 'TRUE' : 'FALSE',
        item.kaizenBenefit || '',
        item.isMOM ? 'TRUE' : 'FALSE',
        item.isCFT ? 'TRUE' : 'FALSE',
        new Date().toISOString()
      ];
      sheet.appendRow(newRow);
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        createdId: item.id,
        problemPhotoLink: problemPhotoLink
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'DELETE_TASK') {
      const targetId = Number(payload.id);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (Number(data[i][0]) === targetId) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        deletedId: targetId
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Unknown action: ' + action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function formatDateValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val);
}
`;
}
