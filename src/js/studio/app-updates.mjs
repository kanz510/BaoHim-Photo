/**
 * PWA release monitor. This is deliberately separate from the photo engine.
 * Never clear caches, IndexedDB, or change save keys just to apply a UI update.
 */
export function startAppUpdates(ui){
 const sw=navigator.serviceWorker;
 if(!sw?.register)return;
 const currentBuild=document.querySelector('meta[name="app-build"]')?.content||'';
 const status=document.querySelector('.offline-tag');
 let registration=null;
 let checking=false;
 let offered='';
 let updating=false;

 function offer(next){
  if(!next||typeof next.build!=='string'||!currentBuild||next.build===currentBuild)return;
  if(!/^[a-zA-Z0-9._-]{5,64}$/.test(next.build)||offered===next.build)return;
  offered=next.build;
  document.querySelector('.app-update-banner')?.remove();
  const banner=document.createElement('aside');
  banner.className='app-update-banner';
  banner.setAttribute('role','status');
  banner.setAttribute('aria-live','polite');
  const note=document.createElement('span');
  note.className='app-update-copy';
  note.textContent='BaoHim Photo v'+String(next.version||'5').slice(0,24)+' đã có bản mới.';
  const update=document.createElement('button');
  update.type='button';
  update.className='app-update-apply';
  update.textContent='Cập nhật';
  const later=document.createElement('button');
  later.type='button';
  later.className='app-update-later';
  later.setAttribute('aria-label','Để cập nhật sau');
  later.textContent='Để sau';
  later.addEventListener('click',()=>banner.remove());
  update.addEventListener('click',async()=>{
   if(updating)return;
   updating=true;
   update.disabled=true;
   update.textContent='Đang lưu…';
   try{
    // Save first. Never reload over a failed or unfinished local edit.
    await ui.commitDraft?.();
    await ui.f?.save?.();
    await ui.f?.checkpointQueue;
   }catch(error){
    updating=false;
    update.disabled=false;
    update.textContent='Cập nhật';
    ui.toast?.('Chưa cập nhật vì dự án chưa lưu được. Hãy lưu lại và thử tiếp.');
    return;
   }
   // The new service worker stays waiting until this explicit user action.
   const url=new URL(window.location.href);
   url.searchParams.set('rev',next.build.slice(0,12));
   const navigate=()=>window.location.replace(url.href);
   if(registration?.waiting&&sw.controller){
    let navigated=false;
    const onControl=()=>{if(navigated)return;navigated=true;navigate();};
    sw.addEventListener('controllerchange',onControl,{once:true});
    registration.waiting.postMessage({type:'SKIP_WAITING'});
    window.setTimeout(onControl,3500); // Safari fallback if controllerchange is delayed.
   }else navigate();
  });
  banner.append(note,update,later);
  document.body.appendChild(banner);
 }

 async function check(){
  if(checking||document.visibilityState==='hidden'||navigator.onLine===false)return;
  checking=true;
  try{
   await registration?.update?.().catch(()=>{});
   const response=await fetch('./version.json?check='+Date.now(),{cache:'no-store'});
   if(response.ok)offer(await response.json());
  }catch{
   // Offline operation is intentionally silent.
  }finally{checking=false;}
 }
 function revisit(){if(document.visibilityState!=='hidden')check();}
 sw.register('./service-worker.js',{updateViaCache:'none'}).then(reg=>{
  registration=reg;
  sw.ready.then(()=>{if(status)status.innerHTML='<i></i>Sẵn sàng ngoại tuyến';}).catch(()=>{});
  check();
  document.addEventListener('visibilitychange',revisit);
  window.addEventListener('focus',revisit);
  window.addEventListener('online',revisit);
  window.setInterval(check,10*60*1000);
 }).catch(()=>{
  if(status)status.innerHTML='<i></i>Xử lý trên thiết bị';
 });
}
