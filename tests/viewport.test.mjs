import {test} from 'node:test';
import assert from 'node:assert/strict';
const {Viewport}=await import('../src/js/studio/viewport.mjs').catch(()=>({}));
test('viewport zoom preserves its anchor and screen/world coordinates round trip',()=>{
 assert.ok(Viewport);const view=new Viewport();view.setContext({canvas:{width:800,height:600},setTransform(){}});view.setBounds(0,0,1600,1200);
 const anchor=view.toWorld(400,300);view.scaleAt(400,300,2);assert.deepEqual(view.toWorld(400,300),anchor);
 assert.deepEqual(view.toScreen(view.toWorld(510,220)),{x:510,y:220});
 view.move(100000,100000);assert.deepEqual(view.toWorld(0,0),{x:0,y:0});
});
test('retina backing dimensions never change logical zoom or touch coordinates',()=>{
 const transforms=[],v=new Viewport();v.setContext({canvas:{width:1200,height:1500,studioViewportWidth:400,studioViewportHeight:500,studioPixelRatio:3},setTransform:(...m)=>transforms.push(m)});v.setBounds(0,0,1200,1500);
 assert.equal(v.getMaxScale(),1/3);v.scale=1/3;v.apply();assert.deepEqual(transforms.at(-1),[1,0,0,1,0,0]);
 assert.deepEqual(v.toWorld(200,250),{x:600,y:750});const anchor=v.toWorld(100,120);v.scaleAt(100,120,2);v.apply();assert.deepEqual(v.toWorld(100,120),anchor);v.canvasDefault();assert.deepEqual(transforms.at(-1),[3,0,0,3,0,0]);
});
