import {interpolateStroke,clamp,perspectiveSample} from './math.mjs';
export class GestureRouter{
 constructor(facade,ui){
  this.f=facade;this.ui=ui;this.pointers=new Map();this.stroke=null;this.warps=[];this.cloneSource=null;this.clonePicking=false;this.space=false;this.lastPan=null;this.frame=null;this.bodyHandles=[];this.bodyDrag=-1;
  this.canvas=document.getElementById('canvas_minipaint');this.cursor=document.getElementById('brush-cursor');
  this.nativeSnapshot=null;this.suppressNativeTouch=false;this.suppressMouseUntil=0;
  this.canvas.addEventListener('pointerdown',e=>this.down(e),{capture:true});
  this.canvas.addEventListener('pointermove',e=>this.move(e),{capture:true});
  this.canvas.addEventListener('pointerup',e=>this.up(e),{capture:true});
  this.canvas.addEventListener('pointercancel',()=>this.cancel(),{capture:true});
  this.canvas.addEventListener('pointerleave',()=>this.cursor.hidden=true);
  this.canvas.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();this.ui.safely(()=>this.f.zoom(e.deltaY>0?1/1.06:1.06));}else if(this.space){e.preventDefault();this.f.pan?.(-e.deltaX,-e.deltaY);}},{passive:false});
  document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.target.closest('input,textarea,select')){e.preventDefault();this.space=true;this.canvas.style.cursor='grab';}},true);
  document.addEventListener('keyup',e=>{if(e.code==='Space'){this.space=false;this.canvas.style.cursor='';}},true);
  for(const type of ['touchstart','touchmove','touchend','touchcancel'])document.addEventListener(type,e=>{
   if((e.target===this.canvas||this.canvas.contains(e.target))&&(this.custom()||this.suppressNativeTouch||e.touches.length>1||this.pointers.size>1)){e.preventDefault();e.stopImmediatePropagation();}
   if((type==='touchend'||type==='touchcancel')&&e.touches.length===0){this.nativeSnapshot=null;if(this.suppressNativeTouch)this.suppressMouseUntil=Date.now()+500;this.suppressNativeTouch=false;}
  },{capture:true,passive:false});
  for(const type of ['mousedown','mousemove','mouseup'])document.addEventListener(type,e=>{if(Date.now()<this.suppressMouseUntil&&(e.target===this.canvas||this.canvas.contains(e.target)))this.stop(e);},{capture:true});
  this.ui.setRouter(this);
  this.f.renderOverlay=ctx=>this.renderProtection(ctx);
 }
 custom(){return ['beauty','reshape','makeup','draw'].includes(this.ui.tool)&&this.f.config.TOOL.name==='studio';}
 size(){const layer=this.f.photoLayer();return this.ui.brush.size/2*Math.max(layer?.width_original||1200,layer?.height_original||1200)/1200;}
 settings(){
  const b=this.ui.brush,base={radius:this.size(),strength:b.strength/100,hardness:b.hardness/100,feather:(b.feather??35)/100,color:b.color,blend:b.blend};
  if(b.mode==='smooth')base.detail=(b.detail??65)/100;
  if(b.mode==='tone')Object.assign(base,{warmth:b.warmth??0,hue:b.hue??0,saturation:b.saturation??0,lightness:b.lightness??0});
  return base;
 }
 stop(event){event.preventDefault();event.stopImmediatePropagation();}
 down(event){
  if(event.button!==0&&event.pointerType!=='touch')return;
  if(!this.pointers.size)this.suppressNativeTouch=false;
  this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,type:event.pointerType});
  if(this.pointers.size===1&&!this.custom()&&!this.suppressNativeTouch)this.captureNative(event);
  if(this.pointers.size>1||this.space){
   this.stop(event);this.suppressNativeTouch=[...this.pointers.values()].some(p=>p.type==='touch');this.rollbackNative();this.cancelStroke();this.canvas.setPointerCapture?.(event.pointerId);this.lastPan=this.panState();return;
  }
  if(this.suppressNativeTouch){this.stop(event);return;}
  if(!this.custom())return;
  this.stop(event);this.canvas.setPointerCapture?.(event.pointerId);
  const point=this.f.sourcePoint(event,{warp:this.ui.tool!=='reshape'}),layer=this.f.photoLayer();if(!point||!layer)return;
  if(point.x<0||point.y<0||point.x>layer.width_original||point.y>layer.height_original)return;
  if(this.ui.tool==='reshape'&&this.placingBody){
   if(this.bodyHandles.length<2){this.bodyHandles.push(point);this.bodyDrag=this.bodyHandles.length-1;}else this.bodyDrag=Math.hypot(point.x-this.bodyHandles[0].x,point.y-this.bodyHandles[0].y)<Math.hypot(point.x-this.bodyHandles[1].x,point.y-this.bodyHandles[1].y)?0:1;
   this.bodyLayerId=layer.id;this.f.config.need_render=true;return;
  }
  if((['clone','heal'].includes(this.ui.brush.mode)&&(this.clonePicking||!this.cloneSource))||(this.ui.brush.mode==='blemish'&&this.clonePicking)||event.altKey){this.cloneSource=point;this.clonePicking=false;this.f.config.need_render=true;this.ui.toast('Đã chọn vùng nguồn. Bây giờ tô lên nơi muốn sao chép.');return;}
  this.layer=layer;this.start=point;this.last=point;this.warps=[];
  this.stroke={type:this.ui.tool==='makeup'&&this.ui.brush.mode!=='restore'?'makeup':this.ui.brush.mode,points:[point],...this.settings(),cloneSource:this.cloneSource&&['clone','heal','blemish'].includes(this.ui.brush.mode)?{...this.cloneSource}:undefined};
  if(this.ui.tool==='reshape'&&['pinch','bulge'].includes(this.ui.brush.mode))this.warps=[{from:point,to:point,radius:this.size(),strength:this.ui.brush.strength/100*.6,mode:this.ui.brush.mode,freezeCount:layer.studio.freezes?.length||0}];
  if(this.ui.tool==='reshape'&&this.ui.brush.mode==='restore-warp')this.warps=[{from:point,to:point,radius:this.size(),strength:this.ui.brush.strength/100,mode:'restore'}];
  this.schedule();this.updateCursor(event);
 }
 panState(){const p=[...this.pointers.values()];if(p.length===1)return {x:p[0].x,y:p[0].y,distance:0};return {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,distance:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)};}
 move(event){
  this.lastEvent=event;this.updateCursor(event);
  if(!this.pointers.has(event.pointerId))return;
  this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,type:event.pointerType});
  if(this.pointers.size>1||this.space||this.suppressNativeTouch){
   this.stop(event);const now=this.panState();if(this.lastPan){if(now.distance&&this.lastPan.distance)this.f.zoom(clamp(now.distance/this.lastPan.distance,.8,1.25));this.f.pan?.(now.x-this.lastPan.x,now.y-this.lastPan.y);}this.lastPan=now;return;
  }
  if(this.bodyDrag>=0){this.stop(event);const p=this.f.sourcePoint(event,{warp:false});if(p)this.bodyHandles[this.bodyDrag]=p;this.f.config.need_render=true;return;}
  if(!this.stroke||!this.custom())return;this.stop(event);
  if(!this.f.config.layers.includes(this.layer)){this.cancel();return;}
  const point=this.f.sourcePoint(event,{warp:this.ui.tool!=='reshape'});if(!point)return;
  if(this.ui.tool==='reshape'&&this.ui.brush.mode!=='freeze'){
   if(['pinch','bulge'].includes(this.ui.brush.mode))return;
   if(Math.hypot(point.x-this.last.x,point.y-this.last.y)<this.size()*.09)return;
   const s={from:{...this.last},to:{...point},radius:this.size()*(['waist','shoulder'].includes(this.ui.brush.mode)?1.8:1),strength:clamp(this.ui.brush.strength/100*.65,0,.65),mode:'push',freezeCount:this.layer.studio.freezes?.length||0};
   if(['stretch','height'].includes(this.ui.brush.mode)||this.ui.brush.axis==='y')s.to.x=s.from.x;
   if(this.ui.brush.mode==='restore-warp'){s.mode='restore';s.to={...s.from};s.strength=this.ui.brush.strength/100;}
   if(this.ui.brush.axis==='x')s.to.y=s.from.y;
   this.warps.push(s);
   if(['waist','shoulder'].includes(this.ui.brush.mode))this.warps.push({...s,from:{x:this.layer.width_original-s.from.x,y:s.from.y},to:{x:this.layer.width_original-s.to.x,y:s.to.y}});
   this.last=point;
  }else{
   const points=interpolateStroke(this.last,point,Math.max(2,this.size()*.22));this.stroke.points.push(...points.slice(1));this.last=point;
   if(this.stroke.points.length>3000)this.stroke.points=this.stroke.points.filter((_,i)=>i%2===0);
  }
  this.schedule();
 }
 schedule(){
  if(this.frame)return;this.frame=setTimeout(()=>{this.frame=null;if(!this.stroke)return;this.ui.safely(async()=>{
   if(this.ui.tool==='reshape'&&this.ui.brush.mode!=='freeze'){await this.f.preview({warps:[...(this.layer.studio.warps||[]),...this.warps]});}
   else if(this.ui.brush.mode==='freeze'){this.drawProtection();}
   else await this.f.preview({strokes:[...(this.layer.studio.strokes||[]),this.stroke]});
  });},55);
 }
 async up(event){
  this.pointers.delete(event.pointerId);
  if(this.bodyDrag>=0){this.bodyDrag=-1;this.stop(event);return;}
  if(this.lastPan){this.lastPan=null;this.cancelStroke();return;}
  if(!this.stroke){if(!this.pointers.size&&!this.suppressNativeTouch)setTimeout(()=>{if(!this.pointers.size)this.nativeSnapshot=null;},0);return;}this.stop(event);clearTimeout(this.frame);this.frame=null;
  const stroke=this.stroke,warps=this.warps;this.stroke=null;this.warps=[];
  this.ui.safely(async()=>{
   if(this.ui.tool==='reshape'&&stroke.type!=='freeze'){if(warps.length)await this.f.addWarp(warps);}
   else await this.f.addStroke(stroke);
   if(stroke.type==='freeze')this.drawProtection();
  });
 }
 captureNative(event){
  this.nativeSnapshot={touch:event.pointerType==='touch',layers:this.f.config.layers.map(layer=>({layer,values:{x:layer.x,y:layer.y,width:layer.width,height:layer.height,rotate:layer.rotate,params:JSON.parse(JSON.stringify(layer.params||{}))}})),selections:Object.values(this.f.app.GUI.GUI_tools.tools_modules).filter(item=>item.object?.selection).map(item=>({tool:item.object,selection:JSON.parse(JSON.stringify(item.object.selection))}))};
 }
 rollbackNative(){
  const snapshot=this.nativeSnapshot;if(snapshot){for(const {layer,values} of snapshot.layers)if(this.f.config.layers.includes(layer))Object.assign(layer,values);for(const {tool,selection} of snapshot.selections)tool.selection=selection;}
  this.nativeSnapshot=null;this.f.app.Tools.is_drag=false;this.f.app.Tools.mouse_click_valid=false;
  Object.assign(this.f.config.mouse,{is_drag:false,click_valid:false});
  for(const {object} of Object.values(this.f.app.GUI.GUI_tools.tools_modules)){
   if(!object)continue;object.moving=false;object.resizing=false;object.is_mousedown_canvas=false;
   if(object.Base_selection)Object.assign(object.Base_selection,{is_drag:false,mouse_lock:null,current_angle:null,selected_object_drag_type:null,click_details:{}});
  }
  this.f.config.need_render=true;
 }
 cancelStroke(){const dirty=!!this.stroke||this.warps.length;clearTimeout(this.frame);this.frame=null;this.stroke=null;this.warps=[];this.bodyDrag=-1;if(dirty){this.f.cache.clear();this.f.renderPreview();}this.f.config.need_render=true;}
 cancel(){if([...this.pointers.values()].some(p=>p.type==='touch')||this.nativeSnapshot?.touch)this.suppressNativeTouch=true;this.rollbackNative();this.pointers.clear();this.lastPan=null;this.cancelStroke();this.cursor.hidden=true;}
 updateCursor(event=this.lastEvent){
  if(!event||!this.custom()){this.cursor.hidden=true;return;}const r=this.canvas.getBoundingClientRect(),layer=this.f.photoLayer();if(!layer)return;
  const diameter=this.size()*2*layer.width/(layer.width_original||layer.width)*this.f.config.ZOOM;
  this.cursor.hidden=false;this.cursor.style.width=diameter+'px';this.cursor.style.height=diameter+'px';this.cursor.style.left=event.clientX-r.left+'px';this.cursor.style.top=event.clientY-r.top+'px';
  this.cursor.style.background=this.ui.brush.mode==='freeze'?'#d280a933':'#fff1';this.canvas.style.cursor='crosshair';
 }
 drawProtection(){
  this.f.config.need_render=true;
 }
 renderProtection(ctx){
  const layer=this.f.photoLayer();if(!layer||this.f.compare)return;
  const showReshape=this.ui.tool==='reshape',showClone=['beauty','draw'].includes(this.ui.tool)&&['clone','heal','blemish'].includes(this.ui.brush.mode)&&this.cloneSource;
  if(!showReshape&&!showClone)return;
  const all=[...(layer.studio.freezes||[]),...(this.stroke?.type==='freeze'?[this.stroke]:[])],lastClear=all.findLastIndex(s=>s.clear),strokes=all.slice(lastClear+1);
  ctx.save();ctx.translate(layer.x+layer.width/2,layer.y+layer.height/2);ctx.rotate((layer.rotate||0)*Math.PI/180);ctx.translate(-layer.width/2,-layer.height/2);ctx.scale(layer.width/layer.width_original,layer.height/layer.height_original);
  if(layer.studio.flipX){ctx.translate(layer.width_original,0);ctx.scale(-1,1);}if(layer.studio.flipY){ctx.translate(0,layer.height_original);ctx.scale(1,-1);}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  const forward=p=>perspectiveSample(p,layer.width_original,layer.height_original,-(layer.studio.perspectiveX||0),-(layer.studio.perspectiveY||0));
  if(showClone){
   const r=10/(this.f.config.ZOOM*layer.width/layer.width_original),src=forward(this.cloneSource);
   ctx.strokeStyle='rgba(255,255,255,0.92)';ctx.lineWidth=r*0.22;ctx.beginPath();ctx.arc(src.x,src.y,this.size(),0,Math.PI*2);ctx.stroke();
   ctx.beginPath();ctx.moveTo(src.x-r*1.1,src.y);ctx.lineTo(src.x+r*1.1,src.y);ctx.moveTo(src.x,src.y-r*1.1);ctx.lineTo(src.x,src.y+r*1.1);ctx.stroke();
  }
  if(showReshape&&this.ui.brush.mode==='freeze'){ctx.fillStyle='rgba(208,117,157,.22)';for(const s of strokes)for(const point of s.points||[]){const p=forward(point);ctx.beginPath();ctx.arc(p.x,p.y,s.radius,0,Math.PI*2);ctx.fill();}}
  if(showReshape&&this.placingBody&&this.bodyLayerId===layer.id){
   const r=10/(this.f.config.ZOOM*layer.width/layer.width_original);ctx.strokeStyle='#ffffff';ctx.fillStyle='#cf7292';ctx.lineWidth=r*.2;
   const handles=this.bodyHandles.map(forward);if(handles.length===2){ctx.beginPath();ctx.moveTo(handles[0].x,handles[0].y);ctx.lineTo(handles[1].x,handles[1].y);ctx.stroke();}
   handles.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle='#cf7292';ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font=`600 ${r*1.1}px Manrope`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),p.x,p.y);});
  }
  ctx.restore();
 }
}
