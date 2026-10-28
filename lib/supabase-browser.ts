import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {loadPublicAuthConfig} from './public-auth-config';
let pending:Promise<SupabaseClient>|undefined;
export function browserAuth():Promise<SupabaseClient>{
 return pending ||= (async()=>{
  const config=await loadPublicAuthConfig();
  return createClient(config.url,config.key);
 })().catch(error=>{pending=undefined;throw error});
}

