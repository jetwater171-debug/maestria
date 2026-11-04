import {notifyPrinterChange} from './printer-events.ts';
// Web Bluetooth transport; works in Bluefy/WebBLE on iOS, not plain Safari.
type Characteristic={uuid:string;properties:{write?:boolean;writeWithoutResponse?:boolean};writeValue?:(bytes:Uint8Array)=>Promise<void>;writeValueWithResponse?:(bytes:Uint8Array)=>Promise<void>;writeValueWithoutResponse?:(bytes:Uint8Array)=>Promise<void>};
type Service={uuid:string;getCharacteristics:()=>Promise<Characteristic[]>};
type Device={name?:string;gatt?:{connected:boolean;connect:()=>Promise<{getPrimaryServices:()=>Promise<Service[]>}>;disconnect:()=>void};addEventListener:(name:string,callback:()=>void)=>void};
type BluetoothApi={requestDevice:(options:{acceptAllDevices:true;optionalServices:string[]})=>Promise<Device>};
export const BLE_PROFILES=[
 {service:'000018f0-0000-1000-8000-00805f9b34fb',characteristic:'00002af1-0000-1000-8000-00805f9b34fb'},
 {service:'49535343-fe7d-4ae5-8fa9-9fafd205e455',characteristic:'49535343-8841-43f4-a8d4-ecbe34729bb3'},
 {service:'0000ff00-0000-1000-8000-00805f9b34fb',characteristic:'0000ff02-0000-1000-8000-00805f9b34fb'},
 {service:'0000ffe0-0000-1000-8000-00805f9b34fb',characteristic:'0000ffe1-0000-1000-8000-00805f9b34fb'},
];
let device:Device|null=null,channel:Characteristic|null=null,busy=false,connecting=false,connection=0,diagnostic='';
const api=()=>typeof navigator==='undefined'?undefined:(navigator as Navigator & {bluetooth?:BluetoothApi}).bluetooth;
export const bleSupported=()=>typeof api()?.requestDevice==='function';
export const bleAvailable=()=>!!device?.gatt?.connected&&!!channel;
export const bleWriteInProgress=()=>busy;
export const bleDiagnostic=()=>diagnostic;
export function bleUuid(value:string){const v=value.trim().toLowerCase();if(/^[0-9a-f]{4}$/.test(v))return `0000${v}-0000-1000-8000-00805f9b34fb`;if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v))return v;throw Error('UUID inválido. Use 4 caracteres hexadecimais ou o UUID completo.');}
export async function connectBlePrinter(custom?:{service:string;characteristic:string}){
 const bluetooth=api();if(typeof bluetooth?.requestDevice!=='function')throw Error('No iPhone, abra este site no Bluefy ou WebBLE e permita Bluetooth. Safari e PWA não oferecem essa conexão.');
 if(bleAvailable())return;
 if(connecting)throw Error('Aguarde a busca de impressora terminar.');
 const profiles=custom?[{service:bleUuid(custom.service),characteristic:bleUuid(custom.characteristic)}]:BLE_PROFILES;
 connecting=true;diagnostic='';let selected:Device|undefined;
 try{
  // Called directly from the tap, before any await, to preserve user activation.
  selected=await bluetooth.requestDevice({acceptAllDevices:true,optionalServices:profiles.map(p=>p.service)});
  if(!selected.gatt)throw Error('O dispositivo não oferece conexão BLE GATT.');
  const server=await selected.gatt.connect();const services=await server.getPrimaryServices();
  const found:string[]=[],candidates:{service:string;channel:Characteristic}[]=[];
  for(const service of services){
   try{for(const c of await service.getCharacteristics()){found.push(`${service.uuid} → ${c.uuid}${c.properties.write||c.properties.writeWithoutResponse?' (escrita)':''}`);if(c.properties.write||c.properties.writeWithoutResponse)candidates.push({service:bleUuid(service.uuid),channel:c});}}
   catch{found.push(`${service.uuid} → não foi possível consultar os canais`);}
  }
  // Service enumeration order varies by browser. Keep the known profile priority
  // and never send printer commands to an arbitrary writable characteristic.
  const target=profiles.map(p=>candidates.find(c=>c.service===p.service&&bleUuid(c.channel.uuid)===p.characteristic)?.channel).find(Boolean);
  diagnostic=`Dispositivo: ${selected.name||'Sem nome'}\n${found.join('\n')||'Nenhum serviço autorizado encontrado.'}`;
  if(!target)throw Error('Conexão BLE encontrada, mas o canal de impressão não foi identificado. Confira os UUIDs no diagnóstico ou informe os do fabricante em Configuração avançada. Nenhum comando foi enviado.');
  if(!selected.gatt.connected)throw Error('A impressora desconectou durante a configuração. Conecte novamente.');
  device=selected;channel=target;const session=++connection;notifyPrinterChange(true);const current=selected;current.addEventListener('gattserverdisconnected',()=>{if(device===current&&connection===session&&!current.gatt?.connected){device=null;channel=null;notifyPrinterChange(true)}});
 }catch(e){selected?.gatt?.disconnect();const error=e as Error;if(error.name==='NotFoundError')throw Error('Nenhuma impressora BLE selecionada. Ligue e desconecte a TC-163 de outros aparelhos. Se não aparecer, confirme se ela oferece BLE; Bluetooth Classic usa outra conexão.');if(error.name==='SecurityError'||error.name==='NotAllowedError')throw Error('Permita Bluetooth para este navegador e abra o Maestria por HTTPS. No iPhone, use um navegador com BLE, como Bluefy, e uma impressora BLE compatível.');if(error.name==='NetworkError')throw Error('Conexão BLE interrompida. Aproxime e reinicie a impressora, feche outros aplicativos de impressão e desconecte-a do MacBook.');throw e;}finally{connecting=false;}
}
export async function disconnectBlePrinter(){if(busy)throw Error('Aguarde o envio da comanda terminar.');device?.gatt?.disconnect();device=null;channel=null;notifyPrinterChange(true);}
export async function sendBleBytes(bytes:Uint8Array,signal?:AbortSignal){
 if(signal?.aborted)throw Error('Envio BLE interrompido. Confira o papel antes de reimprimir.');
 if(!bleAvailable()||!channel)throw Error('Reconecte a impressora BLE.');if(busy)throw Error('Outra comanda está sendo enviada.');busy=true;
 const current=channel,currentDevice=device!,session=connection;let interrupted=false,timer:ReturnType<typeof setTimeout>|undefined;
 const interruption=()=>Error('Envio BLE interrompido. Confira o papel antes de reimprimir.');
 const disconnectCurrent=()=>{
  // A late failure from an old write must not disconnect a replacement session,
  // including one that reuses the same BluetoothDevice object.
  if(device===currentDevice&&connection!==session)return;
  if(device===currentDevice){device=null;channel=null;notifyPrinterChange(true);}
  try{currentDevice.gatt?.disconnect()}catch{}
 };
 let timeoutReject:(reason:Error)=>void=()=>{};
 const timeout=new Promise<never>((_,reject)=>{timeoutReject=reject});
 const transfer=(async()=>{
  try{
   for(let i=0;i<bytes.length;i+=20){
    if(interrupted||signal?.aborted||device!==currentDevice||connection!==session||!currentDevice.gatt?.connected)throw interruption();
    // The timeout measures a stalled native write, not the whole receipt. At
    // 20 bytes / 50 ms, a healthy long receipt can legitimately take >40 s.
    timer=setTimeout(()=>{interrupted=true;disconnectCurrent();timeoutReject(interruption())},40000);
    try{
     const chunk=bytes.slice(i,i+20);
     if(current.properties.write&&current.writeValueWithResponse)await current.writeValueWithResponse(chunk);
     else if(current.properties.writeWithoutResponse&&current.writeValueWithoutResponse)await current.writeValueWithoutResponse(chunk);
     else if(current.writeValue)await current.writeValue(chunk);
     else throw Error('Canal BLE sem método de escrita compatível.');
    }finally{clearTimeout(timer)}
    if(interrupted||signal?.aborted||device!==currentDevice||connection!==session||!currentDevice.gatt?.connected)throw interruption();
    if(i+20<bytes.length)await new Promise(r=>setTimeout(r,50));
   }
  }finally{clearTimeout(timer);busy=false;}
 })();
 try{await Promise.race([transfer,timeout]);}
 catch(e){interrupted=true;disconnectCurrent();throw e;}
 // On timeout, transfer keeps the lock until the old native write settles.
}
