/* Original standard HSL, separable box blur and manual high-frequency healing. MIT. */
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
