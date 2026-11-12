import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS,gradePixels,mergePreset} from '../src/js/studio/math.mjs';
const looks=await import('../src/js/studio/look-catalog.mjs').catch(()=>({}));
test('the V2 color library offers 34 real parameter presets with stable original ids',()=>{
 assert.equal(PRESETS.length,34);assert.equal(new Set(PRESETS.map(p=>p.id)).size,34);
 for(const id of ['original','muse','peach','morning','film','milk','clear','mono','night'])assert.ok(PRESETS.some(p=>p.id===id));
 const input=new Uint8ClampedArray([80,120,160,127]);for(const p of PRESETS){const output=gradePixels(input,mergePreset({},p.id));assert.equal(output[3],127);assert.ok(Object.values(p.params).every(Number.isFinite));}
});
test('saving a look includes color settings and excludes photos and local brush paths',()=>{
 const look=looks.lookFromStudio?.({sourceId:'private-photo',preset:'peach',intensity:65,adjustments:{exposure:.4},strokes:[{points:[{x:1,y:2}]}],warps:[{}]},'My rose');
 assert.ok(look);assert.equal(look.name,'My rose');assert.equal(look.recipe.preset,'peach');assert.equal(look.recipe.intensity,65);assert.equal(look.recipe.sourceId,undefined);assert.equal(look.recipe.strokes,undefined);
 assert.throws(()=>looks.validateLook({...look,recipe:{adjustments:{brightness:Infinity}}}),/look|parameter|preset/i);
});

test('grading can reuse its pixel buffer without changing a channel or alpha',()=>{
 const input=new Uint8ClampedArray([14,83,211,44,240,144,66,190,0,0,0,255]),expected=gradePixels(input,{exposure:.4,contrast:12,saturation:-30,temperature:12}),target=input.slice();const actual=gradePixels(target,{exposure:.4,contrast:12,saturation:-30,temperature:12},target);assert.equal(actual,target);assert.deepEqual(actual,expected);
});

test('Phase 5 supports all 9 filter categories and .cube 3D LUT trilinear interpolation',async()=>{
 const {parseCubeLut,applyCubeLut,BUILTIN_CUBE_LUTS}=await import('../src/js/studio/lut-cube.mjs');
 for(const group of ['ccd','film','vintage','korean','chinese','japanese','cinema','y2k','mono']){
  assert.ok(looks.LOOK_GROUPS.some(([g])=>g===group),`LOOK_GROUPS includes ${group}`);
  assert.ok(PRESETS.some(p=>looks.matchesLookGroup(p,group)),`PRESETS has looks matching ${group}`);
 }
 assert.equal(Object.keys(BUILTIN_CUBE_LUTS).length,4);
 const cubeText=`TITLE "Warm Test"\nLUT_3D_SIZE 2\n0 0 0\n1 0.8 0\n0 1 0\n1 1 0\n0 0 0.8\n1 0.8 0.8\n0 1 0.8\n1 1 0.9`;
 const parsed=parseCubeLut(cubeText);
 assert.equal(parsed.name,'Warm Test');
 assert.equal(parsed.size,2);
 const p=new Uint8ClampedArray([255,0,255,200]);
 const out=applyCubeLut(p,parsed,100);
 assert.equal(out[0],255);
 assert.ok(out[1]>180,'trilinear LUT maps R=1,G=0,B=1 green channel to ~0.8');
 assert.equal(out[3],200,'alpha preserved');
});
