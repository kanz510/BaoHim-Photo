import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),sections=[];
const add=(name,text)=>sections.push(`${name}\n${'='.repeat(60)}\n${text}\n`);
add('PHOTO BEAUTY STUDIO — original additions, MIT; upstream miniPaint MIT',await readFile(resolve(root,'MIT-LICENSE.txt'),'utf8'));
for(const file of await readdir(resolve(root,'assets/licenses')))add(file,await readFile(resolve(root,'assets/licenses',file),'utf8'));
const filters=await readFile(resolve(root,'src/js/libs/imagefilters.js'),'utf8');
for(const comment of filters.match(/\/\*[\s\S]*?\*\//g)||[])if(/copyright|permission/i.test(comment))add('ImageFilters retained algorithm notice',comment);
const color=await readFile(resolve(root,'src/js/libs/color-thief.js'),'utf8');
for(const comment of color.match(/\/\*[\s\S]*?\*\//g)||[])if(/copyright|license/i.test(comment))add('Color Thief / quantize retained notice',comment);
add('Color Thief / quantize MIT terms','Copyright 2011, 2015 Lokesh Dhakar\nCopyright 2008 Nick Rabinowitz\n'+await readFile(resolve(root,'assets/licenses/glfx-MIT.txt'),'utf8'));
const lock=JSON.parse(await readFile(resolve(root,'package-lock.json'),'utf8'));
for(const [path,info] of Object.entries(lock.packages)){
 if(!path||info.dev)continue;
 const dir=resolve(root,path);let names=[];try{names=await readdir(dir);}catch{continue;}
 for(const file of names.filter(name=>/^(license|licence|copying|notice)(\.|$)/i.test(name)))try{add(`${path} @ ${info.version} — ${file}`,await readFile(resolve(dir,file),'utf8'));}catch{}
}
await writeFile(resolve(root,'THIRD_PARTY_NOTICES.txt'),sections.join('\n'));
console.log(`Preserved ${sections.length} dependency and source notice sections.`);
