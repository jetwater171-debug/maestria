import test from 'node:test';
import assert from 'node:assert/strict';
import {pollQueue,confirmPrint,ticket} from '../lib/printing.ts';
import {scanRequest,parseScan} from '../lib/scanner.ts';
import {createState,applyAction} from '../lib/domain.ts';
import {androidPrintIntent} from '../lib/android-print.ts';
import {gunzipSync} from 'node:zlib';
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
