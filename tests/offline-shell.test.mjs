import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const script=await readFile(new URL('../dist/service-worker.js',import.meta.url),'utf8');
function worker({offline=false}={}){const handlers={},stats={fetches:0};vm.runInNewContext(script,{URL,Response,fetch:async()=>{stats.fetches++;if(offline)throw new Error('Offline');return new Response('latest-v2');},caches:{match:async()=>new Response('cached-v2')},self:{location:{origin:'https://beauty.test'},addEventListener:(type,fn)=>handlers[type]=fn}});return {stats,async request(path,mode='navigate'){let promise;handlers.fetch({request:{method:'GET',url:'https://beauty.test'+path,mode},respondWith:value=>promise=value});return (await promise).text();}};}
test('online navigation receives the current preview instead of a stale cached page',async()=>{const w=worker();assert.equal(await w.request('/v2.html'),'latest-v2');assert.equal(w.stats.fetches,1);});
test('offline navigation reopens the cached editing app',async()=>{const w=worker({offline:true});assert.equal(await w.request('/v2.html'),'cached-v2');});
test('immutable app assets continue to use the local cache first',async()=>{const w=worker();assert.equal(await w.request('/studio.hash.js','cors'),'cached-v2');assert.equal(w.stats.fetches,0);});
