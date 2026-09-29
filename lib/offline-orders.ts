import type {Action,State,Role} from './domain';
export type PendingOrder={action:Action;tableName:string;items:string;createdAt:string;error?:string};
export type Snapshot={state:State;role:Role;author:string;savedAt:string};
const prefix='maestria-offline-v1:';
export function readSnapshot(key:string):Snapshot|null {try{return JSON.parse(localStorage.getItem(prefix+key+':state')||'null')}catch{return null}}
export function saveSnapshot(key:string,data:Omit<Snapshot,'savedAt'>){if(key)localStorage.setItem(prefix+key+':state',JSON.stringify({...data,savedAt:new Date().toISOString()}))}
export function readPending(key:string):PendingOrder[]{try{return JSON.parse(localStorage.getItem(prefix+key+':queue')||'[]')}catch{return []}}
export function savePending(key:string,queue:PendingOrder[]){if(!key)throw Error('Abra sua barraca com internet antes de salvar pedidos offline.');localStorage.setItem(prefix+key+':queue',JSON.stringify(queue))}
export class ConnectionError extends Error {}
