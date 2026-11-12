import {ADDITIONAL_LOOKS} from './look-definitions.mjs';
export const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function fitWithin(width,height,edge=2048){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('Invalid image dimension');
 const scale=Math.min(1,edge/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
export function layerPoint(point,layer){
 const angle=-(layer.rotate||0)*Math.PI/180;
 const dx=point.x-layer.x-layer.width/2,dy=point.y-layer.y-layer.height/2;
 const x=dx*Math.cos(angle)-dy*Math.sin(angle)+layer.width/2;
 const y=dx*Math.sin(angle)+dy*Math.cos(angle)+layer.height/2;
 return {x:Math.round(x*(layer.width_original||layer.width)/layer.width*1e6)/1e6,y:Math.round(y*(layer.height_original||layer.height)/layer.height*1e6)/1e6};
}
export function collageSlots(width,height,layout='duo',gap=20){
 gap=clamp(gap,0,Math.min(width,height)/8);
 if(layout==='magazine'){const left=(width-gap*3)*.61,right=width-gap*3-left,half=(height-gap*3)/2;return[{x:gap,y:gap,width:left,height:height-gap*2},{x:gap*2+left,y:gap,width:right,height:half},{x:gap*2+left,y:gap*2+half,width:right,height:half}];}
 const layouts={duo:[2,1],trio:[3,1],grid:[2,2],six:[3,2],stack:[1,2],long:[1,3]};
 const [cols,rows]=layouts[layout]||layouts.duo;
 const w=(width-gap*(cols+1))/cols,h=(height-gap*(rows+1))/rows;
 return Array.from({length:cols*rows},(_,i)=>({x:gap+(i%cols)*(w+gap),y:gap+Math.floor(i/cols)*(h+gap),width:w,height:h}));
}
export const DEFAULT_ADJUSTMENTS=Object.freeze({exposure:0,brightness:0,contrast:0,saturation:0,temperature:0,tint:0,highlights:0,shadows:0,fade:0,vignette:0,grain:0,sharpen:0,clarity:0,blur:0});
export const PRESETS=Object.freeze([
 {id:'original',name:'Nguyên bản',tag:'Tự nhiên',params:{}},
 {id:'muse',name:'Nàng thơ',tag:'Chân dung',params:{temperature:9,contrast:-8,saturation:-9,fade:5,brightness:3}},
 {id:'peach',name:'Đào phai',tag:'Ấm áp',params:{temperature:18,tint:9,contrast:-5,saturation:8,fade:4}},
 {id:'morning',name:'Sương mai',tag:'Trong trẻo',params:{brightness:8,contrast:-12,saturation:-8,shadows:10}},
 {id:'film',name:'Film 01',tag:'Hoài niệm',params:{contrast:12,saturation:-24,temperature:8,fade:13,grain:12}},
 {id:'milk',name:'Nâu sữa',tag:'Dịu dàng',params:{temperature:14,saturation:-20,contrast:-14,fade:9}},
 {id:'clear',name:'Trong veo',tag:'Tươi mới',params:{brightness:3,contrast:10,saturation:12,temperature:-5}},
 {id:'mono',name:'Đen trắng',tag:'Kinh điển',params:{saturation:-100,contrast:15,fade:4}},
 {id:'night',name:'Đêm xanh',tag:'Điện ảnh',params:{temperature:-20,tint:5,contrast:15,brightness:-4,saturation:-10}},
 ...ADDITIONAL_LOOKS
]);
export function gradePixels(source,settings={},target){
 const s={...DEFAULT_ADJUSTMENTS,...settings},out=target||new Uint8ClampedArray(source.length);
 const exposure=Math.pow(2,clamp(Number(s.exposure)||0,-3,3));
 const contrast=1+clamp(s.contrast,-100,100)/100,sat=1+clamp(s.saturation,-100,100)/100;
 const brightness=s.brightness*2.55,temp=s.temperature*.34,tint=s.tint*.25,fade=s.fade/100;
 for(let i=0;i<source.length;i+=4){
  let r=source[i]*exposure,g=source[i+1]*exposure,b=source[i+2]*exposure;
  const luma=(r*.2126+g*.7152+b*.0722)/255;
  const tone=(s.shadows*Math.pow(1-clamp(luma,0,1),2)+s.highlights*Math.pow(clamp(luma,0,1),2))*.8;
  r=(r-127.5)*contrast+127.5+brightness+temp+tint*.4+tone;
  g=(g-127.5)*contrast+127.5+brightness-tint*.6+tone;
  b=(b-127.5)*contrast+127.5+brightness-temp+tint*.4+tone;
  const grey=r*.2126+g*.7152+b*.0722;
  out[i]=(grey+(r-grey)*sat)*(1-fade)+fade*28;
  out[i+1]=(grey+(g-grey)*sat)*(1-fade)+fade*28;
  out[i+2]=(grey+(b-grey)*sat)*(1-fade)+fade*28;
  out[i+3]=source[i+3];
 }
 return out;
}
export function brushCoverage(distance,radius,hardness=.5){
 if(radius<=0||distance>=radius)return 0;
 const core=radius*clamp(hardness,0,.99);
 return distance<=core?1:clamp((radius-distance)/(radius-core),0,1);
}
export function warpSample(point,strokes,freeze=()=>0,index=null){
 let x=point.x,y=point.y,restoration=1;
 for(let i=index?index.previous(x,y,strokes.length-1):strokes.length-1;i>=0;i=index?index.previous(x,y,i-1):i-1){
  const s=strokes[i],dx=x-s.from.x,dy=y-s.from.y,d=Math.hypot(dx,dy),radius=Math.max(1,s.radius);
  if(d>=radius)continue;
  if(s.mode==='restore'){restoration*=1-clamp(s.strength,0,1)*brushCoverage(d,radius,.55);continue;}
  const protection=1-clamp(freeze({x,y},s),0,1);
  const displacement=Math.hypot(s.to.x-s.from.x,s.to.y-s.from.y);
  const strength=s.mode==='push'||!s.mode?Math.min(s.strength,radius*.3/Math.max(1,displacement)):s.strength;
  const f=Math.pow(1-d/radius,2)*clamp(strength,0,.65)*protection*restoration;
  if(s.mode==='pinch'||s.mode==='bulge'){
   const factor=s.mode==='pinch'?1+f:1-f;
   x=s.from.x+dx*factor;y=s.from.y+dy*factor;
  }else{x-=(s.to.x-s.from.x)*f;y-=(s.to.y-s.from.y)*f;}
 }
 return {x,y};
}
export function bodyWarps(handles,mode,amount){
 if(handles.length!==2)throw new Error('Hãy đặt hai điểm điều khiển trên ảnh trước.');
 const [a,b]=handles,radius=Math.max(20,Math.hypot(b.x-a.x,b.y-a.y)*.8),strength=.65,value=clamp(amount,0,100)/100;
 if(['waist','shoulder'].includes(mode)){const center=(a.x+b.x)/2;return [a,b].map(p=>({from:{...p},to:{x:p.x+(center-p.x)*value*.28,y:p.y},radius,strength,mode:'push'}));}
 const bottom=a.y>b.y?a:b;return [{from:{...bottom},to:{x:bottom.x,y:bottom.y+Math.abs(b.y-a.y)*value*(mode==='height'?.18:.25)},radius,strength,mode:'push'}];
}
export function faceMeshWarps(handles,feature='face',amount=40,freezeCount=0){
 if(!Array.isArray(handles)||handles.length<2)throw new Error('Hãy đặt hai điểm điều khiển trên khuôn mặt trước.');
 const [a,b]=handles,span=Math.max(24,Math.hypot(b.x-a.x,b.y-a.y)),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
 const v=clamp(Number(amount)||0,-100,100)/100;
 if(Math.abs(v)<1e-4)return [];
 const mag=Math.abs(v),sign=v>=0?1:-1,fc=Math.max(0,Math.floor(freezeCount));
 if(feature==='eyes'){
  const r=Math.max(18,span*.42),mode=sign>0?'bulge':'pinch',s=clamp(mag*.52,.04,.65);
  return [
   {from:{...a},to:{...a},radius:r,strength:s,mode,freezeCount:fc},
   {from:{...b},to:{...b},radius:r,strength:s,mode,freezeCount:fc}
  ];
 }
 if(feature==='lips'){
  const r=Math.max(16,span*.55),mode=sign>0?'bulge':'pinch',s=clamp(mag*.48,.04,.65);
  const lift=-v*span*.12;
  return [
   {from:{...mid},to:{...mid},radius:r,strength:s,mode,freezeCount:fc},
   {from:{...a},to:{x:a.x,y:a.y+lift},radius:r*.7,strength:clamp(mag*.4,.04,.65),mode:'push',freezeCount:fc},
   {from:{...b},to:{x:b.x,y:b.y+lift},radius:r*.7,strength:clamp(mag*.4,.04,.65),mode:'push',freezeCount:fc}
  ];
 }
 if(feature==='nose'){
  const top=a.y<=b.y?a:b,tip=a.y<=b.y?b:a,wingSpan=Math.max(14,span*.42),r=Math.max(14,span*.52);
  const leftWing={x:tip.x-wingSpan*.5,y:tip.y},rightWing={x:tip.x+wingSpan*.5,y:tip.y};
  return [
   {from:leftWing,to:{x:leftWing.x+(tip.x-leftWing.x)*v*.34,y:leftWing.y},radius:r,strength:.55,mode:'push',freezeCount:fc},
   {from:rightWing,to:{x:rightWing.x+(tip.x-rightWing.x)*v*.34,y:rightWing.y},radius:r,strength:.55,mode:'push',freezeCount:fc},
   {from:{...tip},to:{x:tip.x,y:tip.y+(top.y-tip.y)*v*.18},radius:r*.85,strength:.48,mode:'push',freezeCount:fc}
  ];
 }
 if(feature==='chin'||feature==='forehead'||feature==='ratio'){
  const top=a.y<=b.y?a:b,bottom=a.y<=b.y?b:a,r=Math.max(22,span*.78);
  const anchor=feature==='forehead'?top:feature==='ratio'?mid:bottom;
  const dy=(bottom.y-top.y)*v*(feature==='chin'?-.24:feature==='forehead'?.22:-.18);
  return [
   {from:{...anchor},to:{x:anchor.x,y:anchor.y+dy},radius:r,strength:.58,mode:'push',freezeCount:fc}
  ];
 }
 // face, jawline, cheekbone: 3-band mesh contour contraction/expansion along both sides of the face
 const left=a.x<=b.x?a:b,right=a.x<=b.x?b:a,r=Math.max(24,span*.68),lift=feature==='jawline'?-Math.abs(v)*span*.08:feature==='cheekbone'?-v*span*.06:0;
 const factor=feature==='jawline'?.3:feature==='cheekbone'?.24:.26;
 const warps=[];
 for(const t of [-0.18,0,0.18]){
  const yOff=span*t,lp={x:left.x,y:left.y+yOff},rp={x:right.x,y:right.y+yOff},w=t===0?1:.72;
  warps.push(
   {from:lp,to:{x:lp.x+(mid.x-lp.x)*v*factor*w,y:lp.y+lift*w},radius:r*w,strength:.58,mode:'push',freezeCount:fc},
   {from:rp,to:{x:rp.x+(mid.x-rp.x)*v*factor*w,y:rp.y+lift*w},radius:r*w,strength:.58,mode:'push',freezeCount:fc}
  );
 }
 return warps;
}
export function perspectiveSample(p,width,height,horizontal=0,vertical=0){
 const x=p.x/width*2-1,y=p.y/height*2-1,d=1+clamp(horizontal,-50,50)*.004*x+clamp(vertical,-50,50)*.004*y;
 return {x:(x/d+1)*width/2,y:(y/d+1)*height/2};
}
export function freezeCoverage(point,freezes,count=freezes.length){
 let alpha=0;
 for(let i=0;i<Math.min(count,freezes.length);i++){
  const s=freezes[i];if(s.clear){alpha=0;continue;}
  for(const q of s.points||[]){const a=brushCoverage(Math.hypot(point.x-q.x,point.y-q.y),s.radius,s.hardness);alpha=s.erase?alpha*(1-a):Math.max(alpha,a);}
 }
 return alpha;
}
export function graphemes(text){return Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(String(text).normalize('NFC')),s=>s.segment);}
export function interpolateStroke(from,to,spacing){
 const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/Math.max(1,spacing)));
 return Array.from({length:steps+1},(_,i)=>({x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps}));
}
export function mergePreset(adjustments,presetId,intensity=100){
 const params=PRESETS.find(p=>p.id===presetId)?.params||{},r={...DEFAULT_ADJUSTMENTS,...adjustments};
 for(const [key,value] of Object.entries(params))r[key]+=(value*clamp(intensity,0,100)/100);
 return r;
}
export function coverTransform(imageWidth,imageHeight,slot){
 const scale=Math.max(slot.width/imageWidth,slot.height/imageHeight);
 return {x:slot.x+(slot.width-imageWidth*scale)/2,y:slot.y+(slot.height-imageHeight*scale)/2,width:imageWidth*scale,height:imageHeight*scale};
}
