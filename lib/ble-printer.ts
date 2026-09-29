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
let device:Device|null=null,channel:Characteristic|null=null,busy=false,diagnostic='';
const api=()=>typeof navigator==='undefined'?undefined:(navigator as Navigator & {bluetooth?:BluetoothApi}).bluetooth;
export const bleSupported=()=>!!api();
export const bleAvailable=()=>!!device?.gatt?.connected&&!!channel;
export const bleDiagnostic=()=>diagnostic;
export function bleUuid(value:string){const v=value.trim().toLowerCase();if(/^[0-9a-f]{4}$/.test(v))return `0000${v}-0000-1000-8000-00805f9b34fb`;if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v))return v;throw Error('UUID inválido. Use 4 caracteres hexadecimais ou o UUID completo.');}
export async function connectBlePrinter(custom?:{service:string;characteristic:string}){
 const bluetooth=api();if(!bluetooth)throw Error('No iPhone, abra este site no Bluefy ou WebBLE e permita Bluetooth. Safari e PWA não oferecem essa conexão.');
 if(bleAvailable())return;
 const profiles=custom?[{service:bleUuid(custom.service),characteristic:bleUuid(custom.characteristic)}]:BLE_PROFILES;
 diagnostic='';let selected:Device|undefined;
 try{
  // Called directly from the tap, before any await, to preserve user activation.
  selected=await bluetooth.requestDevice({acceptAllDevices:true,optionalServices:profiles.map(p=>p.service)});
  if(!selected.gatt)throw Error('O dispositivo não oferece conexão BLE GATT.');
  const server=await selected.gatt.connect();const services=await server.getPrimaryServices();
  const found:string[]=[];let target:Characteristic|undefined;
  for(const service of services){const chars=await service.getCharacteristics();for(const c of chars){found.push(`${service.uuid} → ${c.uuid}${c.properties.write||c.properties.writeWithoutResponse?' (escrita)':''}`);if(profiles.some(p=>p.service===bleUuid(service.uuid)&&p.characteristic===bleUuid(c.uuid))&&(c.properties.write||c.properties.writeWithoutResponse))target=c;}}
  diagnostic=`Dispositivo: ${selected.name||'Sem nome'}\n${found.join('\n')||'Nenhum serviço autorizado encontrado.'}`;
  if(!target)throw Error('Conexão BLE encontrada, mas o canal de impressão não foi identificado. Confira os UUIDs no diagnóstico ou informe os do fabricante em Configuração avançada. Nenhum comando foi enviado.');
  device=selected;channel=target;const current=selected;current.addEventListener('gattserverdisconnected',()=>{if(device===current){device=null;channel=null}});
 }catch(e){selected?.gatt?.disconnect();const error=e as Error;if(error.name==='NotFoundError')throw Error('Nenhum dispositivo BLE foi selecionado. Ligue a TC-163, desconecte-a de outros aparelhos e permita Bluetooth ao Bluefy/WebBLE. Se não aparecer, ainda não há confirmação de BLE nesse modelo.');if(error.name==='SecurityError'||error.name==='NotAllowedError')throw Error('Permita Bluetooth nas configurações do Bluefy/WebBLE e abra o Maestria por HTTPS. Depois toque novamente em Conectar por Bluetooth BLE.');if(error.name==='NetworkError')throw Error('Conexão BLE interrompida. Aproxime e reinicie a impressora, feche outros aplicativos de impressão e desconecte-a do MacBook.');throw e;}
}
export async function disconnectBlePrinter(){if(busy)throw Error('Aguarde o envio da comanda terminar.');device?.gatt?.disconnect();device=null;channel=null;}
export async function sendBleBytes(bytes:Uint8Array){
 if(!bleAvailable()||!channel)throw Error('Reconecte a impressora BLE.');if(busy)throw Error('Outra comanda está sendo enviada.');busy=true;
 const current=channel;let expired=false,timer:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([(async()=>{for(let i=0;i<bytes.length;i+=20){if(expired||!bleAvailable())throw Error('Conexão BLE interrompida. Confira o papel antes de reimprimir.');const chunk=bytes.slice(i,i+20);if(current.properties.writeWithoutResponse&&current.writeValueWithoutResponse)await current.writeValueWithoutResponse(chunk);else if(current.writeValueWithResponse)await current.writeValueWithResponse(chunk);else if(current.writeValue)await current.writeValue(chunk);else throw Error('Canal BLE sem método de escrita.');await new Promise(r=>setTimeout(r,50));}})(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{expired=true;device?.gatt?.disconnect();reject(Error('Envio BLE demorou demais. Confira o papel antes de reimprimir.'));},40000)})]);}
 catch(e){expired=true;device?.gatt?.disconnect();device=null;channel=null;throw e;}finally{clearTimeout(timer);busy=false;}
}
