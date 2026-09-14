import { ActionItem } from '../types';

// Helper to check if a task was raised to another department (Inter-departmental CFT Handshake)
export function isRaisedToOtherDept(originatorDept?: string, targetDept?: string): boolean {
  if (!originatorDept || !targetDept) return false;
  const orig = originatorDept.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = targetDept.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (!orig || !target) return false;
  if (orig === target) return false;
  // If one starts with the other or is identical (e.g. "machineshop" vs "machineshop01", or "quality" vs "qualitydept")
  if (orig.startsWith(target) || target.startsWith(orig)) return false;
  return true;
}

// Shared DSI/Kaizen classification predicate — used both to build the
// Kaizen/DSI tab's list and to compute the header's tab badge count, so the
// two always agree with each other.
//
// This must be the *only* signal — a task is DSI iff isKaizen is true.
// It used to also fuzzy-match the description/notes text for words like
// "kaizen", "dsi", "5s", which swept in any task that merely mentioned
// common plant terminology, and permanently trapped every task created
// while isKaizen defaulted to true (see NewActionModal) since that bug
// also baked a "[DSI Kaizen]" prefix into the description text. isKaizen
// is only ever set via ActionDetailModal's explicit, gated conversion
// (Completed status + before/after photos + notes) — nothing should
// second-guess that.
export function isKaizenAction(a: ActionItem): boolean {
  return a.isKaizen;
}

const STORAGE_KEY = 'samarth_industries_matrix_v4';

// Tasks live entirely in the connected Google Sheet — this is only an
// offline/first-paint cache of whatever was last fetched from it. A fresh
// install or a cleared Sheet starts with an empty list, not seed/demo data.
export function getInitialActions(): ActionItem[] {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: ActionItem[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse actions from localStorage', e);
    }
  }
  return [];
}

export function saveActionsToStorage(actions: ActionItem[]): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
    } catch (e) {
      console.error('Failed to save actions to localStorage', e);
    }
  }
}
