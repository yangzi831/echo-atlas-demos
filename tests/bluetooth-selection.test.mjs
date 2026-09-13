import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
test('已授权设备复用、多设备选择、强制更换与取消',async()=>{
 const server=await createServer({server:{middlewareMode:true,ws:false},cacheDir:'node_modules/.vite-tests/bluetooth',optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'});
 const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const originalStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 let devices=[],calls=0,cancel=false;const storage=new Map();
 const first={id:'first',name:'SecondEar'},second={id:'second',name:'SecondEar-2'};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{bluetooth:{getDevices:async()=>devices,requestDevice:async()=>{calls++;if(cancel)throw Object.assign(Error('cancel'),{name:'NotFoundError'});return second;}}}});
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});
 try{
  const {prepareSecondEar,chooseSecondEar}=await server.ssrLoadModule('/src/services/secondEar/input.ts');
  devices=[first];await prepareSecondEar();assert.equal(await chooseSecondEar(),first);assert.equal(calls,0);
  devices=[first,second];await prepareSecondEar();assert.equal(await chooseSecondEar(),second);assert.equal(calls,1);
  await prepareSecondEar();assert.equal(await chooseSecondEar(),second);assert.equal(calls,1);
  await chooseSecondEar(true);assert.equal(calls,2);
  cancel=true;assert.equal((await chooseSecondEar(true)).error,'已取消选择蓝牙设备。');
  devices=[];await prepareSecondEar();assert.equal((await chooseSecondEar()).error,'已取消选择蓝牙设备。');assert.equal(calls,4);
 }finally{
  if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;
  if(originalStorage)Object.defineProperty(globalThis,'localStorage',originalStorage);else delete globalThis.localStorage;
  await server.close();
 }
});
