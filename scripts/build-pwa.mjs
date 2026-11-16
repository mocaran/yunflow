import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const dist=join(process.cwd(),'dist');
const html=readFileSync(join(dist,'index.html'),'utf8');
const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(x=>x[1]);
const cacheName='yunflow-shell-'+assets.join('|').replace(/[^a-z0-9]/gi,'').slice(-40);
const source=`const CACHE=${JSON.stringify(cacheName)};const SHELL=${JSON.stringify(['/','/index.html','/manifest.webmanifest','/avatar.png',...assets])};self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('yunflow-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/_AMapService/')||u.pathname.endsWith('.apk'))return;if(r.mode==='navigate'){e.respondWith(fetch(r).then(v=>{if(v.ok){const copy=v.clone();caches.open(CACHE).then(c=>c.put('/index.html',copy))}return v}).catch(()=>caches.match('/index.html')));return}e.respondWith(caches.match(r).then(v=>v||fetch(r).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(r,copy))}return response})))})`;
writeFileSync(join(dist,'sw.js'),source);
console.log('Built offline shell with',assets.length,'bundled assets');
