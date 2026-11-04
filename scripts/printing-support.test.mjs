import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createState} from '../lib/domain.ts';
import {parsePrinterDiagnostic,savePrinterDiagnostic,diagnosticBrowser} from '../lib/printer-diagnostics.ts';
import {publicWorkspace} from '../lib/workspace-view.ts';
import {readWorkspaceAction,WorkspaceRequestError} from '../lib/workspace-request.ts';
import {claimLocalJob,touchLocalJob} from '../lib/local-print-queue.ts';
import {withPrintLease} from '../lib/print-lease.ts';
import {portableReceiptFlow,preferredReceiptMethod} from '../lib/print-method.ts';
import {getPrinterCapabilities} from '../lib/printer-capabilities.ts';

const report={platform:'ios',browser:'bluefy',secureContext:true,directSerial:false,directBle:true,connected:true,verified:true,transport:'ble',method:'direct',result:'verified'};

test('diagnóstico copia apenas campos permitidos e reserva identidade/data ao servidor',()=>{
 const state=createState('Teste','Praia',1);state.employees=[{id:'waiter',name:'Ana',role:'waiter',active:true}];
 const result=savePrinterDiagnostic(state,{...report,actorId:'forged',receivedAt:'2000',token:'PRIVATE',url:'PRIVATE',orders:['PRIVATE']},'waiter','waiter','2026-11-04T12:00:00Z');
 assert.equal(result.actorId,'waiter');assert.equal(result.receivedAt,'2026-11-04T12:00:00Z');assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
 for(const role of ['owner','waiter','kitchen','cashier'])assert.equal('printerDiagnostics' in publicWorkspace(state,role,'waiter'),false);
 savePrinterDiagnostic(state,{...report,verified:false,result:'test-sent'},'waiter','waiter');assert.equal(state.printerDiagnostics.length,1);
 assert.throws(()=>parsePrinterDiagnostic({...report,connected:false}),/conexão/);
 assert.throws(()=>parsePrinterDiagnostic({...report,browser:'arbitrary PRIVATE'}),/inválido/);
 assert.throws(()=>savePrinterDiagnostic(state,report,'cashier','waiter'),/acesso/);
 state.employees[0].active=false;assert.throws(()=>savePrinterDiagnostic(state,report,'waiter','waiter'),/desativado/);
 assert.equal(diagnosticBrowser('Mozilla Bluefy/1.0'),'bluefy');assert.equal(diagnosticBrowser('SamsungBrowser/25 Chrome/130'),'samsung');
});

const code=ts.transpileModule(readFileSync(new URL('../app/api/printer-diagnostics/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function diagnosticApi({access={owner:'tenant',role:'waiter',employeeId:'waiter'},revoked=false}={}){
 let state=createState('Teste','Praia',1),writes=0;state.employees=[{id:'waiter',name:'Ana',role:'waiter',active:!revoked}];
 const exports={},deps={'@/lib/access':{resolveAccess:async()=>access},'@/lib/db':{readVenue:async owner=>{assert.equal(owner,'tenant');return {state:structuredClone(state),version:1}},saveVenue:async(owner,_version,next)=>{assert.equal(owner,'tenant');state=next;writes++;return true}},'@/lib/saas-billing':{assertSubscription(){}},'@/lib/printer-diagnostics':{savePrinterDiagnostic},'@/lib/workspace-request':{readWorkspaceAction,WorkspaceRequestError}};
 new Function('require','exports',code)(name=>deps[name],exports);
 return {get state(){return state},get writes(){return writes},post:async({origin='https://test.local',body={type:'report',report}}={})=>exports.POST(new Request('https://test.local/api/printer-diagnostics',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}))};
}
test('API de diagnóstico valida origem, função e revogação atual antes de salvar',async()=>{
 for(const options of [{access:null},{access:{role:'cashier'}},{revoked:true}]){const api=diagnosticApi(options);assert.notEqual((await api.post()).status,200);assert.equal(api.writes,0)}
 const api=diagnosticApi();assert.equal((await api.post({origin:'https://outside.test'})).status,403);assert.equal(api.writes,0);
 assert.equal((await api.post({body:{type:'report',report,padding:'x'.repeat(3000)}})).status,413);assert.equal(api.writes,0);
 const response=await api.post();assert.equal(response.status,200);assert.equal(api.writes,1);assert.equal(api.state.printerDiagnostics[0].actorId,'waiter');assert.equal('report' in await response.json(),false);
});

test('renovação de reserva protege comanda longa e rejeita outro aparelho ou token',()=>{
 const jobs=[{id:'a',orderId:'a',content:'Comanda',status:'queued',createdAt:'2026-11-04T12:00:00Z'}];
 claimLocalJob(jobs,'device','private','2000','2026-11-04T12:00:00Z');
 touchLocalJob(jobs,'device','private','a','2026-11-04T12:01:20Z');
 assert.equal(claimLocalJob(jobs,'other','token','2000','2026-11-04T12:02:00Z'),null);assert.equal(jobs[0].status,'printing');
 assert.throws(()=>touchLocalJob(jobs,'other','private','a'),/reserva/);
 assert.throws(()=>touchLocalJob(jobs,'device','wrong','a'),/reserva/);
 claimLocalJob(jobs,'other','token','2000','2026-11-04T12:03:00Z');assert.equal(jobs[0].status,'uncertain');
 assert.throws(()=>touchLocalJob(jobs,'device','private','a'),/reserva/);
});

test('perda de heartbeat aborta próximos blocos e não registra sucesso, mesmo se transporte resolver',async()=>{
 const interval=globalThis.setInterval,clear=globalThis.clearInterval;let tick,cleared=0,release,signal;
 globalThis.setInterval=callback=>{tick=callback;return 123};globalThis.clearInterval=id=>{assert.equal(id,123);cleared++};
 try{
  const work=withPrintLease(s=>{signal=s;return new Promise(resolve=>{release=resolve})},async()=>{throw Error('Reserva perdida')});
  tick();await new Promise(resolve=>setImmediate(resolve));assert.equal(signal.aborted,true);release('transport-finished');
  await assert.rejects(work,/reserva/);assert.equal(cleared,1);
 }finally{globalThis.setInterval=interval;globalThis.clearInterval=clear}
});

test('conexão direta imprime automaticamente; alternativa Android exige comanda e nunca escolhe RawBT',()=>{
 const android=getPrinterCapabilities({userAgent:'Android Chrome/142',secureContext:true,serial:{requestPort(){}}});
 const ios=getPrinterCapabilities({userAgent:'iPhone Safari',secureContext:true});
 assert.equal(portableReceiptFlow(android,true,true,'openescpos'),'automatic');
 assert.equal(portableReceiptFlow(android,false,false,'openescpos'),'manual');
 assert.equal(portableReceiptFlow(ios,false,false,'openescpos'),'setup');
 assert.equal(portableReceiptFlow(android,true,false,'direct'),'setup');
 assert.notEqual(preferredReceiptMethod(android,false,'rawbt'),'rawbt');
});

test('suspender a aba interrompe o envio e remove listeners ao terminar',async()=>{
 const previous=globalThis.document,documentTarget=new EventTarget();documentTarget.hidden=false;globalThis.document=documentTarget;
 let release,signal;
 try{
  const task=withPrintLease(s=>{signal=s;return new Promise(resolve=>{release=resolve})},async()=>{});
  documentTarget.hidden=true;documentTarget.dispatchEvent(new Event('visibilitychange'));assert.equal(signal.aborted,true);
  release();await assert.rejects(task,/reserva/);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous}
});
