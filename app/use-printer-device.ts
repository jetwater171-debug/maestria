'use client';
import {useSyncExternalStore} from 'react';
import {browserPrinterCapabilities,getPrinterCapabilities} from '@/lib/printer-capabilities';
import {printerAvailable} from '@/lib/kitchen-printer';
import {subscribePrinterChange,printerConnectionRevision,printerTestConfirmed} from '@/lib/printer-events';
const snapshot=()=>JSON.stringify({...browserPrinterCapabilities(),connected:printerAvailable(),revision:printerConnectionRevision(),verified:printerTestConfirmed()});
const server=JSON.stringify({...getPrinterCapabilities(),connected:false,revision:0,verified:false});
export function usePrinterDevice(){return JSON.parse(useSyncExternalStore(subscribePrinterChange,snapshot,()=>server)) as ReturnType<typeof browserPrinterCapabilities>&{connected:boolean;revision:number;verified:boolean}}
