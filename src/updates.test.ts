import { afterEach, expect, it, vi } from 'vitest';
import { checkForUpdate, CURRENT_BUILD, parseRelease } from './updates';

afterEach(()=>vi.unstubAllGlobals());

it('检查更新时比较 APK 构建号',async()=>{
  vi.stubGlobal('window',{Capacitor:{isNativePlatform:()=>false}});
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({version:'1.8.0',build:CURRENT_BUILD+1,apkUrl:'https://example.test/app.apk'})));
  const result=await checkForUpdate();
  expect(result.available).toBe(true);
  expect(fetch).toHaveBeenCalledWith('/api/version',expect.objectContaining({cache:'no-store'}));
});

it('拒绝无效的版本信息',()=>{
  expect(()=>parseRelease({version:'new',build:'8',apkUrl:'http://unsafe'})).toThrow('无效');
});
