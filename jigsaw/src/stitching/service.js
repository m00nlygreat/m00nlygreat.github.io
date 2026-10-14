export function createStitchingService() {
  let activeWorker = null;
  let currentId = null;

  function run(images, onProgress) {
    if (activeWorker) return Promise.reject(new Error('이미지 처리가 진행 중입니다.'));
    const operationId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    activeWorker = worker;
    currentId = operationId;
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        worker.terminate();
        if (activeWorker === worker) {
          activeWorker = null;
          currentId = null;
        }
      };
      const fail = (error) => {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      };
      worker.onmessage = (event) => {
        const message = event.data;
        if (message.operationId !== operationId) return;
        if (message.type === 'progress') {
          try { onProgress?.(message); }
          catch (error) { fail(error); }
        }
        if (message.type === 'result') {
          cleanup();
          resolve(message);
        }
        if (message.type === 'error') {
          fail(new Error(message.message));
        }
      };
      worker.onerror = (event) => fail(new Error(event.message || '스티칭 워커를 실행하지 못했습니다.'));
      worker.onmessageerror = () => fail(new Error('스티칭 결과를 읽지 못했습니다.'));
      try { worker.postMessage({ operationId, images }); }
      catch (error) { fail(error); }
    });
  }

  function close() {
    activeWorker?.terminate();
    activeWorker = null;
    currentId = null;
  }

  return { run, close, get operationId() { return currentId; } };
}
