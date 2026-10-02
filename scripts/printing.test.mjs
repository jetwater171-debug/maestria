import test from 'node:test';
import assert from 'node:assert/strict';
import {pollQueue,confirmPrint,ticket} from '../lib/printing.ts';
import {scanRequest,parseScan} from '../lib/scanner.ts';
import {createState,applyAction} from '../lib/domain.ts';
import {androidPrintIntent} from '../lib/android-print.ts';
import {gunzipSync} from 'node:zlib';
import {connectBlePrinter,disconnectBlePrinter,bleAvailable,bleDiagnostic,bleUuid,BLE_PROFILES} from '../lib/ble-printer.ts';
import {printKitchenReceipt} from '../lib/kitchen-printer.ts';

test('BLE iPhone descobre canal autorizado, envia ESC/POS em blocos e limpa desconexão',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator');const writes=[];let disconnected=0;const profile=BLE_PROFILES[0];
 const characteristic={uuid:profile.characteristic,properties:{writeWithoutResponse:true},writeValueWithoutResponse:async bytes=>writes.push([...bytes])};
 const device={name:'TC-163 teste',gatt:{connected:true,connect:async()=>({getPrimaryServices:async()=>[{uuid:profile.service,getCharacteristics:async()=>[characteristic]}]}),disconnect:()=>{device.gatt.connected=false;disconnected++}},addEventListener:()=>{}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{bluetooth:{requestDevice:async options=>{assert.equal(options.acceptAllDevices,true);assert.ok(options.optionalServices.includes(profile.service));return device}}}});
 try{await connectBlePrinter();assert.equal(bleAvailable(),true);assert.match(bleDiagnostic(),/TC-163 teste/);await printKitchenReceipt('test','Pedido de teste com texto maior que vinte caracteres');assert.ok(writes.every(b=>b.length<=20));assert.deepEqual(writes.flat(),[...escposBytes('Pedido de teste com texto maior que vinte caracteres')]);await disconnectBlePrinter();assert.equal(bleAvailable(),false);assert.equal(disconnected,1)}finally{await disconnectBlePrinter();if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator}
});
test('BLE não envia comandos a canal desconhecido e rejeita UUID inválido antes do seletor',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator');let writes=0,requests=0;const device={gatt:{connected:true,connect:async()=>({getPrimaryServices:async()=>[{uuid:BLE_PROFILES[0].service,getCharacteristics:async()=>[{uuid:'00001234-0000-1000-8000-00805f9b34fb',properties:{write:true},writeValue:async()=>{writes++}}]}]}),disconnect:()=>{}},addEventListener:()=>{}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{bluetooth:{requestDevice:async()=>{requests++;return device}}}});
 try{await assert.rejects(connectBlePrinter(),/canal de impressão/);assert.equal(writes,0);assert.equal(bleAvailable(),false);await assert.rejects(connectBlePrinter({service:'bad uuid',characteristic:'ff02'}),/UUID inválido/);assert.equal(requests,1);assert.equal(bleUuid('FF00'),'0000ff00-0000-1000-8000-00805f9b34fb')}finally{if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator}
});
import {claimLocalJob,finishLocalJob} from '../lib/local-print-queue.ts';
import {escposBytes,printerPlatform,printerConnectionError,connectKitchenPrinter,disconnectKitchenPrinter,printerAvailable} from '../lib/kitchen-printer.ts';
test('Bluetooth reserva global impede duas cozinhas de enviar a mesma comanda',()=>{
 const jobs=fixture();const since='2000-01-01T00:00:00Z';
 const claimed=claimLocalJob(jobs,'android','token',since);assert.equal(claimed.id,'one');
 assert.equal(claimLocalJob(jobs,'notebook','other',since),null);
 assert.throws(()=>finishLocalJob(jobs,'notebook','other','one',true));
 finishLocalJob(jobs,'android','token','one',true);assert.equal(jobs[0].status,'sent');
 assert.equal(claimLocalJob(jobs,'notebook','other',since).id,'two');
});
test('Bluetooth não imprime histórico ao ativar nem repete envio sem confirmação',()=>{
 const jobs=fixture();assert.equal(claimLocalJob(jobs,'a','t','2099-01-01T00:00:00Z'),null);
 claimLocalJob(jobs,'a','t','2000-01-01T00:00:00Z','2026-01-01T00:00:00Z');
 assert.equal(claimLocalJob(jobs,'a','t','2000-01-01T00:00:00Z','2026-01-01T00:02:00Z'),null);
 assert.equal(jobs[0].status,'uncertain');
 finishLocalJob(jobs,'a','t','one',false);assert.equal(jobs[0].status,'uncertain');
});
test('ESC/POS inicializa impressora, preserva fim de comanda e remove comandos injetados',()=>{
 const bytes=escposBytes('Camarão\n'+('x'.repeat(100))+'\n\x1b\x40');
 assert.deepEqual([...bytes.slice(0,5)],[27,64,27,97,0]);
 const body=new TextDecoder().decode(bytes.slice(5));assert.match(body,/Camarao/);assert.ok(body.endsWith('\n\n\n'));assert.ok(!body.includes('\x1b'));
 assert.ok(body.split('\n').every(line=>line.length<=32));
});
test('ponte Android preserva comanda longa e escapa HTML antes de enviar',()=>{
 const text='Camarão & água <script>alert(1)</script>\n'.repeat(150);
 const uri=androidPrintIntent(text);
 const payload=decodeURIComponent(uri.match(/S.content=([^;]+)/)[1]);
 const pages=JSON.parse(gunzipSync(Buffer.from(payload,'base64')).toString());
 assert.equal(pages.length,1);assert.match(pages[0],/Camarão &amp; água &lt;script&gt;/);
 assert.ok(!pages[0].includes('<script>'));assert.match(uri,/package=com.farminos.print/);
});
const fixture=()=>[{id:'one',orderId:'o',content:'test',status:'queued',createdAt:new Date().toISOString()},{id:'two',orderId:'p',content:'test2',status:'queued',createdAt:new Date().toISOString()}];
test('fila entrega uma comanda por vez e confirmação libera a próxima',()=>{const jobs=fixture();const d={enabled:true,statusCode:'200 OK'};assert.equal(pollQueue(jobs,d).jobToken,'one');assert.equal(pollQueue(jobs,d).jobReady,false);assert.equal(pollQueue(jobs,{...d,jobToken:'one'}).jobToken,'one');confirmPrint(jobs,'one','200 OK');confirmPrint(jobs,'one','200 OK');assert.equal(pollQueue(jobs,d).jobToken,'two')});
test('sem papel e pausa não descartam comanda',()=>{const jobs=fixture();assert.equal(pollQueue(jobs,{enabled:true,statusCode:'410 Paper empty'}).jobReady,false);assert.equal(pollQueue(jobs,{enabled:false,statusCode:'200 OK'}).jobReady,false);assert.equal(jobs[0].status,'queued')});
test('confirmação perdida não dispara automaticamente a mesma impressão',()=>{const jobs=fixture();pollQueue(jobs,{enabled:true,statusCode:'200 OK'},'2026-01-01T00:00:00Z');assert.equal(pollQueue(jobs,{enabled:true,statusCode:'200 OK'},'2026-01-01T00:03:00Z').jobReady,false);assert.equal(jobs[0].status,'uncertain');confirmPrint(jobs,'one','200 OK');assert.equal(jobs[0].status,'printed')});
test('erro de impressora não é tratado como impresso',()=>{const jobs=fixture();pollQueue(jobs,{enabled:true,statusCode:'200 OK'});confirmPrint(jobs,'one','520 Unsupported format');assert.equal(jobs[0].status,'failed')});
test('pedido e comanda são gerados juntos e retry não duplica',()=>{let s=createState('Barraca','Praia',1);s.products=[{id:'p',name:'Camarão',category:'Porção',price:5000,description:'',available:true,station:'kitchen'}];const a={id:'request1',type:'order',tableId:s.tables[0].id,items:[{productId:'p',quantity:1}]};s=applyAction(s,a,'waiter','Ana');s=applyAction(s,a,'waiter','Ana');assert.equal(s.orders.length,1);assert.equal(s.printJobs.length,1);assert.match(s.printJobs[0].content,/Camarao/);assert.equal(s.printJobs[0].status,'queued')});
test('scanner usa exclusivamente modelo escolhido e esquema multimodal LLM7',()=>{const b=scanRequest('data:image/png;base64,AAAA');assert.equal(b.model,'gemini-3.1-flash-lite');assert.equal(b.messages[1].content[1].type,'image_url');assert.equal(b.response_format.type,'json_object');const p=parseScan('{"products":[{"name":"Água","category":"Bebidas","price":500,"description":"","station":"bar"}]}');assert.equal(p[0].price,500);assert.throws(()=>parseScan('{"products":[{"name":"Água","price":-5}]}'));assert.throws(()=>parseScan('{"products":[]}'))});

