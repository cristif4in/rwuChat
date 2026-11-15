/* ---- IndexedDB key-value store ----
 * Chats/settings are too big (and too append-heavy) for localStorage's
 * ~5 MB quota, so they live in IndexedDB instead. One DB, one store,
 * get/set returning Promises. No libraries.
 */
const IDB_NAME = 'rwuchat', IDB_STORE = 'kv';
let _idbPromise = null;

function idbOpen() {
  if (_idbPromise) return _idbPromise;
  _idbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _idbPromise;
}

async function idbTx(mode, fn) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, mode);
    const st = tx.objectStore(IDB_STORE);
    const out = fn(st);
    tx.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const idbGet = key => idbTx('readonly', st => st.get(key));
const idbSet = (key, val) => idbTx('readwrite', st => st.put(val, key));
