// WebGL2 inverse-warp mesh accelerator with deterministic CPU fallback and GPU memory management.
import {clamp} from './math.mjs';
import {warpPixels} from './warp-pixels.mjs';

const MAX_WARP_STROKES=64;
const MAX_FREEZE_OPS=64;
const LARGE_TEXTURE_PIXELS=2560000; // >2.5 MP: release large GPU textures immediately after readback

const VERTEX_SHADER=`#version 300 es
in vec2 a_pos;
void main(){
 gl_Position=vec4(a_pos,0.0,1.0);
}`;

const FRAGMENT_SHADER=`#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D u_tex;
uniform vec2 u_size;
uniform int u_hasPerspective;
uniform vec2 u_perspective;
uniform int u_count;
uniform vec4 u_fromTo[64];
uniform vec4 u_meta[64];
uniform int u_freezeOpCount;
uniform vec4 u_freezeGeom[64];
uniform vec4 u_freezeMeta[64];
out vec4 outColor;

float evalFreeze(vec2 pt,float limit){
 float alpha=0.0;
 for(int j=0;j<64;j++){
  if(j>=u_freezeOpCount)break;
  vec4 fm=u_freezeMeta[j];
  if(fm.x>=limit)break;
  if(fm.y>1.5){alpha=0.0;continue;}
  vec4 fg=u_freezeGeom[j];
  float r=fg.z;
  float cov=0.0;
  if(r>0.0){
   float dist=length(pt-fg.xy);
   if(dist<r){
    float core=r*clamp(fg.w,0.0,0.99);
    cov=dist<=core?1.0:clamp((r-dist)/(r-core),0.0,1.0);
   }
  }
  alpha=fm.y>0.5?alpha*(1.0-cov):max(alpha,cov);
 }
 return alpha;
}

void main(){
 vec2 xy=floor(gl_FragCoord.xy);
 vec2 p=xy;
 if(u_hasPerspective!=0){
  vec2 norm=(xy/u_size)*2.0-1.0;
  float denom=1.0+u_perspective.x*0.004*norm.x+u_perspective.y*0.004*norm.y;
  p=(norm/denom+1.0)*(u_size*0.5);
 }
 float restoration=1.0;
 for(int i=63;i>=0;i--){
  if(i>=u_count)continue;
  vec2 fromP=u_fromTo[i].xy;
  vec2 toP=u_fromTo[i].zw;
  float radius=max(1.0,u_meta[i].x);
  float rawStrength=u_meta[i].y;
  float mode=u_meta[i].z;
  float freezeLimit=u_meta[i].w;
  vec2 dVec=p-fromP;
  float d=length(dVec);
  if(d>=radius)continue;
  if(mode>1.5){
   float core=radius*0.55;
   float cov=d<=core?1.0:clamp((radius-d)/(radius-core),0.0,1.0);
   restoration*=1.0-clamp(rawStrength,0.0,1.0)*cov;
   continue;
  }
  float protection=1.0;
  if(u_freezeOpCount>0&&freezeLimit>0.0){
   protection=1.0-clamp(evalFreeze(p,freezeLimit),0.0,1.0);
  }
  float disp=length(toP-fromP);
  float effStrength=mode==0.0?min(rawStrength,(radius*0.3)/max(1.0,disp)):rawStrength;
  float oneMinus=1.0-d/radius;
  float f=(oneMinus*oneMinus)*clamp(effStrength,0.0,0.65)*protection*restoration;
  if(mode==1.0){
   p=fromP+dVec*(1.0+f);
  }else if(mode==-1.0){
   p=fromP+dVec*(1.0-f);
  }else{
   p-=(toP-fromP)*f;
  }
 }
 if(u_hasPerspective!=0&&(p.x<-1e-4||p.y<-1e-4||p.x>=u_size.x-1e-4||p.y>=u_size.y-1e-4)){
  outColor=vec4(0.0);
  return;
 }
 float sx=clamp(p.x,0.0,u_size.x-1.0);
 float sy=clamp(p.y,0.0,u_size.y-1.0);
 int wMax=int(u_size.x)-1;
 int hMax=int(u_size.y)-1;
 int x0=int(floor(sx));
 int y0=int(floor(sy));
 int x1=min(wMax,x0+1);
 int y1=min(hMax,y0+1);
 float tx=sx-float(x0);
 float ty=sy-float(y0);
 vec4 c00=texelFetch(u_tex,ivec2(x0,y0),0)*255.0;
 vec4 c10=texelFetch(u_tex,ivec2(x1,y0),0)*255.0;
 vec4 c01=texelFetch(u_tex,ivec2(x0,y1),0)*255.0;
 vec4 c11=texelFetch(u_tex,ivec2(x1,y1),0)*255.0;
 vec4 val=c00*(1.0-tx)*(1.0-ty)+c10*tx*(1.0-ty)+c01*(1.0-tx)*ty+c11*tx*ty;
 outColor=roundEven(val)/255.0;
}`;

