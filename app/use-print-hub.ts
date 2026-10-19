'use client';
import {useSyncExternalStore} from 'react';
import type {PrinterState} from '@/lib/printing';
let current=0,timer:ReturnType<typeof setInterval>|undefined;
const listeners=new Set<()=>void>();
function subscribe(notify:()=>void){listeners.add(notify);current=Date.now();if(!timer)timer=setInterval(()=>{current=Date.now();listeners.forEach(fn=>fn())},4000);return()=>{listeners.delete(notify);if(!listeners.size){clearInterval(timer);timer=undefined}}}
export function usePrintHub(printer?:PrinterState){const now=useSyncExternalStore(subscribe,()=>current,()=>0);const age=now-Date.parse(printer?.hub?.lastSeen||'');return {enabled:printer?.relayEnabled===true,online:now>0&&!!printer?.hub&&Number.isFinite(age)&&age<20000}}
