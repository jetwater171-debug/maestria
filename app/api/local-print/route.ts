import {resolveAccess} from '@/lib/access';
import {readVenue,saveVenue} from '@/lib/db';
import {claimLocalJob,finishLocalJob} from '@/lib/local-print-queue';
import {z} from 'zod';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 try{
  const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return Response.json({error:'Origem inválida.'},{status:403});
  const access=await resolveAccess(req);if(!access||!['owner','kitchen'].includes(access.role))return Response.json({error:'Acesso da cozinha necessário.'},{status:403});
  if(Number(req.headers.get('content-length')||0)>2000)throw Error('Pedido inválido.');
  const b=z.object({type:z.enum(['arm','claim','finish']),deviceId:z.string().min(1).max(80),claimToken:z.string().min(1).max(80),since:z.string().optional(),jobId:z.string().max(100).optional(),success:z.boolean().optional()}).parse(await req.json());
  if(b.type==='arm')return Response.json({since:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
  if(b.type==='claim'&&(!b.since||!Number.isFinite(Date.parse(b.since))||Date.parse(b.since)>Date.now()+30000))throw Error('Horário inválido.');
  for(let i=0;i<5;i++){
   const row=await readVenue(access.owner);if(!row)throw Error('Barraca não encontrada.');
   const state=row.state;
   if(state.printer?.enabled)throw Error('Pause a impressão Star CloudPRNT antes de usar Bluetooth.');
   const previous=JSON.stringify(state.printJobs);let job=null;
   if(b.type==='claim')job=claimLocalJob(state.printJobs||[],b.deviceId,b.claimToken,b.since!,undefined,b.jobId);
   else{if(typeof b.jobId!=='string'||typeof b.success!=='boolean')throw Error('Confirmação inválida.');finishLocalJob(state.printJobs||[],b.deviceId,b.claimToken,b.jobId,b.success)}
   if(JSON.stringify(state.printJobs)===previous||await saveVenue(access.owner,row.version,state))return Response.json({job},{headers:{'Cache-Control':'no-store'}});
  }
  return Response.json({error:'Cozinha ocupada. Tente novamente.'},{status:409});
 }catch(e){return Response.json({error:(e as Error).message},{status:400})}
}
