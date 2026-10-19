// One event keeps all connection controls and order buttons in agreement.
let revision=0,verifiedRevision=-1;
export const printerConnectionRevision=()=>revision;
export function notifyPrinterChange(connectionChanged=false){if(connectionChanged)revision++;if(typeof window!=='undefined')window.dispatchEvent(new Event('maestria-printer-change'))}
export function subscribePrinterChange(listener:()=>void){window.addEventListener('maestria-printer-change',listener);window.addEventListener('storage',listener);return()=>{window.removeEventListener('maestria-printer-change',listener);window.removeEventListener('storage',listener)}}
export function savePrintMethod(method:string){try{localStorage.setItem('maestria-print-method',method)}catch{}notifyPrinterChange()}

export function confirmPrinterTest(){verifiedRevision=revision;notifyPrinterChange()}
export const printerTestConfirmed=()=>verifiedRevision===revision;
