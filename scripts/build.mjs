import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir,cp,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
const root=resolve(import.meta.dirname,'..');
await mkdir(resolve(root,'dist'),{recursive:true});
const notices=spawnSync(process.execPath,[resolve(root,'scripts/notices.mjs')],{cwd:root,stdio:'inherit'});if(notices.status!==0)process.exit(notices.status||1);
for(const file of await readdir(resolve(root,'dist')))if(/^studio-[a-z0-9_-]+\.[a-f0-9]{12}\.js(?:\.map|\.LICENSE\.txt)?$/i.test(file)||/\.LICENSE\.txt$/i.test(file))await rm(resolve(root,'dist',file));
const result=spawnSync(process.execPath,[resolve(root,'node_modules/webpack/bin/webpack.js'),'--mode','production'],{cwd:root,stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
for(const file of await readdir(resolve(root,'dist')))if(/\.LICENSE\.txt$/i.test(file))await rm(resolve(root,'dist',file));
const bundle=await readFile(resolve(root,'dist/bundle.js')),bundleName='studio.'+createHash('sha256').update(bundle).digest('hex').slice(0,12)+'.js';
for(const file of await readdir(resolve(root,'dist')))if(/^studio\.[a-f0-9]{12}\.js$/.test(file)||/^v2\.[a-f0-9]{12}\.html$/.test(file))await rm(resolve(root,'dist',file));
await writeFile(resolve(root,'dist',bundleName),bundle);await rm(resolve(root,'dist/bundle.js'));
const appVersion=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version;
const gitHead=spawnSync('git',['rev-parse','--short=12','HEAD'],{cwd:root,encoding:'utf8'});
const buildId=String(process.env.GITHUB_SHA||gitHead.stdout?.trim()||bundleName.split('.')[1]).slice(0,12);
const html=(await readFile(resolve(root,'index.html'),'utf8'))
 .replace('src="./bundle.js"','src="./'+bundleName+'"')
 .replaceAll('__APP_VERSION__',appVersion)
 .replaceAll('__APP_BUILD__',buildId);
await writeFile(resolve(root,'dist/version.json'),JSON.stringify({version:appVersion,build:buildId,bundle:bundleName},null,2)+'\n');
await writeFile(resolve(root,'dist/index.html'),html);await writeFile(resolve(root,'dist/v2.html'),html);await writeFile(resolve(root,'dist','v2.'+bundleName.split('.')[1]+'.html'),html);
await cp(resolve(root,'assets'),resolve(root,'dist/assets'),{recursive:true});
await rm(resolve(root,'dist/images/icons'),{recursive:true,force:true});await mkdir(resolve(root,'dist/images'),{recursive:true});await cp(resolve(root,'assets/ui-icons'),resolve(root,'dist/images/icons'),{recursive:true});
for(const file of ['manifest.json','licenses.html','v2-report.html','THIRD_PARTY_NOTICES.txt','MIT-LICENSE.txt'])await cp(resolve(root,file),resolve(root,'dist',file));
await rm(resolve(root,'dist/bundle.js.map'),{force:true});
async function files(dir){const all=[];for(const f of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,f.name);if(f.isDirectory())all.push(...await files(path));else all.push('./'+relative(resolve(root,'dist'),path).replaceAll('\\','/'));}return all;}
const precache=(await files(resolve(root,'dist'))).filter(f=>!['./service-worker.js','./asset-inventory.json'].includes(f)&&!/^\.\/assets\/fonts\/NotoSans/.test(f)&&!f.startsWith('./assets/qa/')).sort();
const digest=createHash('sha256');for(const file of precache)digest.update(file).update(await readFile(resolve(root,'dist',file)));
const revision=digest.digest('hex').slice(0,12);
const swTemplate=await readFile(resolve(root,'scripts/service-worker.template.js'),'utf8');
const worker=swTemplate.replaceAll('__CACHE__','pbs-'+revision).replace('__FILES__',JSON.stringify(['./',...precache]));
await writeFile(resolve(root,'dist/service-worker.js'),worker);
await writeFile(resolve(root,'dist/asset-inventory.json'),JSON.stringify({revision,files:precache},null,2));
console.log(`Studio static build: ${precache.length} offline resources, revision ${revision}`);
