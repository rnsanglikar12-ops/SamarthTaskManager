let broadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('samarth_task_sync');
  }
} catch (e) {
  console.warn('BroadcastChannel not supported', e);
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
