import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {fileURLToPath} from 'node:url';
// Generic 'sans-serif' resolves differently per OS (Windows Skia can pick a glyph-less face). Pixel tests use the bundled OFL face.
GlobalFonts.registerFromPath(fileURLToPath(new URL('../assets/fonts/Manrope.ttf',import.meta.url)),'Manrope');
const t=await import('../src/js/studio/typography.mjs').catch(()=>({}));
test('text layout preserves whole Vietnamese and emoji clusters when wrapping',()=>{
 const ctx=createCanvas(200,100).getContext('2d');
 const layout=t.layoutText?.(ctx,[[{text:'Đẹp 👩🏽‍🎨',meta:{size:20,family:'sans-serif'}}]],300);
 assert.ok(layout,'native text model has an extended layout renderer');
 assert.equal(layout.map(g=>g.text).join(''),'Đẹp 👩🏽‍🎨');
 assert.equal(layout.at(-1).text,'👩🏽‍🎨');
});
test('text renderer produces visible pixels within the native layer transform',()=>{
 const canvas=createCanvas(300,120);t.renderTypography?.(canvas.getContext('2d'),{x:10,y:10,width:280,height:100,rotate:0,params:{halign:'left'},data:[[{text:'Hello',meta:{size:30,family:'sans-serif',fill_color:'#ff0000'}}]],studio:{typography:{arc:0}}});
 const pixels=canvas.getContext('2d').getImageData(0,0,300,120).data;
 assert.ok(pixels.some((v,i)=>i%4===3&&v>0),'text draws actual glyphs');
});
test('both arc directions preserve the visual left-to-right order of colored glyphs',()=>{
 for(const arc of [-80,80]){
  const canvas=createCanvas(240,180),ctx=canvas.getContext('2d'),colors=['#ff0000','#00ff00','#0000ff'];
  t.renderTypography(ctx,{x:10,y:65,width:220,height:90,rotate:0,params:{halign:'center'},data:[['A','B','C'].map((text,i)=>({text,meta:{size:30,family:'sans-serif',fill_color:colors[i]}}))],studio:{typography:{arc}}});
  const data=ctx.getImageData(0,0,240,180).data,centers=[0,1,2].map(channel=>{let sum=0,count=0;for(let i=0;i<data.length;i+=4)if(data[i+3]>100&&data[i+channel]>200&&data[i+(channel+1)%3]<60&&data[i+(channel+2)%3]<60){sum+=(i/4)%240;count++;}assert.ok(count>0);return sum/count;});
  assert.ok(centers[0]<centers[1]&&centers[1]<centers[2],`glyph order for arc ${arc}: ${centers}`);
 }
});
test('gradient typography spans the text layer and keeps a visible blue-to-red color transition',()=>{
 const c=createCanvas(420,130),ctx=c.getContext('2d');t.renderTypography(ctx,{x:10,y:12,width:400,height:105,rotate:0,params:{halign:'left'},data:[[{text:'MMMMMM',meta:{family:'Manrope',size:64,fill_color:'#ffffff'}}]],studio:{typography:{gradient:{enabled:true,from:'#ff0000',to:'#0000ff',angle:0}}}});
 const data=ctx.getImageData(0,0,420,130).data;let left=0,right=0;for(let y=0;y<130;y++)for(let x=0;x<420;x++){const i=(y*420+x)*4;if(data[i+3]>200){if(x<100)left+=data[i]-data[i+2];if(x>240)right+=data[i+2]-data[i];}}
 assert.ok(left>5000&&right>5000);
});

test('glow, dimensional lettering and a speech bubble add real pixels without changing a neutral text recipe',()=>{const layer={x:30,y:30,width:200,height:90,data:[[{text:'Đẹp',meta:{family:'Manrope',size:38,fill_color:'#fff'}}]],studio:{typography:{}}};const draw=ty=>{const c=createCanvas(280,160);t.renderTypography(c.getContext('2d'),{...layer,studio:{typography:ty}});return c.getContext('2d').getImageData(0,0,280,160).data;};const normal=draw({});assert.deepEqual(draw({glow:0,depth:0,bubble:'none'}),normal);assert.notDeepEqual(draw({glow:16}),normal);assert.notDeepEqual(draw({depth:10,depthColor:'#af5b86'}),normal);const bubble=draw({bubble:'speech',bubbleColor:'#f9f6f7'});assert.ok(bubble[(50*280+35)*4+3]>0);assert.notDeepEqual(bubble,normal);});
