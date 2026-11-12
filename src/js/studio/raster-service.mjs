import {fitWithin,mergePreset,clamp} from './math.mjs';
import {processPixels} from './pixel-pipeline.mjs';

export class RasterService{
 constructor({canvas,fx=null,filters=null,indexedWarp=true}={}){
  this.canvas=canvas||((w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;});
  this.fx=fx;this.filters=filters;this.gpu=null;this.gpuUnavailable=false;this.smoothCache=new WeakMap();
  this.indexedWarp=indexedWarp;
 }
 async render(source,studio={}, {edge=1600,signal,key}={}){
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const sw=source.naturalWidth||source.width,sh=source.naturalHeight||source.height;
  const size=fitWithin(sw,sh,edge),scale=size.width/sw;
  let output=this.canvas(size.width,size.height),ctx=output.getContext('2d',{willReadFrequently:!!studio.strokes?.some(s=>s.type==='heal')});
  const original=output;try{ctx.drawImage(source,0,0,size.width,size.height);
  const strokes=studio.strokes||[];
  if(strokes.length){
   output=this.canvas(size.width,size.height);ctx=output.getContext('2d');ctx.drawImage(original,0,0);
   const healInput=strokes.some(s=>s.type==='heal')?original.getContext('2d').getImageData(0,0,size.width,size.height):null;
   let smooth=null;if(strokes.some(s=>s.type==='smooth')){const cached=this.smoothCache.get(source);if(cached?.width===original.width&&cached?.height===original.height)smooth=cached;else{smooth=this.smooth(original);if(Math.max(smooth.width,smooth.height)<=1600)this.smoothCache.set(source,smooth);}}
   for(const stroke of strokes){
    if(!stroke.strength)continue;
    const mask=this.mask(stroke,size,scale),scratch=this.canvas(size.width,size.height),sctx=scratch.getContext('2d');
    if(stroke.type==='smooth')sctx.drawImage(smooth||original,0,0);
    else if(stroke.type==='restore')sctx.drawImage(original,0,0);
    else if(stroke.type==='heal'){
     const point=stroke.points[0],from=stroke.cloneSource||point,data={data:new Uint8ClampedArray(healInput.data)};
     const job={kind:'heal',cacheKey:studio.sourceId,pixels:data.data,width:size.width,height:size.height,from:{x:from.x*scale,y:from.y*scale},to:{x:point.x*scale,y:point.y*scale},radius:stroke.radius*scale};
     const healed=this.worker?await this.worker.run(job,{signal,key:key&&key+':heal',recover:()=>new Uint8ClampedArray(healInput.data)}):processPixels(job);const image=sctx.createImageData(size.width,size.height);image.data.set(healed);sctx.putImageData(image,0,0);
    }else if(stroke.type==='clone'){
     const point=stroke.points[0],from=stroke.cloneSource||point;
     sctx.drawImage(original,(point.x-from.x)*scale,(point.y-from.y)*scale);
    }else{
     sctx.fillStyle=['makeup','paint','tone'].includes(stroke.type)?stroke.color:stroke.type==='burn'?'#35262b':'#fff6ea';
     sctx.fillRect(0,0,size.width,size.height);
    }
    sctx.globalCompositeOperation='destination-in';sctx.drawImage(mask,0,0);
    ctx.save();ctx.globalAlpha=clamp(stroke.strength,0,1);
    if(stroke.type==='restore'){
     ctx.globalCompositeOperation='destination-out';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='lighter';ctx.drawImage(scratch,0,0);ctx.restore();scratch.width=1;mask.width=1;continue;
    }
    ctx.globalCompositeOperation=stroke.type==='erase'?'destination-out':stroke.type==='tone'?'color':stroke.type==='makeup'?(stroke.blend||'soft-light'):
      stroke.type==='brighten'?'screen':stroke.type==='dodge'?'soft-light':stroke.type==='burn'?'multiply':'source-over';
    ctx.drawImage(scratch,0,0);ctx.restore();
    scratch.width=1;mask.width=1;
   }
   if(smooth&&this.smoothCache.get(source)!==smooth)smooth.width=1;
   original.width=1;
  }
  if(studio.warps?.length||studio.perspectiveX||studio.perspectiveY)output=await this.warp(output,studio,scale,{signal,key});
  const adjustments=mergePreset(studio.adjustments||{},studio.preset||'original',studio.intensity??100);
  ctx=output.getContext('2d');
  if(Object.values(adjustments).some(Number)||studio.curve?.length||studio.levels||studio.hsl){
   const pixels=ctx.getImageData(0,0,output.width,output.height);
   const job={pixels:pixels.data,width:output.width,height:output.height,adjustments,studio:{hsl:studio.hsl,levels:studio.levels,curve:studio.curve}};
   const data=this.worker?await this.worker.run(job,{signal,key,recover:()=>ctx.getImageData(0,0,output.width,output.height).data}):processPixels(job);
   const result=ctx.createImageData(output.width,output.height);result.data.set(data);ctx.putImageData(result,0,0);
  }
  if(adjustments.sharpen>0||adjustments.clarity>0){
   const sharpened=this.gpuEffect(output,g=>g.unsharpMask(2,clamp((adjustments.sharpen+adjustments.clarity*.5)/70,0,2)))||this.sharpen(output,(adjustments.sharpen+adjustments.clarity*.5)/100);
   if(sharpened!==output){output.width=1;output=sharpened;}
   ctx=output.getContext('2d');
  }
  if(adjustments.vignette>0){
   const w=output.width,h=output.height,g=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.15,w/2,h/2,Math.hypot(w,h)*.55);
   g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${adjustments.vignette/130})`);ctx.save();ctx.globalCompositeOperation='source-atop';ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.restore();
  }
  if(studio.flipX||studio.flipY){
   const flipped=this.canvas(output.width,output.height),fctx=flipped.getContext('2d');
   fctx.translate(studio.flipX?output.width:0,studio.flipY?output.height:0);fctx.scale(studio.flipX?-1:1,studio.flipY?-1:1);fctx.drawImage(output,0,0);output.width=1;output=flipped;
  }
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  return output;
  }catch(error){output.width=1;if(original!==output)original.width=1;throw error;}
 }
 mask(stroke,size,scale){
  const mask=this.canvas(size.width,size.height),ctx=mask.getContext('2d'),radius=Math.max(.5,stroke.radius*scale),hard=clamp(stroke.hardness??.5,0,.99);
  for(const p of stroke.points||[]){
   const x=p.x*scale,y=p.y*scale,g=ctx.createRadialGradient(x,y,radius*hard,x,y,radius);
   g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');
   ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  return mask;
 }
 gpuEffect(source,operation){
  if(!this.fx||this.gpuUnavailable)return null;
  let texture;
  try{
   this.gpu=this.gpu||this.fx.canvas();texture=this.gpu.texture(source);this.gpu.draw(texture);operation(this.gpu).update();
   const out=this.canvas(source.width,source.height);out.getContext('2d').drawImage(this.gpu,0,0);return out;
  }catch{this.gpuUnavailable=true;return null;}
  finally{texture?.destroy();}
 }
 smooth(source){
  const accelerated=this.gpuEffect(source,g=>g.denoise(15));if(accelerated)return accelerated;
  const out=this.canvas(source.width,source.height),ctx=out.getContext('2d');ctx.drawImage(source,0,0);
  if(this.filters){const data=ctx.getImageData(0,0,out.width,out.height);ctx.putImageData(this.filters.StackBlur(data,Math.max(2,Math.round(out.width/260))),0,0);}
  else{
   // Canvas resampling fallback keeps retouch available without Canvas filters or WebGL.
   const small=this.canvas(Math.max(1,Math.round(source.width/6)),Math.max(1,Math.round(source.height/6)));
   small.getContext('2d').drawImage(source,0,0,small.width,small.height);ctx.clearRect(0,0,out.width,out.height);ctx.drawImage(small,0,0,out.width,out.height);
  }
  return out;
 }
 sharpen(source,amount){
  if(!this.filters)return source;
  const out=this.canvas(source.width,source.height),ctx=out.getContext('2d');ctx.drawImage(source,0,0);
  const data=ctx.getImageData(0,0,out.width,out.height);
  const sharp=this.filters.Sharpen(data,clamp(amount,0,1));ctx.putImageData(sharp,0,0);return out;
 }
 async warp(source,studio,scale,{signal,key}={}){
  const {width,height}=source,ctx=source.getContext('2d'),data=ctx.getImageData(0,0,width,height),job={kind:'warp',pixels:data.data,width,height,studio:{warps:studio.warps,freezes:studio.freezes,perspectiveX:studio.perspectiveX,perspectiveY:studio.perspectiveY},scale,indexedWarp:this.indexedWarp};
  const pixels=this.worker?await this.worker.run(job,{signal,key:key&&key+':warp',recover:()=>ctx.getImageData(0,0,width,height).data}):processPixels(job),result=ctx.createImageData(width,height);result.data.set(pixels);ctx.putImageData(result,0,0);return source;
 }
 dispose(){
  this.worker?.dispose();if(this.gpu){for(const k of ['texture','spareTexture','extraTexture'])this.gpu._?.[k]?.destroy();this.gpu.width=1;this.gpu.height=1;this.gpu=null;}
 }
}
