import test from 'node:test';
import assert from 'node:assert/strict';
import {publicWorkspace} from '../lib/workspace-view.ts';
import {createState,applyAction} from '../lib/domain.ts';
import {applyBilling,canAdmin,invoiceStatus,assertSubscription,csvCell} from '../lib/saas-billing.ts';
import {venueHealth} from '../lib/saas-health.ts';
import {AdminRequestError,readAdminBody} from '../lib/saas-admin-request.ts';
import {ADMIN_COOKIE,ADMIN_SESSION_SECONDS,AdminLoginLimiter,adminClientIp,adminSessionCookie,checkAdminPassword,createAdminSession,hasAdminSession,sameAdminOrigin,validAdminSession} from '../lib/saas-admin-auth.ts';
const now='2026-09-29T12:00:00Z';const act=(s,a)=>applyBilling(s,{id:crypto.randomUUID(),...a},'admin',now);
function fixture(){return act(undefined,{type:'subscription',plan:'Praia',monthlyFee:14900,billingDay:10,status:'active',trialUntil:'',notes:'Cliente mensal'})}
test('admin não usa e-mail nem metadados e falha fechado sem configuração',()=>{assert.equal(canAdmin('user-1',''),false);assert.equal(canAdmin('user-1','user-2'),false);assert.equal(canAdmin('user-1',' user-1,user-2 '),true);assert.equal(canAdmin('',''),false)});
test('mensalidade é única por competência e mantém valor acordado original',()=>{let s=fixture();s=act(s,{type:'generate',period:'2026-09'});s=act(s,{type:'generate',period:'2026-09'});assert.equal(s.invoices.length,1);assert.equal(s.invoices[0].amount,14900);assert.equal(s.invoices[0].dueDate,'2026-09-10');assert.equal(invoiceStatus(s.invoices[0],'2026-09-29'),'overdue');s=act(s,{type:'subscription',plan:'Novo',monthlyFee:19900,billingDay:5,status:'active',trialUntil:'',notes:''});assert.equal(s.invoices[0].amount,14900);s=act(s,{type:'generate',period:'2026-10'});assert.equal(s.invoices[1].amount,19900)});
test('recebimento manual é idempotente e reversão exige motivo com auditoria',()=>{let s=act(fixture(),{type:'generate',period:'2026-09'});const a={id:'receipt',type:'paid',invoiceId:s.invoices[0].id,paidAt:'2026-09-29',method:'Pix',receipt:'Conferido no banco'};s=act(s,a);s=act(s,a);assert.equal(s.invoices[0].status,'paid');assert.equal(s.audit.length,3);assert.throws(()=>act(s,{type:'reopen',invoiceId:s.invoices[0].id,reason:''}));s=act(s,{type:'reopen',invoiceId:s.invoices[0].id,reason:'Registro incorreto'});assert.equal(s.invoices[0].status,'pending');assert.equal(s.invoices[0].paidAt,undefined);assert.match(s.audit.at(-1).action,/Registro incorreto/)});
test('cancelamento preserva registro e impedimentos de acesso são explícitos',()=>{let s=act(fixture(),{type:'generate',period:'2026-09'});s=act(s,{type:'void',invoiceId:s.invoices[0].id,reason:'Isenção acordada'});s=act(s,{type:'generate',period:'2026-09'});assert.equal(s.invoices.length,1);assert.equal(s.invoices[0].status,'void');assertSubscription({status:'active'});assertSubscription({status:'trial',trialUntil:'2000-01-01'});assert.throws(()=>assertSubscription({status:'paused'}));assert.throws(()=>assertSubscription({status:'cancelled'}))});
test('valores, datas, status e exportação são validados',()=>{const s=fixture();assert.throws(()=>act(s,{type:'invoice',description:'X',amount:-1,dueDate:'2026-10-10'}));assert.throws(()=>act(s,{type:'invoice',description:'X',amount:100,dueDate:'2026-02-31'}));assert.throws(()=>act(s,{type:'generate',period:'2026-13'}));const invoice=act(s,{type:'invoice',description:'Instalação',amount:10000,dueDate:'2026-10-10'});assert.throws(()=>act(invoice,{type:'paid',invoiceId:invoice.invoices[0].id,paidAt:'2027-01-01',method:'Pix',receipt:''}));assert.equal(csvCell('=1+1'),'"\'=1+1"');assert.equal(csvCell('Texto; seguro'),'"Texto; seguro"')});

test('cobrança avulsa no mesmo mês não impede mensalidade',()=>{let s=act(fixture(),{type:'invoice',description:'Instalação',amount:5000,dueDate:'2026-09-30'});s=act(s,{type:'generate',period:'2026-09'});assert.equal(s.invoices.length,2);s=act(s,{type:'generate',period:'2026-09'});assert.equal(s.invoices.length,2)});

