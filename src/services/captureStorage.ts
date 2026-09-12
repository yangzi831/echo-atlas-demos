import type { SoundMemory } from '../types/sound';

const DATABASE_NAME = 'echo-atlas';
const DATABASE_VERSION = 1;
const STORE_NAME = 'sound-memories';

type StoredCapture = {
  id: string;
  memory: SoundMemory;
  audioBlob: Blob;
  imageBlob?: Blob;
};

export type CapturedMemoryAssets = {
  memory: SoundMemory;
  audioBlob: Blob;
  imageBlob?: Blob;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open local sound archive'));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local sound archive operation failed'));
  });
}

export async function saveCapturedMemory({ memory, audioBlob, imageBlob }: CapturedMemoryAssets) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const persistedMemory = { ...memory, audioUrl: '', imageUrl: imageBlob ? '' : memory.imageUrl };
    await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error('声音保存失败'));
    transaction.objectStore(STORE_NAME).put({
      id: memory.id,
      memory: persistedMemory,
      audioBlob,
      imageBlob,
    } satisfies StoredCapture);
    });
  } finally {
    database.close();
  }
}

export async function loadCapturedMemories(): Promise<SoundMemory[]> {
  if (!('indexedDB' in window)) return [];
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const records = await requestResult(transaction.objectStore(STORE_NAME).getAll()) as StoredCapture[];
    return records.map(({ memory, audioBlob, imageBlob }) => ({
      ...memory,
      audioUrl: URL.createObjectURL(audioBlob),
      imageUrl: imageBlob ? URL.createObjectURL(imageBlob) : memory.imageUrl,
    }));
  } finally {
    database.close();
  }
}

export async function updateCapturedMemory(memory: SoundMemory) {
 const database = await openDatabase();
 try {
  await new Promise<void>((resolve,reject)=>{
   const tx=database.transaction(STORE_NAME,'readwrite');
   tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error??new Error('无法保存这条记忆的反馈'));
   const store=tx.objectStore(STORE_NAME),request=store.get(memory.id);
   request.onsuccess=()=>{if(!request.result){tx.abort();return;}store.put({...request.result,memory:{...memory,audioUrl:'',imageUrl:request.result.imageBlob?'':memory.imageUrl}});};
  });
 } finally {database.close();}
}
