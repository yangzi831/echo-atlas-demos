import { SERVICE } from './bluetooth';

// Must run inside the start button's user gesture, before React mounts the session.
export function chooseSecondEar(): Promise<any> {
 const bluetooth = (navigator as Navigator & {bluetooth?: {requestDevice(options: unknown): Promise<unknown>}}).bluetooth;
 if (!bluetooth) return Promise.resolve({error: '此浏览器不支持蓝牙收音，请用桌面 Chrome 打开，并开启电脑蓝牙。'});
 return bluetooth.requestDevice({filters: [{services: [SERVICE]}], optionalServices: [SERVICE]})
  .catch((error: Error) => ({error: error.name === 'NotFoundError' ? '已取消选择蓝牙设备。' : error.message}));
}

// Commit each segment before EarLink acknowledges it to the hardware.
export async function persistSegment(blob: Blob, info?: {session: string; offset: number}) {
 const db = await new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('echo-atlas-bluetooth', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('segments');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
 });
 try {
  await new Promise<void>((resolve, reject) => {
   const tx = db.transaction('segments', 'readwrite');
   tx.objectStore('segments').put(blob, info ? `${info.session}:${info.offset}` : crypto.randomUUID());
   tx.oncomplete = () => resolve();
   tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('蓝牙音频暂存失败'));
  });
 } finally { db.close(); }
}
