import type {State} from './domain.ts';
import {accountDefaults,invoiceStatus} from './saas-billing.ts';
import type {PrinterDiagnostic} from './printer-diagnostics.ts';

export type AdminIssue={id:string;severity:'urgent'|'warning'|'setup';title:string;detail:string;action:string};
export type VenueHealth={checkedAt:string;queued:number;delayed:number;inProgress:number;stalled:number;failed24h:number;uncertain24h:number;issues:AdminIssue[]};

// A snapshot of persisted state: browser connections and physical paper are not observable here.
export function venueHealth(state:State,now=new Date().toISOString()):VenueHealth{
 const timestamp=Date.parse(now),today=new Date(now).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 const jobs=state.printJobs||[],age=(value:string)=>timestamp-Date.parse(value);
 const queued=jobs.filter(j=>j.status==='queued'),printing=jobs.filter(j=>j.status==='printing');
 const recent=jobs.filter(j=>age(j.createdAt)>=0&&age(j.createdAt)<86400000&&j.error!=='Pedido cancelado antes de imprimir.');
 const health:VenueHealth={checkedAt:now,queued:queued.length,delayed:queued.filter(j=>age(j.createdAt)>120000).length,inProgress:printing.length,stalled:printing.filter(j=>age(j.claimHeartbeatAt||j.claimedAt||j.createdAt)>90000).length,failed24h:recent.filter(j=>j.status==='failed').length,uncertain24h:recent.filter(j=>j.status==='uncertain').length,issues:[]};
 const add=(id:string,severity:AdminIssue['severity'],title:string,detail:string,action:string)=>health.issues.push({id,severity,title,detail,action});
 if(health.uncertain24h)add('uncertain','urgent','Conferir papel antes de reimprimir',`${health.uncertain24h} envio(s) incerto(s) registrado(s) nas últimas 24 horas. Pode haver segunda via posterior.`, 'Peça ao responsável para conferir o papel e o histórico de comandas.');
 if(health.stalled)add('stalled','urgent','Envio sem atualização registrada',`${health.stalled} comanda(s) sem atualização do envio há mais de 90 segundos.`, 'Confira a impressora e a fila antes de liberar outra via.');
 if(health.failed24h)add('failed','warning','Falhas de impressão registradas',`${health.failed24h} falha(s) em comandas criadas nas últimas 24 horas. O histórico pode incluir tentativas já refeitas.`, 'Confira as falhas com o responsável pela barraca.');
 if(health.delayed)add('queue','warning','Comandas aguardando envio',`${health.delayed} comanda(s) na fila há mais de 2 minutos.`, 'Peça ao garçom ou à cozinha para abrir a fila e verificar a conexão.');
 const deviceFailures=(state.printerDiagnostics||[]).filter(report=>age(report.receivedAt)>=0&&age(report.receivedAt)<86400000&&['connection-failed','write-failed','disconnected'].includes(report.result));
 if(deviceFailures.length)add('device-report','warning','Celulares enviaram diagnóstico com falha',`${deviceFailures.length} aparelho(s) informou(aram) falha ou desconexão nas últimas 24 horas.`, 'Veja o diagnóstico recebido e combine um novo teste com o responsável.');
 const account=accountDefaults(state.saas),overdue=account.invoices.filter(i=>invoiceStatus(i,today)==='overdue');
 const openCases=account.supportCases.filter(c=>c.status==='open');
 if(openCases.length)add('support','warning','Atendimentos em aberto',`${openCases.length} atendimento(s) aguardando acompanhamento.`, 'Abra o histórico de suporte da barraca e registre o próximo contato.');
 if(overdue.length)add('overdue','warning','Cobranças do SaaS vencidas',`${overdue.length} cobrança(s) em aberto com vencimento anterior a hoje.`, 'Confira os recebimentos antes de combinar a cobrança.');
 if(account.status==='active'&&account.monthlyFee===0)add('price','setup','Mensalidade a definir','A assinatura está ativa com valor zero.','Defina o valor acordado na assinatura antes de gerar mensalidades.');
 if(account.status==='trial'&&account.trialUntil&&account.trialUntil<today)add('trial','warning','Período de teste encerrado',`O teste terminou em ${account.trialUntil.split('-').reverse().join('/')}. O acesso continua liberado.`, 'Combine o plano e atualize a assinatura.');
 if(account.status!=='cancelled'&&account.status!=='paused'){
  if(!state.tables.length)add('tables','setup','Mesas ainda não cadastradas','A operação não tem mesas cadastradas.','Oriente o dono a cadastrar as mesas no sistema.');
  if(!state.products.length)add('menu','setup','Cardápio ainda não cadastrado','A operação não tem produtos cadastrados.','Oriente o dono a cadastrar ou importar o cardápio.');
 }
 return health;
}

