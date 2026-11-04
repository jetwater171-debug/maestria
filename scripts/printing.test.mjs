import test from 'node:test';
import assert from 'node:assert/strict';
import {pollQueue,confirmPrint,ticket} from '../lib/printing.ts';
import {scanRequest,parseScan} from '../lib/scanner.ts';
import {createState,applyAction} from '../lib/domain.ts';
import {androidPrintIntent} from '../lib/android-print.ts';
import {gunzipSync} from 'node:zlib';
import {connectBlePrinter,disconnectBlePrinter,sendBleBytes,bleAvailable,bleDiagnostic,bleUuid,BLE_PROFILES} from '../lib/ble-printer.ts';
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

function mockBleDevice(services,name='Portátil de teste'){
 const listeners=[];const device={name,listeners,gatt:{connected:false,connect:async()=>{device.gatt.connected=true;return {getPrimaryServices:async()=>services}},disconnect:()=>{device.gatt.connected=false}},addEventListener:(name,callback)=>{if(name==='gattserverdisconnected')listeners.push(callback)}};
 return device;
}
async function withTransportClock(work){
 const realSetTimeout=globalThis.setTimeout,realClearTimeout=globalThis.clearTimeout,timers=new Map();let id=0,now=0,done=false,result,error;
 globalThis.setTimeout=(callback,delay=0,...args)=>{const key=++id;timers.set(key,{at:now+delay,callback:()=>callback(...args)});return key};
 globalThis.clearTimeout=key=>{timers.delete(key)};
 try{
  void Promise.resolve().then(work).then(value=>{result=value;done=true},reason=>{error=reason;done=true});
  for(let ticks=0;!done&&ticks<10000;ticks++){
   for(let microtasks=0;microtasks<20;microtasks++)await Promise.resolve();
   if(done)break;
   const next=[...timers].sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
   assert.ok(next,'A operação deve terminar ou ter um temporizador ativo.');
   timers.delete(next[0]);now=next[1].at;next[1].callback();
  }
  assert.equal(done,true,'A operação deve terminar dentro do limite do teste.');if(error)throw error;return {result,elapsed:now};
 }finally{globalThis.setTimeout=realSetTimeout;globalThis.clearTimeout=realClearTimeout;}
}

test('BLE mantém prioridade dos perfis mesmo com ordem invertida e serviço inacessível',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator'),writes=[];
 const services=[...BLE_PROFILES].reverse().map(profile=>({uuid:profile.service,getCharacteristics:async()=>[{uuid:profile.characteristic,properties:{write:true,writeWithoutResponse:true},writeValueWithResponse:async()=>{writes.push(profile.service)},writeValueWithoutResponse:async()=>{throw Error('Não deve preferir escrita sem resposta quando há resposta.')}}]}));
 services.splice(1,0,{uuid:'00001800-0000-1000-8000-00805f9b34fb',getCharacteristics:async()=>{throw Error('Serviço sem permissão')}});
 const device=mockBleDevice(services);Object.defineProperty(globalThis,'navigator',{configurable:true,value:{bluetooth:{requestDevice:async()=>device}}});
 try{await connectBlePrinter();assert.match(bleDiagnostic(),/não foi possível consultar/);await sendBleBytes(new Uint8Array([1,2]));assert.deepEqual(writes,[BLE_PROFILES[0].service]);}finally{await disconnectBlePrinter();if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator;}
});

test('BLE usa escrita legada disponível sem escolher resposta proibida pelo perfil',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator');let writes=0;const profile=BLE_PROFILES[0];
 const device=mockBleDevice([{uuid:profile.service,getCharacteristics:async()=>[{uuid:profile.characteristic,properties:{writeWithoutResponse:true},writeValueWithResponse:async()=>{throw Error('Resposta não suportada pelo canal')},writeValue:async()=>{writes++}}]}]);
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{bluetooth:{requestDevice:async()=>device}}});
 try{await connectBlePrinter();await sendBleBytes(new Uint8Array([1]));assert.equal(writes,1);}finally{await disconnectBlePrinter();if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator;}
});

