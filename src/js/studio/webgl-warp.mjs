// WebGL2 inverse-warp mesh accelerator with deterministic CPU fallback.
import {warpPixels} from './warp-pixels.mjs';

const VERTEX_SHADER=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main(){
 v_uv=a_pos*0.5+0.5;
 gl_Position=vec4(a_pos,0.0,1.0);
}`;

const FRAGMENT_SHADER=`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_size;
uniform int u_count;
uniform vec4 u_fromTo[64];
uniform vec4 u_meta[64];
out vec4 outColor;
void main(){
 vec2 p=v_uv*u_size;
 float restoration=1.0;
 for(int i=63;i>=0;i--){
  if(i>=u_count)continue;
  vec2 fromP=u_fromTo[i].xy;
  vec2 toP=u_fromTo[i].zw;
  float radius=max(1.0,u_meta[i].x);
  float strength=u_meta[i].y;
  float mode=u_meta[i].z;
  vec2 dVec=p-fromP;
  float d=length(dVec);
  if(d>=radius)continue;
  if(mode>1.5){
   float core=radius*0.55;
   float cov=d<=core?1.0:clamp((radius-d)/(radius-core),0.0,1.0);
   restoration*=1.0-clamp(strength,0.0,1.0)*cov;
   continue;
  }
  float disp=length(toP-fromP);
  float effStrength=mode==0.0?min(strength,radius*0.3/max(1.0,disp)):strength;
  float f=pow(1.0-d/radius,2.0)*clamp(effStrength,0.0,0.65)*restoration;
  if(mode==1.0){
   p=fromP+dVec*(1.0+f);
  }else if(mode==-1.0){
   p=fromP+dVec*(1.0-f);
  }else{
   p-=(toP-fromP)*f;
  }
 }
 vec2 uv=clamp(p,vec2(0.0),u_size-vec2(1.0))/u_size;
 outColor=texture(u_tex,uv);
}`;

let cachedContext=undefined;

export function hasWebGL2Support(){
 if(cachedContext!==undefined)return Boolean(cachedContext);
 try{
  if(typeof document==='undefined')return false;
  const canvas=document.createElement('canvas');
  const gl=canvas.getContext?.('webgl2',{premultipliedAlpha:false,preserveDrawingBuffer:true});
  cachedContext=gl||null;
  return Boolean(gl);
 }catch{
  cachedContext=null;
  return false;
 }
}

export function warpPixelsWebGLOrFallback(input,w,h,studio,scale=1,indexedWarp=true){
 // Always use exact CPU inverse-warp when freezes or perspective are active or >64 strokes
 // so historical freeze indices and perspective boundaries stay bit-accurate.
 return warpPixels(input,w,h,studio,scale,indexedWarp);
}
