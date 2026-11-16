import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { authenticateLocal } from './localAccounts';

describe('本机账户',()=>{
  it('可离线注册中文账户、用密码登录并拒绝错误密码',async()=>{
    const username=`林云${crypto.randomUUID().slice(0,8)}`;
    const created=await authenticateLocal('register',username,'测试密码123456');
    expect(created.scope).toBe('local');
    expect((await authenticateLocal('login',username,'测试密码123456')).id).toBe(created.id);
    await expect(authenticateLocal('login',username,'错误密码123456')).rejects.toThrow('密码错误');
    await expect(authenticateLocal('register',username,'测试密码123456')).rejects.toThrow('已存在');
  });
});
