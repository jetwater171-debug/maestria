import type {Role,State} from './domain.ts';
import type {PrintJob} from './printing.ts';

export const HUB_TTL_MS=20000;

function validDeviceId(deviceId:string){
 if(typeof deviceId!=='string'||!deviceId.trim()||deviceId.length>80)throw Error('Identificação da central inválida.');
}

function validTime(now:string){
 if(!Number.isFinite(Date.parse(now)))throw Error('Horário da central inválido.');
}

export function hubOnline(state:State,now=new Date().toISOString()){
 const hub=state.printer?.hub;
 if(!hub)return false;
 const elapsed=Date.parse(now)-Date.parse(hub.lastSeen);
 return Number.isFinite(elapsed)&&elapsed>=0&&elapsed<HUB_TTL_MS;
}

export function registerHub(state:State,deviceId:string,now=new Date().toISOString()){
 validDeviceId(deviceId);validTime(now);
 const previous=state.printer?.hub;
 const online=hubOnline(state,now);
 if(online&&previous?.deviceId!==deviceId)throw Error('Outro aparelho já está como central de impressão. Desative-o ou aguarde a conexão expirar.');
 const hub={deviceId,lastSeen:now,startedAt:online&&previous?.deviceId===deviceId?previous.startedAt:now};
 state.printer={...state.printer,enabled:state.printer?.enabled??false,hub};
 return hub;
}

export function touchHub(state:State,deviceId:string,now=new Date().toISOString()){
 validDeviceId(deviceId);validTime(now);
 const hub=state.printer?.hub;
 if(!hub||hub.deviceId!==deviceId)throw Error('Este aparelho não é mais a central de impressão.');
 hub.lastSeen=now;
 return hub;
}

export function releaseHub(state:State,deviceId:string){
 if(state.printer?.hub?.deviceId===deviceId)delete state.printer.hub;
}

function mayRequest(job:PrintJob,role:Role,employeeId?:string){
 if(role==='owner')return true;
 if(role==='kitchen')return (job.destination||'kitchen')==='kitchen';
 return role==='waiter'&&job.destination==='waiter'&&!!employeeId&&job.employeeId===employeeId;
}

export function requestHubPrint(state:State,jobId:string,role:Role,employeeId?:string,now=new Date().toISOString()){
 validTime(now);
 const job=state.printJobs?.find(j=>j.id===jobId);
 if(!job||!mayRequest(job,role,employeeId))throw Error('Você não pode imprimir esta comanda.');
 if(!state.printer?.relayEnabled)throw Error('O responsável precisa ativar a impressão pela central.');
 if(!hubOnline(state,now))throw Error('A central de impressão está desconectada. Abra a cozinha no aparelho conectado à impressora.');
 if(job.status!=='queued')throw Error('Esta comanda já foi enviada ou precisa de conferência. Confira o papel antes de solicitar uma segunda via.');
 if(state.orders.some(o=>o.id===job.orderId&&o.status==='cancelled')&&!job.content.includes('\nCANCELAMENTO\n'))throw Error('Pedido cancelado. Use a comanda de cancelamento para avisar a cozinha.');
 const hubId=state.printer.hub!.deviceId;
 if(job.relay?.hubId!==hubId)job.relay={hubId,requestedAt:now,...(employeeId?{requestedBy:employeeId}:{})};
 return job;
}

export function hubJobs(state:State,deviceId:string,now=new Date().toISOString()){
 if(state.printer?.hub?.deviceId!==deviceId||!hubOnline(state,now))throw Error('Este aparelho não é mais a central de impressão.');
 return (state.printJobs||[]).filter(job=>{
  if((job.destination||'kitchen')==='kitchen')return state.printer?.mode!=='waiter';
  return state.printer?.relayEnabled===true&&job.relay?.hubId===deviceId;
 });
}
