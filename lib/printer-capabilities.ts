export type PrinterPlatform = 'android' | 'ios' | 'desktop';
export type PrinterMethod = 'serial' | 'ble' | 'android-app' | 'ios-ble-browser' | 'system-print' | 'other-device';

export type PrinterCapabilityInput = {
 userAgent?: string;
 platform?: string;
 maxTouchPoints?: number;
 secureContext?: boolean;
 serial?: {requestPort?: unknown};
 bluetooth?: {requestDevice?: unknown};
 systemPrint?: unknown;
 blePrinterCompatible?: boolean;
 airPrintCompatible?: boolean;
};

export type PrinterCompatibilityOptions = Pick<PrinterCapabilityInput, 'blePrinterCompatible' | 'airPrintCompatible'>;

/** Platform labels choose instructions; only real browser APIs enable a connection. */
export function getPrinterCapabilities(input: PrinterCapabilityInput = {}) {
 const ua = input.userAgent || '';
 const device = `${ua} ${input.platform || ''}`;
 const ios = /iPhone|iPad|iPod/i.test(device) || (/Macintosh|MacIntel/i.test(device) && (input.maxTouchPoints || 0) > 1);
 const platform: PrinterPlatform = ios ? 'ios' : /Android/i.test(device) ? 'android' : 'desktop';
 const embeddedBrowser = /FBAN|FBAV|Instagram|MicroMessenger|\bLine\/|Snapchat|;\s*wv\)|\bWebView\b|GSA\//i.test(ua);
 const secureContext = input.secureContext === true;
 const directSerial = secureContext && typeof input.serial?.requestPort === 'function';
 const directBle = secureContext && typeof input.bluetooth?.requestDevice === 'function';
 const canUseAndroidApp = platform === 'android';
 // A browser with BLE cannot add BLE support to a Bluetooth Classic printer.
 const canTryIosBleBrowser = platform === 'ios' && input.blePrinterCompatible !== false;
 const systemPrintAvailable = typeof input.systemPrint === 'function';
 const canUseAirPrint = platform === 'ios' && systemPrintAvailable && input.airPrintCompatible === true;
 const bleCompatibility = input.blePrinterCompatible === true ? 'confirmed' : input.blePrinterCompatible === false ? 'unsupported' : 'unknown';

 let recommendedMethod: PrinterMethod = 'other-device';
 if (directSerial) recommendedMethod = 'serial';
 else if (directBle && input.blePrinterCompatible !== false) recommendedMethod = 'ble';
 else if (canUseAndroidApp) recommendedMethod = 'android-app';
 else if (canUseAirPrint || (platform === 'desktop' && systemPrintAvailable)) recommendedMethod = 'system-print';
 else if (canTryIosBleBrowser && input.blePrinterCompatible === true) recommendedMethod = 'ios-ble-browser';

 return {platform, secureContext, embeddedBrowser, directSerial, directBle, canUseAndroidApp, canTryIosBleBrowser, systemPrintAvailable, canUseAirPrint, bleCompatibility, recommendedMethod};
}

export type PrinterCapabilities = ReturnType<typeof getPrinterCapabilities>;

/** Support report contains capabilities only: never access links, tokens or orders. */
export function printerCompatibilityReport(caps:PrinterCapabilities,connected=false,verified=false){
 const yes=(value:boolean)=>value?'sim':'não';
 return ['Maestria Beach — compatibilidade de impressão',
  `Aparelho: ${caps.platform==='ios'?'iPhone / iPad':caps.platform==='android'?'Android':'Computador'}`,
  `Contexto seguro: ${yes(caps.secureContext)}`,
  `Navegador interno: ${yes(caps.embeddedBrowser)}`,
  `Conexão Serial oferecida pelo navegador: ${yes(caps.directSerial)}`,
  `Conexão BLE oferecida pelo navegador: ${yes(caps.directBle)}`,
  `Impressão do sistema disponível: ${yes(caps.systemPrintAvailable)}`,
  `Conexão local ativa: ${yes(connected)}`,
  `Teste em papel confirmado nesta conexão: ${yes(connected&&verified)}`,
  'A compatibilidade BLE/AirPrint e o papel impresso dependem de teste no equipamento.',
 ].join('\n');
}

/** Safe to import/render on the server. Re-read after mounting to inspect this device. */
export function browserPrinterCapabilities(options: PrinterCompatibilityOptions = {}): PrinterCapabilities {
 if (typeof window === 'undefined' || typeof navigator === 'undefined') return getPrinterCapabilities(options);
 const browser = navigator as Navigator & {
  serial?: {requestPort?: unknown};
  bluetooth?: {requestDevice?: unknown};
 };
 return getPrinterCapabilities({
  userAgent: browser.userAgent,
  platform: browser.platform,
  maxTouchPoints: browser.maxTouchPoints,
  secureContext: window.isSecureContext,
  serial: browser.serial,
  bluetooth: browser.bluetooth,
  systemPrint: window.print,
  ...options,
 });
}
