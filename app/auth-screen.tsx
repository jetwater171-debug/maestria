 'use client';

import {useState} from 'react';

import {Waves,ArrowRight} from 'lucide-react';

import {browserAuth} from '@/lib/supabase-browser';

export default function AuthScreen({recovery=false}:{recovery?:boolean}){

 const [mode,setMode]=useState(recovery?'update':'login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');

 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');try{const client=browserAuth();

 if(mode==='forgot'){const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/redefinir'});if(error)throw error;setMessage('Se houver uma conta com este e-mail, você receberá as instruções.');return}

 if(mode==='update'){await client.auth.getSession();const {error}=await client.auth.updateUser({password});if(error)throw error;location.assign('/');return}

 const {data,error}=mode==='signup'?await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin}}):await client.auth.signInWithPassword({email,password});if(error)throw error;

 if(data.session)location.assign('/');else setMessage('Confira seu e-mail para confirmar o cadastro. Depois entre com sua senha.');

 }catch(e){const msg=(e as Error).message;setMessage(msg.includes('Invalid login')?'E-mail ou senha incorretos.':msg.includes('Email not confirmed')?'Confirme seu e-mail antes de entrar.':msg.includes('rate limit')?'Muitas tentativas. Aguarde alguns minutos.':msg.includes('configurad')?msg:'Não foi possível concluir. Confira os dados e tente novamente.')}finally{setBusy(false)}}

 return <main className="auth-shell"><section className="auth-card"><div className="brand"><span className="brand-mark"><Waves/></span><div>maestria<span>BEACH</span></div></div><h1>{mode==='login'?'Sua barraca começa aqui':mode==='signup'?'Crie sua conta':mode==='update'?'Escolha sua nova senha':'Recuperar acesso'}</h1><p>{mode==='login'?'Entre para cuidar do seu atendimento.':mode==='signup'?'Cadastre sua conta e organize sua barraca.':'Use uma senha de pelo menos 8 caracteres.'}</p><form className="form" onSubmit={submit}>{mode!=='update'&&<label className="field"><span>E-mail</span><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254}/></label>}{mode!=='forgot'&&<label className="field"><span>Senha</span><input type="password" autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} required minLength={mode==='login'?1:8} maxLength={128}/></label>}{message&&<p role="status" className="order-note">{message}</p>}<button className="primary full" disabled={busy}>{busy?'Aguarde…':mode==='login'?'Entrar':mode==='signup'?'Criar conta':mode==='update'?'Salvar nova senha':'Enviar instruções'}<ArrowRight size={18}/></button></form>{!recovery&&<div className="auth-links"><button onClick={()=>{setMessage('');setMode(mode==='signup'?'login':'signup')}}>{mode==='signup'?'Já tenho conta':'Criar minha conta'}</button><button onClick={()=>{setMessage('');setMode(mode==='forgot'?'login':'forgot')}}>{mode==='forgot'?'Voltar para entrar':'Esqueci minha senha'}</button></div>}</section></main>

}