test('comanda BLE longa completa todos os bytes depois de quarenta segundos saudáveis',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator'),writes=[],profile=BLE_PROFILES[0];
 const device=mockBleDevice([{uuid:profile.service,getCharacteristics:async()=>[{uuid:profile.characteristic,properties:{writeWithoutResponse:true},writeValueWithoutResponse:async bytes=>{writes.push([...bytes])}}]}]);
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{bluetooth:{requestDevice:async()=>device}}});
 try{await connectBlePrinter();const bytes=new Uint8Array(20001).fill(65);const {elapsed}=await withTransportClock(()=>sendBleBytes(bytes));assert.ok(elapsed>40000);assert.deepEqual(writes.flat(),[...bytes]);assert.equal(bleAvailable(),true);}finally{await disconnectBlePrinter();if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator;}
});

test('perda da reserva aborta BLE após primeiro bloco sem repetir nem enviar os seguintes',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator'),controller=new AbortController(),profile=BLE_PROFILES[0];let writes=0;
 const device=mockBleDevice([{uuid:profile.service,getCharacteristics:async()=>[{uuid:profile.characteristic,properties:{write:true},writeValueWithResponse:async()=>{writes++;controller.abort()}}]}]);
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{bluetooth:{requestDevice:async()=>device}}});
 try{await connectBlePrinter();await assert.rejects(printKitchenReceipt('revoked','x'.repeat(100),controller.signal),/Envio BLE interrompido/);assert.equal(writes,1);assert.equal(bleAvailable(),false);}finally{await disconnectBlePrinter();if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator;}
});

test('timeout BLE mantém trava até escrita antiga assentar e evento atrasado preserva reconexão',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator'),realSetTimeout=globalThis.setTimeout,profile=BLE_PROFILES[0];let release,writes=0,stalled=true;
 const device=mockBleDevice([{uuid:profile.service,getCharacteristics:async()=>[{uuid:profile.characteristic,properties:{write:true},writeValueWithResponse:async()=>{writes++;if(stalled)await new Promise(resolve=>{release=resolve})}}]}]);
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{bluetooth:{requestDevice:async()=>device}}});
 globalThis.setTimeout=(callback,delay,...args)=>realSetTimeout(callback,delay===40000?1:delay,...args);
 try{
  await connectBlePrinter();await assert.rejects(printKitchenReceipt('old','x'.repeat(100)),/Envio BLE interrompido/);assert.equal(writes,1);assert.equal(bleAvailable(),false);
  await connectBlePrinter();device.listeners.forEach(callback=>callback());assert.equal(bleAvailable(),true);
  await assert.rejects(printKitchenReceipt('new','Novo'),/Outra comanda/);assert.equal(writes,1);
  stalled=false;release();await new Promise(resolve=>realSetTimeout(resolve,0));assert.equal(bleAvailable(),true);assert.equal(writes,1);
  await printKitchenReceipt('new','Novo');assert.ok(writes>1);assert.equal(bleAvailable(),true);
 }finally{release?.();globalThis.setTimeout=realSetTimeout;await disconnectBlePrinter();if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator;}
});
import {claimLocalJob,finishLocalJob,touchLocalJob} from '../lib/local-print-queue.ts';
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
test('scanner usa exclusivamente modelo escolhido e esquema multimodal LLM7',()=>{const b=scanRequest('data:image/png;base64,AAAA');assert.equal(b.model,'gemini-3.8-flash-high');assert.equal(b.messages[1].content[1].type,'image_url');assert.equal('response_format' in b,false);const p=parseScan('{"products":[{"name":"Água","category":"Bebidas","price":500,"description":"","station":"bar"}]}');assert.equal(p[0].price,500);assert.throws(()=>parseScan('{"products":[{"name":"Água","price":-5}]}'));assert.throws(()=>parseScan('{"products":[]}'))});

test('iPhone e iPad são identificados sem confundir MacBook',()=>{assert.equal(printerPlatform('iPhone'),'ios');assert.equal(printerPlatform('Macintosh',5),'ios');assert.equal(printerPlatform('Macintosh',0),'desktop');assert.equal(printerPlatform('Android Chrome/138'),'android');assert.match(printerConnectionError({name:'NotFoundError'}),/lista ficou vazia/);assert.match(printerConnectionError({name:'NetworkError'}),/notebook/)});
test('seletor usa SPP padrão, reconecta porta autorizada e limpa conexão ao sair',async()=>{const old=Object.getOwnPropertyDescriptor(globalThis,'navigator');let chooser=0,opens=0,closed=0;const p={writable:{locked:false},open:async()=>{opens++},close:async()=>{closed++},addEventListener:()=>{}};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serial:{getPorts:async()=>[p],requestPort:async(...args)=>{assert.equal(args.length,0);chooser++;return p}}}});try{await connectKitchenPrinter();assert.equal(chooser,0);assert.equal(opens,1);assert.equal(printerAvailable(),true);await disconnectKitchenPrinter();assert.equal(closed,1);await connectKitchenPrinter(false);assert.equal(chooser,1);await disconnectKitchenPrinter()}finally{if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator}});

