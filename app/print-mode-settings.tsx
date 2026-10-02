'use client';
import {useState} from 'react';
import {ChefHat,Smartphone,Check,Printer} from 'lucide-react';
import type {Action,State} from '@/lib/domain';
import type {PrintMode} from '@/lib/printing';
export default function PrintModeSettings({state,mutate}:{state:State;mutate:(action:Omit<Action,'id'>,message?:string)=>Promise<boolean>}){
 const [saving,setSaving]=useState(false);const mode=state.printer?.mode||'kitchen';
 async function select(next:PrintMode){if(saving||next===mode)return;setSaving(true);try{await mutate({type:'printer',mode:next},next==='waiter'?'Novos pedidos serão impressos pelo garçom.':'Novos pedidos serão impressos na cozinha.')}finally{setSaving(false)}}
 return <section className="print-mode-settings"><h3><Printer size={19}/> Onde os pedidos serão impressos?</h3><p>Escolha como sua equipe trabalha. Vale para os próximos pedidos.</p><div className="print-mode-options">{([{value:'waiter',icon:Smartphone,title:'Com o garçom',text:'Ele leva a impressora, imprime pelo celular e entrega a comanda na cozinha.'},{value:'kitchen',icon:ChefHat,title:'Direto na cozinha',text:'Os garçons enviam. O aparelho conectado na cozinha imprime automaticamente.'}] as const).map(({value,icon:Icon,title,text})=><button key={value} type="button" aria-pressed={mode===value} disabled={saving} onClick={()=>select(value)}><Icon size={24}/><span><strong>{title}</strong><small>{text}</small></span>{mode===value&&<Check size={19}/>}</button>)}</div><p className="muted">{mode==='waiter'?'No Android, use o RawBT: prepare a comanda e toque para abrir o aplicativo. Os pedidos continuam aparecendo na tela da cozinha.':'Para imprimir sem tocar na tela, conecte uma impressora compatível ao site e mantenha a cozinha aberta. O aplicativo Android também oferece impressão com toque.'}</p><small>Comandas que já estavam na fila mantêm o destino anterior. Trocar o modo não imprime nem transfere pedidos antigos.</small></section>;
}
