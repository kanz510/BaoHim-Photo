import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCanvas,loadImage,GlobalFonts,Path2D} from '@napi-rs/canvas';
import {JSDOM,VirtualConsole} from 'jsdom';
import {IDBFactory} from 'fake-indexeddb';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
GlobalFonts.registerFromPath(resolve(root,'assets/fonts/Manrope.ttf'),'Manrope');
GlobalFonts.registerFromPath(resolve(root,'assets/fonts/PlayfairDisplay.ttf'),'Playfair Display');
async function boot(){
 const html=await readFile(resolve(root,'index.html'),'utf8'),built=await readFile(resolve(root,'dist/index.html'),'utf8'),script=built.match(/<script defer src="\.\/([^"]+)"/)[1],bundle=await readFile(process.env.PBS_TEST_BUNDLE||resolve(root,'dist',script),'utf8');
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));vc.on('error',(...e)=>errors.push(e.join(' ')));
 const dom=new JSDOM(html,{url:'https://studio.test',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;w.Path2D=Path2D;w.Blob=Blob;w.FileReader=class extends w.EventTarget{
  readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result=`data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;this.onload?.(new w.Event('load'));},error=>{this.error=error;this.onerror?.(new w.Event('error'));});}
 };w.indexedDB=new IDBFactory();w.structuredClone=structuredClone;w.fetch=async url=>{
  const text=typeof url==='string'?url:url.url;
  if(text.startsWith('data:'))return fetch(text);
  const path=new URL(text,'https://studio.test').pathname;
  return new Response(await readFile(resolve(root,'.'+decodeURIComponent(path))),{headers:{'Content-Type':path.endsWith('.jpg')?'image/jpeg':path.endsWith('.png')?'image/png':'application/octet-stream'}});
 };
 w.URL.createObjectURL=blob=>{const key='blob:studio-'+Math.random();blobs.set(key,blob);return key;};w.URL.revokeObjectURL=url=>blobs.delete(url);
 const blobs=new Map();w.confirm=()=>true;w.alert=message=>errors.push(message);
 w.document.fonts={ready:Promise.resolve(),load:async()=>[],check:()=>true};
 let raf=0;w.requestAnimationFrame=cb=>++raf<30?w.setTimeout(()=>cb(w.performance.now()),1):0;
 w.cancelAnimationFrame=id=>w.clearTimeout(id);w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 const surfaces=new WeakMap();
 const backing=el=>{if(!surfaces.has(el))surfaces.set(el,createCanvas(Math.max(1,el.width),Math.max(1,el.height)));const c=surfaces.get(el);if(c.width!==Math.max(1,el.width))c.width=Math.max(1,el.width);if(c.height!==Math.max(1,el.height))c.height=Math.max(1,el.height);return c;};
 for(const dimension of ['width','height']){const d=Object.getOwnPropertyDescriptor(w.HTMLCanvasElement.prototype,dimension);Object.defineProperty(w.HTMLCanvasElement.prototype,dimension,{get:d.get,set(value){d.set.call(this,value);if(surfaces.has(this))surfaces.get(this)[dimension]=Math.max(1,Number(value)||1);}});}
 w.HTMLCanvasElement.prototype.getContext=function(kind){if(kind!=='2d')return null;const ctx=backing(this).getContext('2d');return new Proxy(ctx,{get:(target,key)=>key==='canvas'?this:key==='drawImage'?((image,...args)=>target.drawImage(image instanceof w.HTMLCanvasElement?backing(image):image._decoded||image,...args)):typeof target[key]==='function'?target[key].bind(target):target[key],set:(target,key,value)=>{target[key]=value;return true;}});};
 w.HTMLCanvasElement.prototype.toDataURL=function(type,q){return backing(this).toDataURL(type,q);};
 w.HTMLCanvasElement.prototype.toBlob=function(cb,type,q){const format=['image/png','image/jpeg','image/webp'].includes(type)?type:'image/png';cb(new w.Blob([backing(this).toBuffer(format)],{type:format}));};
 const src=Object.getOwnPropertyDescriptor(w.HTMLImageElement.prototype,'src');
 Object.defineProperty(w.HTMLImageElement.prototype,'src',{get:src.get,set(value){src.set.call(this,value);Promise.resolve().then(async()=>{
   let buffer;if(blobs.has(value))buffer=Buffer.from(await blobs.get(value).arrayBuffer());else if(value.startsWith('data:'))buffer=value;else buffer=await readFile(resolve(root,'.'+new URL(value,'https://studio.test').pathname));
   this._decoded=await loadImage(buffer);this.dispatchEvent(new w.Event('load'));
  }).catch(()=>this.dispatchEvent(new w.Event('error')));}});
 for(const key of ['width','height','naturalWidth','naturalHeight'])Object.defineProperty(w.HTMLImageElement.prototype,key,{get(){return this._decoded?.[key.toLowerCase().includes('width')?'width':'height']||Number(this.getAttribute(key))||0;},set(value){this.setAttribute(key,value);}});
 const clone=w.HTMLImageElement.prototype.cloneNode;w.HTMLImageElement.prototype.cloneNode=function(deep){const c=clone.call(this,deep);c._decoded=this._decoded;return c;};
 Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get(){return ['main_wrapper','studio-stage'].includes(this.id)?800:this.tagName==='CANVAS'?this.width:200;}});
 Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get(){return ['main_wrapper','studio-stage'].includes(this.id)?640:this.tagName==='CANVAS'?this.height:100;}});
 w.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,right:this.clientWidth,bottom:this.clientHeight,width:this.clientWidth,height:this.clientHeight};};
 w.eval(bundle);
 await new Promise(r=>setTimeout(r,80));
 if(w.StudioReady)await w.StudioReady;
 return {w,errors,close:async()=>{const f=w.Studio?.facade;if(f){w.clearTimeout(f.saveTimer);await f.queue;await f.save();f.listeners.clear();}dom.window.close();}};
}

test('the studio starts with a local photo and uses the native miniPaint layer state',async()=>{
 const app=await boot();try{
  assert.ok(app.w.Studio,'PHOTO BEAUTY STUDIO boots');
  const f=app.w.Studio.facade;assert.ok(f.config.layers.some(l=>l.type==='image'));
  assert.equal(f.config.layers,f.app.Config.layers);
  assert.equal(app.w.document.querySelectorAll('[data-tool]').length>=8,true);
  assert.deepEqual(app.errors,[]);
 }finally{await app.close();}
});
test('grading and text additions undo through one native action history',async()=>{
 const app=await boot();try{
  assert.ok(app.w.Studio,'PHOTO BEAUTY STUDIO boots');const f=app.w.Studio.facade;
  await f.updateStudio({adjustments:{exposure:1}});assert.equal(f.config.layer.studio.adjustments.exposure,1);
  await f.undo();assert.equal(f.config.layer.studio.adjustments?.exposure||0,0);
  await f.redo();assert.equal(f.config.layer.studio.adjustments.exposure,1);
  const before=f.config.layers.length;await f.addText('Đẹp theo cách riêng');assert.equal(f.config.layers.length,before+1);
  await f.undo();assert.equal(f.config.layers.length,before);
 }finally{await app.close();}
});
test('mobile ready state unmounts the legacy desktop presentation and clears loading copy',async()=>{
 const app=await boot();try{const d=app.w.document;assert.equal(d.querySelector('.native-support'),null);assert.equal(d.querySelector('#main_menu'),null);assert.equal(d.querySelector('#zoom_range'),null);assert.equal(d.getElementById('studio-loading').textContent,'');assert.equal(d.getElementById('mobile-shell').getAttribute('aria-busy'),'false');await app.w.Studio.facade.activate('crop');await app.w.Studio.facade.activate('select');assert.deepEqual(app.errors,[]);}finally{await app.close();}
});
test('portable project round-trip preserves editing parameters and original source assets',async()=>{
 const app=await boot();try{
  assert.ok(app.w.Studio,'PHOTO BEAUTY STUDIO boots');const f=app.w.Studio.facade;
  await f.updateStudio({preset:'peach',intensity:70});
  const saved=await f.portableProject();assert.equal(saved.format,'photo-beauty-studio');
  assert.equal(Object.keys(saved.assets).length>0,true);
  await f.restore(saved);assert.equal(f.config.layers.find(l=>l.type==='image').studio.preset,'peach');
  assert.equal(f.config.layers.find(l=>l.type==='image').studio.intensity,70);
 }finally{await app.close();}
});
test('collage creates clipped photo layers and undo restores the original document',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade,original=f.snapshot();
  await f.collage('trio',30);assert.equal(f.config.WIDTH,1600);assert.equal(f.config.layers.filter(l=>l.studio?.frame).length,3);
  const exported=await f.exportImage({format:'png',scale:.1});assert.equal(exported.type,'image/png');assert.ok(exported.size>1000);
  await f.undo();assert.equal(f.config.WIDTH,original.width);assert.equal(f.config.layers.length,original.layers.length);
  assert.deepEqual(app.errors,[]);
 }finally{await app.close();}
});
test('a crop is a reversible geometry change and export does not change the preview',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade,original=f.snapshot();await f.crop({x:100,y:200,width:600,height:800});
  assert.equal(f.config.WIDTH,600);assert.equal(f.config.layers[0].x,-100);assert.equal(f.config.layers[0].y,-200);
  const preview=f.config.layers[0].link_canvas;const blob=await f.exportImage({format:'jpeg',scale:.1});assert.equal(blob.type,'image/jpeg');assert.equal(f.config.layers[0].link_canvas,preview);
  await f.undo();assert.equal(f.config.WIDTH,original.width);assert.equal(f.config.layers[0].x,0);
  assert.deepEqual(app.errors,[]);
 }finally{await app.close();}
});
test('a polaroid template exports an opaque paper border',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade;await f.template('polaroid');const blob=await f.exportImage({format:'png',scale:.1});
  const image=await loadImage(Buffer.from(await blob.arrayBuffer())),c=createCanvas(image.width,image.height),ctx=c.getContext('2d');ctx.drawImage(image,0,0);
  assert.deepEqual(Array.from(ctx.getImageData(1,1,1,1).data),[255,253,249,255]);
 }finally{await app.close();}
});
test('opening a new document releases decoded sources after preserving the old project',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade,oldId=f.id;await f.openDemo('muse');
  assert.equal(f.sources.size,1);assert.ok(await f.repository.load(oldId));
 }finally{await app.close();}
});
test('a failed autosave cannot discard the current document when opening another photo',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade,oldId=f.id,oldSource=f.config.layers[0].studio.sourceId,save=f.repository.save.bind(f.repository);
  f.repository.save=async()=>{throw new Error('Quota exceeded');};
  try{await assert.rejects(()=>f.openDemo('muse'),/Quota|lưu/i);assert.equal(f.id,oldId);assert.equal(f.config.layers[0].studio.sourceId,oldSource);}finally{f.repository.save=save;}
 }finally{await app.close();}
});
test('export uses a document snapshot while layer edits continue',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade,layer=f.photoLayer(),preview=layer.link_canvas;await f.addSticker('heart');
  const render=f.raster.render.bind(f.raster);let changed=false;
  f.raster.render=async(...args)=>{const out=await render(...args);if(!changed){changed=true;layer.x=9000;}return out;};
  const blob=await f.exportImage({format:'png',scale:.05});
  const image=await loadImage(Buffer.from(await blob.arrayBuffer())),c=createCanvas(image.width,image.height),ctx=c.getContext('2d');ctx.drawImage(image,0,0);
  assert.equal(ctx.getImageData(15,40,1,1).data[3],255);assert.equal(layer.link_canvas,preview);
 }finally{await app.close();}
});
test('touch cancellation creates no stroke and each finished brush gesture has one undo',async()=>{
 const app=await boot();try{
  const {facade:f,ui,router}=app.w.Studio;await ui.switchTool('beauty');f.screenPoint=event=>({x:event.clientX,y:event.clientY});
  const event=(id,x=300,y=500)=>({pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){}});
  const before=f.app.State.action_history_index;router.down(event(1));router.down(event(2));router.up(event(1));router.up(event(2));await f.queue;
  assert.equal(f.photoLayer().studio.strokes.length,0);assert.equal(f.app.State.action_history_index,before);
  router.down(event(3));router.move(event(3,320,500));router.up(event(3));await f.queue;
  assert.equal(f.photoLayer().studio.strokes.length,1);assert.equal(f.app.State.action_history_index,before+1);
  await f.undo();assert.equal(f.photoLayer().studio.strokes.length,0);
 }finally{await app.close();}
});
test('merging layers preserves appearance and undo restores both source layers',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade;await f.addSticker('bloom');const before=f.config.layers.length;
  const a=await f.exportImage({format:'png',scale:.05});await f.merge();assert.equal(f.config.layers.length,before-1);
  const b=await f.exportImage({format:'png',scale:.05}),imgA=await loadImage(Buffer.from(await a.arrayBuffer())),imgB=await loadImage(Buffer.from(await b.arrayBuffer()));
  const c=createCanvas(imgA.width,imgA.height),ctx=c.getContext('2d');ctx.drawImage(imgA,0,0);const first=ctx.getImageData(0,0,c.width,c.height).data;ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(imgB,0,0);const second=ctx.getImageData(0,0,c.width,c.height).data;
  assert.equal(first.filter((v,i)=>Math.abs(v-second[i])>25).length<first.length*.03,true);
  await f.undo();assert.equal(f.config.layers.length,before);
 }finally{await app.close();}
});
test('a pending text edit stays with its original layer when another layer is selected',async()=>{
 const app=await boot();try{
  const {facade:f,ui}=app.w.Studio;await f.addText('First');const first=f.config.layer.id;ui.pendingText={text:'Edited first'};ui.scheduleText();
  await f.addText('Second');await new Promise(r=>setTimeout(r,380));await f.queue;
  assert.equal(f.config.layers.find(l=>l.id===first).data[0][0].text,'Edited first');assert.equal(f.config.layer.data[0][0].text,'Second');
 }finally{await app.close();}
});
test('a disguised SVG is rejected before it can create an image source',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade,count=f.sources.size;
  const blob=new app.w.Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'],{type:'image/png'});
  await assert.rejects(()=>f.source(blob),/định dạng|JPEG|PNG|ảnh/i);assert.equal(f.sources.size,count);
 }finally{await app.close();}
});
test('invalid imported layer metadata cannot erase the current layers or undo history',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade;await f.updateStudio({preset:'peach'});const id=f.id,layer=f.config.layer,history=f.app.State.action_history_index;
  const saved=await f.portableProject();saved.layers[0].name=null;
  await assert.rejects(()=>f.restore(saved));assert.equal(f.id,id);assert.equal(f.config.layers.length,1);assert.equal(f.config.layer,layer);assert.equal(f.app.State.action_history_index,history);
 }finally{await app.close();}
});
test('loading a saved project commits drafts to the old project before changing documents',async()=>{
 const app=await boot();try{
  const {facade:f,ui}=app.w.Studio;const originalId=f.id;await f.openDemo('muse');const targetId=f.id;await f.openDemo('portrait');
  const oldId=f.id;ui.draft={adjustments:{brightness:77}};
  const button=app.w.document.createElement('button');button.dataset.openProject=targetId;app.w.document.body.append(button);button.click();
  for(let i=0;i<100&&f.id!==targetId;i++)await new Promise(r=>setTimeout(r,20));await f.queue;await new Promise(r=>setTimeout(r,40));
  assert.equal(f.id,targetId);assert.equal(f.photoLayer().studio.adjustments.brightness||0,0);
  assert.equal((await f.repository.load(oldId)).layers[0].studio.adjustments.brightness,77);assert.ok(await f.repository.load(originalId));
 }finally{await app.close();}
});
test('an unexpected native import failure rolls back the full current document and history',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade;await f.updateStudio({preset:'peach'});const saved=await f.portableProject(),before=f.snapshot(),selected=f.config.layer,index=f.app.State.action_history_index;
  const prototype=f.app.Actions.Insert_layer_action.prototype,original=prototype.do;prototype.do=async()=>{throw new Error('Injected native failure');};
  try{await assert.rejects(()=>f.restore(saved),/Injected/);}finally{prototype.do=original;}
  assert.equal(f.config.layers.length,1);assert.equal(f.config.layer,selected);assert.equal(f.config.WIDTH,before.width);assert.equal(f.app.State.action_history_index,index);await f.undo();assert.equal(f.photoLayer().studio.preset,'original');
 }finally{await app.close();}
});
test('merge refuses backdrop-dependent blends without changing layers or history',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade;await f.duplicate();await f.updateLayer({composition:'multiply',opacity:70});await f.addSticker('heart');
  const count=f.config.layers.length,index=f.app.State.action_history_index;
  await assert.rejects(()=>f.merge(),/trộn|blend/i);assert.equal(f.config.layers.length,count);assert.equal(f.app.State.action_history_index,index);
 }finally{await app.close();}
});
test('native selection of the active layer preserves the resolved abort contract',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade;await f.updateLayer({x:120,y:80});
  const result=await f.app.State.do_action(new f.app.Actions.Select_layer_action(f.config.layer.id));assert.equal(result.status,'aborted');
  assert.equal(f.config.layer.x,120);assert.equal(f.config.layer.y,80);
 }finally{await app.close();}
});
test('native layer drags roll back on pointercancel and one-to-two finger transitions',async()=>{
 for(const cancel of [true,false]){
  const app=await boot();try{
   const {w}=app,{facade:f}=w.Studio,canvas=w.document.querySelector('#canvas_minipaint');await f.updateLayer({x:120,y:80});await f.activate('select');
   const index=f.app.State.action_history_index,point=(id,x,y)=>({identifier:id,clientX:x,clientY:y,pageX:x,pageY:y});
   const dispatch=(type,extra)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,extra);canvas.dispatchEvent(e);};
   const ptr=(type,id,x,y)=>dispatch(type,{pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:y});
   const touch=(type,all,changed)=>dispatch(type,{touches:all,changedTouches:changed});
   ptr('pointerdown',1,120,140);touch('touchstart',[point(1,120,140)],[point(1,120,140)]);await new Promise(r=>setTimeout(r,15));
   ptr('pointermove',1,160,140);touch('touchmove',[point(1,160,140)],[point(1,160,140)]);assert.notEqual(f.config.layer.x,120);
   if(cancel){ptr('pointercancel',1,160,140);touch('touchcancel',[],[point(1,160,140)]);}
   else{
    ptr('pointerdown',2,280,140);touch('touchstart',[point(1,160,140),point(2,280,140)],[point(2,280,140)]);
    ptr('pointermove',2,350,140);touch('touchmove',[point(1,160,140),point(2,350,140)],[point(2,350,140)]);
    ptr('pointerup',2,350,140);touch('touchend',[point(1,160,140)],[point(2,350,140)]);
    ptr('pointermove',1,180,150);touch('touchmove',[point(1,180,150)],[point(1,180,150)]);
    ptr('pointerup',1,180,150);touch('touchend',[],[point(1,180,150)]);
   }
   await f.stateQueue;assert.equal(f.config.layer.x,120);assert.equal(f.config.layer.y,80);assert.equal(f.app.State.action_history_index,index);assert.equal(f.app.GUI.GUI_tools.tools_modules.select.object.moving,false);
  }finally{await app.close();}
 }
});
test('Space and mouse panning does not block the next editing gesture',async()=>{
 const app=await boot();try{
  const {w}=app,{facade:f,ui,router}=w.Studio;await ui.switchTool('beauty');f.screenPoint=e=>({x:e.clientX,y:e.clientY});
  const event=(x,y)=>({pointerId:1,pointerType:'mouse',button:0,clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){}});
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}));router.down(event(200,200));router.move(event(240,210));router.up(event(240,210));w.document.dispatchEvent(new w.KeyboardEvent('keyup',{code:'Space',key:' ',bubbles:true}));
  router.down(event(300,500));router.move(event(320,500));router.up(event(320,500));await f.queue;
  assert.equal(router.suppressNativeTouch,false);assert.equal(f.photoLayer().studio.strokes.length,1);
 }finally{await app.close();}
});
test('project rows escape previously stored unsafe identifiers as text',async()=>{
 const app=await boot();try{
  const {facade:f,ui}=app.w.Studio,raw=f.snapshot();raw.id='"><img id="injected-project" src="x" onerror="alert(1)">';
  await f.repository.save(raw,f.assetsFor(raw));await ui.projectsDialog();
  assert.equal(app.w.document.querySelector('#injected-project'),null);assert.equal(app.w.document.querySelector('#studio-dialog [onerror]'),null);
 }finally{await app.close();}
});
test('mobile preview starts with a full photo view and opens an adjustable bottom sheet',async()=>{
 const app=await boot();try{
  const {ui,facade:f}=app.w.Studio;assert.equal(ui.tool,'home');assert.equal(ui.sheet.detent,'closed');
  await ui.switchTool('adjust');assert.equal(ui.sheet.detent,'compact');const oldDoc=f.snapshot();
  ui.sheet.set('expanded');assert.equal(ui.sheet.detent,'expanded');ui.sheet.set('peek');assert.equal(ui.sheet.detent,'peek');
  assert.deepEqual(f.snapshot(),oldDoc);await ui.closeSheet();assert.equal(ui.tool,'home');assert.equal(ui.sheet.height,0);
 }finally{await app.close();}
});
test('mobile adjustment and filter controls still commit into the original native history',async()=>{
 const app=await boot();try{
  const {ui,facade:f}=app.w.Studio;await ui.switchTool('adjust');app.w.document.querySelector('[data-v2-adjust-key=brightness]').click();
  const slider=app.w.document.querySelector('[data-range="brightness"]');slider.value='34';slider.dispatchEvent(new app.w.Event('input',{bubbles:true}));await ui.action('apply');
  assert.equal(f.photoLayer().studio.adjustments.brightness,34);assert.equal(ui.tool,'home');await f.undo();assert.equal(f.photoLayer().studio.adjustments?.brightness||0,0);
  await ui.switchTool('filters');assert.equal(app.w.document.querySelectorAll('[data-preset]').length,34);ui.draft={preset:'peach',intensity:60};await ui.action('apply');assert.equal(f.photoLayer().studio.preset,'peach');
 }finally{await app.close();}
});
test('mobile text composition keeps Vietnamese input intact until composition ends',async()=>{
 const app=await boot();try{
  const {ui,facade:f}=app.w.Studio;await ui.switchTool('text');await ui.action('add-text');
  const text=app.w.document.querySelector('#studio-text');text.dispatchEvent(new app.w.CompositionEvent('compositionstart',{bubbles:true}));text.value='Đẹp theo cách của bạn';text.dispatchEvent(new app.w.Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,340));assert.notEqual(f.config.layer.data[0][0].text,text.value);
  text.dispatchEvent(new app.w.CompositionEvent('compositionend',{bubbles:true}));await ui.commitDraft();assert.equal(f.config.layer.data[0][0].text,'Đẹp theo cách của bạn');
 }finally{await app.close();}
});
test('dragging the mobile sheet changes the viewport without editing the document',async()=>{
 const app=await boot();try{
  const {ui,facade:f}=app.w.Studio;await ui.switchTool('beauty');const before=f.snapshot(),handle=app.w.document.querySelector('#sheet-drag-zone');
  const e=y=>({button:0,pointerId:7,clientY:y,target:handle,preventDefault(){}});
  ui.sheet.down(e(650));ui.sheet.move(e(300));ui.sheet.up(e(300));assert.equal(ui.sheet.detent,'expanded');
  ui.sheet.down(e(300));ui.sheet.move(e(850));ui.sheet.up(e(850));assert.equal(ui.sheet.detent,'peek');assert.deepEqual(f.snapshot(),before);
 }finally{await app.close();}
});
test('fit and home panning do not add native edit history or move photo layers',async()=>{
 const app=await boot();try{
  const {facade:f,router}=app.w.Studio,before=f.snapshot(),index=f.app.State.action_history_index;await f.fit();await f.zoom(1.6);
  const e=(x,y)=>({pointerId:1,pointerType:'touch',button:0,clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){}});
  router.down(e(200,200));router.move(e(250,230));router.up(e(250,230));await f.stateQueue;
  assert.deepEqual(f.snapshot(),before);assert.equal(f.app.State.action_history_index,index);
 }finally{await app.close();}
});
test('finishing a brush tool on a phone does not leave the next sheet stuck minimized',async()=>{
 const app=await boot();try{
  app.w.innerWidth=440;const {ui}=app.w.Studio;await ui.switchTool('beauty');await ui.action('apply');await ui.switchTool('filters');
  assert.equal(ui.sheet.el.classList.contains('minimized'),false);assert.equal(ui.sheet.detent,'compact');
 }finally{await app.close();}
});
test('V2 makeup creates a genuine transparent native layer and keeps the source photo unchanged',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade,base=f.photoLayer(),originalSource=base.studio.sourceId;assert.equal(typeof f.newMakeupLayer,'function');
  const mask=await f.newMakeupLayer('lips');assert.equal(mask.studio.makeup.targetId,base.id);assert.equal(f.config.layers.length,2);assert.equal(base.studio.sourceId,originalSource);
  await f.addStroke({type:'makeup',points:[{x:mask.width_original/2,y:mask.height_original/2}],radius:80,hardness:.8,strength:.8,color:'#ff0000',blend:'source-over'});
  assert.equal(mask.studio.strokes.length,1);assert.equal(base.studio.strokes.length,0);assert.ok(mask.link_canvas.getContext('2d').getImageData(mask.link_canvas.width/2,mask.link_canvas.height/2,1,1).data[3]>0);
  const p=await f.portableProject();await f.restore(p);const restored=f.config.layers.find(l=>l.studio?.makeup);assert.equal(restored.studio.makeup.targetId,base.id);assert.equal(restored.studio.strokes.length,1);
 }finally{await app.close();}
});
test('V2 makeup masks follow parent geometry and inverse warp without resampling the source',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade,base=f.photoLayer();assert.equal(typeof f.newMakeupLayer,'function');const mask=await f.newMakeupLayer('blush');f.workLayerId=null;
  await f.updateStudio({warps:[{from:{x:500,y:600},to:{x:515,y:600},radius:100,strength:.3,mode:'push',freezeCount:0}]},base);await f.select(base.id);await f.updateLayer({x:70,rotate:10});
  const effective=f.displayLayer(mask),recipe=f.renderRecipe(mask);assert.equal(effective.x,70);assert.equal(effective.rotate,10);assert.equal(recipe.warps.length,1);assert.ok(Math.abs(recipe.warps[0].from.x-500*mask.width_original/base.width_original)<.001);
  assert.equal((await f.portableProject()).layers.find(l=>l.id===mask.id).x,70);
 }finally{await app.close();}
});
test('V2 paper frames are editable native objects and resize as one reversible command',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade,width=f.config.WIDTH;assert.equal(typeof f.framePhoto,'function');await f.framePhoto('paper',5);
  assert.ok(f.config.WIDTH>width);assert.ok(f.config.layers.some(l=>l.studio?.canvasFrame));await f.undo();assert.equal(f.config.WIDTH,width);assert.equal(f.config.layers.length,1);
 }finally{await app.close();}
});
test('V2 history can revisit a checkpoint and redo without creating a second history stack',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade;assert.equal(typeof f.goHistory,'function');await f.updateStudio({adjustments:{exposure:.5}});await f.updateStudio({adjustments:{exposure:1}});const count=f.app.State.action_history.length;
  await f.goHistory(0);assert.equal(f.photoLayer().studio.adjustments.exposure||0,0);await f.goHistory(count);assert.equal(f.photoLayer().studio.adjustments.exposure,1);assert.equal(f.app.State.action_history.length,count);
 }finally{await app.close();}
});
test('V2 makeup export holds parent geometry in the same immutable document snapshot',async()=>{
 const app=await boot();try{
  const f=app.w.Studio.facade;assert.equal(typeof f.newMakeupLayer,'function');const base=f.photoLayer(),mask=await f.newMakeupLayer('lips');await f.addStroke({type:'makeup',points:[{x:mask.width_original/2,y:mask.height_original/2}],radius:80,hardness:.8,strength:1,color:'#ff0000',blend:'source-over'});
  const reference=await f.exportImage({format:'png',scale:.05}),render=f.raster.render.bind(f.raster);let moved=false;f.raster.render=async(...args)=>{const output=await render(...args);if(!moved){moved=true;base.x=9000;}return output;};const result=await f.exportImage({format:'png',scale:.05});
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()),new Uint8Array(await reference.arrayBuffer()));
 }finally{await app.close();}
});
test('Premium V2 starts on a real home page and exposes 34 working color looks',async()=>{
 const app=await boot();try{
  const {ui,facade:f}=app.w.Studio;assert.equal(typeof ui.showHome,'function');assert.equal(ui.libraryVisible,true);assert.ok(app.w.document.querySelector('#v2-home-content'));
  await ui.switchTool('filters');assert.equal(app.w.document.querySelectorAll('[data-preset]').length,34);ui.draft={preset:'rose',intensity:80};await ui.action('apply');assert.equal(f.basePhotoLayer().studio.preset,'rose');
 }finally{await app.close();}
});
test('Premium V2 saves a personal color look and applies it through native undo',async()=>{
 const app=await boot();try{
  const {ui,facade:f}=app.w.Studio;assert.equal(typeof ui.savePersonalLook,'function');await ui.switchTool('filters');ui.draft={preset:'latte',intensity:60};const saved=await ui.savePersonalLook('My latte');assert.equal(saved.recipe.preset,'latte');
  await f.updateStudio({preset:'original',intensity:100});await f.applyLook(saved.recipe);assert.equal(f.basePhotoLayer().studio.preset,'latte');await f.undo();assert.equal(f.basePhotoLayer().studio.preset,'original');
 }finally{await app.close();}
});

test('V2 frame reset removes the background and restores document size in one undoable edit',async()=>{
 const app=await boot();try{const f=app.w.Studio.facade,W=f.config.WIDTH,H=f.config.HEIGHT;await f.framePhoto('polaroid',6);await f.framePhoto('paper',0);assert.equal(f.config.WIDTH,W);assert.equal(f.config.HEIGHT,H);assert.ok(!f.config.layers.some(l=>l.studio?.canvasFrame));await f.undo();assert.ok(f.config.layers.some(l=>l.studio?.canvasFrame));assert.ok(f.config.HEIGHT>H);}finally{await app.close();}
});
test('V2 makeup selection resolves its own photo in multi-photo documents and guards linked merges',async()=>{
 const app=await boot();try{const f=app.w.Studio.facade,parent=f.basePhotoLayer();const first=await f.newMakeupLayer('blush');await f.open(new Blob([await readFile(resolve(root,'assets/photos/muse.jpg'))],{type:'image/jpeg'}),'Second',{replace:false});await f.chooseMakeupLayer(first.id);assert.equal(f.basePhotoLayer().id,parent.id);await f.select(parent.id);await assert.rejects(f.merge(),/trang điểm|liên kết|linked/);assert.ok(f.config.layers.some(l=>l.id===first.id));}finally{await app.close();}
});
test('Premium V2 exposes separate functional text controls including layer-wide gradient',async()=>{
 const app=await boot();try{const {ui,facade:f}=app.w.Studio;await ui.switchTool('text');await ui.action('add-text');ui.textTab='color';ui.renderPanel();const e=app.w.document.querySelector('#v2-gradient-enabled');assert.ok(e);e.checked=true;e.dispatchEvent(new app.w.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,30));await f.queue;assert.equal(f.config.layer.studio.typography.gradient.enabled,true);await f.undo();assert.ok(!f.config.layer.studio.typography?.gradient?.enabled);}finally{await app.close();}
});

test('V2 collage retains linked makeup in every slot and undo restores the original layers',async()=>{
 const app=await boot();try{const f=app.w.Studio.facade,photo=f.basePhotoLayer(),mask=await f.newMakeupLayer('lips');await f.addStroke({type:'makeup',points:[{x:300,y:400}],radius:30,strength:.5,hardness:.4,color:'#b65276',blend:'source-over'});const history=f.app.State.action_history_index;await f.collage('duo',24);const photos=f.config.layers.filter(l=>l.type==='image'&&!l.studio?.sticker),masks=f.config.layers.filter(l=>l.studio?.makeup);assert.equal(photos.length,2);assert.equal(masks.length,2);assert.equal(f.app.State.action_history_index,history+1);for(const child of masks)assert.ok(photos.some(p=>p.id===child.studio.makeup.targetId));await f.undo();assert.ok(f.config.layers.some(l=>l.id===photo.id));assert.ok(f.config.layers.some(l=>l.id===mask.id));}finally{await app.close();}
});
test('V2 resizing a framed document keeps frame reset reversible and geometrically correct',async()=>{
 const app=await boot();try{const f=app.w.Studio.facade,W=f.config.WIDTH,H=f.config.HEIGHT;await f.framePhoto('paper',5);await f.resize(f.config.WIDTH*2,f.config.HEIGHT*2);await f.framePhoto('paper',0);assert.equal(f.config.WIDTH,W*2);assert.equal(f.config.HEIGHT,H*2);}finally{await app.close();}
});

if(process.env.PBS_LARGE_PHOTO_QA)test('large-photo QA opens a real 48 MP JPEG, fits its viewport and exports JPG/PNG at 12 MP',async()=>{
 const {writeFile,mkdir}=await import('node:fs/promises');await mkdir(resolve(root,'work/v2'),{recursive:true});const app=await boot();const metrics={environment:'Node 24, jsdom native canvas bridge, CPU fallback; synthetic 48 MP JPEG, not Safari',operations:[]};let fixture=createCanvas(6000,8000),ctx=fixture.getContext('2d');ctx.fillStyle='#c79dac';ctx.fillRect(0,0,6000,8000);for(let i=0;i<60;i++){ctx.fillStyle=i%2?'#d1afbc':'#b88d9e';ctx.fillRect(i*100,0,50,8000);}const bytes=fixture.toBuffer('image/jpeg');fixture.width=1;fixture=null;global.gc?.();
 try{const f=app.w.Studio.facade;let t=performance.now();await f.open(new Blob([bytes],{type:'image/jpeg'}),'48 MP synthetic QA');metrics.operations.push({operation:'Open + preview',ms:Math.round(performance.now()-t),rssMiB:Math.round(process.memoryUsage().rss/1048576)});assert.equal(f.config.WIDTH,6000);assert.equal(f.config.HEIGHT,8000);assert.ok(f.config.ZOOM<.1);assert.ok(f.config.WIDTH*f.config.ZOOM<=800);assert.ok(f.config.HEIGHT*f.config.ZOOM<=640);
  await f.updateStudio({preset:'rose',intensity:70});for(const format of ['jpeg','png']){global.gc?.();t=performance.now();const blob=await f.exportImage({format,scale:.5}),image=await loadImage(Buffer.from(await blob.arrayBuffer()));assert.equal(image.width,3000);assert.equal(image.height,4000);assert.equal(blob.type,'image/'+format);metrics.operations.push({operation:'Export '+format,ms:Math.round(performance.now()-t),bytes:blob.size,width:image.width,height:image.height,rssMiB:Math.round(process.memoryUsage().rss/1048576)});}metrics.peakRssMiB=Math.round(process.resourceUsage().maxRSS/1024);await writeFile(resolve(root,'work/v2/large-photo-qa.json'),JSON.stringify(metrics,null,2));
 }finally{await app.close();}
});

test('V2 export releases temporary rendered surfaces and keeps the screen preview alive',async()=>{
 const app=await boot();try{const {facade:f,ui}=app.w.Studio;ui.thumbnailBusy=true;const preview=f.basePhotoLayer().link_canvas,W=preview.width,outputs=[],render=f.raster.render.bind(f.raster);f.raster.render=async(...args)=>{const output=await render(...args);outputs.push(output);return output;};await f.exportImage({format:'png',scale:.2});assert.ok(outputs.length);assert.ok(outputs.every(c=>c.width===1));assert.equal(preview.width,W);}finally{await app.close();}
});

test('V2 frame width retains a restored style and rotate keeps paper covering the canvas',async()=>{
 const app=await boot();try{const {ui,facade:f}=app.w.Studio;await f.framePhoto('polaroid',5);ui.frameStyle='paper';await ui.switchTool('frames');const slider=app.w.document.querySelector('[data-group=frame]');slider.value='6';slider.dispatchEvent(new app.w.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,30));await f.queue;assert.equal(f.config.layers.find(l=>l.studio?.canvasFrame).studio.canvasFrame.style,'polaroid');await f.rotate();const frame=f.config.layers.find(l=>l.studio?.canvasFrame);assert.equal(frame.width,f.config.WIDTH);assert.equal(frame.height,f.config.HEIGHT);}finally{await app.close();}
});
test('V2 makeup in collage stays clipped in PNG export and cannot bleed into the gutter',async()=>{
 const app=await boot();try{const f=app.w.Studio.facade;await f.newMakeupLayer('lips');await f.addStroke({type:'makeup',points:[{x:400,y:500}],radius:2000,strength:1,hardness:.95,color:'#c83765',blend:'source-over'});await f.collage('duo',30);const blob=await f.exportImage({format:'png',scale:.25}),img=await loadImage(Buffer.from(await blob.arrayBuffer())),canvas=createCanvas(img.width,img.height),ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);assert.deepEqual([...ctx.getImageData(3,150,1,1).data],[250,247,242,255]);}finally{await app.close();}
});

test('V2 history rejects a queued checkpoint that was removed by a new edit without stalling',async()=>{
 const app=await boot();try{const f=app.w.Studio.facade;await f.updateStudio({preset:'rose'});await f.updateStudio({preset:'latte'});await f.updateStudio({preset:'film'});await f.goHistory(0);let calls=0;const redo=f.app.State.redo_action.bind(f.app.State);f.app.State.redo_action=async()=>{if(++calls>4)throw new Error('stalled redo loop');return redo();};const edit=f.updateStudio({adjustments:{brightness:1}}),jump=f.goHistory(3);await edit;await assert.rejects(jump,/Mốc|lịch sử|hợp lệ/);assert.equal(calls,0);assert.equal(f.app.State.action_history_index,1);}finally{await app.close();}
});
test('V2 export freezes dimensions with geometry before a queued resize',async()=>{
 const app=await boot();try{const f=app.w.Studio.facade,W=f.config.WIDTH,H=f.config.HEIGHT,promise=f.exportImage({format:'png',scale:.1});await f.resize(W*2,H*2);const blob=await promise,img=await loadImage(Buffer.from(await blob.arrayBuffer()));assert.ok(img.width===Math.round(W*.1)&&img.height===Math.round(H*.1)||img.width===Math.round(W*.2)&&img.height===Math.round(H*.2));const pixels=createCanvas(img.width,img.height),ctx=pixels.getContext('2d');ctx.drawImage(img,0,0);assert.ok(ctx.getImageData(Math.floor(img.width*.95),Math.floor(img.height*.95),1,1).data[3]>240,'snapshot cannot have transparent bands from mixing old geometry with new document dimensions');}finally{await app.close();}
});

test('V2 delayed makeup creation and font load cannot write into a different document',async()=>{
 const app=await boot();try{const {facade:f,ui}=app.w.Studio;ui.thumbnailBusy=true;const original=app.w.HTMLCanvasElement.prototype.toBlob;let release;app.w.HTMLCanvasElement.prototype.toBlob=function(cb,...args){if(!release)release=()=>original.call(this,cb,...args);else original.call(this,cb,...args);};const makeup=f.newMakeupLayer('lips'),rejected=assert.rejects(makeup,/Dự án|dự án|ảnh/);await new Promise(r=>setTimeout(r,5));await f.openDemo('muse');release();await rejected;assert.equal(f.sources.size,1);assert.ok(!f.config.layers.some(l=>l.studio?.makeup));app.w.HTMLCanvasElement.prototype.toBlob=original;
  await f.addText('Cũ');let resolveFont;app.w.document.fonts.load=()=>new Promise(r=>resolveFont=r);const text=f.updateText({meta:{family:'Lora'}}),stale=assert.rejects(text,/Dự án|dự án|chữ/);await f.openDemo('portrait');resolveFont([]);await stale;assert.equal(f.config.layers.filter(l=>l.type==='text').length,0);
 }finally{await app.close();}
});
test('V2 project management deletes an old local draft and its thumbnail through real controls',async()=>{
 const app=await boot();try{const {ui,facade:f}=app.w.Studio,oldId=f.id;await f.openDemo('muse');await ui.showHome('projects');const remove=app.w.document.querySelector(`[data-v2-remove-project="${oldId}"]`);assert.ok(remove);remove.click();app.w.document.querySelector(`[data-v2-delete-project="${oldId}"]`).click();await new Promise(r=>setTimeout(r,30));assert.equal(await f.repository.load(oldId),null);assert.equal(await ui.preferences.thumbnail(oldId),null);assert.notEqual(f.id,oldId);}finally{await app.close();}
});
test('V2 rapid tool navigation cannot leave adjustment targeting a makeup mask',async()=>{
 const app=await boot();try{const {ui,facade:f}=app.w.Studio;const a=ui.switchTool('makeup'),b=ui.switchTool('adjust');await Promise.all([a,b]);assert.equal(ui.tool,'adjust');assert.equal(f.photoLayer().id,f.basePhotoLayer().id);assert.ok(!f.activeMakeupLayer());}finally{await app.close();}
});

test('V2 holding compare is temporary, restores prior state and adds no history',async()=>{
 const app=await boot();try{const {ui,facade:f}=app.w.Studio;await ui.closeSheet();ui.showEditor();const button=app.w.document.querySelector('[data-v2-action=compare]'),history=f.app.State.action_history_index;const pointer=type=>{const e=new app.w.MouseEvent(type,{bubbles:true,button:0,cancelable:true});Object.defineProperty(e,'pointerId',{value:7});button.dispatchEvent(e);};pointer('pointerdown');await new Promise(r=>setTimeout(r,10));assert.equal(f.compare,true);pointer('pointerup');await new Promise(r=>setTimeout(r,20));assert.equal(f.compare,false);assert.equal(f.app.State.action_history_index,history);await f.setCompare(true);pointer('pointerdown');await new Promise(r=>setTimeout(r,10));pointer('pointercancel');await new Promise(r=>setTimeout(r,10));assert.equal(f.compare,true);assert.equal(f.app.State.action_history_index,history);}finally{await app.close();}
});

test('manual HSL, healing, skin tone and brows survive native undo and PBS v1 reopen',async()=>{const app=await boot();try{const f=app.w.Studio.facade;const fixture=createCanvas(80,100);fixture.getContext('2d').fillRect(0,0,80,100);await f.open(new Blob([fixture.toBuffer('image/png')],{type:'image/png'}),'Small fixture');await f.updateStudio({hsl:{red:{hue:12,saturation:-10,lightness:5}},adjustments:{blur:12}});await f.addStroke({type:'heal',radius:35,strength:.6,hardness:.3,points:[{x:150,y:160}],cloneSource:{x:100,y:160}});await f.addStroke({type:'tone',radius:40,strength:.3,hardness:.4,color:'#d6a385',points:[{x:200,y:200}]});const before=f.config.layers.length;await f.newMakeupLayer('brows');assert.equal(f.activeMakeupLayer().studio.makeup.role,'brows');await f.undo();assert.equal(f.config.layers.length,before);await f.redo();const p=await f.portableProject();assert.equal(p.version,1);await f.restore(p);assert.equal(f.config.layers.find(l=>l.studio?.makeup)?.studio.makeup.role,'brows');assert.equal(f.config.layers.find(l=>l.studio?.hsl)?.studio.hsl.red.hue,12);assert.deepEqual(app.errors,[]);}finally{await app.close();}});

test('an optional checkpoint failure leaves the current project durably saved',async()=>{const app=await boot();try{const f=app.w.Studio.facade;await f.checkpointQueue;const original=f.checkpoints.save.bind(f.checkpoints);f.checkpoints.save=async()=>{throw Error('Quota exceeded');};await f.updateStudio({intensity:52});await f.save();await f.checkpointQueue;const saved=await f.repository.load(f.id);assert.equal(saved.layers.find(l=>l.type==='image').studio.intensity,52);assert.equal(f.saved,true);f.checkpoints.save=original;}finally{await app.close();}});

test('a chin preset cannot constrain a later free Liquify brush',async()=>{const app=await boot();try{const{ui}=app.w.Studio;await ui.switchTool('reshape');app.w.document.querySelector('[data-v2-reshape-preset="chin"]').click();await new Promise(r=>setTimeout(r,5));assert.equal(ui.brush.axis,'y');app.w.document.querySelector('[data-brush="push"]').click();await new Promise(r=>setTimeout(r,5));assert.equal(ui.brush.axis,undefined);assert.equal(ui.reshapePreset,undefined);}finally{await app.close();}});

test('tool resets clear optional HSL and typography effects and remain undoable',async()=>{const app=await boot();try{const{ui,facade:f}=app.w.Studio;await f.updateStudio({hsl:{red:{hue:60}}});await ui.switchTool('adjust');await ui.action('reset');assert.deepEqual(JSON.parse(JSON.stringify(f.basePhotoLayer().studio.hsl)),{});await f.undo();assert.equal(f.basePhotoLayer().studio.hsl.red.hue,60);await f.addText('Đẹp',{typography:{glow:20,depth:10,bubble:'speech'}});await ui.switchTool('text');await ui.action('reset');const ty=f.config.layer.studio.typography;assert.equal(ty.glow,0);assert.equal(ty.depth,0);assert.equal(ty.bubble,'none');}finally{await app.close();}});

test('undo invalidates a delayed color render even when the old neutral recipe is cached',async()=>{const app=await boot();let release;try{const f=app.w.Studio.facade,c=createCanvas(48,48);c.getContext('2d').fillStyle='#222222';c.getContext('2d').fillRect(0,0,48,48);await f.open(new Blob([c.toBuffer('image/png')],{type:'image/png'}),'Delayed color');const layer=f.basePhotoLayer(),render=f.raster.render.bind(f.raster),gate=new Promise(r=>release=r);let started=false;f.raster.render=async(source,studio,options)=>{if(studio.adjustments?.brightness===40){started=true;await gate;}return render(source,studio,options);};const changing=f.updateStudio({adjustments:{brightness:40}});await f.queue;while(!started)await new Promise(r=>setTimeout(r,0));await f.undo();release();await changing;assert.equal(layer.studio.adjustments.brightness,undefined);assert.equal(layer.link_canvas.getContext('2d').getImageData(5,5,1,1).data[0],34);}finally{release?.();await app.close();}});

test('a delayed template cannot add its text to a replacement photo',async()=>{const app=await boot();let release;try{const f=app.w.Studio.facade,render=f.raster.render.bind(f.raster),gate=new Promise(r=>release=r);let started=false;f.raster.render=async(source,studio,options)=>{if(studio.preset==='film'){started=true;await gate;}return render(source,studio,options);};const applying=f.template('editorial'),rejected=assert.rejects(applying,/Dự án|dự án|đổi/);await f.queue;while(!started)await new Promise(r=>setTimeout(r,0));await f.openDemo('muse');release();await rejected;assert.equal(f.config.layers.filter(l=>l.type==='text').length,0);}finally{release?.();await app.close();}});

test('Phase 0 corrupted project restore falls back to Home and Web Share API falls back to download',async()=>{
 const app=await boot();
 try{
  const {ui,facade:f}=app.w.Studio;
  await ui.closeSheet();ui.showEditor();
  assert.equal(ui.libraryVisible,false);
  await assert.rejects(()=>ui.loadProject({format:'photo-beauty-studio',version:1,id:'bad',name:'Corrupted',width:100,height:100,layers:[],assets:{}}));
  assert.equal(ui.libraryVisible,true,'failed project restore returns safely to Home screen');
  // Web Share API fallback when navigator.share is absent
  let downloaded=null;
  const origDownload=ui.download.bind(ui);
  ui.download=(blob,name)=>{downloaded={blob,name};};
  const blob=new app.w.Blob(['jpeg-data'],{type:'image/jpeg'});
  const res1=await ui.shareOrDownload(blob,'portrait.jpg');
  assert.equal(res1,'downloaded');
  assert.equal(downloaded?.name,'portrait.jpg');
  // Web Share API primary path when navigator.share is available
  let sharedPayload=null;
  app.w.navigator.canShare=()=>true;
  app.w.navigator.share=async data=>{sharedPayload=data;};
  const res2=await ui.shareOrDownload(blob,'shared.jpg');
  assert.equal(res2,'shared');
  assert.equal(sharedPayload?.files?.[0]?.name,'shared.jpg');
  ui.download=origDownload;
 }finally{await app.close();}
});

test('Phase 1 beauty retouch UI exposes blemish spot heal, feather, detail and skin tone Warm/Cool/HSL controls with Undo/Redo',async()=>{
 const app=await boot();
 try{
  const {ui,facade:f}=app.w.Studio;
  const fixture=createCanvas(80,80),ctx=fixture.getContext('2d');
  ctx.fillStyle='rgb(212,170,148)';ctx.fillRect(0,0,80,80);
  ctx.fillStyle='rgb(115,40,40)';ctx.beginPath();ctx.arc(40,40,3,0,Math.PI*2);ctx.fill();
  await f.open(new Blob([fixture.toBuffer('image/png')],{type:'image/png'}),'Phase 1 Portrait');
  await ui.switchTool('beauty');
  // Smooth brush exposes feather and detail tabs
  assert.ok(app.w.document.querySelector('[data-v2-brush-setting="feather"]'));
  assert.ok(app.w.document.querySelector('[data-v2-brush-setting="detail"]'));
  // Blemish brush heals without pre-selecting cloneSource and supports Undo/Redo
  app.w.document.querySelector('[data-brush="blemish"]').click();
  await new Promise(r=>setTimeout(r,10));
  assert.equal(ui.brush.mode,'blemish');
  await f.addStroke({type:'blemish',points:[{x:40,y:40}],radius:7,strength:.95,hardness:.7,feather:.4});
  assert.equal(f.basePhotoLayer().studio.strokes.length,1);
  await f.undo();
  assert.equal(f.basePhotoLayer().studio.strokes.length,0);
  await f.redo();
  assert.equal(f.basePhotoLayer().studio.strokes.length,1);
  // Tone brush exposes warmth, lightness, hue, saturation tabs
  app.w.document.querySelector('[data-brush="tone"]').click();
  await new Promise(r=>setTimeout(r,10));
  assert.ok(app.w.document.querySelector('[data-v2-tone-setting="warmth"]'));
  assert.ok(app.w.document.querySelector('[data-v2-tone-setting="lightness"]'));
  assert.ok(app.w.document.querySelector('[data-v2-tone-setting="hue"]'));
  assert.ok(app.w.document.querySelector('[data-v2-tone-setting="saturation"]'));
 }finally{await app.close();}
});

test('Phase 2 Face Reshape places control points, previews slider mesh deformation and commits with Undo/Redo',async()=>{
 const app=await boot();
 try{
  const {ui,facade:f}=app.w.Studio;
  await ui.switchTool('reshape');
  for(const id of ['face','chin','jawline','cheekbone','eyes','nose','lips','forehead','ratio']){
   assert.ok(app.w.document.querySelector(`[data-v2-reshape-preset="${id}"]`),`UI button for ${id}`);
  }
  app.w.document.querySelector('[data-v2-reshape-preset="jawline"]').click();
  await new Promise(r=>setTimeout(r,10));
  assert.ok(app.w.document.querySelector('[data-range="faceAmount"]'),'faceAmount slider shown');
  await ui.action('face-place');
  assert.equal(ui.router.placingFace,true);
  assert.equal(ui.router.faceHandles.length,2);
  ui.faceAmount=55;
  await ui.action('apply-face');
  assert.equal(ui.router.placingFace,false);
  assert.ok(f.basePhotoLayer().studio.warps.length>=2,'mesh warps committed to photo layer');
  await f.undo();
  assert.equal(f.basePhotoLayer().studio.warps.length,0,'undo removes face mesh warps');
  await f.redo();
  assert.ok(f.basePhotoLayer().studio.warps.length>=2,'redo restores face mesh warps');
 }finally{await app.close();}
});

test('Phase 3 Body Reshape exposes all 7 body modes, background pin lock, and anchor handle application with Undo/Redo',async()=>{
 const app=await boot();
 try{
  const {ui,facade:f}=app.w.Studio;
  await ui.switchTool('reshape');
  app.w.document.querySelector('[data-reshape-group="body"]').click();
  await new Promise(r=>setTimeout(r,10));
  for(const mode of ['waist','shoulder','arms','legs','stretch','height','curve']){
   assert.ok(app.w.document.querySelector(`[data-brush="${mode}"]`),`Body mode button ${mode} exists`);
  }
  assert.ok(app.w.document.querySelector('[data-action="body-pin"]'),'background pin button exists');
  await ui.action('body-pin');
  assert.equal(ui.router.placingPin,true);
  await f.addStroke({type:'freeze',points:[{x:80,y:300}],radius:35,hardness:.88,strength:1});
  assert.equal(f.basePhotoLayer().studio.freezes.length,1);
  app.w.document.querySelector('[data-brush="curve"]').click();
  await new Promise(r=>setTimeout(r,10));
  ui.router.bodyHandles=[{x:150,y:260},{x:170,y:380}];
  await ui.action('apply-body');
  assert.equal(f.basePhotoLayer().studio.warps.length,2);
  assert.equal(f.basePhotoLayer().studio.warps[0].freezeCount,1,'body warp honors background freeze pin');
  await f.undo();
  assert.equal(f.basePhotoLayer().studio.warps.length,0);
 }finally{await app.close();}
});

test('Phase 4 Makeup & Hair Studio creates dedicated eyeliner and hair layers, applies makeup presets, and grades hair highlights/shadows',async()=>{
 const app=await boot();
 try{
  const {ui,facade:f}=app.w.Studio;
  await ui.switchTool('makeup');
  for(const role of ['lips','blush','eyes','eyeliner','brows','highlight','hair']){
   assert.ok(app.w.document.querySelector(`[data-v2-makeup-role="${role}"]`),`Makeup role button ${role} exists`);
  }
  // Apply Douyin makeup preset
  await ui.applyMakeupPreset('douyin');
  const lipsLayer=f.activeMakeupLayer();
  assert.equal(lipsLayer.studio.makeup.role,'lips');
  assert.equal(lipsLayer.opacity,85);
  assert.equal(lipsLayer.composition,'multiply');
  // Create eyeliner layer
  await ui.selectMakeupRole('eyeliner');
  const eyelinerLayer=f.activeMakeupLayer();
  assert.equal(eyelinerLayer.studio.makeup.role,'eyeliner');
  assert.notEqual(eyelinerLayer.id,lipsLayer.id,'each makeup type has its own independent layer');
  // Switch to Hair Studio role, paint feathered hair mask, and adjust hair brightness/saturation/highlights/shadows
  await ui.selectMakeupRole('hair');
  const hairLayer=f.activeMakeupLayer();
  assert.equal(hairLayer.studio.makeup.role,'hair');
  assert.equal(ui.brush.feather,55,'hair brush defaults to soft feathered boundary');
  await f.addStroke({type:'makeup',points:[{x:200,y:150}],radius:45,strength:.6,hardness:.4,feather:.55,color:'#6e473b',blend:'soft-light'});
  await f.updateStudio({adjustments:{brightness:12,saturation:18,highlights:20,shadows:-10}},hairLayer);
  assert.equal(hairLayer.studio.adjustments.highlights,20);
  const project=await f.portableProject();
  assert.ok(project.layers.some(l=>l.studio?.makeup?.role==='eyeliner'));
  assert.ok(project.layers.some(l=>l.studio?.makeup?.role==='hair'));
 }finally{await app.close();}
});

test('Phase 5 Filter & Creative Studio applies CCD filter tab, .cube 3D LUTs, optical effects and social templates',async()=>{
 const app=await boot();
 try{
  const {ui,facade:f}=app.w.Studio;
  await ui.switchTool('filters');
  for(const g of ['ccd','film','vintage','korean','chinese','japanese','cinema','y2k','mono']){
   assert.ok(app.w.document.querySelector(`[data-v2-filter-group="${g}"]`),`Filter tab ${g} exists`);
  }
  app.w.document.querySelector('[data-v2-filter-group="ccd"]').click();
  await new Promise(r=>setTimeout(r,10));
  assert.ok(app.w.document.querySelectorAll('[data-preset]').length>=3,'CCD filter tab lists CCD presets');
  // Apply built-in .cube 3D LUT and commit
  const lutBtn=app.w.document.querySelector('[data-v2-cube-lut="kodak-2383"]');
  assert.ok(lutBtn,'Kodak 2383 .cube LUT button exists');
  lutBtn.click();
  await new Promise(r=>setTimeout(r,20));
  await ui.commitDraft();
  assert.equal(f.basePhotoLayer().studio.lut?.name,'Kodak 2383 .cube');
  // Adjust optical effects (bloom, glow, halation, lightLeak, chromatic, grain, vignette) in detail group
  await ui.switchTool('adjust');
  app.w.document.querySelector('[data-v2-adjust-group="detail"]').click();
  await new Promise(r=>setTimeout(r,10));
  for(const id of ['bloom','glow','halation','lightLeak','chromatic','grain','vignette']){
   assert.ok(app.w.document.querySelector(`[data-v2-adjust-key="${id}"]`),`Adjust button ${id} exists`);
  }
  // Creative Studio social media & poster templates create independent layers
  await ui.switchTool('templates');
  assert.ok(app.w.document.querySelector('[data-template="ig-story"]'),'Instagram Story template card exists');
  assert.ok(app.w.document.querySelector('[data-template="cinema-poster"]'),'Cinema Poster template card exists');
  const beforeLayers=f.config.layers.length;
  await f.template('ig-story');
  assert.ok(f.config.layers.length>beforeLayers,'Instagram Story template adds independent frame & typography layers');
 }finally{await app.close();}
});

test('Phase 6 Mobile UX provides 5 primary categories (AUTO, MẶT, DÁNG, MÀU, SÁNG TẠO), classical Auto Enhance, and sub-category switching',async()=>{
 const app=await boot();
 try{
  const {ui,facade:f}=app.w.Studio;
  for(const cat of ['auto','face','body','color','creative']){
   assert.ok(app.w.document.querySelector(`#mobile-nav [data-v3-category="${cat}"]`),`Mobile dock category ${cat} exists`);
  }
  // 1. AUTO category applies classical histogram auto-enhance and commits to undoable history
  await ui.switchCategory('auto');
  assert.equal(ui.tool,'auto');
  assert.equal(ui.activeCategory(),'auto');
  const ccdAutoBtn=app.w.document.querySelector('[data-v2-auto-preset="ccd"]');
  assert.ok(ccdAutoBtn,'CCD Auto preset button exists');
  ccdAutoBtn.click();
  await new Promise(r=>setTimeout(r,20));
  await ui.action('apply');
  assert.equal(f.basePhotoLayer().studio.preset,'ccd');
  await f.undo();
  assert.equal(f.basePhotoLayer().studio.preset,'original');
  // 2. MẶT category opens beauty and exposes sub-navigation for Làm đẹp, Khuôn mặt, Makeup & Tóc
  await ui.switchCategory('face');
  assert.equal(ui.activeCategory(),'face');
  assert.ok(app.w.document.querySelector('[data-v3-subtool="face-reshape"]'));
  assert.ok(app.w.document.querySelector('[data-v3-subtool="makeup"]'));
  // 3. DÁNG category opens Body Reshape directly
  await ui.switchCategory('body');
  assert.equal(ui.tool,'reshape');
  assert.equal(ui.reshapeMode,'body');
  assert.equal(ui.activeCategory(),'body');
  assert.ok(app.w.document.querySelector('[data-brush="waist"]'));
  // 4. MÀU category opens filters and exposes sub-navigation to HSL & Curve
  await ui.switchCategory('color');
  assert.equal(ui.activeCategory(),'color');
  assert.ok(app.w.document.querySelector('[data-v3-subtool="adjust"]'));
  // 5. SÁNG TẠO category opens text and exposes sub-navigation to Sticker, Ghép, Khung, Mẫu
  await ui.switchCategory('creative');
  assert.equal(ui.activeCategory(),'creative');
  for(const sub of ['text','stickers','collage','frames','templates']){
   assert.ok(app.w.document.querySelector(`[data-v3-subtool="${sub}"]`),`Creative sub-tool ${sub} exists`);
  }
 }finally{await app.close();}
});

