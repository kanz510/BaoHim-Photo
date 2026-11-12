import {GestureRouter} from './gesture-router.mjs';
export class MobileGestureRouter extends GestureRouter{
 constructor(facade,ui,viewport){super(facade,ui);this.viewport=viewport;this.viewPanning=false;}
 down(event){if(event.button!==0&&event.pointerType!=='touch')return;if(this.ui.tool==='home'&&this.f.config.TOOL.name==='studio'&&!this.viewPanning){this.previousSpace=this.space;this.space=true;this.viewPanning=true;}return super.down(event);}
 move(event){if(this.pointers.size>1){const other=[...this.pointers].find(([id])=>id!==event.pointerId)?.[1];if(other)this.viewport.anchor={x:(other.x+event.clientX)/2,y:(other.y+event.clientY)/2};}const result=super.move(event);this.viewport.anchor=null;return result;}
 up(event){const result=super.up(event);if(!this.pointers.size)this.endViewPan();return result;}
 cancel(){super.cancel();this.endViewPan();}
 endViewPan(){if(this.viewPanning){this.space=!!this.previousSpace;this.viewPanning=false;}}
}
