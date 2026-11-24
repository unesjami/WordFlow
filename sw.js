const CACHE='wordflow-shell-v6';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('wordflow-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 if(req.mode==='navigate'){event.respondWith(fetch(req).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put('./index.html',response.clone());}return response;}).catch(()=>caches.match('./index.html')));return;}
 if(SHELL.some(path=>new URL(path,self.registration.scope).pathname===url.pathname)){event.respondWith(fetch(req).catch(()=>caches.match(req))); }
});