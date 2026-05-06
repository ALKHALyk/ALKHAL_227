// ============================================================
// ALKHAL227 — IndexedDB Layer
// © ALKHAL_YOUSEF_FUAD_KAMEL — All Rights Reserved
// ============================================================

const DB_NAME = 'ALKHAL227_DB';
const DB_VERSION = 2;
const STORE_CANDLES = 'candles';
const STORE_INSTRUMENTS = 'instruments';
const STORE_HOURLY = 'hourly_candles';

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_CANDLES)) {
        const s = db.createObjectStore(STORE_CANDLES, { keyPath: ['instrument', 'date'] });
        s.createIndex('by_instrument', 'instrument', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_INSTRUMENTS)) {
        db.createObjectStore(STORE_INSTRUMENTS, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(STORE_HOURLY)) {
        const h = db.createObjectStore(STORE_HOURLY, { keyPath: ['instrument', 'datetime'] });
        h.createIndex('by_instrument', 'instrument', { unique: false });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function saveInstrument(name, meta = {}) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_INSTRUMENTS, 'readwrite');
    tx.objectStore(STORE_INSTRUMENTS).put({ name, ...meta, updatedAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getAllInstruments() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_INSTRUMENTS, 'readonly');
    const req = tx.objectStore(STORE_INSTRUMENTS).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteInstrument(name) {
  const db = await openDB();
  return new Promise(async (resolve, reject) => {
    // Delete meta
    const tx1 = db.transaction(STORE_INSTRUMENTS, 'readwrite');
    tx1.objectStore(STORE_INSTRUMENTS).delete(name);
    await new Promise(r => { tx1.oncomplete = r; });

    // Delete all candles for instrument
    const tx2 = db.transaction(STORE_CANDLES, 'readwrite');
    const store = tx2.objectStore(STORE_CANDLES);
    const idx = store.index('by_instrument');
    const req = idx.getAll(name);
    req.onsuccess = () => {
      const recs = req.result;
      recs.forEach(r => store.delete([r.instrument, r.date]));
    };
    tx2.oncomplete = resolve;
    tx2.onerror = (e) => reject(e.target.error);
  });
}

async function bulkSaveCandles(instrument, candles, onProgress) {
  const db = await openDB();
  const CHUNK = 500;
  for (let i = 0; i < candles.length; i += CHUNK) {
    const chunk = candles.slice(i, i + CHUNK);
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CANDLES, 'readwrite');
      const store = tx.objectStore(STORE_CANDLES);
      chunk.forEach(c => store.put({ ...c, instrument }));
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    });
    if (onProgress) onProgress(Math.min(i + CHUNK, candles.length), candles.length);
  }
}

async function addCandle(instrument, candle) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CANDLES, 'readwrite');
    tx.objectStore(STORE_CANDLES).put({ ...candle, instrument });
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getAllCandles(instrument) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CANDLES, 'readonly');
    const idx = tx.objectStore(STORE_CANDLES).index('by_instrument');
    const req = idx.getAll(instrument);
    req.onsuccess = () => {
      const sorted = req.result.sort((a, b) => a.date.localeCompare(b.date));
      resolve(sorted);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getCandleByDate(instrument, date) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CANDLES, 'readonly');
    const req = tx.objectStore(STORE_CANDLES).get([instrument, date]);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function bulkSaveHourly(instrument, candles) {
  const db = await openDB();
  const CHUNK = 500;
  for (let i = 0; i < candles.length; i += CHUNK) {
    const chunk = candles.slice(i, i + CHUNK);
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_HOURLY, 'readwrite');
      const store = tx.objectStore(STORE_HOURLY);
      chunk.forEach(c => store.put({ ...c, instrument }));
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    });
  }
}

async function getHourlyByDate(instrument, dateStr) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HOURLY, 'readonly');
    const idx = tx.objectStore(STORE_HOURLY).index('by_instrument');
    const req = idx.getAll(instrument);
    req.onsuccess = () => {
      const filtered = req.result.filter(c => c.datetime.startsWith(dateStr));
      resolve(filtered.sort((a, b) => a.datetime.localeCompare(b.datetime)));
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

window.DB = {
  openDB, saveInstrument, getAllInstruments, deleteInstrument,
  bulkSaveCandles, addCandle, getAllCandles, getCandleByDate,
  bulkSaveHourly, getHourlyByDate
};
