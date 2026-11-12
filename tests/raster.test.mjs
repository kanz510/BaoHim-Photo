import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
const {RasterService}=await import('../src/js/studio/raster-service.mjs').catch(()=>({}));
const canvas=(w,h)=>createCanvas(w,h);
function fixture(){const c=canvas(8,8),ctx=c.getContext('2d');ctx.fillStyle='#204060';ctx.fillRect(0,0,8,8);return c;}
test('neutral raster rendering keeps original pixels and does not mutate the source',async()=>{
 const source=fixture(),before=source.getContext('2d').getImageData(0,0,8,8).data;
 const renderer=RasterService&&new RasterService({canvas});
 const output=await renderer?.render(source,{}, {edge:100});
 assert.ok(output,'raster renderer is implemented');
 assert.deepEqual(output.getContext('2d').getImageData(0,0,8,8).data,before);
 assert.deepEqual(source.getContext('2d').getImageData(0,0,8,8).data,before);
});
test('makeup modifies only the painted region and strength zero is identity',async()=>{
 const source=fixture(),renderer=RasterService&&new RasterService({canvas});
 const studio={strokes:[{type:'makeup',points:[{x:4,y:4}],radius:2,hardness:.9,strength:1,color:'#ff0000',blend:'source-over'}]};
 const output=await renderer?.render(source,studio,{edge:100});
 assert.ok(output,'raster renderer is implemented');
 const pixels=output.getContext('2d').getImageData(0,0,8,8).data;
 assert.deepEqual(Array.from(pixels.slice(0,4)),[32,64,96,255]);
 assert.ok(pixels[(4*8+4)*4]>200);
 studio.strokes[0].strength=0;
 const neutral=await renderer.render(source,studio,{edge:100});
 assert.deepEqual(neutral.getContext('2d').getImageData(0,0,8,8).data,source.getContext('2d').getImageData(0,0,8,8).data);
});
test('image flipping does not rewrite the original asset',async()=>{
 const source=canvas(2,1),ctx=source.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,1,1);ctx.fillStyle='blue';ctx.fillRect(1,0,1,1);
 const renderer=RasterService&&new RasterService({canvas});
 const output=await renderer?.render(source,{flipX:true},{edge:100});assert.ok(output,'raster renderer is implemented');
 assert.deepEqual(Array.from(output.getContext('2d').getImageData(0,0,1,1).data),[0,0,255,255]);
 assert.deepEqual(Array.from(source.getContext('2d').getImageData(0,0,1,1).data),[255,0,0,255]);
});
test('vignette preserves the alpha channel of transparent photos',async()=>{
 const source=canvas(8,8),ctx=source.getContext('2d');ctx.fillStyle='rgba(160,120,90,.5)';ctx.fillRect(2,2,4,4);
 const renderer=new RasterService({canvas}),before=ctx.getImageData(0,0,8,8).data;
 const out=await renderer.render(source,{adjustments:{vignette:100}});
 const after=out.getContext('2d').getImageData(0,0,8,8).data;
 assert.deepEqual(Array.from(after).filter((_,i)=>i%4===3),Array.from(before).filter((_,i)=>i%4===3));
});
test('adding or clearing freeze protection does not alter earlier warp strokes',async()=>{
 const source=canvas(32,24),ctx=source.getContext('2d');for(let x=0;x<32;x++){ctx.fillStyle=`rgb(${x*7},90,130)`;ctx.fillRect(x,0,1,24);}
 const renderer=new RasterService({canvas}),warp={from:{x:16,y:12},to:{x:21,y:12},radius:12,strength:.6,freezeCount:0};
 const first=await renderer.render(source,{warps:[warp],freezes:[]});
 const protectedLater=await renderer.render(source,{warps:[warp],freezes:[{points:[{x:16,y:12}],radius:18,hardness:.9}]});
 assert.deepEqual(protectedLater.getContext('2d').getImageData(0,0,32,24).data,first.getContext('2d').getImageData(0,0,32,24).data);
});
test('an eraser brush removes alpha locally and a restore brush brings original pixels back',async()=>{
 const source=fixture(),renderer=new RasterService({canvas}),erase={type:'erase',points:[{x:4,y:4}],radius:2,hardness:.99,strength:1};
 const removed=await renderer.render(source,{strokes:[erase]});assert.equal(removed.getContext('2d').getImageData(4,4,1,1).data[3],0);
 const restored=await renderer.render(source,{strokes:[erase,{...erase,type:'restore'}]});assert.equal(restored.getContext('2d').getImageData(4,4,1,1).data[3],255);
});
test('levels map the black and white input points without changing alpha',async()=>{
 const c=canvas(2,1),ctx=c.getContext('2d');ctx.fillStyle='rgb(40,40,40)';ctx.fillRect(0,0,1,1);ctx.fillStyle='rgb(200,200,200)';ctx.fillRect(1,0,1,1);
 const out=await new RasterService({canvas}).render(c,{levels:{black:40,white:200,gamma:1}});
 assert.deepEqual(Array.from(out.getContext('2d').getImageData(0,0,2,1).data),[0,0,0,255,255,255,255,255]);
});
test('restore can replace painted pixels with transparent original pixels',async()=>{
 const source=canvas(12,12),brush={points:[{x:6,y:6}],radius:4,hardness:.99,strength:1};
 const out=await new RasterService({canvas}).render(source,{strokes:[{...brush,type:'paint',color:'#ff0000'},{...brush,type:'restore'}]});
 assert.deepEqual(Array.from(out.getContext('2d').getImageData(6,6,1,1).data),[0,0,0,0]);
});
test('makeup vector strokes can render beyond the small transparent source resolution',async()=>{
 const {PremiumRaster}=await import('../src/js/studio/premium-raster.mjs').catch(()=>({}));assert.ok(PremiumRaster);
 const source=canvas(32,32),r=new PremiumRaster({canvas});const out=await r.render(source,{makeup:{targetId:1,role:'lips'},strokes:[{type:'makeup',points:[{x:16,y:16}],radius:4,hardness:.9,strength:1,color:'#ff0000',blend:'source-over'}]},{edge:128});
 assert.equal(out.width,128);assert.ok(out.getContext('2d').getImageData(64,64,1,1).data[3]>200);assert.equal(out.getContext('2d').getImageData(0,0,1,1).data[3],0);
});

