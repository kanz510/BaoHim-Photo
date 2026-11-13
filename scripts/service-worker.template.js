/* BaoHim Photo offline shell. Generated from this template by scripts/build.mjs. */
const CACHE='__CACHE__';
const FILES=__FILES__;
const BASE=(self.location.pathname||'/').replace(/\/[^/]*$/,'/');

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));
});

// Activate the new cache only after the user accepts the update; do not
// evict old lazy-loaded editing chunks while an existing session is active.
self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('activate',event=>{
 event.waitUntil(
  caches.keys().then(keys=>Promise.all(
   keys.filter(name=>name.startsWith('pbs-')&&name!==CACHE&&name!=='pbs-fonts-v1')
    .map(name=>caches.delete(name))
  )).then(()=>self.clients.claim())
 );
});

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 const url=new URL(request.url);

 // A fresh entrypoint, even if a user returns through an old iOS Home Screen icon.
 // The offline fallback remains cached, without changing project/IndexedDB data.
 if(request.mode==='navigate'){
  event.respondWith(
   fetch(request,{cache:'no-store'})
    .then(response=>{if(!response.ok)throw Error('Navigation unavailable');return response;})
    .catch(()=>caches.match(request,{ignoreSearch:true})
      .then(cached=>cached||caches.match('./index.html')))
  );
  return;
 }

 // Build metadata must bypass old cache so an already-open app notices releases.
 if(url.pathname===BASE+'version.json'){
  event.respondWith(
   fetch(request,{cache:'no-store'})
    .then(response=>{if(!response.ok)throw Error('Version unavailable');return response;})
    .catch(()=>caches.match('./version.json'))
  );
  return;
 }

 // Fingerprinted JavaScript and images remain cache-first for reliable offline use.
 event.respondWith(caches.match(request,{ignoreSearch:true}).then(cached=>cached||fetch(request).then(response=>{
  const isRuntimeFont=url.pathname.startsWith(BASE+'assets/fonts/NotoSans')||/\/assets\/fonts\/(NotoSans|Itim)/.test(url.pathname);
  if(response.ok&&isRuntimeFont){
   const copy=response.clone();
   event.waitUntil(caches.open('pbs-fonts-v1').then(cache=>cache.put(request,copy)));
  }
  return response;
 })));
});
