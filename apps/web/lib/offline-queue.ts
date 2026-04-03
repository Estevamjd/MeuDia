'use client';

interface QueuedAction {
  id: string;
  timestamp: number;
  action: string;
  payload: unknown;
}

const QUEUE_KEY = 'meudia-offline-queue';

function getQueue(): QueuedAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAction[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(action: string, payload: unknown) {
  const queue = getQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    action,
    payload,
  });
  saveQueue(queue);
}

export function dequeue(id: string) {
  const queue = getQueue().filter((item) => item.id !== id);
  saveQueue(queue);
}

export function peekQueue(): QueuedAction[] {
  return getQueue();
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export function getQueueSize(): number {
  return getQueue().length;
}
