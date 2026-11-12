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