test('notas e finanças do SaaS nunca aparecem na operação dos donos ou funcionários',()=>{const state=createState('Barraca','Praia',1);state.saas=fixture();for(const role of ['owner','waiter','kitchen','cashier']){const result=publicWorkspace(state,role);assert.equal('saas' in result,false)}const next=applyAction(state,{id:'edit',type:'settings',name:'Barraca nova',location:'Praia',service:10,saas:{status:'active',monthlyFee:0}},'owner','Dono');assert.equal(next.saas.monthlyFee,14900);assert.equal(next.saas.notes,'Cliente mensal')});

test('recebimento não aceita amanhã no Brasil durante a virada do dia UTC',()=>{
 const s=act(fixture(),{type:'generate',period:'2026-09'});
 const action={id:'timezone-receipt',type:'paid',invoiceId:s.invoices[0].id,paidAt:'2026-10-01',method:'Pix',receipt:''};
 assert.throws(()=>applyBilling(s,action,'admin','2026-10-01T01:00:00Z'),/futura/);
 assert.equal(applyBilling(s,{...action,paidAt:'2026-09-30'},'admin','2026-10-01T01:00:00Z').invoices[0].status,'paid');
});

test('atenção usa filas persistidas e limita falhas históricas a 24 horas',()=>{
 const state=createState('Barraca','Praia',1),at='2026-10-28T15:00:00Z';
 state.saas=fixture();state.printJobs=[
  {id:'pending',orderId:'one',status:'queued',createdAt:'2026-10-28T14:57:59Z',content:'Privado'},
  {id:'new',orderId:'two',status:'queued',createdAt:'2026-10-28T14:59:00Z',content:'Privado'},
  {id:'stalled',orderId:'three',status:'printing',claimedAt:'2026-10-28T14:58:00Z',createdAt:'2026-10-28T14:57:00Z',content:'Privado'},
  {id:'uncertain',orderId:'four',status:'uncertain',createdAt:'2026-10-28T14:00:00Z',content:'Privado'},
  {id:'failed',orderId:'five',status:'failed',createdAt:'2026-10-28T14:00:00Z',content:'Privado'},
  {id:'cancelled',orderId:'six',status:'failed',createdAt:'2026-10-28T14:00:00Z',error:'Pedido cancelado antes de imprimir.',content:'Privado'},
  {id:'old',orderId:'seven',status:'failed',createdAt:'2026-10-26T14:00:00Z',content:'Privado'},
  {id:'sent',orderId:'eight',status:'sent',createdAt:'2026-10-28T14:00:00Z',content:'Privado'},
 ];
 const result=venueHealth(state,at);
 assert.equal(result.queued,2);assert.equal(result.delayed,1);assert.equal(result.inProgress,1);assert.equal(result.stalled,1);
 assert.equal(result.uncertain24h,1);assert.equal(result.failed24h,1);assert.equal(result.checkedAt,at);
 assert.equal(result.issues.find(i=>i.id==='uncertain').severity,'urgent');
 assert.equal(JSON.stringify(result).includes('Privado'),false);
 assert.deepEqual(state.printJobs.map(j=>j.status),['queued','queued','printing','uncertain','failed','failed','failed','sent']);
});

test('atenção separa implantação, acordo comercial e vencimento sem bloquear acesso',()=>{
 const state=createState('Barraca','Praia',1);state.tables=[];state.products=[];
 state.saas=act(fixture(),{type:'generate',period:'2026-09'});
 state.saas.status='trial';state.saas.trialUntil='2026-10-27';
 const issues=venueHealth(state,'2026-10-28T15:00:00Z').issues.map(i=>i.id);
 for(const issue of ['tables','menu','trial','overdue'])assert.ok(issues.includes(issue));
 assertSubscription(state.saas);
 state.saas.status='active';state.saas.monthlyFee=0;
 assert.ok(venueHealth(state,'2026-10-28T15:00:00Z').issues.some(i=>i.id==='price'));
 state.saas.status='paused';
 assert.ok(!venueHealth(state,'2026-10-28T15:00:00Z').issues.some(i=>['menu','tables'].includes(i.id)));
});

test('API administrativa mede bytes mesmo sem Content-Length',async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify({notes:'é'.repeat(20)}));
 const stream=new ReadableStream({start(controller){controller.enqueue(bytes.slice(0,12));controller.enqueue(bytes.slice(12));controller.close()}});
 const req=new Request('https://example.test/api/saas-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:stream,duplex:'half'});
 await assert.rejects(readAdminBody(req,40),e=>e instanceof AdminRequestError&&e.status===413);
 const valid=new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:'{"owner":"test"}'});
 assert.deepEqual(await readAdminBody(valid),{owner:'test'});
});

test('API administrativa rejeita mídia e estruturas inválidas antes de faturar',async()=>{
 const request=(body,contentType='application/json')=>new Request('https://example.test',{method:'POST',headers:{'Content-Type':contentType},body});
 await assert.rejects(readAdminBody(request('{}','text/plain')),e=>e.status===415);
 for(const body of ['null','[]','"text"','{'])await assert.rejects(readAdminBody(request(body)),e=>e.status===400);
});

