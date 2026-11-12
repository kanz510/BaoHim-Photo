import view from '../libs/zoomView.js';
import {containScale} from './mobile-layout.mjs';

export class MobileViewport{
 constructor(facade){
  this.f=facade;this.fitted=true;this.lastSize='';this.pending=0;
  this.stage=document.getElementById('main_wrapper');this.canvas=document.getElementById('canvas_minipaint');
  facade.fit=()=>this.fit();facade.zoom=factor=>this.zoom(factor);
  if(globalThis.ResizeObserver){this.observer=new ResizeObserver(()=>this.schedule());this.observer.observe(this.stage);}
 }
 schedule(){if(this.pending)return;this.pending=requestAnimationFrame(()=>{this.pending=0;const key=`${this.stage.clientWidth}:${this.stage.clientHeight}`;if(key===this.lastSize)return;this.lastSize=key;if(this.fitted)this.fit();else{this.f.app.GUI.prepare_canvas();this.f.config.need_render=true;}});}
 async fit(){
  const c=this.f.config,z=containScale(c.WIDTH,c.HEIGHT,this.stage.clientWidth,this.stage.clientHeight,10);if(!z)return;
  this.fitted=true;c.ZOOM=z;this.f.app.GUI.prepare_canvas();view.setBounds(0,0,c.WIDTH,c.HEIGHT);view.setContext(this.f.app.Layers.ctx);
  const previous=view.getScale();view.scaleAt(0,0,z/previous);const p=view.getPosition();view.move(-p.x,-p.y);view.update();
  this.f.app.Layers.last_zoom=z;this.f.app.Layers.stable_dimensions=[c.WIDTH,c.HEIGHT];c.need_render=true;this.f.app.GUI.check_canvas_offset();this.f.emit('viewport');
 }
 async zoom(factor){
  if(!Number.isFinite(factor)||factor<=0)return;
  const c=this.f.config,z=Math.max(.0001,Math.min(8,c.ZOOM*factor)),before=this.canvas.getBoundingClientRect();
  const anchor=this.anchor||{x:before.left+before.width/2,y:before.top+before.height/2};
  view.scaleAt(anchor.x-before.left,anchor.y-before.top,z/view.getScale());c.ZOOM=z;this.f.app.GUI.prepare_canvas();
  const after=this.canvas.getBoundingClientRect();view.move(before.left-after.left,before.top-after.top);view.update();
  this.fitted=false;this.f.app.Layers.last_zoom=z;c.need_render=true;this.f.emit('viewport');
 }
}