test('iPhone e iPad são identificados sem confundir MacBook',()=>{assert.equal(printerPlatform('iPhone'),'ios');assert.equal(printerPlatform('Macintosh',5),'ios');assert.equal(printerPlatform('Macintosh',0),'desktop');assert.equal(printerPlatform('Android Chrome/138'),'android');assert.match(printerConnectionError({name:'NotFoundError'}),/lista ficou vazia/);assert.match(printerConnectionError({name:'NetworkError'}),/notebook/)});
test('seletor usa SPP padrão, reconecta porta autorizada e limpa conexão ao sair',async()=>{const old=Object.getOwnPropertyDescriptor(globalThis,'navigator');let chooser=0,opens=0,closed=0;const p={writable:{locked:false},open:async()=>{opens++},close:async()=>{closed++},addEventListener:()=>{}};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serial:{getPorts:async()=>[p],requestPort:async(...args)=>{assert.equal(args.length,0);chooser++;return p}}}});try{await connectKitchenPrinter();assert.equal(chooser,0);assert.equal(opens,1);assert.equal(printerAvailable(),true);await disconnectKitchenPrinter();assert.equal(closed,1);await connectKitchenPrinter(false);assert.equal(chooser,1);await disconnectKitchenPrinter()}finally{if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator}});

