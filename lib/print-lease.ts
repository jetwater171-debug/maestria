// Keep the private job reservation alive while a long receipt is being sent.
// A lost renewal stops future chunks; it never causes bytes to be repeated.
export async function withPrintLease<T>(write:(signal:AbortSignal)=>Promise<T>,renew:()=>Promise<unknown>){
 const controller=new AbortController();
 const visibility=()=>{if(typeof document!=='undefined'&&document.hidden)controller.abort()};
 const leaving=()=>controller.abort();
 if(typeof document!=='undefined'){document.addEventListener('visibilitychange',visibility);visibility()}
 if(typeof window!=='undefined')window.addEventListener('pagehide',leaving);
 let renewing=false,stopped=false,lastRenewal=Date.now();
 const timer=setInterval(()=>{
  if(stopped||renewing)return;
  // A suspended tab must not resume a physical write under an expired lease.
  if(Date.now()-lastRenewal>60000){controller.abort();return;}
  renewing=true;
  void Promise.resolve().then(renew).then(()=>{lastRenewal=Date.now()},()=>controller.abort()).finally(()=>{renewing=false});
 },15000);
 try{
  const value=await write(controller.signal);
  if(controller.signal.aborted)throw Error('A reserva da impressão se perdeu. Confira o papel antes de repetir.');
  return value;
 }finally{
  stopped=true;clearInterval(timer);
  if(typeof document!=='undefined')document.removeEventListener('visibilitychange',visibility);
  if(typeof window!=='undefined')window.removeEventListener('pagehide',leaving);
 }
}
