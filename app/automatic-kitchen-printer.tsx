'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Printer,Pause} from 'lucide-react';
import {printerAvailable,printKitchenReceipt} from '@/lib/kitchen-printer';
import {toast} from 'sonner';
import {printerTestConfirmed} from '@/lib/printer-events';
import PrinterSetupGuide from './printer-setup-guide';
import {usePrinterDevice} from './use-printer-device';
import type {State} from '@/lib/domain';
export default function AutomaticKitchenPrinter({authorization,demo,connectionOnly=false,state}:{authorization:string;demo:boolean;connectionOnly?:boolean;state?:State}){
 const [expanded,setExpanded]=useState(false),[enabled,setEnabled]=useState(false),[starting,setStarting]=useState(false),[message,setMessage]=useState('Conecte e confira o teste para imprimir neste aparelho.');
 const device=useRef(''),since=useRef(''),inFlight=useRef(false),auth=useRef(authorization),releasing=useRef<{deviceId:string;promise:Promise<void>}|null>(null);const authenticated=!!authorization;
 useEffect(()=>{auth.current=authorization},[authorization]);
 const capabilities=usePrinterDevice();
 const release=useCallback((deviceId:string)=>{
  if(!deviceId)return Promise.resolve();
  if(releasing.current?.deviceId===deviceId)return releasing.current.promise;
  const promise=fetch('/api/local-print',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.current}`},body:JSON.stringify({type:'release',deviceId,claimToken:crypto.randomUUID()}),signal:AbortSignal.timeout(12000)}).then(()=>{}).catch(()=>{});
  releasing.current={deviceId,promise};return promise;
 },[]);
 useEffect(()=>{
  if(connectionOnly||!enabled||!authenticated||demo)return;
  let disposed=false,heartbeatInFlight=false;const sessionDevice=device.current;
  async function request(body:Record<string,unknown>){const r=await fetch('/api/local-print',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.current}`},body:JSON.stringify({...body,hub:true,deviceId:sessionDevice}),signal:AbortSignal.timeout(12000)});const data=await r.json() as {error?:string;job?:{id:string;content:string}|null};if(!r.ok)throw Error(data.error||'Falha na conexão.');return data}
  function pauseAfterError(error:unknown){if(!disposed){setEnabled(false);setMessage((error as Error).message);toast.error('Impressão pausada. Confira a conexão e o papel antes de retomar.')}}
  async function heartbeat(){
   if(disposed||document.hidden||!inFlight.current||heartbeatInFlight)return;
   heartbeatInFlight=true;
   try{await request({type:'heartbeat',claimToken:crypto.randomUUID()})}catch(e){pauseAfterError(e)}finally{heartbeatInFlight=false}
  }
  async function tick(){
   if(disposed||document.hidden||inFlight.current||heartbeatInFlight)return;
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
   }catch(e){pauseAfterError(e)}finally{inFlight.current=false}
  }
  void tick();const timer=setInterval(()=>{if(inFlight.current)void heartbeat();else void tick()},4000);return()=>{disposed=true;clearInterval(timer);if(device.current===sessionDevice)device.current='';void release(sessionDevice)};
 },[enabled,authenticated,demo,connectionOnly,release]);
 async function activate(){
  if(enabled){const previous=device.current;device.current='';setEnabled(false);setMessage('Impressão pausada.');void release(previous);return}
  if(!capabilities.connected||!capabilities.verified){setExpanded(true);setMessage('Conecte e confirme que o teste saiu no papel antes de ativar.');return}
  setStarting(true);
  try{await releasing.current?.promise;device.current||=crypto.randomUUID();const r=await fetch('/api/local-print',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.current}`},body:JSON.stringify({type:'arm',hub:true,deviceId:device.current,claimToken:crypto.randomUUID()}),signal:AbortSignal.timeout(12000)});const d=await r.json() as {since?:string;error?:string};if(!r.ok||!d.since)throw Error(d.error||'Não foi possível ativar. Confira a internet.');since.current||=d.since;setEnabled(true);setMessage('Central ativada. Pedidos e solicitações autorizadas chegam por este aparelho.')}catch(e){setMessage((e as Error).message)}finally{setStarting(false)}
 }
 return <div className="auto-kitchen-printer"><div><strong><Printer size={18}/> {connectionOnly?'Configurar este aparelho':'Central de impressão'}</strong><p role="status">{message}</p></div><button className="text-button printer-configure" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Fechar configuração':'Configurar impressora'}</button>{expanded&&<PrinterSetupGuide centralPrinter={state?.printer} demo={demo} locked={enabled||starting} onTestConfirmed={()=>setMessage('Teste conferido. Impressora pronta para uso.')} onMethodSelected={method=>{if(method!=='direct')setMessage('Método com toque escolhido. Use Imprimir comanda em cada pedido.')}}/>}{!connectionOnly&&<div className="printer-auto-controls"><button className={enabled?'outline':'primary'} disabled={demo||starting||(!enabled&&(!capabilities.connected||!capabilities.verified))} onClick={activate}>{enabled?<Pause size={16}/>:<Printer size={16}/>} {starting?'Ativando…':enabled?'Pausar automático':'Ativar automático'}</button><small>{enabled?'Deixe esta tela aberta, com internet e a impressora conectada.':capabilities.connected&&!capabilities.verified?'Confirme a saída do teste em Configurar impressora.':state?.printer?.relayEnabled?'A central atende também solicitações dos celulares sem Bluetooth no navegador.':'O dono pode permitir solicitações de outros celulares em Configurações.'}</small></div>}</div>;
}
