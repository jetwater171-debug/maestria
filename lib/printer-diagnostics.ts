import type {Role,State} from './domain.ts';

export type PrinterDiagnosticInput={
 platform:'android'|'ios'|'desktop';
 browser:'chrome'|'edge'|'safari'|'bluefy'|'webble'|'samsung'|'other';
 secureContext:boolean;
 directSerial:boolean;
 directBle:boolean;
 connected:boolean;
 verified:boolean;
 transport:'none'|'serial'|'ble';
 method:'direct'|'rawbt'|'openescpos'|'system'|'hub'|'unset';
 result:'unconfigured'|'connected'|'test-sent'|'verified'|'connection-failed'|'write-failed'|'disconnected';
};
export type PrinterDiagnostic=PrinterDiagnosticInput&{id:string;actorId:string;role:Role;receivedAt:string};

const choices={
 platform:['android','ios','desktop'],
 browser:['chrome','edge','safari','bluefy','webble','samsung','other'],
 transport:['none','serial','ble'],
 method:['direct','rawbt','openescpos','system','hub','unset'],
 result:['unconfigured','connected','test-sent','verified','connection-failed','write-failed','disconnected'],
} as const;

// Copy only allowlisted fields. Never persist free text, access links or user-agent strings.
export function parsePrinterDiagnostic(raw:unknown):PrinterDiagnosticInput{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Diagnóstico inválido.');
 const value=raw as Record<string,unknown>,parsed:Record<string,unknown>={};
 for(const [key,allowed] of Object.entries(choices)){
  if(typeof value[key]!=='string'||!(allowed as readonly string[]).includes(value[key] as string))throw Error('Diagnóstico inválido.');
  parsed[key]=value[key];
 }
 for(const key of ['secureContext','directSerial','directBle','connected','verified']){
  if(typeof value[key]!=='boolean')throw Error('Diagnóstico inválido.');
  parsed[key]=value[key];
 }
 const report=parsed as PrinterDiagnosticInput;
 if(report.verified&&!report.connected||report.connected&&report.transport==='none'||!report.connected&&report.transport!=='none')throw Error('Estado de conexão inválido.');
 return report;
}

export function savePrinterDiagnostic(state:State,input:unknown,role:Role,employeeId?:string,now=new Date().toISOString()){
 if(!['owner','waiter','kitchen'].includes(role))throw Error('Seu acesso não permite enviar diagnóstico.');
 if(role!=='owner'&&!state.employees.some(e=>e.id===employeeId&&e.active&&e.role===role))throw Error('Acesso desativado.');
 const report:PrinterDiagnostic={...parsePrinterDiagnostic(input),id:crypto.randomUUID(),actorId:role==='owner'?'owner':employeeId!,role,receivedAt:now};
 state.printerDiagnostics=[...(state.printerDiagnostics||[]).filter(r=>r.actorId!==report.actorId).slice(-59),report];
 return report;
}

export function diagnosticBrowser(ua:string):PrinterDiagnosticInput['browser']{
 return /Bluefy/i.test(ua)?'bluefy':/WebBLE/i.test(ua)?'webble':/Edg(?:e|A|iOS)?\//i.test(ua)?'edge':/SamsungBrowser/i.test(ua)?'samsung':/Chrome|CriOS/i.test(ua)?'chrome':/Safari/i.test(ua)?'safari':'other';
}
