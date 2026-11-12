/* Original standard HSL, separable box blur, frequency-separated skin smoothing, skin tone grading and manual/spot high-frequency healing. MIT. */
import{clamp}from'./math.mjs';
export const HSL_BANDS={red:0,orange:30,yellow:60,green:120,aqua:180,blue:240,purple:280,magenta:320};
export function hslPixels(input,bands={},output=new Uint8ClampedArray(input)){
 const active=Object.entries(bands).filter(([key,v])=>Object.hasOwn(HSL_BANDS,key)&&v&&Object.values(v).some(Number));if(!active.length){if(output!==input)output.set(input);return output;}
 for(let i=0;i<input.length;i+=4){const r=input[i]/255,g=input[i+1]/255,b=input[i+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;if(d<.00001)continue;let h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h=(h*60+360)%360;let hue=0,sat=0,light=0;for(const[key,v]of active){const dist=Math.abs(((h-HSL_BANDS[key]+540)%360)-180),w=Math.max(0,1-dist/(key==='orange'?30:60));hue+=(v.hue||0)*w;sat+=(v.saturation||0)*w;light+=(v.lightness||0)*w;}
  const s=clamp(d/(1-Math.abs(2*l-1))*(1+sat/100),0,1),lum=clamp(l+light/200,0,1),hh=((h+hue+360)%360)/60,c=(1-Math.abs(2*lum-1))*s,x=c*(1-Math.abs(hh%2-1)),m=lum-c/2;
  const rgb=hh<1?[c,x,0]:hh<2?[x,c,0]:hh<3?[0,c,x]:hh<4?[0,x,c]:hh<5?[x,0,c]:[c,0,x];for(let k=0;k<3;k++)output[i+k]=(rgb[k]+m)*255;output[i+3]=input[i+3];
 }return output;
}
export function blurPixels(input,w,h,radius,output=new Uint8ClampedArray(input)){
 const r=Math.max(0,Math.min(100,Math.round(radius)));if(!r){if(output!==input)output.set(input);return output;}const tmp=new Uint8ClampedArray(input.length),span=2*r+1;
 for(let y=0;y<h;y++)for(let c=0;c<3;c++){let sum=0;for(let x=-r;x<=r;x++)sum+=input[(y*w+clamp(x,0,w-1))*4+c];for(let x=0;x<w;x++){tmp[(y*w+x)*4+c]=sum/span;sum+=input[(y*w+Math.min(w-1,x+r+1))*4+c]-input[(y*w+Math.max(0,x-r))*4+c];}}
 for(let x=0;x<w;x++)for(let c=0;c<3;c++){let sum=0;for(let y=-r;y<=r;y++)sum+=tmp[(clamp(y,0,h-1)*w+x)*4+c];for(let y=0;y<h;y++){output[(y*w+x)*4+c]=sum/span;sum+=tmp[(Math.min(h-1,y+r+1)*w+x)*4+c]-tmp[(Math.max(0,y-r)*w+x)*4+c];}}
 for(let i=3;i<input.length;i+=4)output[i]=input[i];return output;
}
export function healPixels(input,w,h,from,to,radius,lowpass){
 const low=lowpass||blurPixels(input,w,h,Math.max(2,Math.min(40,Math.round(radius*.35)))),out=new Uint8ClampedArray(input.length),dx=Math.round(to.x-from.x),dy=Math.round(to.y-from.y);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,s=(clamp(y-dy,0,h-1)*w+clamp(x-dx,0,w-1))*4;for(let k=0;k<3;k++)out[i+k]=input[s+k]-low[s+k]+low[i+k];out[i+3]=input[i+3];}return out;
}
/**
 * Local ROI healing: blurs only the padded destination and source patches instead of the full image.
 * Produces bit-identical output inside [rx, rx+rw) x [ry, ry+rh) to full-frame healPixels.
 */
