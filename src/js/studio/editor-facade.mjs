import {RasterService} from './raster-service.mjs';
import {ProjectRepository,blobDataURL,loadImage} from './project-repository.mjs';
import {ensureTextFonts} from './font-registry.mjs';
import {validateProject} from './project-schema.mjs';
import {clamp,collageSlots,coverTransform,DEFAULT_ADJUSTMENTS,layerPoint,warpSample,freezeCoverage,perspectiveSample} from './math.mjs';
import glfx from '../libs/glfx.js';
import ImageFilters from '../libs/imagefilters.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const name=value=>String(value||'Ảnh của tôi').replace(/[<>]/g,'').trim().slice(0,120)||'Ảnh của tôi';
const layerKeys=['id','parent_id','name','type','x','y','width','height','width_original','height_original','visible','is_vector','hide_selection_if_active','opacity','order','composition','rotate','data','params','color','status','filters','render_function','studio'];
export class StudioFacade{
 constructor(app){
  this.app=app;this.config=app.Config;this.sources=new Map();this.repository=new ProjectRepository();
  this.raster=new RasterService({fx:glfx,filters:ImageFilters});this.listeners=new Set();this.renderTokens=new Map();this.cache=new Map();this.renderControllers=new Map();
  this.id=crypto.randomUUID();this.name='Chân dung của tôi';this.revision=0;this.epoch=0;this.saved=false;this.busy=false;this.queue=Promise.resolve();this.stateQueue=Promise.resolve();this.compare=false;
  const notify=()=>{this.revision++;const selected=this.config.layer?.id;if(this.lastSelectedId!==selected){this.lastSelectedId=selected;this.emit('selection');}this.emit('change');this.renderPreview().catch(error=>this.emit('render-error',error));clearTimeout(this.saveTimer);this.saveTimer=setTimeout(()=>this.save().catch(error=>this.emit('save-error',error)),1000);};
  for(const method of ['do_action','undo_action','redo_action']){
   const original=app.State[method].bind(app.State);
   app.State[method]=(...args)=>{const operation=this.stateQueue.then(async()=>{const result=await original(...args);if(result?.status!=='aborted')notify();return result;});this.stateQueue=operation.catch(()=>{});return operation;};
  }
  app.GUI.GUI_tools.tools_modules.studio={object:{render_overlay:ctx=>this.renderOverlay?.(ctx)}};
  const originalRender=app.Layers.render_object.bind(app.Layers);
  app.Layers.render_object=(ctx,layer,...args)=>{
   ctx.save();const frame=layer.studio?.frame;
   if(frame){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(frame.x,frame.y,frame.width,frame.height,frame.radius||0);else ctx.rect(frame.x,frame.y,frame.width,frame.height);ctx.clip();}
   originalRender(ctx,layer,...args);ctx.restore();
  };
 }
 assertDocument(epoch){if(epoch!==this.epoch||this.loadingDocument)throw new Error('Dự án đã thay đổi. Hãy chọn lại công cụ.');}
 discardSource(record){if(record){URL.revokeObjectURL(record.url);this.sources.delete(record.id);}}
 subscribe(listener){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 emit(type,value){for(const fn of this.listeners)fn(type,value);}
 perform(action){const next=this.queue.then(async()=>{const result=await this.app.State.do_action(action);if(result?.status==='aborted')throw result.reason instanceof Error?result.reason:new Error(String(result.reason));return result;});this.queue=next.catch(()=>{});return next;}
 async clearHistory(){for(const action of this.app.State.action_history)try{await action.free();}catch{}this.app.State.action_history=[];this.app.State.action_history_index=0;}
 async source(blob,label='Ảnh'){
  if(blob.size>100*1024*1024)throw new Error('Ảnh quá lớn. Vui lòng chọn file nhỏ hơn 100 MB.');
  const bytes=new Uint8Array(await blob.slice(0,64).arrayBuffer()),ascii=(from,to)=>String.fromCharCode(...bytes.slice(from,to));
  const mime=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'?'image/png':ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'?'image/webp':ascii(4,8)==='ftyp'&&/heic|heix|hevc|hevx|mif1/.test(ascii(8,64))?'image/heic':null;
  if(!mime||mime==='image/webp'&&ascii(12,16)==='VP8X'&&(bytes[20]&2))throw new Error('Định dạng ảnh chưa được hỗ trợ. Hãy chọn ảnh tĩnh JPEG, PNG, WebP hoặc HEIC.');
  if(blob.type!==mime)blob=new Blob([blob],{type:mime});
  const url=URL.createObjectURL(blob);let image;
  try{image=await loadImage(url);}catch(error){URL.revokeObjectURL(url);throw error;}
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  if(width*height>64000000||width>20000||height>20000||width<1||height<1){URL.revokeObjectURL(url);throw new Error('Ảnh cần có tối đa 64 triệu điểm ảnh và cạnh không quá 20.000 px.');}
  const id=crypto.randomUUID(),record={id,blob,image,url,name:name(label),width,height};this.sources.set(id,record);return record;
 }
 async open(blob,label,{replace=true}={}){
  if(this.loadingDocument)throw new Error('Đang mở ảnh. Vui lòng đợi một chút.');this.loadingDocument=true;
  try{
  await this.queue;
  if(replace&&this.config.layers.some(l=>l.studio)&&!this.busy){clearTimeout(this.saveTimer);await this.save();}
  const asset=await this.source(blob,label);
  if(replace){
   this.epoch++;this.id=crypto.randomUUID();this.name=name(label?.replace(/\.[^.]+$/,''));
   await this.clearHistory();await new this.app.Actions.Reset_layers_action(false).do();
   this.config.WIDTH=asset.width;this.config.HEIGHT=asset.height;this.config.guides=[];this.config.need_render=true;
   await new this.app.Actions.Insert_layer_action(this.imageLayer(asset)).do();await this.clearHistory();
   this.releaseSources(new Set([asset.id]));
  }else{
   const scale=Math.min(this.config.WIDTH/asset.width,this.config.HEIGHT/asset.height)*.7;
   await this.perform(new this.app.Actions.Insert_layer_action({...this.imageLayer(asset),x:(this.config.WIDTH-asset.width*scale)/2,y:(this.config.HEIGHT-asset.height*scale)/2,width:asset.width*scale,height:asset.height*scale},false));
  }
  this.saved=false;await this.fit();this.emit('change');await this.renderPreview();await this.save().catch(error=>this.emit('save-error',error));
  }finally{this.loadingDocument=false;}
 }
 releaseSources(keep){for(const controller of this.renderControllers.values())controller.abort();this.renderControllers.clear();for(const [id,record] of this.sources)if(!keep.has(id)){URL.revokeObjectURL(record.url);this.sources.delete(id);}this.cache.clear();this.renderTokens.clear();}
 imageLayer(asset){return {name:asset.name,type:'image',data:asset.image,x:0,y:0,width:asset.width,height:asset.height,width_original:asset.width,height_original:asset.height,studio:{sourceId:asset.id,adjustments:{},preset:'original',intensity:100,strokes:[],warps:[],freezes:[]}};}
 async openDemo(file='portrait'){
  const response=await fetch(`./assets/photos/${file}.jpg`);if(!response.ok)throw new Error('Không thể mở ảnh mẫu.');
  await this.open(await response.blob(),file==='portrait'?'Chân dung của tôi':file==='sunlight'?'Một ngày nắng':'Khoảnh khắc dịu dàng');
 }
 photoLayer(){return this.config.layer?.type==='image'&&!this.config.layer.studio?.sticker?this.config.layer:[...this.config.layers].reverse().find(l=>l.type==='image'&&!l.studio?.sticker)||null;}
 async selectPhoto(){const layer=this.photoLayer();if(layer&&layer!==this.config.layer)await this.select(layer.id);return layer;}
 async select(id){await new this.app.Actions.Select_layer_action(Number(id)).do();this.emit('selection');}
 async updateStudio(changes,layer=this.photoLayer()){
  if(!layer)throw new Error('Hãy mở hoặc chọn một lớp ảnh trước.');
  const studio={...clone(layer.studio||{}),...clone(changes)};
  await this.perform(new this.app.Actions.Update_layer_action(layer.id,{studio}));await this.renderPreview();
 }
 async undo(){await this.queue;await this.app.State.undo_action();await this.renderPreview();this.emit('selection');}
 async redo(){await this.queue;await this.app.State.redo_action();await this.renderPreview();this.emit('selection');}
 async renderLayer(layer,studio=layer.studio,{edge=1600,force=false}={}){
  const record=this.sources.get(studio?.sourceId);if(!record)return;
  const key=JSON.stringify([studio,edge]);if(!force&&this.cache.get(layer.id)===key){this.renderControllers.get(layer.id)?.abort();this.renderControllers.delete(layer.id);this.renderTokens.set(layer.id,Symbol());return;}
  const token=Symbol(),epoch=this.epoch;this.renderTokens.set(layer.id,token);this.renderControllers.get(layer.id)?.abort();const controller=new AbortController();this.renderControllers.set(layer.id,controller);
  let output;try{output=await this.raster.render(record.image,studio,{edge,signal:controller.signal,key:epoch+':'+layer.id});}catch(error){if(error.name==='AbortError')return;throw error;}finally{if(this.renderControllers.get(layer.id)===controller)this.renderControllers.delete(layer.id);}
  if(this.renderTokens.get(layer.id)!==token||epoch!==this.epoch||!this.config.layers.includes(layer)){output.width=1;return;}
  layer.link_canvas=this.compare?record.image:output;this.cache.set(layer.id,key);this.config.need_render=true;
 }
 async renderPreview(){const layers=this.config.layers.filter(l=>l.type==='image'&&l.studio);let index=0;const run=async()=>{while(index<layers.length){const l=layers[index++];await this.renderLayer(l,l.studio,{edge:l.studio.warps?.length?1280:1600});}};await Promise.all([run(),run()]);}
 async preview(changes){const layer=this.photoLayer();if(layer)await this.renderLayer(layer,{...clone(layer.studio),...clone(changes)},{force:true,edge:1280});}
 async setCompare(active){this.compare=active;for(const l of this.config.layers){if(l.type==='image'&&l.studio&&!l.studio.sticker){if(active)l.link_canvas=this.sources.get(l.studio.sourceId)?.image;else this.cache.delete(l.id);}}if(!active)await this.renderPreview();this.config.need_render=true;this.emit('compare',active);}
 async fit(){const c=document.getElementById('main_wrapper');const zoom=Math.min((c.clientWidth-64)/this.config.WIDTH,(c.clientHeight-64)/this.config.HEIGHT,1);await this.app.GUI.GUI_preview.zoom(Math.max(.03,zoom)*100);this.app.GUI.check_canvas_offset();this.emit('viewport');}
 async zoom(factor){await this.app.GUI.GUI_preview.zoom(clamp(this.config.ZOOM*factor,.03,8)*100);this.emit('viewport');}
 activate(tool){
  if(['select','crop','text','selection','pick_color'].includes(tool))return new this.app.Actions.Activate_tool_action(tool,true).do();
  else{this.app.GUI.GUI_tools.active_tool='studio';this.config.TOOL={name:'studio',attributes:{}};this.config.need_render=true;}
 }
 screenPoint(event){const canvas=document.getElementById('canvas_minipaint'),r=canvas.getBoundingClientRect();return this.app.Layers.studioScreenToWorld?this.app.Layers.studioScreenToWorld({x:event.clientX-r.left,y:event.clientY-r.top}):{x:(event.clientX-r.left)/this.config.ZOOM,y:(event.clientY-r.top)/this.config.ZOOM};}
 sourcePoint(event,{warp=true}={}){
  const layer=this.photoLayer();if(!layer)return null;let p=layerPoint(this.screenPoint(event),layer);
  if(layer.studio.flipX)p.x=layer.width_original-p.x;if(layer.studio.flipY)p.y=layer.height_original-p.y;
  if(layer.studio.perspectiveX||layer.studio.perspectiveY)p=perspectiveSample(p,layer.width_original,layer.height_original,layer.studio.perspectiveX,layer.studio.perspectiveY);
  if(warp&&layer.studio.warps?.length)p=warpSample(p,layer.studio.warps,(point,s)=>freezeCoverage(point,layer.studio.freezes||[],s.freezeCount));
  return p;
 }
 async addStroke(stroke){const layer=this.photoLayer();if(!layer)return;const key=stroke.type==='freeze'?'freezes':'strokes';await this.updateStudio({[key]:[...(layer.studio[key]||[]),clone(stroke)]},layer);}
 async addWarp(strokes){const layer=this.photoLayer();if(layer)await this.updateStudio({warps:[...(layer.studio.warps||[]),...clone(strokes).map(s=>({...s,freezeCount:s.freezeCount??layer.studio.freezes?.length??0}))]},layer);}
 async addText(text='Đẹp theo cách riêng',options={}){
  const epoch=this.epoch;const size=Math.round(this.config.WIDTH*.075),data=String(text).normalize('NFC').split('\n').map(line=>[{text:line,meta:{family:'Manrope',size,fill_color:'#ffffff',kerning:0,leading:10,...options.meta}}]);
  await ensureTextFonts([{type:'text',data}]);this.assertDocument(epoch);
  await this.perform(new this.app.Actions.Insert_layer_action({name:name(text),type:'text',data,params:{boundary:'box',kerning:'metrics',text_direction:'ltr',wrap_direction:'ttb',halign:'center',valign:'top',wrap:'word'},render_function:['studio_text','render'],x:this.config.WIDTH*.08,y:this.config.HEIGHT*.76,width:this.config.WIDTH*.84,height:size*2.5,is_vector:true,studio:{typography:{arc:0,...options.typography}}},false));
  await this.activate('select');this.emit('selection');
 }
 async updateText(options,layerId=this.config.layer?.id){
  const layer=this.config.layers.find(l=>l.id===layerId);if(layer?.type!=='text')return;
  const data=clone(layer.data||[[{text:'',meta:{}}]]);
  if(options.text!==undefined){const meta=data[0]?.[0]?.meta||{};data.splice(0,data.length,...String(options.text).normalize('NFC').split('\n').map(text=>[{text,meta:{...meta,...options.meta}}]));}
  else if(options.meta)for(const line of data)for(const span of line)Object.assign(span.meta,options.meta);
  await this.perform(new this.app.Actions.Update_layer_action(layer.id,{data,...(options.params?{params:{...layer.params,...options.params}}:{}),...(options.typography?{studio:{...layer.studio,typography:{...layer.studio?.typography,...options.typography}}}:{})}));
 }
 async addSticker(id){
  const epoch=this.epoch;const response=await fetch(`./assets/stickers/${id}.png`);if(!response.ok)throw new Error('Không thể đọc nhãn dán.');
  this.assertDocument(epoch);const asset=await this.source(await response.blob(),'Nhãn dán');try{this.assertDocument(epoch);}catch(error){this.discardSource(asset);throw error;}const size=this.config.WIDTH*.25;
  await this.perform(new this.app.Actions.Insert_layer_action({...this.imageLayer(asset),name:'Nhãn dán',x:this.config.WIDTH*.64,y:this.config.HEIGHT*.12,width:size,height:size*asset.height/asset.width,studio:{...this.imageLayer(asset).studio,sticker:true}},false));this.activate('select');
 }
 async replacePhoto(blob,label){
  const epoch=this.epoch;const layer=this.config.layer;if(!layer?.studio?.frame)throw new Error('Chọn lớp ảnh trong khung trước.');
  const asset=await this.source(blob,label);try{this.assertDocument(epoch);if(!this.config.layers.includes(layer))throw new Error('Lớp ảnh đã thay đổi.');}catch(error){this.discardSource(asset);throw error;}const frame=clone(layer.studio.frame);
  await this.perform(new this.app.Actions.Update_layer_action(layer.id,{...coverTransform(asset.width,asset.height,frame),width_original:asset.width,height_original:asset.height,name:name(label),link:asset.image,studio:{...this.imageLayer(asset).studio,frame}}));await this.renderPreview();
 }
 async updateLayer(changes){if(this.config.layer)await this.perform(new this.app.Actions.Update_layer_action(this.config.layer.id,changes));}
 async deleteLayer(){if(this.config.layers.length<=1)throw new Error('Giữ ít nhất một lớp trong dự án.');await this.perform(new this.app.Actions.Delete_layer_action(this.config.layer.id,true));this.emit('selection');}
 async reorder(direction){await this.perform(new this.app.Actions.Reorder_layer_action(this.config.layer.id,direction));this.emit('selection');}
 async duplicate(){const l=this.config.layer;if(!l)return;const data={};for(const k of layerKeys)if(l[k]!==undefined&&k!=='id'&&k!=='order')data[k]=k==='data'&&l.type==='image'?null:clone(l[k]);if(l.type==='image')data.data=this.sources.get(l.studio.sourceId).image;data.x+=24;data.y+=24;data.name+=' bản sao';await this.perform(new this.app.Actions.Insert_layer_action(data,false));}
 async merge(){
  const epoch=this.epoch;const current=this.config.layer,sorted=this.app.Layers.get_sorted_layers(),below=sorted[sorted.findIndex(l=>l.id===current?.id)+1];
  if(!below)throw new Error('Chọn lớp có một lớp khác ở bên dưới để gộp.');
  if([current,below].some(l=>l.composition&&l.composition!=='source-over'))throw new Error('Hãy đặt hòa trộn của cả hai lớp về Bình thường trước khi gộp. Các lớp đang được giữ nguyên.');
  const blob=await this.exportImage({format:'png',layers:[current,below]});this.assertDocument(epoch);const asset=await this.source(blob,current.name+' + '+below.name),A=this.app.Actions;try{this.assertDocument(epoch);}catch(error){this.discardSource(asset);throw error;}
  await this.perform(new A.Bundle_action('merge_layers','Gộp hai lớp',[
   new A.Delete_layer_action(current.id,true),new A.Delete_layer_action(below.id,true),new A.Insert_layer_action({...this.imageLayer(asset),order:current.order},false)
  ]));await this.renderPreview();this.emit('selection');
 }
 async crop(selection){
  const x=clamp(Math.round(selection.x),0,this.config.WIDTH-1),y=clamp(Math.round(selection.y),0,this.config.HEIGHT-1),width=clamp(Math.round(selection.width),1,this.config.WIDTH-x),height=clamp(Math.round(selection.height),1,this.config.HEIGHT-y);
  const A=this.app.Actions,actions=[new A.Prepare_canvas_action('undo'),new A.Update_config_action({WIDTH:width,HEIGHT:height})];
  for(const l of this.config.layers){const changes={x:l.x-x,y:l.y-y};if(l.studio?.frame)changes.studio={...clone(l.studio),frame:{...l.studio.frame,x:l.studio.frame.x-x,y:l.studio.frame.y-y}};actions.push(new A.Update_layer_action(l.id,changes));}
  actions.push(new A.Prepare_canvas_action('do'));await this.perform(new A.Bundle_action('studio_crop','Cắt ảnh',actions));this.activate('select');await this.fit();
 }
 async resize(width,height){
  width=Math.round(width);height=Math.round(height);if(width<1||height<1||width*height>64000000)throw new Error('Kích thước ảnh không hợp lệ.');
  const sx=width/this.config.WIDTH,sy=height/this.config.HEIGHT,A=this.app.Actions,actions=[new A.Prepare_canvas_action('undo'),new A.Update_config_action({WIDTH:width,HEIGHT:height})];
  for(const l of this.config.layers){const changes={x:l.x*sx,y:l.y*sy,width:l.width*sx,height:l.height*sy};if(l.type==='text'){changes.data=clone(l.data);for(const line of changes.data)for(const span of line)span.meta.size=(span.meta.size||40)*sx;}
   if(l.studio?.frame){const f=l.studio.frame;changes.studio={...clone(l.studio),frame:{x:f.x*sx,y:f.y*sy,width:f.width*sx,height:f.height*sy,radius:(f.radius||0)*sx}};}
   actions.push(new A.Update_layer_action(l.id,changes));}
  actions.push(new A.Prepare_canvas_action('do'));await this.perform(new A.Bundle_action('studio_resize','Đổi kích thước',actions));await this.fit();
 }
 async rotate(){await this.rotateTo(((this.photoLayer()?.rotate||0)+90)%360);}
 async rotateTo(value){if(!Number.isFinite(value))throw new Error('Góc xoay không hợp lệ.');await this.selectPhoto();const layer=this.config.layer,module=this.app.GUI.modules['image/rotate'],angle=((value%360)+360)%360,A=this.app.Actions;await this.perform(new A.Bundle_action('rotate_layer','Xoay ảnh',[new A.Update_layer_action(layer.id,{rotate:angle}),...module.check_sizes(angle)]));await this.fit();}
 async flip(axis){const layer=this.photoLayer();if(layer)await this.updateStudio({[axis==='x'?'flipX':'flipY']:!layer.studio[axis==='x'?'flipX':'flipY']},layer);}
 async collage(layout='duo',gap=24){
  const photos=this.config.layers.filter(l=>l.type==='image'&&!l.studio?.sticker),base=this.photoLayer();if(!base)return;
  const A=this.app.Actions,width=layout==='long'?1200:1600,height=layout==='long'?3600:layout==='magazine'||layout==='stack'?2000:1200,slots=collageSlots(width,height,layout,gap),actions=[new A.Prepare_canvas_action('undo'),new A.Reset_layers_action(false),new A.Update_config_action({WIDTH:width,HEIGHT:height}),new A.Insert_layer_action({type:'rectangle',name:'Nền ghép ảnh',x:0,y:0,width,height,is_vector:true,render_function:['rectangle','render'],params:{fill:true,border:false,fill_color:'#faf7f2',border_color:'#faf7f2',border_size:0,radius:0}},false)];
  for(let i=0;i<slots.length;i++){const original=photos[i%photos.length],asset=this.sources.get(original.studio.sourceId),slot=slots[i];actions.push(new A.Insert_layer_action({...this.imageLayer(asset),...coverTransform(asset.width,asset.height,slot),studio:{...clone(original.studio),frame:{...slot,radius:12}}},false));}
  actions.push(new A.Prepare_canvas_action('do'));await this.perform(new A.Bundle_action('studio_collage','Ghép ảnh',actions));await this.fit();
 }
 async template(id){
  const epoch=this.epoch,guard=async operation=>{const value=await operation;this.assertDocument(epoch);return value;};this.assertDocument(epoch);
  if(id==='long'){await guard(this.collage('long',24));return;}
  if(id==='magazine'){await guard(this.collage('magazine',32));await guard(this.addText('DAYDREAM',{meta:{family:'Playfair Display',size:150,fill_color:'#ffffff',kerning:6}}));await guard(this.updateLayer({x:100,y:110,width:1400,height:220}));await guard(this.fit());return;}
  if(id==='poster'){await guard(this.framePhoto('charcoal',8));await guard(this.addText('YOUR OWN\nKIND OF BEAUTIFUL',{meta:{family:'Manrope',bold:true,size:Math.round(this.config.WIDTH*.085),fill_color:'#ffffff'},typography:{shadow:8}}));await guard(this.fit());return;}
  if(id==='diptych'){await guard(this.collage('duo',35));return;}
  if(id==='editorial'){await guard(this.updateStudio({preset:'film',intensity:65}));await guard(this.addText('THE BEAUTY\nOF BEING YOU',{meta:{family:'Playfair Display',size:this.config.WIDTH*.09,fill_color:'#ffffff',leading:16}}));}
  else if(id==='polaroid'){
   const w=this.config.WIDTH,h=this.config.HEIGHT,layer=this.photoLayer(),A=this.app.Actions;
   if(!layer)return;
   const bottom=Math.min(...this.config.layers.map(l=>l.order))-1;
   await guard(this.perform(new A.Bundle_action('studio_paper','Khung kỷ niệm',[
    new A.Prepare_canvas_action('undo'),new A.Update_config_action({WIDTH:w+100,HEIGHT:h+200}),
    new A.Insert_layer_action({type:'rectangle',name:'Nền giấy',order:bottom,x:0,y:0,width:w+100,height:h+200,is_vector:true,render_function:['rectangle','render'],params:{fill:true,border:false,fill_color:'#fffdf9',border_color:'#fffdf9',border_size:0,radius:0}},false),
    new A.Update_layer_action(layer.id,{x:50,y:50,width:w,height:h}),new A.Prepare_canvas_action('do')
   ])));
   await guard(this.addText('a little moment',{meta:{family:'Playfair Display',size:Math.round(w*.06),fill_color:'#383131'}}));await guard(this.updateLayer({y:h+70,height:80}));await guard(this.fit());
  }
  else if(id==='minimal'){await guard(this.updateStudio({preset:'morning',intensity:65}));await guard(this.addText('less, but lovely.',{meta:{family:'Manrope',size:Math.round(this.config.WIDTH*.06),fill_color:'#fff9ef'}}));}
  this.emit('selection');
 }
 snapshot(){
  const layers=this.config.layers.filter(l=>l.type).map(l=>{const value={};for(const k of layerKeys)if(l[k]!==undefined&&k!=='data')value[k]=clone(l[k]);if(l.type!=='image')value.data=clone(l.data);value.filters=[];return value;});
  return {format:'photo-beauty-studio',version:1,id:this.id,name:this.name,width:this.config.WIDTH,height:this.config.HEIGHT,layers};
 }
 assetsFor(project){const assets={};for(const l of project.layers){const id=l.studio?.sourceId;if(id&&this.sources.has(id))assets[id]=this.sources.get(id).blob;}return assets;}
 async save(){if(!this.config.layers.some(l=>l.type))return;const revision=this.revision,project=this.snapshot();this.emit('saving');await this.repository.save(project,this.assetsFor(project));if(revision===this.revision){this.saved=true;this.emit('saved');}}
 async portableProject(){const project=this.snapshot();project.assets={};for(const [id,blob] of Object.entries(this.assetsFor(project)))project.assets[id]=await blobDataURL(blob);return validateProject(project);}
 async restore(project){
  validateProject(project,{allowBlobs:true});if(this.loadingDocument)throw new Error('Đang mở dự án. Vui lòng đợi một chút.');this.loadingDocument=true;
  const sources=[];let previous=null,swapped=false;
  try{
   await this.queue;await this.stateQueue;
   if(this.config.layers.some(l=>l.studio)){clearTimeout(this.saveTimer);await this.save();}
   for(const [id,asset] of Object.entries(project.assets)){const blob=typeof asset==='string'?await(await fetch(asset)).blob():asset;const record=await this.source(blob,'Ảnh');sources.push([id,record]);}
   const map=new Map(sources);previous={layers:this.config.layers.slice(),layer:this.config.layer,width:this.config.WIDTH,height:this.config.HEIGHT,guides:this.config.guides,auto:this.app.Layers.auto_increment};
   this.epoch++;swapped=true;await new this.app.Actions.Reset_layers_action(false).do();this.config.WIDTH=project.width;this.config.HEIGHT=project.height;this.config.guides=[];
   for(const raw of project.layers){const l=clone(raw);if(l.type==='image'){const record=map.get(l.studio.sourceId);l.studio.sourceId=record.id;l.data=record.image;}await new this.app.Actions.Insert_layer_action(l,false).do();}
   await this.fit();await this.renderPreview();
  }catch(error){
   if(swapped&&previous){Object.assign(this.config,{layers:previous.layers,layer:previous.layer,WIDTH:previous.width,HEIGHT:previous.height,guides:previous.guides,need_render:true});this.app.Layers.auto_increment=previous.auto;this.epoch++;this.cache.clear();this.app.GUI.GUI_layers.render_layers();await this.fit();await this.renderPreview();}
   for(const [,record] of sources){URL.revokeObjectURL(record.url);this.sources.delete(record.id);}throw error;
  }finally{this.loadingDocument=false;}
  this.id=project.id||crypto.randomUUID();this.name=name(project.name);await this.clearHistory();this.releaseSources(new Set(sources.map(([,r])=>r.id)));await this.renderPreview();this.emit('change');this.emit('selection');await this.save().catch(error=>this.emit('save-error',error));
 }
 async exportImage({format='jpeg',quality=.95,scale=1,layers:inputLayers,documentSnapshot}={}){
  if(!documentSnapshot){await this.queue;await(document.fonts?.ready||Promise.resolve());}
  const width=Math.round((documentSnapshot?.width??this.config.WIDTH)*scale),height=Math.round((documentSnapshot?.height??this.config.HEIGHT)*scale);
  if(!['jpeg','png','webp'].includes(format)||!Number.isFinite(scale)||scale<=0||width<1||height<1)throw new Error('Thiết lập xuất ảnh không hợp lệ.');
  if(width*height>12500000)throw new Error('Bản này xuất tối đa 12 MP. Hãy chọn kích thước nhỏ hơn trong phần xuất ảnh.');
  const layers=(inputLayers||this.config.layers).map(layer=>({...layer,params:clone(layer.params),studio:clone(layer.studio),data:layer.type==='image'?null:clone(layer.data)})).sort((a,b)=>b.order-a.order);
  const records=documentSnapshot?.sources||new Map(this.sources),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
  if(format==='jpeg'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);}ctx.scale(scale,scale);
  const renderedSurfaces=[];
  try{
   for(const layer of layers){if(layer.type!=='image'||!layer.studio)continue;const record=records.get(layer.studio.sourceId);if(record){layer.link_canvas=await this.raster.render(record.image,layer.studio,{edge:Math.ceil(Math.max(layer.width,layer.height)*scale)});renderedSurfaces.push(layer.link_canvas);}}
   const temp=document.createElement('canvas'),requiresClip=layers.some(l=>l.composition==='source-atop');temp.width=requiresClip?width:1;temp.height=requiresClip?height:1;if(requiresClip)temp.getContext('2d').scale(scale,scale);
   this.app.Layers.render_objects(ctx,temp,layers);
   const blob=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('Không thể xuất ảnh. Hãy chọn kích thước nhỏ hơn.')),`image/${format}`,quality));
   if(blob.type!==`image/${format}`)throw new Error('Trình duyệt chưa xuất được định dạng này. Hãy chọn PNG hoặc JPEG.');return blob;
  }finally{canvas.width=1;for(const surface of renderedSurfaces)surface.width=1;}
 }
}
