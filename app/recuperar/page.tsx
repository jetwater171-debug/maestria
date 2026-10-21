'use client';

import {useState} from 'react';
import Link from 'next/link';
import {ArrowLeft, Download, HardDrive, Search, Waves} from 'lucide-react';
import styles from './recovery.module.css';

type LocalCopy={key:string;value:string};
type CopyDetails={name:string;role:string;date:string;kind:string};

const prefix='maestria-offline-v1:';
const roles:Record<string,string>={owner:'Responsável',waiter:'Garçom',kitchen:'Cozinha',cashier:'Caixa'};
const isRecord=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);

function parse(value:string):unknown {
  try{return JSON.parse(value)}catch{return null}
}

function details(copy:LocalCopy,copies:LocalCopy[]):CopyDetails {
  const isState=copy.key.endsWith(':state');
  const snapshot=isState?copy:copies.find(item=>item.key===copy.key.slice(0,-6)+':state');
  const parsed=snapshot?parse(snapshot.value):null;
  const state=isRecord(parsed)&&isRecord(parsed.state)?parsed.state:null;
  const name=typeof state?.name==='string'&&state.name.trim()?state.name.trim().slice(0,120):'Cópia sem identificação';
  const role=isRecord(parsed)&&typeof parsed.role==='string'&&Object.hasOwn(roles,parsed.role)?roles[parsed.role]:'Acesso não identificado';
  let savedAt=isRecord(parsed)&&typeof parsed.savedAt==='string'?parsed.savedAt:'';
  if(!isState){
    const queue=parse(copy.value);
    savedAt=Array.isArray(queue)?queue.flatMap(item=>isRecord(item)&&typeof item.createdAt==='string'?[item.createdAt]:[]).sort().at(-1)||'':'';
  }
  const timestamp=savedAt?new Date(savedAt):null;
  const date=timestamp&&!Number.isNaN(timestamp.getTime())?timestamp.toLocaleString('pt-BR'):'Data indisponível';
  return {name,role,date,kind:isState?'Estado salvo':'Fila de pedidos'};
}

export default function RecoveryPage(){
  const [copies,setCopies]=useState<LocalCopy[]|null>(null);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  function search(){
    setError('');
    setMessage('');
    setCopies(null);
    try{
      const storage=window.localStorage;
      const found:LocalCopy[]=[];
      for(let index=0;index<storage.length;index++){
        const key=storage.key(index);
        if(!key?.startsWith(prefix)||!key.endsWith(':state')&&!key.endsWith(':queue'))continue;
        const value=storage.getItem(key);
        if(value!==null)found.push({key,value});
      }
      setCopies(found);
    }catch{
      setError('Não foi possível acessar as cópias deste navegador. Confira se o armazenamento do site está permitido e tente novamente.');
    }
  }

  function download(){
    if(!copies?.length)return;
    setError('');
    setMessage('');
    let objectUrl:string|undefined;
    let link:HTMLAnchorElement|undefined;
    let requested=false;
    try{
      const exportedAt=new Date().toISOString();
      const backup={
        format:'maestria-offline-backup',
        formatVersion:1,
        exportedAt,
        notice:'Cópia parcial do armazenamento offline deste navegador. Pode estar antiga e não substitui um backup completo do banco. Não contém contas ou senhas de autenticação.',
        entries:copies,
      };
      const file=new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'});
      objectUrl=URL.createObjectURL(file);
      link=document.createElement('a');
      link.href=objectUrl;
      link.download=`maestria-copia-local-${exportedAt.replace(/[:.]/g,'-')}.json`;
      document.body.appendChild(link);
      link.click();
      requested=true;
      setMessage('Download solicitado. Confira se o arquivo JSON foi salvo nos downloads do aparelho.');
    }catch{
      setError('Não foi possível iniciar o download. Tente novamente e confira se este navegador permite baixar arquivos.');
    }finally{
      link?.remove();
      if(objectUrl){
        const url=objectUrl;
        if(requested)window.setTimeout(()=>URL.revokeObjectURL(url),1000);
        else URL.revokeObjectURL(url);
      }
    }
  }

  return <main className={styles.page}>
    <div className={styles.container}>
      <Link className={styles.back} href="/painel" prefetch={false}><ArrowLeft size={17}/> Voltar ao painel</Link>
      <section className={styles.card} aria-labelledby="recovery-title">
        <div className={styles.brand}><span><Waves size={26}/></span> maestria <small>BEACH</small></div>
        <div className={styles.icon}><HardDrive size={27}/></div>
        <p className={styles.eyebrow}>CÓPIAS NESTE APARELHO</p>
        <h1 id="recovery-title" className={styles.title}>Guarde o que ficou salvo.</h1>
        <p className={styles.description}>Abra esta página no mesmo navegador e aparelho em que você usava o Maestria. Pode haver uma cópia local dos dados da sua barraca e de pedidos aguardando envio.</p>
        <div className={styles.notice}>
          <strong>Esta cópia é parcial e pode estar antiga.</strong>
          <p>Ela não substitui um backup completo do banco e não recupera contas ou senhas. A busca e o download acontecem neste aparelho, sem enviar os dados ao servidor. Nada será apagado.</p>
        </div>
        <button type="button" className={styles.search} onClick={search}><Search size={18}/> Procurar cópias neste aparelho</button>
        {copies!==null&&<section className={styles.results} aria-live="polite" aria-atomic="true">
          <h2>{copies.length===0?'Nenhuma cópia encontrada':`${copies.length} ${copies.length===1?'cópia local encontrada':'cópias locais encontradas'}`}</h2>
          {copies.length===0?<p className={styles.empty}>Tente abrir esta página em outro aparelho ou navegador que você usava no atendimento. Só é possível encontrar o que ainda está salvo neste navegador e endereço do site.</p>:<>
            <ul className={styles.list}>{copies.map(copy=>{
              const info=details(copy,copies);
              return <li key={copy.key}><div><strong>{info.name}</strong><span>{info.kind} · {info.role}</span></div><span className={styles.date}>{info.date}</span></li>;
            })}</ul>
            <button type="button" className={styles.download} onClick={download}><Download size={18}/> Baixar cópia de segurança</button>
            <p className={styles.footnote}>O arquivo JSON guarda todas as cópias encontradas. Guarde-o em um lugar seguro para uma análise posterior.</p>
          </>}
        </section>}
        {error&&<p className={styles.error} role="alert">{error}</p>}
        {message&&<p className={styles.message} role="status">{message}</p>}
      </section>
    </div>
  </main>;
}
