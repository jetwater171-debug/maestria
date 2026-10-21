import type {State} from './domain.ts';
import type {PrintJob} from './printing.ts';
import {printerAvailable,printKitchenReceipt} from './kitchen-printer.ts';
import {printerTestConfirmed} from './printer-events.ts';

export type PortablePrintResult={id:string;status:'sent'|'unavailable'|'uncertain'|'skipped'|'failed';message:string};
type Dependencies={ready:()=>boolean;write:(id:string,content:string)=>Promise<void>;fetcher:typeof fetch};
export function createPortableAutoPrinter(deps:Dependencies){
 let tail:Promise<unknown>=Promise.resolve();
 const pending=new Map<string,Promise<PortablePrintResult>>();
 return function enqueue(job:PrintJob,authorization:string,scope:string){
  const key=scope+':'+job.id;
  if(pending.has(key))return pending.get(key)!;
  async function run():Promise<PortablePrintResult>{
   const result=(status:PortablePrintResult['status'],message:string)=>({id:job.id,status,message});
   if(job.destination!=='waiter'||job.status!=='queued')return result('skipped','');
   if(!authorization||!deps.ready())return result('unavailable','Pedido salvo. Reconecte e teste a impressora para imprimir a comanda pendente.');
   const deviceId=crypto.randomUUID(),claimToken=crypto.randomUUID();
   async function request(body:Record<string,unknown>){
    const r=await deps.fetcher('/api/local-print',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${authorization}`},body:JSON.stringify({...body,deviceId,claimToken}),signal:AbortSignal.timeout(12000)});
    const data=await r.json() as {error?:string;job?:{id:string;content:string}|null};
    if(!r.ok)throw Error(data.error||'Não foi possível reservar a comanda.');return data;
   }
   let reserved:{id:string;content:string}|null|undefined;
   try{reserved=(await request({type:'claim',jobId:job.id,since:'2000-01-01T00:00:00Z'})).job}
   catch{return result('failed','Pedido salvo, mas o envio à impressora não foi confirmado. Confira a fila antes de tentar outra via.')}
   if(!reserved)return result('skipped','Comanda em andamento ou já enviada. Confira a fila e o papel.');
   let success=false;
   try{if(!deps.ready())throw Error('Impressora desconectada.');await deps.write(reserved.id,reserved.content);success=true}catch{/* Never retry a possibly partial write. */}
   try{await request({type:'finish',jobId:reserved.id,success})}catch{return result('uncertain','Pedido salvo. A confirmação do envio se perdeu. Confira o papel antes de imprimir outra via.')}
   return success?result('sent','Comanda enviada à impressora. Confira o papel e leve à cozinha.'):result('uncertain','Pedido salvo, mas a impressão foi interrompida. Confira o papel antes de repetir.');
  }
  const task=tail.then(run,run);tail=task.catch(()=>{});pending.set(key,task);
  // Only deduplicate concurrent calls; the server reservation prevents later duplicates.
  void task.finally(()=>{if(pending.get(key)===task)pending.delete(key)}).catch(()=>{});
  return task;
 };
}
const enqueue=createPortableAutoPrinter({ready:()=>printerAvailable()&&printerTestConfirmed(),write:printKitchenReceipt,fetcher:(...args)=>fetch(...args)});
export function autoPrintPortableOrder(state:State,orderId:string,authorization:string,scope:string){
 const job=state.printJobs?.find(j=>j.orderId===orderId&&j.destination==='waiter');
 return job?enqueue(job,authorization,scope):Promise.resolve<PortablePrintResult|null>(null);
}
