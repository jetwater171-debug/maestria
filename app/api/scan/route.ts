export const maxDuration=60;
import {resolveAccess} from '@/lib/access';
import {SCAN_MODEL,scanRequest,parseScan,scanProviderError} from '@/lib/scanner';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(req:Request){
 try{
  if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Origem inválida.'},403);
  const access=await resolveAccess(req);
  if(!access||access.role!=='owner'||!access.state)return reply({error:'Cadastre sua barraca para usar o scanner.'},403);
  const key=process.env.LLM7_API_KEY?.trim();
  if(!key)return reply({error:'Falta configurar a chave LLM7 no servidor.'},503);
  const raw=await req.text();
  if(raw.length>7100000)return reply({error:'Use uma foto de até 5 MB.'},413);
  const body=JSON.parse(raw) as {image?:unknown}|null;
  const image=body?.image;
  if(typeof image!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))return reply({error:'Selecione JPG, PNG ou WEBP.'},400);
  const response=await fetch('https://api.llm7.io/v1/chat/completions',{
   method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
   signal:AbortSignal.timeout(45000),body:JSON.stringify(scanRequest(image))
  });
  if(!response.ok){
   // Never log the photo, upstream body or credentials.
   console.error('Menu scanner provider failure',{provider:'LLM7',model:SCAN_MODEL,status:response.status});
   return reply({error:scanProviderError(response.status)},502);
  }
  const data=await response.json() as {choices?:{finish_reason?:string;message?:{content?:string}}[]};
  const choice=data.choices?.[0];
  if(choice?.finish_reason==='length')return reply({error:'Esta página tem muitos itens. Fotografe uma parte de cada vez.'},422);
  if(!choice?.message?.content)return reply({error:'A leitura não retornou itens. Tente uma imagem mais nítida.'},422);
  return reply({products:parseScan(choice.message.content),provider:'LLM7',model:SCAN_MODEL});
 }catch(e){
  const error=e as Error;
  if(error.name==='TimeoutError'||error.name==='AbortError')return reply({error:'A leitura demorou demais. Sua foto não foi importada. Tente uma parte menor do cardápio.'},504);
  if(error.name==='TypeError')return reply({error:'Não foi possível conectar ao serviço de leitura. Sua foto não foi importada. Tente novamente.'},502);
  return reply({error:error.name==='ZodError'||error.name==='SyntaxError'?'A leitura ficou incompleta. Tente outra foto.':error.message||'Não foi possível ler a imagem.'},400);
 }
}
