import {createHmac,scrypt,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';

type Environment=Record<string,string|undefined>;
export const ADMIN_COOKIE='maestria_admin_session';
export const ADMIN_SESSION_SECONDS=8*60*60;
const configuration=(env:Environment)=>env.SAAS_ADMIN_PASSWORD&&env.SAAS_ADMIN_SESSION_SECRET&&env.SAAS_ADMIN_SESSION_SECRET.length>=32?{password:env.SAAS_ADMIN_PASSWORD,secret:env.SAAS_ADMIN_SESSION_SECRET}:null;
const mac=(secret:string,value:string)=>createHmac('sha256',secret).update(value).digest('base64url');
const equal=(first:string,second:string)=>{const a=Buffer.from(first),b=Buffer.from(second);return a.length===b.length&&timingSafeEqual(a,b)};
const passwordVersion=(secret:string,password:string)=>mac(secret,'password-version\0'+password);
const derive=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:32*1024*1024},(error,key)=>error?reject(error):resolve(key)));

export async function checkAdminPassword(candidate:unknown,env:Environment=process.env){
 const config=configuration(env);
 if(!config||typeof candidate!=='string'||!candidate||Buffer.byteLength(candidate)>512)return false;
 const salt=mac(config.secret,'password-scrypt-salt');
 const [provided,expected]=await Promise.all([derive(candidate,salt),derive(config.password,salt)]);
 return timingSafeEqual(provided,expected);
}

export function createAdminSession(now=Date.now(),env:Environment=process.env){
 const config=configuration(env);if(!config)throw Error('Acesso administrativo indisponível.');
 const body=`v1.${Math.floor(now/1000)+ADMIN_SESSION_SECONDS}.${passwordVersion(config.secret,config.password)}`;
 return body+'.'+mac(config.secret,'admin-session\0'+body);
}

export function validAdminSession(token:unknown,now=Date.now(),env:Environment=process.env){
 const config=configuration(env);
 if(!config||typeof token!=='string'||token.length>256)return false;
 const parts=token.split('.');if(parts.length!==4||parts[0]!=='v1'||!/^\d{10,12}$/.test(parts[1]))return false;
 const expiry=Number(parts[1]),seconds=Math.floor(now/1000);
 if(!Number.isSafeInteger(expiry)||expiry<=seconds||expiry>seconds+ADMIN_SESSION_SECONDS)return false;
 const body=parts.slice(0,3).join('.');
 return equal(parts[3],mac(config.secret,'admin-session\0'+body))&&equal(parts[2],passwordVersion(config.secret,config.password));
}

export function hasAdminSession(req:Request,now=Date.now(),env:Environment=process.env){
 const matches=(req.headers.get('cookie')||'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(ADMIN_COOKIE+'='));
 return matches.length===1&&validAdminSession(matches[0].slice(ADMIN_COOKIE.length+1),now,env);
}

export function adminSessionCookie(value:string,production=process.env.NODE_ENV==='production'){
 return `${ADMIN_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${value?ADMIN_SESSION_SECONDS:0}${production?'; Secure':''}`;
}

export function sameAdminOrigin(req:Request){return req.headers.get('origin')===new URL(req.url).origin}

// Per-instance protection. The global bucket also limits attempts with rotating addresses.
export class AdminLoginLimiter{
 private clients=new Map<string,{count:number;until:number}>();
 private global={count:0,until:0};
 allow(ip:string,now=Date.now()){
  if(now>=this.global.until)this.global={count:0,until:now+60000};
  if(this.global.count>=60)return {allowed:false,retryAfter:Math.max(1,Math.ceil((this.global.until-now)/1000))};
  this.global.count++;
  for(const [key,bucket] of this.clients)if(now>=bucket.until)this.clients.delete(key);
  const key=createHmac('sha256','admin-rate-limit-local-key').update(ip.slice(0,128)).digest('hex');
  let bucket=this.clients.get(key);
  if(!bucket){if(this.clients.size>=2000)return {allowed:false,retryAfter:600};bucket={count:0,until:now+600000};this.clients.set(key,bucket)}
  if(bucket.count>=5)return {allowed:false,retryAfter:Math.max(1,Math.ceil((bucket.until-now)/1000))};
  bucket.count++;return {allowed:true,retryAfter:0};
 }
}

export function adminClientIp(req:Request,env:Environment=process.env){
 // Vercel overwrites X-Forwarded-For. Other hosts need a trusted proxy before using it.
 const value=env.VERCEL==='1'?req.headers.get('x-forwarded-for')?.split(',')[0].trim():undefined;
 return value&&isIP(value)?value:'local-or-untrusted';
}
