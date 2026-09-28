'use client';
import {useState} from 'react';
import {Printer} from 'lucide-react';
import {toast} from 'sonner';
import {androidPrintIntent,receiptHtml} from '@/lib/android-print';

export default function ReceiptPrintButton({content}:{content:string}){
 const [sent,setSent]=useState(false);
 function print(){
  if(sent&&!window.confirm('Confira se a comanda já saiu. Enviar novamente pode imprimir uma segunda via. Continuar?'))return;
  if(/Android/i.test(navigator.userAgent)){
   // Keep navigation in the click handler so Chrome can open the Android app.
   window.location.href=androidPrintIntent(content);setSent(true);
   toast('Comanda enviada ao aplicativo. Confira se o papel saiu.');return;
  }
  const popup=window.open('','_blank','width=420,height=640');
  if(!popup){toast.error('Permita abrir a janela de impressão neste navegador.');return}
  popup.document.write(receiptHtml(content));popup.document.close();popup.focus();popup.print();
 }
 return <button className="outline full" onClick={print}><Printer size={17}/>{sent?'Enviar novamente à impressora':'Imprimir comanda'}</button>;
}