import {printScope,canPrintJob,copyPrintJob} from '../lib/print-access.ts';
import {publicWorkspace} from '../lib/workspace-view.ts';
import {rawBtLink} from '../lib/android-print.ts';
function portableFixture(){let s=createState('Praia','Praia',2);s.products=[{id:'water',name:'Água',category:'Bebidas',price:500,description:'',available:true,station:'bar'}];s=applyAction(s,{id:'mode',type:'printer',mode:'waiter'},'owner','Dono');return s}
function orderFor(s,id,employeeId){return applyAction(s,{id,type:'order',tableId:s.tables[0].id,items:[{productId:'water',quantity:1}],employeeId:'forged',destination:'kitchen'},'waiter','Mesmo nome',undefined,employeeId)}
test('dono escolhe destino; garçom não muda configuração nem forja autoria de impressão',()=>{
 const s=portableFixture();assert.equal(s.printer.mode,'waiter');assert.equal(s.printer.enabled,false);
 assert.throws(()=>applyAction(s,{id:'x',type:'printer',mode:'kitchen'},'waiter','Ana'));
 assert.throws(()=>applyAction(s,{id:'x',type:'printer',mode:'invalid'},'owner','Dono'));
 assert.throws(()=>applyAction(s,{id:'x',type:'printer',enabled:true},'owner','Dono'),/CloudPRNT/);
 const updated=orderFor(s,'a','employee-a');assert.equal(updated.printJobs[0].destination,'waiter');assert.equal(updated.printJobs[0].employeeId,'employee-a');assert.equal(updated.orders[0].employeeId,'employee-a');
 assert.equal(orderFor(updated,'a','employee-a').printJobs.length,1);
});
test('cozinha e CloudPRNT nunca consomem a fila portátil',()=>{
 let s=orderFor(portableFixture(),'a','employee-a');assert.throws(()=>printScope(s,'kitchen'),/modo cozinha/);
 assert.throws(()=>printScope(s,'kitchen',undefined,'a'),/não pode/);
 assert.equal(pollQueue(s.printJobs,{enabled:true,statusCode:'200 OK'}).jobReady,false);
 s=applyAction(s,{id:'mode2',type:'printer',mode:'kitchen'},'owner','Dono');
 s=orderFor(s,'b','employee-a');assert.equal(s.printJobs[0].destination,'waiter');assert.equal(s.printJobs[1].destination,'kitchen');
 assert.equal(claimLocalJob(printScope(s,'kitchen'),'k','t','2000-01-01').id,'b');
});
test('garçons com mesmo nome imprimem filas próprias e em paralelo',()=>{
 let s=orderFor(portableFixture(),'a','employee-a');s=orderFor(s,'b','employee-b');
 assert.throws(()=>printScope(s,'waiter','employee-b','a'),/não pode/);assert.throws(()=>printScope(s,'waiter',undefined,'a'),/não pode/);assert.equal(canPrintJob(s.printJobs[0],'cashier'),false);
 assert.equal(claimLocalJob(printScope(s,'waiter','employee-a','a'),'d1','t1','2000-01-01',undefined,'a').id,'a');
 assert.equal(claimLocalJob(printScope(s,'waiter','employee-b','b'),'d2','t2','2000-01-01',undefined,'b').id,'b');
 assert.throws(()=>finishLocalJob(printScope(s,'waiter','employee-a','a'),'d2','t2','a',true));
 finishLocalJob(printScope(s,'waiter','employee-a','a'),'d1','t1','a',true);assert.equal(s.printJobs[0].status,'sent');
});
test('visualização do garçom não expõe comandas alheias nem tokens de reserva',()=>{
 let s=orderFor(portableFixture(),'a','employee-a');s=orderFor(s,'b','employee-b');
 claimLocalJob(printScope(s,'waiter','employee-a','a'),'d','secret','2000-01-01');
 const visible=publicWorkspace(s,'waiter','employee-a');assert.equal(visible.printJobs.length,1);assert.equal(visible.printJobs[0].id,'a');assert.equal('claimToken' in visible.printJobs[0],false);assert.equal('deviceId' in visible.printJobs[0],false);
 assert.equal(publicWorkspace(s,'waiter').printJobs.length,0);assert.equal(publicWorkspace(s,'kitchen').printJobs.length,0);
});
test('segunda via exige acesso e mantém destino; só uma via pendente por pedido',()=>{
 const s=orderFor(portableFixture(),'a','employee-a');s.printJobs[0].status='uncertain';
 assert.throws(()=>copyPrintJob(s,'a','retry','waiter','employee-b'),/não pode/);
 const copy=copyPrintJob(s,'a','retry','waiter','employee-a');assert.equal(copy.destination,'waiter');assert.match(copy.content,/SEGUNDA VIA/);
 assert.throws(()=>copyPrintJob(s,'a','retry2','waiter','employee-a'),/pendente/);
});
test('cancelamento e segunda via do painel preservam destino original após troca de modo',()=>{
 let s=orderFor(portableFixture(),'a','employee-a');s.printJobs[0].status='sent';
 s=applyAction(s,{id:'mode2',type:'printer',mode:'kitchen'},'owner','Dono');
 assert.throws(()=>applyAction(s,{id:'retry',type:'reprint',jobId:'a'},'kitchen','Cozinha'));
 s=applyAction(s,{id:'cancel',type:'cancel',orderId:'a',reason:'Cliente desistiu'},'owner','Dono');assert.equal(s.printJobs.at(-1).destination,'waiter');assert.equal(s.printJobs.at(-1).employeeId,'employee-a');assert.match(s.printJobs.at(-1).content,/CANCELAMENTO/);
});
test('RawBT recebe bytes ESC/POS sanitizados de 58mm pelo esquema oficial',()=>{
 const text='Camarão\n'+('a'.repeat(150))+'\n\x1b\x40<script>';
 const uri=rawBtLink(text);assert.ok(uri.startsWith('rawbt:base64,'));const bytes=Buffer.from(uri.slice('rawbt:base64,'.length),'base64');assert.deepEqual([...bytes],[...escposBytes(text)]);
});

