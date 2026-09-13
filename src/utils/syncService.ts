import { ActionItem } from '../types';

let currentLocalVersion = 0;
let broadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('samarth_task_sync');
  }
} catch (e) {
  console.warn('BroadcastChannel not supported', e);
}

export function getLocalVersion(): number {
  return currentLocalVersion;
}

export function setLocalVersion(v: number): void {
  currentLocalVersion = v;
}

export function broadcastLocalUpdate(type: 'UPDATE' | 'DELETE' | 'FULL_SYNC', payload: any) {
  try {
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type, payload, timestamp: Date.now() });
    }
  } catch (e) {
    console.error('Failed to broadcast message', e);
  }
}

export function subscribeToTabBroadcast(onMessage: (data: { type: string; payload: any }) => void): () => void {
  if (!broadcastChannel) return () => {};
  const handler = (event: MessageEvent) => {
    if (event.data) {
      onMessage(event.data);
    }
  };
  broadcastChannel.addEventListener('message', handler);
  return () => {
    broadcastChannel?.removeEventListener('message', handler);
  };
}

/**
 * Fetch latest actions from central server
 */
export async function fetchServerActions(): Promise<{ actions: ActionItem[]; version: number; count: number } | null> {
  try {
    const res = await fetch('/api/actions', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.actions)) {
      currentLocalVersion = data.version || Date.now();
      return {
        actions: data.actions,
        version: currentLocalVersion,
        count: data.count || data.actions.length
      };
    }
    return null;
  } catch (e) {
    console.warn('Failed to fetch actions from server API:', e);
    return null;
  }
}

/**
 * Check if the server has newer updates than our local version
 */
export async function checkServerVersion(): Promise<{ version: number; count: number } | null> {
  try {
    const res = await fetch('/api/actions/version', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      version: data.version,
      count: data.count
    };
  } catch (e) {
    return null;
  }
}

/**
 * Push full actions array to server (used during initial seed or full matrix sync)
 */
export async function pushAllActionsToServer(actions: ActionItem[]): Promise<number | null> {
  try {
    const res = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.version) {
      currentLocalVersion = data.version;
    }
    broadcastLocalUpdate('FULL_SYNC', { count: actions.length });
    return currentLocalVersion;
  } catch (e) {
    console.warn('Failed to push actions to server:', e);
    return null;
  }
}

/**
 * Push single action update to server
 */
export async function pushSingleActionUpdate(action: ActionItem): Promise<boolean> {
  try {
    const res = await fetch('/api/actions/update-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.version) {
        currentLocalVersion = data.version;
      }
      broadcastLocalUpdate('UPDATE', action);
      return true;
    }
    return false;
  } catch (e) {
    console.warn('Failed to sync action update to server:', e);
    return false;
  }
}

/**
 * Push single action deletion to server
 */
export async function pushSingleActionDelete(id: number): Promise<boolean> {
  try {
    const res = await fetch('/api/actions/delete-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.version) {
        currentLocalVersion = data.version;
      }
      broadcastLocalUpdate('DELETE', { id });
      return true;
    }
    return false;
  } catch (e) {
    console.warn('Failed to sync action delete to server:', e);
    return false;
  }
}
