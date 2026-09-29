'use client';
import {useEffect,useRef,useState} from 'react';
import {Printer,Pause} from 'lucide-react';
import {connectKitchenPrinter,printerAvailable,printerSupported,printKitchenReceipt} from '@/lib/kitchen-printer';
import {toast} from 'sonner';

export default function AutomaticKitchenPrinter({authorization,demo}:{authorization:string;demo:boolean}){
 const [expanded,setExpanded]=useState(false),[enabled,setEnabled]=useState(false),[connected,setConnected]=useState(false),[supported,setSupported]=useState(false),[starting,setStarting]=useState(false),[message,setMessage]=useState('Conecte a impressora para imprimir os próximos pedidos automaticamente.');
 const device=useRef(''),since=useRef(''),inFlight=useRef(false);
 useEffect(()=>{device.current=crypto.randomUUID();setSupported(printerSupported());const timer=setInterval(()=>setConnected(printerAvailable()),1500);return()=>clearInterval(timer)},[]);
 useEffect(()=>{
  if(!enabled||!authorization||demo)return;
  let disposed=false;
  async function request(body:Record<string,unknown>){const r=await fetch('/api/local-print',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${authorization}`},body:JSON.stringify({...body,deviceId:device.current}),signal:AbortSignal.timeout(12000)});const data=await r.json() as {error?:string;job?:{id:string;content:string}|null};if(!r.ok)throw Error(data.error||'Falha na conexão.');return data}
  async function tick(){
   if(disposed||document.hidden||inFlight.current)return;
   if(!printerAvailable()){setMessage('Impressora desconectada. Reconecte para continuar.');return}
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
 },[enabled,authorization,demo]);
 return <div className="auto-kitchen-printer"><div><strong><Printer size={18}/> Impressão automática</strong><p role="status">{message}</p></div><button className="text-button printer-configure" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Fechar':'Configurar'}</button>{expanded&&<><div className="auto-printer-actions">{!connected&&<button className="outline" disabled={demo} onClick={async()=>{try{await connectKitchenPrinter();setConnected(printerAvailable());setMessage('Conectada. Ative para imprimir os próximos pedidos.')}catch(e){setMessage((e as Error).message)}}}>Conectar impressora</button>}<button className={enabled?'outline':'primary'} disabled={!connected||demo||starting} onClick={async()=>{if(enabled){setEnabled(false);setMessage('Impressão pausada.');return}since.current||=new Date().toISOString();setEnabled(true);setMessage('Ativada. Os novos pedidos serão enviados à impressora.')}}>{enabled?<Pause size={16}/>:<Printer size={16}/>} {enabled?'Pausar':'Ativar'}</button></div><details><summary>Como conectar a TC-163</summary><ol><li>Pareie a impressora nas configurações Bluetooth do aparelho.</li><li>Use Chrome atualizado no Android (138+) ou Chrome/Edge no notebook.</li><li>Toque em Conectar impressora, selecione a TC-163 e ative.</li><li>Mantenha esta cozinha aberta. Ao atualizar a página, conecte e ative novamente.</li></ol><p>Somente pedidos recebidos depois de ativar são impressos automaticamente. Pedidos anteriores podem ser impressos pelo botão da comanda.</p>{!supported&&<p>Este navegador não oferece a conexão necessária. No iPhone, a TC-163 Bluetooth Classic não imprime diretamente pelo site; use Android/notebook ou uma impressora de rede com CloudPRNT.</p>}</details></>}</div>;
}
