const renderers=new Set(['text','rectangle','ellipse','heart','star','line','arrow','triangle','studio_text']);
export const MAX_PROJECT_FILE_BYTES=180*1024*1024;
export function projectFileBlob(project,{maxBytes=MAX_PROJECT_FILE_BYTES}={}){
 validateProject(project);const blob=new Blob([JSON.stringify(project)],{type:'application/json'});
 if(blob.size>maxBytes)throw new Error('File dự án quá lớn (tối đa 180 MB). Hãy giảm số ảnh trong một bản sao hoặc xuất ảnh hoàn thiện.');
 return blob;
}
const compositions=new Set(['source-over','source-atop','multiply','screen','overlay','soft-light','darken','lighten','color','luminosity','destination-out']);
const finite=(n,min=-1e7,max=1e7)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const layerKeys=new Set('id parent_id name type x y width height width_original height_original visible is_vector hide_selection_if_active opacity order composition rotate data params color status filters render_function studio'.split(' '));
const point=p=>p&&finite(p.x,-1e6,1e6)&&finite(p.y,-1e6,1e6);
function brush(strokes,freeze=false){
 if(strokes===undefined)return;
 if(!Array.isArray(strokes)||strokes.length>3000)throw new Error('Too many brush strokes');
 for(const s of strokes){
  if(!s||(!freeze&&!['smooth','restore','clone','heal','blemish','tone','makeup','paint','erase','burn','brighten','dodge'].includes(s.type)))throw new Error('Invalid brush stroke');
  if(freeze&&s.clear)continue;
  if(!finite(s.radius,.1,20000)||!finite(s.strength??1,0,1)||!finite(s.hardness??.5,0,1)||!Array.isArray(s.points)||!s.points.length||s.points.length>6000||!s.points.every(point))throw new Error('Invalid brush stroke path');
  if(s.feather!==undefined&&!finite(s.feather,0,1))throw new Error('Invalid brush feather');
  if(s.detail!==undefined&&!finite(s.detail,0,1))throw new Error('Invalid brush detail');
  if(s.warmth!==undefined&&!finite(s.warmth,-100,100))throw new Error('Invalid skin warmth');
  if(s.hue!==undefined&&!finite(s.hue,-180,180))throw new Error('Invalid skin hue');
  if(s.saturation!==undefined&&!finite(s.saturation,-100,100))throw new Error('Invalid skin saturation');
  if(s.lightness!==undefined&&!finite(s.lightness,-100,100))throw new Error('Invalid skin lightness');
  if(s.cloneSource&&!point(s.cloneSource))throw new Error('Invalid brush source');
  if(s.blend&&!compositions.has(s.blend))throw new Error('Invalid brush blend');
  if(s.color&&!/^#[0-9a-f]{6}$/i.test(s.color))throw new Error('Invalid brush color');
 }
}
function inspect(value,depth=0,counter={n:0}){
 if(depth>40||++counter.n>100000)throw new Error('Project is too complex');
 if(value&&typeof value==='object')for(const key of Object.keys(value)){
  if(['__proto__','prototype','constructor'].includes(key))throw new Error('Unsafe project key');
  inspect(value[key],depth+1,counter);
 }
 if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Invalid dimension or parameter');
}
export function validateProject(project,{allowBlobs=false}={}){
 inspect(project);
 if(!project||project.format!=='photo-beauty-studio'||project.version!==1)throw new Error('Unsupported project version');
 if(project.id!==undefined&&(typeof project.id!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(project.id)))throw new Error('Invalid project identity');
 if(!finite(project.width,1,20000)||!finite(project.height,1,20000)||project.width*project.height>64000000)throw new Error('Invalid project dimension');
 if(typeof project.name!=='string'||project.name.length>200)throw new Error('Invalid project name');
 if(!Array.isArray(project.layers)||project.layers.length<1||project.layers.length>100)throw new Error('Invalid layer count');
 if(!project.assets||typeof project.assets!=='object')throw new Error('Missing source assets');
 const ids=new Set();
 for(const layer of project.layers){
  if(!layer||typeof layer!=='object'||Object.keys(layer).some(key=>!layerKeys.has(key)))throw new Error('Unsupported layer property');
  if(typeof layer.name!=='string'||layer.name.length>200)throw new Error('Invalid layer name');
  if(layer.params!==undefined&&(!layer.params||typeof layer.params!=='object'||Array.isArray(layer.params)))throw new Error('Invalid layer parameters');
  if(!finite(layer.id,1)||!Number.isInteger(layer.id)||ids.has(layer.id))throw new Error('Duplicate or invalid layer id');ids.add(layer.id);
  if(!['image','text','rectangle','ellipse','heart','star','line','arrow','triangle','shape'].includes(layer.type))throw new Error('Unsupported layer type');
  if(layer.render_function&&(!Array.isArray(layer.render_function)||!renderers.has(layer.render_function[0])||layer.render_function[1]!=='render'))throw new Error('Unsupported layer renderer');
  if(layer.type!=='image'&&!layer.render_function)throw new Error('Missing layer renderer');
  for(const key of ['x','y','width','height','rotate','order','opacity'])if(layer[key]!==undefined&&!finite(layer[key]))throw new Error('Invalid layer dimension');
  if(!finite(layer.width,.01,100000)||!finite(layer.height,.01,100000)||layer.opacity<0||layer.opacity>100)throw new Error('Invalid layer dimension');
  if(layer.composition&&!compositions.has(layer.composition))throw new Error('Unsupported blend mode');
  if(layer.filters?.length)throw new Error('Legacy filters are not supported in this project format');
  const studio=layer.studio||{};
  const frame=studio.canvasFrame;if(frame&&(layer.type!=='rectangle'||!['paper','blush','charcoal','polaroid'].includes(frame.style)||!finite(frame.percent,0,20)||!frame.padding||!['left','right','top','bottom'].every(k=>finite(frame.padding[k],0,20000))))throw new Error('Invalid canvas frame');
  const typography=studio.typography;if(typography){for(const key of ['glow','shadow','depth','arc'])if(typography[key]!==undefined&&!finite(typography[key],key==='arc'?-100:0,key==='depth'?24:key==='arc'?100:60))throw new Error('Invalid typography effect');if(typography.bubble&&!['none','round','speech'].includes(typography.bubble))throw new Error('Invalid typography bubble');for(const k of ['bubbleColor','depthColor','glowColor'])if(typography[k]&&!/^#[0-9a-f]{6}$/i.test(typography[k]))throw new Error('Invalid typography color');}
  const gradient=studio.typography?.gradient;if(gradient&&(typeof gradient.enabled!=='boolean'||!/^#[0-9a-f]{6}$/i.test(gradient.from)||!/^#[0-9a-f]{6}$/i.test(gradient.to)||!finite(gradient.angle??0,-360,360)))throw new Error('Invalid typography gradient');
  if(layer.type==='image'&&(!studio.sourceId||!Object.hasOwn(project.assets,studio.sourceId)))throw new Error('Missing photo source');
  if(layer.type==='image'&&layer.data!=null)throw new Error('Unsafe image data');
  if(layer.type==='image'&&(!finite(layer.width_original,1,20000)||!finite(layer.height_original,1,20000)))throw new Error('Invalid source dimension');
  brush(studio.strokes);brush(studio.freezes,true);
  if(studio.warps){
   if(!Array.isArray(studio.warps)||studio.warps.length>3000)throw new Error('Too many warp strokes');
   for(const s of studio.warps)if(!s||!point(s.from)||!point(s.to)||!finite(s.radius,.1,20000)||!finite(s.strength,0,s.mode==='restore'?1:.65)||(s.mode&&!['push','pinch','bulge','restore'].includes(s.mode))||(s.freezeCount!==undefined&&(!Number.isInteger(s.freezeCount)||s.freezeCount<0||s.freezeCount>3000)))throw new Error('Invalid warp stroke');
  }
  if(studio.adjustments)for(const [key,value] of Object.entries(studio.adjustments))if(!['exposure','brightness','contrast','saturation','temperature','tint','highlights','shadows','fade','vignette','grain','sharpen','clarity','blur'].includes(key)||!finite(value,-100,100))throw new Error('Invalid grading parameter');
  if(studio.hsl)for(const[key,value]of Object.entries(studio.hsl))if(!['red','orange','yellow','green','aqua','blue','purple','magenta'].includes(key)||!value||Object.entries(value).some(([k,v])=>!['hue','saturation','lightness'].includes(k)||!finite(v,k==='hue'?-180:-100,k==='hue'?180:100)))throw new Error('Invalid HSL band');
  if(studio.curve&&(!Array.isArray(studio.curve)||studio.curve.length>24||!studio.curve.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>finite(n,0,1)))))throw new Error('Invalid tone curve');
  if(studio.levels&&(!finite(studio.levels.black,0,254)||!finite(studio.levels.white,1,255)||studio.levels.white<=studio.levels.black||!finite(studio.levels.gamma,.1,5)))throw new Error('Invalid levels');
  for(const key of ['perspectiveX','perspectiveY'])if(studio[key]!==undefined&&!finite(studio[key],-50,50))throw new Error('Invalid perspective');
  if(studio.frame&&(!point(studio.frame)||!finite(studio.frame.width,1,20000)||!finite(studio.frame.height,1,20000)||!finite(studio.frame.radius??0,0,1000)))throw new Error('Invalid photo frame');
  if(layer.type==='text'){
   if(!Array.isArray(layer.data)||!layer.data.length||layer.data.length>200)throw new Error('Invalid text data');
   for(const line of layer.data){
    if(!Array.isArray(line)||line.length>100)throw new Error('Invalid text line');
    for(const span of line)if(!span||typeof span.text!=='string'||span.text.length>20000||(span.meta?.size!==undefined&&!finite(span.meta.size,1,2000)))throw new Error('Invalid text span');
   }
  }
 }
 for(const layer of project.layers)if(layer.studio?.makeup){const m=layer.studio.makeup,parent=project.layers.find(l=>l.id===m.targetId);if(!Number.isInteger(m.targetId)||!['lips','blush','eyes','eyeliner','brows','highlight','hair'].includes(m.role)||!parent||parent.type!=='image'||parent.studio?.makeup||parent.id===layer.id)throw new Error('Invalid linked makeup layer');}
 for(const asset of Object.values(project.assets)){
  if(allowBlobs&&typeof Blob!=='undefined'&&asset instanceof Blob)continue;
  if(typeof asset!=='string'||!/^data:image\/(png|jpeg|webp|heic|heif);base64,[A-Za-z0-9+/=]+$/.test(asset))throw new Error('Unsafe or invalid asset');
 }
 return project;
}