export type AdminPrintJob={id:string;orderId:string;table:string;employeeId:string;employeeName:string;destination:'kitchen'|'waiter';status:string;createdAt:string;claimedAt:string|null;claimHeartbeatAt:string|null;completedAt:string|null;error:string;cancelled:boolean;otherCopies:number};
export type PrintingDiagnostics={checkedAt:string;mode:'kitchen'|'waiter';cloudEnabled:boolean;relayEnabled:boolean;lastPrinterContact:string|null;printerStatus:string;health:VenueHealth;deviceReports:(PrinterDiagnostic&{actorName:string})[];staff:{id:string;name:string;active:boolean|null;queued:number;inProgress:number;uncertain:number;failed:number;total:number}[];jobs:AdminPrintJob[];total:number;page:number;pages:number;pageSize:number};
type DiagnosticsOptions={status?:string;employee?:string;destination?:string;query?:string;page?:string};
const printStatuses=['queued','printing','printed','sent','failed','uncertain'];

export function printingDiagnostics(state:State,options:DiagnosticsOptions={},now=new Date().toISOString()):PrintingDiagnostics{
 const status=options.status||'attention',employee=options.employee||'all',destination=options.destination||'all',query=(options.query||'').trim().toLocaleLowerCase('pt-BR');
 if(!['all','attention',...printStatuses].includes(status)||!['all','waiter','kitchen'].includes(destination)||query.length>120||employee.length>100)throw Error('Filtros de impressão inválidos.');
 if(options.page&&!/^[1-9]\d{0,5}$/.test(options.page))throw Error('Página inválida.');
 const pageSize=20,jobs=state.printJobs||[],orders=new Map(state.orders.map(order=>[order.id,order])),tables=new Map(state.tables.map(table=>[table.id,table.name])),staff=new Map<string,PrintingDiagnostics['staff'][number]>();
 const copies=new Map<string,number>();for(const job of jobs)copies.set(job.orderId,(copies.get(job.orderId)||0)+1);
 const mapped:AdminPrintJob[]=jobs.map(job=>{
  const order=orders.get(job.orderId),employeeId=job.employeeId||order?.employeeId||'unassigned',person=state.employees.find(e=>e.id===employeeId),employeeName=person?.name||order?.author||'Dono / sem funcionário atribuído';
  let member=staff.get(employeeId);if(!member){member={id:employeeId,name:employeeName,active:person?.active??null,queued:0,inProgress:0,uncertain:0,failed:0,total:0};staff.set(employeeId,member)}member.total++;
  if(job.status==='queued')member.queued++;if(job.status==='printing')member.inProgress++;if(job.status==='uncertain')member.uncertain++;if(job.status==='failed'&&job.error!=='Pedido cancelado antes de imprimir.')member.failed++;
  return {id:job.id,orderId:job.orderId,table:order?tables.get(order.tableId)||'Mesa removida':job.orderId==='test'?'Teste de impressão':'Pedido não localizado',employeeId,employeeName,destination:job.destination||'kitchen',status:job.status,createdAt:job.createdAt,claimedAt:job.claimedAt||null,claimHeartbeatAt:job.claimHeartbeatAt||null,completedAt:job.completedAt||null,error:(job.error||'').slice(0,500),cancelled:order?.status==='cancelled',otherCopies:job.orderId==='test'?0:(copies.get(job.orderId)||1)-1};
 });
 const filtered=mapped.filter(job=>(status==='all'||status==='attention'&&['queued','printing','failed','uncertain'].includes(job.status)||job.status===status)&&(employee==='all'||employee===job.employeeId)&&(destination==='all'||destination===job.destination)&&(!query||[job.id,job.orderId,job.table,job.employeeName,job.error].join(' ').toLocaleLowerCase('pt-BR').includes(query))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),page=Math.min(Number(options.page||1),pages);
 const deviceReports=[...(state.printerDiagnostics||[])].map(report=>({...report,actorName:report.actorId==='owner'?'Dono':state.employees.find(e=>e.id===report.actorId)?.name||'Funcionário removido'})).sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt));
 return {checkedAt:now,mode:state.printer?.mode||'kitchen',cloudEnabled:state.printer?.enabled===true,relayEnabled:state.printer?.relayEnabled===true,lastPrinterContact:state.printer?.lastSeen||null,printerStatus:(state.printer?.deviceStatus||'').slice(0,100),health:venueHealth(state,now),deviceReports,staff:[...staff.values()].sort((a,b)=>a.name.localeCompare(b.name)),jobs:filtered.slice((page-1)*pageSize,page*pageSize),total:filtered.length,page,pages,pageSize};
}

export function assertSupportJobs(state:State,action:{type:string;[key:string]:unknown}){
 if(action.type!=='supportOpen')return;
 if(!Array.isArray(action.jobIds)||action.jobIds.length>20||action.jobIds.some(id=>typeof id!=='string'||!(state.printJobs||[]).some(job=>job.id===id)))throw Error('Uma comanda selecionada não pertence a esta barraca.');
}
