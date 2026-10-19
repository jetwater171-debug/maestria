'use client';
import {useEffect,useRef,useState} from 'react';
import {Printer,Pause} from 'lucide-react';
import {printerAvailable,printKitchenReceipt} from '@/lib/kitchen-printer';
import {toast} from 'sonner';
import {printerTestConfirmed} from '@/lib/printer-events';
import PrinterSetupGuide from './printer-setup-guide';
import {usePrinterDevice} from './use-printer-device';
export default function AutomaticKitchenPrinter({authorization,demo,connectionOnly=false}:{authorization:string;demo:boolean;connectionOnly?:boolean}){
 const [expanded,setExpanded]=useState(false),[enabled,setEnabled]=useState(false),[starting,setStarting]=useState(false),[message,setMessage]=useState('Conecte e confira o teste para imprimir neste aparelho.');
 const device=useRef(''),since=useRef(''),inFlight=useRef(false);
 const capabilities=usePrinterDevice();
 useEffect(()=>{device.current=crypto.randomUUID()},[]);
 useEffect(()=>{
  if(connectionOnly||!enabled||!authorization||demo)return;
  let disposed=false;
  async function request(body:Record<string,unknown>){const r=await fetch('/api/local-print',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${authorization}`},body:JSON.stringify({...body,deviceId:device.current}),signal:AbortSignal.timeout(12000)});const data=await r.json() as {error?:string;job?:{id:string;content:string}|null};if(!r.ok)throw Error(data.error||'Falha na conexão.');return data}
  async function tick(){
   if(disposed||document.hidden||inFlight.current)return;
   if(!printerAvailable()||!printerTestConfirmed()){setEnabled(false);setMessage('Impressora desconectada. Reconecte e confira o teste para continuar.');return}
   inFlight.current=true;const claimToken=crypto.randomUUID();
   try{
    const {job}=await request({type:'claim',claimToken,since:since.current});
    if(job){
     setMessage('Enviando comanda…');
     let success=false;
     try{await printKitchenReceipt(job.id,job.content);success=true}finally{await request({type:'finish',claimToken,jobId:job.id,success})}
     if(!disposed)setMessage('Comanda enviada. Aguardando o próximo pedido.');
    }
   }catch(e){if(!disposed){setEnabled(false);setMessage((e as Error).message);toast.error('Impressão pausada. Confira a conexão e o papel antes de retomar.')}}finally{inFlight.current=false}
  }
  void tick();const timer=setInterval(tick,2000);return()=>{disposed=true;clearInterval(timer)};
 },[enabled,authorization,demo,connectionOnly]);
 async function activate(){
  if(enabled){setEnabled(false);setMessage('Impressão pausada.');return}
  if(!capabilities.connected||!capabilities.verified){setExpanded(true);setMessage('Conecte e confirme que o teste saiu no papel antes de ativar.');return}
  setStarting(true);
  try{if(!since.current){const r=await fetch('/api/local-print',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${authorization}`},body:JSON.stringify({type:'arm',deviceId:device.current,claimToken:crypto.randomUUID()}),signal:AbortSignal.timeout(12000)});const d=await r.json() as {since?:string;error?:string};if(!r.ok||!d.since)throw Error(d.error||'Não foi possível ativar. Confira a internet.');since.current=d.since;}setEnabled(true);setMessage('Ativada. Novos pedidos serão enviados à impressora conectada.')}catch(e){setMessage((e as Error).message)}finally{setStarting(false)}
 }
 return <div className="auto-kitchen-printer"><div><strong><Printer size={18}/> {connectionOnly?'Configurar este aparelho':'Impressão na cozinha'}</strong><p role="status">{message}</p></div><button className="text-button printer-configure" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Fechar configuração':'Configurar impressora'}</button>{expanded&&<PrinterSetupGuide demo={demo} locked={enabled||starting} onTestConfirmed={()=>setMessage('Teste conferido. Impressora pronta para uso.')} onMethodSelected={method=>{if(method!=='direct')setMessage('Método com toque escolhido. Use Imprimir comanda em cada pedido.')}}/>}{!connectionOnly&&<div className="printer-auto-controls"><button className={enabled?'outline':'primary'} disabled={demo||starting||(!enabled&&(!capabilities.connected||!capabilities.verified))} onClick={activate}>{enabled?<Pause size={16}/>:<Printer size={16}/>} {starting?'Ativando…':enabled?'Pausar automático':'Ativar automático'}</button><small>{enabled?'Mantenha a cozinha aberta e a tela ligada.':capabilities.connected&&!capabilities.verified?'Confirme a saída do teste em Configurar impressora.':'O automático usa a conexão direta. Aplicativos auxiliares exigem toque.'}</small></div>}</div>;
}
