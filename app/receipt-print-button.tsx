'use client';
import {useSyncExternalStore,useRef,useState} from 'react';
import {Printer} from 'lucide-react';
import {toast} from 'sonner';
import {androidPrintIntent,rawBtLink,receiptHtml} from '@/lib/android-print';
import {printerAvailable,printKitchenReceipt} from '@/lib/kitchen-printer';
import type {PrintJob} from '@/lib/printing';
import {preferredReceiptMethod,type ReceiptPrintMethod} from '@/lib/print-method';
import {subscribePrinterChange,savePrintMethod} from '@/lib/printer-events';
import PrinterSetupGuide from './printer-setup-guide';
import {usePrinterDevice} from './use-printer-device';
type Method=ReceiptPrintMethod;
const savedPreference=()=>{try{return localStorage.getItem('maestria-print-method')||''}catch{return ''}};
type Prepared={id:string;content:string;deviceId:string;claimToken:string};
export default function ReceiptPrintButton({content,jobId,authorization,status='queued',demo=false}:{content:string;jobId?:string;authorization?:string;status?:PrintJob['status'];demo?:boolean}){
 const [sent,setSent]=useState(false),[busy,setBusy]=useState(false),[prepared,setPrepared]=useState<Prepared|null>(null),[launched,setLaunched]=useState(false),[setupOpen,setSetupOpen]=useState(false);
 const lock=useRef(false);
 const device=usePrinterDevice();const saved=useSyncExternalStore(subscribePrinterChange,savedPreference,()=>'');const android=device.platform==='android';const method=preferredReceiptMethod(device,device.connected,saved);
 function choose(value:Method){if(value!=='direct'&&device.connected){setSetupOpen(true);toast('Desconecte a impressora do site antes de trocar o método.');return}savePrintMethod(value)}
 async function request(p:Prepared,body:Record<string,unknown>){const r=await fetch('/api/local-print',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${authorization}`},body:JSON.stringify({...body,deviceId:p.deviceId,claimToken:p.claimToken}),signal:AbortSignal.timeout(12000)});const d=await r.json() as {error?:string;job?:{id:string;content:string}|null};if(!r.ok)throw Error(d.error||'Não foi possível preparar a impressão.');return d}
 async function finish(success:boolean,p=prepared){
  if(!p||lock.current)return;lock.current=true;setBusy(true);
  try{if(jobId&&authorization&&!demo)await request(p,{type:'finish',jobId:p.id,success});setSent(success);setPrepared(null);setLaunched(false);toast(success?'Conferência registrada. Leve a comanda à cozinha.':'Confira o papel antes de tentar outra via.')}catch(e){toast.error((e as Error).message)}finally{lock.current=false;setBusy(false)}
 }
 async function prepare(){
  if(lock.current)return;
  const reprint=sent||['sent','printed','failed','uncertain'].includes(status);
  if(reprint&&!window.confirm('Uma segunda via pode duplicar o preparo. Confira o papel e confirme para continuar.'))return;
  if(demo){toast('Demonstração: nenhum pedido será enviado à impressora.');return}
  if(method==='direct'&&(!printerAvailable()||!device.verified)){setSetupOpen(true);return}
  if(method==='system'&&device.platform==='ios'&&saved!=='system'){setSetupOpen(true);return}
  lock.current=true;setBusy(true);
  const p:Prepared={id:jobId||crypto.randomUUID(),content,deviceId:crypto.randomUUID(),claimToken:crypto.randomUUID()};
  try{
   if(jobId){if(!authorization)throw Error('Entre novamente para imprimir.');const {job}=await request(p,{type:'claim',jobId,reprint,since:'2000-01-01T00:00:00Z'});if(!job){toast('Há um envio em andamento ou a comanda já foi enviada. Confira a fila e o papel antes de repetir.');return}p.id=job.id;p.content=job.content}
   setPrepared(p);setLaunched(false);
   if(method==='direct'){
    let success=false;try{await printKitchenReceipt(p.id,p.content);success=true}finally{if(jobId&&authorization)await request(p,{type:'finish',jobId:p.id,success})}
    setSent(true);setPrepared(null);toast('Enviado à impressora conectada. Confira o papel.');
   }
  }catch(e){if(method==='direct'){setPrepared(null);setSent(true);setSetupOpen(true)}toast.error((e as Error).message)}finally{lock.current=false;setBusy(false)}
 }
 function systemPrint(){if(launched&&!window.confirm('Você já abriu este envio. Reabrir pode imprimir duas vezes. Continuar?'))return;const popup=window.open('','_blank','width=420,height=640');if(!popup){toast.error('Permita abrir a janela de impressão.');return}popup.document.write(receiptHtml(prepared!.content));popup.document.close();popup.focus();popup.print();setLaunched(true)}
 return <div className="receipt-actions">
 {!prepared?<><button className="outline full" disabled={busy} onClick={prepare}><Printer size={17}/>{busy?'Preparando…':sent||['sent','printed','failed','uncertain'].includes(status)?'Conferir / imprimir outra via':status==='printing'?'Verificar envio da comanda':'Imprimir comanda'}</button><button className="text-button receipt-configure" aria-expanded={setupOpen} onClick={()=>setSetupOpen(!setupOpen)}>{setupOpen?'Fechar configuração':'Configurar impressora / ver tutorial'}</button>{setupOpen&&<PrinterSetupGuide demo={demo} onMethodSelected={value=>{choose(value);setSetupOpen(false)}}/>}<details><summary>Outras formas de imprimir</summary><label>Método de impressão<select value={method} onChange={e=>choose(e.target.value as Method)}>{android&&<><option value="rawbt">RawBT · Bluetooth pelo aplicativo</option><option value="openescpos">Open ESC/POS · aplicativo alternativo</option></>}{(device.directSerial||device.directBle||device.connected)&&<option value="direct">{device.connected?'Impressora conectada ao site':'Conectar pelo site · sem aplicativo'}</option>}<option value="system">{device.platform==='ios'?'Impressão do iPhone · AirPrint compatível':'Impressão do navegador'}</option></select></label>{android&&<p>Instale o <a href="https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter" target="_blank" rel="noreferrer">RawBT</a>, escolha a TC-163 nas configurações dele e faça um teste em papel de 58 mm. Permita abrir links em aplicativos no navegador. Se bloquear, use a impressão do navegador com um serviço de impressão instalado ou abra o site fora do WhatsApp/Instagram.</p>}</details></>:<div className="receipt-handoff" role="status"><strong>Comanda preparada</strong><p>{launched?'Confira se o papel saiu antes de concluir.':'Toque abaixo para abrir a impressão. Depois volte e confira o papel.'}</p>{method==='rawbt'||method==='openescpos'?<a className="primary full" href={method==='rawbt'?rawBtLink(prepared.content):androidPrintIntent(prepared.content)} onClick={e=>{if(launched&&!window.confirm('Você já abriu este envio. Reabrir pode imprimir duas vezes. Continuar?')){e.preventDefault();return}setLaunched(true)}}>Abrir {method==='rawbt'?'RawBT':'Open ESC/POS'} e imprimir</a>:<button className="primary full" disabled={busy} onClick={systemPrint}>Abrir impressão</button>}{launched&&<button className="primary full" disabled={busy} onClick={()=>finish(true)}>O papel saiu</button>}<button className="text-button" disabled={busy} onClick={()=>finish(false)}>Não saiu / cancelar envio</button><small>Abrir o aplicativo não confirma a impressão. Se este envio for interrompido, confira o papel antes de preparar outra via.</small></div>}
 </div>;
}
