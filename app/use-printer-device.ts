'use client';
import {useSyncExternalStore} from 'react';
import {browserPrinterCapabilities,getPrinterCapabilities} from '@/lib/printer-capabilities';
import {printerAvailable} from '@/lib/kitchen-printer';
import {subscribePrinterChange,printerConnectionRevision,printerTestConfirmed} from '@/lib/printer-events';
const savedMethod=()=>{try{return localStorage.getItem('maestria-print-method')||''}catch{return ''}};
const snapshot=()=>JSON.stringify({...browserPrinterCapabilities(),method:savedMethod(),connected:printerAvailable(),revision:printerConnectionRevision(),verified:printerTestConfirmed()});
const server=JSON.stringify({...getPrinterCapabilities(),method:'',connected:false,revision:0,verified:false});
export function usePrinterDevice(){return JSON.parse(useSyncExternalStore(subscribePrinterChange,snapshot,()=>server)) as ReturnType<typeof browserPrinterCapabilities>&{method:string;connected:boolean;revision:number;verified:boolean}}
