import {notifyPrinterChange} from './printer-events.ts';
import {bleAvailable,bleSupported,sendBleBytes,disconnectBlePrinter} from './ble-printer.ts';
type SerialPort={open:(options:{baudRate:number})=>Promise<void>;writable:WritableStream<Uint8Array>|null;close:()=>Promise<void>;addEventListener:(event:string,callback:()=>void)=>void};
type SerialApi={requestPort:()=>Promise<SerialPort>;getPorts?:()=>Promise<SerialPort[]>};
let port:SerialPort|null=null;
export function printerAvailable(){return !!port?.writable||bleAvailable()}
export function printerSupported(){return typeof navigator!=='undefined'&&(typeof (navigator as Navigator & {serial?:SerialApi}).serial?.requestPort==='function'||bleSupported())}
export function printerPlatform(ua:string,touchPoints=0){return /iPhone|iPad|iPod/i.test(ua)||/Macintosh/i.test(ua)&&touchPoints>1?'ios':/Android/i.test(ua)?'android':'desktop'}
export function printerConnectionError(error:unknown){
 const e=error as {name?:string;message?:string};
 if(e.name==='NotFoundError'||e.message?.includes('No port selected'))return 'Nenhuma impressora selecionada. Se a lista ficou vazia, pareie a TC-163 no Bluetooth do aparelho, feche outros apps de impressão e tente novamente. No Android, confira a permissão Dispositivos próximos.';
 if(e.name==='SecurityError'||e.name==='NotAllowedError')return 'O navegador bloqueou a conexão. Permita Bluetooth e abra o site fora do WhatsApp/Instagram. Se continuar, use a alternativa indicada abaixo.';
 if(e.name==='NetworkError'||e.name==='InvalidStateError')return 'Não foi possível abrir a conexão. Ligue e aproxime a impressora, feche os apps de impressão e desconecte-a de outro celular ou notebook. Depois tente novamente.';
 return 'Não foi possível conectar. Confira se a impressora está ligada e livre de outras conexões. Tente novamente ou siga a alternativa indicada abaixo.';
}
export async function connectKitchenPrinter(useSaved=true){
 const serial=typeof navigator==='undefined'?undefined:(navigator as Navigator & {serial?:SerialApi}).serial;
 if(typeof serial?.requestPort!=='function')throw Error('Este navegador não conecta diretamente à TC-163. No Android, abra o Chrome atualizado. No iPhone, abra no Bluefy e use Buscar impressora BLE; sua unidade precisa oferecer BLE.');
 if(port?.writable)return;
 try{
  // SPP is a standard service: requestPort() already exposes it. Do not limit the native chooser.
  let selected:SerialPort|undefined;
  if(useSaved&&serial.getPorts){const saved=await serial.getPorts();if(saved.length===1)selected=saved[0]}
  selected||=await serial.requestPort();
  try{await selected.open({baudRate:9600});if(!selected.writable)throw Error('Conexão sem canal de escrita.')}catch(e){try{await selected.close()}catch{}throw e}
  port=selected;notifyPrinterChange(true);selected.addEventListener('disconnect',()=>{if(port===selected){port=null;notifyPrinterChange(true)}});
 }catch(e){throw Error(printerConnectionError(e))}
}
export async function disconnectKitchenPrinter(){await disconnectBlePrinter();if(!port)return;if(port.writable?.locked)throw Error('Aguarde o envio da comanda terminar antes de desconectar.');const current=port;await current.close();if(port===current){port=null;notifyPrinterChange(true)}}
export function escposBytes(content:string){
 const clean=content.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e\n]/g,'');
 const wrapped=clean.split('\n').flatMap(line=>line.match(/.{1,32}/g)||['']).join('\n');
 return new Uint8Array([27,64,27,97,0,...new TextEncoder().encode(wrapped+'\n\n\n')]);
}
async function sendReceipt(content:string){
 if(bleAvailable()){await sendBleBytes(escposBytes(content));return;}
 if(!port?.writable)throw Error('Conecte a impressora primeiro.');
 const writer=port.writable.getWriter();
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  await Promise.race([(async()=>{const bytes=escposBytes(content);for(let i=0;i<bytes.length;i+=128){await writer.write(bytes.slice(i,i+128));await new Promise(r=>setTimeout(r,30))}})(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void writer.abort().catch(()=>{});reject(Error('Envio interrompido. Confira o papel antes de reimprimir.'))},40000)})]);
 }catch(e){port=null;notifyPrinterChange(true);throw e}finally{clearTimeout(timer);writer.releaseLock()}
}

let sending=false;
export async function printKitchenReceipt(_id:string,content:string){
 if(sending)throw Error('Outra comanda está sendo enviada. Aguarde antes de imprimir.');
 sending=true;try{await sendReceipt(content)}finally{sending=false}
}
