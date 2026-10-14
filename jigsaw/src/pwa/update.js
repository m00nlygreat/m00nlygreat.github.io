export async function applyWaitingUpdate({ worker, persist, isSafeToReload }) {
  if (!worker) return false;
  await persist();
  if (!isSafeToReload()) return false;
  worker.postMessage({ type: 'SKIP_WAITING' });
  return true;
}
