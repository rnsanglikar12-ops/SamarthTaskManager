/**
 * SAMARTH INDUSTRIES — USER MANAGEMENT ADD-ON FOR GOOGLE APPS SCRIPT
 *
 * This is NOT a complete Apps Script project — it's an addition to paste
 * into your EXISTING deployed Apps Script (the one behind your Google
 * Sheet Web App URL, already handling tasks).
 *
 * HOW TO INSTALL:
 * 1. Open your Google Sheet > Extensions > Apps Script.
 * 2. Paste everything below the "NEW FUNCTIONS" marker as new functions
 *    anywhere in your existing script (do not remove your existing code).
 * 3. Find your existing doGet(e) function and add the two lines shown in
 *    the "ROUTING TO ADD" section below, near the top, before your
 *    existing action handling.
 * 4. Do the same for doPost(e).
 * 5. Click Deploy > Manage Deployments > Edit (pencil icon) > New Version
 *    > Deploy. This updates the SAME Web App URL already in use — no
 *    need to reconnect the app.
 *
 * A "Users" tab will be created automatically the first time FETCH_USERS
 * or LOGIN is called, seeded with one default Admin account (username
 * "admin"). Before pasting this in, generate a hash for your own chosen
 * temporary password and replace DEFAULT_ADMIN_PASSWORD_HASH below:
 *   echo -n "your-temp-password" | shasum -a 256
 * Log in with that password immediately, then create real named accounts
 * via "Manage Users" in the app, and change this temporary password (or
 * delete the row entirely once you have another Admin account).
 */

// ============================================================
// ROUTING TO ADD to your EXISTING doGet(e) function:
// ============================================================
//   const action = (e && e.parameter && e.parameter.action) || 'FETCH_ALL';
//   if (action === 'FETCH_USERS') return doFetchUsers();
//   // ... your existing doGet action handling continues below ...

// ============================================================
// ROUTING TO ADD to your EXISTING doPost(e) function:
// ============================================================
//   const payload = JSON.parse(e.postData.contents);
//   const action = payload.action;
//   if (action === 'LOGIN') return doLogin(payload);
//   if (action === 'CREATE_USER') return doCreateUser(payload);
//   if (action === 'UPDATE_USER') return doUpdateUser(payload);
//   if (action === 'DELETE_USER') return doDeleteUser(payload);
//   if (action === 'CHANGE_PASSWORD') return doChangePassword(payload);
//   // ... your existing doPost action handling continues below ...

// ============================================================
// NEW FUNCTIONS — paste everything below this line
// ============================================================

const USERS_SHEET_NAME = 'Users';
const USERS_HEADERS = ['username', 'displayName', 'passwordHash', 'role', 'department', 'mustChangePassword', 'createdAt'];

// Replace with: echo -n "your-temp-password" | shasum -a 256
// Do not commit a real password hash here — generate your own before deploying.
const DEFAULT_ADMIN_PASSWORD_HASH = 'REPLACE_WITH_YOUR_OWN_SHA256_HASH';

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

function userRowToRecord_(row, includeHash) {
  const record = {
    username: row[0],
    displayName: row[1],
    role: row[3],
    department: row[4] || null,
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
      users.push(userRowToRecord_(data[i], false)); // never include password hashes here
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
      item.department || '',
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
    if (item.department !== undefined) sheet.getRange(found.rowIndex, 5).setValue(item.department || '');
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
