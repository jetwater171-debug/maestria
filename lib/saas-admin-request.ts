export class AdminRequestError extends Error{
 status:number;
 constructor(message:string,status:number){super(message);this.status=status}
}

export async function readAdminBody(req:Request,limit=12000):Promise<Record<string,unknown>>{
 if(req.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new AdminRequestError('Envie os dados no formato JSON.',415);
 if(Number(req.headers.get('content-length')||0)>limit)throw new AdminRequestError('Solicitação muito grande.',413);
 const reader=req.body?.getReader();
 if(!reader)throw new AdminRequestError('Solicitação vazia.',400);
 const decoder=new TextDecoder();let bytes=0,body='';
 try{
  while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>limit){await reader.cancel();throw new AdminRequestError('Solicitação muito grande.',413)}body+=decoder.decode(value,{stream:true})}
  body+=decoder.decode();
 }finally{reader.releaseLock()}
 let parsed:unknown;
 try{parsed=JSON.parse(body)}catch{throw new AdminRequestError('JSON inválido.',400)}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new AdminRequestError('Solicitação inválida.',400);
 return parsed as Record<string,unknown>;
}