const gpuState={
 surface:null,
 gl:null,
 program:null,
 vao:null,
 vbo:null,
 fbo:null,
 srcTex:null,
 dstTex:null,
 uniforms:null,
 maxTextureSize:0,
 allocW:0,
 allocH:0,
 contextLost:false,
 forcedDisabled:false,
 loseExt:null,
 fromToBuf:new Float32Array(MAX_WARP_STROKES*4),
 metaBuf:new Float32Array(MAX_WARP_STROKES*4),
 freezeGeomBuf:new Float32Array(MAX_FREEZE_OPS*4),
 freezeMetaBuf:new Float32Array(MAX_FREEZE_OPS*4),
 roiScratch:null,
 stats:{gpuRuns:0,cpuFallbacks:0,contextLosses:0,contextRestores:0,allocatedBytes:0,lastBackend:'none'}
};

function createSurface(){
 if(typeof document!=='undefined'&&typeof document.createElement==='function'){
  return document.createElement('canvas');
 }
 if(typeof OffscreenCanvas==='function'){
  return new OffscreenCanvas(1,1);
 }
 return null;
}

function compileShader(gl,type,source){
 const shader=gl.createShader(type);
 if(!shader)return null;
 gl.shaderSource(shader,source);
 gl.compileShader(shader);
 if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
  gl.deleteShader(shader);
  return null;
 }
 return shader;
}

function destroyGLHandles(){
 const {gl}=gpuState;
 if(gl&&!gl.isContextLost?.()){
  try{
   if(gpuState.srcTex)gl.deleteTexture(gpuState.srcTex);
   if(gpuState.dstTex)gl.deleteTexture(gpuState.dstTex);
   if(gpuState.fbo)gl.deleteFramebuffer(gpuState.fbo);
   if(gpuState.vbo)gl.deleteBuffer(gpuState.vbo);
   if(gpuState.vao)gl.deleteVertexArray(gpuState.vao);
   if(gpuState.program)gl.deleteProgram(gpuState.program);
  }catch{}
 }
 gpuState.srcTex=null;
 gpuState.dstTex=null;
 gpuState.fbo=null;
 gpuState.vbo=null;
 gpuState.vao=null;
 gpuState.program=null;
 gpuState.uniforms=null;
 gpuState.allocW=0;
 gpuState.allocH=0;
 gpuState.stats.allocatedBytes=0;
}

