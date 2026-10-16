const QUEUE_KEY = 'enotes:offline:mutations:v1';
export function getPendingOfflineMutations(storage) {
  try { const queue = JSON.parse(storage.getItem(QUEUE_KEY) || '[]'); return Array.isArray(queue) ? queue.filter((item) => item && typeof item.id === 'string') : []; }
  catch { return []; }
}
export function enqueueOfflineMutation(storage, mutation) {
  if (!mutation || !['update', 'patch'].includes(mutation.kind) || typeof mutation.subject !== 'string' || !mutation.subject || !Number.isInteger(mutation.number) || mutation.number < 1) return null;
  try {
    const queue = getPendingOfflineMutations(storage);
    const item = { ...mutation, id: `${mutation.kind}:${mutation.subject}:${mutation.number}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`, queuedAt: new Date().toISOString() };
    const previousIndex = queue.findLastIndex((entry) => entry.subject === item.subject && entry.number === item.number && entry.kind === item.kind);
    if (previousIndex >= 0 && item.kind === 'update') queue.splice(previousIndex, 1);
    queue.push(item); storage.setItem(QUEUE_KEY, JSON.stringify(queue)); return item;
  } catch { return null; }
}
export function removePendingOfflineMutation(storage, id) {
  try { const queue = getPendingOfflineMutations(storage).filter((item) => item.id !== id); storage.setItem(QUEUE_KEY, JSON.stringify(queue)); return queue.length; }
  catch { return null; }
}
