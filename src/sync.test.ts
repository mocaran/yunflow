import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticate } from './sync';
import { Preferences } from '@capacitor/preferences';

vi.mock('@capacitor/preferences',()=>({Preferences:{get:vi.fn(()=>new Promise(()=>{})),set:vi.fn(()=>new Promise(()=>{}))}}));

afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});

describe('Android 云端登录',()=>{
  it.each(['register','login'] as const)('%s 前不等待可能挂起的原生令牌读取',async mode=>{
    const values=new Map<string,string>();
    vi.stubGlobal('window',{Capacitor:{isNativePlatform:()=>true}});
    vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}});
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({account:{id:'remote-1',username:'林云'},token:'test-token'}),{status:200,headers:{'content-type':'application/json'}})));
    const account=await authenticate(mode,'林云','测试密码123456');
    expect(account.username).toBe('林云');
    expect(values.get('yunflow-session')).toBe('test-token');
    expect(Preferences.get).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(`https://yunflow-memory-map.thinmerit.chatgpt.site/api/${mode}`,expect.objectContaining({method:'POST'}));
  });
});
