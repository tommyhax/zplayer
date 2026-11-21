// Where a saved game goes: one slot a title, in the browser's IndexedDB, which a page
// opened from the home screen and a native shell both keep.

/** A store the player reads before a story starts and writes behind a SAVE. */
export interface SaveStore {
  load(id: string): Promise<Uint8Array | undefined>;
  store(id: string, data: Uint8Array): Promise<void>;
}

const DB = "z-player";
const STORE = "saves";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function indexedDbSaves(): SaveStore {
  return {
    async load(id) {
      const db = await open();
      try {
        const found = await done(db.transaction(STORE, "readonly").objectStore(STORE).get(id));
        return found instanceof Uint8Array ? found : undefined;
      } finally {
        db.close();
      }
    },
    async store(id, data) {
      const db = await open();
      try {
        await done(db.transaction(STORE, "readwrite").objectStore(STORE).put(data, id));
      } finally {
        db.close();
      }
    },
  };
}

/** No store at all: SAVE fails and RESTORE finds nothing, as on a machine with no disk. */
export function noSaves(): SaveStore {
  return { load: () => Promise.resolve(undefined), store: () => Promise.resolve() };
}
