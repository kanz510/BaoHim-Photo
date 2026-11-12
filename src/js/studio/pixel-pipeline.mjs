import{gradePixels,clamp}from'./math.mjs';import{hslPixels,blurPixels,healPixels,healRoiFromPatches,skinSmoothPixels,skinTonePixels}from'./pixel-ops.mjs';
import{warpPixels}from'./warp-pixels.mjs';
const healBlurCache=new Map();
/** Shared worker/fallback equations, in the same order as the existing raster. */
export function processPixels({kind='grade',pixels,width,height,adjustments={},studio={},from,to,radius,detail,tone,scale=1,indexedWarp=true,cacheKey,patch,pixelOffset=0}){
 if(kind==='heal-roi')return healRoiFromPatches({...patch,dstPixels:pixels});
 if(kind==='skin-smooth')return skinSmoothPixels(pixels,width,height,radius,detail);
 if(kind==='skin-tone')return skinTonePixels(pixels,width,height,tone);
 if(kind==='heal'){let lowpass;const key=cacheKey&&width*height<=2560000?cacheKey+':'+width+':'+height+':'+Math.max(2,Math.min(40,Math.round(radius*.35))):null;if(key){lowpass=healBlurCache.get(key);if(!lowpass){lowpass=blurPixels(pixels,width,height,Math.max(2,Math.min(40,Math.round(radius*.35))));healBlurCache.set(key,lowpass);if(healBlurCache.size>2)healBlurCache.delete(healBlurCache.keys().next().value);}}return healPixels(pixels,width,height,from,to,radius,lowpass);}
 if(kind==='warp')return warpPixels(pixels,width,height,studio,scale,indexedWarp);
 gradePixels(pixels,adjustments,pixels);if(studio.hsl)hslPixels(pixels,studio.hsl,pixels);
 if(studio.levels){const{black=0,white=255,gamma=1}=studio.levels,lut=Array.from({length:256},(_,i)=>Math.pow(clamp((i-black)/Math.max(1,white-black),0,1),1/clamp(gamma,.1,5))*255);for(let i=0;i<pixels.length;i+=4)for(let k=0;k<3;k++)pixels[i+k]=lut[pixels[i+k]];}
 if(studio.curve?.length){const pts=[[0,0],...studio.curve.filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)),[1,1]].sort((a,b)=>a[0]-b[0]),lut=Array.from({length:256},(_,x)=>{const t=x/255,hi=pts.findIndex(p=>p[0]>=t),b=pts[Math.max(1,hi)],a=pts[Math.max(0,hi-1)];return clamp((a[1]+(b[1]-a[1])*(t-a[0])/Math.max(.000001,b[0]-a[0]))*255,0,255);});for(let i=0;i<pixels.length;i+=4)for(let k=0;k<3;k++)pixels[i+k]=lut[pixels[i+k]];}
 if(adjustments.grain>0)for(let i=0;i<pixels.length;i+=4){const n=((((i+pixelOffset)*1664525+1013904223)>>>16)%255/255-.5)*adjustments.grain*.45;for(let k=0;k<3;k++)pixels[i+k]+=n;}
 if(adjustments.blur>0)return blurPixels(pixels,width,height,adjustments.blur/100*Math.max(width,height)*.025);
 return pixels;
}
