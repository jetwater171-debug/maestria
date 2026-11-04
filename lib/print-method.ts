import type {PrinterCapabilities} from './printer-capabilities.ts';
export type ReceiptPrintMethod='openescpos'|'direct'|'system'|'hub';
export function preferredReceiptMethod(caps:PrinterCapabilities,connected:boolean,saved?:string|null,hubEnabled=false):ReceiptPrintMethod{
 if(connected)return 'direct';
 if(saved==='hub'&&hubEnabled)return 'hub';
 if(saved==='openescpos'&&caps.canUseAndroidApp)return saved;
 if(saved==='system'&&caps.systemPrintAvailable)return 'system';
 if(caps.directSerial||caps.directBle)return 'direct';
 return hubEnabled?'hub':caps.canUseAndroidApp?'openescpos':'system';
}

export function portableReceiptFlow(caps:PrinterCapabilities,connected:boolean,verified:boolean,saved?:string|null){
 if(connected&&verified)return 'automatic';
 if(!connected&&caps.canUseAndroidApp&&saved==='openescpos')return 'manual';
 return 'setup';
}
