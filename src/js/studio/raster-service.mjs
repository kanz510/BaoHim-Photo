import {fitWithin,mergePreset,clamp} from './math.mjs';
import {processPixels} from './pixel-pipeline.mjs';
import {findCleanBlemishSource,skinSmoothPixels,skinTonePixels,opticalEffectsPixels} from './pixel-ops.mjs';
import {applyCubeLut} from './lut-cube.mjs';

function strokeSignature(s){
 if(!s)return '';
 const pts=s.points||[],first=pts[0],last=pts[pts.length-1],mid=pts[pts.length>>1];
 return `${s.type}:${s.radius}:${s.strength}:${s.hardness??.5}:${s.feather||0}:${s.detail??''}:${s.warmth||0}:${s.hue||0}:${s.saturation||0}:${s.lightness||0}:${s.color||''}:${s.blend||''}:${s.cloneSource?s.cloneSource.x+','+s.cloneSource.y:''}:${pts.length}:${first?first.x+','+first.y:''}:${mid?mid.x+','+mid.y:''}:${last?last.x+','+last.y:''}`;
}
function surfaceFingerprint(ctx,w,h){
 const pts=[[0,0],[w>>1,h>>1],[w-1,h-1],[w>>2,h>>2]];
 let tag=`${w}x${h}`;
 for(const [x,y] of pts){const d=ctx.getImageData(Math.max(0,x),Math.max(0,y),1,1).data;tag+=`:${d[0]},${d[1]},${d[2]},${d[3]}`;}
 return tag;
}

