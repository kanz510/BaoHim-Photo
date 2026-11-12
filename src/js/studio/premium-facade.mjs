import {StudioFacade} from './editor-facade.mjs';
import {fitWithin,layerPoint,warpSample,freezeCoverage,perspectiveSample} from './math.mjs';
import {validateLook} from './look-catalog.mjs';
import {PremiumRaster} from './premium-raster.mjs';
import {ensureTextFonts} from './font-registry.mjs';
import {PixelWorkerClient} from './pixel-worker-client.mjs';
import {HistoryRepository} from './history-repository.mjs';
import {DocumentSession} from './document-session.mjs';
const copy=value=>JSON.parse(JSON.stringify(value));
const makeupRoles={lips:['Môi','multiply'],blush:['Má hồng','soft-light'],eyes:['Mắt','multiply'],brows:['Chân mày','multiply'],highlight:['Bắt sáng','soft-light']};
const geometries=['x','y','width','height','rotate'];

export class PremiumFacade extends StudioFacade{
 constructor(app){
  super(app);this.workLayerId=null;this.historyJumping=false;this.raster=new PremiumRaster({fx:this.raster.fx,filters:this.raster.filters});
  this.raster.worker=new PixelWorkerClient();
  this.documentSession=new DocumentSession(status=>this.emit('document',status));
  this.checkpoints=new HistoryRepository();this.checkpointQueue=Promise.resolve();
  const saveProject=this.repository.save.bind(this.repository);this.repository.save=async(project,assets)=>{const result=await saveProject(project,assets);this.checkpointQueue=this.checkpointQueue.then(()=>this.checkpoints.save(project,assets)).then(()=>this.emit('checkpoint-saved')).catch(error=>this.emit('checkpoint-error',error));return result;};
  for(const key of ['open','restore']){const run=this[key].bind(this);this[key]=async(...args)=>{const token=this.documentSession.begin(key==='open'?'Đang mở ảnh của bạn…':'Đang mở dự án…');try{if(key==='restore')await ensureTextFonts(args[0]?.layers);const value=await run(...args);this.documentSession.finish(token);return value;}catch(error){this.documentSession.finish(token,error);throw error;}};}
  const nativeRender=app.Layers.render_object.bind(app.Layers);
  app.Layers.render_object=(ctx,layer,...args)=>{
   if(layer._exportSnapshot){nativeRender(ctx,layer,...args);return;}
   if(this.compare&&(layer.studio?.sticker||layer.type==='text'||layer.studio?.canvasFrame))return;
   const effective=this.displayLayer(layer);if(effective)nativeRender(ctx,effective,...args);
  };
 }
 basePhotoLayer(){return this.config.layer?.studio?.makeup?this.parentPhoto(this.config.layer)||super.photoLayer():super.photoLayer();}
 async select(id){if(this.config.layer?.id===Number(id))return;return super.select(id);}
 perform(action){
  // Extend the existing collage command instead of creating a second history.
  if(action.action_id==='studio_collage'){
   const originalPhotos=this.config.layers.filter(l=>l.type==='image'&&!l.studio?.sticker),children=this.config.layers.filter(l=>l.studio?.makeup),expanded=[];
   let photoIndex=0;
   for(const item of action.actions_to_do){expanded.push(item);const settings=item.settings;if(item.action_id!=='insert_layer'||settings?.type!=='image'||settings.studio?.sticker)continue;
    const parent=originalPhotos[photoIndex++%originalPhotos.length];
    for(const child of children.filter(l=>l.studio.makeup.targetId===parent?.id)){
     const source=this.sources.get(child.studio.sourceId),layer={...this.imageLayer(source),name:child.name,studio:copy(child.studio),composition:child.composition,opacity:child.opacity,visible:child.visible};for(const key of geometries)layer[key]=settings[key]??0;
     const linked=new this.app.Actions.Insert_layer_action(layer,false),nativeDo=linked.do.bind(linked);linked.do=async()=>{linked.settings.studio.makeup.targetId=item.inserted_layer_id;await nativeDo();};expanded.push(linked);
    }
   }
   action.actions_to_do=expanded;
  }
  if(['studio_resize','studio_crop'].includes(action.action_id)){
   const frame=this.config.layers.find(l=>l.studio?.canvasFrame),configAction=action.actions_to_do.find(a=>a.action_id==='update_config');
   if(frame&&configAction){const old=frame.studio.canvasFrame.padding,W=this.config.WIDTH,H=this.config.HEIGHT,settings=configAction.settings;let padding;
    if(action.action_id==='studio_resize'){const sx=settings.WIDTH/W,sy=settings.HEIGHT/H;padding={left:old.left*sx,right:old.right*sx,top:old.top*sy,bottom:old.bottom*sy};}
    else{const update=action.actions_to_do.find(a=>a.action_id==='update_layer'&&a.layer_id===frame.id),x=frame.x-update.settings.x,y=frame.y-update.settings.y;padding={left:Math.max(0,Math.min(settings.WIDTH,old.left-x)),right:Math.max(0,Math.min(settings.WIDTH,x+settings.WIDTH-W+old.right)),top:Math.max(0,Math.min(settings.HEIGHT,old.top-y)),bottom:Math.max(0,Math.min(settings.HEIGHT,y+settings.HEIGHT-H+old.bottom))};}
    action.actions_to_do.splice(-1,0,new this.app.Actions.Update_layer_action(frame.id,{studio:{...copy(frame.studio),canvasFrame:{...copy(frame.studio.canvasFrame),padding}}}));
   }
  }
  return super.perform(action);
 }
 activeMakeupLayer(){const layer=this.config.layers.find(l=>l.id===this.workLayerId);return layer?.studio?.makeup&&layer.id===this.config.layer?.id?layer:null;}
 photoLayer(){return this.activeMakeupLayer()||this.basePhotoLayer();}
 parentPhoto(layer){return this.config.layers.find(l=>l.id===layer.studio?.makeup?.targetId&&l.type==='image'&&!l.studio?.makeup)||null;}
 displayLayer(layer,parentOverride){
  if(!layer.studio?.makeup)return layer;const parent=parentOverride||this.parentPhoto(layer);if(!parent)return null;
  const effective={...layer,studio:{...layer.studio}};for(const key of geometries)effective[key]=parent[key];effective.studio.frame=parent.studio?.frame;return effective;
 }
 renderRecipe(layer,studio=layer.studio,parentOverride){
  if(!studio?.makeup)return studio;const parent=parentOverride||this.parentPhoto(layer);if(!parent)return studio;
  const sx=layer.width_original/parent.width_original,sy=layer.height_original/parent.height_original,r=Math.sqrt(sx*sy),p=parent.studio;
  const scalePoint=v=>({x:v.x*sx,y:v.y*sy});
  return {...studio,frame:p.frame,warps:(p.warps||[]).map(s=>({...s,from:scalePoint(s.from),to:scalePoint(s.to),radius:s.radius*r})),freezes:(p.freezes||[]).map(s=>({...s,...(s.radius?{radius:s.radius*r}:{}),points:(s.points||[]).map(scalePoint)})),flipX:!!p.flipX,flipY:!!p.flipY,perspectiveX:p.perspectiveX||0,perspectiveY:p.perspectiveY||0};
 }
 async renderLayer(layer,studio=layer.studio,options={}){return super.renderLayer(layer,this.renderRecipe(layer,studio),options);}
 async renderPreview(){if(this.historyJumping)return;return super.renderPreview();}
 sourcePoint(event,{warp=true}={}){
  const target=this.photoLayer();if(!target?.studio?.makeup)return super.sourcePoint(event,{warp});const layer=this.displayLayer(target);if(!layer)return null;
  const studio=this.renderRecipe(target);let p=layerPoint(this.screenPoint(event),layer);
  if(studio.flipX)p.x=layer.width_original-p.x;if(studio.flipY)p.y=layer.height_original-p.y;
  if(studio.perspectiveX||studio.perspectiveY)p=perspectiveSample(p,layer.width_original,layer.height_original,studio.perspectiveX,studio.perspectiveY);
  if(warp&&studio.warps?.length)p=warpSample(p,studio.warps,(point,s)=>freezeCoverage(point,studio.freezes,s.freezeCount));return p;
 }
 async newMakeupLayer(role='lips'){
  if(!makeupRoles[role])throw new Error('Vùng trang điểm không hợp lệ.');
  if(this.loadingDocument)throw new Error('Đang mở ảnh. Hãy đợi một chút.');
  if(this.makingMakeup)throw new Error('Đang tạo lớp màu. Hãy đợi một chút.');
  const parent=this.basePhotoLayer();if(!parent)throw new Error('Mở một ảnh để bắt đầu trang điểm.');
  if(this.config.layers.filter(l=>l.studio?.makeup).length>=12)throw new Error('Dự án này đã có 12 lớp trang điểm. Hãy dùng hoặc xóa một lớp có sẵn.');
  const epoch=this.epoch,current=()=>this.epoch===epoch&&!this.loadingDocument&&this.config.layers.includes(parent);this.makingMakeup=true;let asset;
  try{
  const size=fitWithin(parent.width_original,parent.height_original,1024),canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Không thể tạo lớp màu.')),'image/png'));canvas.width=1;
  if(!current())throw new Error('Dự án đã thay đổi. Hãy chọn lại vùng trang điểm.');
  asset=await this.source(blob,'Lớp '+makeupRoles[role][0]);if(!current())throw new Error('Dự án đã thay đổi. Hãy chọn lại vùng trang điểm.');const settings=this.imageLayer(asset);
  for(const key of geometries)settings[key]=parent[key];settings.name='Trang điểm · '+makeupRoles[role][0];settings.composition=makeupRoles[role][1];settings.studio={...settings.studio,sticker:true,makeup:{targetId:parent.id,role}};
  await this.perform(new this.app.Actions.Insert_layer_action(settings,false));const layer=this.config.layer;this.workLayerId=layer.id;await this.renderPreview();this.emit('selection');return layer;
  }catch(error){if(asset&&!this.config.layers.some(l=>l.studio?.sourceId===asset.id)){URL.revokeObjectURL(asset.url);this.sources.delete(asset.id);}throw error;}finally{this.makingMakeup=false;}
 }
 async chooseMakeupLayer(id){const layer=this.config.layers.find(l=>l.id===Number(id)&&l.studio?.makeup);if(!layer)throw new Error('Lớp màu không còn trong dự án.');await this.select(layer.id);this.workLayerId=layer.id;this.emit('selection');return layer;}
 async applyLook(recipe){validateLook({name:'Look',recipe});this.workLayerId=null;await this.updateStudio({preset:recipe.preset||'original',intensity:recipe.intensity??100,adjustments:copy(recipe.adjustments||{}),hsl:copy(recipe.hsl||{}),curve:copy(recipe.curve||[]),levels:recipe.levels?copy(recipe.levels):null},this.basePhotoLayer());}
 async updateText(options,layerId=this.config.layer?.id){const epoch=this.epoch,layer=this.config.layers.find(l=>l.id===layerId);if(layer?.type==='text'){const data=copy(layer.data);for(const line of data)for(const span of line){span.meta={...span.meta,...options.meta};if(options.text!==undefined)span.text=String(options.text);}await ensureTextFonts([{type:'text',data}]);}if(this.epoch!==epoch||this.loadingDocument||!this.config.layers.includes(layer))throw new Error('Dự án đã thay đổi. Hãy chọn lại lớp chữ.');return super.updateText(options,layerId);}
 snapshot(){
  const project=super.snapshot();for(const layer of project.layers)if(layer.studio?.makeup){const raw=this.config.layers.find(l=>l.id===layer.id),effective=this.displayLayer(raw);if(effective){for(const key of geometries)layer[key]=effective[key];layer.studio=copy(this.renderRecipe(raw));if(effective.studio.frame)layer.studio.frame=copy(effective.studio.frame);}}
  return project;
 }
 async open(...args){const previous=this.workLayerId;this.workLayerId=null;try{return await super.open(...args);}catch(error){this.workLayerId=previous;throw error;}}
 async restore(...args){const previous=this.workLayerId;this.workLayerId=null;try{return await super.restore(...args);}catch(error){this.workLayerId=previous;throw error;}}
 async setCompare(active){if(!active)for(const l of this.config.layers)if(l.studio?.makeup)this.cache.delete(l.id);return super.setCompare(active);}
 async exportImage(options={}){
  await ensureTextFonts(this.config.layers);await(document.fonts?.ready||Promise.resolve());
  // A native bundle yields between its subactions. Wait until both queues are
  // unchanged, then capture dimensions, geometry and source references together.
  let pending,state;do{pending=this.queue;await pending;state=this.stateQueue;await state;}while(pending!==this.queue||state!==this.stateQueue);
  if(this.loadingDocument)throw new Error('Đang mở dự án. Hãy đợi ảnh sẵn sàng rồi xuất.');
  const documentSnapshot={width:this.config.WIDTH,height:this.config.HEIGHT,sources:new Map(this.sources)};
  const snapshots=this.config.layers.map(l=>({...l,studio:copy(l.studio),params:copy(l.params),data:l.type==='image'?null:copy(l.data)})),byId=new Map(snapshots.map(l=>[l.id,l]));
  const layers=(options.layers||snapshots).map(value=>{const layer=byId.get(value.id)||value,parent=byId.get(layer.studio?.makeup?.targetId);return {...this.displayLayer(layer,parent),studio:copy(this.renderRecipe(layer,layer.studio,parent)),_exportSnapshot:true};});
  return super.exportImage({...options,layers,documentSnapshot});
 }
 async deleteLayer(){
  const layer=this.config.layer;if(!layer)return;
  if(layer.type==='image'&&!layer.studio?.sticker){
   const photos=this.config.layers.filter(l=>l.type==='image'&&!l.studio?.sticker);if(photos.length<=1)throw new Error('Giữ ít nhất một lớp ảnh trong dự án.');
   const children=this.config.layers.filter(l=>l.studio?.makeup?.targetId===layer.id),A=this.app.Actions;await this.perform(new A.Bundle_action('delete_photo','Xóa ảnh và lớp màu',children.map(l=>new A.Delete_layer_action(l.id,true)).concat(new A.Delete_layer_action(layer.id,true))));this.workLayerId=null;this.emit('selection');return;
  }
  if(layer.id===this.workLayerId)this.workLayerId=null;return super.deleteLayer();
 }
 async merge(){
  const current=this.config.layer,sorted=this.app.Layers.get_sorted_layers(),below=sorted[sorted.findIndex(l=>l.id===current?.id)+1];
  if([current,below].some(l=>l&&(l.studio?.makeup||l.studio?.canvasFrame||this.config.layers.some(child=>child.studio?.makeup?.targetId===l.id))))throw new Error('Các lớp trang điểm và khung đang liên kết với ảnh. Hãy giữ riêng các lớp này để tiếp tục chỉnh sửa.');
  return super.merge();
 }
 async goHistory(index){
  if(!Number.isInteger(index)||index<0||index>this.app.State.action_history.length)throw new Error('Mốc lịch sử không hợp lệ.');
  const operation=this.queue.then(async()=>{
   const state=this.app.State;if(index>state.action_history.length)throw new Error('Mốc lịch sử không còn hợp lệ sau thao tác mới.');
   this.historyJumping=true;
   try{while(state.action_history_index!==index){const before=state.action_history_index,undo=before>index;if(undo?!state.can_undo():!state.can_redo())throw new Error('Không thể chuyển tới mốc lịch sử này.');await state[undo?'undo_action':'redo_action']();if(state.action_history_index===before)throw new Error('Lịch sử chưa chuyển được. Hãy thử lại.');}}
   finally{this.historyJumping=false;await this.renderPreview();this.emit('change');this.emit('selection');}
  });this.queue=operation.catch(()=>{});return operation;
 }
 async rotate(){return this.rotateTo(((this.basePhotoLayer()?.rotate||0)+90)%360);}
 async rotateTo(value){
  const frame=this.config.layers.find(l=>l.studio?.canvasFrame);if(!frame)return super.rotateTo(value);
  if(!Number.isFinite(value))throw new Error('Góc xoay không hợp lệ.');const parent=this.basePhotoLayer();if(!parent)return;this.workLayerId=null;await this.select(parent.id);
  const angle=((value%360)+360)%360,radians=angle*Math.PI/180,padding=frame.studio.canvasFrame.padding,extent=(w,h)=>Math.ceil(Math.round((w*Math.abs(Math.cos(radians))+h*Math.abs(Math.sin(radians)))*1000)/1000);
  const width=Math.max(this.config.WIDTH,extent(parent.width,parent.height)+padding.left+padding.right),height=Math.max(this.config.HEIGHT,extent(parent.height,parent.width)+padding.top+padding.bottom);
  if(width*height>64000000||width>20000||height>20000)throw new Error('Kích thước sau khi xoay vượt giới hạn ảnh.');
  const dx=(width-this.config.WIDTH)/2,dy=(height-this.config.HEIGHT)/2,A=this.app.Actions,actions=[new A.Prepare_canvas_action('undo'),new A.Update_config_action({WIDTH:width,HEIGHT:height})];
  for(const l of this.config.layers){if(l===frame)continue;const changes={x:l.x+dx,y:l.y+dy,...(l===parent?{rotate:angle}:{})};if(l.studio?.frame)changes.studio={...copy(l.studio),frame:{...l.studio.frame,x:l.studio.frame.x+dx,y:l.studio.frame.y+dy}};actions.push(new A.Update_layer_action(l.id,changes));}
  actions.push(new A.Update_layer_action(frame.id,{x:0,y:0,width,height}),new A.Prepare_canvas_action('do'));await this.perform(new A.Bundle_action('rotate_layer','Xoay ảnh',actions));await this.fit();
 }
 async framePhoto(style='paper',percent=5){
  const colors={paper:'#fffdf9',charcoal:'#18181a',blush:'#f4e4eb',polaroid:'#fffdf9'};if(!Object.hasOwn(colors,style)||!Number.isFinite(percent)||percent<0||percent>20)throw new Error('Khung ảnh không hợp lệ.');
  const existing=this.config.layers.find(l=>l.studio?.canvasFrame),old=existing?.studio.canvasFrame.padding||{left:0,right:0,top:0,bottom:0},w=this.config.WIDTH-old.left-old.right,h=this.config.HEIGHT-old.top-old.bottom;
  if(percent===0&&!existing)return null;
  if(w<1||h<1)throw new Error('Không thể thay khung này. Hãy hoàn tác và thử lại.');
  const p=Math.round(Math.min(w,h)*percent/100),padding={left:p,right:p,top:p,bottom:style==='polaroid'?p*3:p},width=w+padding.left+padding.right,height=h+padding.top+padding.bottom;if(width*height>64000000||width>20000||height>20000)throw new Error('Khung vượt giới hạn kích thước ảnh.');
  const dx=padding.left-old.left,dy=padding.top-old.top,A=this.app.Actions,actions=[new A.Prepare_canvas_action('undo'),new A.Update_config_action({WIDTH:width,HEIGHT:height})],parent=this.basePhotoLayer();
  for(const l of this.config.layers){if(l===existing)continue;const changes={x:l.x+dx,y:l.y+dy};if(l.studio?.frame)changes.studio={...copy(l.studio),frame:{...l.studio.frame,x:l.studio.frame.x+dx,y:l.studio.frame.y+dy}};actions.push(new A.Update_layer_action(l.id,changes));}
  const settings={name:'Khung ảnh',type:'rectangle',x:0,y:0,width,height,is_vector:true,render_function:['rectangle','render'],params:{fill:true,border:false,fill_color:colors[style],border_color:colors[style],border_size:0,radius:0},studio:{canvasFrame:{style,padding,percent}}};
  if(percent===0)actions.push(new A.Delete_layer_action(existing.id,true));else if(existing)actions.push(new A.Update_layer_action(existing.id,settings));else actions.push(new A.Insert_layer_action({...settings,order:Math.min(...this.config.layers.map(l=>l.order))-1},false));actions.push(new A.Prepare_canvas_action('do'));
  await this.perform(new A.Bundle_action('studio_frame','Khung ảnh',actions));if(parent)await this.select(parent.id);await this.fit();return this.config.layers.find(l=>l.studio?.canvasFrame);
 }
}
