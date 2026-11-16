import { db, selectDatabase, type YunflowDB, type Tombstone, type PhotoAttachment } from './db';
import type { Place, Memory } from './model';
import { authenticateLocal } from './localAccounts';
import { base64ToBlob, blobToBase64, photoId } from './photoData';

export type Account = { id: string; username: string; scope?: 'local'|'cloud' };
const native = () => Boolean((window as any).Capacitor?.isNativePlatform?.());
const cloudBase = 'https://yunflow-memory-map.thinmerit.chatgpt.site';
const metaKey = 'yunflow-account';
const tokenKey = 'yunflow-session';
async function nativeStore() { return (await import('@capacitor/preferences')).Preferences; }
function withTimeout<T>(promise:Promise<T>,ms:number):Promise<T>{let timer:ReturnType<typeof setTimeout>;return Promise.race([promise,new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new Error('连接超时')),ms);})]).finally(()=>clearTimeout(timer));}
async function storedToken() {
  if(!native())return null;
  const cached=localStorage.getItem(tokenKey);if(cached)return cached;
  try {const token=(await withTimeout(nativeStore().then(store=>store.get({key:tokenKey})),1800)).value;if(token)localStorage.setItem(tokenKey,token);return token;}
  catch{return null;}
}
type ApiResult={status:number;data:any};
async function webRequest(url:string,init:RequestInit,headers:Record<string,string>,ms:number):Promise<ApiResult>{
  const controller=new AbortController();
  try {const response=await withTimeout(fetch(url,{...init,credentials:native()?'omit':'include',headers:{...headers,...init.headers},signal:controller.signal}),ms);return {status:response.status,data:await withTimeout(response.json(),ms)};}
  finally{controller.abort();}
}
async function nativeRequest(url:string,init:RequestInit,headers:Record<string,string>):Promise<ApiResult>{
  const {CapacitorHttp}=await import('@capacitor/core');
  const response=await withTimeout(CapacitorHttp.request({url,method:init.method??'GET',headers,data:init.body?JSON.parse(String(init.body)):undefined,connectTimeout:10000,readTimeout:12000,responseType:'json'}),14000);
  return {status:response.status,data:typeof response.data==='string'?JSON.parse(response.data):response.data};
}
async function request(path:string, init:RequestInit={}, onProgress?:(message:string)=>void) {
  const token=path==='register'||path==='login'?null:await storedToken();
  const headers={'content-type':'application/json',...(native()?{'x-yunflow-native':'1'}:{}),...(token?{authorization:`Bearer ${token}`}:{})};
  let result:ApiResult;
  try {
    if(native()) {
      const url=`${cloudBase}/api/${path}`;
      onProgress?.('正在连接账户服务…');
      try {result=await webRequest(url,init,headers,9000);}
      catch {onProgress?.('网页连接未响应，尝试原生连接…');result=await nativeRequest(url,init,headers);}
    } else {
      onProgress?.('正在连接账户服务…');
      result=await webRequest(`/api/${path}`,init,headers,14000);
    }
  } catch { throw new Error('云端连接超时或被网络阻断。请确认手机浏览器能打开云流网站；本机账户仍可离线使用。'); }
  if(result.status<200||result.status>=300) { const error = new Error(result.data?.error||`请求失败：${result.status}`) as Error & {status:number}; error.status=result.status; throw error; }
  return result.data;
}
async function photoHeaders(type?:string){const token=await storedToken();return {...(token?{authorization:`Bearer ${token}`}:{}) ,...(type?{'content-type':type}:{})};}
async function uploadPhoto(attachment:PhotoAttachment){
  const url=`${cloudBase}/api/photo/${attachment.id}`;
  const headers=await photoHeaders(attachment.blob.type);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
  try{
    try{
      const response=await fetch(native()?url:`/api/photo/${attachment.id}`,{method:'PUT',body:attachment.blob,headers,credentials:native()?'omit':'include',signal:controller.signal});
      if(!response.ok)throw Object.assign(new Error((await response.json().catch(()=>({}))).error||`图片上传失败：${response.status}`),{status:response.status});
      return;
    }catch(error){
      if(!native()||(error as {status?:number}).status)throw error;
      const {CapacitorHttp}=await import('@capacitor/core');
      const response=await CapacitorHttp.put({url,headers,data:await blobToBase64(attachment.blob),dataType:'file',connectTimeout:15000,readTimeout:90000,responseType:'json'});
      if(response.status<200||response.status>=300)throw new Error(response.data?.error||`图片上传失败：${response.status}`);
    }
  }finally{clearTimeout(timer);}
}
async function downloadPhoto(id:string):Promise<PhotoAttachment>{
  const url=`${cloudBase}/api/photo/${id}`;
  const headers=await photoHeaders();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
  try{
    try{
      const response=await fetch(native()?url:`/api/photo/${id}`,{headers,credentials:native()?'omit':'include',signal:controller.signal});
      if(!response.ok)throw Object.assign(new Error(`图片下载失败：${response.status}`),{status:response.status});
      return {id,blob:await response.blob(),uploaded:true};
    }catch(error){
      if(!native()||(error as {status?:number}).status)throw error;
      const {CapacitorHttp}=await import('@capacitor/core');
      const response=await CapacitorHttp.get({url,headers,connectTimeout:15000,readTimeout:90000,responseType:'blob'});
      if(response.status<200||response.status>=300)throw new Error(`图片下载失败：${response.status}`);
      const type=response.headers['content-type']||response.headers['Content-Type']||'image/jpeg';
      return {id,blob:base64ToBlob(String(response.data),type),uploaded:true};
    }
  }finally{clearTimeout(timer);}
}
export async function loadAccount(localOnly = false):Promise<Account|null> {
  const saved=localStorage.getItem(metaKey);let cached:Account|null=null;try{cached=saved?JSON.parse(saved):null;}catch{}
  if(localOnly)return cached?.scope==='local'?cached:null;
  if(cached?.scope==='local'||!navigator.onLine)return cached;
  try { const result=await request('me'); localStorage.setItem(metaKey,JSON.stringify(result.account)); return result.account; }
  catch (error) { if ((error as {status?:number}).status===401) { localStorage.removeItem(metaKey); if(native()) await (await nativeStore()).remove({key:tokenKey}); return null; } return cached; }
}
export async function authenticate(mode:'register'|'login',username:string,password:string,onProgress?:(message:string)=>void):Promise<Account> {
  let result:any;
  try{result=await request(mode,{method:'POST',body:JSON.stringify({username,password})},onProgress);}
  catch(error){if(mode!=='register'||(error as {status?:number}).status!==409)throw error;onProgress?.('账户已创建，正在登录…');result=await request('login',{method:'POST',body:JSON.stringify({username,password})},onProgress);}
  if(native() && result.token){localStorage.setItem(tokenKey,result.token);void withTimeout(nativeStore().then(store=>store.set({key:tokenKey,value:result.token})),1800).catch(()=>{});}
  const account={...result.account,scope:'cloud' as const};localStorage.setItem(metaKey,JSON.stringify(account)); return account;
}
export async function authenticateOnDevice(mode:'register'|'login',username:string,password:string):Promise<Account>{const account=await authenticateLocal(mode,username,password);localStorage.setItem(metaKey,JSON.stringify(account));return account;}
export async function signOut(){let current:Account|null=null;try{current=JSON.parse(localStorage.getItem(metaKey)||'null');}catch{}if(current?.scope!=='local'){void request('logout',{method:'POST'}).catch(()=>{});localStorage.removeItem(tokenKey);if(native())void withTimeout(nativeStore().then(store=>store.remove({key:tokenKey})),1800).catch(()=>{});}localStorage.removeItem(metaKey);selectDatabase(null);}
export async function syncAccount(database:YunflowDB=db) {
  const [places,memories,tombstones]=await Promise.all([database.places.toArray(),database.memories.toArray(),database.tombstones.toArray()]);
  const localPhotoIds=new Set(memories.flatMap(m=>(m.images??[]).map(photoId).filter((id):id is string=>id!==null)));
  for(const id of localPhotoIds){const attachment=await database.attachments.get(id);if(!attachment)throw new Error('本机缺少记忆图片，已暂停同步');if(!attachment.uploaded){await uploadPhoto(attachment);await database.attachments.update(id,{uploaded:true});}}
  const restoreKey=`yunflow-pending-restore-${database.name}`;
  const sendBatches=async()=>{
    let batch:{places:Place[];memories:Memory[];tombstones:Tombstone[]}={places:[],memories:[],tombstones:[]};
    const send=async()=>{if(batch.places.length||batch.memories.length||batch.tombstones.length)await request('sync',{method:'POST',body:JSON.stringify(batch)});batch={places:[],memories:[],tombstones:[]};};
    for(const [kind,items] of [['places',places],['memories',memories],['tombstones',tombstones]] as const){
      for(const item of items){(batch[kind] as typeof items).push(item as never);if(new TextEncoder().encode(JSON.stringify(batch)).length>1200000){batch[kind].pop();await send();(batch[kind] as typeof items).push(item as never);}}
    }
    await send();
  };
  if(localStorage.getItem(restoreKey)) { await request('restore',{method:'POST',body:JSON.stringify({places:[],memories:[]})});await sendBatches();localStorage.removeItem(restoreKey); }
  else await sendBatches();
  const snapshot=await request('sync') as {places:Place[];memories:Memory[];tombstones:Tombstone[]};
  const remotePhotoIds=new Set(snapshot.memories.flatMap(m=>(m.images??[]).map(photoId).filter((id):id is string=>id!==null)));
  const downloaded:PhotoAttachment[]=[];
  for(const id of remotePhotoIds)if(!await database.attachments.get(id))downloaded.push(await downloadPhoto(id));
  await database.transaction('rw',database.places,database.memories,database.tombstones,database.attachments,async()=>{
    if(downloaded.length)await database.attachments.bulkPut(downloaded);
    for(const p of snapshot.places){const local=await database.places.get(p.id);if(!local||p.updatedAt>local.updatedAt)await database.places.put(p);}
    for(const m of snapshot.memories){const local=await database.memories.get(m.id);if(!local||m.updatedAt>local.updatedAt)await database.memories.put(m);}
    for(const t of snapshot.tombstones){const local=t.kind==='place'?await database.places.get(t.targetId):await database.memories.get(t.targetId);if(!local||t.updatedAt>=local.updatedAt){if(t.kind==='place'){await database.places.delete(t.targetId);await database.memories.where('placeId').equals(t.targetId).delete();}else await database.memories.delete(t.targetId);}await database.tombstones.put(t);}
  });
}
