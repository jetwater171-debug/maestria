import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {SCAN_MODEL,scanRequest,parseScan,scanProviderError} from '../lib/scanner.ts';

const products=[{name:'Água de coco',category:'Bebidas',price:800,description:'',station:'bar'}];
const output={choices:[{finish_reason:'stop',message:{content:JSON.stringify({products})}}]};
const code=ts.transpileModule(readFileSync(new URL('../app/api/scan/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness({access={role:'owner',state:{}},key='test-server-key',upstream=async()=>Response.json(output)}={}){
 const exports={},calls=[],logs=[];
 const deps={'@/lib/access':{resolveAccess:async()=>access},'@/lib/scanner':{SCAN_MODEL,scanRequest,parseScan,scanProviderError}};
 new Function('require','exports','fetch','process','console',code)(name=>deps[name],exports,async(url,init)=>{calls.push({url,init});return upstream(url,init)},{env:{LLM7_API_KEY:key}},{error:(...args)=>logs.push(args)});
 return {calls,logs,post:async({image='data:image/png;base64,AAAA',origin='https://test.local'}={})=>{
  const response=await exports.POST(new Request('https://test.local/api/scan',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({image})}));return {status:response.status,headers:response.headers,body:await response.json()};
 }};
}

test('scanner lê imagem sem exigir JSON mode incompatível e retorna preços em centavos',async()=>{
 const api=harness(),r=await api.post();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(r.body.model,SCAN_MODEL);assert.equal(r.body.products[0].price,800);
 const body=JSON.parse(api.calls[0].init.body);assert.equal(body.messages[1].content[1].image_url.url,'data:image/png;base64,AAAA');assert.equal('response_format' in body,false);
});
test('scanner bloqueia origem externa, garçom e dono sem barraca antes de chamar o provedor',async()=>{
 for(const options of [{access:null},{access:{role:'waiter',state:{}}},{access:{role:'owner',state:null}}]){const api=harness(options);assert.equal((await api.post()).status,403);assert.equal(api.calls.length,0)}
 const api=harness();assert.equal((await api.post({origin:'https://outside.test'})).status,403);assert.equal(api.calls.length,0);
});
test('scanner não envia foto sem configuração ou com formato inválido',async()=>{
 const missing=harness({key:'  '});assert.equal((await missing.post()).status,503);assert.equal(missing.calls.length,0);
 const invalid=harness();assert.equal((await invalid.post({image:'https://outside.test/menu.jpg'})).status,400);assert.equal(invalid.calls.length,0);
});
test('modelo removido produz diagnóstico específico sem expor foto, chave ou corpo do provedor',async()=>{
 const api=harness({upstream:async()=>new Response('PRIVATE_UPSTREAM_BODY',{status:404})}),r=await api.post();
 assert.equal(r.status,502);assert.match(r.body.error,/modelo.*indisponível/);const visible=JSON.stringify({body:r.body,logs:api.logs});
 for(const privateValue of ['PRIVATE_UPSTREAM_BODY','test-server-key','data:image'])assert.equal(visible.includes(privateValue),false);
 assert.deepEqual(api.logs[0][1],{provider:'LLM7',model:SCAN_MODEL,status:404});
});
test('scanner distingue saldo, permissão e limite de requisições',async()=>{
 for(const [status,reason] of [[402,/saldo/],[403,/chave/],[429,/ocupado/],[503,/indisponível/]]){const api=harness({upstream:async()=>new Response(null,{status})});const r=await api.post();assert.equal(r.status,502);assert.match(r.body.error,reason)}
});
test('resposta truncada ou vazia nunca chega como importação bem-sucedida',async()=>{
 for(const choices of [[{finish_reason:'length',message:{content:'{"products":['}}],[]]){const api=harness({upstream:async()=>Response.json({choices})});assert.equal((await api.post()).status,422)}
 const invalid=harness({upstream:async()=>Response.json({choices:[{message:{content:'{"products":[{"name":"Água","price":-1}]}'}}]})});assert.equal((await invalid.post()).status,400);
});
test('timeout e falha de rede não são atribuídos à foto nem expõem detalhes internos',async()=>{
 for(const [failure,status,reason] of [[new DOMException('PRIVATE_DETAILS','TimeoutError'),504,/demorou/],[new TypeError('PRIVATE_DETAILS'),502,/conectar/]]){const api=harness({upstream:async()=>{throw failure}}),r=await api.post();assert.equal(r.status,status);assert.match(r.body.error,reason);assert.equal(JSON.stringify(r.body).includes('PRIVATE_DETAILS'),false)}
});
