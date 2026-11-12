export class ProjectRepository{
 constructor({indexedDB=globalThis.indexedDB}={}){this.indexedDB=indexedDB;this.promise=null;}
 open(){
  if(!this.indexedDB)return Promise.reject(new Error('Trình duyệt chưa cho phép lưu trên thiết bị. Hãy tải file dự án để giữ bản sao.'));
  if(!this.promise)this.promise=new Promise((resolve,reject)=>{
   const request=this.indexedDB.open('photo-beauty-studio-projects',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('projects',{keyPath:'id'});
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();this.promise=null;};resolve(db);};
   request.onerror=()=>{this.promise=null;reject(request.error);};
   request.onblocked=()=>{this.promise=null;reject(new Error('Hãy đóng tab Studio cũ rồi thử lưu lại.'));};
  });
  return this.promise;
 }
 async save(project,assets){
  const db=await this.open();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('projects','readwrite');
   tx.objectStore('projects').put({...project,assets,modified:Date.now()});
   tx.oncomplete=()=>resolve(project.id);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Không thể lưu dự án.'));
  });
 }
 async load(id){
  const db=await this.open();return new Promise((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});
 }
 async list(){
  const db=await this.open();return new Promise((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').getAll();req.onsuccess=()=>resolve(req.result.sort((a,b)=>b.modified-a.modified).map(({assets,...p})=>p));req.onerror=()=>reject(req.error);});
 }
 async remove(id){
  const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
 }
}
export function blobDataURL(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});}
export function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Không thể đọc ảnh. Hãy thử ảnh JPEG, PNG hoặc WebP.'));image.src=url;});}
export async function imageFromBlob(blob){const url=URL.createObjectURL(blob);try{return await loadImage(url);}finally{URL.revokeObjectURL(url);}}
