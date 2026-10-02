import {gzip} from 'pako';

export function receiptHtml(content:string){
 const escaped=content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 return `<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:0}body{margin:0;width:100%;color:#000;background:#fff}pre{margin:0;padding:2mm;font:15px monospace;white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><pre>${escaped}</pre></body></html>`;
}

// Open ESC/POS expects base64(gzip(JSON array of HTML pages)).
export function androidPrintIntent(content:string){
 const bytes=gzip(JSON.stringify([receiptHtml(content)]));
 let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 return `intent://#Intent;scheme=print-intent;package=com.farminos.print;S.content=${encodeURIComponent(btoa(binary))};S.browser_fallback_url=${encodeURIComponent('https://play.google.com/store/apps/details?id=com.farminos.print')};end`;
}

// Official RawBT URI contract: rawbt:base64,<raw ESC/POS bytes>.
// The app handles Bluetooth Classic; the browser only opens an external link.
export function rawBtLink(content:string){
 const clean=content.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e\n]/g,'');
 const wrapped=clean.split('\n').flatMap(line=>line.match(/.{1,32}/g)||['']).join('\n');
 const bytes=new Uint8Array([27,64,27,97,0,...new TextEncoder().encode(wrapped+'\n\n\n')]);
 let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 return 'rawbt:base64,'+btoa(binary);
}
