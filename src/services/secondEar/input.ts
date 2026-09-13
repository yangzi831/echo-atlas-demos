import { SERVICE } from './bluetooth';

type KnownDevice = {id: string; name?: string};
type BluetoothAccess = {requestDevice(options: unknown): Promise<KnownDevice>; getDevices?: () => Promise<KnownDevice[]>};
const preferredKey = 'echo-atlas-second-ear-id';
let reusableDevice: KnownDevice | undefined;
let preparing: Promise<void> | undefined;
let selectionVersion = 0;
function access() {return (navigator as Navigator & {bluetooth?: BluetoothAccess}).bluetooth;}

// Read previously granted devices before a click, preserving the user gesture
// for requestDevice when a new permission is actually needed.
export function prepareSecondEar(): Promise<void> {
 if(preparing)return preparing;
 const bluetooth=access();if(!bluetooth?.getDevices)return Promise.resolve();
 const version=selectionVersion;
 preparing=bluetooth.getDevices().then(devices=>{
  if(version!==selectionVersion)return;
  let preferred='';try{preferred=localStorage.getItem(preferredKey)||'';}catch{}
  const candidates=devices.filter(d=>d.name?.startsWith('SecondEar'));
  reusableDevice=devices.find(d=>d.id===preferred) ?? (candidates.length===1?candidates[0]:undefined);
 }).catch(()=>{}).finally(()=>{preparing=undefined;});
 return preparing;
}
export function chooseSecondEar(forceChooser=false): Promise<any> {
 const bluetooth=access();
 if(!bluetooth)return Promise.resolve({error:'此浏览器不支持蓝牙收音，请用桌面 Chrome 打开，并开启电脑蓝牙。'});
 if(!forceChooser&&reusableDevice)return Promise.resolve(reusableDevice);
 // Must be called synchronously from the user's click, without awaiting discovery.
 return bluetooth.requestDevice({filters:[{services:[SERVICE]}],optionalServices:[SERVICE]})
  .then(device=>{selectionVersion++;reusableDevice=device;try{localStorage.setItem(preferredKey,device.id);}catch{}return device;})
  .catch((error:Error)=>({error:error.name==='NotFoundError'?'已取消选择蓝牙设备。':error.message}));
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