test('timeout serial interrompe blocos posteriores e fecha a porta após a escrita pendente',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator'),realSetTimeout=globalThis.setTimeout;
 let writes=0,closed=0,release;
 const stream=new WritableStream({write(){writes++;return new Promise(resolve=>{release=resolve})}});
 const p={writable:stream,open:async()=>{},close:async()=>{assert.equal(stream.locked,false);closed++},addEventListener:()=>{}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serial:{requestPort:async()=>p}}});
 globalThis.setTimeout=(callback,delay,...args)=>realSetTimeout(callback,delay===40000?1:delay,...args);
 try{
  await connectKitchenPrinter(false);
  await assert.rejects(printKitchenReceipt('slow','x'.repeat(500)),/Envio interrompido/);
  assert.equal(printerAvailable(),false);assert.equal(writes,1);assert.equal(stream.locked,true);
  await assert.rejects(printKitchenReceipt('too-soon','Outra comanda'),/Outra comanda/);assert.equal(writes,1);
  release();await new Promise(resolve=>realSetTimeout(resolve,70));
  assert.equal(writes,1);assert.equal(stream.locked,false);assert.equal(closed,1);
 }finally{release?.();globalThis.setTimeout=realSetTimeout;if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator}
});

test('comanda serial longa completa sem timeout total enquanto cada escrita progride',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator'),writes=[];
 const stream=new WritableStream({write(bytes){writes.push([...bytes])}}),p={writable:stream,open:async()=>{},close:async()=>{},addEventListener:()=>{}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serial:{requestPort:async()=>p}}});
 try{await connectKitchenPrinter(false);const text='x'.repeat(180000),{elapsed}=await withTransportClock(()=>printKitchenReceipt('long',text));assert.ok(elapsed>40000);assert.deepEqual(writes.flat(),[...escposBytes(text)]);assert.equal(printerAvailable(),true);}finally{await disconnectKitchenPrinter();if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator;}
});

test('perda da reserva aborta serial após primeiro bloco e libera a conexão antiga',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator'),controller=new AbortController();let writes=0,closed=0;
 const stream=new WritableStream({write(){writes++;controller.abort()}}),p={writable:stream,open:async()=>{},close:async()=>{closed++},addEventListener:()=>{}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serial:{requestPort:async()=>p}}});
 try{await connectKitchenPrinter(false);await assert.rejects(printKitchenReceipt('revoked','x'.repeat(500),controller.signal),/Envio interrompido/);await Promise.resolve();assert.equal(writes,1);assert.equal(printerAvailable(),false);assert.equal(stream.locked,false);assert.equal(closed,1);}finally{await disconnectKitchenPrinter();if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator;}
});

test('evento serial atrasado da sessão antiga não remove a porta reconectada',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator'),listeners=[];
 const p={writable:new WritableStream({write(){}}),open:async()=>{},close:async()=>{},addEventListener:(event,callback)=>{listeners.push(callback)}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serial:{requestPort:async()=>p}}});
 try{await connectKitchenPrinter(false);await disconnectKitchenPrinter();await connectKitchenPrinter(false);listeners[0]();assert.equal(printerAvailable(),true);await printKitchenReceipt('new','Novo');}finally{await disconnectKitchenPrinter();if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator;}
});

