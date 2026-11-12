const reqPromise=q=>new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
export async function sha256Hex(buffer,cryptoObj=globalThis.crypto){
 if(cryptoObj?.subtle?.digest){
  const digest=await cryptoObj.subtle.digest('SHA-256',buffer);
  return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 }
 const bytes=new Uint8Array(buffer),len=bytes.length,bitLen=len*8;
 const total=(((len+9+63)>>6)<<6),padded=new Uint8Array(total),view=new DataView(padded.buffer);
 padded.set(bytes);padded[len]=0x80;
 view.setUint32(total-8,Math.floor(bitLen/0x100000000),false);view.setUint32(total-4,bitLen>>>0,false);
 const H=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),W=new Uint32Array(64);
 for(let i=0;i<total;i+=64){
  for(let t=0;t<16;t++)W[t]=view.getUint32(i+t*4,false);
  for(let t=16;t<64;t++){const s0=rotr(W[t-15],7)^rotr(W[t-15],18)^(W[t-15]>>>3),s1=rotr(W[t-2],17)^rotr(W[t-2],19)^(W[t-2]>>>10);W[t]=(W[t-16]+s0+W[t-7]+s1)>>>0;}
  let [a,b,c,d,e,f,g,h]=H;
  for(let t=0;t<64;t++){
   const S1=rotr(e,6)^rotr(e,11)^rotr(e,25),ch=(e&f)^(~e&g),temp1=(h+S1+ch+K[t]+W[t])>>>0;
   const S0=rotr(a,2)^rotr(a,13)^rotr(a,22),maj=(a&b)^(a&c)^(b&c),temp2=(S0+maj)>>>0;
   h=g;g=f;f=e;e=(d+temp1)>>>0;d=c;c=b;b=a;a=(temp1+temp2)>>>0;
  }
  H[0]=(H[0]+a)>>>0;H[1]=(H[1]+b)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+h)>>>0;
 }
 return Array.from(H,x=>x.toString(16).padStart(8,'0')).join('');
}

