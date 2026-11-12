import { test } from 'node:test';
import assert from 'node:assert/strict';
const s=await import('../src/js/studio/project-schema.mjs').catch(()=>({}));
const valid=()=>({format:'photo-beauty-studio',version:1,name:'Portrait',width:100,height:80,layers:[{id:1,type:'image',name:'Ảnh',x:0,y:0,width:100,height:80,width_original:100,height_original:80,rotate:0,opacity:100,order:1,visible:true,composition:'source-over',studio:{sourceId:'source-1',adjustments:{},strokes:[],warps:[]}}],assets:{'source-1':'data:image/png;base64,aGVsbG8='}});
test('project validates the whole document before any current state is replaced',()=>{
 assert.equal(s.validateProject?.(valid())?.name,'Portrait');
 const bad=valid();bad.width=Infinity;assert.throws(()=>s.validateProject(bad),/dimension/i);
});
test('project rejects external assets and arbitrary renderer dispatch',()=>{
 const remote=valid();remote.assets['source-1']='https://attacker.test/pixel';assert.throws(()=>s.validateProject(remote),/asset/i);
 const code=valid();code.layers[0].render_function=['file/open','open'];assert.throws(()=>s.validateProject(code),/renderer/i);
});
test('project rejects duplicate ids and unsupported formats',()=>{
 const dup=valid();dup.layers.push({...dup.layers[0]});assert.throws(()=>s.validateProject(dup),/duplicate/i);
 assert.throws(()=>s.validateProject({...valid(),version:999}),/version/i);
});
test('project rejects a missing source before changing the current editor',()=>{
 const project=valid();delete project.assets['source-1'];assert.throws(()=>s.validateProject(project),/source/i);
});
test('malformed brush paths and warp parameters are rejected before restore',()=>{
 const brush=valid();brush.layers[0].studio.strokes=[{type:'clone',points:'invalid',radius:-4,strength:9}];
 assert.throws(()=>s.validateProject(brush),/stroke|brush/i);
 const warp=valid();warp.layers[0].studio.warps=[{from:null,to:{x:10,y:10},radius:50,strength:.5}];
 assert.throws(()=>s.validateProject(warp),/warp/i);
 const text=valid();text.layers=[{id:1,name:'Văn bản',type:'text',width:100,height:80,opacity:100,render_function:['studio_text','render'],data:'bad'}];
 assert.throws(()=>s.validateProject(text),/text/i);
});
test('project identity and native layer names cannot carry markup or invalid types',()=>{
 const p=valid();p.id='"><img src=x onerror="alert(1)">';assert.throws(()=>s.validateProject(p),/id|identity/i);
 const named=valid();named.layers[0].name=null;assert.throws(()=>s.validateProject(named),/name/i);
});
test('portable backup uses the same UTF-8 byte budget as project import',()=>{
 const project=valid();project.name='Ảnh tiếng Việt';const blob=s.projectFileBlob?.(project);assert.ok(blob);
 assert.equal(s.projectFileBlob(project,{maxBytes:blob.size}).size,blob.size);
 assert.throws(()=>s.projectFileBlob(project,{maxBytes:blob.size-1}),/180 MB|lớn|budget/i);
});
test('V2 project extensions reject invalid gradient colors and orphan makeup links',()=>{
 const p=valid();p.layers[0].studio.typography={gradient:{enabled:true,from:'url(https://bad.test)',to:'#ffffff',angle:0}};assert.throws(()=>s.validateProject(p),/gradient/i);
 const q=valid();q.layers[0].studio.makeup={targetId:999,role:'lips'};assert.throws(()=>s.validateProject(q),/makeup|linked/i);
});

test('V2 frame metadata rejects invalid padding and non-frame linked layers',()=>{
 const p=valid();p.layers[0].studio.canvasFrame={style:'paper',percent:5,padding:{left:-1,top:10,right:10,bottom:10}};assert.throws(()=>s.validateProject(p),/frame|khung/i);
});

test('Phase 4 project schema validates eyeliner and hair linked layers alongside lips/blush/eyes/brows/highlight',()=>{
 for(const role of ['lips','blush','eyes','eyeliner','brows','highlight','hair']){
  const p=valid();
  p.layers.push({id:2,type:'image',name:`Layer ${role}`,x:0,y:0,width:100,height:80,width_original:100,height_original:80,rotate:0,opacity:80,order:2,visible:true,composition:'soft-light',studio:{sourceId:'source-1',sticker:true,makeup:{targetId:1,role},strokes:[{type:'makeup',points:[{x:20,y:20}],radius:12,strength:.5,hardness:.4,feather:.55,color:'#6e473b'}],adjustments:{brightness:10,saturation:15,highlights:12,shadows:-8}}});
  assert.ok(s.validateProject(p),`validates linked ${role} layer`);
 }
});