import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
function printApiHarness(initial,role='waiter',employeeId='employee-a'){
 let state=structuredClone(initial),version=0,conflicts=0;
 const exports={};
 const code=ts.transpileModule(readFileSync(new URL('../app/api/local-print/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const deps={
  '@/lib/saas-billing':{assertSubscription:()=>{}},
  '@/lib/access':{resolveAccess:async()=>({owner:'venue',role,employeeId:role==='owner'?null:employeeId})},
  '@/lib/db':{readVenue:async()=>({state:structuredClone(state),version}),saveVenue:async(_owner,v,next)=>{if(conflicts){conflicts--;return false}if(v!==version)return false;state=next;version++;return true}},
  '@/lib/local-print-queue':{claimLocalJob,finishLocalJob},'@/lib/print-access':{printScope,copyPrintJob},zod:{z}
 };
 new Function('require','exports',code)(name=>{if(!deps[name])throw Error(name);return deps[name]},exports);
 return {state:()=>state,conflict:()=>{conflicts=1},call:async(body)=>{const r=await exports.POST(new Request('https://test.local/api/local-print',{method:'POST',headers:{origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify({deviceId:'phone',claimToken:'claim',since:'2000-01-01T00:00:00Z',...body})}));return {status:r.status,...await r.json()}}};
}
function apiFixture(){let s=orderFor(portableFixture(),'a','employee-a');s=orderFor(s,'b','employee-b');s.employees=[{id:'employee-a',name:'Ana',role:'waiter',active:true},{id:'employee-b',name:'Ana',role:'waiter',active:true}];return s}
test('API autoriza somente comanda própria e não registra abrir aplicativo como papel impresso',async()=>{
 const api=printApiHarness(apiFixture());assert.equal((await api.call({type:'claim',jobId:'b'})).status,400);assert.equal((await api.call({type:'arm'})).status,400);
 api.conflict();const reserved=await api.call({type:'claim',jobId:'a'});assert.equal(reserved.status,200);assert.equal(reserved.job.id,'a');assert.equal(api.state().printJobs[0].status,'printing');
 assert.equal((await api.call({type:'finish',jobId:'a',success:true,claimToken:'wrong'})).status,400);
 assert.equal((await api.call({type:'finish',jobId:'a',success:true})).status,200);assert.equal(api.state().printJobs[0].status,'sent');
 assert.equal((await api.call({type:'claim',jobId:'a'})).job,null);
 const retry=await api.call({type:'claim',jobId:'a',claimToken:'second',reprint:true});assert.equal(retry.status,200);assert.equal(retry.job.id,'second');assert.match(retry.job.content,/SEGUNDA VIA/);
});
test('API rejeita funcionário revogado e cozinha no modo portátil',async()=>{
 const s=apiFixture();s.employees[0].active=false;assert.equal((await printApiHarness(s).call({type:'claim',jobId:'a'})).status,400);
 const k=apiFixture();k.employees.push({id:'cook',name:'Chef',role:'kitchen',active:true});const api=printApiHarness(k,'kitchen','cook');assert.equal((await api.call({type:'arm'})).status,400);assert.equal((await api.call({type:'claim',jobId:'a'})).status,400);
});

test('pedido cancelado não permite nova via de preparo, apenas aviso de cancelamento',()=>{
 let s=orderFor(portableFixture(),'a','employee-a');s=applyAction(s,{id:'cancel',type:'cancel',orderId:'a',reason:'Desistência'},'owner','Dono');
 assert.throws(()=>copyPrintJob(s,'a','retry','waiter','employee-a'),/cancelado/);
 assert.throws(()=>applyAction(s,{id:'again',type:'reprint',jobId:'a'},'owner','Dono'),/cancelamento/);
 s.printJobs.find(j=>j.id==='cancel').status='uncertain';assert.match(copyPrintJob(s,'cancel','retry','waiter','employee-a').content,/CANCELAMENTO/);
});
