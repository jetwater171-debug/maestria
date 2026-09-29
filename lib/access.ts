import {assertSubscription} from './saas-billing';
import {database,hashToken,readVenue} from './db';

import {Role} from './domain';

export async function resolveAccess(req:Request){

 const token=req.headers.get('authorization')?.replace(/^Bearer /,'');if(!token)return null;

 const db=database();

 if(token.split('.').length===3){const {data:{user},error}=await db.auth.getUser(token);if(error||!user)return null;const row=await readVenue(user.id);assertSubscription(row?.state.saas);return {owner:user.id,role:'owner' as Role,author:user.email||'Responsável',employeeId:null,state:row?.state??null,version:row?.version??0}}

 const {data:link,error}=await db.from('accesses').select('owner,employee').eq('hash',await hashToken(token)).maybeSingle();if(error)throw Error('Não foi possível verificar seu acesso.');if(!link)return null;

 const row=await readVenue(link.owner);if(!row)return null;assertSubscription(row.state.saas);const employee=row.state.employees.find(x=>x.id===link.employee&&x.active);if(!employee)return null;

 return {owner:link.owner,role:employee.role as Role,author:employee.name,employeeId:employee.id,state:row.state,version:row.version};

}
