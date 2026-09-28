type SerialPort={open:(options:{baudRate:number})=>Promise<void>;writable:WritableStream<Uint8Array>|null;close:()=>Promise<void>;addEventListener:(event:string,callback:()=>void)=>void};
type SerialApi={requestPort:(options?:{allowedBluetoothServiceClassIds:string[]})=>Promise<SerialPort>};
let port:SerialPort|null=null;
export function printerAvailable(){return !!port?.writable}
export function printerSupported(){return !!(navigator as Navigator & {serial?:SerialApi}).serial}
export async function connectKitchenPrinter(){
 const serial=(navigator as Navigator & {serial?:SerialApi}).serial;
 if(!serial)throw Error('Use Chrome atualizado no Android (138 ou superior) ou Chrome/Edge no notebook. iPhone não conecta por este Bluetooth.');
 if(port?.writable)return;
 const selected=await serial.requestPort({allowedBluetoothServiceClassIds:['00001101-0000-1000-8000-00805f9b34fb']});
 await selected.open({baudRate:9600});port=selected;selected.addEventListener('disconnect',()=>{if(port===selected)port=null});
}
export function escposBytes(content:string){
 const clean=content.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e\n]/g,'');
 const wrapped=clean.split('\n').flatMap(line=>line.match(/.{1,32}/g)||['']).join('\n');
 return new Uint8Array([27,64,27,97,0,...new TextEncoder().encode(wrapped+'\n\n\n')]);
}
export async function printKitchenReceipt(_id:string,content:string){
 if(!port?.writable)throw Error('Conecte a impressora primeiro.');
 const writer=port.writable.getWriter();
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  await Promise.race([(async()=>{const bytes=escposBytes(content);for(let i=0;i<bytes.length;i+=128){await writer.write(bytes.slice(i,i+128));await new Promise(r=>setTimeout(r,30))}})(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void writer.abort().catch(()=>{});reject(Error('Envio interrompido. Confira o papel antes de reimprimir.'))},40000)})]);
 }catch(e){port=null;throw e}finally{clearTimeout(timer);writer.releaseLock()}
}
