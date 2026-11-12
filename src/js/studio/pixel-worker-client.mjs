import{processPixels}from'./pixel-pipeline.mjs';
const cancelled=()=>new DOMException('Cancelled','AbortError');
const pixelCount=job=>Math.max(0,(job.width||0)*(job.height||0));
/**
 * One worker, one active buffer and a short queue; the latest preview replaces its queued predecessor.
 *
 * V3 watchdog: a timeout or crash terminates only the current worker. The next job (or the retried job)
 * starts a fresh worker, so one slow job can no longer disable off-thread processing for the session.
 * Large jobs are never silently moved to the main thread after a timeout; small jobs may be, because they
 * finish in a few milliseconds and keep the edit available.
 */
export class PixelWorkerClient{
 constructor({workerFactory=()=>new Worker(new URL(/* webpackChunkName: "studio-pixels" */ './pixel-worker.mjs',import.meta.url),{type:'module',name:'studio-color'}),timeoutMs=20000,perMegapixelMs=4000,maxAttempts=2,inlineLimit=1000000,onStatus=null}={}){
  this.factory=workerFactory;this.worker=null;this.unsupported=false;this.pending=[];this.active=null;this.id=0;
  this.completed=0;this.fallbacks=0;this.restarts=0;this.timeouts=0;this.failures=0;
  this.timeoutMs=timeoutMs;this.perMegapixelMs=perMegapixelMs;this.maxAttempts=maxAttempts;this.inlineLimit=inlineLimit;this.onStatus=onStatus;
 }
 /** Kept for compatibility with V2 callers/tests: true only when Workers cannot be constructed at all. */
 get disabled(){return this.unsupported;}
 status(state,detail={}){try{this.onStatus?.({state,pending:this.pending.length,restarts:this.restarts,...detail});}catch{}}
 budget(job){return this.timeoutMs+Math.ceil(pixelCount(job)/1e6)*this.perMegapixelMs;}
 run(job,{signal,key,recover}={}){
  if(signal?.aborted)return Promise.reject(cancelled());
  return new Promise((resolve,reject)=>{
   const item={id:++this.id,job,signal,key,recover,resolve,reject,settled:false,attempts:0};
   item.abort=()=>{if(item.settled)return;item.settled=true;reject(cancelled());this.pending=this.pending.filter(q=>q!==item);};
   signal?.addEventListener('abort',item.abort,{once:true});
   if(key)for(const previous of this.pending.filter(q=>q.key===key))previous.abort();
   this.pending.push(item);this.pump();
  });
 }
 settle(item,error,pixels){item.signal?.removeEventListener('abort',item.abort);if(item.settled)return;item.settled=true;if(error)item.reject(error);else item.resolve(pixels);}
 /** Restores a transferred buffer from the caller's source surface. */
 refill(item){const job=item.job;if(!job.pixels.byteLength){if(!item.recover)throw Error('Pixel buffer unavailable');job.pixels=item.recover();}}
 fallback(item){try{this.refill(item);this.fallbacks++;this.settle(item,null,processPixels(item.job));}catch(error){this.settle(item,error);}}
 attach(){
  const worker=this.factory();
  worker.onmessage=e=>{
   if(worker!==this.worker)return;const current=this.active;if(!current||e.data.id!==current.id)return;
   clearTimeout(this.timer);this.active=null;
   if(e.data.error){
    // The job itself threw inside the worker (not a hang). Small jobs reuse the identical CPU path.
    if(pixelCount(current.job)<=this.inlineLimit)this.fallback(current);
    else{this.failures++;this.settle(current,new Error('Không xử lý được ảnh lớn này. Hãy thử lại hoặc giảm kích thước ảnh.'));this.status('failed',{reason:'error'});}
   }else{this.completed++;this.settle(current,null,e.data.pixels);}
   if(!this.pending.length)this.status('idle');
   this.pump();
  };
  worker.onerror=event=>{event?.preventDefault?.();if(worker===this.worker)this.recoverWorker('crash');};
  return worker;
 }
 pump(){
  if(this.active)return;const item=this.pending.shift();if(!item)return;if(item.settled){this.pump();return;}
  if(this.unsupported){this.fallback(item);this.pump();return;}
  try{if(!this.worker)this.worker=this.attach();}
  catch{this.unsupported=true;this.status('unsupported');this.fallback(item);this.pump();return;}
  try{
   this.refill(item);item.attempts++;this.active=item;
   const budget=this.budget(item.job);this.timer=setTimeout(()=>this.recoverWorker('timeout'),budget);
   if(pixelCount(item.job)>2e6)this.status('busy',{attempt:item.attempts});
   this.worker.postMessage({id:item.id,job:item.job},[item.job.pixels.buffer]);
  }catch(error){this.active=null;clearTimeout(this.timer);this.settle(item,error);this.pump();}
 }
 /** Terminates a hung/crashed worker, then retries the job once in a fresh worker. */
 recoverWorker(reason){
  clearTimeout(this.timer);const item=this.active;this.active=null;
  try{this.worker?.terminate();}catch{}
  this.worker=null;this.restarts++;if(reason==='timeout')this.timeouts++;
  if(item&&!item.settled){
   if(item.attempts<this.maxAttempts&&(item.job.pixels.byteLength||item.recover)){this.status('restarting',{reason});this.pending.unshift(item);}
   else if(pixelCount(item.job)<=this.inlineLimit){this.fallback(item);}
   else{this.failures++;this.status('failed',{reason});this.settle(item,new Error(reason==='timeout'?'Xử lý ảnh quá lâu nên đã dừng để giữ ứng dụng mượt. Hãy thử lại hoặc giảm kích thước ảnh.':'Bộ xử lý ảnh gặp lỗi và đã được khởi động lại. Hãy thử lại thao tác.'));}
  }
  this.pump();
 }
 dispose(){clearTimeout(this.timer);try{this.worker?.terminate();}catch{}this.worker=null;this.unsupported=true;if(this.active)this.settle(this.active,cancelled());for(const item of this.pending)this.settle(item,cancelled());this.active=null;this.pending=[];}
}
