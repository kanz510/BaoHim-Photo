import{processPixels}from'./pixel-pipeline.mjs';
const cancelled=()=>new DOMException('Cancelled','AbortError');
/** One worker, one active buffer and a short queue; latest preview replaces its queued predecessor. */
export class PixelWorkerClient{
 constructor({workerFactory=()=>new Worker(new URL(/* webpackChunkName: "studio-pixels" */ './pixel-worker.mjs',import.meta.url),{type:'module',name:'studio-color'})}={}){this.factory=workerFactory;this.worker=null;this.disabled=false;this.pending=[];this.active=null;this.id=0;this.completed=0;this.fallbacks=0;}
 run(job,{signal,key,recover}={}){if(signal?.aborted)return Promise.reject(cancelled());return new Promise((resolve,reject)=>{const item={id:++this.id,job,signal,key,recover,resolve,reject,settled:false};item.abort=()=>{if(item.settled)return;item.settled=true;reject(cancelled());this.pending=this.pending.filter(q=>q!==item);};signal?.addEventListener('abort',item.abort,{once:true});if(key)for(const previous of this.pending.filter(q=>q.key===key))previous.abort();this.pending.push(item);this.pump();});}
 settle(item,error,pixels){item.signal?.removeEventListener('abort',item.abort);if(item.settled)return;item.settled=true;if(error)item.reject(error);else item.resolve(pixels);}
 fallback(item){try{const job=item.job;if(!job.pixels.byteLength){if(!item.recover)throw Error('Pixel buffer unavailable');job.pixels=item.recover();}this.fallbacks++;this.settle(item,null,processPixels(job));}catch(error){this.settle(item,error);}}
 pump(){if(this.active)return;const item=this.pending.shift();if(!item)return;if(item.settled){this.pump();return;}if(this.disabled){this.fallback(item);this.pump();return;}
  try{if(!this.worker){this.worker=this.factory();this.worker.onmessage=e=>{const current=this.active;if(!current||e.data.id!==current.id)return;clearTimeout(this.timer);this.active=null;if(e.data.error)this.fallback(current);else{this.completed++;this.settle(current,null,e.data.pixels);}this.pump();};this.worker.onerror=()=>this.fail();}this.active=item;this.timer=setTimeout(()=>this.fail(),20000);this.worker.postMessage({id:item.id,job:item.job},[item.job.pixels.buffer]);}catch{this.fail(item);}
 }
 fail(item=this.active){clearTimeout(this.timer);this.worker?.terminate();this.worker=null;this.disabled=true;this.active=null;if(item&&!item.settled)this.fallback(item);this.pump();}
 dispose(){clearTimeout(this.timer);this.worker?.terminate();this.worker=null;this.disabled=true;if(this.active)this.settle(this.active,cancelled());for(const item of this.pending)this.settle(item,cancelled());this.active=null;this.pending=[];}
}
