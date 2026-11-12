import {createCanvas,loadImage,GlobalFonts} from '@napi-rs/canvas';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {icon} from '../src/js/studio/icons.mjs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'assets/stickers');await mkdir(out,{recursive:true});
GlobalFonts.registerFromPath(resolve(root,'assets/fonts/Manrope.ttf'),'Manrope');
GlobalFonts.registerFromPath(resolve(root,'assets/fonts/PlayfairDisplay.ttf'),'Playfair Display');
const flower=(count,color,rad=63)=>Array.from({length:count},(_,i)=>`<ellipse cx="128" cy="${128-rad}" rx="28" ry="${rad}" fill="${color}" transform="rotate(${i*360/count} 128 128)"/>`).join('');
const star=(n,r1,r2,color)=>`<polygon fill="${color}" points="${Array.from({length:n*2},(_,i)=>{const a=i*Math.PI/n-Math.PI/2,r=i%2?r2:r1;return `${128+Math.cos(a)*r},${128+Math.sin(a)*r}`;}).join(' ')}"/>`;
const shapes={
 bloom:flower(6,'#d894b0',67)+'<circle cx="128" cy="128" r="24" fill="#fff4e7"/>',
 sparkle:'<path fill="#c6a178" d="M128 12Q139 111 239 128Q139 139 128 244Q115 140 17 128Q114 113 128 12Z"/><circle cx="213" cy="41" r="10" fill="#e8c99f"/>',
 heart:'<path d="M128 221C116 209 25 149 25 84C25 23 100 12 128 67C159 12 232 23 232 84C232 146 145 208 128 221Z" fill="#cf829d"/><path d="M57 86c0-25 20-35 35-28" fill="none" stroke="#f6d5df" stroke-width="10" stroke-linecap="round"/>',
 bow:'<path d="M117 119C26 17 4 51 42 157L112 143L78 235L130 196L173 235L150 143L220 157C257 47 226 21 139 119Z" fill="#dfa6bb"/><ellipse cx="129" cy="131" rx="24" ry="29" fill="#c87f9b"/><path d="m49 85 61 43m98-45-60 47" fill="none" stroke="#edc4d2" stroke-width="7"/>',
 daisy:flower(11,'#f1dfbf',69)+'<circle cx="128" cy="128" r="35" fill="#d2aa6c"/><circle cx="119" cy="117" r="9" fill="#e5c08b"/>',
 star:star(5,112,52,'#cfb086'),
 moon:'<path d="M170 20A109 109 0 1 0 235 160C145 190 92 99 170 20Z" fill="#d2b695"/>'+star(4,19,4,'#b3859c').replaceAll('128','211'),
 butterfly:'<path d="M124 127C66-12-13 31 34 132C-5 214 66 246 121 151M135 127C197-14 273 33 224 132C269 216 196 246 136 151" fill="#c4a6c9"/><path d="m127 116-13-35m18 35 15-35m-20 36v62" stroke="#947297" stroke-width="7" stroke-linecap="round"/>',
 ribbon:'<path d="M18 76h220v92H18zM18 91 0 72v113l33-24m205-70 18-19v113l-33-24" fill="#d1b0bc"/><path d="M31 93h194v58H31z" fill="none" stroke="#ead5dc" stroke-width="3"/>',
 petals:flower(4,'#d5bdc9',72)+'<circle cx="128" cy="128" r="14" fill="#f7ede8"/>',
 sun:star(16,112,84,'#dec59d')+'<circle cx="128" cy="128" r="64" fill="#eddbb9"/><circle cx="108" cy="121" r="5" fill="#bd9767"/><circle cx="149" cy="121" r="5" fill="#bd9767"/><path d="M109 147q18 16 39 0" fill="none" stroke="#bd9767" stroke-width="5" stroke-linecap="round"/>',
 pearl:Array.from({length:18},(_,i)=>{const a=i*Math.PI/9;return `<circle cx="${128+94*Math.cos(a)}" cy="${128+94*Math.sin(a)}" r="14" fill="#e8d9ce" stroke="#d5c0b4" stroke-width="1"/>`;}).join(''),
 frame:'<rect x="16" y="16" width="224" height="224" rx="40" fill="none" stroke="#d3a0b5" stroke-width="9"/><rect x="27" y="27" width="202" height="202" rx="32" fill="none" stroke="#edd4e0" stroke-width="3"/>',
 kiss:'<path d="M18 119Q71 49 123 90Q176 39 238 119Q169 218 127 181Q75 219 18 119Z" fill="#be6c82"/><path d="M18 119q105 62 220 0" fill="none" stroke="#8e4e65" stroke-width="8"/>',
 cloud:'<path d="M54 191C-6 191 4 113 51 112C41 25 153 11 176 91C241 68 274 190 208 191Z" fill="#e7dfe9"/><path d="M78 202v25m37-24v34m40-34v24" stroke="#d8bbce" stroke-width="8" stroke-linecap="round"/>'
};
for(const [id,body] of Object.entries(shapes)){const image=await loadImage(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">${body}</svg>`));const c=createCanvas(256,256);c.getContext('2d').drawImage(image,0,0);await writeFile(resolve(out,id+'.png'),c.toBuffer('image/png'));}
const c=createCanvas(360,150),ctx=c.getContext('2d');ctx.font='italic 76px "Playfair Display"';ctx.fillStyle='#b78199';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('lovely',180,77);await writeFile(resolve(out,'lovely.png'),c.toBuffer('image/png'));
const brand=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 256 256"><rect width="256" height="256" rx="56" fill="#fff9f7"/><g transform="translate(31 31) scale(.76)">${flower(8,'#d894ac',72)}<circle cx="128" cy="128" r="17" fill="#fff7f3"/></g></svg>`;
await writeFile(resolve(root,'assets/icon.svg'),brand);const app=await loadImage(Buffer.from(brand)),ac=createCanvas(512,512);ac.getContext('2d').drawImage(app,0,0);await writeFile(resolve(root,'assets/app-icon.png'),ac.toBuffer('image/png'));
const uiDir=resolve(root,'assets/ui-icons');await mkdir(uiDir,{recursive:true});
const aliases={'arrow-down':'chevronDown',view:'eye',delete:'trash',select:'pointer',selection:'crop',pencil:'brush',erase:'eraser',pick_color:'sun',bulge_pinch:'reshape',shape:'heart',refresh:'reset',blur:'smooth',sharpen:'sliders',desaturate:'filters',menu:'more',external:'arrowRight'};
const uiFiles=(await readdir(resolve(root,'images/icons'))).filter(f=>!['animation.svg','media.svg'].includes(f));
for(const file of uiFiles){const id=file.replace(/\.[^.]+$/,''),svg=icon(aliases[id]||id).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" ').replaceAll('currentColor','#5a4a53');
 if(file.endsWith('.svg'))await writeFile(resolve(uiDir,file),svg);else{const image=await loadImage(Buffer.from(svg)),c=createCanvas(24,24);c.getContext('2d').drawImage(image,0,0);await writeFile(resolve(uiDir,file),c.toBuffer('image/png'));}}
const entries=[];for(const file of [...Object.keys(shapes).map(id=>'stickers/'+id+'.png'),'stickers/lovely.png','photos/portrait.jpg','photos/sunlight.jpg','photos/muse.jpg','fonts/Manrope.ttf','fonts/PlayfairDisplay.ttf','fonts/DancingScript.ttf','fonts/Lora.ttf','icon.svg','app-icon.png',...uiFiles.map(f=>'ui-icons/'+f)]){const data=await readFile(resolve(root,'assets',file));entries.push({file,author:file.startsWith('photos/')?null:file.includes('Manrope')?'Manrope Project Authors':file.includes('Playfair')?'Playfair Display Project Authors':file.includes('DancingScript')?'Dancing Script Project Authors':file.includes('Lora')?'Lora Project Authors':'PHOTO BEAUTY STUDIO',sha256:createHash('sha256').update(data).digest('hex'),license:file.startsWith('photos/')?'Unsplash License':file.startsWith('fonts/')?'SIL Open Font License 1.1':'MIT',source:file==='photos/portrait.jpg'?'https://images.unsplash.com/photo-1534528741775-53994a69daeb':file==='photos/sunlight.jpg'?'https://images.unsplash.com/photo-1524504388940-b1c1722653e1':file==='photos/muse.jpg'?'https://images.unsplash.com/photo-1517841905240-472988babdf9':file.startsWith('fonts/')?'https://github.com/google/fonts':'Original vector geometry; scripts/assets.mjs'});}
await writeFile(resolve(root,'assets/manifest.json'),JSON.stringify({version:1,entries},null,2));console.log('Generated 16 original vector stickers and application icons.');
