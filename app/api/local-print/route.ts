import {assertSubscription} from '@/lib/saas-billing';
import {resolveAccess} from '@/lib/access';
import {readVenue,saveVenue} from '@/lib/db';
import {claimLocalJob,finishLocalJob} from '@/lib/local-print-queue';
import {printScope,copyPrintJob} from '@/lib/print-access';
import {z} from 'zod';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 try{
  const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return Response.json({error:'Origem inválida.'},{status:403});
  const access=await resolveAccess(req);if(!access||!['owner','kitchen','waiter'].includes(access.role))return Response.json({error:'Acesso não autorizado.'},{status:403});
  if(Number(req.headers.get('content-length')||0)>2000)throw Error('Pedido inválido.');
  const b=z.object({type:z.enum(['arm','claim','finish']),deviceId:z.string().min(1).max(80),claimToken:z.string().min(1).max(80),since:z.string().optional(),jobId:z.string().max(100).optional(),success:z.boolean().optional(),reprint:z.boolean().optional()}).parse(await req.json());
  if(b.type==='claim'&&(!b.since||!Number.isFinite(Date.parse(b.since))||Date.parse(b.since)>Date.now()+30000))throw Error('Horário inválido.');
  for(let i=0;i<5;i++){
   const row=await readVenue(access.owner);if(!row)throw Error('Barraca não encontrada.');
   const state=row.state;assertSubscription(state.saas);
   if(access.employeeId&&!state.employees.some(e=>e.id===access.employeeId&&e.active&&e.role===access.role))throw Error('Acesso desativado.');
   const actor=access.employeeId??undefined;
   let scope=printScope(state,access.role,actor,b.type==='arm'?undefined:b.jobId);
   if(b.type!=='finish'&&state.printer?.enabled&&(!b.jobId||scope.some(j=>(j.destination||'kitchen')==='kitchen')))throw Error('Pause o CloudPRNT antes de imprimir pelo aparelho.');
   if(b.type==='arm')return Response.json({since:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
   const previous=JSON.stringify(state.printJobs);let job=null;
   if(b.type==='claim'){
    let id=b.jobId;
    if(b.reprint){if(!id)throw Error('Selecione uma comanda.');id=copyPrintJob(state,id,b.claimToken,access.role,actor).id;scope=printScope(state,access.role,actor,id)}
    job=claimLocalJob(scope,b.deviceId,b.claimToken,b.since!,undefined,id);
   }else{
    if(typeof b.jobId!=='string'||typeof b.success!=='boolean')throw Error('Confirmação inválida.');
    finishLocalJob(scope,b.deviceId,b.claimToken,b.jobId,b.success);
   }
   if(JSON.stringify(state.printJobs)===previous||await saveVenue(access.owner,row.version,state))return Response.json({job},{headers:{'Cache-Control':'no-store'}});
  }
  return Response.json({error:'Outra impressão atualizou a fila. Tente novamente.'},{status:409});
 }catch(e){return Response.json({error:(e as Error).message},{status:400})}
}
