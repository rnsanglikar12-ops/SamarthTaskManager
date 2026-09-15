/**
 * SAMARTH INDUSTRIES - OPERATIONAL EXCELLENCE PLATFORM
 * Google Apps Script Webhook Backend (100% Free Lifetime Hosting)
 *
 * This is the complete, canonical script. Replace your entire Apps Script
 * project with this file each time you get an updated version — do not
 * keep older "*-fix.gs" files from previous rounds, they're superseded.
 *
 * WHAT CHANGED IN THIS VERSION:
 * - Users can now be scoped to MULTIPLE departments (one person can head
 *   several depts). The "department" column in the Users sheet now stores a
 *   comma-separated list (e.g. "PDC,Die Maint,SPM,Fettling"); CREATE_USER/
 *   UPDATE_USER accept a `departments` array, and every user record now
 *   returns `departments: string[] | null` instead of a single `department`
 *   string. Existing single-dept users keep working unchanged (a one-item list).
 * - Added CLEAR_ALL_TASKS: wipes all task rows (keeps headers) and resets
 *   IDCounters back to zero, for a clean-slate reset. Requires the client to
 *   send confirm: "DELETE_ALL_TASKS" — never wired to a UI button, only
 *   triggered deliberately. Does not touch the Users sheet.
 * - New task IDs are now department-prefixed (e.g. "PDC-47") and assigned
 *   ATOMICALLY on the server using LockService, in a new "IDCounters" sheet
 *   tab (one row per department, tracking the last-used number). This
 *   replaces the old client-side "current max + 1" scheme, which allowed
 *   two people creating tasks at the same time to collide on the same ID.
 * - CREATE_TASK now ignores any ID sent by the client and always generates
 *   the real one server-side, returned as `createdId` in the response.
 * - UPDATE_TASK / DELETE_TASK now compare IDs as strings (not numbers),
 *   since IDs are no longer purely numeric.
 * - Existing tasks keep their old plain-numeric IDs untouched — only new
 *   tasks get the prefixed format.
 * - (Carried over from the previous version): Before/After photo upload to
 *   Google Drive, Action Notes / Machine Note / Kaizen Benefit / Broadcast
 *   columns, and the Users tab / login system.
 */

const SHEET_NAME = 'MasterActionMatrix';
const HEADERS = [
  'ID',
  'Department',
  'Description',
  'Target Date',
  'Status',
  'Priority',
  'Owner',
  'Originator',
  'Originator Dept',
  'Actual Date',
  'Recurrence',
  'Action Type',
  'Kaizen (DSI)',
  'Saturday MOM',
  'Verification Status',
  'Last Updated',
  'Problem Photo',
  'After Photo',
  'Action Notes',
  'Machine Note',
  'Kaizen Benefit',
  'Broadcast'
];

const DRIVE_FOLDER_NAME = 'Samarth_Action_Photos';

function getOrCreatePhotoFolder_() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

// Converts a base64 data URL into a Drive link. If the value is already a
// URL (or empty), it's passed through unchanged.
//
// Photos are click-through links now, not embedded <img> thumbnails (see
// UPLOAD_PHOTO in doPost), so the plain Drive viewer link (file.getUrl(),
// drive.google.com/file/d/ID/view) is exactly what's needed — it's a normal
// top-level navigation, which Drive always allows for anyone with link
// access, unlike embedding it as a cross-origin <img> (which Google blocks
// for the uc?export=view form and requires a separate hotlink-safe
// lh3.googleusercontent.com form for — unnecessary complexity once nothing
// needs to embed it).
function saveBase64ImageToDrive_(base64Data, filename) {
  if (!base64Data || typeof base64Data !== 'string') return '';
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
    const folder = getOrCreatePhotoFolder_();
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
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground('#1d64ec')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else {
    // Self-heal: extend the header row if HEADERS has grown since this
    // sheet was first created (e.g. new columns added in a later version).
    const existingHeaderCount = sheet.getLastColumn();
    if (existingHeaderCount < HEADERS.length) {
      const newHeaders = HEADERS.slice(existingHeaderCount);
      const startCol = existingHeaderCount + 1;
      sheet.getRange(1, startCol, 1, newHeaders.length).setValues([newHeaders]);
      sheet.getRange(1, startCol, 1, newHeaders.length)
        .setBackground('#1d64ec')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
    }
  }
  return sheet;
}

