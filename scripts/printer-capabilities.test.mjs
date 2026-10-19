import test from 'node:test';
import assert from 'node:assert/strict';
import {getPrinterCapabilities, browserPrinterCapabilities} from '../lib/printer-capabilities.ts';

const serial = {requestPort() {}};
const bluetooth = {requestDevice() {}};

test('API real decide conexão; Chrome no nome e objetos vazios não habilitam impressão', () => {
 const noApi = getPrinterCapabilities({userAgent:'Android Chrome/142',secureContext:true,serial:{},bluetooth:{}});
 assert.equal(noApi.directSerial,false);
 assert.equal(noApi.directBle,false);
 assert.equal(noApi.recommendedMethod,'android-app');
 const real = getPrinterCapabilities({userAgent:'Android OutraCoisa',secureContext:true,serial,bluetooth});
 assert.equal(real.directSerial,true);
 assert.equal(real.directBle,true);
 assert.equal(real.recommendedMethod,'serial');
 const malformed = getPrinterCapabilities({secureContext:true,serial:{requestPort:true},bluetooth:{requestDevice:{}}});
 assert.equal(malformed.directSerial,false);
 assert.equal(malformed.directBle,false);
});

test('HTTPS é necessário para sugerir conexão direta mesmo com objetos de API presentes', () => {
 for (const secureContext of [false,undefined]) {
  const c = getPrinterCapabilities({userAgent:'Android',secureContext,serial,bluetooth});
  assert.equal(c.directSerial,false);
  assert.equal(c.directBle,false);
  assert.equal(c.recommendedMethod,'android-app');
 }
});

test('iPad em modo desktop é iOS; MacBook sem multitouch continua desktop', () => {
 assert.equal(getPrinterCapabilities({userAgent:'Mozilla iPhone'}).platform,'ios');
 assert.equal(getPrinterCapabilities({userAgent:'Mozilla Macintosh',maxTouchPoints:5}).platform,'ios');
 assert.equal(getPrinterCapabilities({platform:'MacIntel',maxTouchPoints:5}).platform,'ios');
 assert.equal(getPrinterCapabilities({userAgent:'Mozilla Macintosh',maxTouchPoints:0}).platform,'desktop');
 assert.equal(getPrinterCapabilities({userAgent:'iPad'}).platform,'ios');
});

test('Safari e PWA não ganham BLE só por serem iPhone; Bluefy também precisa expor a API', () => {
 const c = getPrinterCapabilities({userAgent:'iPhone Safari',secureContext:true});
 assert.equal(c.directBle,false);
 assert.equal(c.recommendedMethod,'other-device');
 assert.equal(c.bleCompatibility,'unknown');
 assert.equal(c.canTryIosBleBrowser,true);
 assert.equal(getPrinterCapabilities({userAgent:'iPhone Bluefy',secureContext:true}).directBle,false);
 const available = getPrinterCapabilities({userAgent:'iPhone Bluefy',secureContext:true,bluetooth});
 assert.equal(available.directBle,true);
 assert.equal(available.recommendedMethod,'ble');
});

test('tutorial BLE no iPhone depende da impressora e não transforma Classic em BLE', () => {
 const compatible = getPrinterCapabilities({userAgent:'iPhone',blePrinterCompatible:true});
 assert.equal(compatible.recommendedMethod,'ios-ble-browser');
 assert.equal(compatible.bleCompatibility,'confirmed');
 const classic = getPrinterCapabilities({userAgent:'iPhone',secureContext:true,bluetooth,blePrinterCompatible:false});
 assert.equal(classic.canTryIosBleBrowser,false);
 assert.equal(classic.recommendedMethod,'other-device');
});

test('AirPrint exige equipamento confirmado além da função de imprimir', () => {
 const base = {userAgent:'iPhone',systemPrint() {}};
 assert.equal(getPrinterCapabilities(base).canUseAirPrint,false);
 assert.equal(getPrinterCapabilities(base).recommendedMethod,'other-device');
 const supported = getPrinterCapabilities({...base,airPrintCompatible:true});
 assert.equal(supported.canUseAirPrint,true);
 assert.equal(supported.recommendedMethod,'system-print');
 assert.equal(getPrinterCapabilities({userAgent:'iPhone',airPrintCompatible:true}).canUseAirPrint,false);
});

test('identifica navegadores internos sem desabilitar uma API real', () => {
 for (const userAgent of ['Android; wv) Chrome','iPhone Instagram','Android FBAV/1','iPhone MicroMessenger/8','iPhone GSA/1']) {
  assert.equal(getPrinterCapabilities({userAgent}).embeddedBrowser,true);
 }
 assert.equal(getPrinterCapabilities({userAgent:'Android Chrome/142 Safari/537'}).embeddedBrowser,false);
 assert.equal(getPrinterCapabilities({userAgent:'Android Instagram',secureContext:true,bluetooth}).directBle,true);
});

test('helper de navegador é seguro no servidor e não acessa APIs no import', () => {
 assert.equal(typeof window,'undefined');
 const c = browserPrinterCapabilities();
 assert.equal(c.directSerial,false);
 assert.equal(c.directBle,false);
 assert.equal(c.recommendedMethod,'other-device');
});

import {preferredReceiptMethod} from '../lib/print-method.ts';
import {printerConnectionRevision,confirmPrinterTest,printerTestConfirmed,notifyPrinterChange} from '../lib/printer-events.ts';
test('impressora conectada vence preferência antiga de aplicativo no Android',()=>{
 const caps=getPrinterCapabilities({userAgent:'Android Chrome',secureContext:true,serial:{requestPort:()=>{}}});
 assert.equal(preferredReceiptMethod(caps,true,'rawbt'),'direct');
 assert.equal(preferredReceiptMethod(caps,false,null),'direct');
 assert.equal(preferredReceiptMethod(caps,false,'rawbt'),'rawbt');
});
test('preferência direta indisponível cai para o tutorial apropriado, nunca RawBT no iPhone',()=>{
 const android=getPrinterCapabilities({userAgent:'Android',secureContext:true});
 const ios=getPrinterCapabilities({userAgent:'iPhone',secureContext:true,systemPrint:()=>{}});
 assert.equal(preferredReceiptMethod(android,false,'direct'),'rawbt');assert.equal(preferredReceiptMethod(ios,false,'rawbt'),'system');
});
test('nova conexão invalida confirmação do papel; trocar preferência não invalida',()=>{
 notifyPrinterChange(true);const version=printerConnectionRevision();assert.equal(printerTestConfirmed(),false);
 confirmPrinterTest();assert.equal(printerTestConfirmed(),true);notifyPrinterChange();assert.equal(printerTestConfirmed(),true);
 notifyPrinterChange(true);assert.equal(printerConnectionRevision(),version+1);assert.equal(printerTestConfirmed(),false);
});
