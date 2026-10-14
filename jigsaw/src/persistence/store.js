const DATABASE_NAME = 'jigsaw.local';
const LEGACY_DATABASE_NAME = 'stitchboard.local';
const DATABASE_VERSION = 1;
const STORE_NAME = 'snapshots';
const SNAPSHOT_KEY = 'current';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('저장소 요청에 실패했습니다.'));
  });
}

function openExistingDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    let abortedCreation = false;
    request.onupgradeneeded = (event) => {
      if (event.oldVersion !== 0) return;
      abortedCreation = true;
      request.transaction.abort();
    };
    request.onsuccess = () => {
      if (!abortedCreation) return resolve(request.result);
      request.result.close();
      resolve(null);
    };
    request.onerror = () => {
      if (abortedCreation && request.error?.name === 'AbortError') return resolve(null);
      reject(request.error || new Error('이전 작업 저장소를 열지 못했습니다.'));
    };
    request.onblocked = () => reject(new Error('다른 창에서 이전 작업 저장소를 사용 중입니다.'));
  });
}

async function readSnapshot(database) {
  if (!database.objectStoreNames.contains(STORE_NAME)) return null;
  const transaction = database.transaction(STORE_NAME, 'readonly');
  return requestResult(transaction.objectStore(STORE_NAME).get(SNAPSHOT_KEY));
}

function validateSnapshot(record) {
  if (record.schemaVersion !== 1 || !record.document || record.document.schemaVersion !== 1) {
    throw new Error('저장된 작업의 버전을 해석할 수 없습니다. 기존 데이터는 그대로 보존했습니다.');
  }
  if (!Array.isArray(record.assets) || !record.view) throw new Error('저장된 작업 일부를 읽을 수 없습니다. 기존 데이터는 그대로 보존했습니다.');
  return record;
}

export class LocalStore {
  constructor() {
    this.databasePromise = null;
  }

  open() {
    if (this.databasePromise) return this.databasePromise;
    if (!globalThis.indexedDB) return Promise.reject(new Error('이 브라우저는 IndexedDB를 지원하지 않습니다.'));
    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('로컬 저장소를 열지 못했습니다.'));
      request.onblocked = () => reject(new Error('다른 창에서 저장소를 사용 중입니다. 창을 닫고 다시 시도해 주세요.'));
    }).catch((error) => {
      this.databasePromise = null;
      throw error;
    });
    return this.databasePromise;
  }

  async load() {
    const database = await this.open();
    const currentRecord = await readSnapshot(database);
    if (currentRecord) return validateSnapshot(currentRecord);
    const legacyDatabase = await openExistingDatabase(LEGACY_DATABASE_NAME);
    if (!legacyDatabase) return null;
    let legacyRecord;
    try { legacyRecord = await readSnapshot(legacyDatabase); }
    finally { legacyDatabase.close(); }
    if (!legacyRecord) return null;
    validateSnapshot(legacyRecord);
    await this.save(legacyRecord);
    return legacyRecord;
  }

  async save(record) {
    const database = await this.open();
    let transaction;
    try {
      transaction = database.transaction(STORE_NAME, 'readwrite', { durability: 'strict' });
    } catch {
      transaction = database.transaction(STORE_NAME, 'readwrite');
    }
    const done = new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('로컬 저장에 실패했습니다.'));
      transaction.onabort = () => reject(transaction.error || new Error('로컬 저장이 중단되었습니다.'));
    });
    transaction.objectStore(STORE_NAME).put({ ...record, schemaVersion: 1, savedAt: Date.now() }, SNAPSHOT_KEY);
    await done;
  }
}
