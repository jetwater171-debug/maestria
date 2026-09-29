import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('nova home preserva painel offline e não intercepta APIs nem respostas RSC',async()=>{
 const handlers={},stored=new Map(),deleted=[];let pending,offline=false;
 const cache={put:async(k,v)=>stored.set(k,v),addAll:async paths=>{assert.deepEqual([...paths],['/_next/static/painel.js'])},match:async k=>stored.get(k)};
 const self={location:{origin:'https://maestria.test'},addEventListener:(name,handler)=>{handlers[name]=handler},skipWaiting(){},clients:{claim:async()=>{}}};
 const caches={open:async()=>cache,keys:async()=>['maestria-shell-v1','maestria-shell-v2','outro-app'],delete:async name=>deleted.push(name)};
 const fetch=async path=>{if(offline)throw Error('offline');assert.equal(path,'/painel');return new Response('<script src="/_next/static/painel.js"></script>')};
 vm.runInNewContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),{self,caches,fetch,URL,Error});
 handlers.install({waitUntil:p=>pending=p});await pending;assert.ok(stored.has('/painel'));assert.equal(stored.has('/'),false);
 handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['maestria-shell-v1']);
 offline=true;
 for(const pathname of ['/painel','/painel?cadastro=1','/']){let result;handlers.fetch({request:{url:'https://maestria.test'+pathname,method:'GET',mode:'navigate',headers:new Headers()},respondWith:p=>result=p});assert.equal(await result,stored.get('/painel'))}
 for(const [pathname,headers] of [['/api/workspace',{}],['/painel',{RSC:'1'}]]){let intercepted=false;handlers.fetch({request:{url:'https://maestria.test'+pathname,method:'GET',mode:'navigate',headers:new Headers(headers)},respondWith:()=>{intercepted=true}});assert.equal(intercepted,false)}
});