export function healRoiFromPatches({dstPixels,dw,dh,dx0,dy0,srcPixels,sw,sh,sx0,sy0,fullW,fullH,from,to,radius,rx,ry,rw,rh,mode='heal'}){
 const blurR=Math.max(2,Math.min(40,Math.round(radius*(mode==='blemish'?.85:.35)))),dx=Math.round(to.x-from.x),dy=Math.round(to.y-from.y);
 const dstLow=blurPixels(dstPixels,dw,dh,blurR),srcLow=blurPixels(srcPixels,sw,sh,blurR),out=new Uint8ClampedArray(rw*rh*4);
 const blemishBlend=mode==='blemish'?.82:0;
 for(let v=0;v<rh;v++)for(let u=0;u<rw;u++){
  const x=rx+u,y=ry+v,sx=clamp(x-dx,0,fullW-1),sy=clamp(y-dy,0,fullH-1);
  const di=((y-dy0)*dw+(x-dx0))*4,si=((sy-sy0)*sw+(sx-sx0))*4,oi=(v*rw+u)*4;
  for(let k=0;k<3;k++){
   const baseLow=dstLow[di+k]*(1-blemishBlend)+srcLow[si+k]*blemishBlend;
   out[oi+k]=srcPixels[si+k]-srcLow[si+k]+baseLow;
  }
  out[oi+3]=dstPixels[di+3];
 }
 return out;
}
/**
 * Frequency separation + bilateral range-gated skin smoothing:
 * - Unifies blotchy medium-frequency skin variations (coarse lowpass)
 * - Stops at high-contrast edges (eyes, hair, eyebrows, lip borders) via bilateral range gate
 * - Re-injects fine pore micro-texture (input - fine lowpass) scaled by `detail` [0..1]
 */
export function skinSmoothPixels(input,w,h,radius=6,detail=.65,edgeThreshold=90){
 const coarseR=Math.max(2,Math.min(32,Math.round(radius))),fineR=Math.max(1,Math.min(4,Math.round(coarseR*.28)));
 const coarse=blurPixels(input,w,h,coarseR),fine=detail>0?blurPixels(input,w,h,fineR):null;
 const out=new Uint8ClampedArray(input.length),texGain=clamp(detail,0,1),invThresh=1/Math.max(12,edgeThreshold);
 for(let i=0;i<input.length;i+=4){
  const r=input[i],g=input[i+1],b=input[i+2],cr=coarse[i],cg=coarse[i+1],cb=coarse[i+2];
  const diff=(Math.abs(r-cr)+Math.abs(g-cg)+Math.abs(b-cb))*invThresh;
  const edgeWeight=1/(1+diff*diff*2.4);
  const tr=fine?(r-fine[i])*texGain:0,tg=fine?(g-fine[i+1])*texGain:0,tb=fine?(b-fine[i+2])*texGain:0;
  out[i]=clamp(r+(cr-r)*edgeWeight+tr*edgeWeight,0,255);
  out[i+1]=clamp(g+(cg-g)*edgeWeight+tg*edgeWeight,0,255);
  out[i+2]=clamp(b+(cb-b)*edgeWeight+tb*edgeWeight,0,255);
  out[i+3]=input[i+3];
 }
 return out;
}
/**
 * Finds the cleanest low-variance surrounding skin patch around a blemish point `to`
 * by sampling 8 annular candidate directions at ~1.5x radius (classical variance + perimeter color match).
 */