test('falha serial libera e fecha a conexão antiga antes de nova tentativa',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator');let closed=0;
 const stream=new WritableStream({write(){throw Error('Bluetooth desconectado')}});
 const p={writable:stream,open:async()=>{},close:async()=>{assert.equal(stream.locked,false);closed++},addEventListener:()=>{}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serial:{requestPort:async()=>p}}});
 try{await connectKitchenPrinter(false);await assert.rejects(printKitchenReceipt('broken','Teste'),/Bluetooth desconectado/);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(printerAvailable(),false);assert.equal(stream.locked,false);assert.equal(closed,1)}finally{if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator}
});

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
import {registerHub,touchHub,releaseHub,requestHubPrint,hubJobs} from '../lib/print-hub.ts';
function printApiHarness(initial,role='waiter',employeeId='employee-a'){
 let state=structuredClone(initial),version=0,conflicts=0;
 const exports={};
 const code=ts.transpileModule(readFileSync(new URL('../app/api/local-print/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const deps={
  '@/lib/saas-billing':{assertSubscription:()=>{}},
  '@/lib/access':{resolveAccess:async()=>({owner:'venue',role,employeeId:role==='owner'?null:employeeId})},
  '@/lib/db':{readVenue:async()=>({state:structuredClone(state),version}),saveVenue:async(_owner,v,next)=>{if(conflicts){conflicts--;return false}if(v!==version)return false;state=next;version++;return true}},
  '@/lib/print-hub':{registerHub,touchHub,releaseHub,requestHubPrint,hubJobs},'@/lib/local-print-queue':{claimLocalJob,finishLocalJob,touchLocalJob},'@/lib/print-access':{printScope,copyPrintJob},zod:{z}
 };
 new Function('require','exports',code)(name=>{if(!deps[name])throw Error(name);return deps[name]},exports);
 return {state:()=>state,replaceState:next=>{state=structuredClone(next);version++},conflict:()=>{conflicts=1},call:async(body)=>{const r=await exports.POST(new Request('https://test.local/api/local-print',{method:'POST',headers:{origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify({deviceId:'phone',claimToken:'claim',since:'2000-01-01T00:00:00Z',...body})}));return {status:r.status,...await r.json()}}};
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

test('API central recebe pedido autorizado de Safari sem acesso local ao Bluetooth',async()=>{
 const s=apiFixture();s.printer.relayEnabled=true;s.employees.push({id:'cook',name:'Chef',role:'kitchen',active:true});s.printJobs.forEach(j=>j.createdAt='2020-01-01T00:00:00Z');
 const central=printApiHarness(s,'kitchen','cook');assert.equal((await central.call({type:'arm',hub:true,deviceId:'hub'})).status,200);
 const waiter=printApiHarness(central.state());assert.equal((await waiter.call({type:'relay',jobId:'b'})).status,400);
 waiter.conflict();assert.equal((await waiter.call({type:'relay',jobId:'a'})).status,200);assert.equal((await waiter.call({type:'relay',jobId:'a'})).status,200);assert.equal(waiter.state().printJobs.length,2);
 central.replaceState(waiter.state());
 const since=new Date().toISOString();const claimed=await central.call({type:'claim',hub:true,deviceId:'hub',claimToken:'native',since});assert.equal(claimed.status,200);assert.equal(claimed.job.id,'a');
 assert.equal((await central.call({type:'finish',hub:true,deviceId:'hub',claimToken:'wrong',jobId:'a',success:true})).status,400);
 assert.equal((await central.call({type:'finish',hub:true,deviceId:'hub',claimToken:'native',jobId:'a',success:true})).status,200);assert.equal(central.state().printJobs[0].status,'sent');
 waiter.replaceState(central.state());assert.equal((await waiter.call({type:'relay',jobId:'a'})).status,400);
});
test('API central bloqueia concorrente, funcionário revogado, lease antigo e flag forjada',async()=>{
 const s=apiFixture();s.printer.relayEnabled=true;s.employees.push({id:'cook',name:'Chef',role:'kitchen',active:true});
 const central=printApiHarness(s,'kitchen','cook');await central.call({type:'arm',hub:true,deviceId:'hub'});
 assert.equal((await central.call({type:'arm',hub:true,deviceId:'other'})).status,400);
 const waiter=printApiHarness(central.state());assert.equal((await waiter.call({type:'claim',hub:true,deviceId:'hub',jobId:'b'})).status,400);
 const stale=structuredClone(central.state());stale.printer.hub.lastSeen='2020-01-01';waiter.replaceState(stale);assert.equal((await waiter.call({type:'relay',jobId:'a'})).status,400);
 stale.printer.hub.lastSeen=new Date().toISOString();stale.employees[0].active=false;waiter.replaceState(stale);assert.equal((await waiter.call({type:'relay',jobId:'a'})).status,400);
 assert.equal((await central.call({type:'release',deviceId:'other'})).status,200);assert.equal(central.state().printer.hub.deviceId,'hub');
 await central.call({type:'release',deviceId:'hub'});assert.equal(central.state().printer.hub,undefined);
});
test('dono controla compartilhamento; garçom não habilita a própria central',()=>{
 const s=apiFixture();assert.throws(()=>applyAction(s,{id:'relay-mode',type:'printer',relayEnabled:true},'waiter','Ana'));
 assert.throws(()=>applyAction(s,{id:'relay-mode',type:'printer',relayEnabled:'yes'},'owner','Dono'));
 const enabled=applyAction(s,{id:'relay-mode',type:'printer',relayEnabled:true},'owner','Dono');assert.equal(enabled.printer.relayEnabled,true);
});

test('repetir ativação da central mantém corte da sessão mesmo com resposta perdida',async()=>{
 const s=apiFixture();s.printer.relayEnabled=true;s.printer.hub={deviceId:'hub',startedAt:new Date(Date.now()-5000).toISOString(),lastSeen:new Date().toISOString()};
 const api=printApiHarness(s,'owner');const first=s.printer.hub.startedAt;
 assert.equal((await api.call({type:'arm',hub:true,deviceId:'hub'})).since,first);
 assert.equal((await api.call({type:'arm',hub:true,deviceId:'hub'})).since,first);
});

test('heartbeat mantém central disponível durante envio sem reservar nem concluir outra comanda',async()=>{
 const s=apiFixture();s.printer.relayEnabled=true;s.printer.hub={deviceId:'hub',startedAt:new Date(Date.now()-30000).toISOString(),lastSeen:new Date(Date.now()-19000).toISOString()};
 s.printJobs[0].status='printing';s.printJobs[0].deviceId='hub';s.printJobs[0].claimToken='private';
 const api=printApiHarness(s,'owner');const before=JSON.stringify(s.printJobs);api.conflict();
 assert.equal((await api.call({type:'heartbeat',hub:true,deviceId:'hub'})).status,200);
 assert.ok(Date.now()-Date.parse(api.state().printer.hub.lastSeen)<1000);assert.equal(JSON.stringify(api.state().printJobs),before);
 assert.equal((await api.call({type:'heartbeat',hub:true,deviceId:'other'})).status,400);
 assert.equal((await api.call({type:'heartbeat',deviceId:'hub'})).status,400);
 assert.equal((await printApiHarness(api.state()).call({type:'heartbeat',hub:true,deviceId:'hub'})).status,400);
});

test('liberação atrasada da sessão anterior não remove a central retomada',async()=>{
 const s=apiFixture();s.printer.relayEnabled=true;const api=printApiHarness(s,'owner');
 await api.call({type:'arm',hub:true,deviceId:'old-session'});await api.call({type:'release',deviceId:'old-session'});
 await api.call({type:'arm',hub:true,deviceId:'new-session'});await api.call({type:'release',deviceId:'old-session'});
 assert.equal(api.state().printer.hub.deviceId,'new-session');
 assert.equal((await api.call({type:'heartbeat',hub:true,deviceId:'old-session'})).status,400);
 assert.equal((await api.call({type:'heartbeat',hub:true,deviceId:'new-session'})).status,200);
});

test('API renova apenas reserva privada ativa e respeita funcionário revogado',async()=>{
 const s=orderFor(portableFixture(),'long','employee-a');s.employees=[{id:'employee-a',name:'Ana',role:'waiter',active:true}];
 const api=printApiHarness(s);assert.equal((await api.call({type:'claim',jobId:'long'})).status,200);
 const renewal=await api.call({type:'touch',jobId:'long'});assert.equal(renewal.status,200);assert.equal(renewal.renewed,true);assert.ok(api.state().printJobs[0].claimHeartbeatAt);
 assert.equal((await api.call({type:'touch',jobId:'long',claimToken:'wrong'})).status,400);
 const revoked=structuredClone(api.state());revoked.employees[0].active=false;api.replaceState(revoked);assert.equal((await api.call({type:'touch',jobId:'long'})).status,400);
});
