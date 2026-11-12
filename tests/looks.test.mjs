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