const adminEnv={SAAS_ADMIN_PASSWORD:'test-only-admin-password',SAAS_ADMIN_SESSION_SECRET:'test-only-signing-secret-with-more-than-32-characters'};
test('senha administrativa usa verificação servidor e falha fechado sem segredos',async()=>{
 assert.equal(await checkAdminPassword('test-only-admin-password',adminEnv),true);
 assert.equal(await checkAdminPassword('wrong-password',adminEnv),false);
 assert.equal(await checkAdminPassword('test-only-admin-password',{}),false);
 assert.equal(await checkAdminPassword('test-only-admin-password',{SAAS_ADMIN_PASSWORD:adminEnv.SAAS_ADMIN_PASSWORD}),false);
 assert.equal(await checkAdminPassword('test-only-admin-password',{...adminEnv,SAAS_ADMIN_SESSION_SECRET:'short'}),false);
 assert.equal(await checkAdminPassword({password:'test-only-admin-password'},adminEnv),false);
 assert.throws(()=>createAdminSession(1000000,{}));
});

test('sessão administrativa expira em oito horas e rejeita forja e rotação',()=>{
 const now=Date.parse('2026-10-28T12:00:00Z'),token=createAdminSession(now,adminEnv);
 assert.equal(validAdminSession(token,now,adminEnv),true);
 assert.equal(validAdminSession(token,now+(ADMIN_SESSION_SECONDS*1000)-1000,adminEnv),true);
 assert.equal(validAdminSession(token,now+(ADMIN_SESSION_SECONDS*1000),adminEnv),false);
 assert.equal(validAdminSession(token,now,{}),false);
 assert.equal(validAdminSession(token,now,{...adminEnv,SAAS_ADMIN_PASSWORD:'changed-password'}),false);
 assert.equal(validAdminSession(token,now,{...adminEnv,SAAS_ADMIN_SESSION_SECRET:'changed-signing-secret-with-more-than-32-characters'}),false);
 const forged=token.split('.');forged[1]=String(Number(forged[1])+3600);
 assert.equal(validAdminSession(forged.join('.'),now,adminEnv),false);
 assert.equal(validAdminSession(token.slice(0,-1)+'!',now,adminEnv),false);
 assert.equal(validAdminSession(token+'.extra',now,adminEnv),false);
 assert.equal(token.includes(adminEnv.SAAS_ADMIN_PASSWORD),false);
 const request=cookie=>new Request('https://example.test/admin',{headers:{cookie}});
 assert.equal(hasAdminSession(request(`${ADMIN_COOKIE}=${token}`),now,adminEnv),true);
 assert.equal(hasAdminSession(request(`${ADMIN_COOKIE}=${token}; ${ADMIN_COOKIE}=${token}`),now,adminEnv),false);
 assert.equal(hasAdminSession(request(''),now,adminEnv),false);
 assert.match(adminSessionCookie(token,true),/HttpOnly; SameSite=Strict; Max-Age=28800; Secure$/);
 assert.doesNotMatch(adminSessionCookie(token,false),/Secure/);
 assert.match(adminSessionCookie('',true),/Max-Age=0; Secure$/);
});

test('mudanças da sessão exigem Origin exato e cabeçalhos IP só são confiados na Vercel',()=>{
 const request=origin=>new Request('https://example.test/api/admin-session',{method:'POST',headers:origin?{origin}:{}});
 assert.equal(sameAdminOrigin(request('https://example.test')),true);
 for(const origin of [null,'https://evil.test','null','http://example.test','https://example.test.evil.test'])assert.equal(sameAdminOrigin(request(origin)),false);
 const ipRequest=new Request('https://example.test',{headers:{'x-forwarded-for':'192.0.2.1, 192.0.2.2'}});
 assert.equal(adminClientIp(ipRequest,{VERCEL:'1'}),'192.0.2.1');
 assert.equal(adminClientIp(ipRequest,{}),'local-or-untrusted');
});

test('limite de login restringe IP e volume global por instância',()=>{
 const perIp=new AdminLoginLimiter();
 for(let i=0;i<5;i++)assert.equal(perIp.allow('192.0.2.1',1000).allowed,true);
 assert.equal(perIp.allow('192.0.2.1',1000).allowed,false);
 assert.equal(perIp.allow('192.0.2.2',1000).allowed,true);
 assert.equal(perIp.allow('192.0.2.1',601001).allowed,true);
 const global=new AdminLoginLimiter();
 for(let i=0;i<60;i++)assert.equal(global.allow('client-'+i,1000).allowed,true);
 assert.equal(global.allow('another-client',1000).allowed,false);
 assert.equal(global.allow('another-client',61001).allowed,true);
});
