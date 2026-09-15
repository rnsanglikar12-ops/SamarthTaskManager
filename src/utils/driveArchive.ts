// Compliance-export-only: copies a Supabase Storage-hosted photo into
// Google Drive, so the exported CSV's photo evidence survives independently
// of the Supabase project (the whole point of a compliance export — see
// PROJECT_CONTEXT.md). Reuses the deprecated Apps Script backend's
// still-deployed, still-working UPLOAD_PHOTO action for the actual Drive
// write (it already has DriveApp access as the plant's Google account — no
// new Google Cloud service account/credentials needed). This is the ONLY
// place in the app that still calls into the deprecated googleSheetsService
// module, and only for this one narrow capability — not a revival of the
// Sheets backend for tasks/users/supervisors.
import { uploadPhotoToGoogleSheet as uploadPhotoToDrive } from './googleSheetsService';

function blobToBase64DataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read photo blob'));
    reader.readAsDataURL(blob);
  });
}

// Returns the Drive URL, or null if the fetch/upload failed — callers
// should fall back to the original Supabase URL rather than blocking a
// whole export over one bad photo.
export async function archivePhotoToDrive(sourceUrl: string, filename: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const base64 = await blobToBase64DataUrl(blob);
    return await uploadPhotoToDrive(base64, filename);
  } catch (err) {
    console.warn(`Failed to archive photo to Drive: ${sourceUrl}`, err);
    return null;
  }
}

// Runs `worker` over every item with at most `concurrency` in flight at
// once — a full compliance export can involve dozens of photos, and the
// Apps Script backend has its own per-project concurrent-execution limit
// (see PROJECT_CONTEXT.md's notes on its latency characteristics), so
// neither fully-sequential (too slow) nor fully-parallel (risks throttling)
// is the right call.
export async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency = 4
): Promise<void> {
  let index = 0;
  async function next(): Promise<void> {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
}
