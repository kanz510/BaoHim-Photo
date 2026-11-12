// 3D .cube LUT parser, procedural film/CCD cube generator, and trilinear interpolator.
import {clamp} from './math.mjs';
import {applyCubeLut} from './pixel-ops.mjs';
export {applyCubeLut};

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
