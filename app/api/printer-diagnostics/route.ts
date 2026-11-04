import {resolveAccess} from '@/lib/access';
import {readVenue,saveVenue} from '@/lib/db';
import {assertSubscription} from '@/lib/saas-billing';
import {savePrinterDiagnostic} from '@/lib/printer-diagnostics';
import {readWorkspaceAction,WorkspaceRequestError} from '@/lib/workspace-request';

export const dynamic='force-dynamic';
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private'}});

export async function POST(req:Request){
 try{
  if(req.headers.get('origin')!==new URL(req.url).origin)return response({error:'Origem inválida.'},403);
  const access=await resolveAccess(req);
  if(!access||!['owner','waiter','kitchen'].includes(access.role))return response({error:'Acesso não autorizado.'},403);
  const body=await readWorkspaceAction(req,2048);
  if(body.type!=='report')return response({error:'Diagnóstico inválido.'},400);
  for(let attempt=0;attempt<5;attempt++){
   const row=await readVenue(access.owner);
   if(!row)return response({error:'Barraca não encontrada.'},404);
   assertSubscription(row.state.saas);
   const report=savePrinterDiagnostic(row.state,body.report,access.role,access.employeeId??undefined);
   if(await saveVenue(access.owner,row.version,row.state))return response({id:report.id,receivedAt:report.receivedAt});
  }
  return response({error:'A operação foi atualizada. Tente enviar o diagnóstico novamente.'},409);
 }catch(error){return response({error:error instanceof WorkspaceRequestError?error.message:'Não foi possível salvar o diagnóstico. Confira o acesso e tente novamente.'},error instanceof WorkspaceRequestError?error.status:400)}
}
