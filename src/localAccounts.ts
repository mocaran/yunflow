import Dexie, { type Table } from 'dexie';

type Profile = { id: string; username: string; salt: string; passwordHash: string; createdAt: string };
class LocalAccountsDB extends Dexie {
  profiles!: Table<Profile, string>;
  constructor() { super('yunflow-local-accounts'); this.version(1).stores({ profiles: 'id,&username' }); }
}
const accounts = new LocalAccountsDB();
const hex = (bytes: Uint8Array) => [...bytes].map(value => value.toString(16).padStart(2,'0')).join('');
async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/../g)!.map(value=>parseInt(value,16))),iterations:120000,hash:'SHA-256'},key,256);
  return hex(new Uint8Array(bits));
}
function sameHash(a: string, b: string) { if(a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0; }
export async function authenticateLocal(mode:'register'|'login',username:string,password:string) {
  const name=username.normalize('NFC').trim();
  if(name.length<2||name.length>30)throw new Error('账户名需为 2–30 个字符');
  if(password.length<8||password.length>128)throw new Error('密码需为 8–128 个字符');
  if(mode==='register') {
    const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
    const profile:Profile={id:`local-${crypto.randomUUID()}`,username:name,salt,passwordHash:await passwordHash(password,salt),createdAt:new Date().toISOString()};
    try { await accounts.profiles.add(profile); } catch (error) { if(error instanceof Dexie.ConstraintError)throw new Error('本机账户名已存在');throw error; }
    return {id:profile.id,username:name,scope:'local' as const};
  }
  const profile=await accounts.profiles.where('username').equals(name).first();
  if(!profile||!sameHash(await passwordHash(password,profile.salt),profile.passwordHash))throw new Error('本机账户名或密码错误');
  return {id:profile.id,username:profile.username,scope:'local' as const};
}
