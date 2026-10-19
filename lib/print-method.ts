import type {PrinterCapabilities} from './printer-capabilities.ts';
export type ReceiptPrintMethod='rawbt'|'openescpos'|'direct'|'system';
export function preferredReceiptMethod(caps:PrinterCapabilities,connected:boolean,saved?:string|null):ReceiptPrintMethod{
 if(connected)return 'direct';
 if((saved==='rawbt'||saved==='openescpos')&&caps.canUseAndroidApp)return saved;
 if(saved==='system'&&caps.systemPrintAvailable)return 'system';
 if(caps.directSerial||caps.directBle)return 'direct';
 return caps.canUseAndroidApp?'rawbt':'system';
}
