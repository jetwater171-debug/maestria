import {createClient, type SupabaseClient} from '@supabase/supabase-js';
let client:SupabaseClient|undefined;
export function browserAuth(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw Error('O acesso ainda não foi configurado. Configure o Supabase no servidor.');
 return client ||= createClient(url,key);
}
