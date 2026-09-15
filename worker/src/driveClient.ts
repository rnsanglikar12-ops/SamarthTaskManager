import { Env } from './types';
import { getAccessToken } from './auth';

// Cached per isolate, same rationale as the sheet gid cache — the photo
// folder's id never changes once found.
let cachedFolderId: string | null = null;

async function findOrCreatePhotoFolder(env: Env): Promise<string> {
  if (cachedFolderId) return cachedFolderId;
  const token = await getAccessToken(env);

  const q = encodeURIComponent(
    `name='${env.PHOTO_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!listRes.ok) {
    throw new Error(`Drive folder lookup failed: HTTP ${listRes.status} ${await listRes.text()}`);
  }
  const listData = (await listRes.json()) as { files: { id: string }[] };
  if (listData.files.length > 0) {
    cachedFolderId = listData.files[0].id;
    return cachedFolderId;
  }

  // Fallback: the shared folder wasn't found (e.g. account setup step
  // skipped) — create one under the service account's own Drive space so
  // uploads still work, just not in the plant's familiar folder.
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: env.PHOTO_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
  });
  if (!createRes.ok) {
    throw new Error(`Drive folder creation failed: HTTP ${createRes.status} ${await createRes.text()}`);
  }
  const createData = (await createRes.json()) as { id: string };
  cachedFolderId = createData.id;
  return cachedFolderId;
}

// Uploads a base64 data URL to Drive and returns a plain viewer-page link
// (matching the Apps Script version's file.getUrl() format) — photos are
// click-through links, never embedded <img> thumbnails, so this is exactly
// the URL shape the frontend expects.
export async function uploadPhotoToDrive(env: Env, base64DataUrl: string, filename: string): Promise<string> {
  if (!base64DataUrl.includes('base64,')) {
    throw new Error('Expected a base64 data URL');
  }
  const [prefix, base64Body] = base64DataUrl.split('base64,');
  const contentType = prefix.split(':')[1].split(';')[0];

  const folderId = await findOrCreatePhotoFolder(env);
  const token = await getAccessToken(env);

  const boundary = 'samarth-photo-upload-boundary';
  const metadata = { name: filename, parents: [folderId] };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${contentType}\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${base64Body}\r\n` +
    `--${boundary}--`;

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    }
  );
  if (!uploadRes.ok) {
    throw new Error(`Drive upload failed: HTTP ${uploadRes.status} ${await uploadRes.text()}`);
  }
  const { id } = (await uploadRes.json()) as { id: string };

  const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  });
  if (!permRes.ok) {
    throw new Error(`Drive permission grant failed: HTTP ${permRes.status} ${await permRes.text()}`);
  }

  return `https://drive.google.com/file/d/${id}/view`;
}