test('V4 Immersive Beauty UI renders Pearl Editorial Home, connects all tools, syncs theme-color and switches creative utility subtools',async()=>{
 const app=await boot();
 try{
  const {ui,facade:f}=app.w.Studio;
  const doc=app.w.document;
  assert.equal(doc.body.classList.contains('immersive-v4'),true);
  await ui.showHome('studio');
  assert.equal(doc.querySelector('meta[name="theme-color"]')?.getAttribute('content'),'#fbf9f8');
  assert.ok(doc.querySelector('.v4-hero'),'V4 Editorial hero card exists on Home');
  for(const target of ['beauty','filters','makeup','body-reshape']){
   assert.ok(doc.querySelector(`[data-v4-launch="${target}"]`),`V4 Quick Access launch button ${target} exists`);
  }
  assert.ok(doc.querySelector('.v4-style-card'),'V4 Style Collection cards exist on Home');
  doc.querySelector('[data-v4-launch="body-reshape"]').click();
  for(let i=0;i<80&&ui.tool!=='reshape';i++)await new Promise(r=>setTimeout(r,25));
  await ui.navigation;
  assert.equal(ui.libraryVisible,false);
  assert.equal(ui.tool,'reshape');
  assert.equal(ui.reshapeMode,'body');
  assert.equal(doc.querySelector('meta[name="theme-color"]')?.getAttribute('content'),'#19191D');

  await ui.showHome('studio');
  doc.querySelector('[data-v2-sample-look="seoul"][data-v4-filter-group="korean"]').click();
  for(let i=0;i<240&&ui.tool!=='filters';i++)await new Promise(r=>setTimeout(r,25));
  await ui.navigation;
  assert.equal(ui.tool,'filters');
  assert.equal(ui.filterGroup,'korean');
  assert.equal(f.basePhotoLayer().studio.preset,'seoul');

  await ui.switchCategory('creative');
  for(const sub of ['text','stickers','collage','frames','templates','geometry','layers','draw']){
   assert.ok(doc.querySelector(`[data-v3-subtool="${sub}"]`),`Creative/Utility sub-tool ${sub} exists in V4 subnav`);
  }
  await ui.showHome('studio');
  assert.equal(doc.querySelector('meta[name="theme-color"]')?.getAttribute('content'),'#fbf9f8');
 }finally{await app.close();}
});
