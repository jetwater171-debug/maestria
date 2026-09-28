import type {PrintJob} from './printing.ts';

export function claimLocalJob(jobs:PrintJob[],deviceId:string,claimToken:string,since:string,now=new Date().toISOString(),jobId?:string){
 const active=jobs.find(j=>j.status==='printing');
 if(active){
  if(Date.parse(now)-Date.parse(active.claimedAt||now)>90000){active.status='uncertain';active.error='Conexão interrompida. Confira o papel antes de reimprimir.';return null}
  // Never resend a claimed job after an ambiguous HTTP response.
  return null;
 }
 const job=jobs.find(j=>j.status==='queued'&&(jobId?j.id===jobId:j.createdAt>=since));
 if(!job)return null;
 Object.assign(job,{status:'printing',claimedAt:now,deviceId,claimToken});
 return {id:job.id,content:job.content};
}

export function finishLocalJob(jobs:PrintJob[],deviceId:string,claimToken:string,id:string,success:boolean){
 const job=jobs.find(j=>j.id===id&&j.deviceId===deviceId&&j.claimToken===claimToken);
 if(!job)throw Error('Esta comanda pertence a outra conexão.');
 if(job.status==='sent')return;
 if(!['printing','uncertain'].includes(job.status))throw Error('Comanda não está em impressão.');
 job.status=success?'sent':'uncertain';job.completedAt=new Date().toISOString();
 job.error=success?undefined:'Não foi possível confirmar o envio completo. Confira o papel antes de reimprimir.';
}
