import test from 'node:test';
import assert from 'node:assert/strict';
import {HUB_TTL_MS,hubOnline,registerHub,touchHub,releaseHub,requestHubPrint,hubJobs} from '../lib/print-hub.ts';

const now='2026-10-19T12:00:00.000Z';
const after=ms=>new Date(Date.parse(now)+ms).toISOString();
const job=(id,destination='waiter',employeeId='ana')=>({id,orderId:id,destination,employeeId,content:'MAESTRIA\nNOVO PEDIDO\nMesa 1',status:'queued',createdAt:now});
function fixture(){
 return {name:'Barraca',location:'Praia',service:10,tables:[],products:[],orders:[],payments:[],employees:[],processed:[],printer:{enabled:false,mode:'waiter',relayEnabled:true},printJobs:[job('a'),job('b','waiter','bia'),job('k','kitchen')]};
}

test('central mantém uma única sessão viva e pode ser assumida após 20 segundos',()=>{
 const state=fixture();
 assert.equal(hubOnline(state,now),false);
 assert.equal(HUB_TTL_MS,20000);
 const first=registerHub(state,'android',now);
 assert.equal(hubOnline(state,after(19999)),true);
 assert.throws(()=>registerHub(state,'notebook',after(19999)),/Outro aparelho/);
 assert.equal(state.printer.hub,first);
 assert.equal(hubOnline(state,after(20000)),false);
 const second=registerHub(state,'notebook',after(20000));
 assert.equal(second.deviceId,'notebook');
 assert.equal(second.startedAt,after(20000));
 assert.throws(()=>touchHub(state,'android',after(20001)),/não é mais/);
 releaseHub(state,'android');
 assert.equal(state.printer.hub.deviceId,'notebook');
 releaseHub(state,'notebook');
 assert.equal(state.printer.hub,undefined);
 assert.throws(()=>touchHub(state,'notebook',after(20002)),/não é mais/);
});

test('renovar sessão preserva corte inicial; nova sessão depois da expiração começa agora',()=>{
 const state=fixture();
 registerHub(state,'android',now);
 touchHub(state,'android',after(10000));
 assert.equal(state.printer.hub.startedAt,now);
 assert.equal(registerHub(state,'android',after(15000)).startedAt,now);
 assert.equal(hubOnline(state,after(34999)),true);
 assert.equal(registerHub(state,'android',after(35000)).startedAt,after(35000));
 assert.equal(hubOnline(state,'not a date'),false);
 assert.equal(hubOnline(state,after(34000)),false);
 assert.throws(()=>registerHub(state,'','invalid'),/inválida/);
 assert.throws(()=>touchHub(state,'android','invalid'),/Horário/);
});

test('garçom encaminha somente suas próprias comandas usando identidade autenticada',()=>{
 const state=fixture();registerHub(state,'android',now);
 const before=structuredClone(state);
 for(const [id,role,employee] of [['b','waiter','ana'],['a','waiter',undefined],['k','waiter','ana'],['a','cashier','ana'],['a','kitchen',undefined],['missing','owner',undefined]]){
  assert.throws(()=>requestHubPrint(state,id,role,employee,now),/não pode/);
 }
 assert.deepEqual(state,before);
 const sent=requestHubPrint(state,'a','waiter','ana',now);
 assert.equal(sent.status,'queued');
 assert.deepEqual(sent.relay,{hubId:'android',requestedAt:now,requestedBy:'ana'});
 assert.equal(requestHubPrint(state,'b','owner',undefined,now).relay.hubId,'android');
 assert.equal(requestHubPrint(state,'k','kitchen',undefined,now).relay.hubId,'android');
});

test('encaminhamento exige central viva e autorização do dono; repetição é idempotente',()=>{
 const state=fixture();
 assert.throws(()=>requestHubPrint(state,'a','owner',undefined,now),/desconectada/);
 registerHub(state,'android',now);
 state.printer.relayEnabled=false;
 assert.throws(()=>requestHubPrint(state,'a','owner',undefined,now),/responsável/);
 state.printer.relayEnabled=true;
 const first=requestHubPrint(state,'a','waiter','ana',now);
 const relay=first.relay;
 const next=requestHubPrint(state,'a','owner',undefined,after(1000));
 assert.equal(next,first);
 assert.equal(next.relay,relay);
 assert.equal(next.relay.requestedAt,now);
 assert.equal(next.relay.requestedBy,'ana');
 assert.throws(()=>requestHubPrint(state,'a','owner',undefined,after(20000)),/desconectada/);
 registerHub(state,'notebook',after(20000));
 const retarget=requestHubPrint(state,'a','waiter','ana',after(20001));
 assert.equal(retarget.relay.hubId,'notebook');
 assert.equal(retarget.relay.requestedAt,after(20001));
});

test('central não reenvia comanda em andamento, enviada, incerta ou concluída',()=>{
 for(const status of ['printing','sent','uncertain','printed','failed']){
  const state=fixture();registerHub(state,'android',now);
  state.printJobs[0].status=status;
  assert.throws(()=>requestHubPrint(state,'a','owner',undefined,now),/Confira o papel/);
  assert.equal(state.printJobs[0].relay,undefined);
  assert.equal(state.printJobs[0].status,status);
 }
});

test('pedido cancelado bloqueia preparo, mas permite comanda explícita de cancelamento',()=>{
 const state=fixture();registerHub(state,'android',now);
 state.orders=[{id:'a',status:'cancelled'}];
 assert.throws(()=>requestHubPrint(state,'a','owner',undefined,now),/cancelado/);
 state.printJobs[0].content='MAESTRIA\nCANCELAMENTO\nMesa 1';
 assert.equal(requestHubPrint(state,'a','waiter','ana',now).relay.hubId,'android');
});

test('fila da central isola garçons e inclui impressão ativa para manter exclusão mútua',()=>{
 const state=fixture();registerHub(state,'android',now);
 requestHubPrint(state,'a','waiter','ana',now);
 state.printJobs[0].status='printing';
 state.printJobs[1].relay={hubId:'notebook',requestedAt:now};
 assert.deepEqual(hubJobs(state,'android',now).map(j=>j.id),['a']);
 state.printer.mode='kitchen';
 assert.deepEqual(hubJobs(state,'android',now).map(j=>j.id),['a','k']);
 state.printJobs.push({...job('legacy'),destination:undefined,status:'printing'});
 assert.deepEqual(hubJobs(state,'android',now).map(j=>j.id),['a','k','legacy']);
 state.printer.relayEnabled=false;
 assert.deepEqual(hubJobs(state,'android',now).map(j=>j.id),['k','legacy']);
 assert.throws(()=>hubJobs(state,'notebook',now),/não é mais/);
 assert.throws(()=>hubJobs(state,'android',after(20000)),/não é mais/);
});
