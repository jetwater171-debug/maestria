import assert from 'node:assert/strict';
const base='http://localhost:5173';
const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});const cookie=sign.headers.get('set-cookie').split(';')[0];
const ownerHeaders={Cookie:cookie,'Content-Type':'application/json'};
async function owner(body){const r=await fetch(base+'/api/workspace',{method:body?'POST':'GET',headers:ownerHeaders,...(body?{body:JSON.stringify({id:crypto.randomUUID(),...body})}:{})});assert.equal(r.status,200);return r.json()}
const credResponse=await fetch(base+'/api/printer',{method:'POST',headers:ownerHeaders});assert.equal(credResponse.status,200);const c=await credResponse.json();const headers={Authorization:'Basic '+Buffer.from(c.username+':'+c.password).toString('base64'),'Content-Type':'application/json'};
assert.equal((await fetch(base+'/api/cloudprnt')).status,401);
await owner({type:'printer',enabled:true});await owner({type:'printTest'});
let printed=0;
for(let i=0;i<20;i++){const poll=await fetch(base+'/api/cloudprnt',{method:'POST',headers,body:JSON.stringify({statusCode:'200 OK',printingInProgress:false})});assert.equal(poll.status,200);const d=await poll.json();if(!d.jobReady)break;assert.ok(d.jobToken);const url=base+'/api/cloudprnt?token='+encodeURIComponent(d.jobToken);const receipt=await fetch(url,{headers});assert.equal(receipt.status,200);assert.ok((await receipt.text()).length>10);const ack=await fetch(url+'&code=200%20OK',{method:'DELETE',headers});assert.equal(ack.status,200);const ack2=await fetch(url+'&code=200%20OK',{method:'DELETE',headers});assert.equal(ack2.status,200);printed++}
assert.ok(printed>0);const state=(await owner()).state;assert.equal(state.printJobs.at(-1).status,'printed');assert.ok(state.printer.lastSeen);await owner({type:'printer',enabled:false});
console.log('PASS: protocolo CloudPRNT por HTTP real local; autenticação, retirada, conteúdo, confirmação e confirmação repetida. Equipamento simulado; sem impressão física.');
