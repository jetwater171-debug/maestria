'use client';
import {useEffect,useState} from 'react';
import {ArrowLeft,Check,Printer,Waves} from 'lucide-react';
import {Toaster} from 'sonner';
import PrinterSetupGuide from '../printer-setup-guide';
import {usePrinterDevice} from '../use-printer-device';
import {browserAuth} from '@/lib/supabase-browser';

export default function PrinterCheck(){
 const device=usePrinterDevice();
 const [authorization,setAuthorization]=useState('');
 useEffect(()=>{let active=true;const employee=sessionStorage.getItem('maestria-access');if(employee){setAuthorization(employee);return}void browserAuth().then(client=>client.auth.getSession()).then(({data})=>{if(active)setAuthorization(data.session?.access_token||'')}).catch(()=>{});return()=>{active=false}},[]);
 const step=device.connected?device.verified?3:2:1;
 return <main className="printer-check-page"><Toaster richColors position="top-center"/><header><a href="/" className="printer-check-brand"><Waves size={25}/><span>maestria<small>BEACH</small></span></a><a href="/painel"><ArrowLeft size={15}/> Voltar ao atendimento</a></header><section className="printer-check-intro"><span className="printer-check-eyebrow">SUA IMPRESSORA, COM VOCÊ</span><h1>Prepare a próxima comanda.</h1><p>Conecte a TC-163 neste celular e confira o papel de teste antes de começar a atender.</p><ol className="printer-check-steps" aria-label="Etapas da configuração">{['Conectar','Imprimir teste','Conferir papel'].map((label,index)=><li key={label} className={step>index+1?'done':step===index+1?'current':''}><span>{step>index+1?<Check size={16}/>:index+1}</span><strong>{label}</strong></li>)}</ol></section><section className="printer-check-card"><div className="printer-check-card-title"><Printer size={24}/><div><h2>{device.verified&&device.connected?'Conexão testada neste aparelho':'Configuração deste aparelho'}</h2><p>{device.platform==='ios'?'iPhone / iPad':device.platform==='android'?'Android':'Computador'} · TC-163 / JK-5801P</p></div></div><PrinterSetupGuide authorization={authorization}/></section><p className="printer-check-caption">A confirmação do teste é sua conferência do texto no papel. Após desconectar, teste novamente.</p></main>;
}
