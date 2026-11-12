import{clamp,warpSample,freezeCoverage,perspectiveSample}from'./math.mjs';import{buildWarpIndex,buildFreezeIndex}from'./warp-index.mjs';
/** The existing inverse-warp equations, shared by worker and CPU fallback. */
export function warpPixels(input,w,h,studio,scale=1,indexedWarp=true){
 const result=new Uint8ClampedArray(input),strokes=(studio.warps||[]).map(s=>({...s,from:{x:s.from.x*scale,y:s.from.y*scale},to:{x:s.to.x*scale,y:s.to.y*scale},radius:s.radius*scale})),freezes=(studio.freezes||[]).map(s=>({...s,radius:s.radius*scale,points:(s.points||[]).map(p=>({x:p.x*scale,y:p.y*scale}))}));
 const warpIndex=indexedWarp?buildWarpIndex(strokes):null,freezeIndex=indexedWarp?buildFreezeIndex(freezes):null,protection=(p,s)=>freezeIndex?freezeIndex(p,s.freezeCount):freezeCoverage(p,freezes,s.freezeCount),perspective=studio.perspectiveX||studio.perspectiveY;
 const minx=perspective?0:Math.max(0,Math.floor(Math.min(...strokes.map(s=>s.from.x-s.radius*1.5)))),maxx=perspective?w:Math.min(w,Math.ceil(Math.max(...strokes.map(s=>s.from.x+s.radius*1.5))));
 const miny=perspective?0:Math.max(0,Math.floor(Math.min(...strokes.map(s=>s.from.y-s.radius*1.5)))),maxy=perspective?h:Math.min(h,Math.ceil(Math.max(...strokes.map(s=>s.from.y+s.radius*1.5))));
 for(let y=miny;y<maxy;y++)for(let x=minx;x<maxx;x++){
  const mapped=perspective?perspectiveSample({x,y},w,h,studio.perspectiveX,studio.perspectiveY):{x,y},p=warpSample(mapped,strokes,freezes.length?protection:undefined,warpIndex),sx=clamp(p.x,0,w-1),sy=clamp(p.y,0,h-1);
  if(perspective&&(p.x<0||p.y<0||p.x>=w||p.y>=h)){result.fill(0,(y*w+x)*4,(y*w+x)*4+4);continue;}
  const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),tx=sx-x0,ty=sy-y0,idx=(y*w+x)*4;
  for(let c=0;c<4;c++)result[idx+c]=input[(y0*w+x0)*4+c]*(1-tx)*(1-ty)+input[(y0*w+x1)*4+c]*tx*(1-ty)+input[(y1*w+x0)*4+c]*(1-tx)*ty+input[(y1*w+x1)*4+c]*tx*ty;
 }return result;
}