export function findCleanBlemishSource(ctx,fullW,fullH,to,radius){
 const dist=Math.max(4,Math.round(radius*1.55)),tx=clamp(Math.round(to.x),0,fullW-1),ty=clamp(Math.round(to.y),0,fullH-1);
 const ringR=Math.max(2,Math.round(radius*.9));
 let ringRsum=0,ringGsum=0,ringBsum=0,ringCount=0;
 for(let k=0;k<8;k++){
  const a=k*Math.PI/4,rx=clamp(Math.round(tx+Math.cos(a)*ringR),0,fullW-1),ry=clamp(Math.round(ty+Math.sin(a)*ringR),0,fullH-1);
  const d=ctx.getImageData(rx,ry,1,1).data;ringRsum+=d[0];ringGsum+=d[1];ringBsum+=d[2];ringCount++;
 }
 const refR=ringRsum/ringCount,refG=ringGsum/ringCount,refB=ringBsum/ringCount;
 let best={x:clamp(tx-dist,0,fullW-1),y:ty},bestScore=Infinity;
 for(let k=0;k<8;k++){
  const a=k*Math.PI/4,cx=clamp(Math.round(tx+Math.cos(a)*dist),0,fullW-1),cy=clamp(Math.round(ty+Math.sin(a)*dist),0,fullH-1);
  if(Math.hypot(cx-tx,cy-ty)<2)continue;
  const x0=clamp(cx-2,0,fullW-1),y0=clamp(cy-2,0,fullH-1),pw=Math.min(5,fullW-x0),ph=Math.min(5,fullH-y0);
  const patch=ctx.getImageData(x0,y0,pw,ph).data,n=pw*ph;
  let mr=0,mg=0,mb=0;
  for(let i=0;i<patch.length;i+=4){mr+=patch[i];mg+=patch[i+1];mb+=patch[i+2];}
  mr/=n;mg/=n;mb/=n;
  let variance=0;
  for(let i=0;i<patch.length;i+=4)variance+=Math.abs(patch[i]-mr)+Math.abs(patch[i+1]-mg)+Math.abs(patch[i+2]-mb);
  variance/=n;
  const colorDiff=Math.abs(mr-refR)+Math.abs(mg-refG)+Math.abs(mb-refB);
  const score=variance*1.8+colorDiff;
  if(score<bestScore){bestScore=score;best={x:cx,y:cy};}
 }
 return best;
}
function hexRgb(hex){
 if(!hex||!/^#[0-9a-f]{6}$/i.test(hex))return null;
 return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
}
/**
 * Local skin tone adjustment by mask:
 * - Warm/Cool temperature (`warmth` -100..100)
 * - Brightness/lightness (`lightness` -100..100)
 * - Hue (`hue` -180..180) and saturation (`saturation` -100..100)
 * - Optional target skin swatch (`color` #rrggbb)
 */
export function skinTonePixels(input,w,h,options={}){
 const opts=typeof w==='object'&&w!==null?w:options;
 const {warmth=0,hue=0,saturation=0,lightness=0,color=null}=opts;
 const out=new Uint8ClampedArray(input.length),targetRgb=hexRgb(color);
 const warmShift=clamp(warmth,-100,100),hueShift=clamp(hue,-180,180),satShift=clamp(saturation,-100,100),lightShift=clamp(lightness,-100,100);
 let targetH=null,targetS=null;
 if(targetRgb){
  const tr=targetRgb[0]/255,tg=targetRgb[1]/255,tb=targetRgb[2]/255,tmax=Math.max(tr,tg,tb),tmin=Math.min(tr,tg,tb),td=tmax-tmin,tl=(tmax+tmin)/2;
  if(td>.0001){targetH=((tmax===tr?((tg-tb)/td)%6:tmax===tg?(tb-tr)/td+2:(tr-tg)/td+4)*60+360)%360;targetS=td/(1-Math.abs(2*tl-1));}
 }
 for(let i=0;i<input.length;i+=4){
  let r=clamp(input[i]+warmShift*.42,0,255)/255;
  let g=clamp(input[i+1]+warmShift*.08,0,255)/255;
  let b=clamp(input[i+2]-warmShift*.42,0,255)/255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let l=(max+min)/2,h=0,s=0;
  if(d>.00001){
   h=((max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360;
   s=d/(1-Math.abs(2*l-1));
  }
  if(targetH!==null){
   const delta=((targetH-h+540)%360)-180;
   h=(h+delta*.55+360)%360;
   s=s*.5+targetS*.5;
  }
  h=(h+hueShift+360)%360;
  s=clamp(s*(1+satShift/100),0,1);
  l=clamp(l+lightShift/220,0,1);
  const hh=h/60,c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs(hh%2-1)),m=l-c/2;
  const rgb=hh<1?[c,x,0]:hh<2?[x,c,0]:hh<3?[0,c,x]:hh<4?[0,x,c]:hh<5?[x,0,c]:[c,0,x];
  out[i]=clamp(Math.round((rgb[0]+m)*255),0,255);
  out[i+1]=clamp(Math.round((rgb[1]+m)*255),0,255);
  out[i+2]=clamp(Math.round((rgb[2]+m)*255),0,255);
  out[i+3]=input[i+3];
 }
 return out;
}
