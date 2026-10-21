import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortableAutoPrinter} from '../lib/portable-auto-print.ts';
import {claimLocalJob,finishLocalJob} from '../lib/local-print-queue.ts';

const job=id=>({id,orderId:id,destination:'waiter',employeeId:'employee',status:'queued',createdAt:new Date().toISOString(),content:'SERVER COMANDA '+id});
function rig({jobs=[job('a')],ready=()=>true,write=async()=>{},failClaim=false,failFinish=false}={}){
 const requests=[],writes=[];
 const enqueue=createPortableAutoPrinter({ready,write:async(id,content)=>{writes.push({id,content});await write(id,content)},fetcher:async(_url,init)=>{
  const b=JSON.parse(init.body);requests.push(b);
  if(b.type==='claim'){const claimed=claimLocalJob(jobs,b.deviceId,b.claimToken,b.since,undefined,b.jobId);if(failClaim)throw Error('lost response');return Response.json({job:claimed})}
  if(failFinish)throw Error('lost finish');finishLocalJob(jobs,b.deviceId,b.claimToken,b.jobId,b.success);return Response.json({});
 }});
 return {enqueue,jobs,requests,writes};
}

test('pedido confirmado reserva, imprime conteúdo do servidor e conclui sem botão extra',async()=>{
 const r=rig();const out=await r.enqueue({...r.jobs[0],content:'UNTRUSTED CLIENT TEXT'},'token','owner:one');
 assert.equal(out.status,'sent');assert.deepEqual(r.requests.map(x=>x.type),['claim','finish']);assert.equal(r.writes[0].content,'SERVER COMANDA a');assert.equal(r.jobs[0].status,'sent');assert.equal(r.requests[1].claimToken,r.requests[0].claimToken);
});
test('toque duplo compartilha envio e pedidos rápidos imprimem na ordem, sem concorrência',async()=>{
 let release,entered;const started=new Promise(resolve=>{entered=resolve});const r=rig({jobs:[job('a'),job('b')],write:async id=>{if(id==='a'){entered();await new Promise(resolve=>{release=resolve})}}});
 const first=r.enqueue({...r.jobs[0]},'token','owner:one');const same=r.enqueue({...r.jobs[0]},'token','owner:one');assert.equal(first,same);
 await started;const second=r.enqueue({...r.jobs[1]},'token','owner:one');assert.equal(r.requests.length,1);release();
 assert.equal((await first).status,'sent');assert.equal((await second).status,'sent');assert.deepEqual(r.writes.map(x=>x.id),['a','b']);
});
test('conexão sem teste, pedido já enviado ou de cozinha não dispara escrita nem reserva',async()=>{
 const disconnected=rig({ready:()=>false});assert.equal((await disconnected.enqueue(job('a'),'token','scope')).status,'unavailable');assert.equal(disconnected.requests.length,0);
 for(const candidate of [{...job('a'),destination:'kitchen'},{...job('a'),status:'sent'},{...job('a'),status:'uncertain'}]){const r=rig();assert.equal((await r.enqueue(candidate,'token','scope')).status,'skipped');assert.equal(r.requests.length,0)}
});
test('resposta de reserva perdida não imprime e não tenta novamente automaticamente',async()=>{
 const r=rig({failClaim:true});assert.equal((await r.enqueue(job('a'),'token','scope')).status,'failed');assert.equal(r.writes.length,0);assert.equal(r.jobs[0].status,'printing');assert.equal(r.requests.length,1);
});
test('erro após envio parcial deixa comanda incerta e nunca repete bytes',async()=>{
 const r=rig({write:async()=>{throw Error('partial BLE write')}});assert.equal((await r.enqueue(job('a'),'token','scope')).status,'uncertain');assert.equal(r.jobs[0].status,'uncertain');assert.equal((await r.enqueue(job('a'),'token','scope')).status,'skipped');assert.equal(r.writes.length,1);
});
test('confirmação perdida após impressão não produz segunda via em reenvio do mesmo pedido',async()=>{
 const r=rig({failFinish:true});assert.equal((await r.enqueue(job('a'),'token','scope')).status,'uncertain');assert.equal((await r.enqueue(job('a'),'token','scope')).status,'skipped');assert.equal(r.writes.length,1);
});
