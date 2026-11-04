// Draf LPJ disimpan di IndexedDB browser ini saja (tidak pernah dikirim ke server).
const DB = 'lpj-maker', STORE = 'draft', KEY = 'current';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadDraft() {
  try { return (await run('readonly', (s) => s.get(KEY))) || null; } catch { return null; }
}

export async function saveDraft(state) {
  try { await run('readwrite', (s) => s.put(state, KEY)); return true; } catch { return false; }
}

export async function clearDraft() {
  try { await run('readwrite', (s) => s.delete(KEY)); } catch { /* abaikan */ }
}
