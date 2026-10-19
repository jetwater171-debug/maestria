import {assertSubscription} from '@/lib/saas-billing';
import {resolveAccess} from '@/lib/access';
import {readVenue,saveVenue} from '@/lib/db';
import {claimLocalJob,finishLocalJob} from '@/lib/local-print-queue';
import {printScope,copyPrintJob} from '@/lib/print-access';
import {registerHub,touchHub,releaseHub,requestHubPrint,hubJobs} from '@/lib/print-hub';
import {z} from 'zod';
export const dynamic='force-dynamic';
const respond=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){
 try{
  const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return respond({error:'Origem inválida.'},403);
  const access=await resolveAccess(req);if(!access||!['owner','kitchen','waiter'].includes(access.role))return respond({error:'Acesso não autorizado.'},403);
  if(Number(req.headers.get('content-length')||0)>2000)throw Error('Pedido inválido.');
  const b=z.object({type:z.enum(['arm','claim','finish','relay','release','heartbeat']),hub:z.boolean().optional(),deviceId:z.string().min(1).max(80),claimToken:z.string().min(1).max(80),since:z.string().optional(),jobId:z.string().max(100).optional(),success:z.boolean().optional(),reprint:z.boolean().optional()}).parse(await req.json());
  if(b.type==='heartbeat'&&!b.hub)throw Error('Identifique a central de impressão.');
  if(b.type==='claim'&&(!b.since||!Number.isFinite(Date.parse(b.since))||Date.parse(b.since)>Date.now()+30000))throw Error('Horário inválido.');
  if((b.hub||b.type==='release')&&!['owner','kitchen'].includes(access.role))throw Error('Somente a cozinha pode ativar uma central.');
  for(let i=0;i<5;i++){
   const row=await readVenue(access.owner);if(!row)throw Error('Barraca não encontrada.');
   const state=row.state;assertSubscription(state.saas);
   if(access.employeeId&&!state.employees.some(e=>e.id===access.employeeId&&e.active&&e.role===access.role))throw Error('Acesso desativado.');
   const actor=access.employeeId??undefined,now=new Date().toISOString();
   const previous=JSON.stringify({printer:state.printer,jobs:state.printJobs});
   let result:Record<string,unknown>={job:null};
   if(b.type==='relay'){
    if(!b.jobId)throw Error('Selecione uma comanda.');
    let id=b.jobId;
    if(b.reprint)id=copyPrintJob(state,id,b.claimToken,access.role,actor).id;
    const job=requestHubPrint(state,id,access.role,actor,now);
    result={relayQueued:true,jobId:job.id};
   }else if(b.type==='release'){
    releaseHub(state,b.deviceId);result={released:true};
   }else if(b.type==='arm'&&b.hub){
    if(state.printer?.enabled)throw Error('Pause o CloudPRNT antes de ativar esta central.');
    if(state.printer?.mode==='waiter'&&!state.printer.relayEnabled)throw Error('O dono precisa permitir a central compartilhada nas configurações.');
    const hub=registerHub(state,b.deviceId,now);result={since:hub.startedAt};
   }else if(b.type==='heartbeat'){
    if(state.printer?.enabled)throw Error('Pause o CloudPRNT antes de imprimir pelo aparelho.');
    touchHub(state,b.deviceId,now);result={online:true};
   }else{
    let scope;
    if(b.hub&&b.type==='finish'){
     // An in-flight write may finish after its heartbeat expired. Its private claim still owns it.
     scope=(state.printJobs||[]).filter(j=>j.id===b.jobId&&j.deviceId===b.deviceId);
    }else if(b.hub){
     touchHub(state,b.deviceId,now);scope=hubJobs(state,b.deviceId,now);
    }else scope=printScope(state,access.role,actor,b.type==='arm'?undefined:b.jobId);
    if(b.type!=='finish'&&state.printer?.enabled&&(!b.jobId||scope.some(j=>(j.destination||'kitchen')==='kitchen')))throw Error('Pause o CloudPRNT antes de imprimir pelo aparelho.');
    if(b.type==='arm')result={since:now};
    else if(b.type==='claim'){
     let id=b.jobId;
     if(b.reprint){if(!id)throw Error('Selecione uma comanda.');id=copyPrintJob(state,id,b.claimToken,access.role,actor).id;scope=printScope(state,access.role,actor,id)}
     // Explicitly requested portable jobs are eligible even if the original order predates activation.
     const eligibleSince=b.hub?'2000-01-01T00:00:00Z':b.since!;
     const eligible=b.hub?scope.filter(j=>j.status==='printing'||j.relay?.hubId===b.deviceId||j.createdAt>=b.since!):scope;
     result={job:claimLocalJob(eligible,b.deviceId,b.claimToken,eligibleSince,now,id)};
    }else{
     if(typeof b.jobId!=='string'||typeof b.success!=='boolean')throw Error('Confirmação inválida.');
     finishLocalJob(scope,b.deviceId,b.claimToken,b.jobId,b.success);
    }
   }
   if(JSON.stringify({printer:state.printer,jobs:state.printJobs})===previous||await saveVenue(access.owner,row.version,state))return respond(result);
  }
  return respond({error:'Outra impressão atualizou a fila. Tente novamente.'},409);
 }catch(e){return respond({error:(e as Error).message},400)}
}