test('indexed warping matches every reference pixel through perspective, restore and historical freeze',async()=>{
 const source=createCanvas(220,280),ctx=source.getContext('2d'),image=ctx.createImageData(220,280);for(let i=0;i<image.data.length;i++)image.data[i]=(i*37)%251;ctx.putImageData(image,0,0);
 const studio={perspectiveX:12,perspectiveY:-8,warps:Array.from({length:20},(_,i)=>({from:{x:25+(i%5)*35,y:35+Math.floor(i/5)*50},to:{x:35+(i%5)*35,y:40+Math.floor(i/5)*50},radius:24,strength:.3,mode:i%7===0?'restore':i%3===0?'pinch':'push',freezeCount:i%3})),freezes:[{radius:20,hardness:.4,points:Array.from({length:30},(_,i)=>({x:20+i*4,y:100}))},{clear:true},{radius:18,hardness:.2,erase:true,points:[{x:100,y:100}]}]};
 const indexed=new RasterService({canvas:(w,h)=>createCanvas(w,h)}),reference=new RasterService({canvas:(w,h)=>createCanvas(w,h),indexedWarp:false}),a=await indexed.render(source,studio,{edge:280}),b=await reference.render(source,studio,{edge:280});assert.deepEqual(a.getContext('2d').getImageData(0,0,220,280).data,b.getContext('2d').getImageData(0,0,220,280).data);
});
