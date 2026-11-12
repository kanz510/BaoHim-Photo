/* Copyright 2026 PHOTO BEAUTY STUDIO. MIT. Standard scale/translation viewport. */
export class Viewport{
 constructor(){this.scale=1;this.x=0;this.y=0;this.ctx=null;this.bounds={top:0,left:0,right:200,bottom:200};this.matrix=[1,0,0,1,0,0];this.invMatrix=[1,0,0,1,0,0];this.invScale=1;}
 setContext(ctx){this.ctx=ctx;}
 getContext(){return this.ctx;}
 setBounds(top,left,right,bottom){this.bounds={top,left,right,bottom};}
 getBounds(){return {...this.bounds};}
 canvasSize(){const c=this.ctx?.canvas;return {width:c?.studioViewportWidth??c?.width??0,height:c?.studioViewportHeight??c?.height??0};}
 getMaxScale(){const b=this.bounds,c=this.canvasSize();return this.ctx?Math.min(c.width/Math.max(1,b.right-b.left),c.height/Math.max(1,b.bottom-b.top)):0;}
 update(){
  this.scale=Math.max(.001,this.scale,this.getMaxScale());
  if(this.ctx){const b=this.bounds,clamp=(v,a,z)=>Math.max(a,Math.min(z,v));
   const c=this.canvasSize();this.x=clamp(this.x,c.width-b.right*this.scale,-b.left*this.scale);
   this.y=clamp(this.y,c.height-b.bottom*this.scale,-b.top*this.scale);
  }
  this.matrix.splice(0,6,this.scale,0,0,this.scale,this.x,this.y);this.invScale=1/this.scale;
  this.invMatrix.splice(0,6,this.invScale,0,0,this.invScale,-this.x*this.invScale,-this.y*this.invScale);
 }
 constrain(){this.update();}
 getPosition(){this.update();return {x:this.x,y:this.y};}
 getScale(){this.update();return this.scale;}
 canvasDefault(){const d=this.ctx?.canvas.studioPixelRatio||1;this.ctx?.setTransform(d,0,0,d,0,0);}
 apply(){this.update();const d=this.ctx?.canvas.studioPixelRatio||1;this.ctx?.setTransform(...this.matrix.map(n=>n*d));}
 toWorld(x,y){this.update();return {x:(x-this.x)/this.scale,y:(y-this.y)/this.scale};}
 toScreen(p,out={}){this.update();out.x=p.x*this.scale+this.x;out.y=p.y*this.scale+this.y;return out;}
 scaleAt(x,y,factor){if(!Number.isFinite(factor)||factor<=0)return;this.update();const p=this.toWorld(x,y);this.scale*=factor;this.x=x-p.x*this.scale;this.y=y-p.y*this.scale;}
 move(dx,dy){if(Number.isFinite(dx)&&Number.isFinite(dy)){this.x+=dx;this.y+=dy;}}
}
export default new Viewport();
