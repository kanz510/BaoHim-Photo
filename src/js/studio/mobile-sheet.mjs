import {sheetStops} from './mobile-layout.mjs';

export class MobileSheet{
 constructor(ui){
  this.ui=ui;this.root=document.getElementById('mobile-shell');this.el=document.getElementById('studio-inspector');this.handle=document.getElementById('sheet-drag-zone');this.detent='closed';this.height=0;this.drag=null;
  this.handle.addEventListener('pointerdown',e=>this.down(e));this.handle.addEventListener('pointermove',e=>this.move(e));this.handle.addEventListener('pointerup',e=>this.up(e));this.handle.addEventListener('pointercancel',()=>{this.drag=null;this.el.classList.remove('is-dragging');this.set(this.detent);});
  this.resize=()=>this.viewportChanged();window.addEventListener('resize',this.resize);window.visualViewport?.addEventListener('resize',this.resize);window.visualViewport?.addEventListener('scroll',this.resize);
  this.viewportChanged();
 }
 stops(){const dock=(this.keyboard||this.detent!=='closed')?0:(document.getElementById('mobile-nav')?.offsetHeight||58);return sheetStops(window.visualViewport?.height||window.innerHeight,this.root.querySelector('.mobile-header')?.offsetHeight||46,dock);}
 viewportChanged(){
  const vv=window.visualViewport,height=Math.round(vv?.height||window.innerHeight),focused=document.activeElement?.matches('textarea,input:not([type="range"]):not([type="color"]),select');
  this.keyboard=!!focused&&height<window.innerHeight-100;this.root.classList.toggle('keyboard-visible',this.keyboard);this.root.style.setProperty('--app-height',height+'px');this.root.style.top=Math.max(0,vv?.offsetTop||0)+'px';
  const nextHeight=this.stops()[this.detent],changed=this.lastViewportHeight!==height||this.height!==nextHeight;
  this.lastViewportHeight=height;this.write(nextHeight);if(changed)this.ui.mobileViewport?.schedule();
 }
 set(detent,{render=true}={}){
  if(!['closed','peek','compact','expanded'].includes(detent))return;const previous=this.detent;this.detent=detent;this.el.classList.remove('minimized');this.el.dataset.detent=detent;this.root.classList.toggle('sheet-open',detent!=='closed');this.write(this.stops()[detent]);
  this.handle.querySelector('.sheet-grabber')?.setAttribute('aria-expanded',String(detent==='expanded'));
  if(render&&(previous==='expanded')!==(detent==='expanded'))this.ui.renderPanel();this.write(this.stops()[detent]);this.ui.mobileViewport?.schedule();
 }
 write(height){const actual=this.ui?.isV5&&this.detent!=='closed'&&!this.drag?Math.round(this.el?.getBoundingClientRect().height||0):0;const h=actual>0?actual:height;this.height=h;this.root.style.setProperty('--sheet-height',`${Math.max(0,h||0)}px`);}
 down(event){if(event.button!==0||event.target.closest('button,a,input,select,[role="button"],[data-v3-subtool],[data-mobile-action]'))return;this.drag={id:event.pointerId,y:event.clientY,height:this.height,detent:this.detent,time:performance.now()};this.handle.setPointerCapture?.(event.pointerId);this.el.classList.add('is-dragging');}
 move(event){if(this.drag?.id!==event.pointerId)return;event.preventDefault();const s=this.stops();this.write(Math.max(s.peek,Math.min(s.expanded,this.drag.height+this.drag.y-event.clientY)));}
 up(event){
  if(this.drag?.id!==event.pointerId)return;const drag=this.drag,delta=drag.y-event.clientY;this.drag=null;this.el.classList.remove('is-dragging');
  if(Math.abs(delta)<5)return;this.suppressClickUntil=performance.now()+150;
  const s=this.stops(),names=['peek','compact','expanded'];let target=names.reduce((best,name)=>Math.abs(s[name]-this.height)<Math.abs(s[best]-this.height)?name:best,'peek');
  if(Math.abs(delta)>35&&performance.now()-drag.time<500){const index=names.indexOf(drag.detent),near=names.indexOf(target),next=Math.max(0,Math.min(2,index+(delta>0?1:-1)));target=names[delta>0?Math.max(near,next):Math.min(near,next)];}
  this.set(target);
 }
}
