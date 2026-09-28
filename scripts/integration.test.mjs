import assert from 'node:assert/strict';
const base='http://localhost:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'local sign-in must set cookie');
async function request(body,headers={Cookie:cookie}){const r=await fetch(base+'/api/workspace',{method:body?'POST':'GET',headers:{...headers,'Content-Type':'application/json'},...(body?{body:JSON.stringify({id:crypto.randomUUID(),...body})}:{})});const data=await r.json();return {status:r.status,data}}
let initial=await request();assert.equal(initial.status,200);if(!initial.data.state){const setup=await request({type:'setup',name:'Validação local Maestria',location:'Ambiente de teste local',count:3});assert.equal(setup.status,200);initial=setup}
const pid=crypto.randomUUID();assert.equal((await request({type:'product',products:[{id:pid,name:'Produto de teste',category:'Bebidas',price:500,station:'bar'}]})).status,200);
const tableId=initial.data.state.tables.find(t=>!t.session).id;
const id=crypto.randomUUID();const order={id,type:'order',tableId,items:[{productId:pid,quantity:2}]};assert.equal((await request(order)).status,200);assert.equal((await request(order)).status,200);
const check=await request();assert.equal(check.data.state.orders.filter(o=>o.id===id).length,1);
const employeeId=crypto.randomUUID();await request({id:employeeId,type:'employee',name:'Garçom de teste',role:'waiter'});const invite=await request({type:'invite',employeeId});assert.ok(invite.data.token);const staffHeaders={Authorization:`Bearer ${invite.data.token}`};const staff=await request(undefined,staffHeaders);assert.equal(staff.data.role,'waiter');assert.equal(staff.data.state.employees.length,0);assert.equal((await request({type:'settings',name:'Ataque',location:'Teste',service:0},staffHeaders)).status,400);
await request({type:'revoke',employeeId});assert.equal((await request(undefined,staffHeaders)).status,400);
assert.equal((await request(undefined,{})).status,401);
for(const status of ['preparing','ready','delivered'])assert.equal((await request({type:'status',orderId:id,status})).status,200);
await request({type:'closing',tableId});const checkout=await request({type:'checkout',tableId,withService:false,discount:0,method:'Dinheiro'});assert.equal(checkout.status,200);assert.equal(checkout.data.state.payments.at(-1).total,1000);assert.equal(checkout.data.state.tables.find(t=>t.id===tableId).session,null);
console.log('PASS: autenticação, persistência, idempotência, acesso por função, revogação e fechamento via API real local.');
