import type {PrinterCapabilities} from './printer-capabilities.ts';
export type ReceiptPrintMethod='rawbt'|'openescpos'|'direct'|'system'|'hub';
export function preferredReceiptMethod(caps:PrinterCapabilities,connected:boolean,saved?:string|null,hubEnabled=false):ReceiptPrintMethod{
 if(connected)return 'direct';
 if(saved==='hub'&&hubEnabled)return 'hub';
 if((saved==='rawbt'||saved==='openescpos')&&caps.canUseAndroidApp)return saved;
 if(saved==='system'&&caps.systemPrintAvailable)return 'system';
 if(caps.directSerial||caps.directBle)return 'direct';
 return hubEnabled?'hub':caps.canUseAndroidApp?'rawbt':'system';
}
