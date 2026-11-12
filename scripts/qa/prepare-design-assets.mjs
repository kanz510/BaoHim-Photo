import {createCanvas,loadImage} from '@napi-rs/canvas';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {RasterService} from '../../src/js/studio/raster-service.mjs';
import {icon} from '../../src/js/studio/icons.mjs';
await mkdir('work/pro-v2/design-assets',{recursive:true});
const image=await loadImage('assets/photos/portrait.jpg'),raster=new RasterService({canvas:(w,h)=>createCanvas(w,h)});
for(const preset of ['rose','amber','silver']){const c=await raster.render(image,{preset,intensity:100},{edge:240});await writeFile('work/pro-v2/design-assets/look-'+preset+'.jpg',c.toBuffer('image/jpeg'));c.width=1;}
const names=['beauty','sliders','filters','reshape','makeup','text','sticker','collage','template','layers','crop','brush','frame','undo','redo','fit','close','plus','chevronLeft','chevronRight','arrowRight','arrowUpRight','eye','eyeOff','folder','shield','sun','smooth','clone','eraser','check','more','heart','pinch','expand','arrowDown'];
await writeFile('work/pro-v2/design-assets/icons.json',JSON.stringify(Object.fromEntries(names.map(name=>[name,icon(name).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" ').replaceAll('currentColor','#242229')]))));
const sources=[...['portrait','sunlight','muse'].map(name=>({name:'photo-'+name,path:'assets/photos/'+name+'.jpg',type:'image/jpeg',license:'Unsplash; existing asset manifest'})),...['rose','amber','silver'].map(name=>({name:'look-'+name,path:'work/pro-v2/design-assets/look-'+name+'.jpg',type:'image/jpeg',license:'Manual parameter grade of licensed Unsplash demo photo'})),...['bloom','sparkle','heart','bow','daisy','star','moon','butterfly','ribbon','petals','sun','pearl','frame','lovely','kiss','cloud'].map(name=>({name:'sticker-'+name,path:'assets/stickers/'+name+'.png',type:'image/png',license:'MIT; original geometry from scripts/assets.mjs'}))];
await writeFile('work/pro-v2/design-assets/sources.json',JSON.stringify(sources,null,2));console.log('Prepared public licensed assets only: '+sources.length+' images and '+names.length+' original icons. No screenshot or project data.');
