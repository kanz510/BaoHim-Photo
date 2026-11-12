import { test } from 'node:test';
import assert from 'node:assert/strict';
const m = await import('../src/js/studio/math.mjs').catch(() => ({}));

test('large photo preview fits the long edge without changing aspect ratio or upscaling', () => {
  assert.deepEqual(m.fitWithin?.(4000, 3000, 2048), {width:2048,height:1536});
  assert.deepEqual(m.fitWithin?.(300, 200, 2048), {width:300,height:200});
  assert.throws(() => m.fitWithin(0,100,2048), /dimension/i);
});
test('brush maps through a rotated layer into original photo coordinates', () => {
  const layer={x:100,y:100,width:200,height:100,width_original:400,height_original:200,rotate:90};
  assert.deepEqual(m.layerPoint?.({x:200,y:200},layer), {x:300,y:100});
});
test('collage slots never overlap and fit within the canvas including gutters', () => {
  assert.deepEqual(m.collageSlots?.(1000,800,'duo',20), [
    {x:20,y:20,width:470,height:760}, {x:510,y:20,width:470,height:760}
  ]);
});
test('neutral grading preserves alpha and a one-stop exposure doubles encoded channel values', () => {
  const src=new Uint8ClampedArray([40,60,80,127, 0,128,255,0]);
  assert.deepEqual(m.gradePixels?.(src,{}),src);
  assert.deepEqual(m.gradePixels?.(src,{exposure:1}),new Uint8ClampedArray([80,120,160,127,0,255,255,0]));
  assert.deepEqual(src,new Uint8ClampedArray([40,60,80,127,0,128,255,0]));
});
test('a feathered brush has no coverage outside its radius', () => {
  assert.equal(m.brushCoverage?.(0,20,.5),1);
  assert.equal(m.brushCoverage?.(20,20,.5),0);
  assert.equal(m.brushCoverage?.(30,20,.5),0);
  assert.equal(m.brushCoverage?.(15,20,.5),.5);
});
test('warp respects freeze mask and leaves distant points untouched', () => {
  const stroke={from:{x:50,y:50},to:{x:60,y:50},radius:20,strength:.5};
  assert.deepEqual(m.warpSample?.({x:50,y:50},[stroke]),{x:45,y:50});
  assert.deepEqual(m.warpSample?.({x:90,y:50},[stroke]),{x:90,y:50});
  assert.deepEqual(m.warpSample?.({x:50,y:50},[stroke],()=>1),{x:50,y:50});
});
test('Vietnamese combining characters and emoji stay as grapheme clusters in text on a path', () => {
  assert.deepEqual(m.graphemes?.('Đẹp 👩🏽‍🎨'),['Đ','ẹ','p',' ','👩🏽‍🎨']);
});
test('stroke interpolation covers a fast drag without gaps', () => {
  assert.deepEqual(m.interpolateStroke?.({x:0,y:0},{x:10,y:0},4),[{x:0,y:0},{x:10/3,y:0},{x:20/3,y:0},{x:10,y:0}]);
});
test('manual body handles move symmetrically and a local restore removes earlier warp',()=>{
 const handles=[{x:100,y:200},{x:300,y:200}];const strokes=m.bodyWarps?.(handles,'waist',50);
 assert.equal(strokes?.length,2);assert.equal(strokes[0].to.x-100,300-strokes[1].to.x);
 assert.ok(strokes[0].to.x>100);assert.ok(strokes.every(s=>s.radius>0));
 const warp={from:{x:50,y:50},to:{x:60,y:50},radius:20,strength:.5};
 assert.deepEqual(m.warpSample({x:50,y:50},[warp,{from:{x:50,y:50},to:{x:50,y:50},radius:25,strength:1,mode:'restore'}]),{x:50,y:50});
});
test('perspective mapping is identity at zero and keeps the center fixed',()=>{
 assert.deepEqual(m.perspectiveSample?.({x:25,y:40},100,80,0,0),{x:25,y:40});
 assert.deepEqual(m.perspectiveSample?.({x:50,y:40},100,80,50,-20),{x:50,y:40});
 const p=m.perspectiveSample?.({x:90,y:60},100,80,50,0);assert.ok(p.x<90&&p.x>50);
});

test('manual face presets and shoulder/height controls reuse bounded native warps',async()=>{const {manualReshapePreset}=await import('../src/js/studio/reshape-presets.mjs').catch(()=>({}));assert.ok(manualReshapePreset);for(const id of ['face','eyes','nose','lips','chin']){const p=manualReshapePreset(id);assert.ok(['pinch','bulge','push'].includes(p.mode));assert.ok(p.size>=10&&p.size<=220);}const handles=[{x:20,y:30},{x:80,y:30}];const {bodyWarps}=await import('../src/js/studio/math.mjs');const shoulders=bodyWarps(handles,'shoulder',60);assert.ok(shoulders[0].to.x>20&&shoulders[1].to.x<80);const height=bodyWarps([{x:50,y:10},{x:50,y:100}],'height',40);assert.equal(height[0].from.x,height[0].to.x);assert.ok(height[0].to.y>height[0].from.y);});

test('long-photo and magazine compositions have non-overlapping native photo slots',()=>{for(const layout of ['long','magazine']){const slots=m.collageSlots(1200,layout==='long'?3600:1500,layout,24);assert.equal(slots.length,3);for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++){const a=slots[i],b=slots[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);}if(layout==='magazine')assert.ok(slots[0].height>slots[1].height);}});

test('Phase 2 faceMeshWarps generates localized mesh warps for all 9 facial features and respects freeze protection',async()=>{
 const {RESHAPE_PRESETS,manualReshapePreset}=await import('../src/js/studio/reshape-presets.mjs');
 for(const id of ['face','chin','jawline','cheekbone','eyes','nose','lips','forehead','ratio']){
  assert.ok(RESHAPE_PRESETS[id],`preset ${id} exists`);
  const p=manualReshapePreset(id);
  assert.ok(['pinch','bulge','push'].includes(p.mode));
  const warps=m.faceMeshWarps([{x:120,y:200},{x:280,y:200}],id,50,3);
  assert.ok(warps.length>=1,`faceMeshWarps produces warps for ${id}`);
  assert.ok(warps.every(w=>w.freezeCount===3&&w.radius>0));
 }
 // Distant background point outside local mesh radius is completely unaffected
 const jawWarps=m.faceMeshWarps([{x:140,y:200},{x:260,y:200}],'jawline',60,0);
 assert.deepEqual(m.warpSample({x:10,y:10},jawWarps),{x:10,y:10});
 // Frozen point inside the mesh is completely protected
 assert.deepEqual(m.warpSample({x:140,y:200},jawWarps,()=>1),{x:140,y:200});
});
