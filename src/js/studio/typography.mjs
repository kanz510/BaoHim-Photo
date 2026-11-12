import {graphemes} from './math.mjs';
import {textFont as font} from './font-registry.mjs';
export function layoutText(ctx,lines,width){
 const glyphs=[];let y=0;
 for(const line of lines){
  let x=0,rowHeight=0,row=0;
  for(const span of line){const meta=span.meta||{};ctx.font=font(meta,span.text);const size=meta.size||40;
   for(const text of graphemes(span.text)){
    const advance=ctx.measureText(text).width+(meta.kerning||0);
    if(x>0&&x+advance>width){y+=Math.max(rowHeight,size);row++;x=0;rowHeight=0;}
    glyphs.push({text,meta,x,y,advance,row});x+=advance;rowHeight=Math.max(rowHeight,size*1.2+(meta.leading||0));
   }
  }
  y+=rowHeight||40;
 }
 return glyphs;
}
export function renderTypography(ctx,layer){
 const type=layer.studio?.typography||{},glyphs=layoutText(ctx,layer.data||[],layer.width),arc=(type.arc||0)/100*Math.PI;
 ctx.save();ctx.translate(layer.x+layer.width/2,layer.y+layer.height/2);ctx.rotate((layer.rotate||0)*Math.PI/180);ctx.translate(-layer.width/2,-layer.height/2);
 if(type.bubble&&type.bubble!=='none'){ctx.save();ctx.fillStyle=type.bubbleColor||'#242229';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(0,0,layer.width,layer.height,Math.min(22,layer.height*.25));else ctx.rect(0,0,layer.width,layer.height);ctx.fill();if(type.bubble==='speech'){ctx.beginPath();ctx.moveTo(layer.width*.18,layer.height-1);ctx.lineTo(layer.width*.16,layer.height+Math.min(24,layer.height*.2));ctx.lineTo(layer.width*.29,layer.height-1);ctx.closePath();ctx.fill();}ctx.restore();}
 let gradientEnds=null;if(type.gradient?.enabled&&/^#[0-9a-f]{6}$/i.test(type.gradient.from)&&/^#[0-9a-f]{6}$/i.test(type.gradient.to)){
  const angle=(type.gradient.angle||0)*Math.PI/180,x=Math.cos(angle),y=Math.sin(angle),distance=(Math.abs(x)*layer.width+Math.abs(y)*layer.height)/2;
  gradientEnds=[{x:layer.width/2-x*distance,y:layer.height/2-y*distance},{x:layer.width/2+x*distance,y:layer.height/2+y*distance}];
 }
 const rows=new Map();for(const g of glyphs){const key=g.y;if(!rows.has(key))rows.set(key,[]);rows.get(key).push(g);}
 for(const row of rows.values()){
  const length=Math.max(...row.map(g=>g.x+g.advance)),align=layer.params?.halign||'left',offset=align==='center'?(layer.width-length)/2:align==='right'?layer.width-length:0;
  for(const g of row){
   const meta=g.meta,size=meta.size||40;ctx.save();ctx.font=font(meta,g.text);ctx.textBaseline='top';ctx.fillStyle=meta.fill_color||'#ffffff';ctx.strokeStyle=meta.stroke_color||'#30242d';ctx.lineWidth=(meta.stroke_size||0)*2;ctx.lineJoin='round';let gx=g.x+offset,gy=g.y,rotation=0,shift=0;
   if(type.shadow){ctx.shadowColor='rgba(30,15,25,.45)';ctx.shadowBlur=type.shadow;ctx.shadowOffsetY=type.shadow/3;}
   if(arc&&length>0){const radius=Math.max(length/Math.abs(arc),size),theta=((g.x+g.advance/2)/length-.5)*Math.abs(arc);gx=layer.width/2+Math.sin(theta)*radius;gy=g.y+Math.sign(arc)*radius*(1-Math.cos(theta));rotation=Math.sign(arc)*theta;shift=g.advance/2;ctx.translate(gx,gy);ctx.rotate(rotation);ctx.translate(-shift,0);}
   else ctx.translate(g.x+offset,g.y);
   if(gradientEnds){const mapped=gradientEnds.map(p=>{const dx=p.x-gx,dy=p.y-gy;return {x:dx*Math.cos(rotation)+dy*Math.sin(rotation)+shift,y:-dx*Math.sin(rotation)+dy*Math.cos(rotation)};});const gradient=ctx.createLinearGradient(mapped[0].x,mapped[0].y,mapped[1].x,mapped[1].y);gradient.addColorStop(0,type.gradient.from);gradient.addColorStop(1,type.gradient.to);ctx.fillStyle=gradient;}
   if(type.depth){ctx.save();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.fillStyle=type.depthColor||'#af5b86';for(let d=Math.min(24,Math.round(type.depth));d>=1;d--)ctx.fillText(g.text,d*.6,d);ctx.restore();}
   if(type.glow){ctx.shadowColor=type.glowColor||meta.fill_color||'#ffffff';ctx.shadowBlur=Math.min(60,type.glow);ctx.shadowOffsetY=0;}
   if(meta.stroke_size)ctx.strokeText(g.text,0,0);ctx.fillText(g.text,0,0);
   if(meta.underline){ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(0,size*1.05);ctx.lineTo(g.advance,size*1.05);ctx.lineWidth=Math.max(1,size/18);ctx.strokeStyle=meta.fill_color||'#fff';ctx.stroke();}
   ctx.restore();
  }
 }
 ctx.restore();
}
