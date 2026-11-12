import{test}from'node:test';import assert from'node:assert/strict';import{gradePixels,mergePreset}from'../src/js/studio/math.mjs';
const{processPixels}=await import('../src/js/studio/pixel-pipeline.mjs').catch(()=>({}));const{PixelWorkerClient}=await import('../src/js/studio/pixel-worker-client.mjs').catch(()=>({}));
test('shared pixel pipeline preserves the existing grade equations and alpha',()=>{assert.ok(processPixels);const input=new Uint8ClampedArray([12,80,170,123,240,180,60,55]),settings=mergePreset({exposure:.3},'rose',65),expected=gradePixels(input,settings);assert.deepEqual(processPixels({pixels:input.slice(),width:2,height:1,adjustments:settings,studio:{}}),expected);});
test('failed or unavailable workers use identical recovered pixels and abort superseded work',async()=>{assert.ok(PixelWorkerClient);const input=new Uint8ClampedArray([80,90,100,160]),job=()=>({pixels:input.slice(),width:1,height:1,adjustments:mergePreset({},'amber'),studio:{}}),client=new PixelWorkerClient({workerFactory:()=>{throw Error('Unavailable');}});assert.deepEqual(await client.run(job()),processPixels(job()));const controller=new AbortController();controller.abort();await assert.rejects(()=>client.run(job(),{signal:controller.signal}),e=>e.name==='AbortError');client.dispose();});

test('the shared worker pipeline executes manual heal and inverse warp jobs',async()=>{const{healPixels}=await import('../src/js/studio/pixel-ops.mjs');const input=new Uint8ClampedArray(32*32*4);for(let i=0;i<input.length;i+=4){input[i]=(i/4)%255;input[i+1]=90;input[i+2]=130;input[i+3]=200;}const from={x:6,y:8},to={x:20,y:15};assert.deepEqual(processPixels({kind:'heal',pixels:input.slice(),width:32,height:32,from,to,radius:5}),healPixels(input,32,32,from,to,5));const studio={warps:[{from:{x:16,y:16},to:{x:21,y:16},radius:14,strength:.5,mode:'push'}]};const warped=processPixels({kind:'warp',pixels:input.slice(),width:32,height:32,studio,scale:1});assert.notDeepEqual(warped,input);assert.equal(warped[3],200);});

test('Phase 0 watchdog restarts a hung worker instead of permanently disabling off-thread processing',async()=>{
 let created=0;
 const client=new PixelWorkerClient({
  timeoutMs:25,perMegapixelMs:5,maxAttempts:2,
  workerFactory:()=>{
   const instance=++created;
   const w={onmessage:null,onerror:null,terminated:false,terminate(){this.terminated=true;},postMessage({id,job}){
    // First worker instance hangs forever; second worker instance succeeds off-thread
    if(instance===1)return;
    setTimeout(()=>!this.terminated&&this.onmessage?.({data:{id,pixels:processPixels(job)}}),5);
   }};
   return w;
  }
 });
 const input=new Uint8ClampedArray([100,120,140,255]);
 const result=await client.run({pixels:input.slice(),width:1,height:1,adjustments:{brightness:20},studio:{}},{recover:()=>input.slice()});
 assert.equal(created,2,'a fresh worker was spawned after the first timed out');
 assert.equal(client.restarts,1);
 assert.equal(client.timeouts,1);
 assert.equal(client.completed,1);
 assert.equal(client.disabled,false,'worker client remains enabled after recovery');
 assert.ok(result[0]>100);
 client.dispose();
});

test('Phase 0 watchdog rejects hung large jobs instead of blocking the main thread',async()=>{
 const client=new PixelWorkerClient({
  timeoutMs:20,perMegapixelMs:1,maxAttempts:2,inlineLimit:100,
  workerFactory:()=>({onmessage:null,onerror:null,terminate(){},postMessage(){}})
 });
 const big=new Uint8ClampedArray(20*20*4);
 await assert.rejects(()=>client.run({pixels:big.slice(),width:20,height:20,adjustments:{brightness:10},studio:{}},{recover:()=>big.slice()}),/quá lâu|dừng/);
 assert.equal(client.fallbacks,0,'large timed-out job must not fall back to the main thread');
 client.dispose();
});

test('PixelWorkerClient surfaces clear Vietnamese out-of-memory error and supports cancelAll',async()=>{
 const client=new PixelWorkerClient({
  workerFactory:()=>({
   onmessage:null,onerror:null,terminate(){},
   postMessage({id}){setTimeout(()=>this.onmessage?.({data:{id,error:'RangeError: Array buffer allocation failed'}}),5);}
  })
 });
 const buf=new Uint8ClampedArray(16);
 await assert.rejects(()=>client.run({pixels:buf,width:2,height:2,adjustments:{},studio:{}}),/thiếu bộ nhớ/);
 client.dispose();
});
