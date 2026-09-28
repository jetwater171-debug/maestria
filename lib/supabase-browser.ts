import {createClient, type SupabaseClient} from '@supabase/supabase-js';
let pending:Promise<SupabaseClient>|undefined;
export function browserAuth():Promise<SupabaseClient>{
 return pending ||= (async()=>{
  const response=await fetch('/api/auth-config',{cache:'no-store'});
  const config=await response.json() as {url:string;key:string;error?:string};
  if(!response.ok)throw Error(config.error||'Falha ao carregar acesso.');
  return createClient(config.url,config.key);
 })().catch(error=>{pending=undefined;throw error});
}