// Finds a task's row by ID without reading every column of every row.
// UPDATE_TASK/DELETE_TASK only need the row NUMBER to act on (the actual
// read/write of a found row already targets just that row) — reading all
// 22 columns via getDataRange() just to compare column A is unnecessary
// work that scales with sheet size for no benefit. Returns the 1-based
// sheet row index, or -1 if not found.
function findTaskRowIndex_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const target = String(id);
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === target) return i + 2;
  }
  return -1;
}

// Disambiguated lookup for when two rows may currently share the same ID
// (e.g. mid-repair of a collision) -- matches on ID AND description together.
function findTaskRowIndexByDescription_(sheet, id, description) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const idCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const descCol = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
  const targetId = String(id);
  const targetDesc = String(description);
  for (let i = 0; i < idCol.length; i++) {
    if (String(idCol[i][0]) === targetId && String(descCol[i][0]) === targetDesc) return i + 2;
  }
  return -1;
}

// ============================================================
// DEPARTMENT-PREFIXED, COLLISION-SAFE TASK ID ASSIGNMENT
// ============================================================

const DEPT_PREFIXES = {
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

// Fallback for any department name not in the table above (e.g. legacy/
// stray values in historical data) — first 4 alphanumeric characters,
// uppercased, so ID generation never breaks for an unrecognized dept.
function getDeptPrefix_(dept) {
  if (DEPT_PREFIXES[dept]) return DEPT_PREFIXES[dept];
  const cleaned = String(dept || 'GEN').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return cleaned.slice(0, 4) || 'GEN';
}

const ID_COUNTERS_SHEET_NAME = 'IDCounters';

function getOrCreateIdCountersSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ID_COUNTERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ID_COUNTERS_SHEET_NAME);
    sheet.getRange(1, 1, 1, 2).setValues([['Prefix', 'LastNumber']]);
    sheet.getRange(1, 1, 1, 2)
      .setBackground('#1d64ec')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Atomically reserves and returns the next ID for a department, e.g.
// "PDC-47". Uses a script-wide lock so two concurrent CREATE_TASK calls
// can never be handed the same number, even under real concurrent usage.
function getNextTaskId_(dept) {
  const prefix = getDeptPrefix_(dept);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getOrCreateIdCountersSheet_();
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    let lastNumber = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === prefix) {
        rowIndex = i + 1;
        lastNumber = Number(data[i][1]) || 0;
        break;
      }
    }
    const nextNumber = lastNumber + 1;
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 2).setValue(nextNumber);
    } else {
      sheet.appendRow([prefix, nextNumber]);
    }
    return prefix + '-' + nextNumber;
  } finally {
    lock.releaseLock();
  }
}

