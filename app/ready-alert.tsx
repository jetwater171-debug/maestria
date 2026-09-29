 'use client';
import {useEffect,useRef,useState} from 'react';
import {Bell,Volume2} from 'lucide-react';
import {State} from '@/lib/domain';
import {toast} from 'sonner';
export default function ReadyAlert({state}:{state:State}){
 const [enabled,setEnabled]=useState(false),audio=useRef<AudioContext|null>(null),seen=useRef<Set<string>|null>(null);
 const beep=()=>{const c=audio.current;if(!c||c.state!=='running')return;for(let i=0;i<2;i++){const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=880;g.gain.setValueAtTime(.12,c.currentTime+i*.3);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+i*.3+.2);o.start(c.currentTime+i*.3);o.stop(c.currentTime+i*.3+.2)}};
 useEffect(()=>{const ready=state.orders.filter(o=>o.status==='ready'&&state.tables.some(t=>t.session===o.session)),ids=new Set(ready.map(o=>o.id));if(seen.current){for(const o of ready.filter(o=>!seen.current!.has(o.id))){const text=`${state.tables.find(t=>t.id===o.tableId)?.name}: pedido pronto para servir`;toast.success(text,{duration:12000});if(enabled){beep();if('vibrate' in navigator)navigator.vibrate([180,100,180]);}}}seen.current=ids},[state,enabled]);
 useEffect(()=>()=>{void audio.current?.close()},[]);
 return <button className={'outline ready-alert-toggle '+(enabled?'enabled':'')} aria-pressed={enabled} onClick={async()=>{if(enabled){setEnabled(false);return}try{audio.current||=new AudioContext();await audio.current.resume();setEnabled(true);beep();}catch{toast.error('Não foi possível ativar o som neste navegador.')}}}>{enabled?<Volume2 size={17}/>:<Bell size={17}/>} {enabled?'Aviso sonoro ligado':'Ativar aviso de pronto'}</button>
}
