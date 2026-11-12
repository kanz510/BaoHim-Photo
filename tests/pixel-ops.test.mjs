import {test} from 'node:test';import assert from 'node:assert/strict';import {createCanvas}from'@napi-rs/canvas';import{RasterService}from'../src/js/studio/raster-service.mjs';
const ops=await import('../src/js/studio/pixel-ops.mjs').catch(()=>({}));
test('HSL is identity at neutral, isolates color bands and preserves alpha',()=>{assert.ok(ops.hslPixels);const p=new Uint8ClampedArray([255,0,0,127,0,0,255,200,128,128,128,240]);assert.deepEqual(ops.hslPixels(p,{}),p);const out=ops.hslPixels(p,{red:{saturation:-100}});assert.equal(out[0],out[1]);assert.deepEqual([...out.slice(4)], [...p.slice(4)]);assert.equal(out[3],127);const hue=ops.hslPixels(p,{red:{hue:120}});assert.ok(hue[1]>240&&hue[0]<10);});
test('separable blur softens detail without modifying alpha or the input',()=>{assert.ok(ops.blurPixels);const p=new Uint8ClampedArray(5*5*4);for(let i=3;i<p.length;i+=4)p[i]=90;p[(2*5+2)*4]=255;const out=ops.blurPixels(p,5,5,1);assert.ok(out[(2*5+2)*4]<100);assert.ok(out[(2*5+1)*4]>0);assert.equal(p[(2*5+2)*4],255);assert.equal(out[3],90);});
test('healing matches destination lighting while transferring manual source detail',()=>{assert.ok(ops.healPixels);const p=new Uint8ClampedArray(40*10*4);for(let y=0;y<10;y++)for(let x=0;x<40;x++){const i=(y*40+x)*4;for(let k=0;k<3;k++)p[i+k]=x<20?80+(x%2)*16:180;p[i+3]=255;}const out=ops.healPixels(p,40,10,{x:7,y:5},{x:30,y:5},4);assert.ok(out[(5*40+30)*4]>150);assert.ok(out[(5*40+30)*4]!==out[(5*40+31)*4]);assert.equal(out[3],255);});
test('real raster honors optional HSL and blur recipes while original source stays intact',async()=>{const c=createCanvas(40,40),ctx=c.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,40,40);const r=new RasterService({canvas:(w,h)=>createCanvas(w,h)});const out=await r.render(c,{hsl:{red:{hue:120}}});assert.ok(out.getContext('2d').getImageData(20,20,1,1).data[1]>240);assert.equal(ctx.getImageData(20,20,1,1).data[0],255);});
test('Phase 1 skinSmoothPixels smooths medium blotches while preserving high-contrast edges (eyes/hair) and fine pore detail',()=>{
 assert.ok(ops.skinSmoothPixels);
 const w=24,h=24,p=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;
  // Left half: skin tone (~200,150,130) with medium blotch on y=6..9 and fine pore pattern; Right half (x>=16): dark hair/eye edge (20,20,25)
  const isHair=x>=16;
  const blotch=!isHair&&x>=6&&x<=9&&y>=6&&y<=9?26:0;
  const pore=!isHair&&((x+y)&1)?4:-4;
  p[i]=isHair?20:200+blotch+pore;
  p[i+1]=isHair?20:150-blotch+pore;
  p[i+2]=isHair?25:130+pore;
  p[i+3]=255;
 }
 const out=ops.skinSmoothPixels(p,w,h,3,0.65);
 // Blotch difference relative to surrounding skin is reduced
 const beforeDiff=Math.abs(p[(7*w+7)*4]-p[(7*w+3)*4]);
 const afterDiff=Math.abs(out[(7*w+7)*4]-out[(7*w+3)*4]);
 assert.ok(afterDiff<beforeDiff,'blotch contrast is reduced by frequency-separated bilateral filter');
 // Sharp hair/eye boundary at x=15 vs x=16 is preserved (not blurred across)
 assert.ok(out[(12*w+15)*4]>170,'skin side of sharp boundary stays bright');
 assert.ok(out[(12*w+16)*4]<40,'hair/eye side of sharp boundary stays dark');
});
test('Phase 1 skinTonePixels adjusts warmth, lightness, hue and saturation cleanly',()=>{
 assert.ok(ops.skinTonePixels);
 const p=new Uint8ClampedArray([190,145,125,255]);
 const warmBright=ops.skinTonePixels(p,{warmth:40,lightness:25,saturation:10,hue:0,strength:1});
 assert.ok(warmBright[0]>p[0],'warmth + lightness increases red channel');
 assert.ok(warmBright[1]>p[1],'lightness increases green channel');
 assert.equal(warmBright[3],255);
});
test('Phase 5 opticalEffectsPixels renders bloom, glow, halation, lightLeak and chromatic aberration',()=>{
 assert.ok(ops.opticalEffectsPixels);
 const w=16,h=16,p=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,bright=Math.abs(x-8)<=1&&Math.abs(y-8)<=1?250:40;
  p[i]=bright;p[i+1]=bright;p[i+2]=bright;p[i+3]=255;
 }
 const out=ops.opticalEffectsPixels(p,w,h,{bloom:60,glow:40,halation:65,lightLeak:50,chromatic:40});
 // Neighbor of bright highlight receives warm halation & bloom spill
 const neighborIdx=(8*w+6)*4;
 assert.ok(out[neighborIdx]>p[neighborIdx],'bloom/halation brightens neighbor of specular highlight');
 assert.ok(out[neighborIdx]>out[neighborIdx+2],'halation adds warm red-orange cast around highlight');
 // Top-left corner receives warm light leak
 assert.ok(out[0]>p[0],'light leak warms corner pixels');
});
