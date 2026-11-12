import {test} from 'node:test';
import assert from 'node:assert/strict';
const view=await import('../src/js/studio/mobile-layout.mjs').catch(()=>({}));
test('mobile fit contains very wide and high-resolution photos without a minimum zoom floor',()=>{
 for(const [w,h,vw,vh] of [[20000,3000,390,530],[6048,8064,440,650],[1200,1500,440,640]]){
  const z=view.containScale?.(w,h,vw,vh,12);assert.ok(z>0);assert.ok(w*z<=vw-24+.001);assert.ok(h*z<=vh-24+.001);
 }
 assert.ok(view.containScale(20000,3000,390,530,12)<.03);
});
test('sheet detents leave an image area on portrait and landscape viewports',()=>{
 for(const h of [956,600,390]){const stops=view.sheetStops?.(h,60,80);assert.ok(stops);assert.ok(stops.peek<=stops.compact&&stops.compact<=stops.expanded);assert.ok(h-60-80-stops.expanded>=100);}
});
