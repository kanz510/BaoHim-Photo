import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
const {StudioPreferences}=await import('../src/js/studio/studio-preferences.mjs').catch(()=>({}));
test('custom looks and draft thumbnails survive reopening without touching the project database',async()=>{
 assert.ok(StudioPreferences);const indexedDB=new IDBFactory(),a=new StudioPreferences({indexedDB});
 await a.saveLook({id:'look-1',name:'Rose',recipe:{preset:'peach',intensity:70,adjustments:{}}});await a.saveThumbnail('project-1',new Blob(['jpeg'],{type:'image/jpeg'}));
 const b=new StudioPreferences({indexedDB});assert.equal((await b.listLooks())[0].name,'Rose');assert.equal((await b.thumbnail('project-1')).type,'image/jpeg');
 await b.removeLook('look-1');assert.deepEqual(await a.listLooks(),[]);assert.equal((await indexedDB.databases()).some(d=>d.name==='photo-beauty-studio-projects'),false);
});
