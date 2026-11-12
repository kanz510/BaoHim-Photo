import {createCanvas} from '@napi-rs/canvas';
import {RasterService} from '../src/js/studio/raster-service.mjs';
const source=createCanvas(960,1280),ctx=source.getContext('2d');ctx.fillStyle='#967b82';ctx.fillRect(0,0,960,1280);
const strokes=Array.from({length:100},(_,i)=>({from:{x:350+(i%10)*20,y:450+Math.floor(i/10)*20},to:{x:355+(i%10)*20,y:450+Math.floor(i/10)*20},radius:70,strength:.35,mode:'push',freezeCount:0}));
const raster=indexedWarp=>new RasterService({canvas:(w,h)=>createCanvas(w,h),indexedWarp}),a=raster(false),b=raster(true),times={reference:[],indexed:[]};
for(let round=-1;round<5;round++)for(const [name,service] of [['reference',a],['indexed',b]]){const start=performance.now(),out=await service.render(source,{warps:strokes},{edge:1280});if(round>=0)times[name].push(Math.round(performance.now()-start));out.width=1;global.gc?.();}
const median=x=>[...x].sort((a,b)=>a-b)[Math.floor(x.length/2)];
console.log(JSON.stringify({environment:'Node 24 + Skia, CPU, synthetic 960×1280, 100 dense warps, 1 warm-up + 5 alternating samples; not Safari',samplesMs:times,medianMs:{reference:median(times.reference),indexed:median(times.indexed)}},null,2));
