import type {Role,State} from './domain.ts';
import type {PrintJob} from './printing.ts';
export function canPrintJob(job:PrintJob,role:Role,employeeId?:string){
 if(role==='owner')return true;
 if(role==='kitchen')return (job.destination||'kitchen')==='kitchen';
 return role==='waiter'&&job.destination==='waiter'&&!!employeeId&&job.employeeId===employeeId;
}
export function printScope(state:State,role:Role,employeeId?:string,jobId?:string){
 const jobs=state.printJobs||[];
 if(jobId){
  const target=jobs.find(j=>j.id===jobId);
  if(!target||!canPrintJob(target,role,employeeId))throw Error('Você não pode imprimir esta comanda.');
  const destination=target.destination||'kitchen';
  return jobs.filter(j=>(j.destination||'kitchen')===destination&&(destination==='kitchen'||j.employeeId===target.employeeId));
 }
 if(!['owner','kitchen'].includes(role)||state.printer?.mode==='waiter')throw Error('A impressão automática está reservada ao modo cozinha.');
 return jobs.filter(j=>(j.destination||'kitchen')==='kitchen');
}
export function copyPrintJob(state:State,jobId:string,id:string,role:Role,employeeId?:string){
 const old=state.printJobs?.find(j=>j.id===jobId);
 if(!old||!canPrintJob(old,role,employeeId))throw Error('Você não pode imprimir esta comanda.');
 if(state.orders.some(o=>o.id===old.orderId&&o.status==='cancelled')&&!old.content.includes('\nCANCELAMENTO\n'))throw Error('Pedido cancelado. Use a comanda de cancelamento para avisar a cozinha.');
 if(['queued','printing'].includes(old.status))throw Error('Esta comanda já está na fila. Confira o envio em andamento.');
 if(state.printJobs!.some(j=>j.orderId===old.orderId&&['queued','printing'].includes(j.status)))throw Error('Já existe uma via pendente deste pedido. Confira a fila.');
 if(state.printJobs!.some(j=>j.id===id))throw Error('Esta solicitação já foi recebida. Confira o papel.');
 const job:PrintJob={id,orderId:old.orderId,destination:old.destination||'kitchen',employeeId:old.employeeId,content:'SEGUNDA VIA - CONFERIR DUPLICIDADE\n'+old.content,status:'queued',createdAt:new Date().toISOString()};
 state.printJobs!.push(job);return job;
}