// Recomputes IDCounters from the true max ID number per prefix actually
// present in MasterActionMatrix, and overwrites the sheet with those values.
// Needed after any bulk write (SYNC_ALL_TASKS) that lays down IDs without
// going through getNextTaskId_, since those bypass the counters entirely and
// leave them stale -- the next CREATE_TASK would otherwise hand out an
// already-used ID.
function resyncIdCountersFromSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  const maxPerPrefix = {};
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      const id = String(ids[i][0] || '');
      const m = id.match(/^([A-Za-z]+)-(\d+)$/);
      if (!m) continue;
      const prefix = m[1];
      const num = parseInt(m[2], 10);
      if (!maxPerPrefix[prefix] || num > maxPerPrefix[prefix]) {
        maxPerPrefix[prefix] = num;
      }
    }
  }

  const counters = getOrCreateIdCountersSheet_();
  const countersLastRow = counters.getLastRow();
  if (countersLastRow > 1) {
    counters.getRange(2, 1, countersLastRow - 1, 2).clearContent();
  }
  const rows = Object.keys(maxPerPrefix).map(prefix => [prefix, maxPerPrefix[prefix]]);
  if (rows.length > 0) {
    counters.getRange(2, 1, rows.length, 2).setValues(rows);
  }
  return maxPerPrefix;
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'FETCH_ALL';

    if (action === 'FETCH_USERS') return doFetchUsers();
    if (action === 'FETCH_SUPERVISORS') return doFetchSupervisors();

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
        id: String(row[0]),
        dept: String(row[1] || ''),
        description: String(row[2] || ''),
        targetDate: formatDateValue(row[3]),
        status: String(row[4] || 'Pending'),
        priority: String(row[5] || 'B'),
        owner: String(row[6] || ''),
        originator: String(row[7] || ''),
        originatorDept: String(row[8] || row[1] || ''),
        actualDate: row[9] ? formatDateValue(row[9]) : undefined,
        recurrence: String(row[10] || 'One-Time'),
        actionType: String(row[11] || 'General'),
        isKaizen: row[12] === true || String(row[12]).toUpperCase() === 'TRUE',
        isMOM: row[13] === true || String(row[13]).toUpperCase() === 'TRUE',
        verificationStatus: String(row[14] || 'Pending Verification'),
        lastUpdated: row[15] ? formatDateValue(row[15]) : '',
        attachedPhoto: String(row[16] || '') || undefined,
        afterPhoto: String(row[17] || '') || undefined,
        actionNotes: String(row[18] || ''),
        machineNote: String(row[19] || '') || undefined,
        kaizenBenefit: String(row[20] || '') || undefined,
        isBroadcast: row[21] === true || String(row[21]).toUpperCase() === 'TRUE'
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

    if (action === 'LOGIN') return doLogin(payload);
    if (action === 'CREATE_USER') return doCreateUser(payload);
    if (action === 'UPDATE_USER') return doUpdateUser(payload);
    if (action === 'DELETE_USER') return doDeleteUser(payload);
    if (action === 'CHANGE_PASSWORD') return doChangePassword(payload);
    if (action === 'CREATE_SUPERVISOR') return doCreateSupervisor(payload);
    if (action === 'DELETE_SUPERVISOR') return doDeleteSupervisor(payload);

    if (action === 'UPLOAD_PHOTO') {
      // Dedicated upload endpoint so a photo only ever travels over the wire
      // once, at selection time — CREATE_TASK/UPDATE_TASK then just carry
      // the short returned link like any other text field, instead of
      // re-sending the full base64 blob on every save.
      const url = saveBase64ImageToDrive_(payload.base64 || '', payload.filename || ('Photo_' + Date.now() + '.jpg'));
      if (!url) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          message: 'Upload failed'
        })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        url: url
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'CLEAR_ALL_TASKS') {
      // Requires an explicit confirmation token so a stray/malformed request
      // can never wipe the sheet by accident. Clears MasterActionMatrix data
      // rows and resets IDCounters (new tasks restart at -1 per dept). Does
      // NOT touch the Users sheet.
      if (payload.confirm !== 'DELETE_ALL_TASKS') {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          message: 'Missing or incorrect confirmation token'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
      }

      const counters = getOrCreateIdCountersSheet_();
      const countersLastRow = counters.getLastRow();
      if (countersLastRow > 1) {
        counters.getRange(2, 1, countersLastRow - 1, counters.getLastColumn()).clearContent();
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'All tasks cleared and ID counters reset'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'SYNC_ALL_TASKS') {
      // Full re-sync of already-identified items (from local cache) — IDs
      // are passed through as-is, not regenerated.
      const tasks = payload.records || [];
      sheet.clearContents();

      const rows = [HEADERS];
      tasks.forEach(t => {
        let problemPhotoLink = t.attachedPhoto || '';
        if (problemPhotoLink.startsWith('data:image')) {
          problemPhotoLink = saveBase64ImageToDrive_(problemPhotoLink, 'Task_' + t.id + '_Problem.jpg');
        }
        let afterPhotoLink = t.afterPhoto || '';
        if (afterPhotoLink.startsWith('data:image')) {
          afterPhotoLink = saveBase64ImageToDrive_(afterPhotoLink, 'Task_' + t.id + '_Evidence.jpg');
        }
        rows.push([
          t.id,
          t.dept || '',
          t.description || '',
          t.targetDate || '',
          t.status || 'Pending',
          t.priority || 'B',
          t.owner || '',
          t.originator || '',
          t.originatorDept || t.dept || '',
          t.actualDate || '',
          t.recurrence || 'One-Time',
          t.actionType || 'General',
          t.isKaizen ? 'TRUE' : 'FALSE',
          t.isMOM ? 'TRUE' : 'FALSE',
          t.verificationStatus || 'Pending Verification',
          new Date().toISOString(),
          problemPhotoLink,
          afterPhotoLink,
          t.actionNotes || '',
          t.machineNote || '',
          t.kaizenBenefit || '',
          t.isBroadcast ? 'TRUE' : 'FALSE'
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

      resyncIdCountersFromSheet_(sheet);

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        syncedCount: tasks.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'ADMIN_FIX_INTEGRITY') {
      // One-off maintenance action: repairs specific duplicate-ID rows by
      // matching on (id, description) -- safe even when two rows currently
      // share the same ID, since description disambiguates which physical
      // row gets the new ID -- then resyncs IDCounters from the corrected
      // sheet so future CREATE_TASK calls stop colliding.
      if (payload.confirm !== 'FIX_INTEGRITY') {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          message: 'Missing or incorrect confirmation token'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      const reassignments = payload.reassignments || [];
      const lastRow = sheet.getLastRow();
      const results = [];
      if (lastRow > 1) {
        const idCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        const descCol = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
        reassignments.forEach(r => {
          let found = false;
          for (let i = 0; i < idCol.length; i++) {
            if (String(idCol[i][0]) === r.oldId && String(descCol[i][0]) === r.description) {
              sheet.getRange(i + 2, 1).setValue(r.newId);
              results.push({ oldId: r.oldId, newId: r.newId, description: r.description, status: 'reassigned' });
              found = true;
              break;
            }
          }
          if (!found) {
            results.push({ oldId: r.oldId, newId: r.newId, description: r.description, status: 'not_found' });
          }
        });
      }

      const deletions = payload.deletions || [];
      deletions.forEach(d => {
        const idx = findTaskRowIndexByDescription_(sheet, d.id, d.description);
        if (idx > 0) {
          sheet.deleteRow(idx);
          results.push({ id: d.id, description: d.description, status: 'deleted' });
        } else {
          results.push({ id: d.id, description: d.description, status: 'not_found' });
        }
      });

      const newCounters = resyncIdCountersFromSheet_(sheet);

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        results: results,
        newCounters: newCounters,
        finalRowCount: sheet.getLastRow() - 1
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'UPDATE_TASK') {
      const item = payload.data;
      const foundIndex = findTaskRowIndex_(sheet, item.id);

      if (foundIndex <= 0) {
        // Never silently appendRow() here: a row's ID is expected to
        // already exist (assigned atomically by CREATE_TASK), so failing
        // to find it means something is genuinely wrong -- appending would
        // create a second row sharing that same ID instead of surfacing
        // the problem, silently corrupting the sheet.
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          message: 'Task ' + item.id + ' not found -- no update applied.'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      let problemPhotoLink = item.attachedPhoto || '';
      if (problemPhotoLink.startsWith('data:image')) {
        problemPhotoLink = saveBase64ImageToDrive_(problemPhotoLink, 'Task_' + item.id + '_Problem.jpg');
      }
      let afterPhotoLink = item.afterPhoto || '';
      if (afterPhotoLink.startsWith('data:image')) {
        afterPhotoLink = saveBase64ImageToDrive_(afterPhotoLink, 'Task_' + item.id + '_Evidence.jpg');
      }

      const updatedRow = [
        item.id,
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
        problemPhotoLink,
        afterPhotoLink,
        item.actionNotes || '',
        item.machineNote || '',
        item.kaizenBenefit || '',
        item.isBroadcast ? 'TRUE' : 'FALSE'
      ];

      sheet.getRange(foundIndex, 1, 1, HEADERS.length).setValues([updatedRow]);

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        updatedId: item.id,
        attachedPhoto: problemPhotoLink,
        afterPhoto: afterPhotoLink
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'CREATE_TASK') {
      const item = payload.data;

      // The real, collision-safe ID is always generated here — any ID the
      // client sent is ignored.
      const newId = getNextTaskId_(item.dept);

      let problemPhotoLink = item.attachedPhoto || '';
      if (problemPhotoLink.startsWith('data:image')) {
        problemPhotoLink = saveBase64ImageToDrive_(problemPhotoLink, 'Task_' + newId + '_Problem.jpg');
      }
      let afterPhotoLink = item.afterPhoto || '';
      if (afterPhotoLink.startsWith('data:image')) {
        afterPhotoLink = saveBase64ImageToDrive_(afterPhotoLink, 'Task_' + newId + '_Evidence.jpg');
      }

      const newRow = [
        newId,
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
        problemPhotoLink,
        afterPhotoLink,
        item.actionNotes || '',
        item.machineNote || '',
        item.kaizenBenefit || '',
        item.isBroadcast ? 'TRUE' : 'FALSE'
      ];
      sheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        createdId: newId,
        attachedPhoto: problemPhotoLink,
        afterPhoto: afterPhotoLink
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'DELETE_TASK') {
      const targetId = String(payload.id);
      const foundIndex = findTaskRowIndex_(sheet, targetId);
      if (foundIndex > 0) {
        sheet.deleteRow(foundIndex);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        deletedId: targetId
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Unknown action'
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

// ============================================================
// USER MANAGEMENT (unchanged from your last deployment)
// ============================================================

const USERS_SHEET_NAME = 'Users';
const USERS_HEADERS = ['username', 'displayName', 'passwordHash', 'role', 'department', 'mustChangePassword', 'createdAt'];

// This only seeds a fresh Users tab if one doesn't already exist — since
// yours already exists with your real admin account, this constant is
// never used on your deployment. Left as a placeholder for reference.
const DEFAULT_ADMIN_PASSWORD_HASH = 'UNUSED_YOUR_USERS_TAB_ALREADY_EXISTS';

function getOrCreateUsersSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET_NAME);
    sheet.getRange(1, 1, 1, USERS_HEADERS.length).setValues([USERS_HEADERS]);
    sheet.getRange(1, 1, 1, USERS_HEADERS.length)
      .setBackground('#1d64ec')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);

    sheet.appendRow([
      'admin',
      'Administrator',
      DEFAULT_ADMIN_PASSWORD_HASH,
      'Admin',
      '',
      true,
      new Date().toISOString()
    ]);
  }
  return sheet;
}

function findUserRow_(sheet, username) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
      return { rowIndex: i + 1, row: data[i] };
    }
  }
  return null;
}

// The "department" column stores one or more department names as a
// comma-separated string (e.g. "PDC,Die Maint,SPM,Fettling") — one person
// can head multiple departments. Empty/blank means plant-wide (null).
function parseDepartments_(cellValue) {
  const raw = String(cellValue || '').trim();
  if (!raw) return null;
  const list = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  return list.length ? list : null;
}

function joinDepartments_(departments) {
  if (!departments || !departments.length) return '';
  return departments.join(',');
}

function userRowToRecord_(row, includeHash) {
  const record = {
    username: row[0],
    displayName: row[1],
    role: row[3],
    departments: parseDepartments_(row[4]),
    mustChangePassword: row[5] === true || String(row[5]).toUpperCase() === 'TRUE',
    createdAt: row[6]
  };
  if (includeHash) record.passwordHash = row[2];
  return record;
}

function doFetchUsers() {
  try {
    const sheet = getOrCreateUsersSheet_();
    const data = sheet.getDataRange().getValues();
    const users = [];
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      users.push(userRowToRecord_(data[i], false));
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', users: users }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doLogin(payload) {
  try {
    const sheet = getOrCreateUsersSheet_();
    const found = findUserRow_(sheet, payload.username);
    if (!found || found.row[2] !== payload.passwordHash) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid credentials' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      user: userRowToRecord_(found.row, false)
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doCreateUser(payload) {
  try {
    const sheet = getOrCreateUsersSheet_();
    const item = payload.data;
    if (findUserRow_(sheet, item.username)) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Username already exists' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    sheet.appendRow([
      item.username,
      item.displayName,
      item.passwordHash,
      item.role,
      joinDepartments_(item.departments),
      false,
      new Date().toISOString()
    ]);
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doUpdateUser(payload) {
  try {
    const sheet = getOrCreateUsersSheet_();
    const item = payload.data;
    const found = findUserRow_(sheet, item.username);
    if (!found) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'User not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (item.displayName !== undefined) sheet.getRange(found.rowIndex, 2).setValue(item.displayName);
    if (item.role !== undefined) sheet.getRange(found.rowIndex, 4).setValue(item.role);
    if (item.departments !== undefined) sheet.getRange(found.rowIndex, 5).setValue(joinDepartments_(item.departments));
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doDeleteUser(payload) {
  try {
    const sheet = getOrCreateUsersSheet_();
    const found = findUserRow_(sheet, payload.username);
    if (!found) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'User not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    sheet.deleteRow(found.rowIndex);
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doChangePassword(payload) {
  try {
    const sheet = getOrCreateUsersSheet_();
    const found = findUserRow_(sheet, payload.username);
    if (!found) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'User not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    sheet.getRange(found.rowIndex, 3).setValue(payload.newPasswordHash);
    sheet.getRange(found.rowIndex, 6).setValue(!!payload.mustChangePassword);
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// SUPERVISOR MANAGEMENT
// ============================================================
//
// Supervisors are lightweight, name-only entries scoped to a department —
// unlike Users, they have no login (no password, no role). They exist
// purely to populate the Assignee dropdown when creating/editing a task,
// so Admin/PlantHead/MD/DeptHead can add shopfloor staff without a code
// change + redeploy every time. Enforcement of who may add/remove a
// supervisor for which department is frontend-only, matching every other
// action on this Web App (CREATE_TASK, CREATE_USER, etc. are the same —
// there is no per-request auth on this deployment).

const SUPERVISORS_SHEET_NAME = 'Supervisors';
const SUPERVISORS_HEADERS = ['Name', 'Department', 'CreatedAt'];

function getOrCreateSupervisorsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SUPERVISORS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SUPERVISORS_SHEET_NAME);
    sheet.getRange(1, 1, 1, SUPERVISORS_HEADERS.length).setValues([SUPERVISORS_HEADERS]);
    sheet.getRange(1, 1, 1, SUPERVISORS_HEADERS.length)
      .setBackground('#1d64ec')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doFetchSupervisors() {
  try {
    const sheet = getOrCreateSupervisorsSheet_();
    const data = sheet.getDataRange().getValues();
    const supervisors = [];
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      supervisors.push({ name: String(data[i][0]), dept: String(data[i][1] || '') });
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', supervisors: supervisors }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doCreateSupervisor(payload) {
  try {
    const sheet = getOrCreateSupervisorsSheet_();
    const item = payload.data || {};
    const name = String(item.name || '').trim();
    const dept = String(item.dept || '').trim();
    if (!name || !dept) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Name and department are required' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === name.toLowerCase() && String(data[i][1]).toLowerCase() === dept.toLowerCase()) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'This supervisor already exists in this department' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    sheet.appendRow([name, dept, new Date().toISOString()]);
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doDeleteSupervisor(payload) {
  try {
    const sheet = getOrCreateSupervisorsSheet_();
    const name = String(payload.name || '').trim();
    const dept = String(payload.dept || '').trim();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === name.toLowerCase() && String(data[i][1]).toLowerCase() === dept.toLowerCase()) {
        sheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Supervisor not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