function initGLResources(gl){
 destroyGLHandles();
 const vs=compileShader(gl,gl.VERTEX_SHADER,VERTEX_SHADER);
 const fs=compileShader(gl,gl.FRAGMENT_SHADER,FRAGMENT_SHADER);
 if(!vs||!fs){
  if(vs)gl.deleteShader(vs);
  if(fs)gl.deleteShader(fs);
  return false;
 }
 const program=gl.createProgram();
 gl.attachShader(program,vs);
 gl.attachShader(program,fs);
 gl.bindAttribLocation(program,0,'a_pos');
 gl.linkProgram(program);
 gl.deleteShader(vs);
 gl.deleteShader(fs);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS)){
  gl.deleteProgram(program);
  return false;
 }
 const vao=gl.createVertexArray();
 const vbo=gl.createBuffer();
 const fbo=gl.createFramebuffer();
 const srcTex=gl.createTexture();
 const dstTex=gl.createTexture();
 if(!vao||!vbo||!fbo||!srcTex||!dstTex){
  destroyGLHandles();
  return false;
 }
 gl.bindVertexArray(vao);
 gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 gl.enableVertexAttribArray(0);
 gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
 gl.bindVertexArray(null);

 for(const tex of [srcTex,dstTex]){
  gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 }
 gl.bindTexture(gl.TEXTURE_2D,null);

 gpuState.program=program;
 gpuState.vao=vao;
 gpuState.vbo=vbo;
 gpuState.fbo=fbo;
 gpuState.srcTex=srcTex;
 gpuState.dstTex=dstTex;
 gpuState.maxTextureSize=Number(gl.getParameter(gl.MAX_TEXTURE_SIZE))||4096;
 gpuState.uniforms={
  u_tex:gl.getUniformLocation(program,'u_tex'),
  u_size:gl.getUniformLocation(program,'u_size'),
  u_hasPerspective:gl.getUniformLocation(program,'u_hasPerspective'),
  u_perspective:gl.getUniformLocation(program,'u_perspective'),
  u_count:gl.getUniformLocation(program,'u_count'),
  u_fromTo:gl.getUniformLocation(program,'u_fromTo[0]'),
  u_meta:gl.getUniformLocation(program,'u_meta[0]'),
  u_freezeOpCount:gl.getUniformLocation(program,'u_freezeOpCount'),
  u_freezeGeom:gl.getUniformLocation(program,'u_freezeGeom[0]'),
  u_freezeMeta:gl.getUniformLocation(program,'u_freezeMeta[0]')
 };
 return true;
}

function ensureGL(){
 if(gpuState.forcedDisabled||gpuState.contextLost)return null;
 if(gpuState.gl&&gpuState.program){
  if(gpuState.gl.isContextLost?.()){
   gpuState.contextLost=true;
   destroyGLHandles();
   return null;
  }
  return gpuState;
 }
 try{
  const surface=gpuState.surface||createSurface();
  if(!surface)return null;
  const gl=gpuState.gl||surface.getContext?.('webgl2',{
   alpha:true,
   premultipliedAlpha:false,
   antialias:false,
   depth:false,
   stencil:false,
   preserveDrawingBuffer:false,
   powerPreference:'high-performance'
  });
  if(!gl||gl.isContextLost?.())return null;
  if(!gpuState.surface){
   gpuState.surface=surface;
   gpuState.gl=gl;
   surface.addEventListener?.('webglcontextlost',event=>{
    event?.preventDefault?.();
    gpuState.contextLost=true;
    gpuState.stats.contextLosses++;
    destroyGLHandles();
   },false);
   surface.addEventListener?.('webglcontextrestored',()=>{
    gpuState.contextLost=false;
    gpuState.stats.contextRestores++;
    initGLResources(gl);
   },false);
  }
  if(!initGLResources(gl))return null;
  return gpuState;
 }catch{
  return null;
 }
}

export function hasWebGL2Support(){
 return Boolean(ensureGL());
}

export function getWebGLWarpStats(){
 return {...gpuState.stats,contextLost:gpuState.contextLost,allocW:gpuState.allocW,allocH:gpuState.allocH};
}

export function trimWebGLWarpMemory(){
 const {gl,srcTex,dstTex}=gpuState;
 if(!gl||gl.isContextLost?.()||!srcTex||!dstTex)return;
 try{
  const tiny=new Uint8Array(4);
  gl.bindTexture(gl.TEXTURE_2D,srcTex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,tiny);
  gl.bindTexture(gl.TEXTURE_2D,dstTex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,tiny);
  gl.bindTexture(gl.TEXTURE_2D,null);
  if(gpuState.surface){gpuState.surface.width=1;gpuState.surface.height=1;}
  gpuState.allocW=1;
  gpuState.allocH=1;
  gpuState.roiScratch=null;
  gpuState.stats.allocatedBytes=8;
 }catch{}
}

export function disposeWebGLWarp(){
 destroyGLHandles();
 if(gpuState.surface){
  try{gpuState.surface.width=1;gpuState.surface.height=1;}catch{}
 }
 gpuState.roiScratch=null;
 gpuState.surface=null;
 gpuState.gl=null;
}