export class ProjectRepository{
 constructor({indexedDB=globalThis.indexedDB,crypto=globalThis.crypto}={}){
  this.indexedDB=indexedDB;this.crypto=crypto;this.promise=null;this.hashes=new WeakMap();
  this.stats={saves:0,blobWrites:0,skippedBlobWrites:0};
 }
 open(){
  if(!this.indexedDB)return Promise.reject(new Error('Trình duyệt chưa cho phép lưu trên thiết bị. Hãy tải file dự án để giữ bản sao.'));
  if(!this.promise)this.promise=new Promise((resolve,reject)=>{
   const request=this.indexedDB.open('photo-beauty-studio-projects',2);
   request.onupgradeneeded=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects',{keyPath:'id'});
    if(!db.objectStoreNames.contains('assets'))db.createObjectStore('assets',{keyPath:'hash'});
   };
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();this.promise=null;};resolve(db);};
   request.onerror=()=>{this.promise=null;reject(request.error);};
   request.onblocked=()=>{this.promise=null;reject(new Error('Hãy đóng tab Studio cũ rồi thử lưu lại.'));};
  });
  return this.promise;
 }
 async hash(blob){
  if(!this.hashes.has(blob)){
   const p=blob.arrayBuffer().then(b=>sha256Hex(b,this.crypto));
   this.hashes.set(blob,p);p.catch(()=>this.hashes.delete(blob));
  }
  return this.hashes.get(blob);
 }
 async save(project,assets={}){
  const entries=Object.entries(assets||{}),assetHashes={},blobs=[];
  for(const [key,blob] of entries){
   if(!(blob instanceof Blob))continue;
   const hash=await this.hash(blob);assetHashes[key]=hash;blobs.push({hash,blob});
  }
  const db=await this.open();
  if(!db.objectStoreNames.contains('assets')){
   return new Promise((resolve,reject)=>{
    const tx=db.transaction('projects','readwrite');
    tx.objectStore('projects').put({...project,assets,modified:Date.now()});
    tx.oncomplete=()=>{this.stats.saves++;resolve(project.id);};tx.onerror=()=>reject(tx.error||new Error('Không thể lưu dự án.'));tx.onabort=()=>reject(tx.error||new Error('Không thể lưu dự án.'));
   });
  }
  const writeTx=items=>new Promise((resolve,reject)=>{
   const tx=db.transaction(['projects','assets'],'readwrite'),projectsStore=tx.objectStore('projects'),assetsStore=tx.objectStore('assets'),allReq=projectsStore.getAll();
   allReq.onsuccess=()=>{
    const all=allReq.result||[],existingHashes=new Set(all.flatMap(p=>Object.values(p.assetHashes||{})));
    const record={...project,assetHashes,modified:Date.now()};delete record.assets;
    for(const item of items){
     if(existingHashes.has(item.hash)){this.stats.skippedBlobWrites++;}
     else{assetsStore.put(item);existingHashes.add(item.hash);this.stats.blobWrites++;}
    }
    projectsStore.put(record);
    const used=new Set(all.filter(p=>p.id!==project.id).concat([record]).flatMap(c=>Object.values(c.assetHashes||{})));
    const cursorReq=assetsStore.openCursor();
    cursorReq.onsuccess=()=>{const c=cursorReq.result;if(!c)return;if(!used.has(c.key))c.delete();c.continue();};
   };
   tx.oncomplete=()=>{this.stats.saves++;resolve(project.id);};
   tx.onerror=()=>reject(tx.error||new Error('Không thể lưu dự án.'));
   tx.onabort=()=>reject(tx.error||new Error('Không thể lưu dự án.'));
  });
  try{
   return await writeTx(blobs);
  }catch(err){
   if(!blobs.length)throw err;
   const byteItems=await Promise.all(blobs.map(async({hash,blob})=>({hash,bytes:new Uint8Array(await blob.arrayBuffer()),type:blob.type||'image/jpeg'})));
   return await writeTx(byteItems);
  }
 }
 async load(id){
  const db=await this.open();
  const hasAssetsStore=db.objectStoreNames.contains('assets');
  const tx=db.transaction(hasAssetsStore?['projects','assets']:'projects');
  const record=await reqPromise(tx.objectStore('projects').get(id));
  if(!record)return null;
  // Backward compatibility: V2 projects stored inline `record.assets` Blobs directly on the project record.
  if(record.assets&&typeof record.assets==='object'&&!record.assetHashes)return record;
  const assetHashes=record.assetHashes||{};
  const assets={};
  if(hasAssetsStore){
   const assetsStore=tx.objectStore('assets');
   for(const [key,hash] of Object.entries(assetHashes)){
    const found=await reqPromise(assetsStore.get(hash));
    const blob=found?.blob instanceof Blob?found.blob:found?.bytes?new Blob([found.bytes],{type:found.type||'image/jpeg'}):null;
    if(!blob)throw new Error('Thiếu ảnh nguồn của dự án đã lưu.');
    assets[key]=blob;
   }
  }
  const {assetHashes:_ignored,...rest}=record;
  return {...rest,assets};
 }
 async list(){
  const db=await this.open();
  return new Promise((resolve,reject)=>{
   const req=db.transaction('projects').objectStore('projects').getAll();
   req.onsuccess=()=>resolve(req.result.sort((a,b)=>b.modified-a.modified).map(({assets,assetHashes,...p})=>p));
   req.onerror=()=>reject(req.error);
  });
 }
 async remove(id){
  const db=await this.open();
  if(!db.objectStoreNames.contains('assets')){
   return new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  }
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(['projects','assets'],'readwrite'),projectsStore=tx.objectStore('projects'),assetsStore=tx.objectStore('assets'),allReq=projectsStore.getAll();
   allReq.onsuccess=()=>{
    projectsStore.delete(id);
    const used=new Set((allReq.result||[]).filter(p=>p.id!==id).flatMap(p=>Object.values(p.assetHashes||{})));
    const cursorReq=assetsStore.openCursor();
    cursorReq.onsuccess=()=>{const c=cursorReq.result;if(!c)return;if(!used.has(c.key))c.delete();c.continue();};
   };
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  });
 }
}
export function blobDataURL(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});}
export function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Không thể đọc ảnh. Hãy thử ảnh JPEG, PNG hoặc WebP.'));image.src=url;});}
export async function imageFromBlob(blob){const url=URL.createObjectURL(blob);try{return await loadImage(url);}finally{URL.revokeObjectURL(url);}}
