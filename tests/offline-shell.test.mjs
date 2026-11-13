import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const script=await readFile(new URL('../dist/service-worker.js',import.meta.url),'utf8');
function worker({offline=false}={}){const handlers={},stats={fetches:0};vm.runInNewContext(script,{URL,Response,fetch:async()=>{stats.fetches++;if(offline)throw new Error('Offline');return new Response('latest-v2');},caches:{match:async()=>new Response('cached-v2')},self:{location:{origin:'https://beauty.test'},addEventListener:(type,fn)=>handlers[type]=fn}});return {stats,async request(path,mode='navigate'){let promise;handlers.fetch({request:{method:'GET',url:'https://beauty.test'+path,mode},respondWith:value=>promise=value});return (await promise).text();}};}
test('online navigation receives the current preview instead of a stale cached page',async()=>{const w=worker();assert.equal(await w.request('/v2.html'),'latest-v2');assert.equal(w.stats.fetches,1);});
test('offline navigation reopens the cached editing app',async()=>{const w=worker({offline:true});assert.equal(await w.request('/v2.html'),'cached-v2');});
test('immutable app assets continue to use the local cache first',async()=>{const w=worker();assert.equal(await w.request('/studio.hash.js','cors'),'cached-v2');assert.equal(w.stats.fetches,0);});
test('CJK and downloadable fonts are runtime-cached under GitHub Pages base paths',async()=>{
 const handlers={},putCalls=[];
 const sw=await readFile(new URL('../dist/service-worker.js',import.meta.url),'utf8');
 vm.runInNewContext(sw,{
  URL,Response,
  fetch:async()=>new Response('font-binary',{status:200}),
  caches:{match:async()=>null,open:async name=>({put:(req,res)=>putCalls.push({name,url:req.url})})},
  self:{location:{origin:'https://kanz510.github.io',pathname:'/BaoHim-Photo/service-worker.js'},addEventListener:(type,fn)=>handlers[type]=fn}
 });
 let promise,waitPromise;
 handlers.fetch({
  request:{method:'GET',url:'https://kanz510.github.io/BaoHim-Photo/assets/fonts/NotoSansSC.woff2',mode:'cors'},
  respondWith:v=>promise=v,
  waitUntil:v=>waitPromise=v
 });
 assert.equal(await(await promise).text(),'font-binary');
 await waitPromise;
 assert.equal(putCalls.length,1);
 assert.equal(putCalls[0].name,'pbs-fonts-v1');
});

test('production build publishes an explicit V5 release and unique bundle hash',async()=>{
 const version=JSON.parse(await readFile(new URL('../dist/version.json',import.meta.url),'utf8'));
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.equal(version.version,'5.0.0');
 assert.match(version.build,/^[a-zA-Z0-9._-]{5,64}$/);
 assert.match(version.bundle,/^studio\.[a-f0-9]{12}\.js$/);
 assert.ok(html.includes('name="app-version" content="5.0.0"'));
 assert.ok(html.includes('name="app-build" content="'+version.build+'"'));
 assert.ok(html.includes('src="./'+version.bundle+'"'));
 assert.ok(!html.includes('__APP_VERSION__'));
});

test('release manifest checks are network-first and fall back offline',async()=>{
 const online=worker();
 assert.equal(await online.request('/version.json','cors'),'latest-v2');
 assert.equal(online.stats.fetches,1,'online check must not return a stale cached version');
 const offline=worker({offline:true});
 assert.equal(await offline.request('/version.json','cors'),'cached-v2');
});

test('an installed update waits for explicit consent before replacing active clients',async()=>{
 const handlers={};let skips=0,installed=null;
 vm.runInNewContext(script,{
  URL,Response,fetch:async()=>new Response('ok'),
  caches:{open:async()=>({addAll:async()=>{}})},
  self:{location:{origin:'https://beauty.test',pathname:'/service-worker.js'},addEventListener:(type,cb)=>handlers[type]=cb,skipWaiting:()=>{skips++;}}
 });
 handlers.install({waitUntil:p=>{installed=p;}});
 await installed;
 assert.equal(skips,0,'install must not interrupt an existing editing session');
 handlers.message({data:{type:'SKIP_WAITING'}});
 assert.equal(skips,1,'explicit update action activates the waiting worker');
});