/** Testing helper: simulates WebGL context loss and restoration cleanly. */
export function setWebGLContextLostForTest(lost=true){
 if(lost){
  gpuState.contextLost=true;
  gpuState.stats.contextLosses++;
  destroyGLHandles();
 }else{
  gpuState.contextLost=false;
  if(gpuState.gl){
   gpuState.stats.contextRestores++;
   initGLResources(gpuState.gl);
  }
 }
}

function flattenFreezeOps(freezes,scale){
 const ops=[];
 for(let i=0;i<freezes.length;i++){
  const s=freezes[i];
  if(!s)continue;
  if(s.clear){
   ops.push({x:0,y:0,radius:0,hardness:0,strokeIndex:i,opType:2});
   if(ops.length>MAX_FREEZE_OPS)return null;
   continue;
  }
  const r=Math.max(0,(Number(s.radius)||0)*scale);
  const h=s.hardness??0.5;
  const opType=s.erase?1:0;
  for(const pt of s.points||[]){
   ops.push({x:pt.x*scale,y:pt.y*scale,radius:r,hardness:h,strokeIndex:i,opType});
   if(ops.length>MAX_FREEZE_OPS)return null;
  }
 }
 return ops;
}

export function warpPixelsWebGL(input,w,h,studio={},scale=1){
 if(!input||w<1||h<1)return null;
 const rawWarps=studio?.warps||[];
 const rawFreezes=studio?.freezes||[];
 if(rawWarps.length>MAX_WARP_STROKES)return null;
 const freezeOps=rawFreezes.length?flattenFreezeOps(rawFreezes,scale):[];
 if(!freezeOps)return null;

 const state=ensureGL();
 if(!state)return null;
 const {gl,program,vao,fbo,srcTex,dstTex,uniforms,maxTextureSize}=state;
 if(w>maxTextureSize||h>maxTextureSize)return null;

 const strokes=rawWarps.map(s=>({
  ...s,
  from:{x:s.from.x*scale,y:s.from.y*scale},
  to:{x:s.to.x*scale,y:s.to.y*scale},
  radius:s.radius*scale
 }));
 const perspX=Number(studio?.perspectiveX)||0;
 const perspY=Number(studio?.perspectiveY)||0;
 const hasPerspective=Boolean(perspX||perspY);
 const result=new Uint8ClampedArray(input);
 if(!hasPerspective&&!strokes.length){
  state.stats.gpuRuns++;
  state.stats.lastBackend='webgl2';
  return result;
 }

 const minx=hasPerspective?0:Math.max(0,Math.floor(Math.min(...strokes.map(s=>s.from.x-s.radius*1.5))));
 const maxx=hasPerspective?w:Math.min(w,Math.ceil(Math.max(...strokes.map(s=>s.from.x+s.radius*1.5))));
 const miny=hasPerspective?0:Math.max(0,Math.floor(Math.min(...strokes.map(s=>s.from.y-s.radius*1.5))));
 const maxy=hasPerspective?h:Math.min(h,Math.ceil(Math.max(...strokes.map(s=>s.from.y+s.radius*1.5))));
 if(minx>=maxx||miny>=maxy){
  state.stats.gpuRuns++;
  state.stats.lastBackend='webgl2';
  return result;
 }

 const rw=maxx-minx,rh=maxy-miny;
 const fromToBuf=state.fromToBuf,metaBuf=state.metaBuf;
 for(let i=0;i<strokes.length;i++){
  const s=strokes[i],base=i*4;
  fromToBuf[base]=s.from.x;
  fromToBuf[base+1]=s.from.y;
  fromToBuf[base+2]=s.to.x;
  fromToBuf[base+3]=s.to.y;
  metaBuf[base]=Math.max(1,Number(s.radius)||1);
  metaBuf[base+1]=Number(s.strength)||0;
  metaBuf[base+2]=s.mode==='restore'?2:s.mode==='pinch'?1:s.mode==='bulge'?-1:0;
  metaBuf[base+3]=Math.min(rawFreezes.length,Math.max(0,s.freezeCount===undefined?rawFreezes.length:Math.floor(s.freezeCount)));
 }

 const freezeGeomBuf=state.freezeGeomBuf,freezeMetaBuf=state.freezeMetaBuf;
 for(let j=0;j<freezeOps.length;j++){
  const op=freezeOps[j],base=j*4;
  freezeGeomBuf[base]=op.x;
  freezeGeomBuf[base+1]=op.y;
  freezeGeomBuf[base+2]=op.radius;
  freezeGeomBuf[base+3]=op.hardness;
  freezeMetaBuf[base]=op.strokeIndex;
  freezeMetaBuf[base+1]=op.opType;
  freezeMetaBuf[base+2]=0;
  freezeMetaBuf[base+3]=0;
 }

 try{
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  if(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL!==undefined){
   gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
  }
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.pixelStorei(gl.PACK_ALIGNMENT,1);

  const srcBytes=new Uint8Array(input.buffer,input.byteOffset,input.byteLength);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D,srcTex);
  if(state.allocW===w&&state.allocH===h){
   gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,srcBytes);
  }else{
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,srcBytes);
   gl.bindTexture(gl.TEXTURE_2D,dstTex);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
   state.allocW=w;
   state.allocH=h;
   state.stats.allocatedBytes=w*h*8;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,dstTex,0);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);
   return null;
  }

  gl.viewport(0,0,w,h);
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(minx,miny,rw,rh);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);

  gl.useProgram(program);
  gl.uniform1i(uniforms.u_tex,0);
  gl.uniform2f(uniforms.u_size,w,h);
  gl.uniform1i(uniforms.u_hasPerspective,hasPerspective?1:0);
  gl.uniform2f(uniforms.u_perspective,clamp(perspX,-50,50),clamp(perspY,-50,50));
  gl.uniform1i(uniforms.u_count,strokes.length);
  if(strokes.length){
   gl.uniform4fv(uniforms.u_fromTo,fromToBuf,0,strokes.length*4);
   gl.uniform4fv(uniforms.u_meta,metaBuf,0,strokes.length*4);
  }
  gl.uniform1i(uniforms.u_freezeOpCount,freezeOps.length);
  if(freezeOps.length){
   gl.uniform4fv(uniforms.u_freezeGeom,freezeGeomBuf,0,freezeOps.length*4);
   gl.uniform4fv(uniforms.u_freezeMeta,freezeMetaBuf,0,freezeOps.length*4);
  }

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D,srcTex);
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  gl.bindVertexArray(null);
  gl.disable(gl.SCISSOR_TEST);

  if(minx===0&&rw===w){
   const target=new Uint8Array(result.buffer,result.byteOffset+miny*w*4,w*rh*4);
   gl.readPixels(0,miny,w,rh,gl.RGBA,gl.UNSIGNED_BYTE,target);
  }else{
   const needed=rw*rh*4;
   if(!state.roiScratch||state.roiScratch.byteLength<needed){
    state.roiScratch=new Uint8Array(needed);
   }
   const roiView=state.roiScratch.subarray(0,needed);
   gl.readPixels(minx,miny,rw,rh,gl.RGBA,gl.UNSIGNED_BYTE,roiView);
   const rowBytes=rw*4;
   for(let r=0;r<rh;r++){
    const srcOff=r*rowBytes;
    const dstOff=((miny+r)*w+minx)*4;
    result.set(roiView.subarray(srcOff,srcOff+rowBytes),dstOff);
   }
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.bindTexture(gl.TEXTURE_2D,null);
  if(gl.getError()!==gl.NO_ERROR){
   return null;
  }
  if(w*h>LARGE_TEXTURE_PIXELS){
   trimWebGLWarpMemory();
  }
  state.stats.gpuRuns++;
  state.stats.lastBackend='webgl2';
  return result;
 }catch{
  try{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);}catch{}
  return null;
 }
}

export function warpPixelsWebGLOrFallback(input,w,h,studio,scale=1,indexedWarp=true){
 const gpuOut=warpPixelsWebGL(input,w,h,studio,scale);
 if(gpuOut)return gpuOut;
 gpuState.stats.cpuFallbacks++;
 gpuState.stats.lastBackend='cpu';
 return warpPixels(input,w,h,studio,scale,indexedWarp);
}