export class RasterService{
 constructor({canvas,fx=null,filters=null,indexedWarp=true,tileThreshold=4000000,tileHeight=1024}={}){
  this.canvas=canvas||((w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;});
  this.fx=fx;this.filters=filters;this.gpu=null;this.gpuUnavailable=false;this.smoothCache=new WeakMap();this.strokeCache=new WeakMap();
  this.indexedWarp=indexedWarp;this.tileThreshold=tileThreshold;this.tileHeight=tileHeight;
  this.stats={lastRenderedStrokes:0,lastCachedStrokes:0,lastTiles:0};
 }
 strokeBounds(stroke,size,scale){
  const pts=stroke?.points||[];
  if(!pts.length||!stroke.strength)return null;
  const featherMult=stroke.feather?1+clamp(stroke.feather,0,1)*.65:1;
  const r=Math.max(.5,stroke.radius*scale*featherMult)+2;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of pts){
   const x=p.x*scale,y=p.y*scale;
   if(x-r<minX)minX=x-r;if(y-r<minY)minY=y-r;
   if(x+r>maxX)maxX=x+r;if(y+r>maxY)maxY=y+r;
  }
  const x=clamp(Math.floor(minX),0,size.width),y=clamp(Math.floor(minY),0,size.height);
  const x1=clamp(Math.ceil(maxX),0,size.width),y1=clamp(Math.ceil(maxY),0,size.height);
  return x1>x&&y1>y?{x,y,width:x1-x,height:y1-y}:null;
 }
 async render(source,studio={}, {edge=1600,signal,key}={}){
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const sw=source.naturalWidth||source.width,sh=source.naturalHeight||source.height;
  const size=fitWithin(sw,sh,edge),scale=size.width/sw;
  let output=this.canvas(size.width,size.height),ctx=output.getContext('2d',{willReadFrequently:!!studio.strokes?.some(s=>['heal','blemish','smooth','tone'].includes(s.type))});
  const original=output;try{ctx.drawImage(source,0,0,size.width,size.height);
  const strokes=studio.strokes||[];
  if(strokes.length){
   const origCtx=original.getContext('2d',{willReadFrequently:true});
   const fp=surfaceFingerprint(origCtx,size.width,size.height);
   output=this.canvas(size.width,size.height);ctx=output.getContext('2d');
   let smooth=null;if(strokes.some(s=>s.type==='smooth'&&s.detail===undefined)){const cached=this.smoothCache.get(source);if(cached?.width===original.width&&cached?.height===original.height&&cached._fp===fp)smooth=cached;else{smooth=this.smooth(original);smooth._fp=fp;if(Math.max(smooth.width,smooth.height)<=1600)this.smoothCache.set(source,smooth);}}
   const sigs=new Array(strokes.length);let acc='';
   for(let i=0;i<strokes.length;i++){acc+=(i?'|':'')+strokeSignature(strokes[i]);sigs[i]=acc;}
   let entry=this.strokeCache.get(source);
   if(!entry||entry.width!==size.width||entry.height!==size.height||entry.fp!==fp){
    if(entry?.snapshots)for(const s of entry.snapshots)if(s.canvas)s.canvas.width=1;
    entry={width:size.width,height:size.height,fp,snapshots:[]};
    if(Math.max(size.width,size.height)<=2048)this.strokeCache.set(source,entry);
   }
   let startIndex=0,bestSnap=null;
   for(const snap of entry.snapshots){
    if(snap.count<=strokes.length&&sigs[snap.count-1]===snap.sig&&snap.count>startIndex){startIndex=snap.count;bestSnap=snap;}
   }
   if(bestSnap)ctx.drawImage(bestSnap.canvas,0,0);
   else ctx.drawImage(original,0,0);
   this.stats.lastCachedStrokes=startIndex;
   this.stats.lastRenderedStrokes=strokes.length-startIndex;
   const saveSnapshot=count=>{
    if(count<1||Math.max(size.width,size.height)>2048)return;
    const sig=sigs[count-1];if(entry.snapshots.some(s=>s.count===count&&s.sig===sig))return;
    const snapCanvas=this.canvas(size.width,size.height);snapCanvas.getContext('2d').drawImage(output,0,0);
    entry.snapshots=entry.snapshots.filter(s=>{if(s.count===count){s.canvas.width=1;return false;}return true;});
    entry.snapshots.push({count,sig,canvas:snapCanvas});
    while(entry.snapshots.length>2){const old=entry.snapshots.shift();if(old?.canvas)old.canvas.width=1;}
   };
   for(let i=startIndex;i<strokes.length;i++){
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    const stroke=strokes[i];
    if(stroke.strength){
     const roi=this.strokeBounds(stroke,size,scale);
     if(roi){
      const mask=this.mask(stroke,roi,scale),scratch=this.canvas(roi.width,roi.height),sctx=scratch.getContext('2d');
      const advancedTone=stroke.type==='tone'&&Boolean(stroke.warmth||stroke.hue||stroke.saturation||stroke.lightness);
      if(stroke.type==='smooth'){
       if(stroke.detail!==undefined){
        const padR=Math.max(3,Math.min(28,Math.round(Math.max(size.width,size.height)/185)));
        const px0=Math.max(0,roi.x-padR),py0=Math.max(0,roi.y-padR),px1=Math.min(size.width,roi.x+roi.width+padR),py1=Math.min(size.height,roi.y+roi.height+padR),pw=px1-px0,ph=py1-py0;
        const raw=new Uint8ClampedArray(ctx.getImageData(px0,py0,pw,ph).data);
        const smoothed=skinSmoothPixels(raw,pw,ph,padR,stroke.detail);
        const patchImg=sctx.createImageData(roi.width,roi.height);
        for(let v=0;v<roi.height;v++){
         const srcStart=((roi.y-py0+v)*pw+(roi.x-px0))*4;
         patchImg.data.set(smoothed.subarray(srcStart,srcStart+roi.width*4),v*roi.width*4);
        }
        sctx.putImageData(patchImg,0,0);
       }else{
        sctx.drawImage(smooth||original,roi.x,roi.y,roi.width,roi.height,0,0,roi.width,roi.height);
       }
      }else if(stroke.type==='restore'){
       sctx.drawImage(original,roi.x,roi.y,roi.width,roi.height,0,0,roi.width,roi.height);
      }else if(stroke.type==='heal'||stroke.type==='blemish'){
       const point=stroke.points[0],toScaled={x:point.x*scale,y:point.y*scale},rScaled=stroke.radius*scale;
       const fromScaled=stroke.cloneSource?{x:stroke.cloneSource.x*scale,y:stroke.cloneSource.y*scale}:stroke.type==='blemish'?findCleanBlemishSource(origCtx,size.width,size.height,toScaled,rScaled):toScaled;
       const blurR=Math.max(2,Math.min(40,Math.round(rScaled*(stroke.type==='blemish'?.85:.35)))),dx=Math.round(toScaled.x-fromScaled.x),dy=Math.round(toScaled.y-fromScaled.y);
       const dx0=Math.max(0,roi.x-blurR),dy0=Math.max(0,roi.y-blurR),dx1=Math.min(size.width,roi.x+roi.width+blurR),dy1=Math.min(size.height,roi.y+roi.height+blurR),dw=dx1-dx0,dh=dy1-dy0;
       const sxMin=clamp(roi.x-dx,0,size.width-1),sxMax=clamp(roi.x+roi.width-1-dx,0,size.width-1),syMin=clamp(roi.y-dy,0,size.height-1),syMax=clamp(roi.y+roi.height-1-dy,0,size.height-1);
       const sx0=Math.max(0,sxMin-blurR),sy0=Math.max(0,syMin-blurR),sx1=Math.min(size.width,sxMax+1+blurR),sy1=Math.min(size.height,syMax+1+blurR),swPatch=sx1-sx0,shPatch=sy1-sy0;
       const dstPixels=new Uint8ClampedArray(origCtx.getImageData(dx0,dy0,dw,dh).data),srcPixels=new Uint8ClampedArray(origCtx.getImageData(sx0,sy0,swPatch,shPatch).data);
       const patch={dw,dh,dx0,dy0,srcPixels,sw:swPatch,sh:shPatch,sx0,sy0,fullW:size.width,fullH:size.height,from:fromScaled,to:toScaled,radius:rScaled,rx:roi.x,ry:roi.y,rw:roi.width,rh:roi.height,mode:stroke.type};
       const job={kind:'heal-roi',pixels:dstPixels,width:roi.width,height:roi.height,patch};
       const healed=this.worker?await this.worker.run(job,{signal,key:key&&key+':heal',recover:()=>new Uint8ClampedArray(origCtx.getImageData(dx0,dy0,dw,dh).data)}):processPixels(job);
       const image=sctx.createImageData(roi.width,roi.height);image.data.set(healed);sctx.putImageData(image,0,0);
      }else if(stroke.type==='clone'){
       const point=stroke.points[0],from=stroke.cloneSource||point;
       sctx.drawImage(original,(point.x-from.x)*scale-roi.x,(point.y-from.y)*scale-roi.y);
      }else if(advancedTone){
       const raw=new Uint8ClampedArray(ctx.getImageData(roi.x,roi.y,roi.width,roi.height).data);
       const toned=skinTonePixels(raw,roi.width,roi.height,{warmth:stroke.warmth||0,hue:stroke.hue||0,saturation:stroke.saturation||0,lightness:stroke.lightness||0,color:stroke.color});
       const image=sctx.createImageData(roi.width,roi.height);image.data.set(toned);sctx.putImageData(image,0,0);
      }else{
       sctx.fillStyle=['makeup','paint','tone'].includes(stroke.type)?stroke.color:stroke.type==='burn'?'#35262b':'#fff6ea';
       sctx.fillRect(0,0,roi.width,roi.height);
      }
      sctx.globalCompositeOperation='destination-in';sctx.drawImage(mask,0,0);
      ctx.save();ctx.globalAlpha=clamp(stroke.strength,0,1);
      if(stroke.type==='restore'){
       ctx.globalCompositeOperation='destination-out';ctx.drawImage(mask,roi.x,roi.y);ctx.globalCompositeOperation='lighter';ctx.drawImage(scratch,roi.x,roi.y);ctx.restore();scratch.width=1;mask.width=1;
      }else{
       ctx.globalCompositeOperation=stroke.type==='erase'?'destination-out':(stroke.type==='tone'&&!advancedTone)?'color':stroke.type==='makeup'?(stroke.blend||'soft-light'):
         stroke.type==='brighten'?'screen':stroke.type==='dodge'?'soft-light':stroke.type==='burn'?'multiply':'source-over';
       ctx.drawImage(scratch,roi.x,roi.y);ctx.restore();
       scratch.width=1;mask.width=1;
      }
     }
    }
    if(i===strokes.length-2&&strokes.length>=2)saveSnapshot(strokes.length-1);
    if(i===strokes.length-1)saveSnapshot(strokes.length);
   }
   if(smooth&&this.smoothCache.get(source)!==smooth)smooth.width=1;
   original.width=1;
  }else{
   this.stats.lastCachedStrokes=0;this.stats.lastRenderedStrokes=0;
  }
  if(studio.warps?.length||studio.perspectiveX||studio.perspectiveY)output=await this.warp(output,studio,scale,{signal,key});
  const adjustments=mergePreset(studio.adjustments||{},studio.preset||'original',studio.intensity??100);
  ctx=output.getContext('2d');
  if(Object.values(adjustments).some(Number)||studio.curve?.length||studio.levels||studio.hsl){
   const totalPixels=output.width*output.height;
   if(totalPixels>this.tileThreshold&&!(adjustments.blur>0)){
    await this.gradeTiled(ctx,output.width,output.height,adjustments,studio,{signal,key});
   }else{
    this.stats.lastTiles=1;
    const pixels=ctx.getImageData(0,0,output.width,output.height);
    const job={pixels:pixels.data,width:output.width,height:output.height,adjustments,studio:{hsl:studio.hsl,levels:studio.levels,curve:studio.curve}};
    const data=this.worker?await this.worker.run(job,{signal,key,recover:()=>ctx.getImageData(0,0,output.width,output.height).data}):processPixels(job);
    const result=ctx.createImageData(output.width,output.height);result.data.set(data);ctx.putImageData(result,0,0);
   }
  }
  if(studio.lut?.size){
   const pixels=ctx.getImageData(0,0,output.width,output.height);
   applyCubeLut(pixels.data,studio.lut,studio.intensity??100,pixels.data);
   ctx.putImageData(pixels,0,0);
  }
  if(adjustments.bloom>0||adjustments.glow>0||adjustments.halation>0||adjustments.lightLeak>0||adjustments.chromatic>0){
   const pixels=ctx.getImageData(0,0,output.width,output.height);
   opticalEffectsPixels(pixels.data,output.width,output.height,adjustments,pixels.data);
   ctx.putImageData(pixels,0,0);
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
 async gradeTiled(ctx,width,height,adjustments,studio,{signal,key}={}){
  const step=Math.max(64,this.tileHeight);let tiles=0;
  for(let y0=0;y0<height;y0+=step){
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   const th=Math.min(step,height-y0),pixels=ctx.getImageData(0,y0,width,th),pixelOffset=y0*width*4;
   const job={pixels:pixels.data,width,height:th,adjustments,pixelOffset,studio:{hsl:studio.hsl,levels:studio.levels,curve:studio.curve}};
   const data=this.worker?await this.worker.run(job,{signal,key:key&&`${key}:tile:${y0}`,recover:()=>ctx.getImageData(0,y0,width,th).data}):processPixels(job);
   const result=ctx.createImageData(width,th);result.data.set(data);ctx.putImageData(result,0,y0);
   tiles++;
  }
  this.stats.lastTiles=tiles;
 }
 mask(stroke,bounds,scale){
  const ox=bounds.x||0,oy=bounds.y||0,f=stroke.feather?clamp(stroke.feather,0,1):0;
  const mask=this.canvas(bounds.width,bounds.height),ctx=mask.getContext('2d');
  const radius=Math.max(.5,stroke.radius*scale*(1+f*.65)),hard=clamp((stroke.hardness??.5)*(1-f*.7),0,.99);
  for(const p of stroke.points||[]){
   const x=p.x*scale-ox,y=p.y*scale-oy,g=ctx.createRadialGradient(x,y,radius*hard,x,y,radius);
   g.addColorStop(0,'rgba(255,255,255,1)');
   if(f>0)g.addColorStop(.55,`rgba(255,255,255,${(1-f*.45).toFixed(3)})`);
   g.addColorStop(1,'rgba(255,255,255,0)');
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
  const data=ctx.getImageData(0,0,out.width,out.height);
  const smoothed=skinSmoothPixels(data.data,out.width,out.height,Math.max(2,Math.round(out.width/200)),.65);
  const res=ctx.createImageData(out.width,out.height);res.data.set(smoothed);ctx.putImageData(res,0,0);
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
