'use client';
import {useState} from 'react';
import {Printer} from 'lucide-react';
import {toast} from 'sonner';
import {androidPrintIntent,receiptHtml} from '@/lib/android-print';
import {printerAvailable,printKitchenReceipt} from '@/lib/kitchen-printer';

export default function ReceiptPrintButton({content,jobId,authorization}:{content:string;jobId?:string;authorization?:string}){
 const [sent,setSent]=useState(false),[busy,setBusy]=useState(false);
 async function print(){
  if(sent&&!window.confirm('Confira se a comanda já saiu. Enviar novamente pode imprimir uma segunda via. Continuar?'))return;
  if(printerAvailable()){
   setBusy(true);const deviceId=crypto.randomUUID(),claimToken=crypto.randomUUID();
   async function request(body:Record<string,unknown>){const r=await fetch('/api/local-print',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${authorization}`},body:JSON.stringify({...body,deviceId,claimToken}),signal:AbortSignal.timeout(12000)});const d=await r.json() as {error?:string;job?:{id:string;content:string}|null};if(!r.ok)throw Error(d.error);return d}
   try{
    if(jobId&&authorization){
     const {job}=await request({type:'claim',jobId,since:'2000-01-01T00:00:00Z'});
     if(!job){toast('Comanda já enviada ou outra impressão em andamento. Para outra via, use Reimprimir no painel.');return}
     let success=false;try{await printKitchenReceipt(job.id,job.content);success=true}finally{await request({type:'finish',jobId:job.id,success})}
    }else await printKitchenReceipt(crypto.randomUUID(),content);
    setSent(true);toast('Comanda enviada por Bluetooth. Confira o papel.');
   }catch(e){toast.error((e as Error).message)}finally{setBusy(false)}return;
  }
  if(/Android/i.test(navigator.userAgent)){
   // Keep navigation in the click handler so Chrome can open the Android app.
   window.location.href=androidPrintIntent(content);setSent(true);
   toast('Comanda enviada ao aplicativo. Confira se o papel saiu.');return;
  }
  const popup=window.open('','_blank','width=420,height=640');
  if(!popup){toast.error('Permita abrir a janela de impressão neste navegador.');return}
  popup.document.write(receiptHtml(content));popup.document.close();popup.focus();popup.print();
 }
 return <button className="outline full" disabled={busy} onClick={print}><Printer size={17}/>{busy?'Enviando…':sent?'Enviar novamente à impressora':'Imprimir comanda'}</button>;
}
