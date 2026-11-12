import {PRESETS,DEFAULT_ADJUSTMENTS} from './math.mjs';
export const LOOK_GROUPS=[['all','Tất cả'],['ccd','CCD'],['film','Film'],['vintage','Vintage'],['korean','Hàn'],['chinese','Trung'],['japanese','Nhật'],['cinema','Điện ảnh'],['y2k','Y2K'],['mono','Đen trắng'],['portrait','Chân dung'],['natural','Tự nhiên'],['saved','Của bạn']];
const groups={original:'all',muse:'portrait',peach:'portrait',morning:'portrait',milk:'portrait',clear:'natural',film:'film',mono:'mono',night:'cinema'};
const ccdIds=new Set(['y2k-flash','clear','porcelain','daylight','y2k-pop']);
export function lookGroup(look){return groups[look.id]||({'Chân dung':'portrait',Film:'film','Tự nhiên':'natural','Đen trắng':'mono','Điện ảnh':'cinema','Vintage':'vintage','Hàn':'korean','Trung':'chinese','Nhật':'japanese','Y2K':'y2k','CCD':'ccd'}[look.tag])||'natural';}
export function matchesLookGroup(look,group='all'){
 if(group==='all')return true;
 if(group==='ccd')return ccdIds.has(look.id)||lookGroup(look)==='ccd';
 return lookGroup(look)===group;
}
const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateLook(look){
 if(!look||typeof look.name!=='string'||!look.name.trim()||look.name.length>60)throw new Error('Invalid look name');
 if(look.id!==undefined&&(typeof look.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(look.id)))throw new Error('Invalid look identity');
 const r=look.recipe;if(!r||typeof r!=='object'||Array.isArray(r))throw new Error('Invalid look recipe');
 if(r.preset!==undefined&&!PRESETS.some(p=>p.id===r.preset))throw new Error('Unknown preset');
 if(r.intensity!==undefined&&!number(r.intensity,0,100))throw new Error('Invalid preset intensity');
 if(r.adjustments)for(const [key,value] of Object.entries(r.adjustments))if(!Object.hasOwn(DEFAULT_ADJUSTMENTS,key)||!number(value,key==='exposure'?-3:-100,key==='exposure'?3:100))throw new Error('Invalid look parameter');
 if(r.hsl)for(const[k,v]of Object.entries(r.hsl))if(!['red','orange','yellow','green','aqua','blue','purple','magenta'].includes(k)||!v||Object.entries(v).some(([key,n])=>!['hue','saturation','lightness'].includes(key)||!number(n,key==='hue'?-180:-100,key==='hue'?180:100)))throw new Error('Invalid look HSL');
 if(r.curve&&(!Array.isArray(r.curve)||r.curve.length>24||!r.curve.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>number(n,0,1)))))throw new Error('Invalid look curve');
 if(r.levels&&(!number(r.levels.black,0,254)||!number(r.levels.white,1,255)||r.levels.white<=r.levels.black||!number(r.levels.gamma,.1,5)))throw new Error('Invalid look levels');
 if(Object.keys(r).some(key=>!['preset','intensity','adjustments','curve','levels','hsl'].includes(key)))throw new Error('Unsafe look parameter');
 return look;
}
export function lookFromStudio(studio,name){
 const recipe={preset:studio.preset||'original',intensity:studio.intensity??100,adjustments:structuredClone(studio.adjustments||{})};
 if(studio.hsl)recipe.hsl=structuredClone(studio.hsl);if(studio.curve)recipe.curve=structuredClone(studio.curve);if(studio.levels)recipe.levels=structuredClone(studio.levels);
 return validateLook({id:crypto.randomUUID(),name:String(name).trim(),created:Date.now(),recipe});
}
