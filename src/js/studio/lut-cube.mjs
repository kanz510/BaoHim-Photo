// 3D .cube LUT parser, procedural film/CCD cube generator, and trilinear interpolator.
import {clamp} from './math.mjs';

export function parseCubeLut(text,fallbackName='Custom LUT'){
 if(typeof text!=='string'||!text.trim())throw new Error('File LUT .cube trống hoặc không hợp lệ.');
 const lines=text.split(/\r?\n/);
 let name=fallbackName,size=0,domainMin=[0,0,0],domainMax=[1,1,1];
 const values=[];
 for(const raw of lines){
  const line=raw.trim();
  if(!line||line.startsWith('#'))continue;
  if(/^TITLE\b/i.test(line)){
   const m=line.match(/^TITLE\s+"?([^"]+)"?$/i);
   if(m?.[1])name=m[1].trim().slice(0,60);
   continue;
  }
  if(/^LUT_1D_SIZE\b/i.test(line))throw new Error('Chỉ hỗ trợ 3D LUT (.cube LUT_3D_SIZE).');
  if(/^LUT_3D_SIZE\b/i.test(line)){
   const n=Number(line.split(/\s+/)[1]);
   if(!Number.isInteger(n)||n<2||n>33)throw new Error('Kích thước LUT_3D_SIZE phải từ 2 đến 33.');
   size=n;continue;
  }
  if(/^DOMAIN_MIN\b/i.test(line)){
   const parts=line.split(/\s+/).slice(1).map(Number);
   if(parts.length===3&&parts.every(Number.isFinite))domainMin=parts;
   continue;
  }
  if(/^DOMAIN_MAX\b/i.test(line)){
   const parts=line.split(/\s+/).slice(1).map(Number);
   if(parts.length===3&&parts.every(Number.isFinite))domainMax=parts;
   continue;
  }
  if(/^[A-Za-z_]/.test(line))continue;
  const nums=line.split(/\s+/).map(Number);
  if(nums.length>=3&&nums.slice(0,3).every(Number.isFinite)){
   const r=(nums[0]-domainMin[0])/Math.max(1e-6,domainMax[0]-domainMin[0]);
   const g=(nums[1]-domainMin[1])/Math.max(1e-6,domainMax[1]-domainMin[1]);
   const b=(nums[2]-domainMin[2])/Math.max(1e-6,domainMax[2]-domainMin[2]);
   values.push(clamp(r,0,1),clamp(g,0,1),clamp(b,0,1));
  }
 }
 if(!size||values.length!==size*size*size*3)throw new Error('Dữ liệu bảng màu 3D LUT .cube không khớp kích thước.');
 return {name,size,table:values};
}

export function applyCubeLut(input,lut,intensity=100,output=new Uint8ClampedArray(input)){
 if(!lut||!lut.size||!Array.isArray(lut.table)&&!(lut.table instanceof Float32Array)){
  if(output!==input)output.set(input);
  return output;
 }
 const n=lut.size,table=lut.table,mix=clamp(Number(intensity)??100,0,100)/100;
 if(mix<=0||table.length!==n*n*n*3){
  if(output!==input)output.set(input);
  return output;
 }
 const maxIdx=n-1,n2=n*n;
 for(let i=0;i<input.length;i+=4){
  const r=clamp(input[i]/255,0,1)*maxIdx;
  const g=clamp(input[i+1]/255,0,1)*maxIdx;
  const b=clamp(input[i+2]/255,0,1)*maxIdx;
  const r0=Math.floor(r),g0=Math.floor(g),b0=Math.floor(b);
  const r1=Math.min(maxIdx,r0+1),g1=Math.min(maxIdx,g0+1),b1=Math.min(maxIdx,b0+1);
  const fr=r-r0,fg=g-g0,fb=b-b0;
  const idx=(ri,gi,bi)=>(bi*n2+gi*n+ri)*3;
  const i000=idx(r0,g0,b0),i100=idx(r1,g0,b0),i010=idx(r0,g1,b0),i110=idx(r1,g1,b0);
  const i001=idx(r0,g0,b1),i101=idx(r1,g0,b1),i011=idx(r0,g1,b1),i111=idx(r1,g1,b1);
  for(let c=0;c<3;c++){
   const c00=table[i000+c]*(1-fr)+table[i100+c]*fr;
   const c10=table[i010+c]*(1-fr)+table[i110+c]*fr;
   const c01=table[i001+c]*(1-fr)+table[i101+c]*fr;
   const c11=table[i011+c]*(1-fr)+table[i111+c]*fr;
   const c0=c00*(1-fg)+c10*fg;
   const c1=c01*(1-fg)+c11*fg;
   const mapped=(c0*(1-fb)+c1*fb)*255;
   output[i+c]=clamp(Math.round(input[i+c]*(1-mix)+mapped*mix),0,255);
  }
  output[i+3]=input[i+3];
 }
 return output;
}

function buildProceduralLut(name,size,transform){
 const table=[];
 for(let bi=0;bi<size;bi++){
  for(let gi=0;gi<size;gi++){
   for(let ri=0;ri<size;ri++){
    const r=ri/(size-1),g=gi/(size-1),b=bi/(size-1);
    const [or,og,ob]=transform(r,g,b);
    table.push(clamp(Number(or.toFixed(5)),0,1),clamp(Number(og.toFixed(5)),0,1),clamp(Number(ob.toFixed(5)),0,1));
   }
  }
 }
 return {name,size,table};
}

export const BUILTIN_CUBE_LUTS=Object.freeze({
 'ccd-digicam':buildProceduralLut('CCD Digicam .cube',9,(r,g,b)=>{
  const l=r*.2126+g*.7152+b*.0722;
  return [r*.96+l*.03,Math.min(1,g*1.03+.01),Math.min(1,b*1.08+(1-l)*.03)];
 }),
 'kodak-2383':buildProceduralLut('Kodak 2383 .cube',9,(r,g,b)=>{
  const l=r*.2126+g*.7152+b*.0722,sCurve=clamp(.5+(l-.5)*1.12,0,1),gain=l>1e-4?sCurve/l:1;
  return [r*gain*1.04+.01,g*gain*.99,(b*gain*.92)+(1-sCurve)*.04];
 }),
 'fuji-eterna':buildProceduralLut('Fuji Eterna .cube',9,(r,g,b)=>{
  const l=r*.2126+g*.7152+b*.0722;
  return [r*.94+.03,g*1.01+.02,b*.98+(1-l)*.03];
 }),
 'teal-orange':buildProceduralLut('Teal & Orange .cube',9,(r,g,b)=>{
  const l=r*.2126+g*.7152+b*.0722;
  return [r+l*.07,g+(l-.5)*.02,b+(1-l)*.08-l*.04];
 })
});
