import {test} from 'node:test';
import assert from 'node:assert/strict';
import {warpSample,freezeCoverage} from '../src/js/studio/math.mjs';
const index=await import('../src/js/studio/warp-index.mjs').catch(()=>({}));
let seed=12345;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
test('a spatial warp index preserves exact inverse composition including moving between cells and restore',()=>{
 assert.equal(typeof index.buildWarpIndex,'function');
 const strokes=Array.from({length:70},(_,i)=>({from:{x:random()*800,y:random()*1000},to:{x:random()*800,y:random()*1000},radius:20+random()*120,strength:random()*.65,mode:['push','pinch','bulge','restore'][i%4]})),spatial=index.buildWarpIndex(strokes);assert.ok(spatial);
 for(let i=0;i<5000;i++){const p={x:random()*1000-100,y:random()*1200-100};assert.deepEqual(warpSample(p,strokes,()=>.17,spatial),warpSample(p,strokes,()=>.17));}
 assert.equal(index.buildWarpIndex(strokes,{maxEntries:1}),null);
});
test('indexed freeze coverage honors ordered erase, clear and each historical stroke count exactly',()=>{
 assert.equal(typeof index.buildFreezeIndex,'function');
 const freezes=Array.from({length:18},(_,i)=>({radius:25+random()*70,hardness:.4,strength:1,erase:i%4===0,points:Array.from({length:9},()=>({x:random()*500,y:random()*700}))}));freezes.splice(8,0,{clear:true});const coverage=index.buildFreezeIndex(freezes);assert.ok(coverage);
 for(let i=0;i<2500;i++){const p={x:random()*600-50,y:random()*800-50},count=i%20;assert.equal(coverage(p,count),freezeCoverage(p,freezes,count));}
});
