export type PrintJob={id:string;orderId:string;content:string;status:'queued'|'printing'|'printed'|'failed'|'uncertain';createdAt:string;claimedAt?:string;completedAt?:string;error?:string};
export type PrinterState={enabled:boolean;lastSeen?:string;deviceStatus?:string};
export function ticket(venue:string,table:string,order:{id:string;createdAt:string;author:string;note:string;lines:{name:string;quantity:number;station:string;note?:string}[]},kind='NOVO PEDIDO'){
 const clean=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'');
 return clean([venue.toUpperCase(),kind,table.toUpperCase(),`#${order.id.slice(-8).toUpperCase()}`,new Date(order.createdAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),'--------------------------------',...order.lines.map(l=>`${l.quantity}x ${l.name}${l.note?'\n   OBS: '+l.note:''}\n   ${l.station==='bar'?'BAR':'COZINHA'}`),'--------------------------------',order.note?`OBS: ${order.note}`:'',`Atendimento: ${order.author}`,'COMANDA NAO FISCAL','\n\n'].join('\n'));
}
export function pollQueue(jobs:PrintJob[],device:{enabled:boolean;printingInProgress?:boolean;jobToken?:string;statusCode?:string},now=new Date().toISOString()){
 const active=jobs.find(j=>j.status==='printing');
 if(active){if(device.jobToken===active.id)return {jobReady:true,mediaTypes:['text/plain'],jobToken:active.id};if(Date.parse(now)-Date.parse(active.claimedAt||now)>90000){active.status='uncertain';active.error='Sem confirmação da impressora. Confira o papel antes de reimprimir.'}return {jobReady:false}}
 if(!device.enabled||device.printingInProgress||!/^200(?:\s|$)/.test(device.statusCode||''))return {jobReady:false};
 const job=jobs.find(j=>j.status==='queued');if(!job)return {jobReady:false};job.status='printing';job.claimedAt=now;return {jobReady:true,mediaTypes:['text/plain'],jobToken:job.id};
}
export function confirmPrint(jobs:PrintJob[],token:string,code:string){const j=jobs.find(j=>j.id===token);if(!j)throw Error('Comanda não encontrada.');if(j.status==='printed')return;if(!['printing','uncertain'].includes(j.status))throw Error('Comanda não está em impressão.');if(/^200(?:\s|$)/.test(code)){j.status='printed';j.completedAt=new Date().toISOString();delete j.error}else{j.status='failed';j.error='A impressora não concluiu a comanda. Código: '+code.slice(0,80)}}
