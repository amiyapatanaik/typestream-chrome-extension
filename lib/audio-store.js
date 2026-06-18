const DB_NAME = 'typestream-audio';
const STORE_NAME = 'recordings';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open audio store'));
  });
}

function runTransaction(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('Audio store transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('Audio store transaction aborted'));
  });
}

export async function saveRecordingBlob(blob) {
  const id = crypto.randomUUID();
  const db = await openDb();
  try {
    await runTransaction(db, 'readwrite', (store) => {
      store.put(blob, id);
    });
    return id;
  } finally {
    db.close();
  }
}

export async function loadRecordingBlob(id) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Failed to load recording'));
    });
  } finally {
    db.close();
  }
}

export async function deleteRecordingBlob(id) {
  const db = await openDb();
  try {
    await runTransaction(db, 'readwrite', (store) => {
      store.delete(id);
    });
  } finally {
    db.close();
  }
}
