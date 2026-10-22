import { CHECKPOINT_DB_NAME } from '../CheckpointStore.service';

// Rewrites the payload of the newest stored checkpoint without touching its checksum, which is what a torn or altered
// write looks like from the outside.
export const alterNewestCheckpoint = (factory: IDBFactory, alter: (payload: string) => string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const open = factory.open(CHECKPOINT_DB_NAME, 1);
    open.onerror = () => { reject(new Error('could not open the checkpoint database')); };
    open.onsuccess = () => {
      try {
        const database = open.result;
        const transaction = database.transaction('checkpoints', 'readwrite');
        const store = transaction.objectStore('checkpoints');
        const all = store.getAll();
        all.onsuccess = () => {
          const records = all.result as { seq: number; payload: string }[];
          const newest = records[records.length - 1];
          if (!newest) throw new Error('no checkpoint to alter');
          store.put({ ...newest, payload: alter(newest.payload) });
        };
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => { reject(new Error('could not alter the newest checkpoint')); };
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
  });
