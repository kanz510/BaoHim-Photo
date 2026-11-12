import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
let hosting=null;try{hosting=JSON.parse(await readFile(resolve(root,'.openai/hosting.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(hosting&&hosting.static?.directory!=='dist')throw new Error('Invalid optional static hosting directory');
const index=await readFile(resolve(root,'dist/index.html'),'utf8');
for(const match of index.matchAll(/(?:src|href)="\.\/([^"#]+)"/g))await stat(resolve(root,'dist',match[1]));
const inventory=JSON.parse(await readFile(resolve(root,'dist/assets/manifest.json'),'utf8'));
for(const entry of inventory.entries){if(!entry.license||!entry.source)throw new Error('Missing asset license');await stat(resolve(root,'dist/assets',entry.file));}
console.log(`Static entrypoint and ${inventory.entries.length} licensed asset entries checked.`);
