import {assertSubscription} from '@/lib/saas-billing';
import {database,hashToken,readVenue,saveVenue} from '@/lib/db';

import {type State} from '@/lib/domain';

import {pollQueue,confirmPrint} from '@/lib/printing';

export const dynamic='force-dynamic';

const json=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});

async function authenticate(req:Request){const h=req.headers.get('authorization')||'';if(!h.startsWith('Basic '))return null;let value:string;try{value=atob(h.slice(6))}catch{return null}const i=value.indexOf(':');if(i<0)return null;const owner=value.slice(0,i),password=value.slice(i+1);const db=database();const {data:p,error}=await db.from('printers').select('hash').eq('owner',owner).maybeSingle();if(error)throw Error('Conexão indisponível.');if(!p||p.hash!==await hashToken(password))return null;return owner}

async function read(owner:string){const row=await readVenue(owner);if(!row)throw Error('Barraca não encontrada.');assertSubscription(row.state.saas);return {s:row.state,version:row.version}}

async function change<T>(owner:string,fn:(s:State)=>T){for(let n=0;n<5;n++){const {s,version}=await read(owner);const result=fn(s);const saved=await saveVenue(owner,version,s);if(saved)return result}throw Error('Tente novamente.')}

function denied(){return new Response('Unauthorized',{status:401,headers:{'WWW-Authenticate':'Basic realm="Maestria printer"','Cache-Control':'no-store'}})}

export async function POST(req:Request){try{const owner=await authenticate(req);if(!owner)return denied();const b=await req.json() as {statusCode?:string;printingInProgress?:boolean;jobToken?:string};return json(await change(owner,s=>{s.printJobs||=[];s.printer={...s.printer,enabled:s.printer?.enabled??false,lastSeen:new Date().toISOString(),deviceStatus:String(b.statusCode||'Desconhecido').slice(0,100)};return pollQueue(s.printJobs,{...b,enabled:s.printer.enabled&&s.printer.mode!=='waiter'})}))}catch{return json({jobReady:false},503)}}

export async function GET(req:Request){try{const owner=await authenticate(req);if(!owner)return denied();const token=new URL(req.url).searchParams.get('token');const {s}=await read(owner);const job=s.printJobs?.find(j=>j.id===token&&j.status==='printing'&&(j.destination||'kitchen')==='kitchen'&&!j.deviceId);if(!job)return new Response('Job not found',{status:404});return new Response(job.content,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}})}catch{return new Response('Unavailable',{status:503})}}

export async function DELETE(req:Request){try{const owner=await authenticate(req);if(!owner)return denied();const params=new URL(req.url).searchParams;const token=params.get('token'),code=params.get('code');if(!token||!code)return json({error:'Token e código obrigatórios.'},400);await change(owner,s=>confirmPrint((s.printJobs||[]).filter(j=>(j.destination||'kitchen')==='kitchen'&&!j.deviceId),token,code));return new Response(null,{status:200,headers:{'Cache-Control':'no-store'}})}catch{return json({error:'Não foi possível confirmar esta comanda.'},409)}}
