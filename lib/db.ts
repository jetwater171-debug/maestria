import 'server-only';
import {createClient} from '@supabase/supabase-js';
export function database(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error('Banco de dados ainda não configurado.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function readVenue(owner:string){const {data,error}=await database().from('venues').select('state,version').eq('owner',owner).maybeSingle();if(error)throw Error('Não foi possível carregar a barraca.');return data as {state:import('./domain').State;version:number}|null}
export async function saveVenue(owner:string,version:number,state:import('./domain').State){const {data,error}=await database().from('venues').update({state,version:version+1}).eq('owner',owner).eq('version',version).select('owner');if(error)throw Error('Não foi possível salvar.');return !!data?.length}
export async function hashToken(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(v=>v.toString(16).padStart(2,'0')).join('')}
