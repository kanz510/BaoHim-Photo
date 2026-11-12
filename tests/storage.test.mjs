import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
const {ProjectRepository}=await import('../src/js/studio/project-repository.mjs').catch(()=>({}));
test('autosave stores photo Blobs without data URLs and loads the same project',async()=>{
 const repository=ProjectRepository&&new ProjectRepository({indexedDB:new IDBFactory()});
 const project={id:'portrait',name:'Ảnh của tôi',width:2,height:2,layers:[]};
 assert.ok(repository,'persistent project repository exists');
 await repository.save(project,{'photo':new Blob(['original bytes'],{type:'image/png'})});
 const restored=await repository.load('portrait');
 assert.equal(restored.name,'Ảnh của tôi');assert.equal(await restored.assets.photo.text(),'original bytes');
 await repository.remove('portrait');assert.equal(await repository.load('portrait'),null);
});
test('saving a new revision replaces document and source references atomically',async()=>{
 const repository=ProjectRepository&&new ProjectRepository({indexedDB:new IDBFactory()});assert.ok(repository,'persistent project repository exists');
 await repository.save({id:'p',name:'First',layers:[]},{a:new Blob(['a'])});
 await repository.save({id:'p',name:'Second',layers:[{id:1}]},{b:new Blob(['b'])});
 const restored=await repository.load('p');assert.equal(restored.name,'Second');assert.deepEqual(Object.keys(restored.assets),['b']);
 assert.equal((await repository.list()).length,1);
});

test('Phase 0 autosave deduplicates unchanged photo Blobs by SHA-256 and still loads legacy V2 inline records',async()=>{
 const idb=new IDBFactory(),repository=new ProjectRepository({indexedDB:idb});
 const blob=new Blob(['photo-bytes-v3'],{type:'image/jpeg'});
 await repository.save({id:'p1',name:'Edit 1',layers:[]},{src:blob});
 await repository.save({id:'p1',name:'Edit 2',layers:[]},{src:blob});
 await repository.save({id:'p1',name:'Edit 3',layers:[]},{src:blob});
 assert.equal(repository.stats.blobWrites,1,'photo Blob written only once');
 assert.equal(repository.stats.skippedBlobWrites,2,'subsequent autosaves skip rewriting identical Blob');
 const loaded=await repository.load('p1');
 assert.equal(loaded.name,'Edit 3');
 assert.equal(await loaded.assets.src.text(),'photo-bytes-v3');
 // Simulate a legacy V2 record with inline `assets` and no `assetHashes`
 const db=await repository.open();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction('projects','readwrite');
  tx.objectStore('projects').put({id:'legacy-v2',name:'Dự án V2 cũ',width:800,height:1000,layers:[],assets:{old:new Blob(['v2-inline-blob'])},modified:Date.now()});
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });
 const legacy=await repository.load('legacy-v2');
 assert.equal(legacy.name,'Dự án V2 cũ');
 assert.equal(await legacy.assets.old.text(),'v2-inline-blob');
});
