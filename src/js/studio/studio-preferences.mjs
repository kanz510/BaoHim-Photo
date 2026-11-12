import {validateLook} from './look-catalog.mjs';
export class StudioPreferences{
 constructor({indexedDB=globalThis.indexedDB}={}){this.indexedDB=indexedDB;this.promise=null;}
 open(){
  if(!this.indexedDB)return Promise.reject(new Error('Thiết bị chưa cho phép lưu preset.'));
  if(!this.promise)this.promise=new Promise((resolve,reject)=>{const r=this.indexedDB.open('photo-beauty-studio-preferences',1);r.onupgradeneeded=()=>{r.result.createObjectStore('looks',{keyPath:'id'});r.result.createObjectStore('thumbnails');};r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();this.promise=null;};resolve(db);};r.onerror=()=>{this.promise=null;reject(r.error);};});return this.promise;
 }
 async write(store,callback){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');callback(tx.objectStore(store));tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Không thể lưu trên thiết bị.'));});}
 async read(store,key){const db=await this.open();return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}
 async saveLook(look){validateLook(look);if(!look.id)throw new Error('Invalid look identity');await this.write('looks',s=>s.put(structuredClone(look)));return look.id;}
 async listLooks(){const db=await this.open();return new Promise((resolve,reject)=>{const r=db.transaction('looks').objectStore('looks').getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>(b.created||0)-(a.created||0)));r.onerror=()=>reject(r.error);});}
 async removeLook(id){await this.write('looks',s=>s.delete(id));}
 async saveThumbnail(id,blob){if(typeof id!=='string'||!blob||blob.size>200000||!['image/jpeg','image/png'].includes(blob.type))throw new Error('Invalid thumbnail');await this.write('thumbnails',s=>s.put(blob,id));}
 async thumbnail(id){return this.read('thumbnails',id);}
 async removeThumbnail(id){await this.write('thumbnails',s=>s.delete(id));}
}
