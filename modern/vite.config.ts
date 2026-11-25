import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type {Plugin} from 'vite';
import {createHash} from 'node:crypto';
function offlineShell():Plugin{return {name:'wordflow-offline-shell',apply:'build',enforce:'post',generateBundle(_options,bundle){const assets=Object.keys(bundle).filter(name=>/\.(js|css|html)$/.test(name));const paths=['./index.html','./manifest.webmanifest','./icon.svg',...assets.filter(name=>name!=='index.html').map(name=>'./'+name)];const version=createHash('sha256').update(JSON.stringify(Object.values(bundle).map(item=>item.type==='chunk'?item.code:String(item.source)))).digest('hex').slice(0,16);this.emitFile({type:'asset',fileName:'sw.js',source:`const CACHE='wf-modern-shell-${version}';const FILES=${JSON.stringify(paths)};const urls=new Set(FILES.map(p=>new URL(p,self.registration.scope).href));const index=new URL('index.html',self.registration.scope).href;
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('wf-modern-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith(new URL(self.registration.scope).pathname))return;if(r.mode==='navigate'){e.respondWith(fetch(r,{cache:'no-cache'}).catch(()=>caches.open(CACHE).then(c=>c.match(index)).then(v=>v||Response.error())));return;}if(urls.has(u.href))e.respondWith(caches.open(CACHE).then(c=>c.match(r)).then(v=>v||fetch(r)));});`});}};}
export default defineConfig({plugins:[react(),tailwindcss(),offlineShell()],base:'./'});
