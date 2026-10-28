import type {State} from './domain.ts';
import {accountDefaults,invoiceStatus} from './saas-billing.ts';

export type AdminIssue={id:string;severity:'urgent'|'warning'|'setup';title:string;detail:string;action:string};
export type VenueHealth={checkedAt:string;queued:number;delayed:number;inProgress:number;stalled:number;failed24h:number;uncertain24h:number;issues:AdminIssue[]};

// A snapshot of persisted state: browser connections and physical paper are not observable here.
export function venueHealth(state:State,now=new Date().toISOString()):VenueHealth{
 const timestamp=Date.parse(now),today=new Date(now).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 const jobs=state.printJobs||[],age=(value:string)=>timestamp-Date.parse(value);
 const queued=jobs.filter(j=>j.status==='queued'),printing=jobs.filter(j=>j.status==='printing');
 const recent=jobs.filter(j=>age(j.createdAt)>=0&&age(j.createdAt)<86400000&&j.error!=='Pedido cancelado antes de imprimir.');
 const health:VenueHealth={checkedAt:now,queued:queued.length,delayed:queued.filter(j=>age(j.createdAt)>120000).length,inProgress:printing.length,stalled:printing.filter(j=>age(j.claimedAt||j.createdAt)>90000).length,failed24h:recent.filter(j=>j.status==='failed').length,uncertain24h:recent.filter(j=>j.status==='uncertain').length,issues:[]};
 const add=(id:string,severity:AdminIssue['severity'],title:string,detail:string,action:string)=>health.issues.push({id,severity,title,detail,action});
 if(health.uncertain24h)add('uncertain','urgent','Conferir papel antes de reimprimir',`${health.uncertain24h} envio(s) incerto(s) registrado(s) nas últimas 24 horas. Pode haver segunda via posterior.`, 'Peça ao responsável para conferir o papel e o histórico de comandas.');
 if(health.stalled)add('stalled','urgent','Envio sem conclusão registrada',`${health.stalled} comanda(s) em envio há mais de 90 segundos.`, 'Confira a impressora e a fila antes de liberar outra via.');
 if(health.failed24h)add('failed','warning','Falhas de impressão registradas',`${health.failed24h} falha(s) em comandas criadas nas últimas 24 horas. O histórico pode incluir tentativas já refeitas.`, 'Confira as falhas com o responsável pela barraca.');
 if(health.delayed)add('queue','warning','Comandas aguardando envio',`${health.delayed} comanda(s) na fila há mais de 2 minutos.`, 'Peça ao garçom ou à cozinha para abrir a fila e verificar a conexão.');
 const account=accountDefaults(state.saas),overdue=account.invoices.filter(i=>invoiceStatus(i,today)==='overdue');
 if(overdue.length)add('overdue','warning','Cobranças do SaaS vencidas',`${overdue.length} cobrança(s) em aberto com vencimento anterior a hoje.`, 'Confira os recebimentos antes de combinar a cobrança.');
 if(account.status==='active'&&account.monthlyFee===0)add('price','setup','Mensalidade a definir','A assinatura está ativa com valor zero.','Defina o valor acordado na assinatura antes de gerar mensalidades.');
 if(account.status==='trial'&&account.trialUntil&&account.trialUntil<today)add('trial','warning','Período de teste encerrado',`O teste terminou em ${account.trialUntil.split('-').reverse().join('/')}. O acesso continua liberado.`, 'Combine o plano e atualize a assinatura.');
 if(account.status!=='cancelled'&&account.status!=='paused'){
  if(!state.tables.length)add('tables','setup','Mesas ainda não cadastradas','A operação não tem mesas cadastradas.','Oriente o dono a cadastrar as mesas no sistema.');
  if(!state.products.length)add('menu','setup','Cardápio ainda não cadastrado','A operação não tem produtos cadastrados.','Oriente o dono a cadastrar ou importar o cardápio.');
 }
 return health;
}
