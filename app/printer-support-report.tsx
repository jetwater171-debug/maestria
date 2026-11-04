'use client';
import {useState} from 'react';
import {Send,CheckCircle2} from 'lucide-react';
import {toast} from 'sonner';
import {printerTransport} from '@/lib/kitchen-printer';
import {diagnosticBrowser,type PrinterDiagnosticInput} from '@/lib/printer-diagnostics';
import {usePrinterDevice} from './use-printer-device';

export default function PrinterSupportReport({authorization,result}:{authorization?:string;result:PrinterDiagnosticInput['result']}){
 const device=usePrinterDevice();
 const [busy,setBusy]=useState(false),[receivedAt,setReceivedAt]=useState('');
 async function send(){
  if(!authorization||busy)return;
  setBusy(true);
  try{
   let method='unset' as PrinterDiagnosticInput['method'];
   try{const stored=localStorage.getItem('maestria-print-method');if(['direct','openescpos','system','hub'].includes(stored||''))method=stored as typeof method}catch{}
   const connected=device.connected,verified=connected&&device.verified;
   const report:PrinterDiagnosticInput={platform:device.platform,browser:diagnosticBrowser(navigator.userAgent),secureContext:device.secureContext,directSerial:device.directSerial,directBle:device.directBle,connected,verified,transport:printerTransport(),method,result:verified?'verified':!connected&&result==='connected'?'disconnected':result};
   const response=await fetch('/api/printer-diagnostics',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${authorization}`},body:JSON.stringify({type:'report',report}),signal:AbortSignal.timeout(12000)});
   const data=await response.json() as {error?:string;receivedAt?:string};
   if(!response.ok||!data.receivedAt)throw Error(data.error||'Não foi possível enviar o diagnóstico.');
   setReceivedAt(data.receivedAt);toast.success('Diagnóstico recebido pelo suporte do Maestria.');
  }catch(error){toast.error((error as Error).message||'Não foi possível enviar. Confira a conexão.')}
  finally{setBusy(false)}
 }
 if(!authorization)return null;
 return <section className="printer-support-card"><h3>Ajuda com esta impressora</h3><p>O suporte recebe o tipo de aparelho, as conexões disponíveis e o estado do teste neste momento.</p><button className="outline full" disabled={busy} onClick={send}><Send size={16}/>{busy?'Enviando diagnóstico…':'Enviar diagnóstico ao suporte'}</button>{receivedAt&&<p className="printer-guide-success" role="status"><CheckCircle2 size={16}/> Recebido às {new Date(receivedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}. Envie novamente se a conexão mudar.</p>}</section>;
}
