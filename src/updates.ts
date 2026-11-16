import packageInfo from '../package.json';

export const CURRENT_VERSION=packageInfo.version;
export const CURRENT_BUILD=packageInfo.yunflowBuild;
export type Release={version:string;build:number;apkUrl:string};
const native=()=>Boolean((window as any).Capacitor?.isNativePlatform?.());

export function parseRelease(value:unknown):Release{
  const release=value as Partial<Release>;
  if(!release||typeof release.version!=='string'||!/^\d+\.\d+\.\d+$/.test(release.version)||!Number.isInteger(release.build)||!Number.isFinite(release.build)||typeof release.apkUrl!=='string'||!release.apkUrl.startsWith('https://'))throw new Error('更新服务返回了无效版本信息');
  return release as Release;
}
export async function checkForUpdate():Promise<{release:Release;available:boolean}>{
  const url=native()?'https://yunflow-memory-map.thinmerit.chatgpt.site/api/version':'/api/version';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    let data:unknown;
    try{const response=await fetch(url,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error(`更新服务暂不可用（${response.status}）`);data=await response.json();}
    catch(error){
      if(!native())throw error;
      const {CapacitorHttp}=await import('@capacitor/core');
      const response=await CapacitorHttp.get({url,connectTimeout:10000,readTimeout:12000,responseType:'json'});
      if(response.status<200||response.status>=300)throw new Error(`更新服务暂不可用（${response.status}）`);
      data=typeof response.data==='string'?JSON.parse(response.data):response.data;
    }
    const release=parseRelease(data);
    return {release,available:release.build>CURRENT_BUILD};
  }finally{clearTimeout(timer);}
}
export async function openUpdate(release:Release){
  if(native()){const {Browser}=await import('@capacitor/browser');await Browser.open({url:release.apkUrl});}
  else{if('serviceWorker' in navigator){const registration=await navigator.serviceWorker.getRegistration();await registration?.update();}window.location.reload();}
}
