export const dynamic='force-dynamic';
export function GET(){
 const read=(name:string)=>process.env[name]?.trim();
 const url=read('NEXT_PUBLIC_SUPABASE_URL');
 const key=read('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')||read('NEXT_PUBLIC_SUPABASE_ANON_KEY');
 const headers={'Cache-Control':'no-store'};
 const missing=[!url&&'NEXT_PUBLIC_SUPABASE_URL',!key&&'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'].filter(Boolean);
 if(missing.length)return Response.json({error:`Falta configurar na Vercel (Production): ${missing.join(', ')}. Salve e faça um novo deploy.`},{status:503,headers});
 // Reject privileged keys even when accidentally placed in a public variable.
 let publicKey=key!.startsWith('sb_publishable_');
 if(!publicKey){try{publicKey=JSON.parse(Buffer.from(key!.split('.')[1],'base64url').toString()).role==='anon'}catch{}}
 if(!publicKey)return Response.json({error:'A variável pública do Supabase deve conter uma chave publishable ou anon. Corrija e faça um novo deploy.'},{status:503,headers});
 try{if(new URL(url!).protocol!=='https:')throw Error()}catch{return Response.json({error:'Confira NEXT_PUBLIC_SUPABASE_URL na Vercel.'},{status:503,headers})}
 return Response.json({url,key},{headers});
}
