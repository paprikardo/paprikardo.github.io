// Local storage for the app: everything lives in this browser's IndexedDB on the device.
// Stores: exercises, attempts (metadata only), videos (Blob by attempt id),
// thumbs (JPEG Blob by attempt id), meta (key/value settings).

const DB_NAME = 'singing-practice';
const VERSION = 2; // only ever add stores/indexes in upgrades; never drop user data
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        const has = (n) => d.objectStoreNames.contains(n);
        if (!has('exercises')) d.createObjectStore('exercises', { keyPath: 'id' });
        if (!has('attempts')) d.createObjectStore('attempts', { keyPath: 'id' }).createIndex('exerciseId', 'exerciseId');
        for (const n of ['videos', 'thumbs', 'meta', 'refs']) if (!has(n)) d.createObjectStore(n);
      };
      r.onsuccess = () => {
        const d = r.result;
        d.onversionchange = () => d.close(); // let a newer version of the app upgrade
        resolve(d);
      };
      r.onerror = () => reject(r.error);
    });
  }
  return dbPromise;
}

const done = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

// Run a write transaction. `fn` must issue its requests synchronously.
async function write(stores, fn) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const t = d.transaction(stores, 'readwrite');
    fn(t);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('The save was cancelled.'));
  });
}

export async function getAll(store) {
  const d = await open();
  return done(d.transaction(store).objectStore(store).getAll());
}

export async function get(store, key) {
  const d = await open();
  return done(d.transaction(store).objectStore(store).get(key));
}

export async function has(store, key) {
  const d = await open();
  return (await done(d.transaction(store).objectStore(store).count(key))) > 0;
}

export function put(store, value, key) {
  return write([store], (t) => t.objectStore(store).put(value, key));
}

export function putMany(store, values) {
  return write([store], (t) => { const s = t.objectStore(store); values.forEach((v) => s.put(v)); });
}

export function saveAttempt(attempt, video, thumb) {
  return write(['attempts', 'videos', 'thumbs'], (t) => {
    t.objectStore('attempts').put(attempt);
    t.objectStore('videos').put(video, attempt.id);
    if (thumb) t.objectStore('thumbs').put(thumb, attempt.id);
  });
}

export function deleteAttempts(ids) {
  return write(['attempts', 'videos', 'thumbs'], (t) => {
    for (const id of ids) ['attempts', 'videos', 'thumbs'].forEach((s) => t.objectStore(s).delete(id));
  });
}

export function deleteExercise(id, attemptIds) {
  return write(['exercises', 'attempts', 'videos', 'thumbs', 'refs'], (t) => {
    t.objectStore('exercises').delete(id);
    t.objectStore('refs').delete(id);
    for (const a of attemptIds) ['attempts', 'videos', 'thumbs'].forEach((s) => t.objectStore(s).delete(a));
  });
}

// Reference track: the Blob lives in `refs` under the exercise id; metadata on exercise.ref.
export function saveRef(exercise, blob) {
  return write(['exercises', 'refs'], (t) => {
    t.objectStore('exercises').put(exercise);
    if (blob) t.objectStore('refs').put(blob, exercise.id);
    else t.objectStore('refs').delete(exercise.id);
  });
}
